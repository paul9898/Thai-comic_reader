$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$RuntimeRoot = Join-Path $ProjectRoot "backend_windows"
$VenvPath = Join-Path $RuntimeRoot ".venv"
$PythonExe = Join-Path $VenvPath "Scripts\python.exe"
$RequirementsPath = Join-Path $ProjectRoot "backend\requirements.txt"

Write-Host "Preparing Windows backend runtime..." -ForegroundColor Cyan
Write-Host "Project root: $ProjectRoot"

if (-not (Test-Path $RuntimeRoot)) {
    New-Item -ItemType Directory -Path $RuntimeRoot | Out-Null
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3 for Windows first."
}

if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating virtual environment at $VenvPath" -ForegroundColor Yellow
    py -3 -m venv $VenvPath
}

Write-Host "Upgrading pip tooling..." -ForegroundColor Yellow
& $PythonExe -m pip install --upgrade pip wheel setuptools

Write-Host "Installing backend requirements..." -ForegroundColor Yellow
& $PythonExe -m pip install -r $RequirementsPath

Write-Host ""
Write-Host "Windows backend runtime is ready." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  cd $ProjectRoot\electron_app"
Write-Host "  npm run package:prep:win"
Write-Host "  npm run package:win"
