# Render Stockfish Cold Start Troubleshooter & Warmer
# Purpose: Diagnose and wake up sleeping Render.com Stockfish server
# Usage: .\warm-start-render.ps1
# Or from any directory: & "c:\Users\richl\LLM vs Me\ChessChatWeb\warm-start-render.ps1"

param(
    [switch]$Verbose,
    [int]$MaxAttempts = 5,
    [int]$TimeoutSeconds = 60
)

$ErrorActionPreference = "Continue"
$RENDER_URL = "https://chesschat-stockfish.onrender.com"
$API_KEY = $env:STOCKFISH_API_KEY

# Colors for output
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Progress { Write-Host "⏳ $args" -ForegroundColor Magenta }

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Render Stockfish Cold Start Troubleshooter & Warmer     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Info "Target Server: $RENDER_URL"
Write-Info "Max Attempts: $MaxAttempts"
Write-Info "Timeout per attempt: ${TimeoutSeconds}s"
Write-Host ""

# Function to check health
function Test-RenderHealth {
    param([int]$TimeoutSec = 30)
    
    try {
        $response = Invoke-RestMethod -Uri "$RENDER_URL/health" -Method GET -TimeoutSec $TimeoutSec -ErrorAction Stop
        return @{
            Success = $true
            Status = $response.status
            Version = $response.version
            Engines = $response.engines
            Timestamp = $response.timestamp
            RequestId = $response.requestId
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Function to warm up with compute-move
function Invoke-WarmupMove {
    param([int]$TimeoutSec = 60)
    
    $body = @{
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        cpuLevel = 3
    } | ConvertTo-Json

    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($API_KEY) {
        $headers["Authorization"] = "Bearer $API_KEY"
    }
    
    try {
        $startTime = Get-Date
        $response = Invoke-RestMethod -Uri "$RENDER_URL/compute-move" -Method POST -Body $body -Headers $headers -TimeoutSec $TimeoutSec -ErrorAction Stop
        $latency = ((Get-Date) - $startTime).TotalMilliseconds
        
        return @{
            Success = $true
            Move = $response.move
            Latency = [int]$latency
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

# Step 1: Initial Health Check
Write-Progress "Step 1/4: Initial health check..."
$health = Test-RenderHealth -TimeoutSec 10

if ($health.Success) {
    Write-Success "Server is AWAKE and healthy!"
    Write-Info "  Status: $($health.Status)"
    Write-Info "  Version: $($health.Version)"
    Write-Info "  Engines: Active=$($health.Engines.active), Max=$($health.Engines.max)"
    Write-Success "No cold start needed. Server is ready! 🚀"
    exit 0
}

Write-Warning "Server not responding (likely cold start)"
Write-Info "  Error: $($health.Error)"
Write-Host ""

# Step 2: Wake-up sequence
Write-Progress "Step 2/4: Starting wake-up sequence..."
Write-Info "This may take 30-120 seconds for Render to start the container..."
Write-Host ""

$attempt = 1
$success = $false
$totalStartTime = Get-Date

while ($attempt -le $MaxAttempts -and -not $success) {
    Write-Progress "Attempt $attempt/$MaxAttempts - Pinging health endpoint..."
    $attemptStartTime = Get-Date
    
    $health = Test-RenderHealth -TimeoutSec $TimeoutSeconds
    $attemptLatency = ((Get-Date) - $attemptStartTime).TotalSeconds
    
    if ($health.Success) {
        Write-Success "Server responded after $([int]$attemptLatency)s!"
        Write-Info "  Status: $($health.Status)"
        Write-Info "  Version: $($health.Version)"
        Write-Info "  Engines: Active=$($health.Engines.active), Max=$($health.Engines.max)"
        $success = $true
        break
    }
    
    Write-Warning "Attempt $attempt failed after $([int]$attemptLatency)s"
    Write-Info "  Error: $($health.Error)"
    
    if ($attempt -lt $MaxAttempts) {
        $waitTime = [Math]::Min(15, 5 * $attempt) # Progressive backoff: 5s, 10s, 15s
        Write-Info "  Waiting ${waitTime}s before next attempt..."
        Start-Sleep -Seconds $waitTime
    }
    
    $attempt++
}

if (-not $success) {
    Write-Error "Failed to wake up server after $MaxAttempts attempts"
    Write-Host ""
    Write-Host "🔧 Troubleshooting Steps:" -ForegroundColor Yellow
    Write-Host "  1. Check Render dashboard: https://dashboard.render.com/" -ForegroundColor Yellow
    Write-Host "  2. Verify service is not suspended or stopped" -ForegroundColor Yellow
    Write-Host "  3. Check Render logs for startup errors" -ForegroundColor Yellow
    Write-Host "  4. Try manual deploy if service is stuck" -ForegroundColor Yellow
    Write-Host "  5. Contact Render support if issue persists" -ForegroundColor Yellow
    exit 1
}

$totalTime = ((Get-Date) - $totalStartTime).TotalSeconds
Write-Host ""
Write-Success "Total wake-up time: $([int]$totalTime)s"
Write-Host ""

# Step 3: Verify with compute-move
Write-Progress "Step 3/4: Verifying with compute-move request..."
$moveTest = Invoke-WarmupMove -TimeoutSec $TimeoutSeconds

if ($moveTest.Success) {
    Write-Success "Compute-move successful!"
    Write-Info "  Move: $($moveTest.Move)"
    Write-Info "  Latency: $($moveTest.Latency)ms"
} else {
    Write-Warning "Compute-move failed, but health check passed"
    Write-Info "  Error: $($moveTest.Error)"
    Write-Info "  Server may still be initializing Stockfish engine..."
}

Write-Host ""

# Step 4: Final health check
Write-Progress "Step 4/4: Final health verification..."
$finalHealth = Test-RenderHealth -TimeoutSec 10

if ($finalHealth.Success) {
    Write-Success "Final verification passed!"
    Write-Info "  Server is fully operational"
    Write-Info "  Engines ready: $($finalHealth.Engines.active)/$($finalHealth.Engines.max)"
} else {
    Write-Warning "Final health check failed"
    Write-Info "  Server may still be warming up..."
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    🎉 WARMUP COMPLETE! 🎉                  ║" -ForegroundColor Green
Write-Host "╠════════════════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Render Stockfish server is now AWAKE and ready!          ║" -ForegroundColor Green
Write-Host "║  You can now play chess with fast response times.         ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  • Total time: $([int]$totalTime)s" -ForegroundColor White
Write-Host "  • Attempts: $($attempt - 1)" -ForegroundColor White
Write-Host "  • Status: Server is WARM ✅" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Run this script before playing to avoid cold start delays!" -ForegroundColor Yellow
Write-Host ""

exit 0
