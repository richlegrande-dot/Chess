#!/usr/bin/env pwsh
# Quick script to check which bundle is currently deployed

$url = "https://chesschat.uk"
Write-Host "`n🔍 Checking current bundle on $url..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    
    # Extract bundle hash from HTML
    if ($response.Content -match 'index-([a-zA-Z0-9]+)\.js') {
        $bundleHash = $matches[1]
        Write-Host "📦 Current bundle: index-$bundleHash.js" -ForegroundColor Yellow
        
        if ($bundleHash -eq "4sfy9DNu") {
            Write-Host "❌ OLD BUNDLE DETECTED - Still cached!" -ForegroundColor Red
            Write-Host "   Wait 30-60 seconds for Cloudflare to finish building..." -ForegroundColor Yellow
        }
        else {
            Write-Host "✅ NEW BUNDLE DEPLOYED - Hash changed from 4sfy9DNu to $bundleHash" -ForegroundColor Green
            Write-Host "   Open in incognito to test: Ctrl + Shift + N" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "⚠️ Could not find bundle reference in HTML" -ForegroundColor Yellow
    }
    
    # Check for build stamp in the HTML (meta tag or inline script)
    if ($response.Content -match '2025-12-31-DEBUGLOG-FIX') {
        Write-Host "✅ Build stamp found: 2025-12-31-DEBUGLOG-FIX" -ForegroundColor Green
    }
    else {
        Write-Host "⏳ Build stamp not found yet (still building or caching)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "❌ Error checking bundle: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n💡 To force refresh in browser:" -ForegroundColor Cyan
Write-Host "   1. Ctrl + Shift + N (Incognito)" -ForegroundColor White
Write-Host "   2. F12 → Application → Clear Storage → Clear site data" -ForegroundColor White
Write-Host "   3. Hard reload: Ctrl + Shift + R" -ForegroundColor White
Write-Host ""
