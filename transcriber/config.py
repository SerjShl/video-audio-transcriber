"""Configuration constants and directory setup.

Values are read from the environment once at import time so the rest of the
package can stay free of ``os.environ`` lookups.
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DIRS = {
    "downloads": ROOT / "downloads",
    "transcripts": ROOT / "transcripts",
    "input": ROOT / "input",
}

# Transcription engine: "groq" (cloud API) or "local" (offline faster-whisper).
DEFAULT_ENGINE = os.environ.get("TRANSCRIBER_ENGINE", "groq")

# Groq caps uploads at 25 MB; stay just under to leave headroom.
MAX_FILE_SIZE_MB = 24
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "whisper-large-v3-turbo")

# Local engine (faster-whisper). The model is downloaded once and cached; after
# that the engine runs fully offline and reuses the loaded model across files.
LOCAL_MODEL = os.environ.get("WHISPER_LOCAL_MODEL", "large-v3")
LOCAL_DEVICE = os.environ.get("WHISPER_DEVICE", "auto")  # auto | cpu | cuda
LOCAL_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "default")

PARAGRAPH_MIN_CHARS = 280
MIN_CHUNK_BYTES = 2048
AUDIO_SAMPLE_RATE = "16000"
AUDIO_CHANNELS = "1"
AUDIO_BITRATE = "32k"

SCAN_CONCURRENCY = int(os.environ.get("SCAN_CONCURRENCY") or 3)
SCAN_EXTENSIONS = {".mp4", ".mp3", ".wav", ".m4a", ".webm"}
DEFAULT_LANGUAGE = "ru"
OUTPUT_FORMATS = ["txt", "srt", "vtt", "json"]

API_RETRIES = 3
API_RETRY_BASE_MS = 1000


def ensure_dirs() -> None:
    for directory in DIRS.values():
        directory.mkdir(parents=True, exist_ok=True)
