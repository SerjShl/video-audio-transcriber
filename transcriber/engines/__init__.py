"""Engine registry, availability checks, and default resolution."""

import importlib.util
import os

from .groq import GroqEngine
from .local import LocalEngine

_REGISTRY = {
    "groq": GroqEngine,
    "local": LocalEngine,
}

ENGINE_NAMES = list(_REGISTRY)

# Cache one instance per engine so loaded state (e.g. the local model) is
# reused across calls within a process.
_instances: dict[str, object] = {}


def local_available():
    """True if the offline engine's dependency (faster-whisper) is importable."""
    return importlib.util.find_spec("faster_whisper") is not None


def engine_availability(name):
    """Return (available, note) describing whether an engine can run right now."""
    if name == "groq":
        ok = bool(os.environ.get("GROQ_API_KEY"))
        return ok, "" if ok else "no GROQ_API_KEY"
    if name == "local":
        ok = local_available()
        return ok, "" if ok else "faster-whisper not installed"
    return True, ""


def resolve_default_engine():
    """Pick the default engine (and a human reason) from what's configured.

    Precedence: an explicit ``TRANSCRIBER_ENGINE`` wins; otherwise a present
    ``GROQ_API_KEY`` is treated as opting into the cloud; otherwise fall back to
    the offline engine if it's installed. The choice is made once (never per
    file), so the privacy/cost posture can't silently change between runs.
    """
    explicit = os.environ.get("TRANSCRIBER_ENGINE")
    if explicit:
        return explicit, f"TRANSCRIBER_ENGINE={explicit}"
    if os.environ.get("GROQ_API_KEY"):
        return "groq", "GROQ_API_KEY found"
    if local_available():
        return "local", "no GROQ_API_KEY; faster-whisper installed"
    return "groq", "default"


def get_engine(name=None):
    if not name:
        name, _reason = resolve_default_engine()
    if name not in _REGISTRY:
        raise ValueError(f'Unknown engine "{name}". Use one of: {", ".join(ENGINE_NAMES)}')
    if name not in _instances:
        _instances[name] = _REGISTRY[name]()
    return _instances[name]
