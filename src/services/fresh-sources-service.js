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
            // Nouvelles APIs open source 2025
            openVSX: {
                baseUrl: 'https://open-vsx.org/api'
            },
            cncfLandscape: {
                baseUrl: 'https://landscape.cncf.io/api/v1'
            },
            helmHub: {
                baseUrl: 'https://hub.helm.sh/api/chartsvc/v1'
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

    /**
     * Recherche dans OpenVSX pour plugins open source
     */
    async searchOpenVSX(query) {
        const url = `${this.config.openVSX.baseUrl}/-/search?query=${encodeURIComponent(query)}&size=5`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.extensions?.map(ext => ({
                name: ext.name,
                namespace: ext.namespace,
                version: ext.version,
                displayName: ext.displayName,
                description: ext.description,
                license: ext.license,
                openSource: true,
                registry: 'openvsx'
            })) || [];
        } catch (error) {
            this.logger.warn('OpenVSX search failed:', error);
            return [];
        }
    }

    /**
     * Recherche dans CNCF Landscape pour projets cloud native
     */
    async searchCNCFLandscape(query) {
        // Note: CNCF Landscape n'a pas d'API publique, on utilise une approximation
        const cncfProjects = [
            'kubernetes', 'prometheus', 'grafana', 'jaeger', 'envoy', 'containerd',
            'rook', 'vitess', 'tikv', 'cortex', 'dragonfly', 'harbor', 'notary',
            'thanos', 'opentracing', 'falco', 'opa', 'spiffe', 'spire', 'nats',
            'linkerd', 'fluentd', 'helm', 'operator-framework', 'buildpacks',
            'tekton', 'knative', 'crossplane', 'argo', 'flux', 'keptn'
        ];

        const matchingProjects = cncfProjects.filter(project => 
            project.toLowerCase().includes(query.toLowerCase())
        );

        return matchingProjects.map(project => ({
            name: project,
            type: 'cncf-project',
            cncf: true,
            openSource: true,
            description: `CNCF ${project} project`,
            license: ['Apache-2.0'] // La plupart des projets CNCF utilisent Apache 2.0
        }));
    }

    /**
     * Filtre les résultats pour ne garder que l'open source
     */
    filterOpenSourceOnly(results) {
        const openSourceLicenses = [
            'MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'GPL-2.0',
            'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-2.0',
            'ISC', 'Unlicense', 'AGPL-3.0'
        ];

        const filterResults = (items) => {
            return items.filter(item => {
                // Si marqué explicitement comme open source
                if (item.openSource === true) return true;
                
                // Si a une licence open source
                if (item.license) {
                    const licenses = Array.isArray(item.license) ? item.license : [item.license];
                    return licenses.some(license => 
                        openSourceLicenses.includes(license)
                    );
                }
                
                // Si c'est un projet CNCF
                if (item.cncf === true) return true;
                
                // Patterns connus pour les projets open source
                const openSourcePatterns = [
                    /^(prometheus|grafana|jaeger|loki)/i,
                    /^(hashicorp|vault|consul|nomad)/i,
                    /^(aquasecurity|trivy)/i,
                    /^(argoproj|argo)/i,
                    /^(tektoncd|tekton)/i,
                    /^(goharbor|harbor)/i,
                    /^(minio)/i,
                    /^(eclipse|openvsx)/i
                ];
                
                return openSourcePatterns.some(pattern => 
                    pattern.test(item.name || '')
                );
            });
        };

        return {
            docker: filterResults(results.docker || []),
            npm: filterResults(results.npm || []),
            helm: filterResults(results.helm || []),
            github: filterResults(results.github || []),
            openvsx: filterResults(results.openvsx || []),
            cncf: filterResults(results.cncf || [])
        };
    }

    /**
     * Recherche multi-registres avec priorité open source
     */
    async searchOpenSourcePackages(query, options = {}) {
        this.logger.info(`Searching for open source packages: ${query}`);
        
        const results = {
            docker: [],
            npm: [],
            helm: [],
            github: [],
            openvsx: [],
            cncf: [],
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

        // OpenVSX search
        if (options.includeOpenVSX !== false) {
            promises.push(
                this.searchOpenVSX(query)
                    .then(res => { results.openvsx = res; })
                    .catch(err => this.logger.warn('OpenVSX search failed:', err))
            );
        }

        // CNCF Landscape search
        if (options.includeCNCF !== false) {
            promises.push(
                this.searchCNCFLandscape(query)
                    .then(res => { results.cncf = res; })
                    .catch(err => this.logger.warn('CNCF search failed:', err))
            );
        }

        await Promise.all(promises);

        // Filtrer pour ne garder que l'open source
        const openSourceResults = this.filterOpenSourceOnly(results);

        // Générer des suggestions avec priorité open source
        openSourceResults.suggestions = this.generateOpenSourceSuggestions(openSourceResults, query);

        return openSourceResults;
    }

    /**
     * Génère des suggestions priorisées pour l'open source
     */
    generateOpenSourceSuggestions(results, query) {
        const suggestions = [];

        // Prioriser les projets CNCF
        if (results.cncf && results.cncf.length > 0) {
            suggestions.push({
                type: 'cncf',
                name: results.cncf[0].name,
                reason: 'CNCF project - Cloud Native Foundation approved',
                priority: 'high',
                openSource: true,
                cncf: true
            });
        }

        // Projets officiels Docker avec licences open source
        const officialDocker = results.docker?.find(d => d.official && d.openSource);
        if (officialDocker) {
            suggestions.push({
                type: 'docker',
                name: officialDocker.name,
                reason: 'Official Docker image with open source license',
                priority: 'high',
                openSource: true
            });
        }

        // Packages NPM avec licences permissives
        const permissiveNpm = results.npm?.find(n => 
            n.license && ['MIT', 'Apache-2.0', 'BSD-3-Clause'].includes(n.license)
        );
        if (permissiveNpm) {
            suggestions.push({
                type: 'npm',
                name: permissiveNpm.name,
                reason: 'Permissive open source license',
                priority: 'medium',
                openSource: true
            });
        }

        // Charts Helm open source
        if (results.helm && results.helm.length > 0) {
            suggestions.push({
                type: 'helm',
                name: results.helm[0].name,
                reason: 'Open source Helm chart',
                priority: 'medium',
                openSource: true
            });
        }

        // Extensions OpenVSX
        if (results.openvsx && results.openvsx.length > 0) {
            suggestions.push({
                type: 'openvsx',
                name: results.openvsx[0].name,
                reason: 'Open source extension marketplace',
                priority: 'low',
                openSource: true
            });
        }

        // Trier par priorité
        return suggestions.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Vérifie la licence d'un package
     */
    async checkLicense(type, name) {
        try {
            let licenseInfo = { license: 'Unknown', openSource: false };

            switch (type) {
                case 'npm':
                    const npmInfo = await this.getNpmLatestVersion(name);
                    if (npmInfo.license) {
                        licenseInfo = {
                            license: npmInfo.license,
                            openSource: this.isOpenSourceLicense(npmInfo.license)
                        };
                    }
                    break;

                case 'docker':
                    // Docker Hub ne fournit pas toujours les infos de licence
                    // On peut essayer de déduire depuis les labels
                    licenseInfo = { license: 'Check image labels', openSource: null };
                    break;

                default:
                    break;
            }

            return licenseInfo;
        } catch (error) {
            this.logger.error(`Failed to check license for ${type}:${name}:`, error);
            return { license: 'Unknown', openSource: false, error: error.message };
        }
    }

    /**
     * Vérifie si une licence est open source
     */
    isOpenSourceLicense(license) {
        const openSourceLicenses = [
            'MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'GPL-2.0',
            'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-2.0',
            'ISC', 'Unlicense', 'AGPL-3.0'
        ];

        if (Array.isArray(license)) {
            return license.some(l => openSourceLicenses.includes(l));
        }

        return openSourceLicenses.includes(license);
    }
}

module.exports = { FreshSourcesService };