# Manual Deploy Script - Use this until GitHub automation is set up
# Builds and deploys directly to production

param(
    [switch]$SkipBuild = $false
)

Write-Output "🚀 Manual Production Deployment to chesschat.uk`n"

# Build if not skipped
if (-not $SkipBuild) {
    Write-Output "📦 Building project..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Output "❌ Build failed!"
        exit 1
    }
    Write-Output "✅ Build complete`n"
} else {
    Write-Output "⏭️  Skipping build (using existing dist/)`n"
}

# Deploy
Write-Output "🌐 Deploying to Cloudflare Pages (production)..."
npx wrangler pages deploy dist --project-name=chesschat --branch=main --commit-dirty=true

if ($LASTEXITCODE -eq 0) {
    Write-Output "`n╔══════════════════════════════════════════════════════╗"
    Write-Output "║  ✅ DEPLOYMENT SUCCESSFUL!                            ║"
    Write-Output "╚══════════════════════════════════════════════════════╝`n"
    Write-Output "🌐 Production URL: https://chesschat.uk"
    Write-Output "⏰ Changes will be live in 1-2 minutes"
    Write-Output "🔄 Hard refresh browser to see changes: Ctrl+Shift+F5`n"
} else {
    Write-Output "`n❌ Deployment failed - check errors above`n"
    exit 1
}
