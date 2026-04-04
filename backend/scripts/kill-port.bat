@echo off
REM Batch script to kill process using port 3001
echo Checking for processes using port 3001...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Found process using port 3001: PID %%a
    taskkill /PID %%a /F
    if errorlevel 0 (
        echo Successfully killed process %%a
    ) else (
        echo Failed to kill process %%a
    )
)

timeout /t 1 /nobreak >nul
netstat -ano | findstr :3001
if errorlevel 1 (
    echo Port 3001 is now free
) else (
    echo Warning: Port 3001 may still be in use
)

