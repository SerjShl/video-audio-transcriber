import threading
import time

import pytest

from backend.pool import run_pool, with_retry


def test_run_pool_preserves_input_order():
    results = run_pool([1, 2, 3, 4, 5], 2, lambda n, _i: n * 10)
    assert results == [10, 20, 30, 40, 50]


def test_run_pool_never_exceeds_concurrency_limit():
    active = 0
    peak = 0
    lock = threading.Lock()

    def worker(_item, _i):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.01)
        with lock:
            active -= 1

    run_pool([1, 2, 3, 4, 5, 6], 2, worker)
    assert peak <= 2


def test_run_pool_handles_empty_list():
    assert run_pool([], 3, lambda _n, _i: 1) == []


def test_with_retry_retries_transient_then_succeeds():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        if calls["n"] < 3:
            err = Exception("rate limited")
            err.status_code = 429
            raise err
        return "ok"

    assert with_retry(fn, retries=5, base_ms=1) == "ok"
    assert calls["n"] == 3


def test_with_retry_does_not_retry_client_errors():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        err = Exception("bad request")
        err.status_code = 400
        raise err

    with pytest.raises(Exception, match="bad request"):
        with_retry(fn, retries=5, base_ms=1)
    assert calls["n"] == 1


def test_with_retry_gives_up_after_limit():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        raise Exception("network down")

    with pytest.raises(Exception, match="network down"):
        with_retry(fn, retries=2, base_ms=1)
    assert calls["n"] == 3  # initial attempt + 2 retries
