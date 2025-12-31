# Cleanup Script - Fixes common server startup issues
# Usage: .\cleanup.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChessChatWeb - Cleanup Utility" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

# 1. Kill any processes on ports 3000-3001
Write-Host "1. Checking for processes on ports 3000-3001..." -ForegroundColor Yellow
$ports = @(3000, 3001)
$killedAny = $false

foreach ($port in $ports) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
                 Select-Object -ExpandProperty OwningProcess | 
                 Get-Unique
    
    foreach ($pid in $processes) {
        try {
            $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "   ✓ Killed $processName (PID: $pid) on port $port" -ForegroundColor Green
            $killedAny = $true
        } catch {
            Write-Host "   ⚠️  Could not kill process $pid" -ForegroundColor Yellow
        }
    }
}

if (-not $killedAny) {
    Write-Host "   ✓ No processes found on ports 3000-3001" -ForegroundColor Green
}
Write-Host ""

# 2. Kill any tunnel processes
Write-Host "2. Checking for tunnel processes..." -ForegroundColor Yellow
$tunnelProcesses = Get-Process -Name "lt","ngrok","cloudflared" -ErrorAction SilentlyContinue
if ($tunnelProcesses) {
    $tunnelProcesses | Stop-Process -Force
    Write-Host "   ✓ Stopped tunnel processes" -ForegroundColor Green
} else {
    Write-Host "   ✓ No tunnel processes found" -ForegroundColor Green
}
Write-Host ""

# 3. Clear Vite cache
Write-Host "3. Clearing Vite cache..." -ForegroundColor Yellow
if (Test-Path "node_modules/.vite") {
    Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Vite cache cleared" -ForegroundColor Green
} else {
    Write-Host "   ✓ No Vite cache found" -ForegroundColor Green
}
Write-Host ""

# 4. Clear log files
Write-Host "4. Clearing log files..." -ForegroundColor Yellow
$logFiles = @("server-output.log", "server-error.log")
$clearedLogs = $false
foreach ($log in $logFiles) {
    if (Test-Path $log) {
        Remove-Item $log -Force -ErrorAction SilentlyContinue
        Write-Host "   ✓ Removed $log" -ForegroundColor Green
        $clearedLogs = $true
    }
}
if (-not $clearedLogs) {
    Write-Host "   ✓ No log files found" -ForegroundColor Green
}
Write-Host ""

# 5. Check node_modules integrity
Write-Host "5. Checking node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    $nodeModulesSize = (Get-ChildItem "node_modules" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeInMB = [math]::Round($nodeModulesSize / 1MB, 2)
    
    if ($sizeInMB -lt 100) {
        Write-Host "   ⚠️  node_modules seems incomplete ($sizeInMB MB)" -ForegroundColor Yellow
        Write-Host "   💡 Run 'npm install' to reinstall dependencies" -ForegroundColor Cyan
    } else {
        Write-Host "   ✓ node_modules looks healthy ($sizeInMB MB)" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠️  node_modules not found!" -ForegroundColor Yellow
    Write-Host "   💡 Run 'npm install' to install dependencies" -ForegroundColor Cyan
}
Write-Host ""

# 6. Database connectivity check
Write-Host "6. Testing database connectivity..." -ForegroundColor Yellow
if (Test-Path ".env") {
    if (Test-Path "test-db-connection.ts") {
        try {
            $dbTest = npx tsx test-db-connection.ts 2>&1 | Out-String
            if ($dbTest -match "All database tests passed") {
                Write-Host "   ✓ Database connectivity OK" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Database tests had issues" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   ⚠️  Could not run database test" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Database test script not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  .env file not found!" -ForegroundColor Yellow
    Write-Host "   💡 Copy .env.example to .env and configure" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  • Run: .\start-simple.ps1    (just the server)" -ForegroundColor Gray
Write-Host "  • Run: .\bypass.ps1          (server + tunnel)" -ForegroundColor Gray
Write-Host "  • Run: npm run dev           (manual start)" -ForegroundColor Gray
Write-Host ""
