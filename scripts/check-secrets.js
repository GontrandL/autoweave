#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Secret Detection Script
 * Checks for potential hardcoded secrets in the codebase
 */

class SecretChecker {
    constructor() {
        this.suspiciousPatterns = [
            // API Keys
            /['"]?[A-Za-z0-9_]*(?:api[_-]?key|apikey)['"]*\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi,
            /sk-[a-zA-Z0-9]{48}/g, // OpenAI API key pattern
            /AIza[0-9A-Za-z\-_]{35}/g, // Google API key pattern
            
            // Tokens
            /['"]?[A-Za-z0-9_]*(?:token|auth)['"]*\s*[:=]\s*['"][A-Za-z0-9_\-\.]{20,}['"]/gi,
            /ghp_[0-9a-zA-Z]{36}/g, // GitHub personal access token
            /ghr_[0-9a-zA-Z]{36}/g, // GitHub refresh token
            
            // Passwords
            /(?:password|passwd|pwd)['"]*\s*[:=]\s*['"][^'"]{8,}['"]/gi,
            
            // Generic secrets
            /(?:secret|private[_-]?key)['"]*\s*[:=]\s*['"][^'"]{10,}['"]/gi,
            
            // AWS
            /AKIA[0-9A-Z]{16}/g, // AWS Access Key ID
            /[0-9a-zA-Z/+=]{40}/g, // AWS Secret Access Key (less reliable)
            
            // Database URLs with credentials
            /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/gi
        ];
        
        this.findings = [];
        this.checkedFiles = 0;
    }

    async check() {
        console.log('🔍 Checking for hardcoded secrets...\n');
        
        // Check source files
        await this.checkDirectory('./packages');
        await this.checkDirectory('./src');
        await this.checkDirectory('./scripts');
        
        // Generate report
        this.generateReport();
    }

    async checkDirectory(dir) {
        try {
            const files = await this.getAllFiles(dir);
            
            for (const file of files) {
                await this.checkFile(file);
            }
        } catch (error) {
            console.log(`⚠️  Could not check directory ${dir}: ${error.message}`);
        }
    }

    async checkFile(filePath) {
        // Skip certain files
        if (this.shouldSkipFile(filePath)) {
            return;
        }
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            this.checkedFiles++;
            
            for (const pattern of this.suspiciousPatterns) {
                const matches = content.match(pattern);
                
                if (matches) {
                    for (const match of matches) {
                        // Filter out false positives
                        if (!this.isFalsePositive(match, filePath)) {
                            this.findings.push({
                                file: filePath,
                                match: this.sanitizeMatch(match),
                                line: this.getLineNumber(content, match)
                            });
                        }
                    }
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }

    shouldSkipFile(filePath) {
        const skipPatterns = [
            /node_modules/,
            /\.git/,
            /\.env$/,
            /\.env\./,
            /\.log$/,
            /\.lock$/,
            /coverage/,
            /dist/,
            /build/,
            /\.min\.js$/,
            /\.map$/
        ];
        
        return skipPatterns.some(pattern => pattern.test(filePath));
    }

    isFalsePositive(match, filePath) {
        // Check for common false positives
        const falsePositives = [
            'your_api_key_here',
            'your_openai_api_key',
            'your_github_token',
            'your_password_here',
            'example_api_key',
            'test_api_key',
            'dummy_token',
            'placeholder',
            'xxxxxxxx',
            'REDACTED',
            '<your-api-key>',
            '${OPENAI_API_KEY}',
            'process.env.',
            'config.',
            'settings.'
        ];
        
        const lowerMatch = match.toLowerCase();
        return falsePositives.some(fp => lowerMatch.includes(fp.toLowerCase()));
    }

    sanitizeMatch(match) {
        // Show only part of the potential secret
        if (match.length > 20) {
            const parts = match.split(/[:=]/);
            if (parts.length === 2) {
                const key = parts[0];
                const value = parts[1].replace(/['"]/g, '');
                const sanitized = value.substring(0, 6) + '...' + value.substring(value.length - 4);
                return `${key}="${sanitized}"`;
            }
        }
        return match.substring(0, 30) + '...';
    }

    getLineNumber(content, match) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match)) {
                return i + 1;
            }
        }
        return 0;
    }

    async getAllFiles(dir) {
        const files = [];
        
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory() && !this.shouldSkipFile(fullPath)) {
                    files.push(...await this.getAllFiles(fullPath));
                } else if (item.isFile()) {
                    const ext = path.extname(item.name);
                    if (['.js', '.ts', '.json', '.yml', '.yaml', '.sh', '.py'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
        
        return files;
    }

    generateReport() {
        console.log('\n📋 Security Check Report');
        console.log('========================\n');
        console.log(`Files checked: ${this.checkedFiles}`);
        console.log(`Potential secrets found: ${this.findings.length}\n`);
        
        if (this.findings.length === 0) {
            console.log('✅ No hardcoded secrets detected!');
            console.log('\nNote: This check may not catch all secrets. Always review manually.');
        } else {
            console.log('⚠️  Potential secrets found:\n');
            
            this.findings.forEach(({ file, match, line }) => {
                console.log(`File: ${file}`);
                console.log(`Line ${line}: ${match}`);
                console.log('');
            });
            
            console.log('🔐 Recommendations:');
            console.log('1. Move all secrets to .env files');
            console.log('2. Use environment variables (process.env.VARIABLE_NAME)');
            console.log('3. Add .env to .gitignore');
            console.log('4. Use a secret management service in production');
            console.log('5. Rotate any exposed secrets immediately');
        }
        
        console.log('\n📝 .gitignore check:');
        this.checkGitignore();
    }

    async checkGitignore() {
        try {
            const gitignore = await fs.readFile('.gitignore', 'utf8');
            const important = ['.env', '.env.local', '.env.*.local', '*.key', '*.pem'];
            
            important.forEach(pattern => {
                if (gitignore.includes(pattern)) {
                    console.log(`✅ ${pattern} is in .gitignore`);
                } else {
                    console.log(`❌ ${pattern} should be added to .gitignore`);
                }
            });
        } catch (error) {
            console.log('❌ No .gitignore file found!');
        }
    }
}

// Run the checker
const checker = new SecretChecker();
checker.check().catch(console.error);