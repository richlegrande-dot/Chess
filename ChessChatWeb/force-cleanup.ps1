# Force Cleanup Utility for ChessChatWeb
# This script forcefully kills all processes using ports 3000/3001
# Usage: .\force-cleanup.ps1 [-KillAllNode] [-Verbose]

param(
    [switch]$KillAllNode,
    [switch]$Verbose
)

# Set console encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Continue"

function Write-Info {
    param([string]$Message, [string]$Type = "Info")
    $color = switch ($Type) {
        "Success" { "Green" }
        "Error" { "Red" }
        "Warning" { "Yellow" }
        "Info" { "Cyan" }
        default { "White" }
    }
    Write-Host $Message -ForegroundColor $color
}

Write-Host ""
Write-Info "╔════════════════════════════════════════╗" "Cyan"
Write-Info "║   ChessChatWeb Force Cleanup Utility   ║" "Cyan"
Write-Info "╚════════════════════════════════════════╝" "Cyan"
Write-Host ""

# Kill processes on specific ports
Write-Info "Scanning ports 3000 and 3001..." "Info"
$connections = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | 
               Where-Object { $_.OwningProcess -ne 0 }

$pidList = @()
if ($connections) {
    Write-Info "Found $($connections.Count) connection(s) on ports 3000/3001" "Warning"
    
    foreach ($conn in $connections) {
        try {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($proc) {
                $pidList += $conn.OwningProcess
                Write-Info "  Port $($conn.LocalPort): $($proc.ProcessName) (PID: $($conn.OwningProcess)) [$($conn.State)]" "Warning"
                
                if ($Verbose) {
                    Write-Info "    Path: $($proc.Path)" "White"
                    Write-Info "    Start Time: $($proc.StartTime)" "White"
                }
            }
        } catch {
            Write-Info "  Unable to get info for PID $($conn.OwningProcess)" "Error"
        }
    }
    
    # Get unique PIDs
    $pidList = $pidList | Select-Object -Unique
    
    Write-Host ""
    Write-Info "Killing $($pidList.Count) process(es)..." "Warning"
    
    foreach ($pid in $pidList) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Info "  Killing $($proc.ProcessName) (PID: $pid)..." "Warning"
                taskkill /F /PID $pid 2>&1 | Out-Null
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Info "  ✓ Successfully killed PID $pid" "Success"
                } else {
                    Write-Info "  ✗ Failed to kill PID $pid (code: $LASTEXITCODE)" "Error"
                }
            }
        } catch {
            Write-Info "  ✗ Error killing PID $pid : $($_.Exception.Message)" "Error"
        }
    }
    
    # Wait for processes to fully terminate
    Write-Info "Waiting for ports to be released..." "Info"
    Start-Sleep -Seconds 3
    
    # Verify cleanup
    $remainingConnections = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | 
                           Where-Object { $_.State -notin @('TimeWait', 'CloseWait') -and $_.OwningProcess -ne 0 }
    
    if ($remainingConnections) {
        Write-Info "WARNING: Some connections still remain:" "Error"
        foreach ($conn in $remainingConnections) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            Write-Info "  Port $($conn.LocalPort): PID $($conn.OwningProcess) ($($proc.ProcessName)) [$($conn.State)]" "Error"
        }
    } else {
        Write-Info "✓ Ports 3000 and 3001 are now free" "Success"
    }
} else {
    Write-Info "✓ No processes found on ports 3000 or 3001" "Success"
}

# Optionally kill all node processes
if ($KillAllNode) {
    Write-Host ""
    Write-Info "Scanning for all Node.js processes..." "Warning"
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        Write-Info "Found $($nodeProcesses.Count) node process(es)" "Warning"
        
        foreach ($proc in $nodeProcesses) {
            Write-Info "  Node.js (PID: $($proc.Id))" "Warning"
            if ($Verbose) {
                Write-Info "    Path: $($proc.Path)" "White"
                Write-Info "    Start Time: $($proc.StartTime)" "White"
                Write-Info "    CPU Time: $($proc.CPU)s" "White"
            }
        }
        
        Write-Host ""
        $confirm = Read-Host "Kill ALL Node.js processes? (y/N)"
        
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Write-Info "Killing all Node.js processes..." "Warning"
            foreach ($proc in $nodeProcesses) {
                try {
                    Stop-Process -Id $proc.Id -Force -ErrorAction Stop
                    Write-Info "  ✓ Killed node process $($proc.Id)" "Success"
                } catch {
                    Write-Info "  ✗ Failed to kill node process $($proc.Id): $($_.Exception.Message)" "Error"
                }
            }
        } else {
            Write-Info "Skipped killing node processes" "Info"
        }
    } else {
        Write-Info "✓ No Node.js processes found" "Success"
    }
}

# Check for localtunnel/ngrok processes
Write-Host ""
Write-Info "Checking for tunnel processes..." "Info"
$tunnelProcesses = Get-Process -Name "lt","ngrok","cloudflared" -ErrorAction SilentlyContinue

if ($tunnelProcesses) {
    Write-Info "Found $($tunnelProcesses.Count) tunnel process(es)" "Warning"
    foreach ($proc in $tunnelProcesses) {
        Write-Info "  $($proc.ProcessName) (PID: $($proc.Id))" "Warning"
    }
    
    Write-Info "Killing tunnel processes..." "Warning"
    $tunnelProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Info "✓ Tunnel processes cleaned up" "Success"
} else {
    Write-Info "✓ No tunnel processes found" "Success"
}

# Clean up log files
Write-Host ""
Write-Info "Checking for old log files..." "Info"
$logFiles = @("server-output.log", "server-error.log", "startup-error.log", ".tunnel-url.txt")
$cleanedLogs = 0

foreach ($logFile in $logFiles) {
    if (Test-Path $logFile) {
        try {
            Remove-Item $logFile -Force -ErrorAction Stop
            $cleanedLogs++
            if ($Verbose) {
                Write-Info "  Removed $logFile" "Success"
            }
        } catch {
            if ($Verbose) {
                Write-Info "  Could not remove $logFile" "Warning"
            }
        }
    }
}

if ($cleanedLogs -gt 0) {
    Write-Info "✓ Cleaned up $cleanedLogs log file(s)" "Success"
} else {
    Write-Info "✓ No log files to clean" "Success"
}

Write-Host ""
Write-Info "════════════════════════════════════════" "Cyan"
Write-Info "Cleanup complete!" "Success"
Write-Info "════════════════════════════════════════" "Cyan"
Write-Host ""

# Display summary
$finalConnections = Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue | 
                   Where-Object { $_.State -notin @('TimeWait', 'CloseWait') -and $_.OwningProcess -ne 0 }

if (-not $finalConnections) {
    Write-Info "✓ System is ready for ChessChatWeb startup" "Success"
    Write-Info "  Run .\bypass.ps1 to start the server" "Cyan"
} else {
    Write-Info "⚠ Ports may still be in use. Try running with admin rights:" "Warning"
    Write-Info "  Start-Process powershell -Verb RunAs -ArgumentList '-File force-cleanup.ps1'" "Cyan"
}

Write-Host ""
