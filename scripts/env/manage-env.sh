#!/bin/bash
set -e

# Environment Variables and Secrets Management Script
# This script manages environment variables and secrets for Cloudflare Pages

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
ENV_FILE="${ENV_FILE:-.env.production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Function to check authentication
check_authentication() {
    log_info "Checking Cloudflare authentication..."
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Please run 'wrangler login' first."
        exit 1
    fi
    
    log_success "Authenticated with Cloudflare"
}

# Function to load environment variables from file
load_env_file() {
    local env_file="$1"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    log_info "Loading environment variables from: $env_file"
    
    # Read file and export variables
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Store in associative array
        ENV_VARS["$key"]="$value"
    done < "$env_file"
    
    log_success "Loaded ${#ENV_VARS[@]} environment variables"
}

# Function to set secret for Pages project
set_pages_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local environment="${3:-production}"
    
    log_info "Setting secret: $secret_name for environment: $environment..."
    
    # For production environment
    if [ "$environment" = "production" ]; then
        echo "$secret_value" | wrangler pages secret put "$secret_name" --project-name="$PROJECT_NAME"
    else
        # For preview environments, secrets are shared with production
        log_warning "Preview environments share secrets with production"
        echo "$secret_value" | wrangler pages secret put "$secret_name" --project-name="$PROJECT_NAME"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Secret '$secret_name' set successfully"
    else
        log_error "Failed to set secret: $secret_name"
        return 1
    fi
}

# Function to list all secrets
list_secrets() {
    log_info "Listing secrets for project: $PROJECT_NAME..."
    
    wrangler pages secret list --project-name="$PROJECT_NAME"
}

# Function to delete a secret
delete_secret() {
    local secret_name="$1"
    
    log_info "Deleting secret: $secret_name..."
    
    wrangler pages secret delete "$secret_name" --project-name="$PROJECT_NAME"
    
    if [ $? -eq 0 ]; then
        log_success "Secret '$secret_name' deleted successfully"
    else
        log_error "Failed to delete secret: $secret_name"
        return 1
    fi
}

# Function to sync environment variables
sync_env_vars() {
    local env_file="${1:-$ENV_FILE}"
    
    log_info "Syncing environment variables from: $env_file"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        exit 1
    fi
    
    # Define which variables should be treated as secrets
    local secret_patterns=("PASSWORD" "SECRET" "TOKEN" "KEY" "DATABASE_URL" "API_KEY" "PRIVATE")
    
    declare -A ENV_VARS
    
    # Read environment file
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        
        # Remove quotes and whitespace from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        
        # Check if this should be a secret
        local is_secret=false
        for pattern in "${secret_patterns[@]}"; do
            if [[ "$key" == *"$pattern"* ]]; then
                is_secret=true
                break
            fi
        done
        
        if [ "$is_secret" = true ]; then
            log_info "Setting secret: $key"
            set_pages_secret "$key" "$value"
        else
            log_info "Non-secret environment variable: $key (configure via dashboard)"
        fi
    done < "$env_file"
    
    log_success "Environment variables synced successfully"
}

# Function to create environment template
create_env_template() {
    local template_file=".env.example"
    
    log_info "Creating environment template: $template_file"
    
    cat > "$template_file" <<EOF
# Cloudflare Pages Environment Variables
# Copy this file to .env.production and fill in your values

# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database

# API Keys and Secrets
API_SECRET_KEY=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token

# Application Configuration
NODE_ENV=production
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com

# Optional: Analytics and Monitoring
SENTRY_DSN=
ANALYTICS_ID=

# KV Namespace IDs (auto-populated by setup-kv.sh)
KV_CACHE_ID=
KV_SESSIONS_ID=
KV_GAME_STATE_ID=
KV_ANALYTICS_ID=
EOF
    
    log_success "Environment template created: $template_file"
}

# Function to validate environment variables
validate_env_vars() {
    local env_file="${1:-$ENV_FILE}"
    
    log_info "Validating environment variables in: $env_file"
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        return 1
    fi
    
    # Required variables
    local required_vars=("DATABASE_URL" "API_SECRET_KEY")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        return 1
    fi
    
    log_success "All required environment variables are present"
    return 0
}

# Function to show usage
show_usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
    sync <env-file>       Sync environment variables from file to Cloudflare Pages
    list                  List all secrets for the project
    set <name> <value>    Set a specific secret
    delete <name>         Delete a specific secret
    validate <env-file>   Validate environment file has required variables
    template              Create an environment template file

Options:
    PROJECT_NAME          Set the Pages project name (default: chesschat-web)
    ENV_FILE              Set the environment file path (default: .env.production)

Examples:
    $0 sync .env.production
    $0 list
    $0 set DATABASE_URL "postgresql://..."
    $0 delete OLD_SECRET
    $0 validate .env.production
    $0 template
EOF
}

# Main function
main() {
    local command="${1:-}"
    
    if [ -z "$command" ]; then
        show_usage
        exit 1
    fi
    
    case "$command" in
        sync)
            check_authentication
            local env_file="${2:-$ENV_FILE}"
            sync_env_vars "$env_file"
            ;;
        list)
            check_authentication
            list_secrets
            ;;
        set)
            check_authentication
            local name="$2"
            local value="$3"
            if [ -z "$name" ] || [ -z "$value" ]; then
                log_error "Usage: $0 set <name> <value>"
                exit 1
            fi
            set_pages_secret "$name" "$value"
            ;;
        delete)
            check_authentication
            local name="$2"
            if [ -z "$name" ]; then
                log_error "Usage: $0 delete <name>"
                exit 1
            fi
            delete_secret "$name"
            ;;
        validate)
            local env_file="${2:-$ENV_FILE}"
            validate_env_vars "$env_file"
            ;;
        template)
            create_env_template
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
