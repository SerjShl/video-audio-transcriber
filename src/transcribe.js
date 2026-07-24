import fs from 'fs';
import path from 'path';
import { DIRS, MIN_CHUNK_BYTES } from './config.js';
import { sizeMB, getDuration, convertToAudio, splitAudio } from './audio.js';
import { getEngine } from './engines/index.js';
import { renderTranscript } from './format.js';

// Shift segment timings by an offset (used when stitching chunks back together
// so subtitle timestamps stay continuous across the whole recording).
export function offsetSegments(segments, offset) {
  if (!offset) return segments;
  return segments.map(s =>
    Number.isFinite(s.start) && Number.isFinite(s.end)
      ? { ...s, start: s.start + offset, end: s.end + offset }
      : s
  );
}

// Transcribe an audio file, compressing and/or splitting it as needed to stay
// within the engine's size limit. Returns a flat list of Whisper segments.
export async function transcribe(audioPath, language, engine = getEngine()) {
  console.log(`🎤 Transcribing via ${engine.label} (language: ${language})...`);

  if (sizeMB(audioPath) <= engine.maxFileSizeMB) {
    return engine.transcribeChunk(audioPath, language);
  }

  console.log(`⚠️  File is ${sizeMB(audioPath).toFixed(1)} MB (over the ${engine.maxFileSizeMB} MB limit), compressing...`);
  // Isolated scratch dir so intermediates never touch input/ and parallel
  // scan jobs with matching basenames can't collide; removed on the way out.
  const workDir = fs.mkdtempSync(path.join(DIRS.downloads, 'work-'));

  try {
    const compressedPath = await convertToAudio(audioPath, workDir);
    const compressedMB = sizeMB(compressedPath);
    console.log(`✅ After compression: ${compressedMB.toFixed(1)} MB`);

    if (compressedMB <= engine.maxFileSizeMB) {
      return await engine.transcribeChunk(compressedPath, language);
    }

    const duration = await getDuration(compressedPath);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Could not determine audio duration — cannot split the file');
    }
    const numChunks = Math.ceil(compressedMB / engine.maxFileSizeMB);
    const chunkSeconds = Math.ceil(duration / numChunks);
    console.log(`✂️  Long recording (${Math.round(duration / 60)} min) — splitting into ${numChunks} parts of ~${Math.round(chunkSeconds / 60)} min`);

    const chunks = await splitAudio(compressedPath, chunkSeconds);
    const realCount = chunks.filter(f => fs.statSync(f).size > MIN_CHUNK_BYTES).length;

    const segments = [];
    let offset = 0;
    let part = 0;
    // Accumulate the offset over EVERY chunk (even skipped near-empty ones) so
    // subtitle timestamps stay aligned to the original timeline.
    for (const chunk of chunks) {
      const chunkDuration = await getDuration(chunk);
      if (fs.statSync(chunk).size > MIN_CHUNK_BYTES) {
        console.log(`   🎤 Part ${++part}/${realCount}...`);
        const chunkSegments = await engine.transcribeChunk(chunk, language);
        segments.push(...offsetSegments(chunkSegments, offset));
      }
      if (Number.isFinite(chunkDuration)) offset += chunkDuration;
    }
    return segments;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
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

export async function processFile(audioPath, filename, { language, format, outputDir, engine } = {}) {
  const segments = await transcribe(audioPath, language, engine);
  saveTranscript(filename, segments, { format, outputDir });
}
