#!/bin/bash

# Script to make repositories private (requires GitHub paid plan for >3 private repos)

echo "🔒 Make Repositories Private Script"
echo "==================================="
echo ""
echo "⚠️  WARNING: GitHub Free only allows 3 private repositories!"
echo "   You need GitHub Pro/Team/Enterprise for unlimited private repos."
echo ""

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Error: You need to authenticate with GitHub CLI first."
    echo "Run: gh auth login"
    exit 1
fi

# Get all archived repositories
repos=$(gh repo list GontrandL --limit 200 --json name,isArchived,visibility --jq '.[] | select(.isArchived == true and .visibility == "public") | .name')

# Count repositories
total_repos=$(echo "$repos" | wc -l)

echo "📋 Found $total_repos archived public repositories"
echo ""
echo "🔍 Repositories that will be made private:"
echo "────────────────────────────────────────"
echo "$repos" | sed 's/^/  - /'
echo ""

# Confirm before proceeding
read -p "⚠️  Do you have a GitHub paid plan and want to make these repos private? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Operation cancelled."
    exit 1
fi

echo ""
echo "🚀 Starting privacy update..."
echo ""

# Make each repository private
success_count=0
failed_count=0

while IFS= read -r repo; do
    echo -n "🔒 Making $repo private... "
    
    if gh api -X PATCH repos/GontrandL/$repo -f private=true &>/dev/null; then
        echo "✅ Done"
        ((success_count++))
    else
        echo "❌ Failed"
        ((failed_count++))
    fi
done <<< "$repos"

echo ""
echo "═══════════════════════════════════════"
echo "✅ Process complete!"
echo ""
echo "📊 Results:"
echo "  - Successfully made private: $success_count repositories"
echo "  - Failed: $failed_count repositories"
echo ""
echo "💡 Note: If you hit the private repo limit, consider:"
echo "  - Upgrading to GitHub Pro for unlimited private repos"
echo "  - Deleting old repos you no longer need"
echo "  - Creating an organization to move archived projects"