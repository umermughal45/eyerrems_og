# Prisma Helper Script
# Ensures .env is loaded before running Prisma commands

param(
    [Parameter(Mandatory=$true)]
    [string]$Command
)

# Get the script directory (server folder)
$scriptDir = Split-Path -Parent $PSScriptRoot
$serverDir = $scriptDir

# Change to server directory
Set-Location $serverDir

# Load .env file manually
$envFile = Join-Path $serverDir ".env"
if (Test-Path $envFile) {
    Write-Host "Loading .env file..." -ForegroundColor Green
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.+)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            if ($value -match '^["''](.+)["'']$') {
                $value = $matches[1]
            }
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✓ Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found at: $envFile" -ForegroundColor Yellow
}

# Verify DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ ERROR: DATABASE_URL is not set!" -ForegroundColor Red
    Write-Host "Please check your .env file" -ForegroundColor Yellow
    exit 1
}

if (-not ($env:DATABASE_URL -match '^postgresql://|^postgres://')) {
    Write-Host "❌ ERROR: DATABASE_URL must start with postgresql:// or postgres://" -ForegroundColor Red
    Write-Host "Current value: $($env:DATABASE_URL.Substring(0, [Math]::Min(50, $env:DATABASE_URL.Length)))..." -ForegroundColor Yellow
    exit 1
}

Write-Host "`nRunning: npx prisma $Command" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

# Run the Prisma command
npx prisma $Command

