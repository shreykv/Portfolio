# Local Testing Server Script
# Portfolio Website

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Local Testing Server" -ForegroundColor Cyan
Write-Host "  Portfolio Website" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "OR use the Node.js option (see README.md)" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting local server..." -ForegroundColor Green
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Cyan
Write-Host "  Portfolio: http://localhost:8000" -ForegroundColor White
Write-Host "  Personal:  http://localhost:8000/personal.html" -ForegroundColor White
Write-Host ""
Write-Host "Server starting in a new window..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C in the server window to stop" -ForegroundColor Yellow
Write-Host ""

# Start Python HTTP server in a new window
try {
    Start-Process python -ArgumentList "-m","http.server","8000" -WindowStyle Normal
    
    # Wait for server to start
    Write-Host "Opening browser in 3 seconds..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    
    # Open browser
    Start-Process "http://localhost:8000"
    
    Write-Host ""
    Write-Host "Server is running! Check the Python server window." -ForegroundColor Green
    Write-Host "Close that window or press Ctrl+C there to stop the server." -ForegroundColor Yellow
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to start server. Port 8000 may be in use." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
