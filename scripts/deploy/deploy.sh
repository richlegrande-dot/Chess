#!/bin/bash
set -e

# Cloudflare Pages Deployment Script for ChessChat Web
# This script handles the full deployment lifecycle including validation, build, and deploy

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${ENVIRONMENT:-production}"
PROJECT_NAME="${PROJECT_NAME:-chesschat-web}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Function to print colored output
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

# Function to check if required commands are available
check_dependencies() {
    log_info "Checking dependencies..."
    
    local deps=("node" "npm" "wrangler")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep is not installed. Please install it first."
            exit 1
        fi
    done
    
    log_success "All dependencies are available"
}

# Function to run pre-deploy validation
run_pre_deploy_validation() {
    log_info "Running pre-deploy validation checks..."
    
    if [ -f "$ROOT_DIR/scripts/validate/pre-deploy.sh" ]; then
        bash "$ROOT_DIR/scripts/validate/pre-deploy.sh"
        if [ $? -ne 0 ]; then
            log_error "Pre-deploy validation failed"
            exit 1
        fi
    else
        log_warning "Pre-deploy validation script not found, skipping..."
    fi
    
    log_success "Pre-deploy validation completed"
}

# Function to build the project
build_project() {
    log_info "Building ChessChat Web project..."
    
    if [ ! -f "$ROOT_DIR/package.json" ]; then
        log_warning "package.json not found in root directory"
        return 0
    fi
    
    cd "$ROOT_DIR"
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci
    
    # Run build
    log_info "Running build..."
    npm run build
    
    log_success "Build completed successfully"
}

# Function to deploy to Cloudflare Pages
deploy_to_cloudflare() {
    log_info "Deploying to Cloudflare Pages (${ENVIRONMENT})..."
    
    cd "$ROOT_DIR"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Deploying to production..."
        wrangler pages deploy dist --project-name="$PROJECT_NAME" --branch=main
    else
        log_info "Deploying preview environment..."
        wrangler pages deploy dist --project-name="$PROJECT_NAME" --branch="$ENVIRONMENT"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Deployment completed successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Function to run post-deploy verification
run_post_deploy_verification() {
    log_info "Running post-deploy verification..."
    
    if [ -f "$ROOT_DIR/scripts/verify/post-deploy.sh" ]; then
        bash "$ROOT_DIR/scripts/verify/post-deploy.sh"
        if [ $? -ne 0 ]; then
            log_error "Post-deploy verification failed"
            exit 1
        fi
    else
        log_warning "Post-deploy verification script not found, skipping..."
    fi
    
    log_success "Post-deploy verification completed"
}

# Function to save deployment history
save_deployment_history() {
    log_info "Saving deployment history..."
    
    local history_file="$ROOT_DIR/.deployment-history.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local commit_sha=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    
    # Create history entry
    local entry=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "environment": "$ENVIRONMENT",
  "commit": "$commit_sha",
  "project": "$PROJECT_NAME",
  "status": "success"
}
EOF
)
    
    # Append to history file
    if [ -f "$history_file" ]; then
        # Read existing history and append new entry
        local temp_file=$(mktemp)
        jq ". += [$entry]" "$history_file" > "$temp_file" 2>/dev/null || echo "[$entry]" > "$temp_file"
        mv "$temp_file" "$history_file"
    else
        echo "[$entry]" > "$history_file"
    fi
    
    log_success "Deployment history saved"
}

# Main deployment flow
main() {
    log_info "Starting Cloudflare Pages deployment for $PROJECT_NAME"
    log_info "Environment: $ENVIRONMENT"
    log_info "Root directory: $ROOT_DIR"
    
    check_dependencies
    run_pre_deploy_validation
    build_project
    deploy_to_cloudflare
    run_post_deploy_verification
    save_deployment_history
    
    log_success "Deployment completed successfully!"
    log_info "Check your Cloudflare Pages dashboard for deployment details"
}

# Run main function
main "$@"
