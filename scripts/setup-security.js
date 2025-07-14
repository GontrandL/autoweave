#!/usr/bin/env node

const fs = require('fs').promises;

/**
 * Security Setup Script
 * Ensures proper security configuration for the AutoWeave monorepo
 */

class SecuritySetup {
    constructor() {
        this.issues = [];
        this.fixed = [];
    }

    async setup() {
        console.log('🔒 Setting up AutoWeave Security Configuration...\n');
        
        await this.checkGitignore();
        await this.createSecurityPolicy();
        await this.createPreCommitHook();
        await this.generateSecurityChecklist();
        
        this.printSummary();
    }

    async checkGitignore() {
        console.log('📝 Checking .gitignore configuration...');
        
        try {
            const gitignore = await fs.readFile('.gitignore', 'utf8');
            
            const requiredPatterns = [
                '.env',
                '.env.local',
                '.env.*.local',
                '*.key',
                '*.pem',
                'secrets/',
                '.secrets/'
            ];
            
            let updated = false;
            let content = gitignore;
            
            for (const pattern of requiredPatterns) {
                if (!gitignore.includes(pattern)) {
                    content += `\n# Security: ${pattern}\n${pattern}\n`;
                    updated = true;
                    this.fixed.push(`Added ${pattern} to .gitignore`);
                }
            }
            
            if (updated) {
                await fs.writeFile('.gitignore', content);
                console.log('✅ Updated .gitignore with security patterns');
            } else {
                console.log('✅ .gitignore already properly configured');
            }
            
        } catch (error) {
            this.issues.push('No .gitignore file found');
            console.log('❌ No .gitignore file found');
        }
    }

    async createSecurityPolicy() {
        console.log('📋 Creating security policy...');
        
        const securityPolicy = `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities to security@autoweave.dev or create a private GitHub security advisory.

### What to Include

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if known)

### Response Timeline

- **Initial Response**: Within 24 hours
- **Status Update**: Within 72 hours
- **Fix Timeline**: Varies by severity
  - Critical: 1-3 days
  - High: 1-2 weeks
  - Medium: 2-4 weeks
  - Low: Next scheduled release

## Security Best Practices

### Development

1. **Never commit secrets**
   - Use \`.env\` files for local development
   - Use environment variables in production
   - Rotate any accidentally committed secrets immediately

2. **Dependency Management**
   - Run \`npm audit\` regularly
   - Keep dependencies up to date
   - Review security advisories

3. **Code Review**
   - All code must be reviewed before merging
   - Pay special attention to:
     - Input validation
     - Authentication/authorization
     - Data handling
     - External integrations

### Production

1. **Environment Security**
   - Use secure secret management (e.g., Kubernetes secrets, HashiCorp Vault)
   - Enable HTTPS/TLS everywhere
   - Use least-privilege access principles

2. **Monitoring**
   - Enable security logging
   - Monitor for suspicious activity
   - Set up alerts for security events

3. **Updates**
   - Apply security updates promptly
   - Test updates in staging first
   - Have a rollback plan

## Security Tools

This project uses several security tools:

- **CodeQL**: Static analysis for vulnerabilities
- **Dependabot**: Automated dependency updates
- **TruffleHog**: Secret scanning
- **Snyk**: Vulnerability scanning
- **npm audit**: Node.js dependency auditing

## Incident Response

1. **Immediate Response**
   - Assess the scope and impact
   - Contain the vulnerability
   - Document everything

2. **Mitigation**
   - Develop and test a fix
   - Deploy the fix
   - Verify the fix works

3. **Post-Incident**
   - Conduct a post-mortem
   - Update security processes
   - Communicate with stakeholders

## Contact

- Security Team: security@autoweave.dev
- General Contact: hello@autoweave.dev
`;

        try {
            await fs.writeFile('SECURITY.md', securityPolicy);
            console.log('✅ Created SECURITY.md policy');
            this.fixed.push('Created security policy');
        } catch (error) {
            this.issues.push('Failed to create security policy');
            console.log('❌ Failed to create security policy');
        }
    }

    async createPreCommitHook() {
        console.log('🪝 Setting up pre-commit security checks...');
        
        const preCommitConfig = `# Pre-commit security configuration
repos:
  - repo: https://github.com/trufflesecurity/trufflehog
    rev: main
    hooks:
      - id: trufflehog
        name: TruffleHog
        description: Detect secrets in your data.
        entry: bash -c 'trufflehog git file://. --since-commit HEAD --only-verified --fail'
        language: system
        stages: ["commit", "push"]

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: check-added-large-files
      - id: check-json
      - id: check-yaml
      - id: detect-private-key
      - id: end-of-file-fixer
      - id: trailing-whitespace

  - repo: local
    hooks:
      - id: npm-audit
        name: npm audit
        entry: npm audit --audit-level=high
        language: system
        pass_filenames: false
        stages: ["push"]
        
      - id: check-env-files
        name: Check for .env files
        entry: bash -c 'if find . -name "*.env" -not -path "./node_modules/*" | grep -q .; then echo "Error: .env files found in commit"; exit 1; fi'
        language: system
        pass_filenames: false
`;

        try {
            await fs.writeFile('.pre-commit-config.yaml', preCommitConfig);
            console.log('✅ Created pre-commit security configuration');
            this.fixed.push('Created pre-commit hooks');
        } catch (error) {
            this.issues.push('Failed to create pre-commit hooks');
            console.log('❌ Failed to create pre-commit hooks');
        }
    }

    async generateSecurityChecklist() {
        console.log('📋 Generating security checklist...');
        
        const checklist = `# AutoWeave Security Checklist

## Pre-deployment Security Checklist

### Code Security
- [ ] No hardcoded secrets in code
- [ ] All user inputs validated and sanitized
- [ ] SQL injection prevention implemented
- [ ] XSS protection in place
- [ ] CSRF protection enabled
- [ ] Authentication/authorization working correctly
- [ ] Error messages don't reveal sensitive information
- [ ] Logging doesn't capture sensitive data

### Dependency Security
- [ ] \`npm audit\` passes with no high/critical vulnerabilities
- [ ] All dependencies are up to date
- [ ] No known vulnerable packages in use
- [ ] Dependencies reviewed for security advisories

### Infrastructure Security
- [ ] HTTPS/TLS enabled everywhere
- [ ] Secrets stored securely (not in environment variables)
- [ ] Database access properly secured
- [ ] Network access restricted (firewall rules)
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested

### Kubernetes Security
- [ ] Pod security policies/standards enforced
- [ ] Network policies configured
- [ ] RBAC properly configured
- [ ] Secrets stored in Kubernetes secrets (not ConfigMaps)
- [ ] Images scanned for vulnerabilities
- [ ] Non-root containers used
- [ ] Resource limits set

### Container Security
- [ ] Base images are secure and up to date
- [ ] Images built with minimal attack surface
- [ ] No secrets in image layers
- [ ] Images signed and verified
- [ ] Registry access properly secured

### Monitoring & Incident Response
- [ ] Security logging enabled
- [ ] Intrusion detection configured
- [ ] Incident response plan documented
- [ ] Security team contact information available
- [ ] Regular security reviews scheduled

## Development Security Checklist

### Local Development
- [ ] Use \`.env\` files for local secrets (never commit)
- [ ] Keep dependencies updated
- [ ] Run security scans regularly
- [ ] Use secure coding practices
- [ ] Review code for security issues

### Git Security
- [ ] \`.gitignore\` properly configured
- [ ] Pre-commit hooks enabled
- [ ] No sensitive data in commit history
- [ ] GPG commit signing enabled (recommended)

### CI/CD Security
- [ ] Security scans in CI pipeline
- [ ] Secrets managed securely in CI
- [ ] Build artifacts scanned
- [ ] Deployment security verified

## Security Tools Configuration

### Required Tools
- [x] CodeQL (GitHub Advanced Security)
- [x] Dependabot (GitHub)
- [x] TruffleHog (Secret scanning)
- [x] npm audit (Node.js)
- [ ] Snyk (Optional, requires API key)

### Recommended Tools
- [ ] SonarCloud/SonarQube
- [ ] OWASP ZAP (for API testing)
- [ ] Trivy (container scanning)
- [ ] Falco (runtime security)

## Regular Security Tasks

### Weekly
- [ ] Review dependency updates
- [ ] Check security alerts
- [ ] Review access logs

### Monthly
- [ ] Security scan of all systems
- [ ] Review and update security policies
- [ ] Test incident response procedures

### Quarterly
- [ ] Full security audit
- [ ] Penetration testing
- [ ] Security training for team

---

**Remember**: Security is everyone's responsibility!
`;

        try {
            await fs.writeFile('SECURITY_CHECKLIST.md', checklist);
            console.log('✅ Created security checklist');
            this.fixed.push('Created security checklist');
        } catch (error) {
            this.issues.push('Failed to create security checklist');
            console.log('❌ Failed to create security checklist');
        }
    }

    printSummary() {
        console.log('\n📊 Security Setup Summary');
        console.log('=========================\n');
        
        if (this.fixed.length > 0) {
            console.log('✅ Security Improvements:');
            this.fixed.forEach(fix => console.log(`   - ${fix}`));
        }
        
        if (this.issues.length > 0) {
            console.log('\n⚠️  Issues Found:');
            this.issues.forEach(issue => console.log(`   - ${issue}`));
        }
        
        console.log('\n🔐 Next Steps:');
        console.log('1. Review and update .env.example with required variables');
        console.log('2. Install pre-commit hooks: npm install pre-commit --save-dev');
        console.log('3. Enable GitHub security features (CodeQL, Dependabot)');
        console.log('4. Set up secret scanning in CI/CD');
        console.log('5. Review SECURITY_CHECKLIST.md regularly');
        
        console.log('\n✅ Security setup complete!');
    }
}

// Run the security setup
const setup = new SecuritySetup();
setup.setup().catch(console.error);