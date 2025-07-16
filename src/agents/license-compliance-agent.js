const { Logger } = require('../utils/logger');
const { FreshSourcesService } = require('../services/fresh-sources-service');
const fs = require('fs').promises;
const path = require('path');

/**
 * LicenseComplianceAgent - Agent spécialisé dans la compliance des licences
 * Analyse les dépendances et vérifie la compatibilité des licences
 */
class LicenseComplianceAgent {
    constructor(config, memoryManager) {
        this.logger = new Logger('LicenseComplianceAgent');
        this.config = config;
        this.memoryManager = memoryManager;
        this.freshSources = new FreshSourcesService(config.freshSources);
        
        // Matrice de compatibilité des licences
        this.licenseCompatibilityMatrix = {
            'MIT': {
                compatible: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0'],
                incompatible: [],
                risk: 'low'
            },
            'Apache-2.0': {
                compatible: ['Apache-2.0', 'MIT', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', 'GPL-3.0', 'LGPL-3.0'],
                incompatible: ['GPL-2.0', 'LGPL-2.1'],
                risk: 'low'
            },
            'BSD-3-Clause': {
                compatible: ['BSD-3-Clause', 'MIT', 'Apache-2.0', 'BSD-2-Clause', 'ISC', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0'],
                incompatible: [],
                risk: 'low'
            },
            'GPL-2.0': {
                compatible: ['GPL-2.0', 'LGPL-2.1'],
                incompatible: ['Apache-2.0', 'GPL-3.0'],
                risk: 'high'
            },
            'GPL-3.0': {
                compatible: ['GPL-3.0', 'LGPL-3.0', 'Apache-2.0', 'MIT', 'BSD-3-Clause'],
                incompatible: ['GPL-2.0'],
                risk: 'high'
            },
            'LGPL-2.1': {
                compatible: ['LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause'],
                incompatible: [],
                risk: 'medium'
            },
            'LGPL-3.0': {
                compatible: ['LGPL-3.0', 'GPL-3.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause'],
                incompatible: ['GPL-2.0'],
                risk: 'medium'
            },
            'MPL-2.0': {
                compatible: ['MPL-2.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-2.0', 'GPL-3.0'],
                incompatible: [],
                risk: 'medium'
            },
            'AGPL-3.0': {
                compatible: ['AGPL-3.0', 'GPL-3.0'],
                incompatible: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-2.0'],
                risk: 'high'
            },
            'Proprietary': {
                compatible: ['Proprietary'],
                incompatible: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
                risk: 'high'
            }
        };
        
        // Licences open source recommandées
        this.recommendedLicenses = {
            'permissive': ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'],
            'copyleft-weak': ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-2.0'],
            'copyleft-strong': ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0']
        };
    }

    /**
     * Audit complet de la compliance des licences
     */
    async auditLicenseCompliance(projectPath, options = {}) {
        this.logger.info(`Starting license compliance audit for: ${projectPath}`);
        
        try {
            // 1. Découvrir toutes les dépendances
            const dependencies = await this.discoverDependencies(projectPath);
            
            // 2. Analyser les licences
            const licenseAnalysis = await this.analyzeLicenses(dependencies);
            
            // 3. Vérifier la compatibilité
            const compatibilityReport = this.checkCompatibility(licenseAnalysis);
            
            // 4. Identifier les risques
            const riskAssessment = this.assessLicenseRisks(licenseAnalysis);
            
            // 5. Générer des recommandations
            const recommendations = this.generateRecommendations(licenseAnalysis, compatibilityReport, riskAssessment);
            
            // 6. Créer le rapport final
            const report = {
                projectPath,
                auditDate: new Date().toISOString(),
                summary: {
                    totalDependencies: dependencies.length,
                    licenseTypes: Object.keys(licenseAnalysis.licenseGroups).length,
                    complianceScore: this.calculateComplianceScore(licenseAnalysis, riskAssessment),
                    riskLevel: this.calculateOverallRiskLevel(riskAssessment)
                },
                dependencies,
                licenseAnalysis,
                compatibilityReport,
                riskAssessment,
                recommendations
            };
            
            // 7. Sauvegarder dans la mémoire
            await this.saveLicenseAuditResults(report);
            
            return report;
            
        } catch (error) {
            this.logger.error(`License compliance audit failed:`, error);
            throw error;
        }
    }

    /**
     * Découvre toutes les dépendances du projet
     */
    async discoverDependencies(projectPath) {
        const dependencies = [];
        
        try {
            // Analyser package.json (Node.js)
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (await this.fileExists(packageJsonPath)) {
                const nodeJsDeps = await this.analyzePackageJson(packageJsonPath);
                dependencies.push(...nodeJsDeps);
            }
            
            // Analyser package-lock.json pour les dépendances transitives
            const packageLockPath = path.join(projectPath, 'package-lock.json');
            if (await this.fileExists(packageLockPath)) {
                const transitiveDeps = await this.analyzePackageLock(packageLockPath);
                dependencies.push(...transitiveDeps);
            }
            
            // Analyser pnpm-lock.yaml
            const pnpmLockPath = path.join(projectPath, 'pnpm-lock.yaml');
            if (await this.fileExists(pnpmLockPath)) {
                const pnpmDeps = await this.analyzePnpmLock(pnpmLockPath);
                dependencies.push(...pnpmDeps);
            }
            
            // Analyser Dockerfile
            const dockerfilePath = path.join(projectPath, 'Dockerfile');
            if (await this.fileExists(dockerfilePath)) {
                const dockerDeps = await this.analyzeDockerfile(dockerfilePath);
                dependencies.push(...dockerDeps);
            }
            
            // Analyser les manifests Kubernetes
            const k8sManifests = await this.findK8sManifests(projectPath);
            for (const manifest of k8sManifests) {
                const k8sDeps = await this.analyzeK8sManifest(manifest);
                dependencies.push(...k8sDeps);
            }
            
            // Déduplication
            return this.deduplicateDependencies(dependencies);
            
        } catch (error) {
            this.logger.error(`Failed to discover dependencies:`, error);
            throw error;
        }
    }

    /**
     * Analyse les licences des dépendances
     */
    async analyzeLicenses(dependencies) {
        const licenseAnalysis = {
            analyzed: [],
            licenseGroups: {},
            unknownLicenses: [],
            problematicLicenses: []
        };
        
        for (const dep of dependencies) {
            try {
                let licenseInfo = null;
                
                // Vérifier la licence selon le type
                switch (dep.type) {
                    case 'npm':
                        licenseInfo = await this.freshSources.checkLicense('npm', dep.name);
                        break;
                    case 'docker':
                        licenseInfo = await this.freshSources.checkLicense('docker', dep.name);
                        break;
                    default:
                        licenseInfo = { license: 'Unknown', openSource: null };
                }
                
                const analyzedDep = {
                    ...dep,
                    license: licenseInfo.license,
                    openSource: licenseInfo.openSource,
                    licenseRisk: this.assessLicenseRisk(licenseInfo.license),
                    compatible: this.isLicenseCompatible(licenseInfo.license, dep.projectLicense || 'MIT')
                };
                
                licenseAnalysis.analyzed.push(analyzedDep);
                
                // Grouper par licence
                const license = licenseInfo.license || 'Unknown';
                if (!licenseAnalysis.licenseGroups[license]) {
                    licenseAnalysis.licenseGroups[license] = [];
                }
                licenseAnalysis.licenseGroups[license].push(analyzedDep);
                
                // Identifier les problèmes
                if (license === 'Unknown') {
                    licenseAnalysis.unknownLicenses.push(analyzedDep);
                }
                
                if (analyzedDep.licenseRisk === 'high' || !analyzedDep.compatible) {
                    licenseAnalysis.problematicLicenses.push(analyzedDep);
                }
                
            } catch (error) {
                this.logger.warn(`Failed to analyze license for ${dep.name}:`, error);
                licenseAnalysis.unknownLicenses.push(dep);
            }
        }
        
        return licenseAnalysis;
    }

    /**
     * Vérifie la compatibilité des licences
     */
    checkCompatibility(licenseAnalysis) {
        const compatibilityReport = {
            compatible: [],
            incompatible: [],
            warnings: [],
            conflicts: []
        };
        
        const licenses = Object.keys(licenseAnalysis.licenseGroups);
        
        // Vérifier les conflits entre licences
        for (let i = 0; i < licenses.length; i++) {
            for (let j = i + 1; j < licenses.length; j++) {
                const license1 = licenses[i];
                const license2 = licenses[j];
                
                if (!this.isLicenseCompatible(license1, license2)) {
                    compatibilityReport.conflicts.push({
                        license1,
                        license2,
                        reason: `${license1} and ${license2} are incompatible`,
                        affectedDependencies: [
                            ...licenseAnalysis.licenseGroups[license1],
                            ...licenseAnalysis.licenseGroups[license2]
                        ]
                    });
                }
            }
        }
        
        // Analyser chaque dépendance
        for (const dep of licenseAnalysis.analyzed) {
            if (dep.compatible) {
                compatibilityReport.compatible.push(dep);
            } else {
                compatibilityReport.incompatible.push(dep);
            }
            
            // Ajouter des avertissements pour les licences à risque
            if (dep.licenseRisk === 'medium' || dep.licenseRisk === 'high') {
                compatibilityReport.warnings.push({
                    dependency: dep,
                    warning: `${dep.license} license requires attention`,
                    recommendation: this.getLicenseRecommendation(dep.license)
                });
            }
        }
        
        return compatibilityReport;
    }

    /**
     * Évalue les risques liés aux licences
     */
    assessLicenseRisks(licenseAnalysis) {
        const riskAssessment = {
            riskLevel: 'low',
            risks: [],
            mitigations: []
        };
        
        // Analyser les risques par type de licence
        for (const [license, deps] of Object.entries(licenseAnalysis.licenseGroups)) {
            const licenseRisk = this.assessLicenseRisk(license);
            
            if (licenseRisk === 'high') {
                riskAssessment.risks.push({
                    type: 'license-risk',
                    severity: 'high',
                    license,
                    dependencies: deps,
                    description: `${license} license requires specific compliance measures`,
                    impact: this.getLicenseImpact(license)
                });
            }
        }
        
        // Analyser les licences inconnues
        if (licenseAnalysis.unknownLicenses.length > 0) {
            riskAssessment.risks.push({
                type: 'unknown-license',
                severity: 'medium',
                dependencies: licenseAnalysis.unknownLicenses,
                description: 'Dependencies with unknown licenses pose compliance risks',
                impact: 'Legal uncertainty and potential compliance issues'
            });
        }
        
        // Analyser les conflits
        if (licenseAnalysis.problematicLicenses.length > 0) {
            riskAssessment.risks.push({
                type: 'license-conflict',
                severity: 'high',
                dependencies: licenseAnalysis.problematicLicenses,
                description: 'Incompatible licenses detected',
                impact: 'Potential legal issues and distribution restrictions'
            });
        }
        
        // Calculer le niveau de risque global
        riskAssessment.riskLevel = this.calculateOverallRiskLevel(riskAssessment);
        
        // Générer les mitigations
        riskAssessment.mitigations = this.generateMitigations(riskAssessment.risks);
        
        return riskAssessment;
    }

    /**
     * Génère des recommandations
     */
    generateRecommendations(licenseAnalysis, compatibilityReport, riskAssessment) {
        const recommendations = [];
        
        // Recommandations pour les licences inconnues
        if (licenseAnalysis.unknownLicenses.length > 0) {
            recommendations.push({
                type: 'investigation',
                priority: 'high',
                title: 'Investigate unknown licenses',
                description: 'Manually verify licenses for dependencies with unknown licensing',
                dependencies: licenseAnalysis.unknownLicenses,
                action: 'Review source code and documentation for license information'
            });
        }
        
        // Recommandations pour les conflits
        if (compatibilityReport.conflicts.length > 0) {
            recommendations.push({
                type: 'conflict-resolution',
                priority: 'critical',
                title: 'Resolve license conflicts',
                description: 'Address incompatible license combinations',
                conflicts: compatibilityReport.conflicts,
                action: 'Replace conflicting dependencies or change project license'
            });
        }
        
        // Recommandations pour l'optimisation
        const optimizationRecs = this.generateOptimizationRecommendations(licenseAnalysis);
        recommendations.push(...optimizationRecs);
        
        return recommendations;
    }

    /**
     * Calcule le score de compliance
     */
    calculateComplianceScore(licenseAnalysis, riskAssessment) {
        let score = 100;
        
        // Pénalités pour les licences inconnues
        score -= licenseAnalysis.unknownLicenses.length * 10;
        
        // Pénalités pour les licences problématiques
        score -= licenseAnalysis.problematicLicenses.length * 15;
        
        // Pénalités pour les risques
        for (const risk of riskAssessment.risks) {
            switch (risk.severity) {
                case 'critical':
                    score -= 30;
                    break;
                case 'high':
                    score -= 20;
                    break;
                case 'medium':
                    score -= 10;
                    break;
                case 'low':
                    score -= 5;
                    break;
            }
        }
        
        return Math.max(score, 0);
    }

    /**
     * Calcule le niveau de risque global
     */
    calculateOverallRiskLevel(riskAssessment) {
        if (riskAssessment.risks.some(r => r.severity === 'critical')) {
            return 'critical';
        }
        if (riskAssessment.risks.some(r => r.severity === 'high')) {
            return 'high';
        }
        if (riskAssessment.risks.some(r => r.severity === 'medium')) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Vérifie la compatibilité entre deux licences
     */
    isLicenseCompatible(license1, license2) {
        if (!license1 || !license2) return false;
        
        const licenseInfo = this.licenseCompatibilityMatrix[license1];
        if (!licenseInfo) return false;
        
        return licenseInfo.compatible.includes(license2);
    }

    /**
     * Évalue le risque d'une licence
     */
    assessLicenseRisk(license) {
        if (!license) return 'high';
        
        const licenseInfo = this.licenseCompatibilityMatrix[license];
        return licenseInfo ? licenseInfo.risk : 'high';
    }

    /**
     * Obtient l'impact d'une licence
     */
    getLicenseImpact(license) {
        const impacts = {
            'GPL-2.0': 'Requires source code disclosure for derivative works',
            'GPL-3.0': 'Requires source code disclosure and patent protection',
            'AGPL-3.0': 'Requires source code disclosure for network use',
            'Proprietary': 'May have usage restrictions and fees'
        };
        
        return impacts[license] || 'Unknown impact';
    }

    /**
     * Obtient une recommandation pour une licence
     */
    getLicenseRecommendation(license) {
        const recommendations = {
            'GPL-2.0': 'Consider compatibility with project license',
            'GPL-3.0': 'Ensure compliance with copyleft requirements',
            'AGPL-3.0': 'Review network use implications',
            'Proprietary': 'Verify commercial use permissions'
        };
        
        return recommendations[license] || 'Review license terms carefully';
    }

    /**
     * Génère les mitigations pour les risques
     */
    generateMitigations(risks) {
        const mitigations = [];
        
        for (const risk of risks) {
            switch (risk.type) {
                case 'license-risk':
                    mitigations.push({
                        risk: risk.type,
                        action: 'Implement license compliance procedures',
                        steps: [
                            'Document license requirements',
                            'Set up compliance checks',
                            'Train development team'
                        ]
                    });
                    break;
                    
                case 'unknown-license':
                    mitigations.push({
                        risk: risk.type,
                        action: 'Investigate and document licenses',
                        steps: [
                            'Contact package maintainers',
                            'Review source code',
                            'Document findings'
                        ]
                    });
                    break;
                    
                case 'license-conflict':
                    mitigations.push({
                        risk: risk.type,
                        action: 'Resolve license conflicts',
                        steps: [
                            'Identify alternative packages',
                            'Update project license if needed',
                            'Remove conflicting dependencies'
                        ]
                    });
                    break;
            }
        }
        
        return mitigations;
    }

    /**
     * Génère des recommandations d'optimisation
     */
    generateOptimizationRecommendations(licenseAnalysis) {
        const recommendations = [];
        
        // Recommander des alternatives open source
        for (const [license, deps] of Object.entries(licenseAnalysis.licenseGroups)) {
            if (license === 'Proprietary' || this.assessLicenseRisk(license) === 'high') {
                recommendations.push({
                    type: 'optimization',
                    priority: 'medium',
                    title: `Consider open source alternatives for ${license} dependencies`,
                    description: `Replace ${license} dependencies with open source alternatives`,
                    dependencies: deps,
                    action: 'Research and evaluate open source alternatives'
                });
            }
        }
        
        return recommendations;
    }

    // Méthodes d'analyse des fichiers (simplifiées)
    async analyzePackageJson(packageJsonPath) {
        const content = await fs.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(content);
        const dependencies = [];
        
        for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
            dependencies.push({
                name,
                version,
                type: 'npm',
                scope: 'production',
                source: 'package.json'
            });
        }
        
        for (const [name, version] of Object.entries(packageJson.devDependencies || {})) {
            dependencies.push({
                name,
                version,
                type: 'npm',
                scope: 'development',
                source: 'package.json'
            });
        }
        
        return dependencies;
    }

    async analyzePackageLock(packageLockPath) {
        // Analyse simplifiée du package-lock.json
        const content = await fs.readFile(packageLockPath, 'utf8');
        const lockData = JSON.parse(content);
        const dependencies = [];
        
        if (lockData.dependencies) {
            for (const [name, info] of Object.entries(lockData.dependencies)) {
                dependencies.push({
                    name,
                    version: info.version,
                    type: 'npm',
                    scope: 'transitive',
                    source: 'package-lock.json'
                });
            }
        }
        
        return dependencies;
    }

    async analyzePnpmLock(pnpmLockPath) {
        // Analyse simplifiée du pnpm-lock.yaml
        // Note: En production, utiliser un parser YAML
        return [];
    }

    async analyzeDockerfile(dockerfilePath) {
        const content = await fs.readFile(dockerfilePath, 'utf8');
        const dependencies = [];
        
        // Extraire les images FROM
        const fromRegex = /FROM\s+([^\s]+)/g;
        let match;
        
        while ((match = fromRegex.exec(content)) !== null) {
            dependencies.push({
                name: match[1],
                type: 'docker',
                scope: 'runtime',
                source: 'Dockerfile'
            });
        }
        
        return dependencies;
    }

    async findK8sManifests(projectPath) {
        const manifests = [];
        
        try {
            const k8sDir = path.join(projectPath, 'k8s');
            if (await this.fileExists(k8sDir)) {
                const files = await fs.readdir(k8sDir);
                for (const file of files) {
                    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                        manifests.push(path.join(k8sDir, file));
                    }
                }
            }
        } catch (error) {
            this.logger.debug('No k8s manifests found:', error);
        }
        
        return manifests;
    }

    async analyzeK8sManifest(manifestPath) {
        const content = await fs.readFile(manifestPath, 'utf8');
        const dependencies = [];
        
        // Extraire les images des manifests
        const imageRegex = /image:\s*([^\s]+)/g;
        let match;
        
        while ((match = imageRegex.exec(content)) !== null) {
            dependencies.push({
                name: match[1],
                type: 'docker',
                scope: 'runtime',
                source: path.basename(manifestPath)
            });
        }
        
        return dependencies;
    }

    deduplicateDependencies(dependencies) {
        const seen = new Set();
        return dependencies.filter(dep => {
            const key = `${dep.type}:${dep.name}:${dep.version}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sauvegarde les résultats d'audit dans la mémoire
     */
    async saveLicenseAuditResults(report) {
        if (!this.memoryManager) return;
        
        try {
            const auditSummary = {
                projectPath: report.projectPath,
                complianceScore: report.summary.complianceScore,
                riskLevel: report.summary.riskLevel,
                totalDependencies: report.summary.totalDependencies,
                auditDate: report.auditDate,
                type: 'license-audit'
            };
            
            await this.memoryManager.contextualMemory.addMemory(
                `License compliance audit for ${report.projectPath}`,
                'system',
                auditSummary
            );
            
            this.logger.debug(`License audit results saved for ${report.projectPath}`);
        } catch (error) {
            this.logger.warn(`Failed to save license audit results:`, error);
        }
    }
}

module.exports = { LicenseComplianceAgent };