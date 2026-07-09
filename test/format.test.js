import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTranscript,
  formatTimestamp,
  toSRT,
  toVTT,
  renderTranscript
} from '../src/format.js';

test('formatTranscript joins short segments into one paragraph', () => {
  const out = formatTranscript([{ text: 'Hello.' }, { text: 'World.' }]);
  assert.equal(out, 'Hello. World.');
});

test('formatTranscript breaks paragraphs on sentence end past the min length', () => {
  const long = 'a'.repeat(300) + '.';
  const out = formatTranscript([{ text: long }, { text: 'Next sentence.' }]);
  assert.equal(out, `${long}\n\nNext sentence.`);
});

test('formatTranscript does not break mid-sentence even when long', () => {
  const long = 'word '.repeat(80).trim(); // > 280 chars, no ending punctuation
  const out = formatTranscript([{ text: long }, { text: 'tail.' }]);
  assert.equal(out, `${long} tail.`);
});

test('formatTranscript ignores empty segments', () => {
  const out = formatTranscript([{ text: '  ' }, { text: 'Only this.' }, {}]);
  assert.equal(out, 'Only this.');
});

test('formatTimestamp renders SRT and VTT separators', () => {
  assert.equal(formatTimestamp(3661.5, ','), '01:01:01,500');
  assert.equal(formatTimestamp(3661.5, '.'), '01:01:01.500');
  assert.equal(formatTimestamp(0, ','), '00:00:00,000');
});

const SEGMENTS = [
  { start: 0, end: 1.5, text: 'First line.' },
  { start: 1.5, end: 3, text: 'Second line.' }
];

test('toSRT numbers cues and uses comma milliseconds', () => {
  const srt = toSRT(SEGMENTS);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,500\nFirst line\./);
  assert.match(srt, /2\n00:00:01,500 --> 00:00:03,000\nSecond line\./);
});

test('toVTT starts with the WEBVTT header and dot milliseconds', () => {
  const vtt = toVTT(SEGMENTS);
  assert.match(vtt, /^WEBVTT\n\n/);
  assert.match(vtt, /00:00:00\.000 --> 00:00:01\.500/);
});

test('subtitles throw when segments carry no timing', () => {
  assert.throws(() => toSRT([{ text: 'no timing' }]), /No timestamps/);
  assert.throws(() => toVTT([{ text: 'no timing' }]), /No timestamps/);
});

test('renderTranscript dispatches by format and rejects unknown ones', () => {
  assert.equal(renderTranscript([{ text: 'Hi.' }], 'txt'), 'Hi.');
  assert.match(renderTranscript(SEGMENTS, 'srt'), /-->/);
  assert.throws(() => renderTranscript(SEGMENTS, 'doc'), /Unknown output format/);
});
