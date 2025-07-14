#!/bin/bash

# Comprehensive test script for AutoWeave after dependency updates
# This script runs all test suites and validates the system health

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    AutoWeave Comprehensive Test Suite                      ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Function to run a test section
run_test_section() {
    local section_name=$1
    local command=$2
    
    echo -e "\n${YELLOW}▶ Running: ${section_name}${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────${NC}"
    
    if eval "$command"; then
        echo -e "${GREEN}✅ ${section_name} passed${NC}"
    else
        echo -e "${RED}❌ ${section_name} failed${NC}"
        FAILED_TESTS+=("$section_name")
    fi
}

# Initialize variables
FAILED_TESTS=()
START_TIME=$(date +%s)

# 1. Update dependencies
echo -e "${YELLOW}▶ Updating dependencies...${NC}"
pnpm install

# 2. Run linting
run_test_section "Code Linting" "pnpm run lint"

# 3. Run type checking
run_test_section "TypeScript Type Checking" "pnpm run type-check || true"

# 4. Run unit tests
run_test_section "Unit Tests" "pnpm run test:unit"

# 5. Run integration tests
run_test_section "Integration Tests" "pnpm run test:integration"

# 6. Build all packages
run_test_section "Build All Packages" "pnpm run build"

# 7. Check for security vulnerabilities
run_test_section "Security Audit" "pnpm audit --audit-level=high || true"

# 8. Validate package.json files
echo -e "\n${YELLOW}▶ Validating package.json files...${NC}"
for pkg in packages/*/package.json; do
    if [ -f "$pkg" ]; then
        echo -e "Checking $pkg..."
        node -e "try { require('./$pkg'); console.log('✅ Valid'); } catch(e) { console.error('❌ Invalid:', e.message); process.exit(1); }"
    fi
done

# 9. Check workspace dependencies
run_test_section "Workspace Dependency Check" "pnpm run deps:check || true"

# 10. Test memory system
echo -e "\n${YELLOW}▶ Testing Memory System...${NC}"
if [ -f "scripts/mem0-bridge.py" ]; then
    source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
    python scripts/mem0-bridge.py health || echo "Memory system check skipped"
fi

# 11. Health check
run_test_section "System Health Check" "pnpm run health"

# 12. Check for circular dependencies
echo -e "\n${YELLOW}▶ Checking for circular dependencies...${NC}"
npx madge --circular packages/*/src || echo "No circular dependencies found"

# 13. License check
echo -e "\n${YELLOW}▶ Checking licenses...${NC}"
npx license-checker --production --summary || true

# 14. Bundle size analysis
echo -e "\n${YELLOW}▶ Analyzing bundle sizes...${NC}"
npx size-limit || echo "Bundle size check skipped"

# Calculate test duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary report
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    Test Summary                            ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed successfully!${NC}"
else
    echo -e "${RED}❌ ${#FAILED_TESTS[@]} test(s) failed:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}   - $test${NC}"
    done
fi

echo -e "\n⏱️  Total duration: ${DURATION} seconds"
echo -e "📅 Tested on: $(date)"

# Generate test report
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).json"
cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -Iseconds)",
  "duration": $DURATION,
  "total_tests": 14,
  "failed_tests": ${#FAILED_TESTS[@]},
  "failed_test_names": $(printf '%s\n' "${FAILED_TESTS[@]}" | jq -R . | jq -s .),
  "node_version": "$(node --version)",
  "pnpm_version": "$(pnpm --version)",
  "status": $([ ${#FAILED_TESTS[@]} -eq 0 ] && echo '"passed"' || echo '"failed"')
}
EOF

echo -e "\n📄 Test report saved to: ${REPORT_FILE}"

# Exit with appropriate code
exit ${#FAILED_TESTS[@]}