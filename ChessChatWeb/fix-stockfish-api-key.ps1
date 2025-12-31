# Fix Stockfish API Key Configuration
# This script guides you through getting and setting the correct API key

Write-Host "`n🔧 Stockfish API Key Configuration Fix`n" -ForegroundColor Cyan

Write-Host "The Stockfish server on Render has an auto-generated API key." -ForegroundColor Yellow
Write-Host "You need to retrieve it and configure the Cloudflare Worker.`n"

Write-Host "📋 Step 1: Get API Key from Render" -ForegroundColor Green
Write-Host "   1. Go to: https://dashboard.render.com/" -ForegroundColor White
Write-Host "   2. Click on your 'chesschat-stockfish' service" -ForegroundColor White
Write-Host "   3. Go to 'Environment' tab" -ForegroundColor White
Write-Host "   4. Copy the value of STOCKFISH_API_KEY" -ForegroundColor White
Write-Host ""

# Prompt for API key
$apiKey = Read-Host "Paste the STOCKFISH_API_KEY from Render"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "`n❌ No API key provided. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Step 2: Update Cloudflare Worker Secret" -ForegroundColor Green

# Navigate to worker-api directory
Set-Location "$PSScriptRoot\worker-api"

# Update the secret
Write-Host "   Updating STOCKFISH_API_KEY secret..." -ForegroundColor White
$apiKey | wrangler secret put STOCKFISH_API_KEY

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ API key updated successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to update secret" -ForegroundColor Red
    exit 1
}

Write-Host "`n📋 Step 3: Test the connection" -ForegroundColor Green
Write-Host "   Running connection test..." -ForegroundColor White

$env:STOCKFISH_API_KEY = $apiKey
node test-stockfish-connection.mjs

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 Stockfish API is now configured correctly!" -ForegroundColor Green
    Write-Host "`nNext: Test game ingestion with:" -ForegroundColor Cyan
    Write-Host '   Invoke-WebRequest -UseBasicParsing -Uri "https://chesschat.uk/api/learning/ingest-game" -Method POST -Headers @{"Content-Type"="application/json"} -Body ''{"userId":"test","gameId":"g1","pgn":"1. e4 e5 2. Nf3","chatContext":"test"}''' -ForegroundColor White
} else {
    Write-Host "`n❌ Connection test failed. Check the API key." -ForegroundColor Red
    exit 1
}
