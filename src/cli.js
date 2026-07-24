import fs from 'fs';
import path from 'path';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import {
  DIRS,
  ensureDirs,
  DEFAULT_LANGUAGE,
  DEFAULT_ENGINE,
  SCAN_CONCURRENCY,
  SCAN_EXTENSIONS,
  OUTPUT_FORMATS
} from './config.js';
import { ensureCommand } from './deps.js';
import { downloadMedia } from './download.js';
import { processFile } from './transcribe.js';
import { getEngine } from './engines/index.js';
import { runPool } from './pool.js';

dotenv.config();

// Parse argv into positional arguments and options. Supports both
// "--format srt" and "--format=srt" styles for value flags.
export function parseArgs(argv) {
  const opts = {
    keep: process.env.KEEP_AUDIO === 'true',
    interactive: false,
    help: false,
    format: 'txt',
    out: null,
    engine: DEFAULT_ENGINE
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--keep') opts.keep = true;
    else if (arg === '-i' || arg === '--interactive') opts.interactive = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '-f' || arg === '--format') opts.format = argv[++i];
    else if (arg.startsWith('--format=')) opts.format = arg.slice('--format='.length);
    else if (arg === '-o' || arg === '--out') opts.out = argv[++i];
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length);
    else if (arg === '-e' || arg === '--engine') opts.engine = argv[++i];
    else if (arg.startsWith('--engine=')) opts.engine = arg.slice('--engine='.length);
    else if (!arg.startsWith('-')) positionals.push(arg);
  }

  opts.format = (opts.format || 'txt').toLowerCase();
  const [input, language = DEFAULT_LANGUAGE] = positionals;
  return { ...opts, input, language };
}

function printUsage() {
  console.log('Usage:');
  console.log('  npm start                                       (interactive mode)');
  console.log('  npm run transcribe <URL> [language] [options]');
  console.log('  npm run transcribe <file path> [language] [options]');
  console.log('  npm run transcribe scan [language] [options]');
  console.log('\nExamples:');
  console.log('  npm run transcribe video.mp4 en');
  console.log('  npm run transcribe https://youtube.com/... ru --format srt');
  console.log('  npm run transcribe scan en --out ./subs');
  console.log('\nOptions:');
  console.log('  -f, --format <fmt>  output format: txt (default), srt, vtt');
  console.log('  -o, --out <dir>     output directory (default: transcripts/)');
  console.log('  -e, --engine <name> transcription engine: groq (default, cloud) or local (offline)');
  console.log('      --keep          keep the downloaded audio after transcription');
  console.log('  -i, --interactive   prompt for the URL and language step by step');
  console.log('  -h, --help          show this help\n');
}

async function askInteractive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const input = (await rl.question('🔗 URL or file path (Enter — scan the input/ folder): ')).trim();
    const language = (await rl.question(`🌐 Language [${DEFAULT_LANGUAGE}]: `)).trim() || DEFAULT_LANGUAGE;
    const format = (await rl.question('📄 Format [txt/srt/vtt] [txt]: ')).trim().toLowerCase() || 'txt';
    return { input: input || 'scan', language, format };
  } finally {
    rl.close();
  }
}

async function scanInputFolder({ language, format, outputDir, engine }) {
  const files = fs.readdirSync(DIRS.input).filter(f => SCAN_EXTENSIONS.test(f));

  console.log(`▶️  Files: ${files.length}, concurrency: ${SCAN_CONCURRENCY}`);
  const results = await runPool(files, SCAN_CONCURRENCY, async (file) => {
    try {
      await processFile(path.join(DIRS.input, file), path.parse(file).name, { language, format, outputDir, engine });
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

export async function run(argv = process.argv.slice(2)) {
  let options = parseArgs(argv);

  if (options.help) {
    printUsage();
    return;
  }

  if (options.interactive) {
    options = { ...options, ...(await askInteractive()) };
  }

  if (!options.input) {
    printUsage();
    return;
  }

  if (!OUTPUT_FORMATS.includes(options.format)) {
    console.error(`❌ Unknown format "${options.format}". Use one of: ${OUTPUT_FORMATS.join(', ')}`);
    process.exit(1);
  }

  let engine;
  try {
    engine = getEngine(options.engine);
    await engine.ensureReady();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  ensureDirs();
  const { input, language, format, keep } = options;
  const outputDir = options.out ? path.resolve(options.out) : DIRS.transcripts;

  try {
    const isUrl = /^https?:\/\//i.test(input);

    await ensureCommand('ffmpeg', '-version', 'Install FFmpeg: https://ffmpeg.org/download.html');
    await ensureCommand('ffprobe', '-version', 'ffprobe ships with FFmpeg.');
    if (isUrl) {
      await ensureCommand('yt-dlp', '--version', 'Install yt-dlp: https://github.com/yt-dlp/yt-dlp');
    }

    if (input === 'scan') {
      await scanInputFolder({ language, format, outputDir, engine });
      return;
    }

    if (isUrl) {
      const audioPath = await downloadMedia(input);
      try {
        await processFile(audioPath, path.parse(audioPath).name, { language, format, outputDir, engine });
      } finally {
        if (keep) {
          console.log(`💾 Audio kept: ${audioPath}`);
        } else if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      }
      return;
    }

    const audioPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ File not found: ${audioPath}`);
      process.exit(1);
    }

    await processFile(audioPath, path.parse(audioPath).name, { language, format, outputDir, engine });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}
