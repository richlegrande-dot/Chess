# Simple Server Startup - Just the dev server, no tunnel
# Usage: .\start-simple.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ChessChatWeb - Simple Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

function Test-PortSimple {
    param([int]$Port = 3001)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 500
        $tcpClient.SendTimeout = 500
        $connect = $tcpClient.BeginConnect('127.0.0.1', $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(500, $false)
        
        if ($wait) {
            try {
                $tcpClient.EndConnect($connect)
                $tcpClient.Close()
                return $true
            } catch {
                $tcpClient.Close()
                return $false
            }
        } else {
            $tcpClient.Close()
            return $false
        }
    } catch {
        return $false
    }
}

# Check if port is already in use
if (Test-PortSimple -Port 3001) {
    Write-Host "[WARN] Port 3001 is already in use!" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Kill existing process and restart? (y/n)"
    
    if ($response -eq 'y') {
        Write-Host "Stopping processes on port 3001..." -ForegroundColor Yellow
        $processes = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | 
                     Select-Object -ExpandProperty OwningProcess | 
                     Get-Unique
        
        foreach ($pid in $processes) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Stopped process $pid" -ForegroundColor Green
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Exiting..." -ForegroundColor Gray
        exit 0
    }
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
    Write-Host ""
}

Write-Host "[STARTING] Development server..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start the server (this will keep running in foreground)
npm run dev
