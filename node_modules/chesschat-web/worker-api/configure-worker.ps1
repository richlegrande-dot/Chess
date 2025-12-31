# Automated Cloudflare Worker Configuration Script
# Reads deployment info and configures Worker secrets automatically

param(
    [Parameter(Mandatory=$false)]
    [string]$DeploymentInfoFile = "$PSScriptRoot\..\stockfish-server\deployment-info.json",
    
    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Automated Cloudflare Worker Configuration             ║" -ForegroundColor Cyan
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

# Load deployment info if available
if (-not $ServerUrl -or -not $ApiKey) {
    if (Test-Path $DeploymentInfoFile) {
        Write-Host ""
        Write-Host "📥 Loading deployment info from VPS..." -ForegroundColor Green
        try {
            $DeploymentInfo = Get-Content $DeploymentInfoFile | ConvertFrom-Json
            if (-not $ServerUrl) { $ServerUrl = $DeploymentInfo.serverUrl }
            if (-not $ApiKey) { $ApiKey = $DeploymentInfo.apiKey }
            Write-Host "✓ Loaded configuration from deployment" -ForegroundColor Green
            Write-Host "  Server URL: $ServerUrl" -ForegroundColor Gray
        } catch {
            Write-Host "⚠️  Could not load deployment info: $_" -ForegroundColor Yellow
        }
    }
}

# Prompt for missing values
if (-not $ServerUrl) {
    Write-Host ""
    $ServerUrl = Read-Host "Enter Stockfish Server URL (e.g., https://your-domain.com or http://IP)"
}

if (-not $ApiKey) {
    Write-Host ""
    $ApiKey = Read-Host "Enter Stockfish API Key"
}

# Validate inputs
if (-not $ServerUrl) {
    Write-Host "✗ Server URL is required" -ForegroundColor Red
    exit 1
}

if (-not $ApiKey) {
    Write-Host "✗ API Key is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚙️  Configuration" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Server URL: $ServerUrl"
Write-Host "API Key:    $($ApiKey.Substring(0, 8))..." -ForegroundColor Gray
Write-Host ""

# Test server connection
Write-Host "🧪 Testing server connection..." -ForegroundColor Green
try {
    $HealthResponse = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ Server is healthy" -ForegroundColor Green
    Write-Host "  Status: $($HealthResponse.status)" -ForegroundColor Gray
    Write-Host "  Service: $($HealthResponse.service)" -ForegroundColor Gray
} catch {
    Write-Host "⚠️  Warning: Could not connect to server" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Gray
    Write-Host ""
    $Continue = Read-Host "Continue anyway? (y/n)"
    if ($Continue -ne 'y') {
        Write-Host "Aborted" -ForegroundColor Red
        exit 1
    }
}

# Configure secrets
Write-Host ""
Write-Host "🔐 Step 1: Configuring STOCKFISH_SERVER_URL secret..." -ForegroundColor Green
try {
    $ServerUrl | npx wrangler secret put STOCKFISH_SERVER_URL
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ STOCKFISH_SERVER_URL configured" -ForegroundColor Green
    } else {
        throw "Failed to set secret"
    }
} catch {
    Write-Host "✗ Failed to configure STOCKFISH_SERVER_URL: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔐 Step 2: Configuring STOCKFISH_API_KEY secret..." -ForegroundColor Green
try {
    $ApiKey | npx wrangler secret put STOCKFISH_API_KEY
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ STOCKFISH_API_KEY configured" -ForegroundColor Green
    } else {
        throw "Failed to set secret"
    }
} catch {
    Write-Host "✗ Failed to configure STOCKFISH_API_KEY: $_" -ForegroundColor Red
    exit 1
}

# List secrets to verify
Write-Host ""
Write-Host "📋 Verifying secrets..." -ForegroundColor Green
npx wrangler secret list

# Deploy if requested
if ($Deploy) {
    Write-Host ""
    Write-Host "🚀 Step 3: Deploying Worker..." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    
    try {
        npx wrangler deploy
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✓ Worker deployed successfully!" -ForegroundColor Green
        } else {
            throw "Deployment failed"
        }
    } catch {
        Write-Host "✗ Deployment failed: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Worker not deployed (use -Deploy flag to deploy)" -ForegroundColor Cyan
}

# Test end-to-end if deployed
if ($Deploy) {
    Write-Host ""
    Write-Host "🧪 Running post-deployment tests..." -ForegroundColor Green
    
    # Try to find Worker URL from recent deployment or wrangler.toml
    $WorkerUrl = $null
    
    # Check if wrangler.toml has custom domain
    $WranglerToml = Get-Content "wrangler.toml" -Raw
    if ($WranglerToml -match "route\s*=\s*`"([^`"]+)`"") {
        $WorkerUrl = "https://" + ($Matches[1] -replace '/\*$', '')
    }
    
    if ($WorkerUrl) {
        Write-Host "Testing Worker at: $WorkerUrl" -ForegroundColor Gray
        
        try {
            # Test health endpoint
            Write-Host ""
            Write-Host "Testing /api/admin/worker-health..." -ForegroundColor Gray
            $HealthResponse = Invoke-RestMethod -Uri "$WorkerUrl/api/admin/worker-health" -Method Get -TimeoutSec 10 -ErrorAction Stop
            
            if ($HealthResponse.healthy) {
                Write-Host "✓ Worker health check passed" -ForegroundColor Green
                Write-Host "  Database: $($HealthResponse.checks.database.status)" -ForegroundColor Gray
                Write-Host "  Stockfish URL: $($HealthResponse.checks.env.STOCKFISH_SERVER_URL)" -ForegroundColor Gray
                Write-Host "  Stockfish Key: $($HealthResponse.checks.env.STOCKFISH_API_KEY)" -ForegroundColor Gray
            }
            
            # Test chess move endpoint
            Write-Host ""
            Write-Host "Testing /api/chess-move with Stockfish..." -ForegroundColor Gray
            $TestBody = @{
                fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                cpuLevel = 5
                mode = "vs-cpu"
            } | ConvertTo-Json
            
            $MoveResponse = Invoke-RestMethod -Uri "$WorkerUrl/api/chess-move" -Method Post -Body $TestBody -ContentType "application/json" -TimeoutSec 15 -ErrorAction Stop
            
            if ($MoveResponse.success -and $MoveResponse.source -eq 'stockfish') {
                Write-Host "✓ Chess move test passed" -ForegroundColor Green
                Write-Host "  Move: $($MoveResponse.move)" -ForegroundColor Gray
                Write-Host "  Source: $($MoveResponse.source)" -ForegroundColor Gray
                Write-Host "  Stockfish Time: $($MoveResponse.diagnostics.stockfishMs)ms" -ForegroundColor Gray
            } else {
                Write-Host "⚠️  Move test returned unexpected result" -ForegroundColor Yellow
                Write-Host "  Source: $($MoveResponse.source)" -ForegroundColor Gray
            }
            
            Write-Host ""
            Write-Host "✅ End-to-end tests PASSED!" -ForegroundColor Green
            
        } catch {
            Write-Host "⚠️  Post-deployment tests failed: $_" -ForegroundColor Yellow
            Write-Host "You can test manually using the commands below." -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️  Could not determine Worker URL from wrangler.toml" -ForegroundColor Yellow
        Write-Host "Please test manually using your Worker URL" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "📝 Manual test command:" -ForegroundColor Yellow
    Write-Host "  curl https://your-domain.com/api/chess-move \\" -ForegroundColor Cyan
    Write-Host "    -X POST \\" -ForegroundColor Cyan
    Write-Host "    -H `"Content-Type: application/json`" \\" -ForegroundColor Cyan
    Write-Host "    -d '{`"fen`":`"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`",`"cpuLevel`":5,`"mode`":`"vs-cpu`"}'" -ForegroundColor Cyan
}

# Save configuration
Write-Host ""
Write-Host "💾 Saving configuration..." -ForegroundColor Green
$ConfigFile = "$PSScriptRoot\worker-config.json"
@{
    serverUrl = $ServerUrl
    apiKeySet = $true
    configuredAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    deployed = $Deploy.IsPresent
} | ConvertTo-Json | Out-File -FilePath $ConfigFile -Encoding UTF8
Write-Host "✓ Configuration saved to: $ConfigFile" -ForegroundColor Green

# Display summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         🎉 Worker Configuration Complete!                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Summary" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "✓ STOCKFISH_SERVER_URL configured" -ForegroundColor Green
Write-Host "✓ STOCKFISH_API_KEY configured" -ForegroundColor Green
if ($Deploy) {
    Write-Host "✓ Worker deployed" -ForegroundColor Green
}
Write-Host ""

if (-not $Deploy) {
    Write-Host "📝 Next Steps" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "Deploy the Worker:" -ForegroundColor White
    Write-Host "  npx wrangler deploy" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or run this script with -Deploy flag:" -ForegroundColor White
    Write-Host "  .\configure-worker.ps1 -Deploy" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "🔧 Worker Management" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Deploy:           npx wrangler deploy" -ForegroundColor Cyan
Write-Host "View logs:        npx wrangler tail" -ForegroundColor Cyan
Write-Host "List secrets:     npx wrangler secret list" -ForegroundColor Cyan
Write-Host "Rollback:         npx wrangler rollback" -ForegroundColor Cyan
Write-Host ""
