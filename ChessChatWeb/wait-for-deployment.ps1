#!/usr/bin/env pwsh
# Monitor Cloudflare deployment until new bundle is live

param(
    [int]$MaxWaitMinutes = 10,
    [int]$CheckIntervalSeconds = 30
)

Write-Host "`n🔍 Monitoring Cloudflare deployment..." -ForegroundColor Cyan
Write-Host "Checking every $CheckIntervalSeconds seconds (max $MaxWaitMinutes minutes)`n" -ForegroundColor Gray

$startTime = Get-Date
$maxTime = $startTime.AddMinutes($MaxWaitMinutes)
$oldBundle = "4sfy9DNu"
$attempts = 0

while ((Get-Date) -lt $maxTime) {
    $attempts++
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds)
    
    try {
        Write-Host "[$elapsed`s] Attempt $attempts - Checking bundle..." -NoNewline -ForegroundColor Gray
        
        $headers = @{
            'Cache-Control' = 'no-cache'
            'Pragma' = 'no-cache'
        }
        
        $response = Invoke-WebRequest -Uri "https://chesschat.uk" -UseBasicParsing -Headers $headers -TimeoutSec 10
        
        if ($response.Content -match 'index-([a-zA-Z0-9]+)\.js') {
            $currentBundle = $matches[1]
            
            if ($currentBundle -ne $oldBundle) {
                Write-Host " ✅ NEW!" -ForegroundColor Green
                Write-Host "`n╔═══════════════════════════════════════╗" -ForegroundColor Green
                Write-Host "║   🎉 DEPLOYMENT SUCCESSFUL! 🎉        ║" -ForegroundColor Green
                Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Green
                Write-Host "`nOld Bundle: index-$oldBundle.js" -ForegroundColor Red
                Write-Host "New Bundle: index-$currentBundle.js" -ForegroundColor Green
                Write-Host "`n✅ Crash-proof debugLog is now LIVE!" -ForegroundColor Green
                Write-Host "`n🧪 Next Steps:" -ForegroundColor Yellow
                Write-Host "  1. Test in incognito: Ctrl + Shift + N" -ForegroundColor White
                Write-Host "  2. Open: https://chesschat.uk" -ForegroundColor Cyan
                Write-Host "  3. Check console for: '2025-12-31-DEBUGLOG-FIX'" -ForegroundColor White
                Write-Host "  4. Test CPU move in Coaching Mode" -ForegroundColor White
                Write-Host "`n⏱️  Total deployment time: $elapsed seconds" -ForegroundColor Gray
                exit 0
            }
            else {
                Write-Host " ⏳ Still old ($currentBundle)" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host " ⚠️  No bundle found" -ForegroundColor Yellow
        }
        
    }
    catch {
        Write-Host " ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    if ((Get-Date) -lt $maxTime) {
        Start-Sleep -Seconds $CheckIntervalSeconds
    }
}

Write-Host "`n⏰ Timeout reached after $MaxWaitMinutes minutes" -ForegroundColor Red
Write-Host "Bundle still showing: index-$oldBundle.js" -ForegroundColor Red
Write-Host "`n📊 Troubleshooting:" -ForegroundColor Yellow
Write-Host "  1. Check Cloudflare dashboard for build status" -ForegroundColor White
Write-Host "  2. Look for build errors in logs" -ForegroundColor White
Write-Host "  3. Verify GitHub webhook is configured" -ForegroundColor White
Write-Host "`n🔗 Dashboard: https://dash.cloudflare.com/559ee9fa2c5827d89d4b416991f8360b/pages/view/chess" -ForegroundColor Cyan
exit 1
