"""Engine registry and resolver."""

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


def get_engine(name=None):
    from ..config import DEFAULT_ENGINE

    name = name or DEFAULT_ENGINE
    if name not in _REGISTRY:
        raise ValueError(f'Unknown engine "{name}". Use one of: {", ".join(ENGINE_NAMES)}')
    if name not in _instances:
        _instances[name] = _REGISTRY[name]()
    return _instances[name]
