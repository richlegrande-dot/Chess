# Render Stockfish Cold Start Troubleshooter & Warmer
# Purpose: Diagnose and wake up sleeping Render.com Stockfish server

param(
    [string]$RenderUrl = "https://chesschat-stockfish.onrender.com",
    [int]$MaxAttempts = 5,
    [int]$TimeoutSeconds = 60
)

function Write-Color {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-RenderHealth {
    param(
        [string]$Url,
        [int]$TimeoutSec = 30
    )
    
    try {
        $startTime = Get-Date
        
        $response = Invoke-RestMethod -Uri "$Url/health" -Method Get -TimeoutSec $TimeoutSec -ErrorAction Stop
        
        $latency = [int]((Get-Date) - $startTime).TotalMilliseconds
        
        if ($response.status -eq 'healthy') {
            return @{
                Success = $true
                Status = $response.status
                Version = $response.version
                Engines = $response.engines
                Timestamp = $response.timestamp
                RequestId = $response.requestId
                Latency = $latency
            }
        }
        
        return @{
            Success = $false
            Error = "Server not healthy"
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
        }
    }
}

function Start-RenderWarmup {
    Write-Host ""
    Write-Color "===============================================================" "Cyan"
    Write-Color "   Render Stockfish Cold Start Troubleshooter & Warmer        " "Cyan"
    Write-Color "===============================================================" "Cyan"
    Write-Host ""
    
    Write-Color "[INFO] Target Server: $RenderUrl" "Cyan"
    Write-Color "[INFO] Max Attempts: $MaxAttempts" "Cyan"
    Write-Color "[INFO] Timeout per attempt: ${TimeoutSeconds}s" "Cyan"
    Write-Host ""
    
    # Step 1: Initial Health Check
    Write-Color "[PROGRESS] Step 1/4: Initial health check..." "Magenta"
    $initialHealth = Test-RenderHealth -Url $RenderUrl -TimeoutSec 10
    
    if ($initialHealth.Success) {
        Write-Color "[SUCCESS] Server is AWAKE and healthy!" "Green"
        Write-Color "   Status: $($initialHealth.Status)" "Cyan"
        Write-Color "   Version: $($initialHealth.Version)" "Cyan"
        Write-Color "   Engines: Active=$($initialHealth.Engines.active), Max=$($initialHealth.Engines.max)" "Cyan"
        Write-Color "   Latency: $($initialHealth.Latency)ms" "Cyan"
        Write-Color "[SUCCESS] No cold start needed. Server is ready!" "Green"
        return $true
    }
    
    Write-Color "[WARN] Server not responding (likely cold start)" "Yellow"
    Write-Color "   Error: $($initialHealth.Error)" "Cyan"
    Write-Host ""
    
    # Step 2: Wake-up sequence
    Write-Color "[PROGRESS] Step 2/4: Starting wake-up sequence..." "Magenta"
    Write-Color "[INFO] This may take 30-120 seconds for Render to start the container..." "Cyan"
    Write-Host ""
    
    $totalStartTime = Get-Date
    $success = $false
    $attempt = 1
    
    while ($attempt -le $MaxAttempts -and -not $success) {
        Write-Color "[PROGRESS] Attempt $attempt/$MaxAttempts - Pinging health endpoint..." "Magenta"
        $attemptStartTime = Get-Date
        
        $health = Test-RenderHealth -Url $RenderUrl -TimeoutSec $TimeoutSeconds
        $attemptLatency = [int]((Get-Date) - $attemptStartTime).TotalSeconds
        
        if ($health.Success) {
            Write-Color "[SUCCESS] Server responded after ${attemptLatency}s!" "Green"
            Write-Color "   Status: $($health.Status)" "Cyan"
            Write-Color "   Version: $($health.Version)" "Cyan"
            Write-Color "   Engines: Active=$($health.Engines.active), Max=$($health.Engines.max)" "Cyan"
            $success = $true
            break
        }
        
        Write-Color "[WARN] Attempt $attempt failed after ${attemptLatency}s" "Yellow"
        Write-Color "   Error: $($health.Error)" "Cyan"
        
        if ($attempt -lt $MaxAttempts) {
            $waitTime = [Math]::Min(15, 5 * $attempt)
            Write-Color "[INFO] Waiting ${waitTime}s before next attempt..." "Cyan"
            Start-Sleep -Seconds $waitTime
        }
        
        $attempt++
    }
    
    if (-not $success) {
        Write-Color "[ERROR] Failed to wake up server after $MaxAttempts attempts" "Red"
        Write-Host ""
        Write-Color "[TROUBLESHOOTING] Steps:" "Yellow"
        Write-Color "  1. Check Render dashboard: https://dashboard.render.com/" "Yellow"
        Write-Color "  2. Verify service is not suspended or stopped" "Yellow"
        Write-Color "  3. Check Render logs for startup errors" "Yellow"
        Write-Color "  4. Try manual deploy if service is stuck" "Yellow"
        Write-Color "  5. Contact Render support if issue persists" "Yellow"
        return $false
    }
    
    $totalTime = [int]((Get-Date) - $totalStartTime).TotalSeconds
    Write-Host ""
    Write-Color "[SUCCESS] Total wake-up time: ${totalTime}s" "Green"
    Write-Host ""
    
    # Step 3: Final health check
    Write-Color "[PROGRESS] Step 3/4: Final health verification..." "Magenta"
    $finalHealth = Test-RenderHealth -Url $RenderUrl -TimeoutSec 10
    
    if ($finalHealth.Success) {
        Write-Color "[SUCCESS] Final verification passed!" "Green"
        Write-Color "   Server is fully operational" "Cyan"
        Write-Color "   Engines ready: $($finalHealth.Engines.active)/$($finalHealth.Engines.max)" "Cyan"
        Write-Color "   Latency: $($finalHealth.Latency)ms" "Cyan"
    } else {
        Write-Color "[WARN] Final health check failed" "Yellow"
        Write-Color "   Server may still be warming up..." "Cyan"
    }
    
    Write-Host ""
    Write-Color "===============================================================" "Green"
    Write-Color "                    WARMUP COMPLETE!                          " "Green"
    Write-Color "===============================================================" "Green"
    Write-Color "  Render Stockfish server is now AWAKE and ready!            " "Green"
    Write-Color "  You can now play chess with fast response times.           " "Green"
    Write-Color "===============================================================" "Green"
    Write-Host ""
    
    # Summary
    Write-Color "[SUMMARY]" "Cyan"
    Write-Host "  Total time: ${totalTime}s"
    Write-Host "  Attempts: $($attempt - 1)"
    Write-Host "  Status: Server is WARM"
    Write-Host ""
    Write-Color "Tip: This runs automatically on startup to avoid cold start delays!" "Yellow"
    Write-Host ""
    
    return $true
}

# Main execution
try {
    $result = Start-RenderWarmup
    if ($result) {
        exit 0
    } else {
        exit 1
    }
} catch {
    Write-Color "[FATAL ERROR] $($_.Exception.Message)" "Red"
    exit 1
}
