# Quick cleanup script to kill all processes on ports 3000 and 3001
# Usage: .\cleanup-ports.ps1

Write-Host "Cleaning up processes on ports 3000 and 3001..." -ForegroundColor Yellow
Write-Host ""

$portsToClean = @(3000, 3001)

foreach ($port in $portsToClean) {
    Write-Host "Checking port $port..." -ForegroundColor Cyan
    
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess | Get-Unique
        
        foreach ($pid in $pids) {
            if ($pid -gt 0) {
                try {
                    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                    if ($process) {
                        Write-Host "  Stopping process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Yellow
                        Stop-Process -Id $pid -Force -ErrorAction Stop
                        Write-Host "  ✓ Stopped successfully" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  ✗ Failed to stop process $pid : $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host "  Try running this script as Administrator" -ForegroundColor Yellow
                }
            }
        }
    } else {
        Write-Host "  No processes found on port $port" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host ""

# Also kill any tunnel processes
Write-Host "Checking for tunnel processes..." -ForegroundColor Cyan
$tunnelProcesses = Get-Process -Name "lt","ngrok","cloudflared" -ErrorAction SilentlyContinue

if ($tunnelProcesses) {
    foreach ($proc in $tunnelProcesses) {
        Write-Host "  Stopping tunnel: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  ✓ Stopped successfully" -ForegroundColor Green
    }
} else {
    Write-Host "  No tunnel processes found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "All cleanup operations complete!" -ForegroundColor Green
Write-Host "You can now run bypass.ps1 to start the server" -ForegroundColor Cyan
