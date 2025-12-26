#!/bin/bash
set -e

# Pre-deployment Validation Script
# This script validates configuration and requirements before deploying

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATION_FAILED=0

# Function to validate Node.js version
validate_node_version() {
    log_info "Validating Node.js version..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        VALIDATION_FAILED=1
        return 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local major_version=$(echo "$node_version" | cut -d'.' -f1)
    
    if [ "$major_version" -lt 16 ]; then
        log_error "Node.js version must be 16 or higher (current: $node_version)"
        VALIDATION_FAILED=1
        return 1
    fi
    
    log_success "Node.js version: $node_version (OK)"
}

# Function to validate npm version
validate_npm_version() {
    log_info "Validating npm version..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        VALIDATION_FAILED=1
        return 1
    fi
    
    local npm_version=$(npm --version)
    log_success "npm version: $npm_version (OK)"
}

# Function to validate wrangler installation
validate_wrangler() {
    log_info "Validating Wrangler CLI..."
    
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed"
        log_info "Install with: npm install -g wrangler"
        VALIDATION_FAILED=1
        return 1
    fi
    
    local wrangler_version=$(wrangler --version 2>&1 | head -1)
    log_success "Wrangler: $wrangler_version (OK)"
    
    # Check authentication
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        log_info "Run: wrangler login"
        VALIDATION_FAILED=1
        return 1
    fi
    
    log_success "Wrangler authentication: OK"
}

# Function to validate package.json
validate_package_json() {
    log_info "Validating package.json..."
    
    local package_file="$ROOT_DIR/package.json"
    
    if [ ! -f "$package_file" ]; then
        log_warning "package.json not found in root directory"
        log_warning "Skipping package.json validation"
        return 0
    fi
    
    # Check if build script exists
    if ! grep -q '"build"' "$package_file"; then
        log_error "No 'build' script found in package.json"
        VALIDATION_FAILED=1
        return 1
    fi
    
    log_success "package.json validation: OK"
}

# Function to validate wrangler.toml
validate_wrangler_toml() {
    log_info "Validating wrangler.toml..."
    
    local wrangler_file="$ROOT_DIR/wrangler.toml"
    
    if [ ! -f "$wrangler_file" ]; then
        log_warning "wrangler.toml not found"
        log_warning "This is optional for Pages deployments"
        return 0
    fi
    
    # Check if name is defined
    if ! grep -q '^name = ' "$wrangler_file"; then
        log_warning "No 'name' field found in wrangler.toml"
    fi
    
    # Check if compatibility_date is defined
    if ! grep -q '^compatibility_date = ' "$wrangler_file"; then
        log_warning "No 'compatibility_date' field found in wrangler.toml"
    fi
    
    log_success "wrangler.toml validation: OK"
}

# Function to validate environment variables
validate_environment_vars() {
    log_info "Validating environment variables..."
    
    local env_file="${ENV_FILE:-.env.production}"
    
    if [ ! -f "$ROOT_DIR/$env_file" ]; then
        log_warning "Environment file not found: $env_file"
        log_warning "Make sure to configure secrets via Cloudflare dashboard or scripts/env/manage-env.sh"
        return 0
    fi
    
    # Check for DATABASE_URL
    if ! grep -q '^DATABASE_URL=' "$ROOT_DIR/$env_file"; then
        log_warning "DATABASE_URL not found in $env_file"
        log_warning "Ensure this is configured as a secret in Cloudflare Pages"
    else
        log_success "DATABASE_URL found in $env_file"
    fi
    
    log_success "Environment variables validation: OK"
}

# Function to validate secrets configuration
validate_secrets() {
    log_info "Validating Cloudflare Pages secrets..."
    
    local project_name="${PROJECT_NAME:-chesschat-web}"
    
    # Try to list secrets
    if wrangler whoami &> /dev/null; then
        local secrets_output=$(wrangler pages secret list --project-name="$project_name" 2>&1 || echo "")
        
        if [[ "$secrets_output" == *"DATABASE_URL"* ]]; then
            log_success "DATABASE_URL secret is configured"
        else
            log_warning "DATABASE_URL secret not found in Cloudflare Pages"
            log_info "Set it with: scripts/env/manage-env.sh set DATABASE_URL 'your-database-url'"
        fi
    else
        log_warning "Cannot validate secrets - not authenticated with Cloudflare"
    fi
}

# Function to validate git repository
validate_git_repo() {
    log_info "Validating git repository..."
    
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_warning "Not a git repository"
        return 0
    fi
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "There are uncommitted changes in the repository"
        log_warning "Consider committing or stashing changes before deployment"
    fi
    
    # Get current branch
    local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    log_info "Current branch: $branch"
    
    log_success "Git repository validation: OK"
}

# Function to validate build output directory
validate_build_output() {
    log_info "Validating build output directory..."
    
    local dist_dir="$ROOT_DIR/dist"
    
    if [ -d "$dist_dir" ]; then
        local file_count=$(find "$dist_dir" -type f | wc -l)
        log_info "Build output directory exists with $file_count files"
        log_warning "Will be overwritten by new build"
    else
        log_info "Build output directory does not exist (will be created during build)"
    fi
    
    log_success "Build output validation: OK"
}

# Function to validate TypeScript configuration
validate_typescript() {
    log_info "Validating TypeScript configuration..."
    
    local tsconfig_file="$ROOT_DIR/tsconfig.json"
    
    if [ ! -f "$tsconfig_file" ]; then
        log_warning "tsconfig.json not found"
        log_warning "Skipping TypeScript validation"
        return 0
    fi
    
    # Check if TypeScript is installed
    if [ -f "$ROOT_DIR/package.json" ] && grep -q '"typescript"' "$ROOT_DIR/package.json"; then
        log_success "TypeScript is installed"
    else
        log_warning "TypeScript not found in package.json"
    fi
    
    log_success "TypeScript configuration: OK"
}

# Function to validate Vite configuration
validate_vite() {
    log_info "Validating Vite configuration..."
    
    local vite_config="$ROOT_DIR/vite.config.ts"
    
    if [ ! -f "$vite_config" ]; then
        vite_config="$ROOT_DIR/vite.config.js"
    fi
    
    if [ ! -f "$vite_config" ]; then
        log_warning "vite.config.ts/js not found"
        log_warning "Skipping Vite validation"
        return 0
    fi
    
    log_success "Vite configuration found: $(basename $vite_config)"
    log_success "Vite configuration: OK"
}

# Function to check disk space
validate_disk_space() {
    log_info "Checking disk space..."
    
    local available_space=$(df -h . | awk 'NR==2 {print $4}')
    log_info "Available disk space: $available_space"
    
    log_success "Disk space check: OK"
}

# Function to display validation summary
display_summary() {
    echo ""
    log_info "========================================="
    log_info "Pre-deployment Validation Summary"
    log_info "========================================="
    
    if [ $VALIDATION_FAILED -eq 0 ]; then
        log_success "All validations passed!"
        log_info "Ready to deploy to Cloudflare Pages"
        return 0
    else
        log_error "Some validations failed"
        log_error "Please fix the errors above before deploying"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting pre-deployment validation..."
    log_info "Root directory: $ROOT_DIR"
    echo ""
    
    validate_node_version
    validate_npm_version
    validate_wrangler
    validate_package_json
    validate_wrangler_toml
    validate_environment_vars
    validate_secrets
    validate_git_repo
    validate_build_output
    validate_typescript
    validate_vite
    validate_disk_space
    
    display_summary
    exit $VALIDATION_FAILED
}

# Run main function
main "$@"
