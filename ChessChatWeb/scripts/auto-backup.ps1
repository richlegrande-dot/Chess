# Auto-backup script for Wall-E's knowledge base
# Run this script regularly (e.g., via Task Scheduler) to ensure data is always backed up

$ErrorActionPreference = "Stop"

Write-Host "`n🤖 Wall-E Knowledge Backup Automation" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Navigate to project directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
Set-Location $projectDir

Write-Host "📁 Project: $projectDir" -ForegroundColor Gray

# Load DATABASE_URL from .env
if (Test-Path ".env") {
    $dbUrl = Get-Content .env | Select-String -Pattern 'DATABASE_URL=' | ForEach-Object { $_ -replace 'DATABASE_URL=', '' } | ForEach-Object { $_ -replace '"', '' }
    if ($dbUrl) {
        $env:DATABASE_URL = $dbUrl.Trim()
        Write-Host "✓ Loaded DATABASE_URL from .env" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  No .env file found" -ForegroundColor Yellow
}

# Run backup
Write-Host "`n🔄 Running backup..." -ForegroundColor Cyan
npm run db:backup

# Check if backup succeeded
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Backup completed successfully!" -ForegroundColor Green
    
    # Commit to git if in a git repo
    if (Test-Path ".git") {
        Write-Host "`n📝 Committing backup to git..." -ForegroundColor Cyan
        git add backups/latest/*
        $commitDate = Get-Date -Format "yyyy-MM-dd HH:mm"
        git commit -m "Auto-backup: Wall-E knowledge base ($commitDate)" -q 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Committed to git" -ForegroundColor Green
            
            # Optional: Push to remote
            # Uncomment the next two lines to enable auto-push
            # git push origin main -q 2>$null
            # Write-Host "✓ Pushed to remote" -ForegroundColor Green
        } else {
            Write-Host "ℹ️  No changes to commit" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "`n❌ Backup failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Done!`n" -ForegroundColor Green
