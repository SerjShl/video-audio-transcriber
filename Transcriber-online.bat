@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Publish the LOCAL server (your hardware) to a public HTTPS URL via
rem Tailscale Funnel. Requires Tailscale installed and signed in once, with
rem HTTPS + Funnel enabled in the admin console. See README "Access via link".

where tailscale >nul 2>nul
if errorlevel 1 (
    echo Tailscale is not installed. Get it: https://tailscale.com/download/windows
    pause
    exit /b 1
)

if exist ".venv\Scripts\python.exe" (
    set "PY=.venv\Scripts\python.exe"
) else (
    set "PY=py"
)

echo Starting local server on http://127.0.0.1:8000 ...
start "Transcriber server" %PY% -m backend.server

rem Let the server come up before exposing it.
timeout /t 4 /nobreak >nul

echo.
echo Publishing to the internet via Tailscale Funnel...
echo (The public https URL is printed below — share it. Ctrl+C here stops sharing.)
echo.
tailscale funnel 8000
