#!/bin/bash

# AutoWeave Full Integration Test
# Tests complete functionality with real APIs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUTOWEAVE_URL="http://localhost:3000"
APPSMITH_URL="http://localhost:8080"
TEST_RESULTS=()

echo -e "${BLUE}🚀 AutoWeave Full Integration Test${NC}"
echo "============================================="

# Function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ [PASS]${NC} $test_name"
        [ -n "$message" ] && echo "    $message"
        TEST_RESULTS+=("PASS:$test_name")
    else
        echo -e "${RED}❌ [FAIL]${NC} $test_name"
        [ -n "$message" ] && echo "    $message"
        TEST_RESULTS+=("FAIL:$test_name")
    fi
}

# Function to test HTTP endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local description="$4"
    
    echo -e "${YELLOW}Testing:${NC} $description"
    
    if response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        body="${response%???}"
        
        if [ "$status_code" = "$expected_status" ]; then
            log_test "$name" "PASS" "Status: $status_code"
            return 0
        else
            log_test "$name" "FAIL" "Expected: $expected_status, Got: $status_code"
            return 1
        fi
    else
        log_test "$name" "FAIL" "Connection failed"
        return 1
    fi
}

# Function to test POST endpoint
test_post_endpoint() {
    local name="$1"
    local url="$2"
    local data="$3"
    local expected_status="$4"
    local description="$5"
    
    echo -e "${YELLOW}Testing:${NC} $description"
    
    if response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        body="${response%???}"
        
        if [ "$status_code" = "$expected_status" ]; then
            log_test "$name" "PASS" "Status: $status_code"
            echo "    Response: ${body:0:100}..."
            return 0
        else
            log_test "$name" "FAIL" "Expected: $expected_status, Got: $status_code"
            return 1
        fi
    else
        log_test "$name" "FAIL" "Connection failed"
        return 1
    fi
}

# Test 1: AutoWeave Health Check
echo -e "\n${BLUE}📊 Testing AutoWeave Core API${NC}"
echo "----------------------------------------"
test_endpoint "AutoWeave Health" "$AUTOWEAVE_URL/health" "200" "AutoWeave health endpoint"

# Test 2: Agents List
test_endpoint "Agents List" "$AUTOWEAVE_URL/api/agents" "200" "Get list of agents"

# Test 3: Chat API with real AI
echo -e "\n${BLUE}🤖 Testing AI Chat Integration${NC}"
echo "----------------------------------------"
test_post_endpoint "Chat API" "$AUTOWEAVE_URL/api/chat" '{"messages":[{"role":"user","content":"Hello, test message"}]}' "200" "Chat with real AI"

# Test 4: Agent Creation via Chat
test_post_endpoint "Agent Creation Chat" "$AUTOWEAVE_URL/api/chat" '{"messages":[{"role":"user","content":"create agent for testing integration"}]}' "200" "Create agent via chat interface"

# Test 5: Direct Agent Creation
echo -e "\n${BLUE}⚙️ Testing Agent Management${NC}"
echo "----------------------------------------"
test_post_endpoint "Direct Agent Creation" "$AUTOWEAVE_URL/api/agents" '{"description":"test agent for integration"}' "200" "Create agent via direct API"

# Test 6: Verify agent was created
sleep 2  # Give time for agent creation
echo -e "${YELLOW}Testing:${NC} Verify agent creation"
if response=$(curl -s "$AUTOWEAVE_URL/api/agents" 2>/dev/null); then
    agent_count=$(echo "$response" | jq '. | length' 2>/dev/null || echo "0")
    if [ "$agent_count" -gt "0" ]; then
        log_test "Agent Creation Verification" "PASS" "Found $agent_count agents"
    else
        log_test "Agent Creation Verification" "FAIL" "No agents found"
    fi
else
    log_test "Agent Creation Verification" "FAIL" "Could not verify agents"
fi

# Test 7: Kubernetes Cluster Health
echo -e "\n${BLUE}☸️ Testing Kubernetes Integration${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} Kubernetes cluster connectivity"
if kubectl cluster-info >/dev/null 2>&1; then
    log_test "Kubernetes Connectivity" "PASS" "Cluster accessible"
else
    log_test "Kubernetes Connectivity" "FAIL" "Cannot connect to cluster"
fi

# Test 8: AutoWeave Pod Status
echo -e "${YELLOW}Testing:${NC} AutoWeave namespace and pods"
if kubectl get namespace autoweave-system >/dev/null 2>&1; then
    pod_count=$(kubectl get pods -n autoweave-system --no-headers 2>/dev/null | wc -l)
    log_test "AutoWeave Namespace" "PASS" "Found $pod_count pods"
else
    log_test "AutoWeave Namespace" "FAIL" "Namespace not found"
fi

# Test 9: Appsmith Connectivity
echo -e "\n${BLUE}📱 Testing Appsmith Integration${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} Appsmith service availability"
if kubectl get pods -n appsmith-system -l app.kubernetes.io/name=appsmith >/dev/null 2>&1; then
    appsmith_status=$(kubectl get pods -n appsmith-system -l app.kubernetes.io/name=appsmith -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Unknown")
    if [ "$appsmith_status" = "Running" ]; then
        log_test "Appsmith Service" "PASS" "Pod status: $appsmith_status"
    else
        log_test "Appsmith Service" "FAIL" "Pod status: $appsmith_status"
    fi
else
    log_test "Appsmith Service" "FAIL" "Appsmith pod not found"
fi

# Test 10: Extension Files
echo -e "\n${BLUE}🧩 Testing Extension Components${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} SillyTavern extension files"
if [ -f "/home/gontrand/AutoWeave/config/sillytavern/autoweave-extension.js" ]; then
    file_size=$(stat -c%s "/home/gontrand/AutoWeave/config/sillytavern/autoweave-extension.js")
    log_test "Extension File" "PASS" "Size: $file_size bytes"
else
    log_test "Extension File" "FAIL" "Extension file not found"
fi

# Test 11: Configuration Files
echo -e "${YELLOW}Testing:${NC} Environment configuration"
if [ -f "/home/gontrand/AutoWeave/.env" ]; then
    if grep -q "OPENAI_API_KEY=sk-" "/home/gontrand/AutoWeave/.env"; then
        log_test "API Keys Configuration" "PASS" "OpenAI key configured"
    else
        log_test "API Keys Configuration" "FAIL" "OpenAI key not properly configured"
    fi
else
    log_test "API Keys Configuration" "FAIL" ".env file not found"
fi

# Test 12: HTML Test Page
echo -e "${YELLOW}Testing:${NC} Extension test page"
if [ -f "/home/gontrand/AutoWeave/tests/extension/test-extension.html" ]; then
    log_test "Extension Test Page" "PASS" "Test page available"
else
    log_test "Extension Test Page" "FAIL" "Test page not found"
fi

# Test Summary
echo -e "\n${BLUE}📊 Test Summary${NC}"
echo "============================================="

pass_count=0
fail_count=0

for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == PASS:* ]]; then
        ((pass_count++))
    else
        ((fail_count++))
    fi
done

total_tests=$((pass_count + fail_count))
pass_percentage=$((pass_count * 100 / total_tests))

echo -e "Total Tests: $total_tests"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo -e "Success Rate: ${pass_percentage}%"

# Overall result
if [ $fail_count -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! AutoWeave integration is fully functional.${NC}"
    exit 0
elif [ $pass_percentage -ge 80 ]; then
    echo -e "\n${YELLOW}⚠️ Most tests passed ($pass_percentage%). Some components may need attention.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Integration test failed. Multiple components need attention.${NC}"
    exit 1
fi