# Development Setup Validation

## Overview

Comprehensive validation system for AutoWeave development environment setup, ensuring all dependencies, configurations, and services are properly configured before development begins.

## Validation Architecture

### 1. Validation Hierarchy

```
Development Environment Validation
├── System Requirements
│   ├── Node.js version >= 18.0.0
│   ├── npm/yarn package manager
│   ├── Python >= 3.8 (for mem0 bridge)
│   └── Git version control
├── Platform Dependencies
│   ├── Operating System compatibility
│   ├── Available ports (3000, 8083, 5173, 8081, 8080)
│   ├── Network connectivity
│   └── Filesystem permissions
├── AutoWeave Configuration
│   ├── Environment variables
│   ├── Configuration files
│   ├── API keys
│   └── Directory structure
├── External Dependencies
│   ├── Docker (optional)
│   ├── kubectl (optional)
│   ├── Kubernetes cluster (optional)
│   └── External APIs (OpenAI, etc.)
└── Service Integration
    ├── Package dependencies
    ├── Service connections
    ├── Mock mode configuration
    └── Development tools
```

### 2. Validation Levels

| Level | Description | Impact | Required |
|-------|-------------|---------|----------|
| **Critical** | Core functionality requirements | Blocks development | Yes |
| **Important** | Enhanced features | Limits capabilities | Recommended |
| **Optional** | Additional tools | Convenience only | No |

## Validation Implementation

### 1. Development Environment Validator

```javascript
class DevEnvironmentValidator {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            overall: 'unknown',
            categories: {},
            issues: [],
            recommendations: [],
            score: 0
        };
    }

    async validateEnvironment() {
        console.log('🔍 Starting development environment validation...');

        // Run all validation categories
        this.results.categories = {
            system: await this.validateSystemRequirements(),
            platform: await this.validatePlatformDependencies(),
            configuration: await this.validateAutoWeaveConfiguration(),
            dependencies: await this.validateExternalDependencies(),
            integration: await this.validateServiceIntegration()
        };

        // Calculate overall score and status
        this.calculateOverallScore();
        this.generateRecommendations();

        console.log(`🔍 Validation complete: ${this.results.overall} (${this.results.score}%)`);
        return this.results;
    }

    async validateSystemRequirements() {
        const system = {
            score: 0,
            maxScore: 0,
            checks: {},
            issues: []
        };

        // Node.js version check
        const nodeCheck = this.checkNodeVersion();
        system.checks.nodejs = nodeCheck;
        system.maxScore += 25;
        if (nodeCheck.passed) system.score += 25;
        else system.issues.push(nodeCheck.issue);

        // npm/yarn check
        const packageManagerCheck = await this.checkPackageManager();
        system.checks.packageManager = packageManagerCheck;
        system.maxScore += 15;
        if (packageManagerCheck.passed) system.score += 15;
        else system.issues.push(packageManagerCheck.issue);

        // Python check (for mem0 bridge)
        const pythonCheck = await this.checkPython();
        system.checks.python = pythonCheck;
        system.maxScore += 10;
        if (pythonCheck.passed) system.score += 10;
        else system.issues.push(pythonCheck.issue);

        // Git check
        const gitCheck = await this.checkGit();
        system.checks.git = gitCheck;
        system.maxScore += 10;
        if (gitCheck.passed) system.score += 10;
        else system.issues.push(gitCheck.issue);

        return system;
    }

    checkNodeVersion() {
        const currentVersion = process.version;
        const requiredVersion = '18.0.0';
        
        const current = this.parseVersion(currentVersion);
        const required = this.parseVersion(requiredVersion);
        
        const isSupported = current.major > required.major || 
                           (current.major === required.major && current.minor >= required.minor);

        return {
            name: 'Node.js Version',
            level: 'critical',
            passed: isSupported,
            current: currentVersion,
            required: `>= ${requiredVersion}`,
            issue: isSupported ? null : {
                type: 'unsupported_node_version',
                message: `Node.js ${currentVersion} is not supported. Requires >= ${requiredVersion}`,
                resolution: 'Update Node.js to a supported version'
            }
        };
    }

    async checkPackageManager() {
        try {
            const { execSync } = require('child_process');
            
            // Check npm
            try {
                const npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
                return {
                    name: 'Package Manager',
                    level: 'critical',
                    passed: true,
                    manager: 'npm',
                    version: npmVersion
                };
            } catch (npmError) {
                // Check yarn as fallback
                try {
                    const yarnVersion = execSync('yarn --version', { encoding: 'utf8', timeout: 5000 }).trim();
                    return {
                        name: 'Package Manager',
                        level: 'critical',
                        passed: true,
                        manager: 'yarn',
                        version: yarnVersion
                    };
                } catch (yarnError) {
                    return {
                        name: 'Package Manager',
                        level: 'critical',
                        passed: false,
                        issue: {
                            type: 'no_package_manager',
                            message: 'Neither npm nor yarn is available',
                            resolution: 'Install npm (comes with Node.js) or yarn'
                        }
                    };
                }
            }
        } catch (error) {
            return {
                name: 'Package Manager',
                level: 'critical',
                passed: false,
                error: error.message,
                issue: {
                    type: 'package_manager_error',
                    message: `Package manager check failed: ${error.message}`,
                    resolution: 'Ensure npm or yarn is properly installed'
                }
            };
        }
    }

    async checkPython() {
        try {
            const { execSync } = require('child_process');
            const pythonVersion = execSync('python3 --version', { encoding: 'utf8', timeout: 5000 }).trim();
            
            const versionMatch = pythonVersion.match(/Python (\d+)\.(\d+)\.(\d+)/);
            if (versionMatch) {
                const major = parseInt(versionMatch[1]);
                const minor = parseInt(versionMatch[2]);
                const isSupported = major > 3 || (major === 3 && minor >= 8);
                
                return {
                    name: 'Python',
                    level: 'important',
                    passed: isSupported,
                    version: pythonVersion,
                    required: '>= 3.8',
                    issue: isSupported ? null : {
                        type: 'unsupported_python_version',
                        message: `Python version ${pythonVersion} is not supported for mem0 bridge`,
                        resolution: 'Update Python to version 3.8 or higher'
                    }
                };
            } else {
                return {
                    name: 'Python',
                    level: 'important',
                    passed: false,
                    issue: {
                        type: 'python_version_parse_error',
                        message: 'Could not parse Python version',
                        resolution: 'Ensure Python 3.8+ is properly installed'
                    }
                };
            }
        } catch (error) {
            return {
                name: 'Python',
                level: 'important',
                passed: false,
                issue: {
                    type: 'python_not_found',
                    message: 'Python 3 not found - mem0 bridge will not work',
                    resolution: 'Install Python 3.8+ for full memory system functionality'
                }
            };
        }
    }

    async validatePlatformDependencies() {
        const platform = {
            score: 0,
            maxScore: 0,
            checks: {},
            issues: []
        };

        // Operating System check
        const osCheck = this.checkOperatingSystem();
        platform.checks.operatingSystem = osCheck;
        platform.maxScore += 10;
        if (osCheck.passed) platform.score += 10;

        // Port availability check
        const portCheck = await this.checkPortAvailability();
        platform.checks.ports = portCheck;
        platform.maxScore += 20;
        if (portCheck.passed) platform.score += 20;
        else platform.issues.push(...portCheck.issues);

        // Network connectivity check
        const networkCheck = await this.checkNetworkConnectivity();
        platform.checks.network = networkCheck;
        platform.maxScore += 15;
        if (networkCheck.passed) platform.score += 15;
        else platform.issues.push(networkCheck.issue);

        // Filesystem permissions check
        const fsCheck = await this.checkFilesystemPermissions();
        platform.checks.filesystem = fsCheck;
        platform.maxScore += 15;
        if (fsCheck.passed) platform.score += 15;
        else platform.issues.push(...fsCheck.issues);

        return platform;
    }

    checkOperatingSystem() {
        const platform = process.platform;
        const supportedPlatforms = ['linux', 'darwin', 'win32'];
        const isSupported = supportedPlatforms.includes(platform);

        return {
            name: 'Operating System',
            level: 'critical',
            passed: isSupported,
            platform: platform,
            arch: process.arch,
            supported: supportedPlatforms,
            issue: isSupported ? null : {
                type: 'unsupported_platform',
                message: `Platform ${platform} may not be fully supported`,
                resolution: 'Consider using Linux, macOS, or Windows'
            }
        };
    }

    async checkPortAvailability() {
        const requiredPorts = [
            { port: 3000, service: 'AutoWeave Core', critical: true },
            { port: 8083, service: 'ANP Server', critical: true },
            { port: 5173, service: 'ChatUI', critical: false },
            { port: 8081, service: 'SillyTavern Port-Forward', critical: false },
            { port: 8080, service: 'Appsmith Port-Forward', critical: false }
        ];

        const results = {
            name: 'Port Availability',
            level: 'critical',
            passed: true,
            ports: {},
            issues: []
        };

        for (const portInfo of requiredPorts) {
            try {
                const isAvailable = await this.checkPortAvailable(portInfo.port);
                results.ports[portInfo.port] = {
                    service: portInfo.service,
                    available: isAvailable,
                    critical: portInfo.critical
                };

                if (!isAvailable && portInfo.critical) {
                    results.passed = false;
                    results.issues.push({
                        type: 'port_unavailable',
                        port: portInfo.port,
                        service: portInfo.service,
                        message: `Critical port ${portInfo.port} (${portInfo.service}) is not available`,
                        resolution: `Stop the process using port ${portInfo.port} or configure a different port`
                    });
                }
            } catch (error) {
                results.ports[portInfo.port] = {
                    service: portInfo.service,
                    error: error.message,
                    critical: portInfo.critical
                };
            }
        }

        return results;
    }

    async checkPortAvailable(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            
            server.listen(port, () => {
                server.once('close', () => resolve(true));
                server.close();
            });
            
            server.on('error', () => resolve(false));
        });
    }

    async validateAutoWeaveConfiguration() {
        const config = {
            score: 0,
            maxScore: 0,
            checks: {},
            issues: []
        };

        // Environment variables check
        const envCheck = this.checkEnvironmentVariables();
        config.checks.environment = envCheck;
        config.maxScore += 30;
        if (envCheck.passed) config.score += 30;
        else config.issues.push(...envCheck.issues);

        // Configuration files check
        const filesCheck = this.checkConfigurationFiles();
        config.checks.files = filesCheck;
        config.maxScore += 20;
        if (filesCheck.passed) config.score += 20;
        else config.issues.push(...filesCheck.issues);

        // Directory structure check
        const structureCheck = this.checkDirectoryStructure();
        config.checks.structure = structureCheck;
        config.maxScore += 10;
        if (structureCheck.passed) config.score += 10;
        else config.issues.push(structureCheck.issue);

        return config;
    }

    checkEnvironmentVariables() {
        const envVars = {
            critical: [
                { name: 'OPENAI_API_KEY', validator: (v) => v && v.startsWith('sk-') }
            ],
            important: [
                { name: 'NODE_ENV', validator: (v) => ['development', 'production', 'test'].includes(v) },
                { name: 'PORT', validator: (v) => !v || (!isNaN(v) && parseInt(v) > 0) }
            ],
            optional: [
                { name: 'LOG_LEVEL', validator: (v) => !v || ['debug', 'info', 'warn', 'error'].includes(v) },
                { name: 'ANTHROPIC_API_KEY', validator: (v) => !v || v.startsWith('sk-ant-') },
                { name: 'KUBECONFIG', validator: () => true }
            ]
        };

        const results = {
            name: 'Environment Variables',
            level: 'critical',
            passed: true,
            variables: {},
            issues: []
        };

        // Check all variable categories
        for (const [category, vars] of Object.entries(envVars)) {
            for (const envVar of vars) {
                const value = process.env[envVar.name];
                const isSet = !!value;
                const isValid = isSet ? envVar.validator(value) : false;

                results.variables[envVar.name] = {
                    category,
                    set: isSet,
                    valid: isValid,
                    required: category === 'critical'
                };

                if (category === 'critical' && (!isSet || !isValid)) {
                    results.passed = false;
                    results.issues.push({
                        type: 'missing_critical_env_var',
                        variable: envVar.name,
                        message: `Critical environment variable ${envVar.name} is ${!isSet ? 'not set' : 'invalid'}`,
                        resolution: `Set ${envVar.name} in your .env file`
                    });
                }
            }
        }

        return results;
    }

    async validateServiceIntegration() {
        const integration = {
            score: 0,
            maxScore: 0,
            checks: {},
            issues: []
        };

        // Package dependencies check
        const packagesCheck = await this.checkPackageDependencies();
        integration.checks.packages = packagesCheck;
        integration.maxScore += 25;
        if (packagesCheck.passed) integration.score += 25;
        else integration.issues.push(...packagesCheck.issues);

        // AutoWeave startup check
        const startupCheck = await this.checkAutoWeaveStartup();
        integration.checks.startup = startupCheck;
        integration.maxScore += 25;
        if (startupCheck.passed) integration.score += 25;
        else integration.issues.push(startupCheck.issue);

        return integration;
    }

    async checkPackageDependencies() {
        const results = {
            name: 'Package Dependencies',
            level: 'critical',
            passed: true,
            packages: {},
            issues: []
        };

        try {
            // Check if package.json exists
            const fs = require('fs');
            const packageJsonPath = '/home/gontrand/AutoWeave/package.json';
            
            if (!fs.existsSync(packageJsonPath)) {
                results.passed = false;
                results.issues.push({
                    type: 'missing_package_json',
                    message: 'package.json not found',
                    resolution: 'Ensure you are in the AutoWeave project directory'
                });
                return results;
            }

            // Check if node_modules exists
            const nodeModulesPath = '/home/gontrand/AutoWeave/node_modules';
            if (!fs.existsSync(nodeModulesPath)) {
                results.passed = false;
                results.issues.push({
                    type: 'missing_node_modules',
                    message: 'node_modules directory not found',
                    resolution: 'Run "npm install" to install dependencies'
                });
                return results;
            }

            // Read package.json and check critical dependencies
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const criticalDeps = ['express', 'openai', '@kubernetes/client-node', 'ws'];

            for (const dep of criticalDeps) {
                const depPath = `/home/gontrand/AutoWeave/node_modules/${dep}`;
                const isInstalled = fs.existsSync(depPath);
                
                results.packages[dep] = {
                    required: packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep],
                    installed: isInstalled
                };

                if (!isInstalled) {
                    results.passed = false;
                    results.issues.push({
                        type: 'missing_dependency',
                        package: dep,
                        message: `Critical dependency ${dep} is not installed`,
                        resolution: 'Run "npm install" to install missing dependencies'
                    });
                }
            }

        } catch (error) {
            results.passed = false;
            results.issues.push({
                type: 'package_check_error',
                message: `Failed to check package dependencies: ${error.message}`,
                resolution: 'Verify package.json and node_modules are accessible'
            });
        }

        return results;
    }

    calculateOverallScore() {
        let totalScore = 0;
        let maxTotalScore = 0;

        // Calculate weighted scores
        const weights = {
            system: 0.3,
            platform: 0.25,
            configuration: 0.25,
            dependencies: 0.1,
            integration: 0.1
        };

        for (const [category, result] of Object.entries(this.results.categories)) {
            const weight = weights[category] || 0.1;
            const categoryScore = result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0;
            
            totalScore += categoryScore * weight;
            maxTotalScore += 100 * weight;
        }

        this.results.score = Math.round((totalScore / maxTotalScore) * 100);

        // Determine overall status
        if (this.results.score >= 90) {
            this.results.overall = 'excellent';
        } else if (this.results.score >= 70) {
            this.results.overall = 'good';
        } else if (this.results.score >= 50) {
            this.results.overall = 'needs-attention';
        } else {
            this.results.overall = 'critical';
        }
    }

    generateRecommendations() {
        // Collect all issues
        const allIssues = [];
        for (const category of Object.values(this.results.categories)) {
            allIssues.push(...category.issues);
        }

        // Generate recommendations based on issues
        this.results.recommendations = allIssues.map(issue => ({
            type: issue.type,
            priority: this.getIssuePriority(issue.type),
            message: issue.message,
            action: issue.resolution
        }));

        // Add general recommendations
        if (this.results.score < 70) {
            this.results.recommendations.push({
                type: 'general',
                priority: 'high',
                message: 'Development environment needs attention',
                action: 'Review and resolve the identified issues before starting development'
            });
        }
    }

    getIssuePriority(issueType) {
        const priorities = {
            'unsupported_node_version': 'critical',
            'no_package_manager': 'critical',
            'missing_critical_env_var': 'critical',
            'port_unavailable': 'high',
            'missing_dependency': 'high',
            'python_not_found': 'medium',
            'unsupported_platform': 'low'
        };

        return priorities[issueType] || 'medium';
    }

    parseVersion(versionString) {
        const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);
        return {
            major: parseInt(match[1]),
            minor: parseInt(match[2]),
            patch: parseInt(match[3])
        };
    }
}
```

## Validation Scripts

### 1. Environment Setup Validation Script
```bash
#!/bin/bash
# validate-dev-setup.sh - Comprehensive development environment validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VERBOSE=false
FIX_ISSUES=false
OUTPUT_JSON=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--fix)
            FIX_ISSUES=true
            shift
            ;;
        -j|--json)
            OUTPUT_JSON=true
            shift
            ;;
        --help)
            echo "AutoWeave Development Setup Validation"
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Show detailed output"
            echo "  -f, --fix        Attempt to fix issues automatically"
            echo "  -j, --json       Output results in JSON format"
            echo "  --help           Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    if [ "$OUTPUT_JSON" != true ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    if [ "$OUTPUT_JSON" != true ]; then
        echo -e "${GREEN}[SUCCESS]${NC} $1"
    fi
}

log_warning() {
    if [ "$OUTPUT_JSON" != true ]; then
        echo -e "${YELLOW}[WARNING]${NC} $1"
    fi
}

log_error() {
    if [ "$OUTPUT_JSON" != true ]; then
        echo -e "${RED}[ERROR]${NC} $1"
    fi
}

# Validation results
VALIDATION_RESULTS=()
TOTAL_SCORE=0
MAX_SCORE=0

# Add validation result
add_result() {
    local category=$1
    local name=$2
    local status=$3
    local message=$4
    local fix_action=$5
    local score=$6
    local max_score=$7
    
    VALIDATION_RESULTS+=("{\"category\":\"$category\",\"name\":\"$name\",\"status\":\"$status\",\"message\":\"$message\",\"fix_action\":\"$fix_action\",\"score\":$score,\"max_score\":$max_score}")
    TOTAL_SCORE=$((TOTAL_SCORE + score))
    MAX_SCORE=$((MAX_SCORE + max_score))
}

# Check Node.js version
check_node_version() {
    log_info "Checking Node.js version..."
    
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        local major_version=$(echo $node_version | sed 's/v\([0-9]*\).*/\1/')
        
        if [ "$major_version" -ge 18 ]; then
            log_success "Node.js $node_version is supported"
            add_result "system" "nodejs" "pass" "Node.js $node_version" "" 25 25
        else
            log_error "Node.js $node_version is not supported (requires >= 18.0.0)"
            add_result "system" "nodejs" "fail" "Node.js $node_version not supported" "Update Node.js to version 18 or higher" 0 25
        fi
    else
        log_error "Node.js is not installed"
        add_result "system" "nodejs" "fail" "Node.js not found" "Install Node.js 18.0.0 or higher" 0 25
    fi
}

# Check package manager
check_package_manager() {
    log_info "Checking package manager..."
    
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_success "npm $npm_version is available"
        add_result "system" "package_manager" "pass" "npm $npm_version" "" 15 15
    elif command -v yarn &> /dev/null; then
        local yarn_version=$(yarn --version)
        log_success "yarn $yarn_version is available"
        add_result "system" "package_manager" "pass" "yarn $yarn_version" "" 15 15
    else
        log_error "No package manager found (npm or yarn required)"
        add_result "system" "package_manager" "fail" "No package manager" "Install npm (comes with Node.js) or yarn" 0 15
    fi
}

# Check environment variables
check_environment_variables() {
    log_info "Checking environment variables..."
    
    local env_score=0
    local env_issues=()
    
    # Load .env file if it exists
    if [ -f ".env" ]; then
        source .env
        log_success ".env file found and loaded"
    else
        log_warning ".env file not found"
        env_issues+=("No .env file")
    fi
    
    # Check critical variables
    if [ -n "$OPENAI_API_KEY" ]; then
        if [[ $OPENAI_API_KEY == sk-* ]]; then
            log_success "OPENAI_API_KEY is configured"
            env_score=$((env_score + 20))
        else
            log_error "OPENAI_API_KEY format is invalid"
            env_issues+=("Invalid OPENAI_API_KEY format")
        fi
    else
        log_error "OPENAI_API_KEY is not set"
        env_issues+=("Missing OPENAI_API_KEY")
    fi
    
    # Check optional variables
    local optional_vars=("NODE_ENV" "PORT" "LOG_LEVEL")
    for var in "${optional_vars[@]}"; do
        if [ -n "${!var}" ]; then
            log_success "$var is set to ${!var}"
            env_score=$((env_score + 3))
        else
            log_warning "$var is not set (using default)"
        fi
    done
    
    if [ ${#env_issues[@]} -eq 0 ]; then
        add_result "configuration" "environment" "pass" "All environment variables configured" "" $env_score 30
    else
        local issues_msg=$(IFS=", "; echo "${env_issues[*]}")
        add_result "configuration" "environment" "fail" "$issues_msg" "Configure missing environment variables in .env file" $env_score 30
    fi
}

# Check ports availability
check_ports() {
    log_info "Checking port availability..."
    
    local ports=(3000 8083 5173)
    local available_ports=0
    local port_issues=()
    
    for port in "${ports[@]}"; do
        if ! ss -tlnp | grep -q ":$port "; then
            log_success "Port $port is available"
            available_ports=$((available_ports + 1))
        else
            log_warning "Port $port is in use"
            port_issues+=("Port $port in use")
        fi
    done
    
    local port_score=$((available_ports * 7)) # 21 total possible
    
    if [ ${#port_issues[@]} -eq 0 ]; then
        add_result "platform" "ports" "pass" "All ports available" "" $port_score 21
    else
        local issues_msg=$(IFS=", "; echo "${port_issues[*]}")
        add_result "platform" "ports" "warning" "$issues_msg" "Stop processes using required ports" $port_score 21
    fi
}

# Check project structure
check_project_structure() {
    log_info "Checking project structure..."
    
    local required_dirs=("src" "config" "docs" "tests")
    local required_files=("package.json" "CLAUDE.md" "README.md")
    local structure_score=0
    local structure_issues=()
    
    # Check directories
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "Directory $dir exists"
            structure_score=$((structure_score + 2))
        else
            log_error "Directory $dir is missing"
            structure_issues+=("Missing $dir directory")
        fi
    done
    
    # Check files
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "File $file exists"
            structure_score=$((structure_score + 2))
        else
            log_error "File $file is missing"
            structure_issues+=("Missing $file")
        fi
    done
    
    if [ ${#structure_issues[@]} -eq 0 ]; then
        add_result "configuration" "structure" "pass" "Project structure is complete" "" $structure_score 14
    else
        local issues_msg=$(IFS=", "; echo "${structure_issues[*]}")
        add_result "configuration" "structure" "fail" "$issues_msg" "Ensure you are in the AutoWeave project root directory" $structure_score 14
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking package dependencies..."
    
    if [ -f "package.json" ] && [ -d "node_modules" ]; then
        log_success "Dependencies appear to be installed"
        add_result "integration" "dependencies" "pass" "Dependencies installed" "" 20 20
    elif [ -f "package.json" ]; then
        log_error "Dependencies not installed"
        add_result "integration" "dependencies" "fail" "node_modules missing" "Run 'npm install' to install dependencies" 0 20
        
        if [ "$FIX_ISSUES" = true ]; then
            log_info "Attempting to install dependencies..."
            if npm install; then
                log_success "Dependencies installed successfully"
            else
                log_error "Failed to install dependencies"
            fi
        fi
    else
        log_error "package.json not found"
        add_result "integration" "dependencies" "fail" "package.json missing" "Ensure you are in the AutoWeave project directory" 0 20
    fi
}

# Output results
output_results() {
    if [ "$OUTPUT_JSON" = true ]; then
        # JSON output
        local results_json="["
        local first=true
        for result in "${VALIDATION_RESULTS[@]}"; do
            if [ "$first" = true ]; then
                first=false
            else
                results_json+=","
            fi
            results_json+="$result"
        done
        results_json+="]"
        
        local percentage=0
        if [ $MAX_SCORE -gt 0 ]; then
            percentage=$((TOTAL_SCORE * 100 / MAX_SCORE))
        fi
        
        echo "{\"timestamp\":\"$(date -Iseconds)\",\"score\":$TOTAL_SCORE,\"max_score\":$MAX_SCORE,\"percentage\":$percentage,\"results\":$results_json}"
    else
        # Human-readable output
        echo ""
        echo "=== Validation Summary ==="
        local percentage=0
        if [ $MAX_SCORE -gt 0 ]; then
            percentage=$((TOTAL_SCORE * 100 / MAX_SCORE))
        fi
        
        echo "Score: $TOTAL_SCORE/$MAX_SCORE ($percentage%)"
        
        if [ $percentage -ge 80 ]; then
            log_success "Development environment is ready"
            echo "You can start developing with AutoWeave!"
        elif [ $percentage -ge 60 ]; then
            log_warning "Development environment needs minor fixes"
            echo "Address the warnings above for optimal experience."
        else
            log_error "Development environment has critical issues"
            echo "Fix the errors above before starting development."
        fi
    fi
}

# Main validation function
main() {
    if [ "$OUTPUT_JSON" != true ]; then
        echo ""
        echo "🔍 AutoWeave Development Setup Validation"
        echo "=========================================="
        echo ""
    fi
    
    # Change to project directory if not already there
    if [ ! -f "package.json" ]; then
        if [ -f "/home/gontrand/AutoWeave/package.json" ]; then
            cd /home/gontrand/AutoWeave
        else
            log_error "Cannot find AutoWeave project directory"
            exit 1
        fi
    fi
    
    # Run all validations
    check_node_version
    check_package_manager
    check_environment_variables
    check_ports
    check_project_structure
    check_dependencies
    
    # Output results
    output_results
    
    # Exit with appropriate code
    local percentage=0
    if [ $MAX_SCORE -gt 0 ]; then
        percentage=$((TOTAL_SCORE * 100 / MAX_SCORE))
    fi
    
    if [ $percentage -ge 80 ]; then
        exit 0
    elif [ $percentage -ge 60 ]; then
        exit 1
    else
        exit 2
    fi
}

# Run main function
main "$@"
```

### 2. Automated Setup Script
```bash
#!/bin/bash
# setup-dev-environment.sh - Automated development environment setup

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo ""
echo "🚀 AutoWeave Development Environment Setup"
echo "==========================================="
echo ""

# Step 1: Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    log_info "Creating .env file from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success ".env file created from template"
        log_warning "Please edit .env file and add your OPENAI_API_KEY"
    else
        log_warning "No .env.example found, creating basic .env file"
        cat > .env << 'EOF'
# AutoWeave Development Environment
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# REQUIRED: Add your OpenAI API key
OPENAI_API_KEY=sk-your-key-here

# Optional: Add other API keys
# ANTHROPIC_API_KEY=sk-ant-your-key-here
# OPENROUTER_API_KEY=sk-or-your-key-here

# Kubernetes (optional for development)
KUBECONFIG=~/.kube/config
KAGENT_NAMESPACE=default

# Memory system (will use mock mode if not configured)
MEM0_SELF_HOSTED=true
QDRANT_HOST=localhost
MEMGRAPH_HOST=localhost
EOF
        log_success "Basic .env file created"
        log_warning "Please edit .env file and add your OPENAI_API_KEY"
    fi
else
    log_success ".env file already exists"
fi

# Step 2: Install dependencies
log_info "Installing dependencies..."
if command -v npm &> /dev/null; then
    npm install
    log_success "Dependencies installed with npm"
elif command -v yarn &> /dev/null; then
    yarn install
    log_success "Dependencies installed with yarn"
else
    log_error "No package manager found (npm or yarn required)"
    exit 1
fi

# Step 3: Create necessary directories
log_info "Creating necessary directories..."
mkdir -p logs
mkdir -p public
mkdir -p tmp
log_success "Directories created"

# Step 4: Run validation
log_info "Running development environment validation..."
if ./scripts/validate-dev-setup.sh; then
    log_success "Development environment validation passed"
else
    log_warning "Development environment validation found issues"
    echo "Run './scripts/validate-dev-setup.sh -v' for detailed information"
fi

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your OPENAI_API_KEY"
echo "2. Run 'npm start' to start AutoWeave"
echo "3. Access ChatUI at http://localhost:5173"
echo ""
```

Ce guide complet de validation de configuration de développement permet à AutoWeave de s'assurer que l'environnement est correctement configuré avant de commencer le développement, réduisant ainsi les erreurs liées à des configurations manquantes ou incorrectes.