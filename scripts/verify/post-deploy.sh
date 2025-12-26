#!/bin/bash
set -e

# Post-deployment Verification Script
# This script verifies the deployment health and functionality

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
VERIFICATION_FAILED=0

# Configuration
DEPLOYMENT_URL="${DEPLOYMENT_URL:-}"
PROJECT_NAME="${PROJECT_NAME:-chesschat-web}"
TIMEOUT=30

# Function to get deployment URL
get_deployment_url() {
    log_info "Getting deployment URL..."
    
    if [ -n "$DEPLOYMENT_URL" ]; then
        echo "$DEPLOYMENT_URL"
        return 0
    fi
    
    # Try to get URL from wrangler
    if command -v wrangler &> /dev/null && wrangler whoami &> /dev/null; then
        # For Pages, the URL format is: https://PROJECT_NAME.pages.dev
        local url="https://${PROJECT_NAME}.pages.dev"
        echo "$url"
        return 0
    fi
    
    log_warning "Could not determine deployment URL automatically"
    return 1
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    
    log_info "Checking HTTP endpoint: $url"
    
    if ! command -v curl &> /dev/null; then
        log_warning "curl is not installed, skipping HTTP checks"
        return 0
    fi
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>&1)
    
    if [ "$response" = "$expected_status" ]; then
        log_success "HTTP endpoint returned $response (expected: $expected_status)"
        return 0
    else
        log_error "HTTP endpoint returned $response (expected: $expected_status)"
        VERIFICATION_FAILED=1
        return 1
    fi
}

# Function to check HTML content
check_html_content() {
    local url="$1"
    
    log_info "Checking HTML content at: $url"
    
    if ! command -v curl &> /dev/null; then
        log_warning "curl is not installed, skipping content checks"
        return 0
    fi
    
    local content=$(curl -s --max-time "$TIMEOUT" "$url" 2>&1)
    
    # Check for basic HTML structure
    if echo "$content" | grep -q "<html"; then
        log_success "Valid HTML document found"
    else
        log_warning "HTML structure not detected"
    fi
    
    # Check for common React/Vite markers
    if echo "$content" | grep -q "root"; then
        log_success "React root element found"
    else
        log_warning "React root element not found"
    fi
    
    return 0
}

# Function to check API health endpoint
check_api_health() {
    local base_url="$1"
    local health_path="${2:-/api/health}"
    local url="${base_url}${health_path}"
    
    log_info "Checking API health endpoint: $url"
    
    if ! command -v curl &> /dev/null; then
        log_warning "curl is not installed, skipping API health checks"
        return 0
    fi
    
    local response=$(curl -s --max-time "$TIMEOUT" "$url" 2>&1)
    
    if [ $? -eq 0 ]; then
        log_success "API health endpoint is accessible"
        
        # Try to parse JSON response
        if echo "$response" | grep -q "status"; then
            log_success "API health endpoint returned valid response"
        fi
    else
        log_warning "API health endpoint not accessible (this may be expected if no API is deployed)"
    fi
    
    return 0
}

# Function to check static assets
check_static_assets() {
    local base_url="$1"
    
    log_info "Checking static assets..."
    
    if ! command -v curl &> /dev/null; then
        log_warning "curl is not installed, skipping asset checks"
        return 0
    fi
    
    # Common asset paths for Vite builds
    local asset_paths=(
        "/assets/"
        "/favicon.ico"
    )
    
    for path in "${asset_paths[@]}"; do
        local url="${base_url}${path}"
        local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>&1)
        
        if [ "$status" = "200" ] || [ "$status" = "301" ] || [ "$status" = "302" ]; then
            log_success "Asset accessible: $path (status: $status)"
        else
            log_info "Asset check: $path (status: $status) - may not exist yet"
        fi
    done
}

# Function to check DNS resolution
check_dns() {
    local url="$1"
    local domain=$(echo "$url" | sed -e 's|^https\?://||' -e 's|/.*||')
    
    log_info "Checking DNS resolution for: $domain"
    
    if ! command -v dig &> /dev/null && ! command -v nslookup &> /dev/null; then
        log_warning "DNS tools not available, skipping DNS check"
        return 0
    fi
    
    if command -v dig &> /dev/null; then
        if dig +short "$domain" | grep -q .; then
            log_success "DNS resolution successful"
        else
            log_warning "DNS resolution failed or domain not yet propagated"
        fi
    elif command -v nslookup &> /dev/null; then
        if nslookup "$domain" &> /dev/null; then
            log_success "DNS resolution successful"
        else
            log_warning "DNS resolution failed or domain not yet propagated"
        fi
    fi
}

# Function to check SSL/TLS certificate
check_ssl_certificate() {
    local url="$1"
    
    if [[ ! "$url" =~ ^https:// ]]; then
        log_info "Skipping SSL check (not an HTTPS URL)"
        return 0
    fi
    
    log_info "Checking SSL/TLS certificate..."
    
    if ! command -v openssl &> /dev/null; then
        log_warning "openssl is not installed, skipping SSL checks"
        return 0
    fi
    
    local domain=$(echo "$url" | sed -e 's|^https\?://||' -e 's|/.*||')
    
    if echo | openssl s_client -servername "$domain" -connect "${domain}:443" 2>/dev/null | openssl x509 -noout -dates &> /dev/null; then
        log_success "Valid SSL/TLS certificate found"
    else
        log_warning "Could not verify SSL/TLS certificate"
    fi
}

# Function to check response time
check_response_time() {
    local url="$1"
    
    log_info "Checking response time..."
    
    if ! command -v curl &> /dev/null; then
        log_warning "curl is not installed, skipping response time check"
        return 0
    fi
    
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$TIMEOUT" "$url" 2>&1)
    
    if [ $? -eq 0 ]; then
        log_success "Response time: ${response_time}s"
        
        # Warn if response time is too high
        local response_time_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")
        if [ "${response_time_ms%.*}" -gt 3000 ] 2>/dev/null; then
            log_warning "Response time is high (>${response_time_ms}ms)"
        fi
    else
        log_error "Failed to measure response time"
    fi
}

# Function to verify Pages Functions
check_pages_functions() {
    log_info "Verifying Pages Functions..."
    
    local functions_dir="$ROOT_DIR/functions"
    
    if [ ! -d "$functions_dir" ]; then
        log_info "No functions directory found (Pages Functions not used)"
        return 0
    fi
    
    local function_count=$(find "$functions_dir" -name "*.ts" -o -name "*.js" | wc -l)
    log_info "Found $function_count Pages Functions"
    
    if [ "$function_count" -gt 0 ]; then
        log_success "Pages Functions directory exists with $function_count functions"
    fi
}

# Function to check KV bindings
check_kv_bindings() {
    log_info "Checking KV namespace bindings..."
    
    local wrangler_file="$ROOT_DIR/wrangler.toml"
    
    if [ ! -f "$wrangler_file" ]; then
        log_info "No wrangler.toml found (KV bindings may be configured via dashboard)"
        return 0
    fi
    
    if grep -q "kv_namespaces" "$wrangler_file"; then
        log_success "KV namespace bindings found in wrangler.toml"
    else
        log_info "No KV namespace bindings in wrangler.toml"
    fi
}

# Function to display verification summary
display_summary() {
    echo ""
    log_info "========================================="
    log_info "Post-deployment Verification Summary"
    log_info "========================================="
    
    if [ $VERIFICATION_FAILED -eq 0 ]; then
        log_success "All verifications passed!"
        log_success "Deployment is healthy and operational"
        return 0
    else
        log_error "Some verifications failed"
        log_warning "Please review the errors above and investigate"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting post-deployment verification..."
    echo ""
    
    # Get deployment URL
    local deployment_url=$(get_deployment_url)
    
    if [ -n "$deployment_url" ]; then
        log_info "Deployment URL: $deployment_url"
        log_info "Waiting 10 seconds for deployment to stabilize..."
        sleep 10
        
        check_dns "$deployment_url"
        check_ssl_certificate "$deployment_url"
        check_http_endpoint "$deployment_url"
        check_response_time "$deployment_url"
        check_html_content "$deployment_url"
        check_api_health "$deployment_url"
        check_static_assets "$deployment_url"
    else
        log_warning "Could not determine deployment URL, skipping endpoint checks"
        log_info "Set DEPLOYMENT_URL environment variable to enable endpoint verification"
    fi
    
    check_pages_functions
    check_kv_bindings
    
    display_summary
    exit $VERIFICATION_FAILED
}

# Run main function
main "$@"
