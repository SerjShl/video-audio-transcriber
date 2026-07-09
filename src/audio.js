import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { AUDIO_SAMPLE_RATE, AUDIO_CHANNELS, AUDIO_BITRATE } from './config.js';

export function sizeMB(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024);
}

export async function getDuration(filePath) {
  const { stdout } = await execa('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  return parseFloat(stdout.trim());
}

// Extract a compact mono audio track suitable for the Whisper API.
// Writes into outputDir (defaults next to the source) — callers pass an
// isolated working directory so intermediates never land in input/.
export async function convertToAudio(inputPath, outputDir) {
  console.log('🔄 Converting to audio...');
  const parsed = path.parse(inputPath);
  const dir = outputDir || parsed.dir;
  const outputPath = path.join(dir, `${parsed.name}_converted.mp3`);

  try {
    await execa('ffmpeg', [
      '-i', inputPath,
      '-vn',
      '-ar', AUDIO_SAMPLE_RATE,
      '-ac', AUDIO_CHANNELS,
      '-b:a', AUDIO_BITRATE,
      '-y',
      outputPath
    ]);
    return outputPath;
  } catch (error) {
    throw new Error(`Conversion failed: ${error.message}`);
  }
}

// Split an audio file into fixed-length chunks and return their paths in order.
export async function splitAudio(inputPath, chunkSeconds) {
  const parsed = path.parse(inputPath);
  const pattern = path.join(parsed.dir, `${parsed.name}_chunk_%03d.mp3`);

  await execa('ffmpeg', [
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', String(chunkSeconds),
    '-c', 'copy',
    '-y',
    pattern
  ]);

  return fs.readdirSync(parsed.dir)
    .filter(f => f.startsWith(`${parsed.name}_chunk_`))
    .sort()
    .map(f => path.join(parsed.dir, f));
}
