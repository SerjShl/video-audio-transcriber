import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offsetSegments } from '../src/transcribe.js';

test('offsetSegments returns the input unchanged for a zero offset', () => {
  const segs = [{ start: 0, end: 1, text: 'a' }];
  assert.equal(offsetSegments(segs, 0), segs);
});

test('offsetSegments shifts start and end by the offset', () => {
  const out = offsetSegments([{ start: 0, end: 1.5, text: 'a' }, { start: 1.5, end: 2, text: 'b' }], 10);
  assert.deepEqual(out, [
    { start: 10, end: 11.5, text: 'a' },
    { start: 11.5, end: 12, text: 'b' }
  ]);
});

test('offsetSegments leaves text-only segments (no timings) untouched', () => {
  const out = offsetSegments([{ text: 'no timing' }, { start: 1, end: 2, text: 'timed' }], 5);
  assert.deepEqual(out, [{ text: 'no timing' }, { start: 6, end: 7, text: 'timed' }]);
});

test('offsetSegments does not mutate the original segments', () => {
  const original = [{ start: 1, end: 2, text: 'a' }];
  offsetSegments(original, 3);
  assert.deepEqual(original, [{ start: 1, end: 2, text: 'a' }]);
});
