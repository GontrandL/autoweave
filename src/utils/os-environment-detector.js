/**
 * OS Environment Detector - Détection complète de l'environnement système
 * =====================================================================
 * Détecte et documente toutes les spécificités de l'OS pour Claude Code
 */

const { Logger } = require('./logger');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class OSEnvironmentDetector {
    constructor() {
        this.logger = new Logger('OSEnvironmentDetector');
        this.environment = {
            basic: {},
            permissions: {},
            capabilities: {},
            restrictions: {},
            packages: {},
            network: {},
            storage: {},
            security: {},
            development: {}
        };
    }
    
    async detectComplete() {
        this.logger.info('🔍 Detecting complete OS environment...');
        
        try {
            // 1. Informations de base du système
            await this.detectBasicInfo();
            
            // 2. Système de permissions et utilisateurs
            await this.detectPermissions();
            
            // 3. Capacités système disponibles
            await this.detectCapabilities();
            
            // 4. Restrictions et limitations
            await this.detectRestrictions();
            
            // 5. Packages et outils installés
            await this.detectInstalledPackages();
            
            // 6. Configuration réseau
            await this.detectNetworkConfig();
            
            // 7. Configuration stockage
            await this.detectStorageConfig();
            
            // 8. Configuration sécurité
            await this.detectSecurityConfig();
            
            // 9. Environnement de développement
            await this.detectDevelopmentEnvironment();
            
            this.logger.success('✅ Complete OS environment detected');
            return this.environment;
            
        } catch (error) {
            this.logger.error('Failed to detect OS environment:', error);
            throw error;
        }
    }
    
    async detectBasicInfo() {
        this.environment.basic = {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            version: os.version(),
            hostname: os.hostname(),
            uptime: os.uptime(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpus: os.cpus(),
            networkInterfaces: os.networkInterfaces(),
            userInfo: os.userInfo(),
            homedir: os.homedir(),
            tmpdir: os.tmpdir()
        };
        
        // Distribution Linux spécifique
        if (os.platform() === 'linux') {
            try {
                const osRelease = await this.execCommand('cat /etc/os-release');
                this.environment.basic.distribution = this.parseOSRelease(osRelease.stdout);
                
                const kernelVersion = await this.execCommand('uname -r');
                this.environment.basic.kernelVersion = kernelVersion.stdout.trim();
                
            } catch (error) {
                this.logger.warn('Could not detect Linux distribution details');
            }
        }
    }
    
    async detectPermissions() {
        const currentUser = os.userInfo();
        
        this.environment.permissions = {
            currentUser: currentUser.username,
            uid: currentUser.uid,
            gid: currentUser.gid,
            homeDir: currentUser.homedir,
            shell: currentUser.shell,
            isRoot: currentUser.uid === 0,
            canSudo: false,
            canSu: false,
            groups: []
        };
        
        try {
            // Vérifier si l'utilisateur peut utiliser sudo
            const sudoCheck = await this.execCommand('sudo -n true', { timeout: 2000 });
            this.environment.permissions.canSudo = sudoCheck.code === 0;
        } catch (error) {
            // sudo nécessite un mot de passe ou n'est pas disponible
            this.environment.permissions.canSudo = false;
            this.environment.permissions.sudoRequiresPassword = true;
        }
        
        try {
            // Vérifier les groupes de l'utilisateur
            const groups = await this.execCommand('groups');
            this.environment.permissions.groups = groups.stdout.trim().split(' ');
            
            // Vérifier si l'utilisateur est dans le groupe sudo/wheel
            const isSudoer = this.environment.permissions.groups.some(group => 
                ['sudo', 'wheel', 'admin'].includes(group)
            );
            this.environment.permissions.isSudoer = isSudoer;
            
        } catch (error) {
            this.logger.warn('Could not detect user groups');
        }
        
        try {
            // Vérifier si su est disponible
            const suCheck = await this.execCommand('which su');
            this.environment.permissions.canSu = suCheck.code === 0;
            
            if (this.environment.permissions.canSu) {
                this.environment.permissions.suPath = suCheck.stdout.trim();
                this.environment.permissions.adminNote = 
                    "User can access root with 'su' + password (not sudoer)";
            }
            
        } catch (error) {
            this.environment.permissions.canSu = false;
        }
    }
    
    async detectCapabilities() {
        this.environment.capabilities = {
            packageManagers: [],
            containerization: [],
            virtualization: [],
            development: [],
            databases: [],
            webServers: [],
            monitoring: []
        };
        
        // Package managers
        const packageManagers = [
            { name: 'apt', command: 'apt --version' },
            { name: 'yum', command: 'yum --version' },
            { name: 'dnf', command: 'dnf --version' },
            { name: 'pacman', command: 'pacman --version' },
            { name: 'zypper', command: 'zypper --version' },
            { name: 'brew', command: 'brew --version' },
            { name: 'snap', command: 'snap --version' },
            { name: 'flatpak', command: 'flatpak --version' }
        ];
        
        for (const pm of packageManagers) {
            try {
                const result = await this.execCommand(pm.command);
                if (result.code === 0) {
                    this.environment.capabilities.packageManagers.push({
                        name: pm.name,
                        version: result.stdout.split('\n')[0],
                        available: true
                    });
                }
            } catch (error) {
                // Package manager non disponible
            }
        }
        
        // Containerisation
        const containerTools = [
            { name: 'docker', command: 'docker --version' },
            { name: 'podman', command: 'podman --version' },
            { name: 'kubectl', command: 'kubectl version --client' },
            { name: 'helm', command: 'helm version' },
            { name: 'kind', command: 'kind version' },
            { name: 'minikube', command: 'minikube version' }
        ];
        
        for (const tool of containerTools) {
            try {
                const result = await this.execCommand(tool.command);
                if (result.code === 0) {
                    this.environment.capabilities.containerization.push({
                        name: tool.name,
                        version: result.stdout.split('\n')[0],
                        available: true
                    });
                }
            } catch (error) {
                // Outil non disponible
            }
        }
        
        // Outils de développement
        const devTools = [
            { name: 'node', command: 'node --version' },
            { name: 'npm', command: 'npm --version' },
            { name: 'python3', command: 'python3 --version' },
            { name: 'pip3', command: 'pip3 --version' },
            { name: 'git', command: 'git --version' },
            { name: 'curl', command: 'curl --version' },
            { name: 'wget', command: 'wget --version' },
            { name: 'jq', command: 'jq --version' },
            { name: 'rg', command: 'rg --version' }
        ];
        
        for (const tool of devTools) {
            try {
                const result = await this.execCommand(tool.command);
                if (result.code === 0) {
                    this.environment.capabilities.development.push({
                        name: tool.name,
                        version: result.stdout.split('\n')[0],
                        available: true,
                        path: await this.getCommandPath(tool.name)
                    });
                }
            } catch (error) {
                // Outil non disponible
            }
        }
    }
    
    async detectRestrictions() {
        this.environment.restrictions = {
            filesystem: {},
            network: {},
            processes: {},
            resources: {}
        };
        
        try {
            // Vérifier les restrictions de filesystem
            const fsRestrictions = await this.checkFilesystemRestrictions();
            this.environment.restrictions.filesystem = fsRestrictions;
            
            // Vérifier les restrictions réseau
            const networkRestrictions = await this.checkNetworkRestrictions();
            this.environment.restrictions.network = networkRestrictions;
            
            // Vérifier les limites de processus
            const processLimits = await this.checkProcessLimits();
            this.environment.restrictions.processes = processLimits;
            
        } catch (error) {
            this.logger.warn('Could not fully detect system restrictions');
        }
    }
    
    async checkFilesystemRestrictions() {
        const restrictions = {
            readOnlyLocations: [],
            noExecuteLocations: [],
            permissionDenied: [],
            writeableLocations: []
        };
        
        // Tester des emplacements communs
        const testLocations = [
            '/etc',
            '/usr/bin',
            '/var/log',
            '/tmp',
            '/home/' + os.userInfo().username,
            '/opt',
            '/usr/local/bin'
        ];
        
        for (const location of testLocations) {
            try {
                await fs.access(location, fs.constants.R_OK);
                
                try {
                    await fs.access(location, fs.constants.W_OK);
                    restrictions.writeableLocations.push(location);
                } catch (error) {
                    restrictions.readOnlyLocations.push(location);
                }
                
            } catch (error) {
                restrictions.permissionDenied.push(location);
            }
        }
        
        return restrictions;
    }
    
    async checkNetworkRestrictions() {
        const restrictions = {
            canBindPorts: [],
            blockedPorts: [],
            firewallActive: false,
            proxySettings: {}
        };
        
        // Tester des ports communs
        const testPorts = [80, 443, 3000, 8080, 8081, 8083, 6333, 7687];
        
        for (const port of testPorts) {
            try {
                const netstat = await this.execCommand(`netstat -ln | grep :${port}`);
                if (netstat.stdout.includes(`:${port}`)) {
                    restrictions.canBindPorts.push(port);
                }
            } catch (error) {
                // Port non accessible ou netstat non disponible
            }
        }
        
        // Vérifier le pare-feu
        try {
            const firewallCheck = await this.execCommand('systemctl is-active firewalld');
            restrictions.firewallActive = firewallCheck.stdout.trim() === 'active';
        } catch (error) {
            try {
                const ufwCheck = await this.execCommand('ufw status');
                restrictions.firewallActive = ufwCheck.stdout.includes('Status: active');
            } catch (error) {
                // Pas de pare-feu détecté
            }
        }
        
        return restrictions;
    }
    
    async checkProcessLimits() {
        const limits = {};
        
        try {
            const ulimit = await this.execCommand('ulimit -a');
            const lines = ulimit.stdout.split('\n');
            
            for (const line of lines) {
                if (line.includes('open files')) {
                    limits.maxOpenFiles = line.match(/\d+/)?.[0];
                }
                if (line.includes('max user processes')) {
                    limits.maxProcesses = line.match(/\d+/)?.[0];
                }
                if (line.includes('virtual memory')) {
                    limits.maxMemory = line.match(/\d+/)?.[0];
                }
            }
        } catch (error) {
            this.logger.warn('Could not detect process limits');
        }
        
        return limits;
    }
    
    async detectInstalledPackages() {
        this.environment.packages = {
            system: [],
            languages: {},
            databases: [],
            webServers: []
        };
        
        // Packages système selon le gestionnaire disponible
        const packageManager = this.environment.capabilities.packageManagers[0];
        if (packageManager) {
            try {
                let command = '';
                switch (packageManager.name) {
                    case 'apt':
                        command = 'dpkg -l | wc -l';
                        break;
                    case 'yum':
                    case 'dnf':
                        command = 'rpm -qa | wc -l';
                        break;
                    case 'pacman':
                        command = 'pacman -Q | wc -l';
                        break;
                }
                
                if (command) {
                    const result = await this.execCommand(command);
                    this.environment.packages.systemPackageCount = parseInt(result.stdout.trim());
                }
            } catch (error) {
                this.logger.warn('Could not count system packages');
            }
        }
        
        // Packages Node.js
        try {
            const npmList = await this.execCommand('npm list -g --depth=0');
            this.environment.packages.languages.nodejs = {
                globalPackages: npmList.stdout.split('\n').length - 3
            };
        } catch (error) {
            // npm non disponible
        }
        
        // Packages Python
        try {
            const pipList = await this.execCommand('pip3 list --format=freeze');
            this.environment.packages.languages.python = {
                packages: pipList.stdout.split('\n').length - 1
            };
        } catch (error) {
            // pip non disponible
        }
    }
    
    async detectNetworkConfig() {
        this.environment.network = {
            interfaces: os.networkInterfaces(),
            dns: [],
            routes: [],
            ports: {
                listening: [],
                blocked: []
            }
        };
        
        try {
            // DNS configuration
            const resolvConf = await fs.readFile('/etc/resolv.conf', 'utf-8');
            this.environment.network.dns = resolvConf
                .split('\n')
                .filter(line => line.startsWith('nameserver'))
                .map(line => line.split(' ')[1]);
        } catch (error) {
            // Impossible de lire la config DNS
        }
        
        try {
            // Ports en écoute
            const netstat = await this.execCommand('netstat -tlnp');
            this.environment.network.ports.listening = netstat.stdout
                .split('\n')
                .filter(line => line.includes('LISTEN'))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        port: parts[3]?.split(':').pop(),
                        protocol: parts[0],
                        process: parts[6]
                    };
                });
        } catch (error) {
            // netstat non disponible
        }
    }
    
    async detectStorageConfig() {
        this.environment.storage = {
            filesystems: [],
            diskUsage: {},
            inodes: {}
        };
        
        try {
            const df = await this.execCommand('df -h');
            this.environment.storage.filesystems = df.stdout
                .split('\n')
                .slice(1)
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        filesystem: parts[0],
                        size: parts[1],
                        used: parts[2],
                        available: parts[3],
                        usePercent: parts[4],
                        mountPoint: parts[5]
                    };
                });
        } catch (error) {
            // df non disponible
        }
        
        try {
            const dfInodes = await this.execCommand('df -i');
            // Similaire pour les inodes
        } catch (error) {
            // df -i non disponible
        }
    }
    
    async detectSecurityConfig() {
        this.environment.security = {
            selinux: { enabled: false },
            apparmor: { enabled: false },
            capabilities: [],
            cgroups: { enabled: false }
        };
        
        try {
            const selinuxStatus = await this.execCommand('getenforce');
            this.environment.security.selinux = {
                enabled: selinuxStatus.stdout.trim() !== 'Disabled',
                status: selinuxStatus.stdout.trim()
            };
        } catch (error) {
            // SELinux non présent
        }
        
        try {
            const apparmorStatus = await this.execCommand('aa-status');
            this.environment.security.apparmor = {
                enabled: apparmorStatus.code === 0,
                profiles: apparmorStatus.stdout.split('\n').length
            };
        } catch (error) {
            // AppArmor non présent
        }
    }
    
    async detectDevelopmentEnvironment() {
        this.environment.development = {
            editors: [],
            shells: [],
            terminalMultiplexers: [],
            versionControl: [],
            environmentManagers: []
        };
        
        const devTools = [
            // Éditeurs
            { category: 'editors', name: 'vim', command: 'vim --version' },
            { category: 'editors', name: 'nano', command: 'nano --version' },
            { category: 'editors', name: 'emacs', command: 'emacs --version' },
            { category: 'editors', name: 'code', command: 'code --version' },
            
            // Shells
            { category: 'shells', name: 'bash', command: 'bash --version' },
            { category: 'shells', name: 'zsh', command: 'zsh --version' },
            { category: 'shells', name: 'fish', command: 'fish --version' },
            
            // Terminal multiplexers
            { category: 'terminalMultiplexers', name: 'tmux', command: 'tmux -V' },
            { category: 'terminalMultiplexers', name: 'screen', command: 'screen --version' },
            
            // Version control
            { category: 'versionControl', name: 'git', command: 'git --version' },
            { category: 'versionControl', name: 'svn', command: 'svn --version' },
            
            // Environment managers
            { category: 'environmentManagers', name: 'nvm', command: 'nvm --version' },
            { category: 'environmentManagers', name: 'pyenv', command: 'pyenv --version' },
            { category: 'environmentManagers', name: 'rbenv', command: 'rbenv --version' }
        ];
        
        for (const tool of devTools) {
            try {
                const result = await this.execCommand(tool.command);
                if (result.code === 0) {
                    this.environment.development[tool.category].push({
                        name: tool.name,
                        version: result.stdout.split('\n')[0],
                        available: true
                    });
                }
            } catch (error) {
                // Outil non disponible
            }
        }
    }
    
    async getCommandPath(command) {
        try {
            const result = await this.execCommand(`which ${command}`);
            return result.stdout.trim();
        } catch (error) {
            return null;
        }
    }
    
    parseOSRelease(content) {
        const info = {};
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                info[key] = value.replace(/"/g, '');
            }
        });
        return info;
    }
    
    async execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 10000;
            const process = spawn('bash', ['-c', command]);
            
            let stdout = '';
            let stderr = '';
            
            const timer = setTimeout(() => {
                process.kill();
                reject(new Error(`Command timeout: ${command}`));
            }, timeout);
            
            process.stdout.on('data', (data) => stdout += data.toString());
            process.stderr.on('data', (data) => stderr += data.toString());
            
            process.on('close', (code) => {
                clearTimeout(timer);
                resolve({ code, stdout, stderr });
            });
            
            process.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    
    generateClaudeCodeEnvironmentDoc() {
        const doc = `# 🖥️ ENVIRONNEMENT SYSTÈME - CONFIGURATION CLAUDE CODE

## ℹ️ Informations Système de Base

**Système d'exploitation**: ${this.environment.basic.platform} ${this.environment.basic.arch}
**Version**: ${this.environment.basic.release}
**Distribution**: ${this.environment.basic.distribution?.PRETTY_NAME || 'N/A'}
**Hostname**: ${this.environment.basic.hostname}
**Utilisateur actuel**: ${this.environment.permissions.currentUser}

## 🔐 Configuration des Permissions

### Utilisateur Actuel
- **Nom**: ${this.environment.permissions.currentUser}
- **UID**: ${this.environment.permissions.uid}
- **Home**: ${this.environment.permissions.homeDir}
- **Shell**: ${this.environment.permissions.shell}
- **Groupes**: ${this.environment.permissions.groups?.join(', ') || 'N/A'}

### Capacités Administratives
- **Est root**: ${this.environment.permissions.isRoot ? '✅ OUI' : '❌ NON'}
- **Peut utiliser sudo**: ${this.environment.permissions.canSudo ? '✅ OUI' : '❌ NON'}
- **Est sudoer**: ${this.environment.permissions.isSudoer ? '✅ OUI' : '❌ NON'}
- **Peut utiliser su**: ${this.environment.permissions.canSu ? '✅ OUI' : '❌ NON'}

${this.environment.permissions.adminNote ? `**⚠️ NOTE IMPORTANTE**: ${this.environment.permissions.adminNote}` : ''}

### 🛡️ RESTRICTIONS IMPORTANTES POUR CLAUDE CODE

#### Accès Administrateur
${!this.environment.permissions.isRoot && !this.environment.permissions.canSudo ? 
`⚠️ **ATTENTION**: L'utilisateur '${this.environment.permissions.currentUser}' N'EST PAS sudoer
- Pour les tâches administratives, utiliser: \`su -\` puis mot de passe root
- NE PAS utiliser \`sudo\` sans vérifier d'abord
- Toujours proposer les alternatives non-root en premier` : 
'✅ Utilisateur a accès administrateur'}

#### Système de Fichiers
**Emplacements en écriture**:
${this.environment.restrictions.filesystem?.writeableLocations?.map(loc => `- ${loc}`).join('\n') || '- Information non disponible'}

**Emplacements en lecture seule**:
${this.environment.restrictions.filesystem?.readOnlyLocations?.map(loc => `- ${loc}`).join('\n') || '- Information non disponible'}

## 🔧 Outils et Capacités Disponibles

### Gestionnaires de Packages
${this.environment.capabilities.packageManagers?.map(pm => `- **${pm.name}**: ${pm.version}`).join('\n') || '- Aucun détecté'}

### Outils de Développement
${this.environment.capabilities.development?.map(tool => `- **${tool.name}**: ${tool.version} (${tool.path})`).join('\n') || '- Aucun détecté'}

### Containerisation
${this.environment.capabilities.containerization?.map(tool => `- **${tool.name}**: ${tool.version}`).join('\n') || '- Aucun détecté'}

## 🌐 Configuration Réseau

### Interfaces Réseau
${Object.keys(this.environment.network?.interfaces || {}).map(iface => 
    `- **${iface}**: ${this.environment.network.interfaces[iface].map(addr => addr.address).join(', ')}`
).join('\n')}

### Ports en Écoute
${this.environment.network?.ports?.listening?.slice(0, 10).map(port => 
    `- Port ${port.port} (${port.protocol}) - ${port.process || 'Processus inconnu'}`
).join('\n') || '- Information non disponible'}

### DNS
${this.environment.network?.dns?.map(dns => `- ${dns}`).join('\n') || '- Information non disponible'}

## 💾 Configuration Stockage

### Systèmes de Fichiers
${this.environment.storage?.filesystems?.map(fs => 
    `- **${fs.filesystem}** (${fs.mountPoint}): ${fs.used}/${fs.size} utilisé (${fs.usePercent})`
).join('\n') || '- Information non disponible'}

## 🔒 Configuration Sécurité

- **SELinux**: ${this.environment.security?.selinux?.enabled ? `Activé (${this.environment.security.selinux.status})` : 'Désactivé'}
- **AppArmor**: ${this.environment.security?.apparmor?.enabled ? `Activé (${this.environment.security.apparmor.profiles} profils)` : 'Désactivé'}
- **Pare-feu**: ${this.environment.restrictions?.network?.firewallActive ? 'Activé' : 'Désactivé'}

## 📝 INSTRUCTIONS SPÉCIALES POUR CLAUDE CODE

### Commandes Administratives
${!this.environment.permissions.canSudo ? 
`1. **NE JAMAIS utiliser \`sudo\`** - l'utilisateur n'y a pas accès
2. **Pour les tâches root**: Proposer \`su -c "commande"\` ou demander passage en root d'abord
3. **Alternative**: Chercher des solutions sans privilèges administrateur` :
`1. Utiliser \`sudo\` pour les tâches administratives
2. Vérifier d'abord si la tâche peut être faite sans sudo`}

### Installation de Packages
${this.environment.capabilities.packageManagers?.[0] ? 
`- **Gestionnaire principal**: ${this.environment.capabilities.packageManagers[0].name}
- **Commande standard**: ${this.environment.capabilities.packageManagers[0].name === 'apt' ? 'apt install' : 
  this.environment.capabilities.packageManagers[0].name === 'yum' ? 'yum install' : 
  this.environment.capabilities.packageManagers[0].name + ' install'}
${!this.environment.permissions.canSudo ? '- **ATTENTION**: Nécessite `su` pour installer des packages système' : ''}` :
'- Aucun gestionnaire de package détecté'}

### Ports et Services
- **Ports disponibles**: ${this.environment.network?.ports?.listening?.length || 0} ports en écoute
- **Recommandation**: Utiliser des ports utilisateur (>1024) pour éviter les conflits

---
*Détection effectuée le ${new Date().toISOString()}*
*Utilisateur: ${this.environment.permissions.currentUser}@${this.environment.basic.hostname}*`;

        return doc;
    }
    
    async saveEnvironmentDocumentation() {
        const doc = this.generateClaudeCodeEnvironmentDoc();
        const docPath = path.join(__dirname, '../../OS_ENVIRONMENT_FOR_CLAUDE.md');
        
        try {
            await fs.writeFile(docPath, doc);
            this.logger.success(`✅ OS environment documentation saved to: ${docPath}`);
            return docPath;
        } catch (error) {
            this.logger.error('Failed to save environment documentation:', error);
            throw error;
        }
    }
}

module.exports = OSEnvironmentDetector;