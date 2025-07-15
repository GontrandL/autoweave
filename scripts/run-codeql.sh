#!/bin/bash

# Script to run CodeQL analysis locally
# Requires CodeQL CLI to be installed

set -e

echo "🔍 Running CodeQL Security Analysis for AutoWeave..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if CodeQL is installed
if ! command -v codeql &> /dev/null; then
    echo -e "${RED}❌ CodeQL CLI is not installed${NC}"
    echo "Please install CodeQL CLI from: https://github.com/github/codeql-cli-binaries"
    exit 1
fi

# Create database directory
DB_DIR="codeql-db"
RESULTS_DIR="codeql-results"

# Clean up previous runs
rm -rf $DB_DIR $RESULTS_DIR
mkdir -p $RESULTS_DIR

# Create CodeQL database for JavaScript/TypeScript
echo -e "${YELLOW}📦 Creating CodeQL database...${NC}"
codeql database create $DB_DIR \
    --language=javascript \
    --source-root=. \
    --overwrite

# Run security queries
echo -e "${YELLOW}🔐 Running security analysis...${NC}"
codeql database analyze $DB_DIR \
    --format=sarif-latest \
    --output=$RESULTS_DIR/security-results.sarif \
    --sarif-add-baseline-file-info \
    javascript-security-extended \
    .github/codeql-queries/

# Run quality queries
echo -e "${YELLOW}✨ Running code quality analysis...${NC}"
codeql database analyze $DB_DIR \
    --format=sarif-latest \
    --output=$RESULTS_DIR/quality-results.sarif \
    --sarif-add-baseline-file-info \
    javascript-code-scanning

# Convert SARIF to readable format
echo -e "${YELLOW}📊 Generating human-readable report...${NC}"
if command -v jq &> /dev/null; then
    # Extract issues from SARIF
    jq -r '.runs[0].results[] | "[\(.level | ascii_upcase)] \(.ruleId): \(.message.text) - \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine)"' \
        $RESULTS_DIR/security-results.sarif > $RESULTS_DIR/security-report.txt
    
    jq -r '.runs[0].results[] | "[\(.level | ascii_upcase)] \(.ruleId): \(.message.text) - \(.locations[0].physicalLocation.artifactLocation.uri):\(.locations[0].physicalLocation.region.startLine)"' \
        $RESULTS_DIR/quality-results.sarif > $RESULTS_DIR/quality-report.txt
    
    # Display summary
    echo -e "\n${GREEN}✅ Analysis Complete!${NC}\n"
    
    SECURITY_COUNT=$(wc -l < $RESULTS_DIR/security-report.txt)
    QUALITY_COUNT=$(wc -l < $RESULTS_DIR/quality-report.txt)
    
    echo "📊 Results Summary:"
    echo "   Security Issues: $SECURITY_COUNT"
    echo "   Quality Issues: $QUALITY_COUNT"
    
    if [ $SECURITY_COUNT -gt 0 ]; then
        echo -e "\n${RED}🔐 Security Issues:${NC}"
        head -10 $RESULTS_DIR/security-report.txt
        if [ $SECURITY_COUNT -gt 10 ]; then
            echo "... and $((SECURITY_COUNT - 10)) more"
        fi
    fi
    
    if [ $QUALITY_COUNT -gt 0 ]; then
        echo -e "\n${YELLOW}✨ Quality Issues:${NC}"
        head -10 $RESULTS_DIR/quality-report.txt
        if [ $QUALITY_COUNT -gt 10 ]; then
            echo "... and $((QUALITY_COUNT - 10)) more"
        fi
    fi
    
    echo -e "\n📁 Full reports available in: $RESULTS_DIR/"
else
    echo -e "${YELLOW}⚠️  Install jq for human-readable reports${NC}"
    echo "Raw SARIF results available in: $RESULTS_DIR/"
fi

# Clean up database
rm -rf $DB_DIR

# Exit with error if security issues found
if [ $SECURITY_COUNT -gt 0 ]; then
    exit 1
fi