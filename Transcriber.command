#!/bin/bash
# macOS launcher: double-click to start the local server and open the browser.
cd "$(dirname "$0")" || exit 1

if [ -x ".venv/bin/python" ]; then
  PY=".venv/bin/python"
else
  PY="python3"
fi

echo "Starting Transcriber on http://127.0.0.1:8000 ..."
"$PY" -m backend.server &
SERVER_PID=$!

sleep 3
open http://127.0.0.1:8000

echo "Server is running. Close this window (or press Ctrl+C) to stop Transcriber."
wait "$SERVER_PID"
