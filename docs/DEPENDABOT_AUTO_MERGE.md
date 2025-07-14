# Dependabot Auto-Merge Configuration

## Overview

This document describes the Dependabot auto-merge configuration for the AutoWeave project. The system automatically merges safe dependency updates while requiring manual review for potentially breaking changes.

## What Gets Auto-Merged

### ✅ Automatically Merged:
1. **Patch updates** (1.0.0 → 1.0.1)
   - All patch updates for both production and development dependencies
   - These typically contain bug fixes and security patches

2. **Minor development dependency updates** (1.0.0 → 1.1.0)
   - Only for devDependencies
   - These rarely cause issues in development

3. **GitHub Actions updates**
   - Patch and minor updates only
   - Actions are generally backward compatible

### ❌ Requires Manual Review:
1. **Major updates** (1.0.0 → 2.0.0)
   - All major version updates
   - May contain breaking changes

2. **Minor production dependency updates**
   - Could affect application behavior
   - Need testing before merge

3. **Excluded packages** (always manual):
   - `typescript` - Can break type checking
   - `jest` - Can break tests
   - `turbo` - Can affect build process
   - `@types/*` - Type definitions need careful review

## How It Works

### 1. Dependabot Creates PR
When Dependabot detects an update, it:
- Creates a pull request
- Adds appropriate labels
- Triggers CI/CD checks

### 2. Auto-Merge Workflow
The `dependabot-auto-merge.yml` workflow:
- Checks the update type (patch/minor/major)
- Verifies CI status
- Applies merge rules based on configuration

### 3. Merge Decision
- **Auto-approve**: Eligible PRs are automatically approved
- **Auto-merge**: Approved PRs are set to merge when CI passes
- **Label**: PRs are labeled based on their merge status

## Configuration Files

### 1. `.github/dependabot.yml`
Configures Dependabot update frequency and grouping:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    groups:
      development-dependencies:
        patterns: ["@types/*", "eslint*", "jest*"]
```

### 2. `.github/workflows/dependabot-auto-merge.yml`
Simple auto-merge workflow for basic scenarios

### 3. `.github/workflows/dependabot-advanced-auto-merge.yml`
Advanced workflow with:
- CI status checking
- Intelligent merge decisions
- Comprehensive labeling
- Safety checks

### 4. `.github/auto-merge.yml`
Configuration file defining merge rules and excluded packages

## Manual Intervention

### When Manual Review is Needed:
1. **Major version updates** - Check breaking changes
2. **Security updates** - Verify compatibility
3. **Failed CI checks** - Fix issues before merge
4. **Excluded packages** - Test thoroughly

### How to Manually Review:
```bash
# List Dependabot PRs
gh pr list --author dependabot

# Review a specific PR
gh pr view <PR_NUMBER>

# Check out PR locally
gh pr checkout <PR_NUMBER>

# Run tests
pnpm test

# Merge if satisfied
gh pr merge <PR_NUMBER>
```

## Monitoring

### GitHub Actions Tab
Monitor auto-merge activity:
- Check workflow runs
- Review merge decisions
- Investigate failures

### Notifications
You'll receive notifications for:
- PRs requiring manual review
- Failed auto-merge attempts
- Security updates

## Customization

### Modify Auto-Merge Rules
Edit `.github/auto-merge.yml`:
```yaml
merge_rules:
  - match:
      update_type: "patch"
      dependency_type: "all"
    merge_method: "merge"
```

### Add Package Exclusions
```yaml
excluded_packages:
  - "package-name"
  - "@scope/*"
```

### Adjust CI Requirements
Modify required status checks in the workflow

## Troubleshooting

### PR Not Auto-Merging
1. Check CI status - all checks must pass
2. Verify update type - only configured types auto-merge
3. Check excluded packages list
4. Review workflow logs

### Auto-Merge Disabled
Run the setup script:
```bash
./scripts/setup-branch-protection.sh
```

Or enable manually:
- Settings → General → Pull Requests
- Check "Allow auto-merge"

### Workflow Not Triggering
- Ensure workflows have correct permissions
- Check Dependabot has access to workflows
- Verify GITHUB_TOKEN permissions

## Security Considerations

1. **Review Security Updates**: Even with auto-merge, security updates are flagged for priority review
2. **Limit Permissions**: Workflows use minimal required permissions
3. **Audit Trail**: All auto-merges are logged in GitHub Actions
4. **Rollback Plan**: Keep previous versions in git history for quick rollback

## Best Practices

1. **Regular Monitoring**: Check auto-merged PRs weekly
2. **Test Suite**: Maintain comprehensive tests to catch issues
3. **Gradual Rollout**: Start with conservative rules, expand over time
4. **Documentation**: Update this doc when changing configuration
5. **Team Communication**: Inform team of auto-merge policies

## Future Enhancements

Consider implementing:
1. Slack/Discord notifications for auto-merge events
2. Custom merge strategies per package
3. Automatic rollback on test failures
4. Integration with security scanning tools