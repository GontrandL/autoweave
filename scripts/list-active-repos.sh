#!/bin/bash

# Quick script to list all active (non-archived) repositories

echo "📋 Active Repositories for GontrandL"
echo "===================================="
echo ""

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Error: You need to authenticate with GitHub CLI first."
    echo "Run: gh auth login"
    exit 1
fi

# List all non-archived repositories
echo "Fetching repository list..."
echo ""

gh repo list GontrandL --limit 200 --json name,description,updatedAt,isArchived,isFork,isPrivate \
  --jq '.[] | select(.isArchived == false) | "\(.name)\(if .isPrivate then " 🔒" else "" end)\(if .isFork then " 🍴" else "" end)\n  └─ \(.description // "No description")\n  └─ Updated: \(.updatedAt | split("T")[0])\n"'

# Count repositories
total_active=$(gh repo list GontrandL --limit 200 --json isArchived --jq '[.[] | select(.isArchived == false)] | length')
total_archived=$(gh repo list GontrandL --limit 200 --json isArchived --jq '[.[] | select(.isArchived == true)] | length')

echo "📊 Summary:"
echo "  - Active repositories: $total_active"
echo "  - Archived repositories: $total_archived"
echo "  - Total repositories: $((total_active + total_archived))"