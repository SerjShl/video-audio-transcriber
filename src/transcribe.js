import fs from 'fs';
import path from 'path';
import { DIRS, MAX_FILE_SIZE_MB, MIN_CHUNK_BYTES } from './config.js';
import { sizeMB, getDuration, convertToAudio, splitAudio } from './audio.js';
import { transcribeChunk } from './groq.js';
import { renderTranscript } from './format.js';

// Shift segment timings by an offset (used when stitching chunks back together
// so subtitle timestamps stay continuous across the whole recording).
function offsetSegments(segments, offset) {
  if (!offset) return segments;
  return segments.map(s =>
    Number.isFinite(s.start) && Number.isFinite(s.end)
      ? { ...s, start: s.start + offset, end: s.end + offset }
      : s
  );
}

// Transcribe an audio file, compressing and/or splitting it as needed to stay
// within the API size limit. Returns a flat list of Whisper segments.
export async function transcribe(audioPath, language) {
  console.log(`🎤 Transcribing via Groq (language: ${language})...`);

  if (sizeMB(audioPath) <= MAX_FILE_SIZE_MB) {
    return transcribeChunk(audioPath, language);
  }

  console.log(`⚠️  File is ${sizeMB(audioPath).toFixed(1)} MB (over the ${MAX_FILE_SIZE_MB} MB limit), compressing...`);
  const compressedPath = await convertToAudio(audioPath);
  const cleanup = [compressedPath];

  try {
    const compressedMB = sizeMB(compressedPath);
    console.log(`✅ After compression: ${compressedMB.toFixed(1)} MB`);

    if (compressedMB <= MAX_FILE_SIZE_MB) {
      return await transcribeChunk(compressedPath, language);
    }

    const duration = await getDuration(compressedPath);
    const numChunks = Math.ceil(compressedMB / MAX_FILE_SIZE_MB);
    const chunkSeconds = Math.ceil(duration / numChunks);
    console.log(`✂️  Long recording (${Math.round(duration / 60)} min) — splitting into ${numChunks} parts of ~${Math.round(chunkSeconds / 60)} min`);

    const chunks = await splitAudio(compressedPath, chunkSeconds);
    cleanup.push(...chunks);

    const realChunks = chunks.filter(f => fs.statSync(f).size > MIN_CHUNK_BYTES);

    const segments = [];
    let offset = 0;
    for (let i = 0; i < realChunks.length; i++) {
      console.log(`   🎤 Part ${i + 1}/${realChunks.length}...`);
      const chunkDuration = await getDuration(realChunks[i]);
      const chunkSegments = await transcribeChunk(realChunks[i], language);
      segments.push(...offsetSegments(chunkSegments, offset));
      offset += chunkDuration;
    }
    return segments;
  } finally {
    cleanup.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  }
}

function saveTranscript(filename, segments, { format = 'txt', outputDir = DIRS.transcripts } = {}) {
  const text = renderTranscript(segments, format);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `${filename}.${format}`);

  fs.writeFileSync(outPath, text);
  console.log(`\n✅ Saved: ${outPath}\n`);
  console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
}

export async function processFile(audioPath, filename, { language, format, outputDir } = {}) {
  const segments = await transcribe(audioPath, language);
  saveTranscript(filename, segments, { format, outputDir });
}
