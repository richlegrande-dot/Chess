# ChessChatWeb Startup & Troubleshooting Guide

## Overview
This document covers the startup system, troubleshooting steps, and maintenance utilities for ChessChatWeb.

## Quick Start

### Normal Startup
```powershell
.\bypass.ps1
```
This will:
1. Clean up any stale processes on ports 3000/3001
2. Verify node_modules are installed
3. Start the development server (port 3001)
4. Create a localtunnel for external access
5. Log all activities to `bypass-startup.log`

### Manual Startup (Alternative)
```powershell
# Start server only
npm run dev

# Start server with tunnel
.\start-with-tunnel.ps1
```

## Troubleshooting

### Issue: "Port 3001 is already in use"

**Symptoms:**
- Server fails to start
- Error in `server-error.log` about port conflict
- Multiple node processes running

**Quick Fix:**
```powershell
.\force-cleanup.ps1
```

**Manual Fix:**
```powershell
# Find processes on port 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess

# Kill the process (replace PID with actual number)
Stop-Process -Id PID -Force
```

### Issue: Bypass script fails repeatedly

**Check the logs:**
```powershell
# View bypass startup log
Get-Content bypass-startup.log -Tail 50

# View detailed startup log
Get-Content startup-detailed.log -Tail 50

# View server errors
Get-Content server-error.log
```

**Common causes:**
1. **Port conflict** - Run `force-cleanup.ps1`
2. **Missing dependencies** - Run `npm install`
3. **Corrupted node_modules** - Delete folder and run `npm install`
4. **Admin rights needed** - Run PowerShell as Administrator

### Issue: Tunnel not working

**Symptoms:**
- Server starts but no tunnel URL appears
- `.tunnel-url.txt` file missing

**Fix:**
```powershell
# Start tunnel manually
npx localtunnel --port 3001

# Or use the full startup script
.\start-with-tunnel.ps1 -TunnelType "localtunnel"
```

### Issue: Multiple node processes

**Symptoms:**
- High CPU usage
- Multiple PowerShell windows open
- Server slow or unresponsive

**Fix:**
```powershell
# View all node processes
Get-Process -Name node | Format-Table Id, CPU, StartTime

# Clean up (will prompt for confirmation)
.\force-cleanup.ps1 -KillAllNode
```

## Maintenance Scripts

### bypass.ps1
**Purpose:** Main startup script with auto-cleanup  
**Logs:** `bypass-startup.log`  
**Features:**
- Automatic port cleanup
- Dependency checking
- Error recovery
- Comprehensive logging

**Usage:**
```powershell
.\bypass.ps1
```

### start-with-tunnel.ps1
**Purpose:** Advanced startup with health monitoring  
**Logs:** `startup-detailed.log`  
**Features:**
- Server health checks
- Automatic restarts on failure
- Multiple tunnel options
- Configurable retry logic

**Usage:**
```powershell
# Default (localtunnel, 5 retries)
.\start-with-tunnel.ps1

# Custom settings
.\start-with-tunnel.ps1 -MaxRetries 3 -TunnelType "ngrok"
```

### force-cleanup.ps1
**Purpose:** Emergency cleanup utility  
**Features:**
- Force kill processes on ports 3000/3001
- Optional: Kill all node processes
- Clean up log files
- Detailed status reporting

**Usage:**
```powershell
# Standard cleanup
.\force-cleanup.ps1

# Verbose output
.\force-cleanup.ps1 -Verbose

# Kill all node processes (interactive)
.\force-cleanup.ps1 -KillAllNode

# Run as administrator (for stubborn processes)
Start-Process powershell -Verb RunAs -ArgumentList "-File force-cleanup.ps1"
```

## Log Files

| File | Purpose | When Created |
|------|---------|-------------|
| `bypass-startup.log` | Main startup log | Every bypass.ps1 run |
| `startup-detailed.log` | Detailed startup events | Every start-with-tunnel.ps1 run |
| `server-output.log` | Vite dev server stdout | When server starts |
| `server-error.log` | Vite dev server stderr | When server has errors |
| `.tunnel-url.txt` | Current tunnel URL | When tunnel establishes |

### Viewing Logs
```powershell
# Tail (last 50 lines)
Get-Content bypass-startup.log -Tail 50

# Follow (live updates)
Get-Content bypass-startup.log -Wait -Tail 10

# View with timestamps
Get-Content startup-detailed.log | Select-String -Pattern "\[.*\]"

# Search for errors
Get-Content bypass-startup.log | Select-String -Pattern "ERROR|WARN"
```

## Common Patterns

### Fresh Start
```powershell
# Complete cleanup and restart
.\force-cleanup.ps1
Remove-Item node_modules -Recurse -Force
npm install
.\bypass.ps1
```

### Debug Mode
```powershell
# Start with verbose logging
$VerbosePreference = "Continue"
.\start-with-tunnel.ps1 -MaxRetries 1

# Monitor logs in real-time
Get-Content startup-detailed.log -Wait -Tail 20
```

### Production-like Testing
```powershell
# Build and preview
npm run build
npm run preview

# Or use production tunnel
.\start-with-tunnel.ps1 -TunnelType "cloudflared"
```

## VS Code Task Integration

The bypass script runs automatically on workspace open via the task:
- **Task ID:** `shell: Auto-Start Server & Tunnel`
- **Location:** `.vscode/tasks.json`

To disable auto-start:
1. Open `.vscode/tasks.json`
2. Remove or comment out the `runOptions.runOn` property

## Environment Variables

These can be set in PowerShell before running scripts:

```powershell
# Change default port (requires code changes)
$env:PORT = "3001"

# Increase memory for node
$env:NODE_OPTIONS = "--max-old-space-size=4096"

# Use different npm registry
$env:NPM_REGISTRY = "https://registry.npmjs.org/"
```

## Best Practices

1. **Always check logs first** when troubleshooting
2. **Use force-cleanup.ps1** before manually killing processes
3. **Keep logs** for recurring issues (they're in `.gitignore`)
4. **Run as admin** only when necessary
5. **Close unused PowerShell windows** to avoid confusion

## Emergency Commands

```powershell
# Nuclear option: Kill everything
Get-Process -Name node | Stop-Process -Force
Get-Process -Name lt | Stop-Process -Force
Remove-Item server-*.log, .tunnel-url.txt -Force

# Verify everything is stopped
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue

# Fresh reinstall
Remove-Item node_modules -Recurse -Force
npm cache clean --force
npm install
```

## Getting Help

1. **Check logs:** `bypass-startup.log`, `server-error.log`
2. **Run cleanup:** `.\force-cleanup.ps1 -Verbose`
3. **Test manually:** `npm run dev` to isolate issues
4. **Review this guide** for common patterns

## Changelog

### 2025-12-26 - Enhanced Error Handling
- ✅ Added comprehensive logging to all startup scripts
- ✅ Created `force-cleanup.ps1` for emergency cleanup
- ✅ Enhanced bypass.ps1 with better port cleanup
- ✅ Added startup-detailed.log for debugging
- ✅ Improved error messages and recovery logic

---

**Note:** All scripts are designed to be idempotent - safe to run multiple times without side effects.
