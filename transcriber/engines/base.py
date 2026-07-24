"""Common engine interface.

Every engine exposes the same shape so the pipeline is agnostic to whether
transcription happens in the cloud or offline:

    name              short identifier ("groq", "local")
    label             human-readable name for log lines
    max_file_size_mb  files above this are compressed/split before upload;
                      float("inf") means the engine has no upload limit
    ensure_ready()    validate config/deps, raising a friendly error if not
    transcribe_chunk(audio_path, language) -> list of segment dicts
"""

from abc import ABC, abstractmethod


class Engine(ABC):
    name: str = ""
    label: str = ""
    max_file_size_mb: float = float("inf")

    def ensure_ready(self) -> None:
        """Raise a user-facing error if the engine can't run. No-op by default."""

    @abstractmethod
    def transcribe_chunk(self, audio_path, language) -> list[dict]:
        """Transcribe one audio file into ``{start, end, text}`` segments."""


def read_segment(segment, key):
    """Read a field from a segment that may be a dict or an SDK object."""
    if isinstance(segment, dict):
        return segment.get(key)
    return getattr(segment, key, None)
