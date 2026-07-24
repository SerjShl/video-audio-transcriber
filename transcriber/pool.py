"""Bounded-concurrency execution and retry-with-backoff helpers."""

import time
from concurrent.futures import ThreadPoolExecutor


def run_pool(items, limit, worker):
    """Run ``worker(item, index)`` over items with a fixed concurrency limit.

    Results are returned in the same order as the input items.
    """
    items = list(items)
    if not items:
        return []

    results = [None] * len(items)
    max_workers = max(1, min(limit, len(items)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(worker, item, i): i for i, item in enumerate(items)}
        for future, index in futures.items():
            results[index] = future.result()
    return results


def _status_of(error):
    status = getattr(error, "status_code", None)
    if status is None:
        status = getattr(error, "status", None)
    if status is None:
        response = getattr(error, "response", None)
        status = getattr(response, "status_code", None) if response is not None else None
    return status


def is_retryable(error):
    """Only transient failures (network, rate limits, 5xx) are worth retrying."""
    status = _status_of(error)
    if status is None:
        return True  # network / unknown → worth retrying
    return status == 408 or status == 429 or status >= 500


def with_retry(fn, retries=3, base_ms=1000, on_retry=None):
    """Call ``fn`` with exponential backoff; client errors bubble up immediately."""
    attempt = 0
    while True:
        try:
            return fn()
        except Exception as error:  # noqa: BLE001 — re-raised unless retryable
            if attempt >= retries or not is_retryable(error):
                raise
            delay_ms = base_ms * (2 ** attempt)
            if on_retry:
                on_retry(error, attempt + 1, delay_ms)
            time.sleep(delay_ms / 1000)
            attempt += 1
