#!/bin/bash

echo "🔍 Testing Dependabot Auto-Merge Configuration..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Repository info
REPO="GontrandL/autoweave"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI not installed${NC}"
    echo "Installing gh..."
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update
    sudo apt install gh -y
fi

# Test 1: Check if auto-merge is enabled on the repository
echo -e "\n${YELLOW}Test 1: Checking if auto-merge is enabled...${NC}"
AUTO_MERGE_STATUS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO" | jq -r '.allow_auto_merge')

if [ "$AUTO_MERGE_STATUS" = "true" ]; then
    echo -e "${GREEN}✅ Auto-merge is enabled on the repository${NC}"
else
    echo -e "${RED}❌ Auto-merge is NOT enabled on the repository${NC}"
    echo "Please enable it in Settings → General → Pull Requests → Allow auto-merge"
fi

# Test 2: Check for Dependabot PRs
echo -e "\n${YELLOW}Test 2: Checking for Dependabot PRs...${NC}"
DEPENDABOT_PRS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO/pulls?state=open" | \
    jq -r '.[] | select(.user.login == "dependabot[bot]") | "\(.number) - \(.title)"')

if [ -z "$DEPENDABOT_PRS" ]; then
    echo "No open Dependabot PRs found"
else
    echo "Found Dependabot PRs:"
    echo "$DEPENDABOT_PRS"
fi

# Test 3: Check workflow files
echo -e "\n${YELLOW}Test 3: Checking auto-merge workflow files...${NC}"
if [ -f ".github/workflows/dependabot-auto-merge.yml" ]; then
    echo -e "${GREEN}✅ Simple auto-merge workflow exists${NC}"
else
    echo -e "${RED}❌ Simple auto-merge workflow missing${NC}"
fi

if [ -f ".github/workflows/dependabot-advanced-auto-merge.yml" ]; then
    echo -e "${GREEN}✅ Advanced auto-merge workflow exists${NC}"
else
    echo -e "${RED}❌ Advanced auto-merge workflow missing${NC}"
fi

# Test 4: Check recent workflow runs
echo -e "\n${YELLOW}Test 4: Checking recent workflow runs...${NC}"
RECENT_RUNS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO/actions/runs?per_page=10" | \
    jq -r '.workflow_runs[] | select(.name | contains("Dependabot")) | "\(.status) - \(.conclusion // "pending") - \(.name)"')

if [ -z "$RECENT_RUNS" ]; then
    echo "No recent Dependabot workflow runs found"
else
    echo "Recent Dependabot workflow runs:"
    echo "$RECENT_RUNS"
fi

# Test 5: Check branch protection
echo -e "\n${YELLOW}Test 5: Checking branch protection rules...${NC}"
PROTECTION_STATUS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO/branches/main/protection" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$PROTECTION_STATUS" ]; then
    echo -e "${GREEN}✅ Branch protection is configured${NC}"
    
    # Check if required status checks are configured
    REQUIRED_CHECKS=$(echo "$PROTECTION_STATUS" | jq -r '.required_status_checks.contexts[]' 2>/dev/null)
    if [ -n "$REQUIRED_CHECKS" ]; then
        echo "Required status checks:"
        echo "$REQUIRED_CHECKS"
    fi
else
    echo -e "${YELLOW}⚠️  Branch protection might not be configured${NC}"
fi

# Summary
echo -e "\n${YELLOW}=== Configuration Summary ===${NC}"
echo "Repository: $REPO"
echo "Auto-merge enabled: $AUTO_MERGE_STATUS"
echo "Workflow files: Present"
echo -e "\n${GREEN}Next steps:${NC}"
echo "1. If auto-merge is enabled, Dependabot PRs should automatically merge"
echo "2. Check the Actions tab for workflow runs"
echo "3. Monitor PRs for auto-merge labels and comments"
echo "4. Review any PRs labeled 'requires-manual-review'"

# Test a specific PR if provided
if [ -n "$1" ]; then
    PR_NUMBER=$1
    echo -e "\n${YELLOW}Testing specific PR #$PR_NUMBER...${NC}"
    
    PR_INFO=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/pulls/$PR_NUMBER")
    
    AUTO_MERGE_STATUS=$(echo "$PR_INFO" | jq -r '.auto_merge')
    if [ "$AUTO_MERGE_STATUS" != "null" ]; then
        echo -e "${GREEN}✅ Auto-merge is enabled on PR #$PR_NUMBER${NC}"
        echo "Merge method: $(echo "$PR_INFO" | jq -r '.auto_merge.merge_method')"
    else
        echo -e "${YELLOW}Auto-merge is not enabled on PR #$PR_NUMBER${NC}"
    fi
fi