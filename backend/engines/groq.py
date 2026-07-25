"""Cloud engine — Groq Whisper API."""

import os
from pathlib import Path

from ..config import API_RETRIES, API_RETRY_BASE_MS, MAX_FILE_SIZE_MB, WHISPER_MODEL
from ..pool import with_retry
from .base import Engine, read_segment


class GroqEngine(Engine):
    name = "groq"
    label = "Groq"
    # Groq rejects uploads over 25 MB, so oversized files are compressed/split.
    max_file_size_mb = float(MAX_FILE_SIZE_MB)

    def __init__(self):
        self._client = None

    def _client_lazy(self):
        # Imported lazily so `--help` and friendly errors work without the key.
        if self._client is None:
            from groq import Groq

            self._client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        return self._client

    def ensure_ready(self) -> None:
        if not os.environ.get("GROQ_API_KEY"):
            raise RuntimeError(
                "Add GROQ_API_KEY to your .env file. Get a key: https://console.groq.com/keys"
            )

    def transcribe_chunk(self, audio_path, language) -> list[dict]:
        audio_path = Path(audio_path)

        def call():
            return self._client_lazy().audio.transcriptions.create(
                file=(audio_path.name, audio_path.read_bytes()),
                model=WHISPER_MODEL,
                language=language,
                response_format="verbose_json",
            )

        result = with_retry(
            call,
            retries=API_RETRIES,
            base_ms=API_RETRY_BASE_MS,
            on_retry=lambda error, attempt, delay: print(
                f"   ⏳ Retry {attempt}/{API_RETRIES} in {delay / 1000:.0f}s ({error})"
            ),
        )

        segments = read_segment(result, "segments") or []
        if segments:
            return [
                {
                    "start": read_segment(seg, "start"),
                    "end": read_segment(seg, "end"),
                    "text": read_segment(seg, "text") or "",
                }
                for seg in segments
            ]
        return [{"start": None, "end": None, "text": read_segment(result, "text") or ""}]
