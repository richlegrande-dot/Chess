#!/bin/bash
set -e

# Rollback Script for Cloudflare Pages Deployments
# This script helps rollback to a previous deployment

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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Function to check authentication
check_authentication() {
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed"
        exit 1
    fi
    
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    fi
}

# Function to list recent deployments
list_deployments() {
    log_info "Fetching recent deployments for: $PROJECT_NAME"
    echo ""
    
    wrangler pages deployment list --project-name="$PROJECT_NAME" | head -20
}

# Function to get deployment details
get_deployment_details() {
    local deployment_id="$1"
    
    log_info "Fetching deployment details..."
    
    # Note: wrangler doesn't have a direct command to get deployment details
    # This would need to be done via API
    log_warning "Detailed deployment info requires manual inspection in dashboard"
    log_info "Dashboard: https://dash.cloudflare.com/ > Workers & Pages > $PROJECT_NAME"
}

# Function to rollback to specific deployment
rollback_to_deployment() {
    local deployment_id="$1"
    
    if [ -z "$deployment_id" ]; then
        log_error "Deployment ID is required"
        return 1
    fi
    
    log_warning "Cloudflare Pages doesn't support direct rollback via CLI"
    log_info "To rollback, you need to:"
    log_info "  1. Go to Cloudflare Dashboard"
    log_info "  2. Navigate to Workers & Pages > $PROJECT_NAME"
    log_info "  3. Find deployment: $deployment_id"
    log_info "  4. Click 'Rollback to this deployment'"
    log_info ""
    log_info "Alternatively, you can:"
    log_info "  1. Check out the specific commit in git"
    log_info "  2. Run deployment script: scripts/deploy/deploy.sh"
}

# Function to rollback using git
rollback_using_git() {
    local commit_sha="$1"
    
    if [ -z "$commit_sha" ]; then
        log_error "Commit SHA is required"
        return 1
    fi
    
    log_info "Rolling back to commit: $commit_sha"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        return 1
    fi
    
    # Save current state
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    log_info "Current branch: $current_branch"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_error "You have uncommitted changes. Please commit or stash them first."
        return 1
    fi
    
    # Confirm rollback
    log_warning "This will checkout commit $commit_sha and deploy it"
    read -p "Continue? (y/N): " confirm
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "Rollback cancelled"
        return 0
    fi
    
    # Checkout commit
    log_info "Checking out commit: $commit_sha"
    git checkout "$commit_sha"
    
    # Deploy
    log_info "Deploying rollback..."
    bash "$ROOT_DIR/scripts/deploy/deploy.sh"
    
    if [ $? -eq 0 ]; then
        log_success "Rollback deployment completed"
        log_info "To return to your previous branch: git checkout $current_branch"
    else
        log_error "Rollback deployment failed"
        log_info "Returning to previous branch..."
        git checkout "$current_branch"
        return 1
    fi
}

# Function to view deployment history
view_deployment_history() {
    log_info "Viewing deployment history..."
    
    local history_file="$ROOT_DIR/.deployment-history.json"
    
    if [ ! -f "$history_file" ]; then
        log_warning "No deployment history file found"
        log_info "History is tracked starting from first deployment with this script"
        return 0
    fi
    
    if command -v jq &> /dev/null; then
        log_info "Recent deployments from history:"
        echo ""
        jq -r '.[] | "\(.timestamp) | \(.environment) | \(.commit) | \(.status)"' "$history_file" | tail -20
    else
        log_info "Install 'jq' for formatted output"
        cat "$history_file"
    fi
}

# Function to create rollback branch
create_rollback_branch() {
    local commit_sha="$1"
    local branch_name="rollback-$(date +%Y%m%d-%H%M%S)"
    
    if [ -z "$commit_sha" ]; then
        log_error "Commit SHA is required"
        return 1
    fi
    
    log_info "Creating rollback branch: $branch_name"
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        return 1
    fi
    
    # Create branch from commit
    git branch "$branch_name" "$commit_sha"
    
    if [ $? -eq 0 ]; then
        log_success "Rollback branch created: $branch_name"
        log_info "To deploy this rollback:"
        log_info "  1. git checkout $branch_name"
        log_info "  2. git push origin $branch_name"
        log_info "  3. Deploy via GitHub Actions or run scripts/deploy/deploy.sh"
    else
        log_error "Failed to create rollback branch"
        return 1
    fi
}

# Function to show rollback procedures
show_rollback_procedures() {
    cat <<EOF

========================================
Rollback Procedures
========================================

Method 1: Using Cloudflare Dashboard (Recommended)
  1. Go to https://dash.cloudflare.com/
  2. Navigate to Workers & Pages > $PROJECT_NAME
  3. Click on "View build" for the deployment you want to rollback to
  4. Click "Rollback to this deployment"
  5. Confirm the rollback
  
  Pros: Simple, immediate, no code changes needed
  Cons: Only works for recent deployments in history

Method 2: Using Git + Redeployment
  1. Find the commit SHA you want to rollback to
  2. Run: $0 git-rollback <commit-sha>
  3. This will checkout the commit and trigger deployment
  
  Pros: Works for any historical commit
  Cons: Temporarily changes your working directory

Method 3: Create Rollback Branch
  1. Find the commit SHA you want to rollback to
  2. Run: $0 create-branch <commit-sha>
  3. Push the new branch and deploy via CI/CD
  
  Pros: Clean, trackable, doesn't affect working directory
  Cons: Requires additional steps

Method 4: Manual Reversion
  1. git revert <commit-sha-to-undo>
  2. git push
  3. Let CI/CD deploy the reversion
  
  Pros: Creates a new commit, preserves history
  Cons: May require resolving conflicts

Preventing Need for Rollbacks:
  - Use preview deployments to test changes
  - Run pre-deploy validation: scripts/validate/pre-deploy.sh
  - Test builds locally: npm run build
  - Review deployment logs before promoting to production
  - Use feature flags for gradual rollouts

EOF
}

# Function to show usage
show_usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
    list                      List recent deployments
    history                   View deployment history from .deployment-history.json
    git-rollback <commit>     Rollback by checking out commit and redeploying
    create-branch <commit>    Create a rollback branch from specific commit
    procedures                Show detailed rollback procedures
    
Environment Variables:
    PROJECT_NAME             Set Pages project name (default: chesschat-web)

Examples:
    $0 list
    $0 history
    $0 git-rollback abc123
    $0 create-branch abc123
    $0 procedures

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
        list)
            check_authentication
            list_deployments
            ;;
        history)
            view_deployment_history
            ;;
        git-rollback)
            check_authentication
            local commit_sha="$2"
            if [ -z "$commit_sha" ]; then
                log_error "Commit SHA is required"
                show_usage
                exit 1
            fi
            rollback_using_git "$commit_sha"
            ;;
        create-branch)
            local commit_sha="$2"
            if [ -z "$commit_sha" ]; then
                log_error "Commit SHA is required"
                show_usage
                exit 1
            fi
            create_rollback_branch "$commit_sha"
            ;;
        procedures)
            show_rollback_procedures
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
