#!/bin/bash

# Script to set up branch protection rules for Dependabot auto-merge
# This configures GitHub branch protection to allow auto-merge while maintaining security

echo "🔒 Setting up branch protection rules for Dependabot auto-merge..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    echo "Visit: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

# Repository information
REPO="GontrandL/autoweave"
BRANCH="main"

echo "📋 Configuring branch protection for $REPO:$BRANCH"

# Create branch protection rules
# Note: This requires admin access to the repository
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$REPO/branches/$BRANCH/protection" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[contexts][]=Build and Test (18.x)" \
  -f "required_status_checks[contexts][]=Build and Test (20.x)" \
  -f "required_status_checks[contexts][]=Security Scan" \
  -f "enforce_admins=false" \
  -f "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -f "required_pull_request_reviews[require_code_owner_reviews]=false" \
  -f "required_pull_request_reviews[required_approving_review_count]=0" \
  -f "required_pull_request_reviews[require_last_push_approval]=false" \
  -f "restrictions=null" \
  -f "allow_force_pushes=false" \
  -f "allow_deletions=false" \
  -f "block_creations=false" \
  -f "required_conversation_resolution=true" \
  -f "lock_branch=false" \
  -f "allow_fork_syncing=true"

if [ $? -eq 0 ]; then
    echo "✅ Branch protection rules configured successfully!"
else
    echo "❌ Failed to configure branch protection rules."
    echo "You may need to configure these manually in GitHub Settings > Branches"
    exit 1
fi

# Enable auto-merge for the repository
echo "🤖 Enabling auto-merge for the repository..."
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/$REPO" \
  -f "allow_auto_merge=true"

if [ $? -eq 0 ]; then
    echo "✅ Auto-merge enabled for the repository!"
else
    echo "⚠️  Failed to enable auto-merge. You may need to enable it manually in Settings."
fi

echo "
📌 Branch Protection Configuration Summary:
- Required status checks: CI/CD must pass
- Dismiss stale reviews: Enabled
- Required approving reviews: 0 (allows Dependabot to auto-merge)
- Enforce admins: Disabled (allows automation)
- Auto-merge: Enabled

🎯 Next Steps:
1. Dependabot PRs will now auto-merge for patch updates
2. Minor dev dependency updates will also auto-merge
3. Major updates will be labeled for manual review
4. Monitor the Actions tab for auto-merge activity

💡 Tips:
- You can always disable auto-merge for specific PRs
- Check the 'dependabot-auto-merge' workflow for merge decisions
- Review the auto-merge.yml file to customize behavior
"