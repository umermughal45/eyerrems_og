# PowerShell script to kill process using a specific port
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Checking for processes using port $Port..." -ForegroundColor Yellow

$connections = netstat -ano | findstr ":$Port"
if ($connections) {
    $pids = $connections | ForEach-Object {
        $parts = $_ -split '\s+'
        $parts[-1]
    } | Select-Object -Unique
    
    foreach ($pid in $pids) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Found process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
            Write-Host "Killing process $pid..." -ForegroundColor Yellow
            taskkill /PID $pid /F
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Successfully killed process $pid" -ForegroundColor Green
            } else {
                Write-Host "✗ Failed to kill process $pid" -ForegroundColor Red
            }
        }
    }
    
    Start-Sleep -Seconds 1
    $remaining = netstat -ano | findstr ":$Port"
    if ($remaining) {
        Write-Host "⚠ Warning: Port $Port may still be in use" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Port $Port is now free" -ForegroundColor Green
    }
} else {
    Write-Host "✓ Port $Port is free" -ForegroundColor Green
}

