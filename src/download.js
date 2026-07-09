import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { DIRS } from './config.js';

export async function downloadMedia(url) {
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
  const paths = [...new Set(stdout.split('\n').map(l => l.trim()).filter(Boolean))];

  if (paths.length > 1) {
    console.warn(`⚠️  ${paths.length} items downloaded (looks like a playlist) — transcribing only the last one.`);
  }

  const filePath = paths[paths.length - 1];
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Could not determine the path of the downloaded file');
  }
  return filePath;
}
