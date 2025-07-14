#!/bin/bash

source "$(dirname "$0")/../dev/dev-helpers.sh"

log_info "Cleaning up AutoWeave test resources..."

# Clean up test resources
cleanup_test_resources

# Clean up test namespaces
log_info "Cleaning up test namespaces..."
kubectl delete namespace autoweave-test --ignore-not-found=true

log_success "Test resource cleanup complete!"