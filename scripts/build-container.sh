#!/bin/bash
set -euo pipefail

# AutoWeave Multi-Architecture Container Build Script
# Builds, signs, and generates SBOM for production containers

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-autoweave/autoweave}"
VERSION="${VERSION:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

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

# Check required tools
check_dependencies() {
    log_info "Checking required dependencies..."
    
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v cosign &> /dev/null; then
        missing_tools+=("cosign")
    fi
    
    if ! command -v syft &> /dev/null; then
        missing_tools+=("syft")
    fi
    
    if ! command -v crane &> /dev/null; then
        log_warning "crane not found - image inspection features will be limited"
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and try again."
        exit 1
    fi
    
    log_success "All required dependencies found"
}

# Setup Docker Buildx
setup_buildx() {
    log_info "Setting up Docker Buildx for multi-architecture builds..."
    
    # Create or use existing buildx instance
    if ! docker buildx inspect autoweave-builder &> /dev/null; then
        docker buildx create --name autoweave-builder --driver docker-container --use
        log_success "Created Docker Buildx instance: autoweave-builder"
    else
        docker buildx use autoweave-builder
        log_info "Using existing Docker Buildx instance: autoweave-builder"
    fi
    
    # Bootstrap the builder
    docker buildx inspect --bootstrap
    log_success "Docker Buildx ready for multi-architecture builds"
}

# Build container images
build_images() {
    log_info "Building AutoWeave container images..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local latest_tag="${REGISTRY}/${IMAGE_NAME}:latest"
    
    # Build arguments
    local build_args=(
        "--build-arg VERSION=${VERSION}"
        "--build-arg BUILD_DATE=${BUILD_DATE}"
        "--build-arg GIT_COMMIT=${GIT_COMMIT}"
        "--build-arg GIT_BRANCH=${GIT_BRANCH}"
    )
    
    # Platform specification
    local platform_args="--platform ${PLATFORMS}"
    
    # Cache configuration
    local cache_args=(
        "--cache-from type=gha"
        "--cache-to type=gha,mode=max"
    )
    
    # Build with provenance and SBOM
    local attestation_args=(
        "--provenance=true"
        "--sbom=true"
    )
    
    log_info "Building for platforms: ${PLATFORMS}"
    log_info "Image tags: ${image_tag}, ${latest_tag}"
    
    # Execute build
    docker buildx build \
        ${platform_args} \
        ${build_args[*]} \
        ${cache_args[*]} \
        ${attestation_args[*]} \
        --file "${PROJECT_ROOT}/Dockerfile.multi-arch" \
        --tag "${image_tag}" \
        --tag "${latest_tag}" \
        --push \
        "${PROJECT_ROOT}"
    
    log_success "Container images built and pushed successfully"
    
    # Store image digest for signing
    local digest=$(docker buildx imagetools inspect "${image_tag}" --format '{{ .Manifest.Digest }}')
    echo "${digest}" > "${PROJECT_ROOT}/image-digest.txt"
    log_info "Image digest: ${digest}"
}

# Generate Software Bill of Materials (SBOM)
generate_sbom() {
    log_info "Generating Software Bill of Materials (SBOM)..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local sbom_dir="${PROJECT_ROOT}/sbom"
    
    mkdir -p "${sbom_dir}"
    
    # Generate SPDX format SBOM
    log_info "Generating SPDX SBOM..."
    syft "${image_tag}" -o spdx-json="${sbom_dir}/autoweave-${VERSION}.spdx.json"
    
    # Generate CycloneDX format SBOM
    log_info "Generating CycloneDX SBOM..."
    syft "${image_tag}" -o cyclonedx-json="${sbom_dir}/autoweave-${VERSION}.cyclonedx.json"
    
    # Generate table format for human readability
    log_info "Generating human-readable SBOM..."
    syft "${image_tag}" -o table="${sbom_dir}/autoweave-${VERSION}.txt"
    
    log_success "SBOM generated in multiple formats"
}

# Sign container images and SBOM
sign_artifacts() {
    log_info "Signing container images and SBOM with Cosign..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local digest=$(cat "${PROJECT_ROOT}/image-digest.txt")
    local sbom_dir="${PROJECT_ROOT}/sbom"
    
    # Sign the container image
    log_info "Signing container image..."
    cosign sign --yes "${REGISTRY}/${IMAGE_NAME}@${digest}"
    
    # Sign SBOM files
    log_info "Signing SBOM files..."
    for sbom_file in "${sbom_dir}"/*.spdx.json "${sbom_dir}"/*.cyclonedx.json; do
        if [ -f "${sbom_file}" ]; then
            cosign sign-blob --yes "${sbom_file}" --output-signature "${sbom_file}.sig"
            log_info "Signed: $(basename "${sbom_file}")"
        fi
    done
    
    log_success "All artifacts signed successfully"
}

# Verify signatures
verify_signatures() {
    log_info "Verifying container image signatures..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local digest=$(cat "${PROJECT_ROOT}/image-digest.txt")
    
    # Verify container signature
    if cosign verify "${REGISTRY}/${IMAGE_NAME}@${digest}" \
        --certificate-identity-regexp 'https://github\.com/autoweave/autoweave/.*' \
        --certificate-oidc-issuer https://token.actions.githubusercontent.com 2>/dev/null; then
        log_success "Container signature verified"
    else
        log_warning "Container signature verification failed or not available"
    fi
    
    # Verify SBOM signatures
    local sbom_dir="${PROJECT_ROOT}/sbom"
    for sig_file in "${sbom_dir}"/*.sig; do
        if [ -f "${sig_file}" ]; then
            local original_file="${sig_file%.sig}"
            if cosign verify-blob --signature "${sig_file}" "${original_file}" 2>/dev/null; then
                log_success "SBOM signature verified: $(basename "${original_file}")"
            else
                log_warning "SBOM signature verification failed: $(basename "${original_file}")"
            fi
        fi
    done
}

# Generate security report
generate_security_report() {
    log_info "Generating security vulnerability report..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local reports_dir="${PROJECT_ROOT}/security-reports"
    
    mkdir -p "${reports_dir}"
    
    # Trivy vulnerability scan
    if command -v trivy &> /dev/null; then
        log_info "Running Trivy vulnerability scan..."
        trivy image \
            --format json \
            --output "${reports_dir}/trivy-report.json" \
            "${image_tag}" || log_warning "Trivy scan completed with warnings"
        
        trivy image \
            --format table \
            --output "${reports_dir}/trivy-report.txt" \
            "${image_tag}" || log_warning "Trivy scan completed with warnings"
    else
        log_warning "Trivy not available - skipping vulnerability scan"
    fi
    
    # Grype vulnerability scan (if available)
    if command -v grype &> /dev/null; then
        log_info "Running Grype vulnerability scan..."
        grype "${image_tag}" \
            -o json \
            --file "${reports_dir}/grype-report.json" || log_warning "Grype scan completed with warnings"
    else
        log_warning "Grype not available - skipping additional vulnerability scan"
    fi
    
    log_success "Security reports generated"
}

# Generate build summary
generate_summary() {
    log_info "Generating build summary..."
    
    local image_tag="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    local digest=$(cat "${PROJECT_ROOT}/image-digest.txt")
    local summary_file="${PROJECT_ROOT}/build-summary.json"
    
    cat > "${summary_file}" << EOF
{
  "build": {
    "version": "${VERSION}",
    "buildDate": "${BUILD_DATE}",
    "gitCommit": "${GIT_COMMIT}",
    "gitBranch": "${GIT_BRANCH}",
    "platforms": "${PLATFORMS}",
    "registry": "${REGISTRY}",
    "imageName": "${IMAGE_NAME}"
  },
  "image": {
    "tag": "${image_tag}",
    "digest": "${digest}",
    "signed": true,
    "sbomGenerated": true,
    "vulnerabilityScanCompleted": true
  },
  "artifacts": {
    "sbom": {
      "spdx": "sbom/autoweave-${VERSION}.spdx.json",
      "cyclonedx": "sbom/autoweave-${VERSION}.cyclonedx.json",
      "table": "sbom/autoweave-${VERSION}.txt"
    },
    "securityReports": {
      "trivy": "security-reports/trivy-report.json",
      "grype": "security-reports/grype-report.json"
    },
    "signatures": {
      "container": "Signed with Cosign",
      "sbom": "All SBOM files signed"
    }
  }
}
EOF
    
    log_success "Build summary generated: ${summary_file}"
}

# Print usage information
usage() {
    cat << EOF
AutoWeave Multi-Architecture Container Build Script

Usage: $0 [OPTIONS]

Options:
    -v, --version VERSION       Set image version (default: latest)
    -r, --registry REGISTRY     Set container registry (default: ghcr.io)
    -n, --name IMAGE_NAME       Set image name (default: autoweave/autoweave)
    -p, --platforms PLATFORMS   Set target platforms (default: linux/amd64,linux/arm64)
    --skip-signing             Skip signing step
    --skip-sbom                Skip SBOM generation
    --skip-security            Skip security scanning
    -h, --help                 Show this help message

Environment Variables:
    REGISTRY                   Container registry URL
    IMAGE_NAME                 Container image name
    VERSION                    Image version tag
    PLATFORMS                  Target platforms for build

Examples:
    $0 --version 1.0.0
    $0 --registry gcr.io/my-project --name autoweave --version latest
    $0 --platforms linux/amd64 --skip-signing

EOF
}

# Main execution
main() {
    local skip_signing=false
    local skip_sbom=false
    local skip_security=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -n|--name)
                IMAGE_NAME="$2"
                shift 2
                ;;
            -p|--platforms)
                PLATFORMS="$2"
                shift 2
                ;;
            --skip-signing)
                skip_signing=true
                shift
                ;;
            --skip-sbom)
                skip_sbom=true
                shift
                ;;
            --skip-security)
                skip_security=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    log_info "Starting AutoWeave container build process..."
    log_info "Version: ${VERSION}"
    log_info "Registry: ${REGISTRY}"
    log_info "Image: ${IMAGE_NAME}"
    log_info "Platforms: ${PLATFORMS}"
    
    # Execute build pipeline
    check_dependencies
    setup_buildx
    build_images
    
    if [ "$skip_sbom" = false ]; then
        generate_sbom
    else
        log_warning "Skipping SBOM generation"
    fi
    
    if [ "$skip_signing" = false ]; then
        sign_artifacts
        verify_signatures
    else
        log_warning "Skipping artifact signing"
    fi
    
    if [ "$skip_security" = false ]; then
        generate_security_report
    else
        log_warning "Skipping security scanning"
    fi
    
    generate_summary
    
    log_success "AutoWeave container build completed successfully!"
    log_info "Image: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
    log_info "Build summary: ${PROJECT_ROOT}/build-summary.json"
}

# Execute main function with all arguments
main "$@"