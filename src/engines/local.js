import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { DIRS, WHISPER_CPP_BIN, WHISPER_CPP_MODEL } from '../config.js';
import { convertToWav } from '../audio.js';
import { ensureCommand } from '../deps.js';

export const name = 'local';
export const label = 'local whisper.cpp';
// The local engine uploads nothing, so there is no size limit — never split.
export const maxFileSizeMB = Infinity;

export async function ensureReady() {
  await ensureCommand(
    WHISPER_CPP_BIN,
    '--help',
    'Build whisper.cpp and put its CLI on PATH (or set WHISPER_CPP_BIN): https://github.com/ggml-org/whisper.cpp'
  );
  if (!WHISPER_CPP_MODEL) {
    throw new Error(
      'Set WHISPER_CPP_MODEL to a ggml model file (e.g. models/ggml-large-v3-turbo.bin)'
    );
  }
  if (!fs.existsSync(WHISPER_CPP_MODEL)) {
    throw new Error(`Whisper model not found: ${WHISPER_CPP_MODEL}`);
  }
}

// Map whisper.cpp JSON output into the same segment shape the Groq engine
// returns: { start, end, text } with times in seconds.
export function parseWhisperJson(json) {
  const items = json?.transcription ?? [];
  return items
    .map(it => ({
      start: (it.offsets?.from ?? 0) / 1000,
      end: (it.offsets?.to ?? 0) / 1000,
      text: (it.text ?? '').trim()
    }))
    .filter(s => s.text);
}

export async function transcribeChunk(audioPath, language) {
  // whisper.cpp wants 16 kHz mono PCM WAV; do it in an isolated scratch dir.
  const workDir = fs.mkdtempSync(path.join(DIRS.downloads, 'local-'));
  try {
    const wavPath = await convertToWav(audioPath, workDir);
    const outPrefix = path.join(workDir, 'out');

    await execa(WHISPER_CPP_BIN, [
      '-m', WHISPER_CPP_MODEL,
      '-f', wavPath,
      '-l', language,
      '-oj',
      '-of', outPrefix
    ]);

    const json = JSON.parse(fs.readFileSync(`${outPrefix}.json`, 'utf8'));
    return parseWhisperJson(json);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
