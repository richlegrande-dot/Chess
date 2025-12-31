# Chess Coach Training Environment Setup
# Windows PowerShell script

Write-Host "🎯 Setting up Chess Coach LLM Training Environment" -ForegroundColor Cyan
Write-Host ""

# Check Python version
Write-Host "Checking Python version..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Python not found. Please install Python 3.9+ from python.org" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found: $pythonVersion" -ForegroundColor Green

# Check if Python version is 3.9+
$versionMatch = $pythonVersion -match "Python (\d+)\.(\d+)"
$major = [int]$matches[1]
$minor = [int]$matches[2]

if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 9)) {
    Write-Host "❌ Python 3.9+ required. Found: $pythonVersion" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "⚠️  Virtual environment already exists. Skipping..." -ForegroundColor Yellow
} else {
    python -m venv venv
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Virtual environment created" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to activate virtual environment" -ForegroundColor Red
    Write-Host "Try running: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet
Write-Host "✅ Pip upgraded" -ForegroundColor Green

Write-Host ""

# Install dependencies
Write-Host "Installing dependencies (this may take 5-10 minutes)..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create directory structure
Write-Host "Creating directory structure..." -ForegroundColor Yellow

$directories = @(
    "data\raw",
    "data\processed",
    "data\samples",
    "checkpoints",
    "models",
    "configs"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✅ Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Exists: $dir" -ForegroundColor Yellow
    }
}

Write-Host ""

# Test installation
Write-Host "Testing installation..." -ForegroundColor Yellow
python -c "import torch; import transformers; print('PyTorch:', torch.__version__); print('Transformers:', transformers.__version__)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Installation test passed" -ForegroundColor Green
} else {
    Write-Host "❌ Installation test failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Export training data from ChessChatWeb (📊 Training Data → Export JSONL)"
Write-Host "  2. Save file to: training\data\raw\training_data.jsonl"
Write-Host "  3. Run: python scripts\process_data.py --input data\raw\training_data.jsonl"
Write-Host "  4. Run: python scripts\train_model.py --config configs\gpt2_small.yaml"
Write-Host ""
Write-Host "To activate this environment later:" -ForegroundColor Yellow
Write-Host "  .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host ""
