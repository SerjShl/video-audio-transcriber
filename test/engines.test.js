import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEngine, ENGINE_NAMES } from '../src/engines/index.js';
import { parseWhisperJson } from '../src/engines/local.js';

test('getEngine returns groq by default with a finite size limit', () => {
  const engine = getEngine();
  assert.equal(engine.name, 'groq');
  assert.equal(engine.maxFileSizeMB, 24);
});

test('getEngine resolves the local engine with no size limit', () => {
  const engine = getEngine('local');
  assert.equal(engine.name, 'local');
  assert.equal(engine.maxFileSizeMB, Infinity);
});

test('getEngine rejects unknown engines', () => {
  assert.throws(() => getEngine('nope'), /Unknown engine/);
});

test('every engine exposes the common interface', () => {
  for (const name of ENGINE_NAMES) {
    const engine = getEngine(name);
    assert.equal(typeof engine.ensureReady, 'function');
    assert.equal(typeof engine.transcribeChunk, 'function');
    assert.equal(typeof engine.label, 'string');
  }
});

test('parseWhisperJson maps offsets (ms) to seconds and drops empty text', () => {
  const segments = parseWhisperJson({
    transcription: [
      { offsets: { from: 0, to: 1500 }, text: ' Hello world' },
      { offsets: { from: 1500, to: 2000 }, text: '   ' },
      { offsets: { from: 2000, to: 4000 }, text: 'Second.' }
    ]
  });
  assert.deepEqual(segments, [
    { start: 0, end: 1.5, text: 'Hello world' },
    { start: 2, end: 4, text: 'Second.' }
  ]);
});

test('parseWhisperJson tolerates missing transcription array', () => {
  assert.deepEqual(parseWhisperJson({}), []);
});
