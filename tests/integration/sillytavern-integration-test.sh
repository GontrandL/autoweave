#!/bin/bash

# SillyTavern Integration Test
# Tests complete SillyTavern integration with AutoWeave

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AUTOWEAVE_URL="http://172.19.0.1:3000"
SILLYTAVERN_URL="http://localhost:8081"
NAMESPACE="autoweave-system"
TEST_RESULTS=()

echo -e "${BLUE}🤖 SillyTavern Integration Test${NC}"
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

# Test 1: SillyTavern Pod Status
echo -e "\n${BLUE}🔍 Testing SillyTavern Deployment${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} SillyTavern pod status"
if pod_status=$(kubectl get pods -n $NAMESPACE -l app=sillytavern -o jsonpath='{.items[0].status.phase}' 2>/dev/null); then
    if [ "$pod_status" = "Running" ]; then
        pod_ready=$(kubectl get pods -n $NAMESPACE -l app=sillytavern -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)
        if [ "$pod_ready" = "True" ]; then
            log_test "SillyTavern Pod Running" "PASS" "Pod status: $pod_status, Ready: $pod_ready"
        else
            log_test "SillyTavern Pod Running" "FAIL" "Pod status: $pod_status, Ready: $pod_ready"
        fi
    else
        log_test "SillyTavern Pod Running" "FAIL" "Pod status: $pod_status"
    fi
else
    log_test "SillyTavern Pod Running" "FAIL" "Pod not found"
fi

# Test 2: SillyTavern UI Access
echo -e "\n${BLUE}🌐 Testing SillyTavern UI Access${NC}"
echo "----------------------------------------"
test_endpoint "SillyTavern UI Access" "$SILLYTAVERN_URL" "200" "SillyTavern web interface"

# Test 3: AutoWeave API from SillyTavern perspective
echo -e "\n${BLUE}🔗 Testing Network Connectivity${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} AutoWeave API connectivity from SillyTavern pod"
if kubectl exec -n $NAMESPACE -l app=sillytavern -- node -e "
const http = require('http');
const options = {
  hostname: '172.19.0.1',
  port: 3000,
  path: '/health',
  method: 'GET'
};
const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('SUCCESS');
  } else {
    console.log('FAIL');
  }
});
req.on('error', () => {
  console.log('ERROR');
});
req.end();
" 2>/dev/null | grep -q "SUCCESS"; then
    log_test "AutoWeave API Connectivity" "PASS" "Pod can reach AutoWeave API"
else
    log_test "AutoWeave API Connectivity" "FAIL" "Pod cannot reach AutoWeave API"
fi

# Test 4: Extension Installation
echo -e "\n${BLUE}🧩 Testing Extension Installation${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} Extension files in SillyTavern pod"
if kubectl exec -n $NAMESPACE -l app=sillytavern -- test -f /app/public/scripts/extensions/autoweave-extension.js 2>/dev/null; then
    extension_size=$(kubectl exec -n $NAMESPACE -l app=sillytavern -- wc -c < /app/public/scripts/extensions/autoweave-extension.js 2>/dev/null)
    log_test "Extension File Installation" "PASS" "Extension size: $extension_size bytes"
else
    log_test "Extension File Installation" "FAIL" "Extension file not found"
fi

# Test 5: Chat API Integration
echo -e "\n${BLUE}💬 Testing Chat API Integration${NC}"
echo "----------------------------------------"
test_post_endpoint "Chat API Integration" "$AUTOWEAVE_URL/api/chat" '{"messages":[{"role":"user","content":"Hello from SillyTavern test"}]}' "200" "Chat API with SillyTavern format"

# Test 6: Agent Creation via Chat
test_post_endpoint "Agent Creation via Chat" "$AUTOWEAVE_URL/api/chat" '{"messages":[{"role":"user","content":"create agent for SillyTavern integration test"}]}' "200" "Create agent through chat interface"

# Test 7: Agent Listing
echo -e "\n${BLUE}📋 Testing Agent Management${NC}"
echo "----------------------------------------"
test_endpoint "Agent Listing" "$AUTOWEAVE_URL/api/agents" "200" "List all agents"

# Test 8: Extension Configuration
echo -e "\n${BLUE}⚙️ Testing Extension Configuration${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} Extension configuration file"
if kubectl exec -n $NAMESPACE -l app=sillytavern -- test -f /app/public/scripts/extensions/autoweave-manifest.json 2>/dev/null; then
    log_test "Extension Configuration" "PASS" "Manifest file exists"
else
    log_test "Extension Configuration" "FAIL" "Manifest file not found"
fi

# Test 9: CORS Configuration
echo -e "\n${BLUE}🔐 Testing CORS Configuration${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} CORS headers for SillyTavern requests"
if cors_headers=$(curl -s -H "Origin: http://localhost:8081" -I "$AUTOWEAVE_URL/health" 2>/dev/null | grep -i "access-control-allow-origin"); then
    log_test "CORS Configuration" "PASS" "CORS headers present"
else
    log_test "CORS Configuration" "FAIL" "CORS headers missing"
fi

# Test 10: End-to-End Workflow
echo -e "\n${BLUE}🔄 Testing End-to-End Workflow${NC}"
echo "----------------------------------------"
echo -e "${YELLOW}Testing:${NC} Complete SillyTavern to AutoWeave workflow"

# Create a unique agent name with timestamp
TIMESTAMP=$(date +%s)
AGENT_NAME="e2e-test-$TIMESTAMP"

if response=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"create agent for $AGENT_NAME\"}]}" "$AUTOWEAVE_URL/api/chat" 2>/dev/null); then
    if echo "$response" | grep -q "created successfully"; then
        log_test "End-to-End Workflow" "PASS" "Agent created successfully via chat"
    else
        log_test "End-to-End Workflow" "FAIL" "Agent creation failed"
    fi
else
    log_test "End-to-End Workflow" "FAIL" "End-to-end test failed"
fi

# Test Summary
echo -e "\n${BLUE}📊 SillyTavern Integration Test Summary${NC}"
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
    echo -e "\n${GREEN}🎉 ALL SILLYTAVERN INTEGRATION TESTS PASSED!${NC}"
    echo -e "${GREEN}SillyTavern is fully integrated with AutoWeave.${NC}"
    exit 0
elif [ $pass_percentage -ge 80 ]; then
    echo -e "\n${YELLOW}⚠️ Most SillyTavern integration tests passed ($pass_percentage%).${NC}"
    echo -e "${YELLOW}Some components may need attention.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ SillyTavern integration test failed.${NC}"
    echo -e "${RED}Multiple components need attention.${NC}"
    exit 1
fi