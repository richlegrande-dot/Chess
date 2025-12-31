# Automated Render.com Deployment Script
# Configures Cloudflare Worker to use Render-hosted Stockfish server

param(
    [Parameter(Mandatory=$false)]
    [string]$RenderUrl = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Render.com Stockfish Deployment                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Prompt for Render URL if not provided
if (-not $RenderUrl) {
    Write-Host "📝 Enter your Render service URL" -ForegroundColor Yellow
    Write-Host "   Example: https://chesschat-stockfish.onrender.com" -ForegroundColor Gray
    Write-Host ""
    $RenderUrl = Read-Host "Render URL"
}

# Remove trailing slash
$RenderUrl = $RenderUrl.TrimEnd('/')

# Prompt for API key if not provided
if (-not $ApiKey) {
    Write-Host ""
    Write-Host "📝 Enter your Stockfish API key" -ForegroundColor Yellow
    Write-Host "   (Found in Render Dashboard → Service → Environment)" -ForegroundColor Gray
    Write-Host ""
    $ApiKey = Read-Host "API Key" -AsSecureString
    $ApiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ApiKey)
    )
}

Write-Host ""
Write-Host "🔍 Testing Render service..." -ForegroundColor Green
Write-Host ""

# Test health endpoint
try {
    Write-Host "   Testing health endpoint..." -ForegroundColor Gray
    $healthUrl = "$RenderUrl/health"
    $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 60
    
    if ($response.status -eq "healthy") {
        Write-Host "   ✅ Service is healthy" -ForegroundColor Green
        Write-Host "      Engine: $($response.engine)" -ForegroundColor Gray
        Write-Host "      Uptime: $($response.uptime)" -ForegroundColor Gray
    } else {
        throw "Service health check failed: $($response.status)"
    }
} catch {
    Write-Host "   ⚠️  Health check failed (service may be spinning up)" -ForegroundColor Yellow
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   This is normal for Render free tier cold starts." -ForegroundColor Gray
    Write-Host "   Waiting 30 seconds for service to wake up..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    try {
        Write-Host "   Retrying health check..." -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 60
        Write-Host "   ✅ Service is now healthy" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Service still unavailable" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check your Render Dashboard:" -ForegroundColor Yellow
        Write-Host "  1. Is the service running?" -ForegroundColor White
        Write-Host "  2. Are there any error logs?" -ForegroundColor White
        Write-Host "  3. Is the URL correct?" -ForegroundColor White
        exit 1
    }
}

# Test move computation
Write-Host ""
Write-Host "   Testing move computation..." -ForegroundColor Gray
try {
    $moveUrl = "$RenderUrl/compute-move"
    $body = @{
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        cpuLevel = 5
    } | ConvertTo-Json
    
    $headers = @{
        "Authorization" = "Bearer $ApiKey"
        "Content-Type" = "application/json"
    }
    
    $moveResponse = Invoke-RestMethod -Uri $moveUrl -Method Post -Body $body -Headers $headers -TimeoutSec 60
    
    if ($moveResponse.success) {
        Write-Host "   ✅ Move computation successful" -ForegroundColor Green
        Write-Host "      Move: $($moveResponse.move)" -ForegroundColor Gray
        Write-Host "      Depth: $($moveResponse.diagnostics.depth)" -ForegroundColor Gray
    } else {
        throw "Move computation failed: $($moveResponse.error)"
    }
} catch {
    Write-Host "   ❌ Move computation failed" -ForegroundColor Red
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please verify your API key in Render Dashboard" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Render Service Verified!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Configure Worker secrets
Write-Host "🔧 Configuring Cloudflare Worker..." -ForegroundColor Green
Write-Host ""

$WorkerPath = "$PSScriptRoot\worker-api"
Set-Location $WorkerPath

try {
    # Set STOCKFISH_SERVER_URL
    Write-Host "   Setting STOCKFISH_SERVER_URL..." -ForegroundColor Gray
    $env:STOCKFISH_SERVER_URL = $RenderUrl
    echo $RenderUrl | npx wrangler secret put STOCKFISH_SERVER_URL 2>&1 | Out-Null
    Write-Host "   ✅ STOCKFISH_SERVER_URL configured" -ForegroundColor Green
    
    # Set STOCKFISH_API_KEY
    Write-Host "   Setting STOCKFISH_API_KEY..." -ForegroundColor Gray
    $env:STOCKFISH_API_KEY = $ApiKey
    echo $ApiKey | npx wrangler secret put STOCKFISH_API_KEY 2>&1 | Out-Null
    Write-Host "   ✅ STOCKFISH_API_KEY configured" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to configure secrets" -ForegroundColor Red
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Worker Configuration Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Deploy Worker if requested
if ($Deploy) {
    Write-Host "🚀 Deploying Cloudflare Worker..." -ForegroundColor Green
    Write-Host ""
    
    try {
        npx wrangler deploy
        Write-Host ""
        Write-Host "✅ Worker deployed successfully!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Worker deployment failed" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
        exit 1
    }
    
    Write-Host ""
    Write-Host "🧪 Running post-deployment tests..." -ForegroundColor Green
    Write-Host ""
    
    # Wait for deployment to propagate
    Start-Sleep -Seconds 5
    
    if (Test-Path "$PSScriptRoot\worker-api\test-e2e.js") {
        try {
            $env:WORKER_URL = "https://chesschat.uk"
            node "$PSScriptRoot\worker-api\test-e2e.js"
        } catch {
            Write-Host "⚠️  Some tests failed, but deployment is complete" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "ℹ️  To deploy the Worker, run:" -ForegroundColor Yellow
    Write-Host "    .\deploy-render.ps1 -RenderUrl '$RenderUrl' -ApiKey '[key]' -Deploy" -ForegroundColor White
    Write-Host ""
    Write-Host "Or deploy manually:" -ForegroundColor Yellow
    Write-Host "    cd worker-api" -ForegroundColor White
    Write-Host "    npx wrangler deploy" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Setup Complete! 🎉" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Render URL: $RenderUrl" -ForegroundColor White
Write-Host "  Worker API: https://chesschat.uk/api/chess-move" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Note: Render free tier spins down after 15 min of inactivity" -ForegroundColor Yellow
Write-Host "   First request after idle may take 30s to wake up" -ForegroundColor Gray
Write-Host ""
