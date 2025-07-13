const { Logger } = require('@autoweave/shared');
const { RetryHelper } = require('@autoweave/shared');
const git = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

/**
 * GitOps Manager
 * Handles Git operations and Argo CD integration for deployment
 */
class GitOpsManager {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('GitOpsManager');
        this.retryHelper = new RetryHelper();
        this.workspaceDir = path.join('/tmp', 'autoweave-gitops');
    }

    async initialize() {
        this.logger.info('Initializing GitOps Manager...');
        
        try {
            // Create workspace directory
            await fs.mkdir(this.workspaceDir, { recursive: true });
            
            this.logger.success('GitOps Manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize GitOps Manager:', error);
            throw error;
        }
    }

    /**
     * Deploy manifests to GitOps repository
     * @param {Object} options - Deployment options
     * @returns {Promise<Object>} Deployment result
     */
    async deployToGitOps(options) {
        const { manifests, gitRepo, targetNamespace, commitMessage } = options;
        
        this.logger.info('Deploying to GitOps repository:', { gitRepo, targetNamespace });
        
        try {
            // Clone repository
            const repoDir = await this.cloneRepository(gitRepo);
            
            // Create manifests directory structure
            const manifestsDir = path.join(repoDir, 'manifests', targetNamespace || 'default');
            await fs.mkdir(manifestsDir, { recursive: true });
            
            // Write manifests to files
            const writtenFiles = await this.writeManifests(manifests, manifestsDir);
            
            // Create/update Argo CD Application
            const argocdApp = await this.createArgocdApplication(options, repoDir);
            
            // Commit and push changes
            const commitResult = await this.commitAndPush(repoDir, writtenFiles, commitMessage);
            
            // Clean up
            await this.cleanup(repoDir);
            
            const result = {
                success: true,
                gitRepo,
                targetNamespace,
                manifestsWritten: writtenFiles.length,
                argocdApplication: argocdApp,
                commitResult,
                deployedAt: new Date().toISOString()
            };
            
            this.logger.success('GitOps deployment completed successfully');
            return result;
            
        } catch (error) {
            this.logger.error('GitOps deployment failed:', error);
            throw error;
        }
    }

    /**
     * Clone Git repository
     * @param {string} gitRepo - Git repository URL
     * @returns {Promise<string>} Local repository path
     */
    async cloneRepository(gitRepo) {
        const repoName = path.basename(gitRepo, '.git');
        const repoDir = path.join(this.workspaceDir, `${repoName}-${Date.now()}`);
        
        this.logger.info('Cloning repository:', gitRepo);
        
        try {
            // Use shallow clone for performance
            const gitClient = git();
            await gitClient.clone(gitRepo, repoDir, ['--depth', '1']);
            
            this.logger.success('Repository cloned successfully:', repoDir);
            return repoDir;
            
        } catch (error) {
            this.logger.error('Failed to clone repository:', error);
            throw error;
        }
    }

    /**
     * Write manifests to files
     * @param {Object} manifests - Kubernetes manifests
     * @param {string} outputDir - Output directory
     * @returns {Promise<Array>} Written file paths
     */
    async writeManifests(manifests, outputDir) {
        const writtenFiles = [];
        
        for (const [name, manifest] of Object.entries(manifests)) {
            const fileName = `${name}.yaml`;
            const filePath = path.join(outputDir, fileName);
            
            // Convert to YAML
            const yamlContent = yaml.stringify(manifest, { indent: 2 });
            
            // Write to file
            await fs.writeFile(filePath, yamlContent);
            writtenFiles.push(filePath);
            
            this.logger.debug('Manifest written:', fileName);
        }
        
        this.logger.info(`${writtenFiles.length} manifests written to ${outputDir}`);
        return writtenFiles;
    }

    /**
     * Create Argo CD Application manifest
     * @param {Object} options - Deployment options
     * @param {string} repoDir - Repository directory
     * @returns {Promise<Object>} Argo CD Application manifest
     */
    async createArgocdApplication(options, repoDir) {
        const { gitRepo, targetNamespace, manifests } = options;
        
        // Extract agent ID from manifests
        const agentId = Object.values(manifests).find(m => 
            m.metadata?.labels?.['autoweave.dev/agent-id']
        )?.metadata?.labels?.['autoweave.dev/agent-id'] || 'unknown';
        
        const argocdApp = {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                name: `autoweave-${agentId}`,
                namespace: 'argocd',
                labels: {
                    'autoweave.dev/agent-id': agentId,
                    'autoweave.dev/component': 'gitops-application'
                }
            },
            spec: {
                project: 'default',
                source: {
                    repoURL: gitRepo,
                    path: `manifests/${targetNamespace || 'default'}`,
                    targetRevision: 'HEAD'
                },
                destination: {
                    server: 'https://kubernetes.default.svc',
                    namespace: targetNamespace || 'default'
                },
                syncPolicy: {
                    automated: {
                        prune: true,
                        selfHeal: true
                    },
                    syncOptions: [
                        'CreateNamespace=true'
                    ]
                }
            }
        };
        
        // Write Argo CD Application
        const argocdDir = path.join(repoDir, 'argocd');
        await fs.mkdir(argocdDir, { recursive: true });
        
        const argocdAppPath = path.join(argocdDir, `autoweave-${agentId}.yaml`);
        await fs.writeFile(argocdAppPath, yaml.stringify(argocdApp, { indent: 2 }));
        
        this.logger.success('Argo CD Application created:', argocdAppPath);
        return argocdApp;
    }

    /**
     * Commit and push changes to Git repository
     * @param {string} repoDir - Repository directory
     * @param {Array} files - Files to commit
     * @param {string} commitMessage - Commit message
     * @returns {Promise<Object>} Commit result
     */
    async commitAndPush(repoDir, files, commitMessage) {
        const gitClient = git(repoDir);
        
        try {
            // Configure git user (use generic AutoWeave identity)
            await gitClient.addConfig('user.name', 'AutoWeave Integration Agent');
            await gitClient.addConfig('user.email', 'autoweave@example.com');
            
            // Add files
            await gitClient.add('.');
            
            // Check if there are changes to commit
            const status = await gitClient.status();
            if (status.files.length === 0) {
                this.logger.info('No changes to commit');
                return { success: true, changes: 0 };
            }
            
            // Commit
            const message = commitMessage || `AutoWeave: Deploy integration agent - ${new Date().toISOString()}`;
            const commitResult = await gitClient.commit(message);
            
            // Push
            await gitClient.push('origin', 'main');
            
            this.logger.success('Changes committed and pushed successfully:', {
                commit: commitResult.commit,
                files: status.files.length
            });
            
            return {
                success: true,
                commit: commitResult.commit,
                changes: status.files.length,
                message
            };
            
        } catch (error) {
            this.logger.error('Failed to commit and push changes:', error);
            throw error;
        }
    }

    /**
     * Create GitOps repository structure
     * @param {string} repoDir - Repository directory
     * @returns {Promise<void>}
     */
    async createGitOpsStructure(repoDir) {
        const structure = {
            'manifests/default': 'Default namespace manifests',
            'manifests/staging': 'Staging namespace manifests',
            'manifests/production': 'Production namespace manifests',
            'argocd': 'Argo CD Applications',
            'policies': 'OPA policies for conftest',
            'scripts': 'Deployment scripts'
        };
        
        for (const [dir, description] of Object.entries(structure)) {
            const dirPath = path.join(repoDir, dir);
            await fs.mkdir(dirPath, { recursive: true });
            
            // Create README in each directory
            const readmePath = path.join(dirPath, 'README.md');
            await fs.writeFile(readmePath, `# ${dir}\n\n${description}\n`);
        }
        
        // Create main README
        const mainReadme = `# AutoWeave GitOps Repository

This repository contains Kubernetes manifests and Argo CD applications for AutoWeave integration agents.

## Structure

- \`manifests/\`: Kubernetes manifests organized by namespace
- \`argocd/\`: Argo CD Application definitions
- \`policies/\`: OPA policies for validation
- \`scripts/\`: Deployment and maintenance scripts

## Usage

This repository is managed by AutoWeave Integration Agent. Manual changes may be overwritten.

Generated on: ${new Date().toISOString()}
`;
        
        await fs.writeFile(path.join(repoDir, 'README.md'), mainReadme);
        
        this.logger.success('GitOps repository structure created');
    }

    /**
     * Validate repository structure
     * @param {string} repoDir - Repository directory
     * @returns {Promise<boolean>} Validation result
     */
    async validateRepository(repoDir) {
        const requiredDirs = ['manifests', 'argocd'];
        
        for (const dir of requiredDirs) {
            const dirPath = path.join(repoDir, dir);
            try {
                await fs.access(dirPath);
            } catch (error) {
                this.logger.warn(`Missing required directory: ${dir}`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Sync with Argo CD
     * @param {string} applicationName - Argo CD application name
     * @returns {Promise<Object>} Sync result
     */
    async syncWithArgoCD(applicationName) {
        this.logger.info('Syncing with Argo CD:', applicationName);
        
        try {
            // Use argocd CLI if available
            const { spawn } = require('child_process');
            
            const syncResult = await new Promise((resolve, reject) => {
                const child = spawn('argocd', ['app', 'sync', applicationName]);
                let stdout = '';
                let stderr = '';
                
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                
                child.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true, output: stdout });
                    } else {
                        reject(new Error(`Argo CD sync failed: ${stderr}`));
                    }
                });
            });
            
            this.logger.success('Argo CD sync completed');
            return syncResult;
            
        } catch (error) {
            this.logger.warn('Argo CD sync failed (CLI not available):', error.message);
            // Return success but note that manual sync may be required
            return { success: false, error: error.message, requiresManualSync: true };
        }
    }

    /**
     * Clean up temporary files
     * @param {string} repoDir - Repository directory to clean up
     * @returns {Promise<void>}
     */
    async cleanup(repoDir) {
        try {
            await fs.rm(repoDir, { recursive: true, force: true });
            this.logger.debug('Temporary repository cleaned up:', repoDir);
        } catch (error) {
            this.logger.warn('Failed to cleanup temporary repository:', error);
        }
    }

    /**
     * List deployed applications
     * @returns {Promise<Array>} List of deployed applications
     */
    async listDeployedApplications() {
        // This would typically query Argo CD API
        // For now, return empty array
        return [];
    }

    /**
     * Get application status
     * @param {string} applicationName - Application name
     * @returns {Promise<Object>} Application status
     */
    async getApplicationStatus(applicationName) {
        // This would typically query Argo CD API
        // For now, return mock status
        return {
            name: applicationName,
            status: 'Unknown',
            message: 'Argo CD integration not fully configured'
        };
    }
}

module.exports = { GitOpsManager };