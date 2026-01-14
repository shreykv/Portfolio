@echo off
echo ========================================
echo   Local Testing Server
echo   Portfolio Website
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo OR use the Node.js option (see README.md)
    echo.
    pause
    exit /b 1
)

echo Python found! Starting local server...
echo.
echo Server will be available at:
echo   Portfolio: http://localhost:8000
echo   Personal:  http://localhost:8000/personal.html
echo.
echo Server starting in a new window...
echo Press Ctrl+C in the server window to stop
echo.
echo Opening browser in 3 seconds...
echo.

REM Start Python HTTP server in a new window
start "Python Server - Portfolio Website" python -m http.server 8000

REM Wait for server to start, then open browser
timeout /t 3 /nobreak >nul
start http://localhost:8000

echo.
echo Server is running! Check the "Python Server" window.
echo Close that window or press Ctrl+C there to stop the server.
echo.
