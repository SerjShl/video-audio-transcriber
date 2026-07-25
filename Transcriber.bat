@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (set "PY=.venv\Scripts\python.exe") else (set "PY=py")
echo Starting Transcriber on http://127.0.0.1:8000 ...
start "Transcriber" %PY% -m backend.server
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:8000
