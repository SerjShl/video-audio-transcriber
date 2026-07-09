# Video/Audio Transcriber

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Powered by Groq](https://img.shields.io/badge/Whisper-Groq-orange.svg)](https://console.groq.com/)

A small command-line tool that transcribes video and audio into text — from a **URL** (YouTube and hundreds of other sites) or from **local files** — using the [Groq](https://console.groq.com/) Whisper API.

It handles the tedious parts for you: downloading, converting to audio, compressing oversized files, splitting long recordings into chunks, and stitching everything back into a single clean transcript.

## Features

- **Any URL.** Anything `yt-dlp` supports — YouTube, Vimeo, X/Twitter, TikTok, and more.
- **Automatic handling of large files.** Files over 25 MB are compressed with ffmpeg, and recordings that are still too long are automatically split into parts and merged back into one transcript.
- **Clean formatting.** Text is grouped into paragraphs based on Whisper segments, without breaking on abbreviations or numbers.
- **Parallel `scan`.** Files in `input/` are processed concurrently (3 at a time by default, see `SCAN_CONCURRENCY`).
- **Zero-config directories.** `downloads/`, `transcripts/`, and `input/` are created automatically on first run.

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — for downloading from a URL
- [ffmpeg](https://ffmpeg.org/) (including `ffprobe`) — for converting and splitting large files

> The script checks for these tools on startup and tells you what's missing.
> Keep yt-dlp up to date (`yt-dlp -U` or `winget upgrade yt-dlp`) — an outdated version often stops downloading from YouTube.

## Installation

1. Install yt-dlp and ffmpeg:

   ```bash
   # Windows
   winget install yt-dlp
   winget install ffmpeg

   # macOS
   brew install yt-dlp ffmpeg

   # Debian / Ubuntu
   sudo apt install yt-dlp ffmpeg
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file (copy from the example) and add your Groq API key:

   ```bash
   cp .env.example .env
   ```

   ```
   GROQ_API_KEY=gsk_...
   ```

   Get a key: https://console.groq.com/keys

## Usage

### Interactive mode (easiest)

Double-click `start.bat` (Windows) or run:

```bash
npm start
```

The script asks for the URL (or file path) and language one at a time. An empty URL processes the `input/` folder.

### With arguments

```bash
npm run transcribe <URL> [language] [--keep]
npm run transcribe <file path> [language]
npm run transcribe scan [language]
```

Default language: `ru`

### Examples

```bash
npm run transcribe https://youtube.com/watch?v=... ru
npm run transcribe https://vimeo.com/... en
npm run transcribe ./video.mp4 en
npm run transcribe scan ru
```

### Shortcuts

```bash
npm run scan_ru   # every file in input/, language: ru
npm run scan_en   # every file in input/, language: en
```

### Example output

```text
🎤 Transcribing via Groq (language: en)...
⚠️  File is 41.2 MB (over the 24 MB limit), compressing...
✅ After compression: 18.4 MB

✅ Saved: transcripts/video.txt

Welcome back to the channel. Today we're going to walk through...
```

## Flags and environment variables

| Option | Description |
| --- | --- |
| `--keep` | Keep the downloaded audio after transcription (stays in `downloads/`). |
| `YT_DLP_BROWSER` | Browser to read cookies from, if YouTube asks you to "Sign in to confirm you're not a bot" (`chrome`, `edge`, `firefox`, `brave`, ...). |
| `KEEP_AUDIO=true` | Same as the `--keep` flag. |
| `SCAN_CONCURRENCY` | How many files to process in parallel in `scan` mode (default 3). |

Example with cookies from the browser:

```bash
# in .env: YT_DLP_BROWSER=chrome
npm run transcribe https://youtube.com/watch?v=... ru
```

## Output

Transcripts are saved to the `transcripts/` folder as `.txt` files.

## Supported formats

`scan` mode picks up these from `input/`: mp4, mp3, wav, m4a, webm.
When pointed at a file directly, any format ffmpeg can read is accepted (mov, mkv, avi, and others).

## How it works

1. **Fetch** — download from a URL with yt-dlp, or read a local file.
2. **Prepare** — if the audio is over the API size limit, compress it to mono 16 kHz; if it's still too big, split it into time-based chunks.
3. **Transcribe** — send each chunk to Groq's `whisper-large-v3-turbo` model.
4. **Format** — merge segments into readable paragraphs and save the transcript.

## License

[MIT](LICENSE)
