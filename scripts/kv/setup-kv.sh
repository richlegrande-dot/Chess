#!/bin/bash
set -e

# KV Namespace Setup Script
# This script creates and binds KV namespaces for Cloudflare Pages

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

# Configuration
PROJECT_NAME="${PROJECT_NAME:-chesschat-web}"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID}"

# KV Namespaces to create
declare -A KV_NAMESPACES=(
    ["CACHE"]="ChessChat Cache"
    ["SESSIONS"]="ChessChat Sessions"
    ["GAME_STATE"]="ChessChat Game State"
    ["ANALYTICS"]="ChessChat Analytics"
)

# Function to check if wrangler is authenticated
check_authentication() {
    log_info "Checking Cloudflare authentication..."
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Please run 'wrangler login' first."
        exit 1
    fi
    
    log_success "Authenticated with Cloudflare"
}

# Function to create KV namespace
create_kv_namespace() {
    local binding_name=$1
    local namespace_title=$2
    
    log_info "Creating KV namespace: $namespace_title (binding: $binding_name)..."
    
    # Check if namespace already exists
    local existing_id=$(wrangler kv:namespace list | grep "\"title\": \"$namespace_title\"" | grep -o '"id": "[^"]*"' | cut -d'"' -f4 | head -1)
    
    if [ -n "$existing_id" ]; then
        log_warning "KV namespace '$namespace_title' already exists with ID: $existing_id"
        echo "$existing_id"
        return 0
    fi
    
    # Create the namespace
    local output=$(wrangler kv:namespace create "$namespace_title" 2>&1)
    local namespace_id=$(echo "$output" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$namespace_id" ]; then
        log_success "Created KV namespace: $namespace_title (ID: $namespace_id)"
        echo "$namespace_id"
    else
        log_error "Failed to create KV namespace: $namespace_title"
        log_error "Output: $output"
        exit 1
    fi
}

# Function to create preview KV namespace
create_preview_kv_namespace() {
    local binding_name=$1
    local namespace_title=$2
    
    log_info "Creating preview KV namespace: $namespace_title (Preview)..."
    
    local preview_title="${namespace_title} (Preview)"
    
    # Check if preview namespace already exists
    local existing_id=$(wrangler kv:namespace list | grep "\"title\": \"$preview_title\"" | grep -o '"id": "[^"]*"' | cut -d'"' -f4 | head -1)
    
    if [ -n "$existing_id" ]; then
        log_warning "Preview KV namespace '$preview_title' already exists with ID: $existing_id"
        echo "$existing_id"
        return 0
    fi
    
    # Create the preview namespace
    local output=$(wrangler kv:namespace create "$namespace_title" --preview 2>&1)
    local namespace_id=$(echo "$output" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$namespace_id" ]; then
        log_success "Created preview KV namespace: $preview_title (ID: $namespace_id)"
        echo "$namespace_id"
    else
        log_error "Failed to create preview KV namespace: $preview_title"
        log_error "Output: $output"
        exit 1
    fi
}

# Function to update wrangler.toml with KV bindings
update_wrangler_config() {
    log_info "Updating wrangler.toml with KV bindings..."
    
    local wrangler_file="wrangler.toml"
    
    if [ ! -f "$wrangler_file" ]; then
        log_warning "wrangler.toml not found, creating new file..."
        cat > "$wrangler_file" <<EOF
name = "$PROJECT_NAME"
compatibility_date = "2024-01-01"

# KV Namespace Bindings
EOF
    fi
    
    log_success "wrangler.toml updated (manual binding configuration required)"
}

# Function to bind KV namespaces to Pages project
bind_kv_to_pages() {
    log_info "Binding KV namespaces to Pages project..."
    
    log_warning "KV bindings for Pages projects must be configured via:"
    log_info "  1. Cloudflare Dashboard: Workers & Pages > $PROJECT_NAME > Settings > Functions > KV Namespace Bindings"
    log_info "  2. Or use wrangler.toml in your Pages Functions directory"
    
    log_info ""
    log_info "Add the following bindings in your dashboard or wrangler.toml:"
    
    for binding in "${!KV_NAMESPACES[@]}"; do
        echo "  - Binding name: $binding"
    done
}

# Function to display summary
display_summary() {
    log_info ""
    log_info "========================================="
    log_info "KV Namespace Setup Summary"
    log_info "========================================="
    
    for binding in "${!KV_NAMESPACES[@]}"; do
        local title="${KV_NAMESPACES[$binding]}"
        log_info "Binding: $binding -> $title"
    done
    
    log_info ""
    log_success "KV namespace setup completed!"
}

# Main function
main() {
    log_info "Starting KV namespace setup for $PROJECT_NAME"
    
    check_authentication
    
    # Create all KV namespaces
    for binding in "${!KV_NAMESPACES[@]}"; do
        local title="${KV_NAMESPACES[$binding]}"
        create_kv_namespace "$binding" "$title"
        create_preview_kv_namespace "$binding" "$title"
    done
    
    update_wrangler_config
    bind_kv_to_pages
    display_summary
}

# Run main function
main "$@"
