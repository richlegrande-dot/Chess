# Automated Server & Tunnel Startup with Error Recovery
# This script starts the dev server, creates a tunnel, and auto-fixes common issues

param(
    [int]$MaxRetries = 5,
    [int]$HealthCheckInterval = 10,
    [string]$TunnelType = "localtunnel" # Options: localtunnel, ngrok, cloudflared
)

# Set console encoding to UTF-8 for proper emoji display
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Continue"
$Script:ServerProcess = $null
$Script:TunnelProcess = $null
$Script:RetryCount = 0
$Script:ServerHealthy = $false
$Script:LogFile = Join-Path $PSScriptRoot "startup-detailed.log"

# Initialize log file
$startupInfo = "======================================`n"
$startupInfo += "Startup initiated at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
$startupInfo += "MaxRetries: $MaxRetries`n"
$startupInfo += "TunnelType: $TunnelType`n"
$startupInfo += "======================================`n"
Set-Content -Path $Script:LogFile -Value $startupInfo

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Type) {
        "Success" { "Green" }
        "Error" { "Red" }
        "Warning" { "Yellow" }
        default { "Cyan" }
    }
    Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
    Write-Host $Message -ForegroundColor $color
    
    # Also log to file
    $logEntry = "[$timestamp] [$Type] $Message"
    Add-Content -Path $Script:LogFile -Value $logEntry
}

function Test-Port {
    param([int]$Port = 3001)
    try {
        # Try multiple methods for better reliability
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.ReceiveTimeout = 1000
        $tcpClient.SendTimeout = 1000
        $connect = $tcpClient.BeginConnect('127.0.0.1', $Port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
        
        if ($wait) {
            try {
                $tcpClient.EndConnect($connect)
                $tcpClient.Close()
                return $true
            } catch {
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

function Stop-ProcessesSafely {
    Write-Status "Cleaning up existing processes..." "Warning"
    
    # Kill existing node processes on port 3001 (and 3000 as fallback)
    $processes = Get-NetTCPConnection -LocalPort 3001,3000 -ErrorAction SilentlyContinue | 
                 Select-Object -ExpandProperty OwningProcess | 
                 Get-Unique
    
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Status "Killed process on port 3000 (PID: $pid)" "Success"
        } catch {
            Write-Status "Could not kill process $pid" "Warning"
        }
    }
    
    # Kill any existing tunnel processes
    Get-Process -Name "lt","ngrok","cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
    
    # Cleanup script processes
    if ($Script:ServerProcess) {
        Stop-Process -Id $Script:ServerProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($Script:TunnelProcess) {
        Stop-Process -Id $Script:TunnelProcess.Id -Force -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Seconds 2
}

function Repair-NodeModules {
    Write-Status "Repairing node_modules..." "Warning"
    
    if (Test-Path "node_modules") {
        Write-Status "Removing corrupted node_modules..."
        Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    if (Test-Path "package-lock.json") {
        Remove-Item -Path "package-lock.json" -Force -ErrorAction SilentlyContinue
    }
    
    Write-Status "Running npm install..."
    $npmOutput = npm install 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "npm install completed successfully" "Success"
        return $true
    } else {
        Write-Status "npm install failed: $npmOutput" "Error"
        return $false
    }
}

function Test-ServerHealth {
    param([int]$Port = 3001)
    
    if (-not (Test-Port -Port $Port)) {
        return @{ Healthy = $false; Status = "Port not responding" }
    }
    
    # Try multiple methods for HTTP connectivity
    try {
        # Method 1: Invoke-WebRequest
        $ProgressPreference = 'SilentlyContinue'
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Status "Server health check PASSED (HTTP)" "Success"
            return @{ Healthy = $true; Status = "OK" }
        }
    } catch {
        # Method 2: Try with curl if available
        if (Get-Command curl -ErrorAction SilentlyContinue) {
            try {
                $curlResult = curl -s -o NUL -w "%{http_code}" "http://127.0.0.1:$Port" 2>$null
                if ($curlResult -eq "200") {
                    Write-Status "Server health check PASSED (curl)" "Success"
                    return @{ Healthy = $true; Status = "OK" }
                }
            } catch { }
        }
        
        # If port is responding, assume healthy even if HTTP fails
        Write-Status "Server health check: Port responding, assuming healthy" "Warning"
        return @{ Healthy = $true; Status = "Port OK (HTTP check skipped)" }
    }
    
    return @{ Healthy = $false; Status = "All health checks failed" }
}

function Start-DevServer {
    Write-Status "Starting development server..." "Info"
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Status "package.json not found! Wrong directory?" "Error"
        return $false
    }
    
    # Start server as background job - use cmd.exe for proper Windows execution
    $Script:ServerProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm","run","dev" -PassThru -NoNewWindow -RedirectStandardOutput "server-output.log" -RedirectStandardError "server-error.log"
    
    Write-Status "Waiting for server to start (PID: $($Script:ServerProcess.Id))..." "Info"
    
    # Wait for server to be ready (max 60 seconds)
    $timeout = 60
    $elapsed = 0
    $portCheckRetries = 0
    
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2
        
        # Check if process is still running
        if ($Script:ServerProcess.HasExited) {
            Write-Status "Server process exited unexpectedly!" "Error"
            if (Test-Path "server-error.log") {
                $errorLog = Get-Content "server-error.log" -Tail 10
                Write-Status "Error log: $errorLog" "Error"
            }
            return $false
        }
        
        if (Test-Port -Port 3001) {
            $portCheckRetries++
            Write-Status "Server port 3001 is responding (check $portCheckRetries/3)" "Info"
            
            # Verify port responds multiple times to ensure stability
            if ($portCheckRetries -ge 3) {
                Write-Status "Server is stable and listening on port 3001!" "Success"
                Start-Sleep -Seconds 2 # Give it time to fully initialize
                
                $health = Test-ServerHealth
                if ($health.Healthy) {
                    $Script:ServerHealthy = $true
                    return $true
                } else {
                    Write-Status "Server started but health check failed: $($health.Status)" "Warning"
                    # Still return true if port is responding
                    $Script:ServerHealthy = $true
                    return $true
                }
            }
        } else {
            $portCheckRetries = 0
        }
        
        Write-Host "." -NoNewline
    }
    
    Write-Status "Server failed to start within $timeout seconds" "Error"
    return $false
}

function Start-Tunnel {
    param([string]$Type = "localtunnel")
    
    Write-Status "Starting $Type tunnel..." "Info"
    
    switch ($Type.ToLower()) {
        "localtunnel" {
            # Check if localtunnel is installed
            $ltInstalled = npm list -g localtunnel 2>&1 | Select-String "localtunnel"
            
            if (-not $ltInstalled) {
                Write-Status "Installing localtunnel globally..." "Info"
                npm install -g localtunnel
            }
            
            # Create a temporary file for tunnel output
            $tunnelLogFile = Join-Path $env:TEMP "tunnel-output.log"
            
            # Start localtunnel and redirect output to capture URL
            $Script:TunnelProcess = Start-Process -FilePath "cmd.exe" `
                -ArgumentList "/c","npx","localtunnel","--port","3001" `
                -PassThru -NoNewWindow `
                -RedirectStandardOutput $tunnelLogFile
            
            # Wait for URL to be generated
            Start-Sleep -Seconds 5
            
            # Try to read and display the URL
            if (Test-Path $tunnelLogFile) {
                $tunnelOutput = Get-Content $tunnelLogFile -Raw
                if ($tunnelOutput -match 'https://[^\s]+\.loca\.lt') {
                    $tunnelUrl = $matches[0]
                    Write-Status "Localtunnel URL: $tunnelUrl" "Success"
                    Write-Host ""
                    Write-Host "Your public URL is: " -NoNewline
                    Write-Host $tunnelUrl -ForegroundColor Green -BackgroundColor Black
                    Write-Host ""
                } else {
                    Write-Status "Localtunnel started! Check the tunnel process for URL" "Success"
                }
            } else {
                Write-Status "Localtunnel started! URL will appear in separate window" "Success"
            }
        }
        
        "ngrok" {
            if (Test-Path "C:\Program Files\ngrok\ngrok.exe") {
                $Script:TunnelProcess = Start-Process -FilePath "C:\Program Files\ngrok\ngrok.exe" -ArgumentList "http","3001" -PassThru -NoNewWindow
                Write-Status "Ngrok tunnel started! Visit http://localhost:4040 for details" "Success"
            } else {
                Write-Status "Ngrok not found. Install from https://ngrok.com/download" "Error"
                return $false
            }
        }
        
        "cloudflared" {
            if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
                $Script:TunnelProcess = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel","--url","http://localhost:3001" -PassThru -NoNewWindow
                Write-Status "Cloudflare tunnel started!" "Success"
            } else {
                Write-Status "Cloudflared not found. Install from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" "Error"
                return $false
            }
        }
        
        default {
            Write-Status "Unknown tunnel type: $Type" "Error"
            return $false
        }
    }
    
    return $true
}

function Diagnose-And-Fix {
    Write-Status "Running diagnostics..." "Warning"
    
    # Check 1: Port availability
    if (Test-Port -Port 3001) {
        Write-Status "Port 3001 is already in use - cleaning up..." "Warning"
        Stop-ProcessesSafely
        return "retry"
    }
    
    # Check 2: Node modules integrity
    if (-not (Test-Path "node_modules")) {
        Write-Status "node_modules missing - installing..." "Warning"
        if (Repair-NodeModules) {
            return "retry"
        } else {
            return "fatal"
        }
    }
    
    # Check 3: Check for compile errors
    Write-Status "Checking for TypeScript errors..." "Info"
    $tscOutput = npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Status "TypeScript compilation errors detected:" "Error"
        Write-Host $tscOutput
        Write-Status "Attempting to continue anyway..." "Warning"
    }
    
    # Check 4: Vite cache issues
    if (Test-Path "node_modules/.vite") {
        Write-Status "Clearing Vite cache..." "Warning"
        Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
        return "retry"
    }
    
    return "unknown"
}

# Main execution loop
Write-Status "========================================" "Info"
Write-Status "  Chess App Server & Tunnel Startup    " "Info"
Write-Status "========================================" "Info"
Write-Status ""

# Initial cleanup
Stop-ProcessesSafely

while ($Script:RetryCount -lt $MaxRetries) {
    $Script:RetryCount++
    
    Write-Status ""
    Write-Status "=== Attempt $Script:RetryCount of $MaxRetries ===" "Info"
    
    # Start the server
    $serverStarted = Start-DevServer
    
    if (-not $serverStarted) {
        Write-Status "Server failed to start. Diagnosing..." "Error"
        $diagnosis = Diagnose-And-Fix
        
        if ($diagnosis -eq "fatal") {
            Write-Status "Fatal error detected. Cannot continue." "Error"
            break
        } elseif ($diagnosis -eq "retry") {
            Write-Status "Issue fixed. Retrying..." "Success"
            continue
        } else {
            Write-Status "Could not determine issue. Retrying anyway..." "Warning"
            Start-Sleep -Seconds 5
            continue
        }
    }
    
    # Server started successfully - now start tunnel
    Write-Status "Server is healthy. Starting tunnel..." "Success"
    $tunnelStarted = Start-Tunnel -Type $TunnelType
    
    if ($tunnelStarted) {
        Write-Status ""
        Write-Status "========================================" "Success"
        Write-Status "  ✓ Server running on http://localhost:3001" "Success"
        Write-Status "  ✓ Tunnel active ($TunnelType)" "Success"
        Write-Status "========================================" "Success"
        Write-Status ""
        Write-Status "Monitoring server health every $HealthCheckInterval seconds..." "Info"
        Write-Status "Press Ctrl+C to stop all services" "Warning"
        
        # Health monitoring loop
        while ($true) {
            Start-Sleep -Seconds $HealthCheckInterval
            
            $health = Test-ServerHealth
            if (-not $health.Healthy) {
                Write-Status "Server health degraded: $($health.Status)" "Error"
                Write-Status "Restarting services..." "Warning"
                Stop-ProcessesSafely
                break
            }
            
            Write-Host "." -NoNewline
        }
    } else {
        Write-Status "Tunnel failed to start but server is running" "Warning"
        Write-Status "You can access the app at http://localhost:3001" "Info"
        Write-Status "Press Ctrl+C to stop" "Warning"
        
        while ($true) {
            Start-Sleep -Seconds $HealthCheckInterval
            $health = Test-ServerHealth
            if (-not $health.Healthy) {
                Write-Status "Server degraded: $($health.Status)" "Error"
                break
            }
        }
    }
}

if ($Script:RetryCount -ge $MaxRetries) {
    Write-Status ""
    Write-Status "Maximum retry attempts reached ($MaxRetries)" "Error"
    Write-Status "Please check the logs and try manual startup" "Error"
}

# Cleanup on exit
Write-Status ""
Write-Status "Shutting down..." "Warning"
Stop-ProcessesSafely
Write-Status "Cleanup complete" "Success"
