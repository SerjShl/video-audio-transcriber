import fs from 'fs';
import Groq from 'groq-sdk';
import { WHISPER_MODEL, API_RETRIES, API_RETRY_BASE_MS, MAX_FILE_SIZE_MB } from '../config.js';
import { withRetry } from '../pool.js';

export const name = 'groq';
export const label = 'Groq';
// Groq rejects uploads over 25 MB, so oversized files are compressed/split.
export const maxFileSizeMB = MAX_FILE_SIZE_MB;

// Created lazily so the tool can still print usage/help and a friendly
// "missing key" message instead of crashing when GROQ_API_KEY is unset.
let groqClient;
function getGroq() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export async function ensureReady() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'Add GROQ_API_KEY to your .env file. Get a key: https://console.groq.com/keys'
    );
  }
}

// Transcribe a single audio file, retrying on transient API failures.
// Returns Whisper segments (with timing), or a single text-only segment.
export async function transcribeChunk(audioPath, language) {
  const result = await withRetry(
    () =>
      getGroq().audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: WHISPER_MODEL,
        language,
        response_format: 'verbose_json'
      }),
    {
      retries: API_RETRIES,
      baseMs: API_RETRY_BASE_MS,
      onRetry: (error, attempt, delay) =>
        console.log(`   ⏳ Retry ${attempt}/${API_RETRIES} in ${delay / 1000}s (${error.message})`)
    }
  );

  return result.segments?.length ? result.segments : [{ text: result.text }];
}
