"""Configuration constants and directory setup.

Values are read from the environment once at import time so the rest of the
package can stay free of ``os.environ`` lookups.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env before reading any variables below, so settings like WHISPER_DEVICE
# actually take effect (config is imported before callers call load_dotenv).
load_dotenv()

ROOT = Path(__file__).resolve().parent.parent

# All runtime folders live under a single data/ dir to keep the repo root tidy.
DATA_DIR = ROOT / "data"
DIRS = {
    "downloads": DATA_DIR / "downloads",
    "transcripts": DATA_DIR / "transcripts",
    "input": DATA_DIR / "input",
}

# Runtime settings the user edits in the app (Groq key, YouTube cookies name),
# stored next to the data files. Kept local — nothing here is ever served back.
SETTINGS_PATH = DATA_DIR / "settings.json"
COOKIES_PATH = DATA_DIR / "cookies.txt"


def load_settings() -> dict:
    try:
        return json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_settings(settings: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")


def groq_api_key() -> str:
    """The Groq key entered in the app Settings, falling back to the env var."""
    return (load_settings().get("groq_api_key") or os.environ.get("GROQ_API_KEY") or "").strip()

# Transcription engine: "groq" (cloud API) or "local" (offline faster-whisper).
# When TRANSCRIBER_ENGINE is unset the default is resolved at runtime from what's
# configured — see backend.engines.resolve_default_engine.

# Groq caps uploads at 25 MB; stay just under to leave headroom.
MAX_FILE_SIZE_MB = 24
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "whisper-large-v3-turbo")

# Local engine (faster-whisper). The model is downloaded once and cached; after
# that the engine runs fully offline and reuses the loaded model across files.
LOCAL_MODEL = os.environ.get("WHISPER_LOCAL_MODEL", "large-v3")
# Default to CPU: it works everywhere. Set WHISPER_DEVICE=cuda (or auto) only if
# you have a working CUDA runtime — otherwise CTranslate2 fails on cublas DLLs.
LOCAL_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")  # cpu | cuda | auto
LOCAL_COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "default")

PARAGRAPH_MIN_CHARS = 280
MIN_CHUNK_BYTES = 2048
AUDIO_SAMPLE_RATE = "16000"
AUDIO_CHANNELS = "1"
AUDIO_BITRATE = "32k"

# Safety bound on web uploads. Generous by default so ordinary videos pass
# through untouched — the pipeline compresses anything large to 16 kHz audio
# before transcribing. Lower it on a small instance via the env var (see
# render.yaml). Uploads stream straight to disk, never fully into RAM.
MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB") or 4096)

SCAN_CONCURRENCY = int(os.environ.get("SCAN_CONCURRENCY") or 3)
SCAN_EXTENSIONS = {".mp4", ".mp3", ".wav", ".m4a", ".webm"}
DEFAULT_LANGUAGE = "ru"
OUTPUT_FORMATS = ["txt", "srt", "vtt", "json", "docx", "pdf"]

API_RETRIES = 3
API_RETRY_BASE_MS = 1000


def ensure_dirs() -> None:
    for directory in DIRS.values():
        directory.mkdir(parents=True, exist_ok=True)
