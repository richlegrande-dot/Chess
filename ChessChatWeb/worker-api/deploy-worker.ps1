# Automated Cloudflare Worker Deployment Script (WASM)
# Deploys Worker with Stockfish WASM - no VPS required

param(
    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$Test = $true
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Cloudflare Worker Deployment (Stockfish WASM)        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Change to worker-api directory
$WorkerPath = "$PSScriptRoot"
Set-Location $WorkerPath

# Check if wrangler is available
Write-Host "🔍 Checking for Wrangler CLI..." -ForegroundColor Green
try {
    $WranglerVersion = npx wrangler --version 2>&1
    Write-Host "✓ Wrangler found: $WranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Wrangler not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installing Wrangler..." -ForegroundColor Yellow
    npm install -g wrangler
}

# Install dependencies
Write-Host ""
Write-Host "📦 Installing dependencies..." -ForegroundColor Green
npm install

# Generate Prisma client
Write-Host ""
Write-Host "🔧 Generating Prisma client..." -ForegroundColor Green
npm run prisma:generate

# Deploy Worker
if ($Deploy) {
    Write-Host ""
    Write-Host "🚀 Deploying Worker to Cloudflare..." -ForegroundColor Green
    npx wrangler deploy
    
    Write-Host ""
    Write-Host "✓ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Worker is now live with Stockfish WASM:" -ForegroundColor Cyan
    Write-Host "  - No VPS required" -ForegroundColor White
    Write-Host "  - Zero infrastructure cost" -ForegroundColor White
    Write-Host "  - Global edge deployment" -ForegroundColor White
    Write-Host ""
    
    # Run tests if requested
    if ($Test) {
        Write-Host ""
        Write-Host "🧪 Running post-deployment tests..." -ForegroundColor Green
        Write-Host ""
        
        # Wait for deployment to propagate
        Start-Sleep -Seconds 5
        
        # Run test script if it exists
        if (Test-Path "$PSScriptRoot\test-wasm.js") {
            node "$PSScriptRoot\test-wasm.js"
        } else {
            Write-Host "⚠️  Test script not found, skipping tests" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Dry run complete. To deploy, run:" -ForegroundColor Yellow
    Write-Host "    .\deploy-worker.ps1 -Deploy" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use Wrangler directly:" -ForegroundColor Yellow
    Write-Host "    npx wrangler deploy" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Deployment Ready!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
