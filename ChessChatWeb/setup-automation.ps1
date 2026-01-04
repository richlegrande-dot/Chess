# Quick Setup Script for Automated Deployments
# This script helps you get your Cloudflare credentials for GitHub Secrets

Write-Output "╔══════════════════════════════════════════════════════╗"
Write-Output "║  AUTOMATED DEPLOYMENT SETUP                          ║"
Write-Output "╚══════════════════════════════════════════════════════╝`n"

Write-Output "📋 You need to add 2 secrets to GitHub:`n"

Write-Output "1️⃣ CLOUDFLARE_API_TOKEN"
Write-Output "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "   Get it from: https://dash.cloudflare.com/profile/api-tokens"
Write-Output "   Steps:"
Write-Output "   • Click 'Create Token'"
Write-Output "   • Use template: 'Edit Cloudflare Workers'"
Write-Output "   • OR create custom with: Cloudflare Pages Edit permission"
Write-Output "   • Copy the token`n"

Write-Output "2️⃣ CLOUDFLARE_ACCOUNT_ID"
Write-Output "   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "   Get it from: https://dash.cloudflare.com"
Write-Output "   Steps:"
Write-Output "   • Click 'Workers & Pages' in sidebar"
Write-Output "   • Click 'chesschat' project"
Write-Output "   • Account ID is shown in the right sidebar`n"

Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

Write-Output "📝 Add these to GitHub:"
Write-Output "   1. Go to: https://github.com/richlegrande-dot/Chess"
Write-Output "   2. Settings → Secrets and variables → Actions"
Write-Output "   3. Click 'New repository secret'"
Write-Output "   4. Add both secrets with name and value`n"

Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

Write-Output "✨ AFTER SETUP:"
Write-Output "   • Push to main = Automatic deployment!"
Write-Output "   • No more manual wrangler commands"
Write-Output "   • Changes go live at chesschat.uk in 2-3 minutes`n"

Write-Output "🧪 TEST THE AUTOMATION:"
Write-Output "   1. Make a small change"
Write-Output "   2. git add ."
Write-Output "   3. git commit -m 'Test auto-deploy'"
Write-Output "   4. git push origin main"
Write-Output "   5. Watch Actions tab: github.com/richlegrande-dot/Chess/actions`n"

$response = Read-Host "Would you like to open the GitHub secrets page now? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    Start-Process "https://github.com/richlegrande-dot/Chess/settings/secrets/actions"
    Write-Output "`n✅ Opened GitHub secrets page in browser"
}

$response2 = Read-Host "`nWould you like to open Cloudflare dashboard? (y/n)"
if ($response2 -eq 'y' -or $response2 -eq 'Y') {
    Start-Process "https://dash.cloudflare.com/profile/api-tokens"
    Write-Output "`n✅ Opened Cloudflare API tokens page in browser"
}

Write-Output "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Output "📖 Full documentation: .github/DEPLOYMENT_SETUP.md"
Write-Output "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"
