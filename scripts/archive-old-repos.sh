#!/bin/bash

# Script to archive old AutoWeave repositories that are now part of the monorepo

echo "🗄️  AutoWeave Repository Archival Script"
echo "========================================"
echo ""
echo "This script will archive the following repositories:"
echo "- autoweave-backend"
echo "- autoweave-memory"
echo "- autoweave-deployment"
echo "- autoweave-cli"
echo "- autoweave-ui"
echo "- autoweave-agents"
echo "- autoweave-integrations"
echo "- autoweave-core"
echo ""

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Error: You need to authenticate with GitHub CLI first."
    echo "Run: gh auth login"
    exit 1
fi

# Confirm before proceeding
read -p "⚠️  Are you sure you want to archive these repositories? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Archival cancelled."
    exit 1
fi

# Array of repositories to archive
repos=(
    "autoweave-backend"
    "autoweave-memory"
    "autoweave-deployment"
    "autoweave-cli"
    "autoweave-ui"
    "autoweave-agents"
    "autoweave-integrations"
    "autoweave-core"
)

# Archive each repository
for repo in "${repos[@]}"; do
    echo -n "📦 Archiving $repo... "
    
    # Add archive notice to README if possible
    gh api -X PATCH repos/GontrandL/$repo \
        -f description="[ARCHIVED - Now part of autoweave monorepo] $(gh api repos/GontrandL/$repo --jq .description)" \
        2>/dev/null || true
    
    # Archive the repository
    if gh api -X PATCH repos/GontrandL/$repo -f archived=true &>/dev/null; then
        echo "✅ Done"
    else
        echo "❌ Failed"
    fi
done

echo ""
echo "✅ Archival process complete!"
echo ""
echo "📝 Next steps:"
echo "1. The main 'autoweave' repository is now your single source of truth"
echo "2. All old component repos have been archived"
echo "3. Contributors should now work only with the monorepo"
echo ""
echo "💡 To unarchive a repository if needed:"
echo "   gh api -X PATCH repos/GontrandL/REPO_NAME -f archived=false"