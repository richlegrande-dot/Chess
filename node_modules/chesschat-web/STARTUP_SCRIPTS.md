# Startup Scripts - Quick Reference

**Last Updated**: December 21, 2025

---

## 🚀 Available Scripts

### 1. **start-simple.ps1** - Recommended for Development
```powershell
.\start-simple.ps1
```
**What it does:**
- ✓ Starts Vite dev server only (no tunnel)
- ✓ Checks for port conflicts automatically
- ✓ Validates dependencies
- ✓ Runs in foreground (easy to stop with Ctrl+C)
- ✓ Simple and reliable

**Use when:** You just want to develop locally

---

### 2. **bypass.ps1** - Full Automated Setup
```powershell
.\bypass.ps1
```
**What it does:**
- ✓ Starts dev server
- ✓ Creates public tunnel (localtunnel)
- ✓ Auto-recovery on failures
- ✓ Health monitoring
- ✓ Automatic restarts

**Use when:** You need external access or full automation

---

### 3. **start-with-tunnel.ps1** - Advanced Configuration
```powershell
.\start-with-tunnel.ps1 -MaxRetries 3 -TunnelType "ngrok"
```
**Parameters:**
- `-MaxRetries` (default: 5) - How many times to retry on failure
- `-HealthCheckInterval` (default: 10) - Seconds between health checks
- `-TunnelType` (default: "localtunnel") - Options: localtunnel, ngrok, cloudflared

**Use when:** You need custom configuration

---

### 4. **cleanup.ps1** - Troubleshooting Tool
```powershell
.\cleanup.ps1
```
**What it does:**
- ✓ Kills processes on ports 3000-3001
- ✓ Stops tunnel processes
- ✓ Clears Vite cache
- ✓ Removes log files
- ✓ Checks node_modules integrity
- ✓ Tests database connectivity

**Use when:** Server won't start or behaving strangely

---

## 🔧 Common Issues & Fixes

### Issue: "Port 3001 already in use"
```powershell
# Quick fix
.\cleanup.ps1

# Or manual
Get-NetTCPConnection -LocalPort 3001 | Select-Object -ExpandProperty OwningProcess | Get-Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

### Issue: "Server not responding to HTTP requests"
**Symptoms:** Server shows "ready" but browser can't connect

**Fixed in patched scripts:**
- ✓ Improved TCP port detection
- ✓ Multiple health check methods
- ✓ Better HTTP connectivity tests
- ✓ Fallback validation logic

**Manual check:**
```powershell
# Check if port is listening
Test-NetConnection -ComputerName localhost -Port 3001

# Or use the patched test
$tcpClient = New-Object System.Net.Sockets.TcpClient
$tcpClient.Connect('127.0.0.1', 3001)
$tcpClient.Connected  # Should return True
$tcpClient.Close()
```

### Issue: "Database connection failed"
```powershell
# Test database
npx tsx test-db-connection.ts

# Check .env file
Get-Content .env | Select-String "DATABASE"
```

### Issue: "node_modules corrupted"
```powershell
# Full reinstall
Remove-Item -Path "node_modules" -Recurse -Force
Remove-Item -Path "package-lock.json" -Force
npm install
```

---

## 📋 Startup Checklist

Before starting the server:
- [ ] Node.js installed (v18+ recommended)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Port 3001 available
- [ ] Database accessible

---

## 🎯 Quick Commands

| Task | Command |
|------|---------|
| Start dev server | `.\start-simple.ps1` |
| Start with tunnel | `.\bypass.ps1` |
| Fix issues | `.\cleanup.ps1` |
| Test database | `npx tsx test-db-connection.ts` |
| Build for production | `npm run build` |
| Run tests | `npm test` |
| Deploy | `npm run deploy` |

---

## 🔍 What Was Patched?

### Original Issues:
1. ❌ `Test-NetConnection` was slow and unreliable
2. ❌ HTTP health checks failed even when server was ready
3. ❌ No process monitoring or crash detection
4. ❌ Single-method connectivity testing

### Fixes Applied:
1. ✅ **TCP Socket Testing** - Direct TCP connection for fast port checks
2. ✅ **Multi-Method Health Checks** - Falls back through Invoke-WebRequest → curl → TCP
3. ✅ **Process Monitoring** - Detects if server crashes during startup
4. ✅ **Stability Verification** - Confirms port responds 3 times before declaring ready
5. ✅ **Output Logging** - Captures stdout/stderr to `server-output.log` and `server-error.log`
6. ✅ **Better Error Messages** - Shows actual errors instead of generic failures

### New Features:
- ✅ **start-simple.ps1** - Lightweight alternative without tunnel complexity
- ✅ **cleanup.ps1** - One-command troubleshooting utility
- ✅ **Improved bypass.ps1** - Better user feedback and dependency checking

---

## 📚 Documentation Files

- `TEST_CONNECTIVITY_REPORT.md` - Full connectivity test results
- `STARTUP_SCRIPTS.md` - This file
- `LATE_GAME_PERFORMANCE_FIX.md` - AI difficulty adjustments
- `WALLE_LEARNING_SYSTEM_V2.md` - Wall-E learning system docs

---

## 💡 Pro Tips

1. **Development**: Use `start-simple.ps1` - it's faster and easier to debug
2. **Testing externally**: Use `bypass.ps1` for automatic tunnel setup
3. **Stuck?**: Run `cleanup.ps1` first, then try again
4. **Logs**: Check `server-output.log` and `server-error.log` for errors
5. **Database**: Test with `test-db-connection.ts` if API calls fail

---

**Status**: All startup issues patched ✅  
**Reliability**: Significantly improved  
**Next Steps**: Use `start-simple.ps1` for development
