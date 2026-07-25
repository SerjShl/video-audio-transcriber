@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Prefer the project virtualenv; fall back to the py launcher.
if exist ".venv\Scripts\python.exe" (
    set "PY=.venv\Scripts\python.exe"
) else (
    set "PY=py"
)

echo Starting Transcriber on http://127.0.0.1:8000 ...
start "Transcriber server" %PY% -m backend.server

rem Give the server a moment, then open the browser.
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:8000

echo.
echo The server runs in the other window. Close it to stop Transcriber.
