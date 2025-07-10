#!/bin/bash
# Setup script for AutoWeave Memory System
# Deploys Memgraph and Qdrant to Kubernetes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_DIR/k8s/memory"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check Kind cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Kubernetes cluster is not accessible"
        exit 1
    fi
    
    # Check if autoweave context exists
    if ! kubectl config get-contexts | grep -q "kind-autoweave"; then
        log_error "AutoWeave Kind cluster not found"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Deploy namespace and configs
deploy_namespace() {
    log_info "Deploying memory namespace and configuration..."
    
    kubectl apply -f "$K8S_DIR/namespace.yaml"
    
    # Wait for namespace to be active
    kubectl wait --for=condition=Active namespace/autoweave-memory --timeout=30s
    
    log_success "Namespace and configuration deployed"
}

# Deploy Memgraph
deploy_memgraph() {
    log_info "Deploying Memgraph..."
    
    kubectl apply -f "$K8S_DIR/memgraph-deployment.yaml"
    
    # Wait for deployment to be ready
    log_info "Waiting for Memgraph deployment..."
    kubectl wait --for=condition=available deployment/memgraph -n autoweave-memory --timeout=300s
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=memgraph -n autoweave-memory --timeout=300s
    
    log_success "Memgraph deployed and ready"
}

# Deploy Qdrant
deploy_qdrant() {
    log_info "Deploying Qdrant..."
    
    kubectl apply -f "$K8S_DIR/qdrant-deployment.yaml"
    
    # Wait for deployment to be ready
    log_info "Waiting for Qdrant deployment..."
    kubectl wait --for=condition=available deployment/qdrant -n autoweave-memory --timeout=300s
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=qdrant -n autoweave-memory --timeout=300s
    
    log_success "Qdrant deployed and ready"
}

# Deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring components..."
    
    kubectl apply -f "$K8S_DIR/monitoring.yaml"
    
    log_success "Monitoring components deployed"
}

# Test connectivity
test_connectivity() {
    log_info "Testing memory system connectivity..."
    
    # Test Memgraph connection
    log_info "Testing Memgraph connectivity..."
    if kubectl exec -n autoweave-memory deployment/memgraph -- sh -c "echo 'RETURN 1;' | mgconsole --host localhost --port 7687" &> /dev/null; then
        log_success "Memgraph connection test passed"
    else
        log_warning "Memgraph connection test failed (may need initialization)"
    fi
    
    # Test Qdrant connection
    log_info "Testing Qdrant connectivity..."
    if kubectl exec -n autoweave-memory deployment/qdrant -- curl -s http://localhost:6333/health &> /dev/null; then
        log_success "Qdrant connection test passed"
    else
        log_warning "Qdrant connection test failed"
    fi
}

# Initialize databases
initialize_databases() {
    log_info "Initializing databases..."
    
    # Initialize Memgraph schema
    log_info "Initializing Memgraph schema..."
    kubectl exec -n autoweave-memory deployment/memgraph -- sh -c "
        mgconsole --host localhost --port 7687 << 'EOF'
CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE;
CREATE CONSTRAINT ON (a:Agent) ASSERT a.id IS UNIQUE;
CREATE CONSTRAINT ON (w:Workflow) ASSERT w.id IS UNIQUE;
CREATE CONSTRAINT ON (t:Task) ASSERT t.id IS UNIQUE;
CREATE CONSTRAINT ON (s:Session) ASSERT s.id IS UNIQUE;
CREATE INDEX ON :Agent(status);
CREATE INDEX ON :Task(created_at);
CREATE INDEX ON :Workflow(status);
EOF
    " || log_warning "Memgraph schema initialization may have failed"
    
    # Create Qdrant collection
    log_info "Creating Qdrant collection..."
    kubectl exec -n autoweave-memory deployment/qdrant -- curl -X PUT "http://localhost:6333/collections/autoweave" \
        -H "Content-Type: application/json" \
        -d '{
            "vectors": {
                "size": 1536,
                "distance": "Cosine"
            }
        }' || log_warning "Qdrant collection creation may have failed"
    
    log_success "Database initialization completed"
}

# Display status
display_status() {
    log_info "Memory System Status:"
    echo
    
    echo "=== Namespace ==="
    kubectl get namespace autoweave-memory
    echo
    
    echo "=== Deployments ==="
    kubectl get deployments -n autoweave-memory
    echo
    
    echo "=== Pods ==="
    kubectl get pods -n autoweave-memory
    echo
    
    echo "=== Services ==="
    kubectl get services -n autoweave-memory
    echo
    
    echo "=== Persistent Volumes ==="
    kubectl get pvc -n autoweave-memory
    echo
    
    log_success "Memory system deployment completed!"
    echo
    echo "🔍 To access the services:"
    echo "  Memgraph: kubectl port-forward -n autoweave-memory svc/memgraph-service 7687:7687"
    echo "  Qdrant:   kubectl port-forward -n autoweave-memory svc/qdrant-service 6333:6333"
    echo
    echo "🔧 To check logs:"
    echo "  Memgraph: kubectl logs -n autoweave-memory deployment/memgraph"
    echo "  Qdrant:   kubectl logs -n autoweave-memory deployment/qdrant"
    echo
    echo "📊 To monitor:"
    echo "  kubectl get pods -n autoweave-memory -w"
}

# Main execution
main() {
    echo "
    ╔══════════════════════════════════════════════════════════════╗
    ║                🧠 AutoWeave Memory System Setup             ║
    ║                 Memgraph + Qdrant on Kubernetes             ║
    ╚══════════════════════════════════════════════════════════════╝
    "
    
    check_prerequisites
    deploy_namespace
    deploy_memgraph
    deploy_qdrant
    deploy_monitoring
    
    # Give services time to start
    sleep 10
    
    test_connectivity
    initialize_databases
    display_status
}

# Handle script arguments
case "$1" in
    "clean")
        log_info "Cleaning up memory system..."
        kubectl delete namespace autoweave-memory --ignore-not-found=true
        log_success "Memory system cleaned up"
        ;;
    "status")
        display_status
        ;;
    "test")
        test_connectivity
        ;;
    *)
        main
        ;;
esac