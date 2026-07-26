@echo off
rem Windows launcher: double-click to set up (first run) and start the local server.
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Transcriber
if not defined PORT set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%"
set "FFMPEG_DIR=%~dp0tools\ffmpeg"
rem Call these by full path: a trimmed-down PATH must not break the setup.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" set "PS=powershell"
set "CURL=%SystemRoot%\System32\curl.exe"
if not exist "%CURL%" set "CURL=curl"

echo ==========================================
echo    Video/Audio Transcriber
echo ==========================================
echo.

rem --- Already running? Just open the browser. ---
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 goto already_running

rem --- 1. Python interpreter (3.10+) ---
if exist ".venv\Scripts\python.exe" goto python_ready
echo [setup] First run - creating a virtual environment in .venv ...
rem Look for a real Python 3.10+. "python" in PATH is often the Microsoft Store
rem stub, and the py launcher can miss versions it has no registry entry for, so
rem the standard install folders are searched too (newest first).
set "BOOT="
call :try_python py -3
if defined BOOT goto boot_ok
call :try_python python
if defined BOOT goto boot_ok
call :try_python python3
if defined BOOT goto boot_ok
for /f "delims=" %%D in ('dir /b /ad /o-n "%LOCALAPPDATA%\Programs\Python\Python3*" 2^>nul') do (
    call :try_python "%LOCALAPPDATA%\Programs\Python\%%D\python.exe"
    if defined BOOT goto boot_ok
)
for /f "delims=" %%D in ('dir /b /ad /o-n "%ProgramFiles%\Python3*" 2^>nul') do (
    call :try_python "%ProgramFiles%\%%D\python.exe"
    if defined BOOT goto boot_ok
)
goto no_python

:boot_ok
echo [setup] Using %BOOT%
%BOOT% -m venv .venv
if errorlevel 1 goto venv_failed
if not exist ".venv\Scripts\python.exe" goto venv_failed

:python_ready
set "PY=.venv\Scripts\python.exe"

rem --- 2. Python dependencies ---
"%PY%" -c "import fastapi, uvicorn, groq" >nul 2>&1
if not errorlevel 1 goto deps_ready
echo [setup] Installing Python dependencies - this takes a minute or two ...
"%PY%" -m pip install --upgrade pip >nul 2>&1
"%PY%" -m pip install ".[server]"
if errorlevel 1 goto pip_failed
:deps_ready

rem --- 3. ffmpeg (needed to convert/split audio) ---
rem A copy downloaded earlier into tools\ffmpeg wins, so nothing has to be
rem installed system-wide and no PATH change survives outside this window.
if exist "%FFMPEG_DIR%\ffmpeg.exe" (
    set "PATH=%FFMPEG_DIR%;%PATH%"
    goto ffmpeg_ready
)
where ffmpeg >nul 2>&1
if not errorlevel 1 goto ffmpeg_ready
goto offer_ffmpeg
:ffmpeg_ready

rem --- 4. Web interface (frontend/dist is not in git, so a fresh clone must build it) ---
if exist "frontend\dist\index.html" goto ui_ready
echo [setup] Building the web interface - first run only ...
where npm >nul 2>&1
if errorlevel 1 goto no_node
pushd frontend
call npm install
if errorlevel 1 goto npm_failed_popd
call npm run build
if errorlevel 1 goto npm_failed_popd
popd
:ui_ready

rem --- 5. Run (browser opens once the server is up) ---
echo.
echo Starting Transcriber on %URL%
echo Keep this window open. Close it or press Ctrl+C to stop.
echo.
rem ping is used as a sleep - unlike timeout it also works with redirected input
start "" /b cmd /c "ping -n 5 127.0.0.1 >nul & start %URL%"
"%PY%" -m backend.server
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" echo [ERROR] The server stopped with exit code %CODE% - see the messages above.
echo Transcriber stopped.
pause
exit /b %CODE%

:already_running
echo Port %PORT% is already in use - opening %URL%
echo If that page is not Transcriber, close the app using the port
echo or start this launcher with a different one:  set PORT=8010
start %URL%
ping -n 3 127.0.0.1 >nul
exit /b 0

rem --- ffmpeg is missing: offer to fetch a private copy into tools\ffmpeg ---
:offer_ffmpeg
echo [setup] ffmpeg is needed to convert and split audio, and it was not found.
echo.
echo It can be downloaded now - about 160 MB to fetch, 280 MB on disk - into:
echo    %FFMPEG_DIR%
echo Nothing is installed system-wide and no settings are changed - deleting
echo that folder removes it again.
echo.
set "ANSWER="
set /p "ANSWER=Download ffmpeg now? [Y/n]: "
if /i "%ANSWER%"=="n" goto ffmpeg_skipped
call :download_ffmpeg
if errorlevel 1 goto ffmpeg_download_failed
set "PATH=%FFMPEG_DIR%;%PATH%"
echo [setup] ffmpeg is ready.
goto ffmpeg_ready

:ffmpeg_skipped
echo.
echo [WARNING] Continuing without ffmpeg - transcription will fail until it is
echo installed. Start this launcher again to download it, or install it yourself.
echo.
pause
goto ffmpeg_ready

:ffmpeg_download_failed
echo.
echo [WARNING] Downloading ffmpeg did not work - see the messages above.
echo.
echo You can install it by hand instead:
where winget >nul 2>&1
if not errorlevel 1 echo    winget install Gyan.FFmpeg
echo    or download the "essentials" build from https://www.gyan.dev/ffmpeg/builds/
echo    and copy ffmpeg.exe and ffprobe.exe into:
echo    %FFMPEG_DIR%
echo.
start https://www.gyan.dev/ffmpeg/builds/
pause
goto ffmpeg_ready

:no_python
echo [ERROR] Python is not installed (version 3.10 or newer is required).
echo.
echo The download page will now open in your browser. What to do there:
echo    1. Click the big yellow "Download Python" button
echo    2. Run the file it downloads
echo    3. IMPORTANT: tick "Add python.exe to PATH" at the bottom of the installer
echo    4. Close this window, then start Transcriber again
where winget >nul 2>&1
if not errorlevel 1 (
    echo.
    echo Or, if you prefer the command line:  winget install Python.Python.3.12
)
echo.
echo Note: the "python" that comes with Windows via the Microsoft Store is only a
echo placeholder that opens the Store - a real installation is required.
echo.
start https://www.python.org/downloads/
goto fail

:venv_failed
echo [ERROR] Could not create the virtual environment (.venv).
echo Check that you can write to this folder and try again.
goto fail

:pip_failed
echo [ERROR] Installing the Python dependencies failed - see the messages above.
goto fail

:no_node
echo [ERROR] The web interface is not built yet, and Node.js was not found.
echo.
echo Easiest fix: download the ready-to-run archive from the project's Releases
echo page instead - its interface is already built, so Node.js is not needed.
echo.
echo Otherwise the download page will open in your browser: install Node.js
echo (the "LTS" button), close this window and start Transcriber again.
where winget >nul 2>&1
if not errorlevel 1 (
    echo.
    echo Or, if you prefer the command line:  winget install OpenJS.NodeJS.LTS
)
echo.
start https://nodejs.org/
goto fail

:npm_failed_popd
popd
echo [ERROR] Building the web interface failed - see the messages above.
goto fail

:fail
echo.
pause
exit /b 1

rem --- subroutine: set BOOT if the given command is a working Python 3.10+ ---
:try_python
if defined BOOT exit /b 0
%* -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 exit /b 0
set "BOOT=%*"
exit /b 0

rem --- subroutine: download ffmpeg and keep only ffmpeg.exe + ffprobe.exe ---
:download_ffmpeg
set "FF_ZIP=%TEMP%\ffmpeg-transcriber.zip"
set "FF_DEST=%FFMPEG_DIR%"
if exist "%FF_ZIP%" del /q "%FF_ZIP%"
echo.
echo [setup] Downloading ffmpeg ...
rem The GitHub build is served from a CDN and is the fast one; gyan.dev is the
rem project's own host, kept only as a fallback because it can be very slow.
call :fetch_zip "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
if not errorlevel 1 goto unpack_ffmpeg
echo.
echo [setup] That mirror failed - trying another one ...
call :fetch_zip "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
if errorlevel 1 exit /b 1

:unpack_ffmpeg
echo [setup] Unpacking ...
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $t=Join-Path $env:TEMP 'ffmpeg-transcriber-unpack'; if(Test-Path $t){Remove-Item $t -Recurse -Force}; Expand-Archive -Path $env:FF_ZIP -DestinationPath $t -Force; $b=Get-ChildItem $t -Recurse -Directory -Filter bin | Select-Object -First 1; if(-not $b){throw 'no bin folder inside the archive'}; New-Item -ItemType Directory -Path $env:FF_DEST -Force | Out-Null; foreach($n in 'ffmpeg.exe','ffprobe.exe'){ Copy-Item (Join-Path $b.FullName $n) $env:FF_DEST -Force }; Remove-Item $t -Recurse -Force"
if errorlevel 1 exit /b 1
if exist "%FF_ZIP%" del /q "%FF_ZIP%"
if not exist "%FF_DEST%\ffmpeg.exe" exit /b 1
if not exist "%FF_DEST%\ffprobe.exe" exit /b 1
"%FF_DEST%\ffmpeg.exe" -version >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

rem --- subroutine: download %1 into FF_ZIP; curl first, PowerShell for old systems ---
:fetch_zip
set "FF_URL=%~1"
if "%CURL%"=="curl" where curl >nul 2>&1 || goto fetch_with_powershell
"%CURL%" -L --fail --retry 2 --connect-timeout 20 -o "%FF_ZIP%" "%FF_URL%"
exit /b %ERRORLEVEL%
:fetch_with_powershell
"%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; (New-Object Net.WebClient).DownloadFile($env:FF_URL, $env:FF_ZIP)"
exit /b %ERRORLEVEL%
