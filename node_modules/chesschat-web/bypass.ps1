# Quick Start Command - Single line execution
# Usage: .\bypass.ps1

# Set console encoding to UTF-8 for proper emoji display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Navigate to project directory
$projectPath = "c:\Users\richl\LLM vs Me\ChessChatWeb"
Set-Location $projectPath

# Setup logging
$logFile = Join-Path $projectPath "bypass-startup.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log {
    param([string]$Message, [string]$Type = "INFO")
    $logEntry = "[$timestamp] [$Type] $Message"
    Add-Content -Path $logFile -Value $logEntry
    
    $color = switch ($Type) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host $Message -ForegroundColor $color
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChessChatWeb Startup Script" -ForegroundColor Cyan
Write-Host "  Log: $logFile" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "Startup script initiated" "INFO"

# Cleanup any stale processes from previous runs
Write-Log "Checking for stale processes on ports 3000/3001..." "INFO"

# First, aggressively kill all node processes that might be using these ports
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Log "Found $($nodeProcesses.Count) node process(es) running" "WARN"
    foreach ($proc in $nodeProcesses) {
        try {
            $connections = Get-NetTCPConnection -OwningProcess $proc.Id -ErrorAction SilentlyContinue
            $usingPort = $connections | Where-Object { $_.LocalPort -in @(3000, 3001) }
            if ($usingPort) {
                Write-Log "Killing node process $($proc.Id) using ports 3000/3001" "WARN"
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
            }
        } catch {
            Write-Log "Could not check process $($proc.Id): $($_.Exception.Message)" "WARN"
        }
    }
}

$staleProcesses = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | 
                  Where-Object { $_.OwningProcess -ne 0 } |
                  Select-Object -ExpandProperty OwningProcess | Get-Unique

if ($staleProcesses) {
    Write-Log "Found $($staleProcesses.Count) process(es) on ports 3000/3001. Cleaning up..." "WARN"
    foreach ($targetProcess in $staleProcesses) {
        try {
            $processInfo = Get-Process -Id $targetProcess -ErrorAction SilentlyContinue
            if ($processInfo) {
                Write-Log "Stopping $($processInfo.ProcessName) (PID: $targetProcess)..." "WARN"
                # Use taskkill for more reliable termination
                taskkill /F /PID $targetProcess 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Log "Stopped process $targetProcess" "SUCCESS"
                } else {
                    Write-Log "Could not stop process $targetProcess - may need admin rights" "WARN"
                }
            }
        } catch {
            $exMessage = $_.Exception.Message
            Write-Log "Error stopping process $targetProcess : $exMessage" "WARN"
        }
    }
    
    # Wait for ports to be fully released
    Write-Log "Waiting for ports to be released..." "INFO"
    Start-Sleep -Seconds 6
    
    # Verify ports are now free (ignore TIME_WAIT states)
    $activeConnections = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
                         Where-Object { $_.State -notin @('TimeWait', 'CloseWait') -and $_.OwningProcess -ne 0 }
    
    if ($activeConnections) {
        Write-Log "Active processes still using ports 3000/3001" "WARN"
        $activeConnections | ForEach-Object {
            $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
            Write-Log "  Port $($_.LocalPort): PID $($_.OwningProcess) ($($proc.ProcessName)) [$($_.State)]" "WARN"
        }
        Write-Log "Attempting final cleanup with force..." "WARN"
        $activeConnections | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            $targetPID = $_
            Write-Log "Force killing PID $targetPID" "WARN"
            taskkill /F /PID $targetPID 2>&1 | Out-Null
        }
        Start-Sleep -Seconds 4
        
        # Final verification
        $stillActive = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue |
                       Where-Object { $_.State -notin @('TimeWait', 'CloseWait') -and $_.OwningProcess -ne 0 }
        if ($stillActive) {
            Write-Log "FAILED to clear ports. Manual cleanup required. Run cleanup-ports.ps1" "ERROR"
            exit 1
        }
    } else {
        Write-Log "Ports 3000 and 3001 are now free" "SUCCESS"
    }
}

# Additional safety check - ensure no node processes remain
$remainingNodes = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($remainingNodes) {
    Write-Log "Found $($remainingNodes.Count) node process(es) still running after cleanup" "WARN"
    Write-Log "These may be from other projects and will be left alone" "INFO"
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Log "node_modules not found. Running npm install..." "WARN"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Log "npm install failed!" "ERROR"
        exit 1
    }
    Write-Log "npm install completed successfully" "SUCCESS"
}

Write-Log "Starting server and tunnel..." "INFO"
Write-Host ""

# Run the automated startup script with default settings
try {
    & "$projectPath\start-with-tunnel.ps1" -MaxRetries 3 -HealthCheckInterval 15 -TunnelType "localtunnel"
    if ($LASTEXITCODE -ne 0) {
        Write-Log "start-with-tunnel.ps1 exited with code $LASTEXITCODE" "ERROR"
        exit $LASTEXITCODE
    }
    Write-Log "Startup completed successfully" "SUCCESS"
} catch {
    Write-Log "Error during startup: $($_.Exception.Message)" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    exit 1
}
