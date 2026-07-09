// Run an async worker over items with a fixed concurrency limit.
// Results are returned in the same order as the input items.
export async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    const i = index++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return next();
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

// Resolve after the given number of milliseconds.
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry an async function with exponential backoff. Only transient errors
// (network issues, rate limits, 5xx) are retried; client errors bubble up.
export async function withRetry(fn, { retries, baseMs, onRetry } = {}) {
  const maxRetries = retries ?? 3;
  const base = baseMs ?? 1000;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      const delay = base * 2 ** attempt;
      if (onRetry) onRetry(error, attempt + 1, delay);
      await sleep(delay);
    }
  }
}

function isRetryable(error) {
  const status = error?.status ?? error?.response?.status;
  if (status === undefined) return true; // network / unknown → worth retrying
  return status === 408 || status === 429 || status >= 500;
}
