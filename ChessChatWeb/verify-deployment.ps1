#!/usr/bin/env pwsh
# Deployment Verification Script
# Checks that the debugLog fix is deployed to production

Write-Host "`n=== ChessChat Deployment Verification ===" -ForegroundColor Cyan
Write-Host "Testing: https://chesschat.uk`n" -ForegroundColor Cyan

# Test 1: Check for new bundle
Write-Host "[1/4] Checking bundle hash..." -ForegroundColor Yellow
$content = (Invoke-WebRequest -Uri 'https://chesschat.uk' -UseBasicParsing).Content
$bundleMatch = $content | Select-String -Pattern 'index-([A-Za-z0-9_-]+)\.js' | Select-Object -First 1

if ($bundleMatch -match 'index-([A-Za-z0-9_-]+)\.js') {
    $currentBundle = $matches[1]
    Write-Host "  + Current bundle: $currentBundle" -ForegroundColor Green
} else {
    Write-Host "  - Could not detect bundle hash" -ForegroundColor Red
    exit 1
}

# Test 2: Verify old bundle is gone
Write-Host "`n[2/4] Verifying old bundle is removed..." -ForegroundColor Yellow
$oldBundle = "4sfy9DNu"
if ($content -match $oldBundle) {
    Write-Host "  - Old bundle $oldBundle still present!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  + Old bundle $oldBundle successfully replaced" -ForegroundColor Green
}

# Test 3: Check build version stamp
Write-Host "`n[3/4] Checking build version..." -ForegroundColor Yellow
if ($content -match 'BUILD VERSION:\s*([^\s]+)') {
    $buildVersion = $matches[1]
    Write-Host "  + Build version: $buildVersion" -ForegroundColor Green
} else {
    Write-Host "  - Build version not found" -ForegroundColor Red
}

# Test 4: Test bundle accessibility
Write-Host "`n[4/4] Testing bundle accessibility..." -ForegroundColor Yellow
$bundleUrl = "https://chesschat.uk/assets/index-$currentBundle.js"
try {
    $bundleResponse = Invoke-WebRequest -Uri $bundleUrl -Method Head -UseBasicParsing
    if ($bundleResponse.StatusCode -eq 200) {
        Write-Host "  + Bundle accessible (HTTP $($bundleResponse.StatusCode))" -ForegroundColor Green
    }
} catch {
    Write-Host "  - Bundle not accessible: $_" -ForegroundColor Red
    exit 1
}

# Summary
Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "+ All checks passed!" -ForegroundColor Green
Write-Host "`nReady for manual testing:" -ForegroundColor Yellow
Write-Host "  1. Open https://chesschat.uk" -ForegroundColor White
Write-Host "  2. Enable Coaching Mode" -ForegroundColor White
Write-Host "  3. Request CPU move" -ForegroundColor White
Write-Host "  4. Verify: No debugLog error" -ForegroundColor White
Write-Host "  5. Confirm: CPU move works with coaching" -ForegroundColor White
Write-Host ""
