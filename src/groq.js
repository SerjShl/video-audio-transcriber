import fs from 'fs';
import Groq from 'groq-sdk';
import { WHISPER_MODEL, API_RETRIES, API_RETRY_BASE_MS } from './config.js';
import { withRetry } from './pool.js';

// Created lazily so the tool can still print usage/help and a friendly
// "missing key" message instead of crashing when GROQ_API_KEY is unset.
let groqClient;
function getGroq() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
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
