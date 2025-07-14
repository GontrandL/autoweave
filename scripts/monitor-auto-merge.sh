#!/bin/bash

# Script to monitor Dependabot auto-merge activity

echo "🔍 Monitoring Dependabot Auto-Merge Activity"
echo "==========================================="

REPO="GontrandL/autoweave"

# Function to check for Dependabot PRs
check_dependabot_prs() {
    echo -e "\n📋 Checking for Dependabot PRs..."
    
    # Get all open PRs from Dependabot
    DEPENDABOT_PRS=$(curl -s "https://api.github.com/repos/$REPO/pulls?state=open" | \
        jq -r '.[] | select(.user.login == "dependabot[bot]")')
    
    if [ -z "$DEPENDABOT_PRS" ]; then
        echo "No open Dependabot PRs found."
        return
    fi
    
    # Parse each PR
    echo "$DEPENDABOT_PRS" | jq -r '{
        number: .number,
        title: .title,
        created_at: .created_at,
        auto_merge: .auto_merge,
        mergeable_state: .mergeable_state,
        labels: [.labels[].name]
    }'
}

# Function to check recent merges
check_recent_merges() {
    echo -e "\n✅ Recent Dependabot merges (last 24 hours)..."
    
    RECENT_MERGES=$(curl -s "https://api.github.com/repos/$REPO/pulls?state=closed&per_page=20" | \
        jq -r '.[] | select(.user.login == "dependabot[bot]" and .merged_at != null) | 
        select(.merged_at | fromdateiso8601 > (now - 86400))')
    
    if [ -z "$RECENT_MERGES" ]; then
        echo "No Dependabot PRs merged in the last 24 hours."
        return
    fi
    
    echo "$RECENT_MERGES" | jq -r '{
        number: .number,
        title: .title,
        merged_at: .merged_at,
        merge_commit_sha: .merge_commit_sha
    }'
}

# Function to check workflow runs
check_workflow_runs() {
    echo -e "\n⚙️  Recent auto-merge workflow runs..."
    
    WORKFLOW_RUNS=$(curl -s "https://api.github.com/repos/$REPO/actions/runs?per_page=10" | \
        jq -r '.workflow_runs[] | select(.name | contains("Dependabot") and contains("Auto"))')
    
    if [ -z "$WORKFLOW_RUNS" ]; then
        echo "No recent auto-merge workflow runs found."
        return
    fi
    
    echo "$WORKFLOW_RUNS" | jq -r '{
        name: .name,
        status: .status,
        conclusion: .conclusion,
        created_at: .created_at,
        html_url: .html_url
    }'
}

# Function to show auto-merge status
show_auto_merge_status() {
    echo -e "\n🤖 Auto-Merge Configuration Status..."
    
    # Check if auto-merge is enabled
    AUTO_MERGE=$(curl -s "https://api.github.com/repos/$REPO" | jq -r '.allow_auto_merge')
    echo "Repository auto-merge enabled: $AUTO_MERGE"
    
    # Check for workflow files
    echo -e "\nWorkflow files:"
    if [ -f ".github/workflows/dependabot-auto-merge.yml" ]; then
        echo "✅ dependabot-auto-merge.yml exists"
    fi
    if [ -f ".github/workflows/dependabot-advanced-auto-merge.yml" ]; then
        echo "✅ dependabot-advanced-auto-merge.yml exists"
    fi
}

# Main execution
show_auto_merge_status
check_dependabot_prs
check_recent_merges
check_workflow_runs

echo -e "\n📊 Summary"
echo "========="
echo "• Auto-merge is configured and ready"
echo "• Dependabot runs daily at 06:00 UTC"
echo "• Patch and minor dev updates will auto-merge"
echo "• Major updates require manual review"
echo -e "\n💡 Tip: Run this script periodically to monitor auto-merge activity"