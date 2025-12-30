# Automated VPS Deployment Script for Windows
# This script uploads files to VPS and triggers deployment

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

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     Automated VPS Deployment for Stockfish Server         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Configuration
$LocalPath = "$PSScriptRoot"
$RemotePath = "/root/stockfish-server"
$DeploymentInfoFile = "$PSScriptRoot/deployment-info.json"

# Build SSH command options
$SshOptions = @()
if ($SshKeyPath) {
    $SshOptions += "-i"
    $SshOptions += $SshKeyPath
}
$SshTarget = "$SshUser@$VpsIP"

Write-Host "📋 Deployment Configuration" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "VPS IP:        $VpsIP"
Write-Host "Domain:        $(if ($Domain) { $Domain } else { 'Using IP' })"
Write-Host "SSH User:      $SshUser"
Write-Host "Local Path:    $LocalPath"
Write-Host "Remote Path:   $RemotePath"
Write-Host ""

# Test SSH connection
Write-Host "🔌 Step 1: Testing SSH connection..." -ForegroundColor Green
try {
    $TestCmd = "echo 'Connection successful'"
    $Result = ssh @SshOptions $SshTarget $TestCmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "✗ SSH connection failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Verify VPS IP is correct"
    Write-Host "2. Check SSH is enabled on VPS"
    Write-Host "3. Try: ssh $SshTarget"
    Write-Host "4. Use -SshKeyPath if using SSH key authentication"
    exit 1
}

# Create remote directory
Write-Host ""
Write-Host "📁 Step 2: Creating remote directory..." -ForegroundColor Green
ssh @SshOptions $SshTarget "mkdir -p $RemotePath"
Write-Host "✓ Remote directory created" -ForegroundColor Green

# Upload files
Write-Host ""
Write-Host "📤 Step 3: Uploading files to VPS..." -ForegroundColor Green
Write-Host "This may take a minute..." -ForegroundColor Gray

$FilesToUpload = @(
    "server.js",
    "package.json",
    "package-lock.json",
    "test-server.js",
    "test-tactical.js",
    "deploy-vps.sh",
    "README.md",
    ".env.example"
)

$UploadCount = 0
foreach ($File in $FilesToUpload) {
    $FilePath = Join-Path $LocalPath $File
    if (Test-Path $FilePath) {
        Write-Host "  Uploading $File..." -ForegroundColor Gray
        if ($SshKeyPath) {
            scp -i $SshKeyPath $FilePath "${SshTarget}:${RemotePath}/"
        } else {
            scp $FilePath "${SshTarget}:${RemotePath}/"
        }
        if ($LASTEXITCODE -eq 0) {
            $UploadCount++
        }
    } else {
        Write-Host "  ⚠️  $File not found, skipping..." -ForegroundColor Yellow
    }
}

Write-Host "✓ Uploaded $UploadCount files" -ForegroundColor Green

# Make deploy script executable
Write-Host ""
Write-Host "🔧 Step 4: Preparing deployment script..." -ForegroundColor Green
ssh @SshOptions $SshTarget "chmod +x $RemotePath/deploy-vps.sh"
Write-Host "✓ Deploy script ready" -ForegroundColor Green

# Run deployment
Write-Host ""
Write-Host "🚀 Step 5: Running deployment on VPS..." -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host ""

# Create deployment command
$DeployCmd = "cd $RemotePath && ./deploy-vps.sh"

# If domain specified, pass it non-interactively
if ($Domain) {
    $DeployCmd = @"
cd $RemotePath
export DEBIAN_FRONTEND=noninteractive
export DOMAIN_NAME='$Domain'
export SERVER_PORT=3001
export SETUP_SSL=y
./deploy-vps.sh
"@
}

# Execute deployment
$DeployOutput = ssh @SshOptions $SshTarget $DeployCmd 2>&1

# Display output
$DeployOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Deployment script encountered issues" -ForegroundColor Yellow
    Write-Host "Check the output above for details" -ForegroundColor Yellow
}

# Get API key from server
Write-Host ""
Write-Host "🔑 Step 6: Retrieving configuration..." -ForegroundColor Green

# Copy deployment-info.json from VPS if it exists
$RemoteDeploymentInfo = "$RemotePath/deployment-info.json"
$TempDeploymentInfo = "$PSScriptRoot/deployment-info-remote.json"

try {
    if ($SshKeyPath) {
        scp -i $SshKeyPath "${SshTarget}:${RemoteDeploymentInfo}" $TempDeploymentInfo 2>$null
    } else {
        scp "${SshTarget}:${RemoteDeploymentInfo}" $TempDeploymentInfo 2>$null
    }
    
    if (Test-Path $TempDeploymentInfo) {
        $RemoteInfo = Get-Content $TempDeploymentInfo -Raw | ConvertFrom-Json
        $ApiKey = $RemoteInfo.apiKey
        $ServerUrl = $RemoteInfo.serverUrl
        Remove-Item $TempDeploymentInfo
        Write-Host "✓ Configuration retrieved from VPS" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not retrieve deployment-info.json, trying .env..." -ForegroundColor Yellow
}

# Fallback to reading .env
if (-not $ApiKey) {
    $ApiKey = ssh @SshOptions $SshTarget "grep STOCKFISH_API_KEY $RemotePath/.env 2>/dev/null | cut -d'=' -f2" 2>$null
    $ServerUrl = if ($Domain) { "https://$Domain" } else { "http://$VpsIP" }
}

if ($ApiKey) {
    Write-Host "✓ API Key: $($ApiKey.Substring(0,16))..." -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not retrieve API key automatically" -ForegroundColor Yellow
    Write-Host "You can get it manually by running:" -ForegroundColor Yellow
    Write-Host "  ssh $SshTarget 'cat $RemotePath/.env'" -ForegroundColor Gray
}

# Test deployment
Write-Host ""
Write-Host "🧪 Step 7: Testing deployment..." -ForegroundColor Green

Start-Sleep -Seconds 3

$HealthPassed = $false
$MoveTestPassed = $false

try {
    $HealthResponse = Invoke-RestMethod -Uri "$ServerUrl/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ Health check passed!" -ForegroundColor Green
    Write-Host "  Status: $($HealthResponse.status)" -ForegroundColor Gray
    Write-Host "  Engines: $($HealthResponse.engines.active)/$($HealthResponse.engines.max)" -ForegroundColor Gray
    $HealthPassed = $true
    
    # Test move computation
    Write-Host ""
    Write-Host "Testing move computation..." -ForegroundColor Gray
    $TestBody = @{
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        cpuLevel = 5
    } | ConvertTo-Json
    
    $Headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ApiKey"
    }
    
    $MoveResponse = Invoke-RestMethod -Uri "$ServerUrl/compute-move" -Method Post -Body $TestBody -Headers $Headers -TimeoutSec 15 -ErrorAction Stop
    
    if ($MoveResponse.success) {
        Write-Host "✓ Move computation test passed!" -ForegroundColor Green
        Write-Host "  Move: $($MoveResponse.move)" -ForegroundColor Gray
        Write-Host "  Engine Time: $($MoveResponse.diagnostics.engineMs)ms" -ForegroundColor Gray
        Write-Host "  Source: $($MoveResponse.source)" -ForegroundColor Gray
        $MoveTestPassed = $true
    }
} catch {
    Write-Host "⚠️  Test failed: $_" -ForegroundColor Yellow
    Write-Host "The server may still be starting up. You can test manually:" -ForegroundColor Yellow
    Write-Host "  curl $ServerUrl/health" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check PM2 logs:" -ForegroundColor Yellow
    Write-Host "  ssh $SshTarget 'pm2 logs stockfish-server --lines 50'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📊 Test Results:" -ForegroundColor Yellow
Write-Host "  Health Check:  $(if ($HealthPassed) { '✅ PASS' } else { '❌ FAIL' })" -ForegroundColor $(if ($HealthPassed) { 'Green' } else { 'Red' })
Write-Host "  Move Computation: $(if ($MoveTestPassed) { '✅ PASS' } else { '⚠️  SKIP' })" -ForegroundColor $(if ($MoveTestPassed) { 'Green' } else { 'Yellow' })

# Save deployment info
Write-Host ""
Write-Host "💾 Step 8: Saving deployment information..." -ForegroundColor Green

$DeploymentInfo = @{
    vpsIP = $VpsIP
    domain = $Domain
    serverUrl = $ServerUrl
    apiKey = $ApiKey
    sshUser = $SshUser
    remotePath = $RemotePath
    deployedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

$DeploymentInfo | ConvertTo-Json | Out-File -FilePath $DeploymentInfoFile -Encoding UTF8
Write-Host "✓ Deployment info saved to: $DeploymentInfoFile" -ForegroundColor Green

# Display summary
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              🎉 Deployment Complete!                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Deployment Summary" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "Server URL:        $ServerUrl" -ForegroundColor White
Write-Host "Health Endpoint:   $ServerUrl/health" -ForegroundColor White
if ($ApiKey) {
    Write-Host "API Key:           $ApiKey" -ForegroundColor White
}
Write-Host "SSH Access:        ssh $SshTarget" -ForegroundColor White
Write-Host "Deployment Info:   $DeploymentInfoFile" -ForegroundColor White
Write-Host ""
Write-Host "📝 Next Steps" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "1. Configure Cloudflare Worker:" -ForegroundColor White
Write-Host "   Run: .\configure-worker.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Or manually configure:" -ForegroundColor White
Write-Host "   cd ..\worker-api" -ForegroundColor Cyan
Write-Host "   npx wrangler secret put STOCKFISH_SERVER_URL" -ForegroundColor Cyan
Write-Host "   (Enter: $ServerUrl)" -ForegroundColor Gray
Write-Host "   npx wrangler secret put STOCKFISH_API_KEY" -ForegroundColor Cyan
if ($ApiKey) {
    Write-Host "   (Enter: $ApiKey)" -ForegroundColor Gray
}
Write-Host "   npx wrangler deploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Server Management" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Yellow
Write-Host "View logs:    ssh $SshTarget 'pm2 logs stockfish-server'" -ForegroundColor Cyan
Write-Host "Restart:      ssh $SshTarget 'pm2 restart stockfish-server'" -ForegroundColor Cyan
Write-Host "Status:       ssh $SshTarget 'pm2 status'" -ForegroundColor Cyan
Write-Host ""

# Save quick access commands
$QuickCommandsFile = "$PSScriptRoot/vps-commands.ps1"
@"
# Quick VPS Management Commands
# Generated: $(Get-Date)

# View logs
function Show-Logs {
    ssh $SshTarget 'pm2 logs stockfish-server --lines 50'
}

# Restart server
function Restart-Server {
    ssh $SshTarget 'pm2 restart stockfish-server'
}

# Check status
function Get-Status {
    ssh $SshTarget 'pm2 status'
}

# SSH to server
function Connect-VPS {
    ssh $SshTarget
}

# Test health
function Test-Health {
    curl $ServerUrl/health
}

Write-Host "Available commands:" -ForegroundColor Green
Write-Host "  Show-Logs       - View server logs"
Write-Host "  Restart-Server  - Restart the server"
Write-Host "  Get-Status      - Check PM2 status"
Write-Host "  Connect-VPS     - SSH to VPS"
Write-Host "  Test-Health     - Test health endpoint"
"@ | Out-File -FilePath $QuickCommandsFile -Encoding UTF8

Write-Host "✓ Quick commands saved to: $QuickCommandsFile" -ForegroundColor Green
Write-Host "  Load with: . .\vps-commands.ps1" -ForegroundColor Gray
Write-Host ""
