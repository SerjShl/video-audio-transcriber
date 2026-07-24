import math

import pytest

from transcriber.engines import ENGINE_NAMES, get_engine


def test_get_engine_defaults_to_groq_with_finite_limit():
    engine = get_engine()
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
