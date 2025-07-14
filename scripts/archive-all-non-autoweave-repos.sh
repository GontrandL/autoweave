#!/bin/bash

# Script to archive ALL repositories except the main autoweave monorepo

echo "🗄️  Archive All Non-AutoWeave Repositories"
echo "=========================================="
echo ""

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Error: You need to authenticate with GitHub CLI first."
    echo "Run: gh auth login"
    exit 1
fi

echo "📊 Fetching repository list..."

# Get all repositories (non-archived only)
repos=$(gh repo list GontrandL --limit 200 --json name,isArchived,isFork --jq '.[] | select(.isArchived == false and .isFork == false) | .name')

# Count repositories
total_repos=$(echo "$repos" | wc -l)
repos_to_archive=$(echo "$repos" | grep -v "^autoweave$" | wc -l)

echo ""
echo "📋 Repository Summary:"
echo "  - Total active repositories: $total_repos"
echo "  - Repositories to archive: $repos_to_archive"
echo "  - Repository to keep: autoweave (monorepo)"
echo ""
echo "🔍 Repositories that will be archived:"
echo "────────────────────────────────────"
echo "$repos" | grep -v "^autoweave$" | sed 's/^/  - /'
echo ""

# Confirm before proceeding
read -p "⚠️  Are you sure you want to archive ALL repositories except 'autoweave'? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Archival cancelled."
    exit 1
fi

echo ""
echo "🚀 Starting archival process..."
echo ""

# Archive each repository except autoweave
archived_count=0
failed_count=0

while IFS= read -r repo; do
    # Skip the main autoweave repo
    if [ "$repo" = "autoweave" ]; then
        continue
    fi
    
    echo -n "📦 Archiving $repo... "
    
    # Archive the repository
    if gh api -X PATCH repos/GontrandL/$repo -f archived=true &>/dev/null; then
        echo "✅ Done"
        ((archived_count++))
    else
        echo "❌ Failed"
        ((failed_count++))
    fi
done <<< "$repos"

echo ""
echo "═══════════════════════════════════════"
echo "✅ Archival process complete!"
echo ""
echo "📊 Results:"
echo "  - Successfully archived: $archived_count repositories"
echo "  - Failed to archive: $failed_count repositories"
echo "  - Active repositories remaining: 1 (autoweave)"
echo ""
echo "💡 Tips:"
echo "  - Archived repositories are not deleted, just hidden from your main profile"
echo "  - You can still access them by adding '?tab=repositories&q=&type=archived' to your GitHub profile URL"
echo "  - To unarchive a specific repository:"
echo "    gh api -X PATCH repos/GontrandL/REPO_NAME -f archived=false"
echo "  - To see all archived repositories:"
echo "    gh repo list GontrandL --archived --limit 200"