const { Logger } = require('../utils/logger');
const { RetryHelper } = require('../utils/retry');
const fetch = require('node-fetch');

/**
 * FreshSourcesService - Service pour découvrir les dernières versions
 * Intègre les APIs de Docker Hub, NPM, GitHub Container Registry, et Artifact Hub
 */
class FreshSourcesService {
    constructor(config = {}) {
        this.logger = new Logger('FreshSourcesService');
        this.config = {
            dockerHub: {
                baseUrl: 'https://hub.docker.com/v2',
                registryUrl: 'https://registry.hub.docker.com/v2'
            },
            npm: {
                baseUrl: 'https://registry.npmjs.org'
            },
            github: {
                baseUrl: 'https://api.github.com',
                token: config.githubToken || process.env.GITHUB_TOKEN
            },
            artifactHub: {
                baseUrl: 'https://artifacthub.io/api/v1'
            },
            ...config
        };
        
        // RetryHelper is used statically, no need to instantiate
    }

    /**
     * Trouve les dernières versions pour un ensemble de requirements
     */
    async findLatestVersions(requirements) {
        this.logger.info('Finding latest versions for requirements:', requirements);
        
        const results = {
            docker: {},
            npm: {},
            helm: {},
            github: {}
        };

        // Traiter en parallèle pour performance
        const promises = [];

        if (requirements.docker) {
            for (const image of requirements.docker) {
                promises.push(
                    this.getDockerLatestTags(image)
                        .then(tags => { results.docker[image] = tags; })
                        .catch(err => { 
                            this.logger.error(`Failed to get Docker tags for ${image}:`, err);
                            results.docker[image] = { error: err.message };
                        })
                );
            }
        }

        if (requirements.npm) {
            for (const pkg of requirements.npm) {
                promises.push(
                    this.getNpmLatestVersion(pkg)
                        .then(version => { results.npm[pkg] = version; })
                        .catch(err => {
                            this.logger.error(`Failed to get NPM version for ${pkg}:`, err);
                            results.npm[pkg] = { error: err.message };
                        })
                );
            }
        }

        if (requirements.helm) {
            for (const chart of requirements.helm) {
                promises.push(
                    this.getHelmChartVersions(chart)
                        .then(versions => { results.helm[chart] = versions; })
                        .catch(err => {
                            this.logger.error(`Failed to get Helm versions for ${chart}:`, err);
                            results.helm[chart] = { error: err.message };
                        })
                );
            }
        }

        if (requirements.github && this.config.github.token) {
            for (const pkg of requirements.github) {
                promises.push(
                    this.getGitHubPackageVersions(pkg)
                        .then(versions => { results.github[pkg] = versions; })
                        .catch(err => {
                            this.logger.error(`Failed to get GitHub versions for ${pkg}:`, err);
                            results.github[pkg] = { error: err.message };
                        })
                );
            }
        }

        await Promise.all(promises);
        
        this.logger.success('Found latest versions:', results);
        return results;
    }

    /**
     * Récupère les derniers tags Docker Hub
     */
    async getDockerLatestTags(imageName) {
        const [namespace, repo] = imageName.includes('/') 
            ? imageName.split('/')
            : ['library', imageName];

        const url = `${this.config.dockerHub.baseUrl}/repositories/${namespace}/${repo}/tags?page_size=10&ordering=-last_updated`;
        
        this.logger.debug(`Fetching Docker tags from: ${url}`);

        const response = await RetryHelper.withRetry(async () => {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Docker Hub API error: ${res.status} ${res.statusText}`);
            }
            return res.json();
        });

        const tags = response.results.map(tag => ({
            name: tag.name,
            size: tag.full_size,
            lastUpdated: tag.last_updated,
            digest: tag.digest
        }));

        return {
            latest: tags[0]?.name || 'latest',
            tags: tags.slice(0, 5), // Top 5 most recent
            totalCount: response.count
        };
    }

    /**
     * Récupère la dernière version NPM
     */
    async getNpmLatestVersion(packageName) {
        // D'abord essayer l'endpoint rapide dist-tags
        const distTagsUrl = `${this.config.npm.baseUrl}/-/package/${packageName}/dist-tags`;
        
        try {
            const response = await RetryHelper.withRetry(async () => {
                const res = await fetch(distTagsUrl);
                if (res.status === 404) {
                    throw new Error(`NPM package not found: ${packageName}`);
                }
                if (!res.ok) {
                    throw new Error(`NPM API error: ${res.status}`);
                }
                return res.json();
            });

            return {
                latest: response.latest,
                tags: response,
                registry: 'npmjs.org'
            };
        } catch (err) {
            // Fallback sur l'API complète
            this.logger.debug(`dist-tags failed, trying full API for ${packageName}`);
            
            const fullUrl = `${this.config.npm.baseUrl}/${packageName}`;
            const response = await RetryHelper.withRetry(async () => {
                const res = await fetch(fullUrl);
                if (!res.ok) {
                    throw new Error(`NPM API error: ${res.status}`);
                }
                return res.json();
            });

            return {
                latest: response['dist-tags']?.latest,
                versions: Object.keys(response.versions || {}).slice(-5).reverse(),
                description: response.description,
                homepage: response.homepage
            };
        }
    }

    /**
     * Récupère les versions d'un chart Helm via Artifact Hub
     */
    async getHelmChartVersions(chartName) {
        const searchUrl = `${this.config.artifactHub.baseUrl}/packages/search?kind=0&ts_query=${chartName}&limit=5`;
        
        this.logger.debug(`Searching Helm charts: ${searchUrl}`);

        const searchResponse = await RetryHelper.withRetry(async () => {
            const res = await fetch(searchUrl);
            if (!res.ok) {
                throw new Error(`Artifact Hub API error: ${res.status}`);
            }
            return res.json();
        });

        if (!searchResponse.packages || searchResponse.packages.length === 0) {
            throw new Error(`No Helm chart found for: ${chartName}`);
        }

        // Prendre le premier résultat le plus pertinent
        const chart = searchResponse.packages[0];
        
        return {
            name: chart.name,
            repository: chart.repository.name,
            latestVersion: chart.version,
            availableVersions: chart.available_versions?.slice(0, 5),
            appVersion: chart.app_version,
            description: chart.description
        };
    }

    /**
     * Récupère les versions GitHub Container Registry
     */
    async getGitHubPackageVersions(packageName) {
        if (!this.config.github.token) {
            throw new Error('GitHub token required for GHCR access');
        }

        const url = `${this.config.github.baseUrl}/user/packages/container/${packageName}/versions`;
        
        this.logger.debug(`Fetching GitHub package versions: ${url}`);

        const response = await RetryHelper.withRetry(async () => {
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.config.github.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (res.status === 401) {
                throw new Error('GitHub authentication failed - check token');
            }
            if (res.status === 404) {
                throw new Error(`GitHub package not found: ${packageName}`);
            }
            if (!res.ok) {
                throw new Error(`GitHub API error: ${res.status}`);
            }
            return res.json();
        });

        const versions = response.map(v => ({
            id: v.id,
            name: v.name || v.metadata?.container?.tags?.[0] || 'untagged',
            created: v.created_at,
            updated: v.updated_at,
            tags: v.metadata?.container?.tags || []
        }));

        return {
            latest: versions[0],
            versions: versions.slice(0, 5),
            totalCount: response.length
        };
    }

    /**
     * Recherche intelligente multi-registres
     */
    async searchPackage(query, options = {}) {
        this.logger.info(`Searching for package: ${query}`);
        
        const results = {
            docker: [],
            npm: [],
            helm: [],
            suggestions: []
        };

        // Recherche parallèle dans tous les registres
        const promises = [];

        // Docker Hub search
        if (options.includeDocker !== false) {
            promises.push(
                this.searchDockerHub(query)
                    .then(res => { results.docker = res; })
                    .catch(err => this.logger.warn('Docker search failed:', err))
            );
        }

        // NPM search
        if (options.includeNpm !== false) {
            promises.push(
                this.searchNpm(query)
                    .then(res => { results.npm = res; })
                    .catch(err => this.logger.warn('NPM search failed:', err))
            );
        }

        // Helm search
        if (options.includeHelm !== false) {
            promises.push(
                this.searchHelm(query)
                    .then(res => { results.helm = res; })
                    .catch(err => this.logger.warn('Helm search failed:', err))
            );
        }

        await Promise.all(promises);

        // Générer des suggestions basées sur les résultats
        results.suggestions = this.generateSuggestions(results, query);

        return results;
    }

    /**
     * Recherche Docker Hub
     */
    async searchDockerHub(query) {
        const url = `${this.config.dockerHub.baseUrl}/search/repositories/?query=${encodeURIComponent(query)}&page_size=5`;
        
        const response = await fetch(url);
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.results?.map(r => ({
            name: r.name,
            namespace: r.namespace,
            description: r.description,
            stars: r.star_count,
            official: r.is_official
        })) || [];
    }

    /**
     * Recherche NPM
     */
    async searchNpm(query) {
        const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`;
        
        const response = await fetch(url);
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.objects?.map(o => ({
            name: o.package.name,
            version: o.package.version,
            description: o.package.description,
            keywords: o.package.keywords
        })) || [];
    }

    /**
     * Recherche Helm
     */
    async searchHelm(query) {
        const url = `${this.config.artifactHub.baseUrl}/packages/search?kind=0&ts_query=${encodeURIComponent(query)}&limit=5`;
        
        const response = await fetch(url);
        if (!response.ok) return [];
        
        const data = await response.json();
        return data.packages?.map(p => ({
            name: p.name,
            version: p.version,
            repository: p.repository.name,
            description: p.description
        })) || [];
    }

    /**
     * Génère des suggestions intelligentes
     */
    generateSuggestions(results, query) {
        const suggestions = [];

        // Si on trouve des résultats officiels Docker, les prioriser
        const officialDocker = results.docker.find(d => d.official);
        if (officialDocker) {
            suggestions.push({
                type: 'docker',
                name: officialDocker.name,
                reason: 'Official Docker image'
            });
        }

        // Packages NPM populaires
        if (results.npm.length > 0) {
            suggestions.push({
                type: 'npm',
                name: results.npm[0].name,
                reason: 'Most relevant NPM package'
            });
        }

        // Charts Helm maintenus
        if (results.helm.length > 0) {
            suggestions.push({
                type: 'helm',
                name: results.helm[0].name,
                reason: 'Recommended Helm chart'
            });
        }

        return suggestions;
    }

    /**
     * Vérifie si une version est obsolète
     */
    async checkIfOutdated(type, name, currentVersion) {
        try {
            let latestVersion;
            
            switch (type) {
                case 'docker':
                    const dockerInfo = await this.getDockerLatestTags(name);
                    latestVersion = dockerInfo.latest;
                    break;
                    
                case 'npm':
                    const npmInfo = await this.getNpmLatestVersion(name);
                    latestVersion = npmInfo.latest;
                    break;
                    
                case 'helm':
                    const helmInfo = await this.getHelmChartVersions(name);
                    latestVersion = helmInfo.latestVersion;
                    break;
                    
                default:
                    throw new Error(`Unknown package type: ${type}`);
            }

            return {
                current: currentVersion,
                latest: latestVersion,
                isOutdated: currentVersion !== latestVersion,
                type,
                name
            };
        } catch (error) {
            this.logger.error(`Failed to check version for ${type}:${name}:`, error);
            return {
                current: currentVersion,
                error: error.message,
                type,
                name
            };
        }
    }
}

module.exports = { FreshSourcesService };