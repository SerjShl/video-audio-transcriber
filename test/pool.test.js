import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPool, withRetry } from '../src/pool.js';

test('runPool preserves input order in results', async () => {
  const items = [1, 2, 3, 4, 5];
  const results = await runPool(items, 2, async (n) => n * 10);
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
});

test('runPool never exceeds the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  await runPool([1, 2, 3, 4, 5, 6], 2, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 5));
    active--;
  });
  assert.ok(peak <= 2, `peak concurrency ${peak} exceeded limit`);
});

test('runPool handles an empty list', async () => {
  const results = await runPool([], 3, async () => 1);
  assert.deepEqual(results, []);
});

test('withRetry retries transient failures then succeeds', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) {
        const err = new Error('rate limited');
        err.status = 429;
        throw err;
      }
      return 'ok';
    },
    { retries: 5, baseMs: 1 }
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('withRetry does not retry client errors', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls++;
          const err = new Error('bad request');
          err.status = 400;
          throw err;
        },
        { retries: 5, baseMs: 1 }
      ),
    /bad request/
  );
  assert.equal(calls, 1);
});

test('withRetry gives up after the retry limit', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          calls++;
          throw new Error('network down');
        },
        { retries: 2, baseMs: 1 }
      ),
    /network down/
  );
  assert.equal(calls, 3); // initial attempt + 2 retries
});
