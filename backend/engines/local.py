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
            try:
                self._model = WhisperModel(
                    LOCAL_MODEL,
                    device=LOCAL_DEVICE,
                    compute_type=LOCAL_COMPUTE_TYPE,
                )
            except Exception as error:
                # A machine without a working CUDA runtime (e.g. missing
                # cublas64_*.dll) fails when device is "auto"/"cuda". Fall back to
                # CPU so the transcription still runs instead of hard-failing.
                if LOCAL_DEVICE == "cpu":
                    raise
                print(f"⚠️  Could not start on '{LOCAL_DEVICE}' ({error}); falling back to CPU.")
                self._model = WhisperModel(
                    LOCAL_MODEL,
                    device="cpu",
                    compute_type="int8" if LOCAL_COMPUTE_TYPE == "default" else LOCAL_COMPUTE_TYPE,
                )
        return self._model

    def transcribe_chunk(self, audio_path, language) -> list[dict]:
        model = self._load_model()
        segments, info = model.transcribe(str(Path(audio_path)), language=language)
        total = float(getattr(info, "duration", 0) or 0)

        result = []
        next_percent = 10
        for seg in segments:
            result.append(
                {"start": seg.start, "end": seg.end, "text": (seg.text or "").strip()}
            )
            if total and seg.end and (seg.end / total) * 100 >= next_percent:
                print(f"   🎤 {min(int(seg.end / total * 100), 99)}%")
                next_percent += 10
        return result
