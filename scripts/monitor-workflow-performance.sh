#!/bin/bash

# Script to monitor auto-merge workflow performance and generate reports

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="GontrandL/autoweave"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Auto-Merge Workflow Performance Monitor                 ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Function to get workflow metrics
get_workflow_metrics() {
    local workflow_name=$1
    local days_back=${2:-7}
    
    echo -e "\n${YELLOW}📊 Analyzing: $workflow_name (last $days_back days)${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────${NC}"
    
    # Calculate date range
    local since_date=$(date -d "$days_back days ago" -Iseconds)
    
    # Fetch workflow runs
    local runs=$(curl -s "https://api.github.com/repos/$REPO/actions/workflows" | \
        jq -r ".workflows[] | select(.name == \"$workflow_name\") | .id" | \
        xargs -I {} curl -s "https://api.github.com/repos/$REPO/actions/workflows/{}/runs?created=>=$since_date")
    
    if [ -z "$runs" ] || [ "$runs" = "null" ]; then
        echo "No runs found for this workflow in the specified period."
        return
    fi
    
    # Calculate metrics
    local total_runs=$(echo "$runs" | jq '.total_count // 0')
    local successful_runs=$(echo "$runs" | jq '[.workflow_runs[] | select(.conclusion == "success")] | length')
    local failed_runs=$(echo "$runs" | jq '[.workflow_runs[] | select(.conclusion == "failure")] | length')
    local cancelled_runs=$(echo "$runs" | jq '[.workflow_runs[] | select(.conclusion == "cancelled")] | length')
    
    # Calculate average duration for successful runs
    local avg_duration=$(echo "$runs" | jq -r '[.workflow_runs[] | select(.conclusion == "success") | ((.updated_at | fromdateiso8601) - (.created_at | fromdateiso8601))] | if length > 0 then (add / length) else 0 end')
    
    # Success rate
    local success_rate=0
    if [ "$total_runs" -gt 0 ]; then
        success_rate=$(echo "scale=2; $successful_runs * 100 / $total_runs" | bc)
    fi
    
    # Display metrics
    echo "Total runs: $total_runs"
    echo "Successful: $successful_runs (${success_rate}%)"
    echo "Failed: $failed_runs"
    echo "Cancelled: $cancelled_runs"
    echo "Average duration: $(printf "%.0f" $avg_duration) seconds"
    
    # Recent runs details
    echo -e "\n${YELLOW}Recent runs:${NC}"
    echo "$runs" | jq -r '.workflow_runs[0:5] | .[] | "\(.created_at | split("T")[0]) - \(.status) - \(.conclusion // "pending") - \(.head_commit.message | split("\n")[0])"'
}

# Function to analyze Dependabot PR metrics
analyze_dependabot_metrics() {
    echo -e "\n${YELLOW}📈 Dependabot PR Metrics${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────${NC}"
    
    # Get merged Dependabot PRs from last 30 days
    local since_date=$(date -d "30 days ago" -Iseconds)
    local merged_prs=$(curl -s "https://api.github.com/repos/$REPO/pulls?state=closed&per_page=100" | \
        jq -r --arg since "$since_date" '.[] | select(.user.login == "dependabot[bot]" and .merged_at != null and (.merged_at | fromdateiso8601) > ($since | fromdateiso8601))')
    
    if [ -z "$merged_prs" ]; then
        echo "No merged Dependabot PRs in the last 30 days."
        return
    fi
    
    # Calculate metrics
    local total_merged=$(echo "$merged_prs" | jq -s 'length')
    local auto_merged=$(echo "$merged_prs" | jq -s '[.[] | select(.labels[].name == "auto-merge-enabled")] | length')
    local manual_merged=$((total_merged - auto_merged))
    
    # Average time to merge
    local avg_merge_time=$(echo "$merged_prs" | jq -s 'map(((.merged_at | fromdateiso8601) - (.created_at | fromdateiso8601)) / 3600) | if length > 0 then (add / length) else 0 end')
    
    # Update type distribution
    local patch_updates=$(echo "$merged_prs" | jq -s '[.[] | select(.labels[].name == "patch-update")] | length')
    local minor_updates=$(echo "$merged_prs" | jq -s '[.[] | select(.labels[].name == "minor-update")] | length')
    local major_updates=$(echo "$merged_prs" | jq -s '[.[] | select(.labels[].name == "major-update")] | length')
    
    echo "Total merged PRs: $total_merged"
    echo "Auto-merged: $auto_merged"
    echo "Manually merged: $manual_merged"
    echo "Average time to merge: $(printf "%.1f" $avg_merge_time) hours"
    echo ""
    echo "Update types:"
    echo "  Patch: $patch_updates"
    echo "  Minor: $minor_updates"
    echo "  Major: $major_updates"
}

# Function to check current system status
check_system_status() {
    echo -e "\n${YELLOW}🔍 Current System Status${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────${NC}"
    
    # Check auto-merge setting
    local auto_merge_enabled=$(curl -s "https://api.github.com/repos/$REPO" | jq -r '.allow_auto_merge // false')
    echo "Auto-merge enabled: $auto_merge_enabled"
    
    # Check for pending Dependabot PRs
    local pending_prs=$(curl -s "https://api.github.com/repos/$REPO/pulls?state=open" | \
        jq -r '.[] | select(.user.login == "dependabot[bot]") | .number' | wc -l)
    echo "Pending Dependabot PRs: $pending_prs"
    
    # Check workflow file status
    echo -e "\nWorkflow files:"
    for workflow in "dependabot-auto-merge.yml" "dependabot-advanced-auto-merge.yml"; do
        if curl -s "https://api.github.com/repos/$REPO/contents/.github/workflows/$workflow" | grep -q "download_url"; then
            echo "  ✅ $workflow"
        else
            echo "  ❌ $workflow (missing)"
        fi
    done
}

# Function to generate performance report
generate_performance_report() {
    local report_file="workflow-performance-report-$(date +%Y%m%d-%H%M%S).json"
    
    echo -e "\n${YELLOW}📄 Generating performance report...${NC}"
    
    # Collect all metrics
    cat > "$report_file" << EOF
{
  "report_timestamp": "$(date -Iseconds)",
  "repository": "$REPO",
  "monitoring_period_days": 7,
  "workflows_monitored": [
    "Dependabot Auto-Merge",
    "Dependabot Advanced Auto-Merge"
  ],
  "auto_merge_enabled": $(curl -s "https://api.github.com/repos/$REPO" | jq '.allow_auto_merge // false'),
  "metrics_collected": true
}
EOF
    
    echo -e "${GREEN}✅ Report saved to: $report_file${NC}"
}

# Main execution
echo -e "\n${BLUE}1. Workflow Performance Analysis${NC}"
get_workflow_metrics "Dependabot Auto-Merge" 7
get_workflow_metrics "Dependabot Advanced Auto-Merge" 7

echo -e "\n${BLUE}2. Dependabot PR Analysis${NC}"
analyze_dependabot_metrics

echo -e "\n${BLUE}3. System Status Check${NC}"
check_system_status

echo -e "\n${BLUE}4. Performance Report${NC}"
generate_performance_report

# Recommendations
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    Recommendations                         ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${GREEN}✅ Actions to maintain optimal performance:${NC}"
echo "1. Review failed workflow runs weekly"
echo "2. Update exclusion list based on problematic updates"
echo "3. Monitor average merge times"
echo "4. Check for stuck PRs that should have auto-merged"
echo "5. Review security updates promptly"

echo -e "\n${YELLOW}📊 Performance benchmarks:${NC}"
echo "• Target success rate: >95%"
echo "• Target merge time: <2 hours for patch updates"
echo "• Target auto-merge rate: >80% for eligible updates"

echo -e "\n${BLUE}💡 Tip: Schedule this script to run weekly for continuous monitoring${NC}"