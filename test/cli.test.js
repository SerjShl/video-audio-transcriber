import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';

test('parseArgs reads positionals as input and language', () => {
  const opts = parseArgs(['video.mp4', 'en']);
  assert.equal(opts.input, 'video.mp4');
  assert.equal(opts.language, 'en');
  assert.equal(opts.format, 'txt');
});

test('parseArgs defaults the language to ru', () => {
  const opts = parseArgs(['scan']);
  assert.equal(opts.input, 'scan');
  assert.equal(opts.language, 'ru');
});

test('parseArgs accepts --format in both styles', () => {
  assert.equal(parseArgs(['a.mp4', 'en', '--format', 'srt']).format, 'srt');
  assert.equal(parseArgs(['a.mp4', 'en', '--format=vtt']).format, 'vtt');
  assert.equal(parseArgs(['a.mp4', '-f', 'SRT']).format, 'srt'); // lower-cased
});

test('parseArgs collects boolean flags and output dir', () => {
  const opts = parseArgs(['url', 'en', '--keep', '--out', './subs']);
  assert.equal(opts.keep, true);
  assert.equal(opts.out, './subs');
  assert.equal(opts.input, 'url');
  assert.equal(opts.language, 'en');
});

test('parseArgs recognizes help and interactive flags', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['-i']).interactive, true);
});

test('parseArgs keeps flag values out of positionals', () => {
  const opts = parseArgs(['clip.mp4', '--out', 'dir', '--format', 'srt']);
  assert.equal(opts.input, 'clip.mp4');
  assert.equal(opts.language, 'ru');
  assert.equal(opts.out, 'dir');
});
