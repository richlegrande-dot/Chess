# ChessChat Web-Only Setup Script
# Universal chess application for all platforms via modern web technologies
# Deploys to Cloudflare Pages for instant global accessibility

Write-Host "🌐 ChessChat Web-Only Platform - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Platform: Web (Cloudflare Pages)" -ForegroundColor White
Write-Host "Compatible: All browsers, all devices" -ForegroundColor White
Write-Host ""

# Check Node.js installation
Write-Host "✓ Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found! Please install Node.js from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm installation
Write-Host "✓ Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  npm version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ npm not found! Please reinstall Node.js" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 1: Installing Dependencies" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 2: API Key Configuration" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if .dev.vars exists
if (Test-Path ".dev.vars") {
    Write-Host "✓ Found .dev.vars file" -ForegroundColor Green
    
    # Check if API key is configured
    $devVarsContent = Get-Content ".dev.vars" -Raw
    if ($devVarsContent -match "OPENAI_API_KEY=sk-[a-zA-Z0-9-]+") {
        Write-Host "✓ OpenAI API key appears to be configured" -ForegroundColor Green
        $apiConfigured = $true
    } else {
        Write-Host "⚠️  .dev.vars exists but API key might not be configured" -ForegroundColor Yellow
        Write-Host "  Please ensure your .dev.vars file contains:" -ForegroundColor Yellow
        Write-Host "  OPENAI_API_KEY=sk-your-actual-api-key-here" -ForegroundColor White
        $apiConfigured = $false
    }
} else {
    Write-Host "⚠️  .dev.vars file not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating .dev.vars from template..." -ForegroundColor Yellow
    
    if (Test-Path ".dev.vars.example") {
        Copy-Item ".dev.vars.example" ".dev.vars"
        Write-Host "✓ Created .dev.vars file" -ForegroundColor Green
    } else {
        # Create .dev.vars if template doesn't exist
        "# Local development environment variables`nOPENAI_API_KEY=sk-your-openai-api-key-here" | Out-File -FilePath ".dev.vars" -Encoding utf8
        Write-Host "✓ Created .dev.vars file" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📝 IMPORTANT: You need to add your OpenAI API key!" -ForegroundColor Red
    Write-Host "   1. Open .dev.vars in your editor" -ForegroundColor White
    Write-Host "   2. Replace 'sk-your-openai-api-key-here' with your actual key" -ForegroundColor White
    Write-Host "   3. Get your key from: https://platform.openai.com/api-keys" -ForegroundColor White
    Write-Host ""
    
    $apiConfigured = $false
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Step 3: Build Project" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build successful!" -ForegroundColor Green
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Setup Complete! 🎉" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($apiConfigured) {
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  1. Run 'npm run dev' to start local development server" -ForegroundColor White
    Write-Host "  2. Open http://localhost:3000 in your browser" -ForegroundColor White
    Write-Host "  3. Start playing chess against AI!" -ForegroundColor White
    Write-Host ""
    Write-Host "To deploy to Cloudflare Pages:" -ForegroundColor Green
    Write-Host "  1. Run 'npx wrangler login' to authenticate" -ForegroundColor White
    Write-Host "  2. Run 'npx wrangler pages secret put OPENAI_API_KEY' to set production key" -ForegroundColor White
    Write-Host "  3. Run 'npm run deploy' to deploy" -ForegroundColor White
} else {
    Write-Host "⚠️  Before you can run the app:" -ForegroundColor Yellow
    Write-Host "  1. Edit .dev.vars and add your OpenAI API key" -ForegroundColor White
    Write-Host "  2. Get your key from: https://platform.openai.com/api-keys" -ForegroundColor White
    Write-Host ""
    Write-Host "After adding your API key:" -ForegroundColor Green
    Write-Host "  1. Run 'npm run dev' to start local development server" -ForegroundColor White
    Write-Host "  2. Open http://localhost:3000 in your browser" -ForegroundColor White
}

Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "  - DEPLOYMENT.md         - Cloudflare deployment guide" -ForegroundColor White
Write-Host "  - WEB_ONLY_POLICY.md    - Web-only development policy" -ForegroundColor White
Write-Host "  - WEB_PLATFORM.md       - Platform capabilities overview" -ForegroundColor White
Write-Host "  - WEB_ONBOARDING_GUIDE.md - User getting started guide" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Testing Recommendations:" -ForegroundColor Cyan
Write-Host "  1. Test in multiple browsers (Chrome, Firefox, Safari, Edge)" -ForegroundColor White
Write-Host "  2. Test on mobile browsers (iOS Safari, Android Chrome)" -ForegroundColor White
Write-Host "  3. Run Lighthouse audit for performance/accessibility" -ForegroundColor White
Write-Host "  4. Verify keyboard navigation and screen reader compatibility" -ForegroundColor White
Write-Host ""
