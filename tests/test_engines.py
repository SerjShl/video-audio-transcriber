import math

import pytest

import backend.engines as engines_module
from backend.engines import ENGINE_NAMES, get_engine, resolve_default_engine


def test_get_engine_resolves_groq_with_finite_limit():
    engine = get_engine("groq")
    assert engine.name == "groq"
    assert engine.max_file_size_mb == 24


def test_get_engine_resolves_local_with_no_limit():
    engine = get_engine("local")
    assert engine.name == "local"
    assert math.isinf(engine.max_file_size_mb)


def test_get_engine_rejects_unknown():
    with pytest.raises(ValueError, match="Unknown engine"):
        get_engine("nope")


def test_get_engine_caches_instances_for_model_reuse():
    assert get_engine("local") is get_engine("local")


def test_every_engine_exposes_the_common_interface():
    for name in ENGINE_NAMES:
        engine = get_engine(name)
        assert callable(engine.ensure_ready)
        assert callable(engine.transcribe_chunk)
        assert isinstance(engine.label, str) and engine.label


def _clear_env(monkeypatch):
    monkeypatch.delenv("TRANSCRIBER_ENGINE", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)


def test_resolve_respects_explicit_env(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setenv("TRANSCRIBER_ENGINE", "local")
    assert resolve_default_engine()[0] == "local"


def test_resolve_prefers_groq_when_key_present(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test")
    assert resolve_default_engine()[0] == "groq"


def test_resolve_falls_back_to_local_without_key(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setattr(engines_module, "local_available", lambda: True)
    assert resolve_default_engine()[0] == "local"


def test_resolve_defaults_to_groq_when_nothing_available(monkeypatch):
    _clear_env(monkeypatch)
    monkeypatch.setattr(engines_module, "local_available", lambda: False)
    assert resolve_default_engine()[0] == "groq"
