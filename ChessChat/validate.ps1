# ChessChat Code Validation Script

Write-Host "🔍 ChessChat Code Validation Starting..." -ForegroundColor Green

$projectPath = "C:\Users\richl\LLM vs Me\ChessChat"
$swiftFiles = Get-ChildItem -Path $projectPath -Filter "*.swift" -Recurse

Write-Host "`n📁 Project Structure Check:" -ForegroundColor Yellow
Write-Host "Total Swift files found: $($swiftFiles.Count)"

# Check required files exist
$requiredFiles = @(
    "ChessChatApp.swift",
    "ContentView.swift", 
    "Models\ChessModels.swift",
    "Models\ChessBoard.swift",
    "Models\GameManager.swift",
    "Views\GameView.swift",
    "Views\PostGameChatView.swift", 
    "Views\SettingsView.swift",
    "Services\OpenAIService.swift",
    "Services\ChessEngineService.swift",
    "Utils\ChessUtilities.swift"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $projectPath "ChessChat\$file"
    if (!(Test-Path $fullPath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ All required files present" -ForegroundColor Green
} else {
    Write-Host "❌ Missing files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}

# Check Xcode project file
$xcodeProject = Join-Path $projectPath "ChessChat.xcodeproj\project.pbxproj"
if (Test-Path $xcodeProject) {
    Write-Host "✅ Xcode project file exists" -ForegroundColor Green
} else {
    Write-Host "❌ Xcode project file missing" -ForegroundColor Red
}

# Basic syntax validation (look for common issues)
Write-Host "`n🔍 Basic Syntax Check:" -ForegroundColor Yellow

$issues = @()

foreach ($file in $swiftFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Check for basic Swift issues
    if ($content -match "func\s+\w+\([^)]*\)\s*\{[^}]*$") {
        $issues += "Potential unclosed function in $($file.Name)"
    }
    
    if ($content -match "class\s+\w+[^{]*\{[^}]*$") {
        $issues += "Potential unclosed class in $($file.Name)"
    }
    
    # Check for required imports
    if ($file.Name -like "*View.swift" -and $content -notmatch "import SwiftUI") {
        $issues += "Missing 'import SwiftUI' in $($file.Name)"
    }
    
    if ($file.Name -like "*Service.swift" -and $content -notmatch "import Foundation") {
        $issues += "Missing 'import Foundation' in $($file.Name)"
    }
}

if ($issues.Count -eq 0) {
    Write-Host "✅ No obvious syntax issues found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Potential issues found:" -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

# Check file sizes (detect truncated files)
Write-Host "`n📏 File Size Check:" -ForegroundColor Yellow
$smallFiles = $swiftFiles | Where-Object { $_.Length -lt 100 }
if ($smallFiles.Count -eq 0) {
    Write-Host "✅ All files have reasonable size" -ForegroundColor Green
} else {
    Write-Host "⚠️  Suspiciously small files:" -ForegroundColor Yellow
    $smallFiles | ForEach-Object { Write-Host "  - $($_.Name): $($_.Length) bytes" -ForegroundColor Yellow }
}

# Check for API key placeholders
Write-Host "`n🔑 API Configuration Check:" -ForegroundColor Yellow
$settingsFile = Join-Path $projectPath "ChessChat\Views\SettingsView.swift"
if (Test-Path $settingsFile) {
    $settingsContent = Get-Content $settingsFile -Raw
    if ($settingsContent -match "OpenAI.*API.*key") {
        Write-Host "✅ API key configuration found in SettingsView" -ForegroundColor Green
    } else {
        Write-Host "⚠️  API key configuration may be missing" -ForegroundColor Yellow
    }
}

Write-Host "`n🎯 Quick Testing Recommendations:" -ForegroundColor Cyan
Write-Host "1. Open ChessChat.xcodeproj in Xcode (requires macOS)"
Write-Host "2. Build for iOS Simulator (Cmd+B)"
Write-Host "3. Run in simulator (Cmd+R)"
Write-Host "4. Add OpenAI API key in Settings"
Write-Host "5. Test basic chess moves"
Write-Host "6. Test post-game chat feature"

Write-Host "`n🔧 Alternative Testing (Windows):" -ForegroundColor Cyan
Write-Host "1. Review code logic manually"
Write-Host "2. Check API integration points"
Write-Host "3. Validate chess rule implementation"
Write-Host "4. Use online Swift playgrounds"

Write-Host "`n✅ Validation Complete!" -ForegroundColor Green