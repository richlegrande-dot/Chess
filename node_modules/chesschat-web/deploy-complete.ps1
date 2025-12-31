# Complete Automated Deployment Orchestrator
# This script coordinates the entire deployment process from start to finish

param(
    [Parameter(Mandatory=$true)]
    [string]$VpsIP,
    
    [Parameter(Mandatory=$false)]
    [string]$Domain = "",
    
    [Parameter(Mandatory=$false)]
    [string]$SshUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$SshKeyPath = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "║     🚀 Complete Automated Stockfish Deployment 🚀         ║" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:" -ForegroundColor White
Write-Host "  1. Deploy Stockfish server to VPS" -ForegroundColor Gray
Write-Host "  2. Configure Cloudflare Worker" -ForegroundColor Gray
Write-Host "  3. Test end-to-end integration" -ForegroundColor Gray
Write-Host "  4. Provide management commands" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to cancel, or Enter to continue..." -ForegroundColor Yellow
Read-Host

# Phase 1: Deploy to VPS
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  PHASE 1: VPS Deployment" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

$StockfishServerPath = Join-Path $PSScriptRoot "stockfish-server"
$DeployVpsScript = Join-Path $StockfishServerPath "deploy-to-vps.ps1"

if (-not (Test-Path $DeployVpsScript)) {
    Write-Host "✗ deploy-to-vps.ps1 not found at: $DeployVpsScript" -ForegroundColor Red
    exit 1
}

# Build parameters for VPS deployment
$VpsDeployParams = @{
    VpsIP = $VpsIP
    SshUser = $SshUser
}

if ($Domain) {
    $VpsDeployParams.Domain = $Domain
}

if ($SshKeyPath) {
    $VpsDeployParams.SshKeyPath = $SshKeyPath
}

# Execute VPS deployment
try {
    & $DeployVpsScript @VpsDeployParams
    if ($LASTEXITCODE -ne 0) {
        throw "VPS deployment script failed"
    }
} catch {
    Write-Host ""
    Write-Host "✗ VPS deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check SSH connection: ssh $SshUser@$VpsIP" -ForegroundColor Gray
    Write-Host "  2. Check VPS is accessible" -ForegroundColor Gray
    Write-Host "  3. Review error messages above" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "✓ Phase 1 Complete: VPS deployed successfully" -ForegroundColor Green

# Small pause
Start-Sleep -Seconds 2

# Phase 2: Configure Cloudflare Worker
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  PHASE 2: Cloudflare Worker Configuration" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

$WorkerApiPath = Join-Path $PSScriptRoot "worker-api"
$ConfigureWorkerScript = Join-Path $WorkerApiPath "configure-worker.ps1"

if (-not (Test-Path $ConfigureWorkerScript)) {
    Write-Host "⚠️  configure-worker.ps1 not found" -ForegroundColor Yellow
    Write-Host "Skipping automatic Worker configuration" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Configure manually:" -ForegroundColor Yellow
    Write-Host "  cd worker-api" -ForegroundColor Cyan
    Write-Host "  .\configure-worker.ps1 -Deploy" -ForegroundColor Cyan
} else {
    try {
        & $ConfigureWorkerScript -Deploy
        if ($LASTEXITCODE -ne 0) {
            throw "Worker configuration failed"
        }
        Write-Host ""
        Write-Host "✓ Phase 2 Complete: Worker configured and deployed" -ForegroundColor Green
    } catch {
        Write-Host ""
        Write-Host "⚠️  Worker configuration failed: $_" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "You can configure manually later:" -ForegroundColor Yellow
        Write-Host "  cd worker-api" -ForegroundColor Cyan
        Write-Host "  .\configure-worker.ps1 -Deploy" -ForegroundColor Cyan
    }
}

# Phase 3: End-to-End Testing
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host "  PHASE 3: Integration Testing" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

# Load deployment info
$DeploymentInfoFile = Join-Path $StockfishServerPath "deployment-info.json"
if (Test-Path $DeploymentInfoFile) {
    $DeploymentInfo = Get-Content $DeploymentInfoFile | ConvertFrom-Json
    $ServerUrl = $DeploymentInfo.serverUrl
    $ApiKey = $DeploymentInfo.apiKey
    
    # Test 1: Server Health
    Write-Host "🧪 Test 1: Server Health Check" -ForegroundColor Green
    try {
        $HealthResponse = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 10
        if ($HealthResponse.status -eq "healthy") {
            Write-Host "✓ Server is healthy" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Server returned unexpected status: $($HealthResponse.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    }
    
    # Test 2: Direct API Test
    Write-Host ""
    Write-Host "🧪 Test 2: Direct Stockfish API" -ForegroundColor Green
    try {
        $MoveRequest = @{
            fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            cpuLevel = 5
        } | ConvertTo-Json
        
        $Headers = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $ApiKey"
        }
        
        $MoveResponse = Invoke-RestMethod -Uri "$ServerUrl/compute-move" -Method Post -Body $MoveRequest -Headers $Headers -TimeoutSec 10
        if ($MoveResponse.success) {
            Write-Host "✓ Move computation successful: $($MoveResponse.move)" -ForegroundColor Green
        } else {
            Write-Host "✗ Move computation failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ API test failed: $_" -ForegroundColor Red
    }
    
    # Test 3: Worker API (if available)
    Write-Host ""
    Write-Host "🧪 Test 3: Worker API Integration" -ForegroundColor Green
    $WorkerConfigFile = Join-Path $WorkerApiPath "worker-config.json"
    if (Test-Path $WorkerConfigFile) {
        Write-Host "ℹ️  Test this manually with your Worker domain:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  curl https://your-domain.com/api/chess-move \\" -ForegroundColor Cyan
        Write-Host "    -X POST \\" -ForegroundColor Cyan
        Write-Host "    -H `"Content-Type: application/json`" \\" -ForegroundColor Cyan
        Write-Host "    -d '{`"fen`":`"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`",`"cpuLevel`":5,`"mode`":`"vs-cpu`"}'" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Worker not yet configured" -ForegroundColor Yellow
    }
}

# Final Summary
Write-Host ""
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "║          🎉 DEPLOYMENT COMPLETE! 🎉                       ║" -ForegroundColor Green
Write-Host "║                                                            ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

if (Test-Path $DeploymentInfoFile) {
    $DeploymentInfo = Get-Content $DeploymentInfoFile | ConvertFrom-Json
    
    Write-Host "📋 Deployment Summary" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "VPS IP:            $($DeploymentInfo.vpsIP)" -ForegroundColor White
    if ($DeploymentInfo.domain) {
        Write-Host "Domain:            $($DeploymentInfo.domain)" -ForegroundColor White
    }
    Write-Host "Server URL:        $($DeploymentInfo.serverUrl)" -ForegroundColor White
    Write-Host "Health Check:      $($DeploymentInfo.serverUrl)/health" -ForegroundColor White
    Write-Host "SSH Access:        ssh $($DeploymentInfo.sshUser)@$($DeploymentInfo.vpsIP)" -ForegroundColor White
    Write-Host "Deployed:          $($DeploymentInfo.deployedAt)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🔑 API Key" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
    Write-Host "$($DeploymentInfo.apiKey)" -ForegroundColor White
    Write-Host "⚠️  Save this key securely!" -ForegroundColor Red
    Write-Host ""
}

Write-Host "📝 Quick Access Commands" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Load management commands:" -ForegroundColor White
Write-Host "  . .\stockfish-server\vps-commands.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "View server logs:" -ForegroundColor White
Write-Host "  ssh $SshUser@$VpsIP 'pm2 logs stockfish-server'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Restart server:" -ForegroundColor White
Write-Host "  ssh $SshUser@$VpsIP 'pm2 restart stockfish-server'" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deploy Worker:" -ForegroundColor White
Write-Host "  cd worker-api; npx wrangler deploy" -ForegroundColor Cyan
Write-Host ""

Write-Host "📊 Monitoring" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Set up monitoring at:" -ForegroundColor White
Write-Host "  UptimeRobot: https://uptimerobot.com/" -ForegroundColor Cyan
Write-Host "  Monitor URL: $($DeploymentInfo.serverUrl)/health" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Your Stockfish server is now live and ready! ✨" -ForegroundColor Green
Write-Host ""
