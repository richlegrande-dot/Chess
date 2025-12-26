#!/bin/bash
set -e

# Troubleshooting Utility for Cloudflare Pages Deployments
# This script helps diagnose and fix common deployment issues

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

PROJECT_NAME="${PROJECT_NAME:-chesschat-web}"

# Function to check deployment status
check_deployment_status() {
    log_info "Checking deployment status..."
    
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed"
        return 1
    fi
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        log_info "Run: wrangler login"
        return 1
    fi
    
    log_info "Fetching recent deployments..."
    wrangler pages deployment list --project-name="$PROJECT_NAME" || {
        log_error "Failed to fetch deployments. Check if project exists."
        return 1
    }
}

# Function to check build logs
check_build_logs() {
    log_info "Build logs can be viewed in Cloudflare Dashboard:"
    log_info "  https://dash.cloudflare.com/ > Workers & Pages > $PROJECT_NAME > View builds"
    log_info ""
    log_info "Common build issues:"
    log_info "  1. Node version mismatch - Set NODE_VERSION in environment variables"
    log_info "  2. Missing dependencies - Check package.json and package-lock.json"
    log_info "  3. Build command errors - Verify 'build' script in package.json"
    log_info "  4. TypeScript errors - Run 'npm run build' locally first"
}

# Function to diagnose KV namespace issues
diagnose_kv_issues() {
    log_info "Diagnosing KV namespace issues..."
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        return 1
    fi
    
    log_info "Listing all KV namespaces..."
    wrangler kv:namespace list
    
    log_info ""
    log_info "Common KV issues:"
    log_info "  1. Namespace not bound - Add binding in Pages Settings > Functions > KV Namespaces"
    log_info "  2. Wrong namespace ID - Verify IDs match in wrangler.toml or dashboard"
    log_info "  3. Permission issues - Check API token has KV permissions"
    log_info ""
    log_info "To create KV namespaces, run: scripts/kv/setup-kv.sh"
}

# Function to diagnose environment variable issues
diagnose_env_issues() {
    log_info "Diagnosing environment variable issues..."
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        return 1
    fi
    
    log_info "Listing configured secrets..."
    wrangler pages secret list --project-name="$PROJECT_NAME" || {
        log_error "Failed to list secrets"
        return 1
    }
    
    log_info ""
    log_info "Common environment variable issues:"
    log_info "  1. Secret not set - Use: scripts/env/manage-env.sh set <NAME> <VALUE>"
    log_info "  2. Wrong secret name - Check code references match secret names"
    log_info "  3. Environment-specific vars - Preview and production share secrets in Pages"
    log_info "  4. Build-time vs runtime - Some vars need to be prefixed with VITE_ for build"
}

# Function to diagnose database connection issues
diagnose_database_issues() {
    log_info "Diagnosing database connection issues..."
    
    log_info "Common database issues:"
    log_info "  1. DATABASE_URL not set - Add as secret in Cloudflare Pages"
    log_info "  2. Connection string format - Verify format: postgresql://user:pass@host:port/db"
    log_info "  3. Firewall rules - Ensure Cloudflare IPs can access database"
    log_info "  4. SSL/TLS requirements - Add ?sslmode=require if needed"
    log_info "  5. Connection pooling - Use connection pooler for serverless (e.g., Supabase Pooler)"
    log_info ""
    log_info "For Prisma with Pages Functions:"
    log_info "  - Use Prisma Accelerate or Data Proxy for connection pooling"
    log_info "  - Set DATABASE_URL to connection pooler URL"
    log_info "  - Run 'npx prisma generate' before deployment"
}

# Function to diagnose Pages Functions issues
diagnose_functions_issues() {
    log_info "Diagnosing Pages Functions issues..."
    
    log_info "Common Pages Functions issues:"
    log_info "  1. File-based routing - Files in /functions map to routes"
    log_info "     Example: functions/api/users.ts -> /api/users"
    log_info "  2. Export format - Must export onRequest or HTTP method handlers"
    log_info "     Example: export async function onRequestGet(context) { ... }"
    log_info "  3. TypeScript compilation - Ensure tsconfig.json is properly configured"
    log_info "  4. Dependencies - Functions bundle dependencies automatically"
    log_info "  5. Size limits - Functions have size and CPU time limits"
    log_info ""
    log_info "Pages Functions architecture:"
    log_info "  - functions/ directory contains backend code"
    log_info "  - _middleware.ts for middleware (authentication, logging, etc.)"
    log_info "  - Advanced mode: Use wrangler.toml in functions directory"
}

# Function to diagnose routing issues
diagnose_routing_issues() {
    log_info "Diagnosing routing issues..."
    
    log_info "Common routing issues:"
    log_info "  1. SPA routing - Add _redirects file for client-side routing"
    log_info "     Example: /* /index.html 200"
    log_info "  2. 404 errors - Check if files exist in dist/ after build"
    log_info "  3. Asset paths - Verify base path in vite.config.ts"
    log_info "  4. Mixed content - Ensure all assets use HTTPS"
    log_info ""
    log_info "For React Router or similar:"
    log_info "  Create public/_redirects with: /* /index.html 200"
}

# Function to check wrangler configuration
check_wrangler_config() {
    log_info "Checking wrangler.toml configuration..."
    
    if [ ! -f "wrangler.toml" ]; then
        log_warning "No wrangler.toml found (optional for Pages)"
        log_info "wrangler.toml is optional but can be used for:"
        log_info "  - KV namespace bindings"
        log_info "  - Durable Objects"
        log_info "  - Environment variables"
        log_info "  - Compatibility settings"
        return 0
    fi
    
    log_info "wrangler.toml found, checking configuration..."
    
    # Check for common issues
    if ! grep -q "^name = " wrangler.toml; then
        log_warning "No 'name' field found"
    fi
    
    if ! grep -q "^compatibility_date = " wrangler.toml; then
        log_warning "No 'compatibility_date' field found"
    fi
    
    if grep -q "^\[site\]" wrangler.toml; then
        log_warning "[site] section is for Workers Sites, not Pages"
        log_info "Remove [site] section for Pages deployments"
    fi
    
    log_success "wrangler.toml check complete"
}

# Function to test local build
test_local_build() {
    log_info "Testing local build..."
    
    if [ ! -f "package.json" ]; then
        log_error "No package.json found"
        return 1
    fi
    
    log_info "Running npm install..."
    npm install
    
    log_info "Running build command..."
    npm run build
    
    if [ $? -eq 0 ]; then
        log_success "Local build successful"
        
        if [ -d "dist" ]; then
            local file_count=$(find dist -type f | wc -l)
            log_info "Build output: dist/ ($file_count files)"
            
            # Check for index.html
            if [ -f "dist/index.html" ]; then
                log_success "index.html found in dist/"
            else
                log_error "index.html not found in dist/"
            fi
        fi
    else
        log_error "Local build failed"
        return 1
    fi
}

# Function to show recent deployments
show_recent_deployments() {
    log_info "Fetching recent deployments..."
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare"
        return 1
    fi
    
    wrangler pages deployment list --project-name="$PROJECT_NAME" | head -20
}

# Function to tail deployment logs
tail_deployment_logs() {
    log_info "Tailing deployment logs..."
    
    log_warning "Real-time log tailing is available in the Cloudflare Dashboard:"
    log_info "  https://dash.cloudflare.com/ > Workers & Pages > $PROJECT_NAME > Logs"
    log_info ""
    log_info "You can also use 'wrangler pages deployment tail' once a deployment is active"
}

# Function to show common solutions
show_common_solutions() {
    cat <<EOF

========================================
Common Issues and Solutions
========================================

1. Build Failures:
   - Check Node.js version (set NODE_VERSION env var)
   - Verify build command in Pages settings
   - Run 'npm run build' locally to test
   - Check build logs in Cloudflare Dashboard

2. Runtime Errors:
   - Check Functions logs in Dashboard
   - Verify environment variables/secrets are set
   - Check database connection settings
   - Review browser console for client errors

3. Performance Issues:
   - Enable Cloudflare caching
   - Optimize bundle size (run 'npm run build -- --analyze' if available)
   - Use lazy loading for routes
   - Check Cloudflare Analytics for insights

4. Database Connection:
   - Use connection pooler (Supabase, PgBouncer)
   - Set appropriate timeout values
   - Check firewall rules allow Cloudflare IPs
   - Verify DATABASE_URL format

5. KV Storage Issues:
   - Verify bindings in Pages Settings
   - Check namespace IDs match configuration
   - Review KV operation logs
   - Ensure keys don't exceed size limits

6. Authentication Issues:
   - Check API tokens have correct permissions
   - Verify account ID is correct
   - Re-authenticate: 'wrangler login'
   - Check team/account access

For more help:
  - Cloudflare Docs: https://developers.cloudflare.com/pages/
  - Community Forum: https://community.cloudflare.com/
  - Discord: https://discord.gg/cloudflaredev

EOF
}

# Function to show menu
show_menu() {
    cat <<EOF

========================================
Cloudflare Pages Troubleshooting Utility
========================================

1. Check deployment status
2. Check build logs guide
3. Diagnose KV namespace issues
4. Diagnose environment variable issues
5. Diagnose database connection issues
6. Diagnose Pages Functions issues
7. Diagnose routing issues
8. Check wrangler.toml configuration
9. Test local build
10. Show recent deployments
11. Tail deployment logs
12. Show common solutions
0. Exit

EOF
}

# Main menu loop
main() {
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Select an option: " choice
            
            case $choice in
                1) check_deployment_status ;;
                2) check_build_logs ;;
                3) diagnose_kv_issues ;;
                4) diagnose_env_issues ;;
                5) diagnose_database_issues ;;
                6) diagnose_functions_issues ;;
                7) diagnose_routing_issues ;;
                8) check_wrangler_config ;;
                9) test_local_build ;;
                10) show_recent_deployments ;;
                11) tail_deployment_logs ;;
                12) show_common_solutions ;;
                0) exit 0 ;;
                *) log_error "Invalid option" ;;
            esac
            
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command mode
        case "$1" in
            status) check_deployment_status ;;
            build-logs) check_build_logs ;;
            kv) diagnose_kv_issues ;;
            env) diagnose_env_issues ;;
            database) diagnose_database_issues ;;
            functions) diagnose_functions_issues ;;
            routing) diagnose_routing_issues ;;
            config) check_wrangler_config ;;
            test-build) test_local_build ;;
            deployments) show_recent_deployments ;;
            logs) tail_deployment_logs ;;
            solutions) show_common_solutions ;;
            *)
                log_error "Unknown command: $1"
                log_info "Usage: $0 [status|build-logs|kv|env|database|functions|routing|config|test-build|deployments|logs|solutions]"
                exit 1
                ;;
        esac
    fi
}

main "$@"
