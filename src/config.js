import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export const DIRS = {
  downloads: path.join(ROOT, 'downloads'),
  transcripts: path.join(ROOT, 'transcripts'),
  input: path.join(ROOT, 'input')
};

// Transcription engine: 'groq' (cloud API) or 'local' (offline whisper.cpp).
export const DEFAULT_ENGINE = process.env.TRANSCRIBER_ENGINE || 'groq';

// Groq caps uploads at 25 MB; stay just under to leave headroom.
export const MAX_FILE_SIZE_MB = 24;
export const WHISPER_MODEL = process.env.WHISPER_MODEL || 'whisper-large-v3-turbo';

// Local engine (whisper.cpp). WHISPER_CPP_MODEL must point at a ggml model file.
export const WHISPER_CPP_BIN = process.env.WHISPER_CPP_BIN || 'whisper-cli';
export const WHISPER_CPP_MODEL = process.env.WHISPER_CPP_MODEL || '';
export const PARAGRAPH_MIN_CHARS = 280;
export const MIN_CHUNK_BYTES = 2048;
export const AUDIO_SAMPLE_RATE = '16000';
export const AUDIO_CHANNELS = '1';
export const AUDIO_BITRATE = '32k';
export const SCAN_CONCURRENCY = Number(process.env.SCAN_CONCURRENCY) || 3;
export const SCAN_EXTENSIONS = /\.(mp4|mp3|wav|m4a|webm)$/i;
export const DEFAULT_LANGUAGE = 'ru';
export const OUTPUT_FORMATS = ['txt', 'srt', 'vtt'];

export const API_RETRIES = 3;
export const API_RETRY_BASE_MS = 1000;

export function ensureDirs() {
  Object.values(DIRS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}
