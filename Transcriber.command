#!/bin/bash
# macOS launcher: double-click to set up (first run) and start the local server.
cd "$(dirname "$0")" || exit 1

PORT="${PORT:-8000}"
URL="http://127.0.0.1:$PORT"
FFMPEG_DIR="$(pwd)/tools/ffmpeg"

echo "=========================================="
echo "   Video/Audio Transcriber"
echo "=========================================="
echo

fail() {
  echo
  echo "$1"
  echo
  read -r -p "Press Enter to close..." _
  exit 1
}

# --- Already running? Just open the browser. ---
if curl -fsS --max-time 2 "$URL/healthz" >/dev/null 2>&1; then
  echo "Transcriber is already running - opening $URL"
  open "$URL"
  exit 0
fi

# --- 1. Python interpreter (3.10+) ---
if [ ! -x ".venv/bin/python" ]; then
  echo "[setup] First run - creating a virtual environment in .venv ..."
  BOOT=""
  for candidate in python3 python3.12 python3.11 python3.10; do
    if command -v "$candidate" >/dev/null 2>&1 &&
       "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      BOOT="$candidate"
      break
    fi
  done
  if [ -z "$BOOT" ]; then
    echo "[ERROR] Python is not installed (version 3.10 or newer is required)."
    echo
    if command -v brew >/dev/null 2>&1; then
      echo "Install it with:  brew install python"
      echo "Then close this window and start Transcriber again."
    else
      echo "The download page will now open in your browser:"
      echo "  1. Download the macOS installer and run it"
      echo "  2. Close this window, then start Transcriber again"
      open https://www.python.org/downloads/
    fi
    fail ""
  fi
  "$BOOT" -m venv .venv || fail "[ERROR] Could not create the virtual environment (.venv)."
fi
PY=".venv/bin/python"

# --- 2. Python dependencies ---
if ! "$PY" -c "import fastapi, uvicorn, groq" >/dev/null 2>&1; then
  echo "[setup] Installing Python dependencies - this takes a minute or two ..."
  "$PY" -m pip install --upgrade pip >/dev/null 2>&1
  "$PY" -m pip install ".[server]" ||
    fail "[ERROR] Installing the Python dependencies failed - see the messages above."
fi

# --- 3. ffmpeg (needed to convert/split audio) ---
if [ -x "$FFMPEG_DIR/ffmpeg" ]; then
  PATH="$FFMPEG_DIR:$PATH"
  export PATH
elif ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[setup] ffmpeg is needed to convert and split audio, and it was not found."
  echo
  if command -v brew >/dev/null 2>&1; then
    read -r -p "Install it now with Homebrew? [Y/n]: " ANSWER
    case "$ANSWER" in
      [nN]*) echo "[WARNING] Continuing without ffmpeg - transcription will fail." ;;
      *) brew install ffmpeg || echo "[WARNING] brew install ffmpeg failed - install it by hand." ;;
    esac
  else
    echo "Homebrew is not installed, so ffmpeg cannot be fetched automatically."
    echo "Install Homebrew from https://brew.sh (its page is opening now), then run:"
    echo "    brew install ffmpeg"
    echo "and start Transcriber again."
    open https://brew.sh
    echo
    read -r -p "Press Enter to continue anyway..." _
  fi
fi

# --- 4. Web interface (frontend/dist is not in git, so a fresh clone must build it) ---
if [ ! -f "frontend/dist/index.html" ]; then
  echo "[setup] Building the web interface - first run only ..."
  if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] The web interface is not built yet, and Node.js was not found."
    echo
    echo "Easiest fix: download the ready-to-run archive from the project's"
    echo "Releases page instead - its interface is already built."
    echo
    if command -v brew >/dev/null 2>&1; then
      echo "Or install Node.js with:  brew install node"
    else
      echo "Or install Node.js from https://nodejs.org (opening now)."
      open https://nodejs.org/
    fi
    fail "Then start Transcriber again."
  fi
  (cd frontend && npm install && npm run build) ||
    fail "[ERROR] Building the web interface failed - see the messages above."
fi

# --- 5. Run (browser opens once the server is up) ---
echo
echo "Starting Transcriber on $URL"
echo "Keep this window open. Close it or press Ctrl+C to stop."
echo
(sleep 4 && open "$URL") &

"$PY" -m backend.server
CODE=$?
echo
[ "$CODE" -eq 0 ] || echo "[ERROR] The server stopped with exit code $CODE - see the messages above."
echo "Transcriber stopped."
read -r -p "Press Enter to close..." _
exit "$CODE"
