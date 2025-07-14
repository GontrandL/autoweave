# Dependabot Pull Requests Review Guide

## Overview
Dependabot has created several pull requests to update dependencies. Here's how to review and merge them:

## Current PRs (based on workflow runs):

### 1. Docker Updates
- **Packages affected**: core, backend, memory
- **What to check**: 
  - Ensure Docker base images are compatible with your application
  - Check for breaking changes in new versions
  - Review Dockerfile changes

### 2. Python Dependencies
- **Package affected**: memory (pip updates)
- **What to check**:
  - Python package compatibility
  - Breaking changes in APIs
  - Test the memory system after updates

### 3. GitHub Actions
- **What to check**:
  - Action version compatibility
  - New features or deprecations
  - Workflow syntax changes

### 4. npm/yarn Dependencies
- **What to check**:
  - JavaScript package compatibility
  - Breaking changes in major versions
  - Run tests after updates

## How to Review and Merge

### Via GitHub Web Interface:

1. **Go to Pull Requests**:
   ```
   https://github.com/GontrandL/autoweave/pulls
   ```

2. **For each Dependabot PR**:
   - Click on the PR
   - Review the changes (especially version bumps)
   - Check the CI/CD status (should be green)
   - Click "Merge pull request" if everything looks good

### Via Command Line (if you have GitHub CLI):

```bash
# List all PRs
gh pr list --author dependabot

# Review a specific PR
gh pr view <PR_NUMBER>

# Merge a PR
gh pr merge <PR_NUMBER> --merge --auto
```

### Best Practices:

1. **Merge one at a time**: Start with the least risky updates (patch versions)
2. **Check CI status**: Ensure all checks pass before merging
3. **Test locally**: For major updates, test locally first
4. **Group similar updates**: Merge similar updates together (e.g., all Docker updates)

## Priority Order:

1. **Security updates** (HIGH priority)
2. **Patch versions** (x.x.1 -> x.x.2) - Usually safe
3. **Minor versions** (x.1.x -> x.2.x) - Review changelog
4. **Major versions** (1.x.x -> 2.x.x) - Careful review needed

## After Merging:

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Run tests locally:
   ```bash
   pnpm test
   ```

3. Check application health:
   ```bash
   pnpm run health
   ```

## Automated Merging (Optional):

You can configure Dependabot to auto-merge certain updates by adding a `.github/dependabot.yml` configuration:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    automerged_updates:
      - match:
          dependency_type: "development"
          update_type: "patch"
      - match:
          dependency_type: "production"
          update_type: "patch"
```

## Security Considerations:

- Always review changes in security-critical packages
- Check for CVE fixes in the update descriptions
- Verify package signatures when possible
- Monitor for unusual behavior after updates