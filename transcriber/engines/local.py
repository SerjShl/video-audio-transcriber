"""Offline engine — faster-whisper.

The model is loaded lazily and cached on the instance, so a long-lived process
(e.g. the web server) loads it once and reuses it across every file instead of
paying the load cost per transcription.
"""

from pathlib import Path

from ..config import LOCAL_COMPUTE_TYPE, LOCAL_DEVICE, LOCAL_MODEL
from .base import Engine


class LocalEngine(Engine):
    name = "local"
    label = "local faster-whisper"
    # Nothing is uploaded, so there is no size limit — never compress/split.
    max_file_size_mb = float("inf")

    def __init__(self):
        self._model = None

    def ensure_ready(self) -> None:
        try:
            import faster_whisper  # noqa: F401
        except ImportError as error:
            raise RuntimeError(
                'The local engine needs faster-whisper. Install it with: '
                'pip install "video-audio-transcriber[local]"'
            ) from error

    def _load_model(self):
        if self._model is None:
            from faster_whisper import WhisperModel

            print(f"📦 Loading local model '{LOCAL_MODEL}' ({LOCAL_DEVICE})...")
            self._model = WhisperModel(
                LOCAL_MODEL,
                device=LOCAL_DEVICE,
                compute_type=LOCAL_COMPUTE_TYPE,
            )
        return self._model

    def transcribe_chunk(self, audio_path, language) -> list[dict]:
        model = self._load_model()
        segments, _info = model.transcribe(str(Path(audio_path)), language=language)
        return [
            {"start": seg.start, "end": seg.end, "text": (seg.text or "").strip()}
            for seg in segments
        ]
