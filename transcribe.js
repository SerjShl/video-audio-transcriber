#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { execa } from 'execa';
import Groq from 'groq-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DIRS = {
  downloads: path.join(__dirname, 'downloads'),
  transcripts: path.join(__dirname, 'transcripts'),
  input: path.join(__dirname, 'input')
};

Object.values(DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Лимит Groq — 25 MB. Берём с запасом, чтобы не упереться на границе.
const MAX_FILE_SIZE_MB = 24;
const WHISPER_MODEL = 'whisper-large-v3-turbo';

function formatText(text) {
  return text
    .replace(/\. /g, '.\n\n')
    .replace(/\? /g, '?\n\n')
    .replace(/! /g, '!\n\n')
    .replace(/,([^\s])/g, ', $1')
    .trim();
}

async function downloadYouTube(url) {
  console.log('⬇️  Скачивание с YouTube...');
  const outputPath = path.join(DIRS.downloads, 'audio_%(id)s.%(ext)s');

  const args = ['-x', '--audio-format', 'mp3', '-o', outputPath];

  // Если YouTube требует "Sign in to confirm you're not a bot",
  // укажите браузер в .env: YT_DLP_BROWSER=chrome (или edge, firefox, brave)
  const browser = process.env.YT_DLP_BROWSER;
  if (browser) {
    console.log(`🍪 Использую cookies из браузера: ${browser}`);
    args.push('--cookies-from-browser', browser);
  }

  // --print after_move:filepath печатает итоговый путь после пост-обработки,
  // --no-simulate заставляет yt-dlp всё равно скачивать. Так мы получаем точное
  // имя файла, а не угадываем «последний по алфавиту» в папке downloads.
  args.push('--print', 'after_move:filepath', '--no-simulate', url);

  const { stdout } = await execa('yt-dlp', args);
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  const filePath = lines[lines.length - 1];

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Не удалось определить путь к скачанному файлу');
  }
  return filePath;
}

async function convertToAudio(inputPath) {
  console.log('🔄 Конвертация в аудио...');
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}_converted.mp3`);

  try {
    await execa('ffmpeg', [
      '-i', inputPath,
      '-vn',
      '-ar', '16000',
      '-ac', '1',
      '-b:a', '32k',
      '-y',
      outputPath
    ]);
    return outputPath;
  } catch (error) {
    throw new Error(`Ошибка конвертации: ${error.message}`);
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

// Нарезает аудио на части ~chunkSeconds каждая (без перекодирования — быстро).
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
  const result = await groq.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: WHISPER_MODEL,
    language: language,
    response_format: 'verbose_json'
  });
  return result.text;
}

async function transcribe(audioPath, language = 'ru') {
  console.log(`🎤 Транскрибация через Groq (язык: ${language})...`);

  // Файл в пределах лимита — отправляем как есть.
  if (sizeMB(audioPath) <= MAX_FILE_SIZE_MB) {
    return transcribeChunk(audioPath, language);
  }

  // Иначе сжимаем в 16kHz mono 32kbps — этого хватает Whisper и резко уменьшает размер.
  console.log(`⚠️  Файл ${sizeMB(audioPath).toFixed(1)} MB (больше лимита ${MAX_FILE_SIZE_MB} MB), сжимаю...`);
  const compressedPath = await convertToAudio(audioPath);
  const cleanup = [compressedPath];

  try {
    const compressedMB = sizeMB(compressedPath);
    console.log(`✅ После сжатия: ${compressedMB.toFixed(1)} MB`);

    if (compressedMB <= MAX_FILE_SIZE_MB) {
      return await transcribeChunk(compressedPath, language);
    }

    // Всё ещё больше лимита (длинная запись) — режем на части и склеиваем результат.
    const duration = await getDuration(compressedPath);
    const numChunks = Math.ceil(compressedMB / MAX_FILE_SIZE_MB);
    const chunkSeconds = Math.ceil(duration / numChunks);
    console.log(`✂️  Длинная запись (${Math.round(duration / 60)} мин) — нарежу на ${numChunks} частей по ~${Math.round(chunkSeconds / 60)} мин`);

    const chunks = await splitAudio(compressedPath, chunkSeconds);
    cleanup.push(...chunks);

    // ffmpeg может оставить пустой «хвостовой» сегмент в пару КБ из-за остатка
    // по времени — отсеиваем его, чтобы не тратить лишний запрос к Groq.
    const realChunks = chunks.filter(f => fs.statSync(f).size > 2048);

    const parts = [];
    for (let i = 0; i < realChunks.length; i++) {
      console.log(`   🎤 Часть ${i + 1}/${realChunks.length}...`);
      parts.push(await transcribeChunk(realChunks[i], language));
    }
    return parts.join(' ');
  } finally {
    cleanup.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
  }
}

function saveTranscript(filename, text) {
  const formattedText = formatText(text);
  const txtPath = path.join(DIRS.transcripts, `${filename}.txt`);

  fs.writeFileSync(txtPath, formattedText);
  console.log(`\n✅ Сохранено: ${txtPath}\n`);
  console.log(formattedText.substring(0, 500) + (formattedText.length > 500 ? '...' : ''));
}

async function processFile(audioPath, filename, language = 'ru') {
  const text = await transcribe(audioPath, language);
  saveTranscript(filename, text);
}

async function main() {
  const [input, language = 'ru'] = process.argv.slice(2);

  if (!input) {
    console.log('Использование:');
    console.log('  npm run transcribe <YouTube URL> [язык]');
    console.log('  npm run transcribe <путь к файлу> [язык]');
    console.log('  npm run transcribe scan [язык]');
    console.log('\nПримеры:');
    console.log('  npm run transcribe video.mp4 en');
    console.log('  npm run transcribe https://youtube.com/... ru');
    console.log('  npm run transcribe scan en\n');
    return;
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('❌ Добавьте GROQ_API_KEY в .env файл');
    console.error('   Получить ключ: https://console.groq.com/keys');
    process.exit(1);
  }

  try {
    if (input === 'scan') {
      const files = fs.readdirSync(DIRS.input).filter(f =>
        /\.(mp4|mp3|wav|m4a|webm)$/i.test(f)
      );

      let ok = 0;
      const failed = [];
      for (const file of files) {
        console.log(`\n▶️  ${file}`);
        try {
          await processFile(path.join(DIRS.input, file), path.parse(file).name, language);
          ok++;
        } catch (error) {
          // Ошибка одного файла не должна прерывать всю пачку.
          failed.push(file);
          console.error(`❌ Пропущен ${file}: ${error.message}`);
        }
      }

      console.log(`\n📊 Готово: успешно ${ok}, с ошибками ${failed.length}`);
      if (failed.length) console.log(`   Не обработаны: ${failed.join(', ')}`);
      return;
    }

    if (input.includes('youtube.com') || input.includes('youtu.be')) {
      const audioPath = await downloadYouTube(input);
      await processFile(audioPath, path.parse(audioPath).name, language);
      fs.unlinkSync(audioPath);
      return;
    }

    const audioPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ Файл не найден: ${audioPath}`);
      process.exit(1);
    }

    await processFile(audioPath, path.parse(audioPath).name, language);

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
