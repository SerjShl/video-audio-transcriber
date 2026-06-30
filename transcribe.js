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

  args.push(url);
  await execa('yt-dlp', args);

  const files = fs.readdirSync(DIRS.downloads).filter(f => f.startsWith('audio_'));
  return path.join(DIRS.downloads, files[files.length - 1]);
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

async function transcribe(audioPath, language = 'ru') {
  console.log(`🎤 Транскрибация через Groq (язык: ${language})...`);

  const stats = fs.statSync(audioPath);
  const fileSizeMB = stats.size / (1024 * 1024);

  let processPath = audioPath;
  let needsCleanup = false;

  if (fileSizeMB > 25) {
    console.log(`⚠️  Файл ${fileSizeMB.toFixed(1)} MB (больше лимита 25 MB)`);
    processPath = await convertToAudio(audioPath);
    needsCleanup = true;

    const newStats = fs.statSync(processPath);
    const newSizeMB = newStats.size / (1024 * 1024);
    console.log(`✅ После конвертации: ${newSizeMB.toFixed(1)} MB`);

    if (newSizeMB > 25) {
      if (needsCleanup) fs.unlinkSync(processPath);
      throw new Error('Файл слишком большой даже после конвертации. Попробуйте разделить его на части.');
    }
  }

  try {
    const result = await groq.audio.transcriptions.create({
      file: fs.createReadStream(processPath),
      model: 'whisper-large-v3-turbo',
      language: language,
      response_format: 'verbose_json'
    });

    if (needsCleanup) fs.unlinkSync(processPath);
    return result.text;
  } catch (error) {
    if (needsCleanup) fs.unlinkSync(processPath);
    throw error;
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

      for (const file of files) {
        console.log(`\n▶️  ${file}`);
        await processFile(path.join(DIRS.input, file), path.parse(file).name, language);
      }
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
