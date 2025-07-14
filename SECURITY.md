# Security Policy

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
   - Use `.env` files for local development
   - Use environment variables in production
   - Rotate any accidentally committed secrets immediately

2. **Dependency Management**
   - Run `npm audit` regularly
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
