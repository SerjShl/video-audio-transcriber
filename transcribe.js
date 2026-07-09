#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execa } from 'execa';
import Groq from 'groq-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Created lazily so the tool can still print usage/help and a friendly
// "missing key" message instead of crashing when GROQ_API_KEY is unset.
let groqClient;
function getGroq() {
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

const DIRS = {
  downloads: path.join(__dirname, 'downloads'),
  transcripts: path.join(__dirname, 'transcripts'),
  input: path.join(__dirname, 'input')
};

Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Groq caps uploads at 25 MB; stay just under to leave headroom.
const MAX_FILE_SIZE_MB = 24;
const WHISPER_MODEL = 'whisper-large-v3-turbo';
const PARAGRAPH_MIN_CHARS = 280;
const MIN_CHUNK_BYTES = 2048;
const AUDIO_SAMPLE_RATE = '16000';
const AUDIO_CHANNELS = '1';
const AUDIO_BITRATE = '32k';
const SCAN_CONCURRENCY = Number(process.env.SCAN_CONCURRENCY) || 3;
const SCAN_EXTENSIONS = /\.(mp4|mp3|wav|m4a|webm)$/i;
const DEFAULT_LANGUAGE = 'ru';

async function ensureCommand(cmd, versionArg, hint) {
  try {
    await execa(cmd, [versionArg]);
  } catch {
    throw new Error(`Command "${cmd}" not found in PATH. ${hint}`);
  }
}

// Group Whisper segments into readable paragraphs. A paragraph closes once it
// reaches a minimum length AND the current segment ends on sentence punctuation,
// which avoids breaking on abbreviations or numbers.
function formatTranscript(segments) {
  const paragraphs = [];
  let current = '';

  for (const seg of segments) {
    const piece = (seg.text || '').trim();
    if (!piece) continue;

    current = current ? `${current} ${piece}` : piece;

    if (current.length >= PARAGRAPH_MIN_CHARS && /[.!?…]$/.test(piece)) {
      paragraphs.push(current);
      current = '';
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs.join('\n\n');
}

// Download media from any yt-dlp-supported URL and return the local audio path.
async function downloadMedia(url) {
  console.log('⬇️  Downloading...');
  const outputPath = path.join(DIRS.downloads, 'audio_%(id)s.%(ext)s');

  const args = ['-x', '--audio-format', 'mp3', '-o', outputPath];

  const browser = process.env.YT_DLP_BROWSER;
  if (browser) {
    console.log(`🍪 Using cookies from browser: ${browser}`);
    args.push('--cookies-from-browser', browser);
  }

  args.push('--print', 'after_move:filepath', '--no-simulate', url);

  const { stdout } = await execa('yt-dlp', args);
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  const filePath = lines[lines.length - 1];

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Could not determine the path of the downloaded file');
  }
  return filePath;
}

// Extract a compact mono audio track suitable for the Whisper API.
async function convertToAudio(inputPath) {
  console.log('🔄 Converting to audio...');
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}_converted.mp3`);

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

function sizeMB(filePath) {
  return fs.statSync(filePath).size / (1024 * 1024);
}

async function getDuration(filePath) {
  const { stdout } = await execa('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ]);
  return parseFloat(stdout.trim());
}

// Split an audio file into fixed-length chunks and return their paths in order.
async function splitAudio(inputPath, chunkSeconds) {
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

async function transcribeChunk(audioPath, language) {
  const result = await getGroq().audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: WHISPER_MODEL,
    language: language,
    response_format: 'verbose_json'
  });

  return result.segments?.length ? result.segments : [{ text: result.text }];
}

// Transcribe an audio file, compressing and/or splitting it as needed to stay
// within the API size limit. Returns a flat list of Whisper segments.
async function transcribe(audioPath, language = DEFAULT_LANGUAGE) {
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
    for (let i = 0; i < realChunks.length; i++) {
      console.log(`   🎤 Part ${i + 1}/${realChunks.length}...`);
      segments.push(...await transcribeChunk(realChunks[i], language));
    }
    return segments;
  } finally {
    cleanup.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  }
}

function saveTranscript(filename, segments) {
  const text = formatTranscript(segments);
  const txtPath = path.join(DIRS.transcripts, `${filename}.txt`);

  fs.writeFileSync(txtPath, text);
  console.log(`\n✅ Saved: ${txtPath}\n`);
  console.log(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
}

async function processFile(audioPath, filename, language = DEFAULT_LANGUAGE) {
  const segments = await transcribe(audioPath, language);
  saveTranscript(filename, segments);
}

async function askInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const input = (await rl.question('🔗 URL or file path (Enter — scan the input/ folder): ')).trim();
    const language = (await rl.question(`🌐 Language [${DEFAULT_LANGUAGE}]: `)).trim() || DEFAULT_LANGUAGE;
    return { input: input || 'scan', language };
  } finally {
    rl.close();
  }
}

// Run an async worker over items with a fixed concurrency limit.
async function runPool(items, limit, worker) {
  const results = [];
  let index = 0;

  async function next() {
    const i = index++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return next();
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

function printUsage() {
  console.log('Usage:');
  console.log('  npm start                                  (interactive mode)');
  console.log('  npm run transcribe <URL> [language] [--keep]');
  console.log('  npm run transcribe <file path> [language]');
  console.log('  npm run transcribe scan [language]');
  console.log('\nExamples:');
  console.log('  npm run transcribe video.mp4 en');
  console.log('  npm run transcribe https://youtube.com/... ru');
  console.log('  npm run transcribe scan en');
  console.log('\nFlags:');
  console.log('  --keep              keep the downloaded audio after transcription');
  console.log('  -i, --interactive   prompt for the URL and language step by step\n');
}

async function scanInputFolder(language) {
  const files = fs.readdirSync(DIRS.input).filter(f => SCAN_EXTENSIONS.test(f));

  console.log(`▶️  Files: ${files.length}, concurrency: ${SCAN_CONCURRENCY}`);
  const results = await runPool(files, SCAN_CONCURRENCY, async (file) => {
    try {
      await processFile(path.join(DIRS.input, file), path.parse(file).name, language);
      console.log(`✅ ${file}`);
      return { file, ok: true };
    } catch (error) {
      console.error(`❌ Skipped ${file}: ${error.message}`);
      return { file, ok: false };
    }
  });

  const failed = results.filter(r => !r.ok).map(r => r.file);
  console.log(`\n📊 Done: ${results.length - failed.length} succeeded, ${failed.length} failed`);
  if (failed.length) console.log(`   Not processed: ${failed.join(', ')}`);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const keepAudio = rawArgs.includes('--keep') || process.env.KEEP_AUDIO === 'true';
  const isInteractive = rawArgs.includes('--interactive') || rawArgs.includes('-i');
  let [input, language = DEFAULT_LANGUAGE] = rawArgs.filter(a => !a.startsWith('-'));

  if (isInteractive) {
    ({ input, language } = await askInteractive());
  }

  if (!input) {
    printUsage();
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ Add GROQ_API_KEY to your .env file');
    console.error('   Get a key: https://console.groq.com/keys');
    process.exit(1);
  }

  try {
    const isUrl = /^https?:\/\//i.test(input);

    await ensureCommand('ffmpeg', '-version', 'Install FFmpeg: https://ffmpeg.org/download.html');
    await ensureCommand('ffprobe', '-version', 'ffprobe ships with FFmpeg.');
    if (isUrl) {
      await ensureCommand('yt-dlp', '--version', 'Install yt-dlp: https://github.com/yt-dlp/yt-dlp');
    }

    if (input === 'scan') {
      await scanInputFolder(language);
      return;
    }

    if (isUrl) {
      const audioPath = await downloadMedia(input);
      await processFile(audioPath, path.parse(audioPath).name, language);
      if (keepAudio) {
        console.log(`💾 Audio kept: ${audioPath}`);
      } else {
        fs.unlinkSync(audioPath);
      }
      return;
    }

    const audioPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ File not found: ${audioPath}`);
      process.exit(1);
    }

    await processFile(audioPath, path.parse(audioPath).name, language);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
