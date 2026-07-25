# Video/Audio Transcriber

[![CI](https://github.com/SerjShl/video-audio-transcriber/actions/workflows/ci.yml/badge.svg)](https://github.com/SerjShl/video-audio-transcriber/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.10-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Transcribe video and audio into text — from a **URL** (YouTube and hundreds of
other sites) or from **local files** — either in the **cloud** via the
[Groq](https://console.groq.com/) Whisper API or **fully offline** via
[faster-whisper](https://github.com/SYSTRAN/faster-whisper).

Use it from the **command line** or from a small **web UI** (drag-and-drop a
file or paste a link). It handles the tedious parts: downloading, converting to
audio, compressing oversized files, splitting long recordings into chunks, and
stitching everything back into a single clean transcript.

## Two engines

| | `groq` (default) | `local` |
| --- | --- | --- |
| Where | Cloud API | Your machine, offline |
| Needs | `GROQ_API_KEY` (free) | `pip install ".[local]"`, ~1 GB model |
| Privacy | Audio uploaded | Nothing leaves your machine |
| Size limit | 25 MB (auto compress/split) | None |
| Speed | Very fast | Depends on CPU/GPU; model loads once and is reused |

Pick per run with `--engine`, or set a default with `TRANSCRIBER_ENGINE`. If you
set neither, the engine is auto-resolved once (never per file): a present
`GROQ_API_KEY` means cloud; otherwise the offline engine is used if installed.
The chosen engine and the reason are printed at startup, so it's never a silent
surprise.

## Requirements

- [Python](https://www.python.org/) 3.10 or newer
- [ffmpeg](https://ffmpeg.org/) (including `ffprobe`) — convert/split audio
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — only needed for URLs
- For the `local` engine: optionally an NVIDIA GPU (CUDA) for a big speed-up

> The tool checks for these on startup and tells you what's missing.
> Keep yt-dlp up to date (`yt-dlp -U`) — an outdated version often stops
> downloading from YouTube.

## Installation

```bash
# system tools
brew install ffmpeg yt-dlp          # macOS
# sudo apt install ffmpeg yt-dlp    # Debian/Ubuntu
# winget install ffmpeg yt-dlp      # Windows

# the transcriber (cloud engine only)
pip install .

# with the offline engine and/or the web server
pip install ".[local]"              # offline faster-whisper
pip install ".[server]"             # web UI backend
pip install ".[local,server,dev]"   # everything + test tools
```

Then copy the env template and add your Groq key (for the cloud engine):

```bash
cp .env.example .env
# GROQ_API_KEY=gsk_...   → https://console.groq.com/keys
```

## Command-line usage

```bash
transcribe <URL> [language] [options]
transcribe <file path> [language] [options]
transcribe scan [language] [options]     # every file in data/input/
transcribe --interactive                 # prompt step by step
```

Default language is `ru`. Run `transcribe --help` for the full list.

### Examples

```bash
transcribe https://youtube.com/watch?v=... ru
transcribe ./talk.mp4 en --format srt
transcribe ./talk.mp4 en --format json          # segment-level JSON
transcribe scan ru --out ./subs
transcribe ./private.mp4 ru --engine local      # offline, nothing uploaded
```

## Web UI

A modern UI (Vite + React + [shadcn/ui](https://ui.shadcn.com)) that talks to a
FastAPI backend, with live progress and copy/download of the result.

```bash
# 1. build the frontend once
cd frontend && npm install && npm run build && cd ..

# 2. run the server (serves the built UI + API)
transcriber-server        # or: python -m backend.server
# → http://127.0.0.1:8000
```

For frontend development with hot reload, run the backend and `npm run dev` in
`frontend/` (it proxies `/api` to the backend). See `frontend/README.md`.

## Flags and environment variables

| Option | Description |
| --- | --- |
| `-f, --format <fmt>` | `txt` (default), `srt`, `vtt`, `json`, `docx`, or `pdf`. |
| `-o, --out <dir>` | Output directory (default: `data/transcripts/`). |
| `-e, --engine <name>` | `groq` (cloud) or `local` (offline); auto-resolved if omitted. |
| `--keep` | Keep the downloaded audio (stays in `data/downloads/`). |
| `-i, --interactive` | Prompt for the URL and language step by step. |
| `TRANSCRIBER_ENGINE` | Force the default engine; if unset it's auto-resolved from your config. |
| `GROQ_API_KEY` | Groq API key (cloud engine). |
| `WHISPER_MODEL` | Groq model (default `whisper-large-v3-turbo`). |
| `WHISPER_LOCAL_MODEL` | faster-whisper model (default `large-v3`). |
| `WHISPER_DEVICE` | `auto` / `cpu` / `cuda` for the local engine. |
| `YT_DLP_BROWSER` / `YT_DLP_COOKIES` | Cookies for YouTube "confirm you're not a bot" (CLI). The web UI uses one shared `cookies.txt` uploaded in Settings instead. |
| `SCAN_CONCURRENCY` | Parallel files in `scan` mode (default 3). |
| `PORT` | Web server port (default 8000; injected by most PaaS). |
| `HOST` | Bind address (default `127.0.0.1`; use `0.0.0.0` in a container). |
| `APP_PASSWORD` | Shared password for the web UI. Set it → login required; unset → open. This is the only switch for access. Always set it on a public deployment. |
| `SESSION_SECRET` | Optional key for signing the login cookie (defaults to `APP_PASSWORD`). |
| `MAX_UPLOAD_MB` | Reject web uploads larger than this (default 4096; `render.yaml` sets 1024 for the free tier). |
| `PDF_FONT` | Optional path to a Unicode `.ttf` for PDF export (a system font is used otherwise). |

## How it works

1. **Fetch** — download from a URL with yt-dlp, or read a local file.
2. **Prepare** — for the cloud engine, if the audio is over the API size limit,
   compress it to mono 16 kHz and, if still too big, split it into time-based
   chunks. The local engine has no size limit and skips this.
3. **Transcribe** — send each chunk to the selected engine, retrying transient
   failures (cloud) with exponential backoff.
4. **Format** — merge segments into readable paragraphs, subtitle cues, or JSON,
   and save the transcript to `data/transcripts/`.

## Run your own copy (free hosting)

Anyone can fork this repo and stand up their own private instance — no code
changes required. The repo ships a `Dockerfile` and a Render `render.yaml`
configured for the **cloud (Groq) engine** (the only one that fits a free
tier). The image builds the React UI, installs ffmpeg + yt-dlp, and serves the
whole app from one port, behind a password you choose.

**What you need (both free):**
1. A [GitHub](https://github.com/) account — to fork the repo.
2. A [Groq API key](https://console.groq.com/keys) — sign up, create a key
   (`gsk_...`). This is what does the transcription.

**Deploy on [Render](https://render.com) (~5 minutes):**
1. **Fork** this repo to your own GitHub account (top-right *Fork* button).
2. On Render: **New → Blueprint**, connect GitHub, and pick your fork. Render
   reads `render.yaml` and creates the service automatically.
3. Open the new service → **Environment**, and add two values:
   - `GROQ_API_KEY` — the key from step 2 above.
   - `APP_PASSWORD` — a password you invent. Everyone who uses your instance
     will type it once.
4. Wait for the first build to finish, then open the service URL. A login page
   asks for the password, and you're in.
5. Share the URL **and** the password with the people you want to let in.

Once inside: pick a language (Русский/English), a format (txt/srt/vtt/json/docx/pdf),
paste a link or drop a file, and hit transcribe. The **Settings** dialog (gear
icon) also lets you switch the interface language (RU/EN) and manage:
- **YouTube cookies** — a single shared `cookies.txt`, uploaded once and stored
  on the server, then used automatically for every URL job. So one person sets
  it up and everyone else (family included) never touches cookies. See
  [Getting a cookies.txt](#getting-a-cookiestxt) below.

Whether a login is required is decided solely by `APP_PASSWORD`: set it on the
server and the site asks for the password; leave it unset and the site is open.
The Settings dialog shows the current state but doesn't change it — that keeps
the rule in one place and safe across restarts (Settings just reports it).

### Getting a cookies.txt

Only needed when YouTube answers a download with "confirm you're not a bot"
(more common from a cloud server than from home). To create one:

1. Install the **"Get cookies.txt LOCALLY"** browser extension (Chrome/Edge/Firefox).
2. Open `youtube.com` and sign in.
3. Click the extension → **Export** — it downloads `cookies.txt`.
4. Upload it in **Settings → YouTube cookies**. Refresh every couple of months
   or whenever downloads start failing again.

> Prefer one click? This button deploys the canonical repo directly (you still
> set the two secrets afterwards):
>
> [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/SerjShl/video-audio-transcriber)

**Good to know:**
- Access is gated only by `APP_PASSWORD`. Without it the instance is open to
  anyone who finds the URL, and they'd spend *your* Groq quota — always set it.
- The free instance sleeps after ~15 min idle; the next request takes ~30 s to
  wake it. Fine for occasional personal use.
- **File upload** is the reliable path in the cloud. YouTube often blocks
  downloads from datacenter IPs, so pasting a link may fail on the server even
  though it works on your own machine.
- The offline `local` engine is intentionally excluded from the deployed image
  (it needs ~1 GB of model and far more RAM than a free tier gives). It's only
  for running on your own machine.
- Any Docker host works the same way (Fly.io, Cloud Run, a VPS): build the
  image and pass `GROQ_API_KEY`, `APP_PASSWORD`, and `HOST=0.0.0.0`.

## Project structure

```
backend/                # Python package
  config.py             # constants and directory setup
  cli.py                # argument parsing, interactive mode, dispatch
  server.py             # FastAPI backend with SSE progress + optional password
  deps.py               # external command checks (ffmpeg, yt-dlp)
  download.py           # media download via yt-dlp
  audio.py              # ffmpeg/ffprobe: probe, convert, split
  pipeline.py           # orchestration: compress → split → transcribe → stitch
  formatting.py         # txt / srt / vtt / json rendering
  pool.py               # concurrency pool and retry/backoff
  engines/              # groq (cloud) and local (faster-whisper)
frontend/               # Vite + React + shadcn/ui web UI
tests/                  # pytest suite (no external services needed)
Dockerfile              # container image (frontend build + Python runtime)
render.yaml             # one-click Render deployment
```

## Development

```bash
pip install ".[server,dev]"
ruff check .            # lint
pytest -q               # unit tests

cd frontend && npm run build   # type-check + build the UI
```

Tests cover the pure logic — paragraph formatting, subtitle/JSON rendering, the
concurrency pool, retry/backoff, argument parsing, engine resolution, segment
stitching, and a full server job run — so they need no ffmpeg, yt-dlp, or API
key. CI runs lint + tests on Python 3.10/3.11/3.12 and builds the frontend.

## License

[MIT](LICENSE)
