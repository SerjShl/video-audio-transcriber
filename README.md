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
set neither, the engine is auto-resolved once (never per file): a Groq key (set
in the web **Settings** or via the `GROQ_API_KEY` env var) means cloud; otherwise
the offline engine is used if installed. The chosen engine and the reason are
printed at startup, so it's never a silent surprise.

## Requirements

- [Python](https://www.python.org/) 3.10 or newer
- [ffmpeg](https://ffmpeg.org/) (including `ffprobe`) — convert/split audio; the
  double-click launchers can fetch it for you if it is missing
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — only needed for URLs
- [Node.js](https://nodejs.org/) — only to build the web UI from a clone (not
  needed for the CLI, nor for the release archive)
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

For the cloud engine you need a free Groq key: enter it in the web UI
**Settings**, or (for the CLI) set the `GROQ_API_KEY` env var. Get one at
https://console.groq.com/keys.

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

A local web app (Vite + React + [shadcn/ui](https://ui.shadcn.com)) talking to a
FastAPI backend, with live progress and copy/download of the result. It runs
entirely on your own machine — no cloud, no account, no password.

### Quick start (no command line)

Grab the latest **`Transcriber-<version>.zip`** from
[Releases](../../releases) — the interface is already built there, so Node.js is
not needed. Unpack it and **double-click a launcher**: **`Transcriber.bat`** on
Windows, **`Transcriber.command`** on macOS. (Cloning the repository works too;
then the first run builds the interface itself and Node.js *is* required.)

On the very first run the launcher sets everything up for you — creates a
`.venv`, installs the Python dependencies, and (only if you cloned the repo)
builds the web interface — then starts the server and opens the browser. From
the release archive that takes well under a minute; later runs start in
seconds. If something is missing it says exactly what to install and stops,
instead of failing silently.

Keep the launcher window open while you work — closing it stops the server.
To put it on your desktop, create a **shortcut/alias** to the file; copying the
file itself elsewhere breaks it, because it locates the project by its own path.

You need [Python](https://www.python.org/) 3.10+ installed — the launcher cannot
do that for you, so it opens the download page and tells you to tick *Add
python.exe to PATH*. **ffmpeg it can handle itself**: if none is found it offers
to download a private copy into `tools/ffmpeg/` inside the project folder (about
160 MB to fetch, 280 MB on disk). Nothing is installed system-wide, no PATH is
changed, and deleting that folder undoes it. On macOS it uses `brew install
ffmpeg` instead when Homebrew is present.

On macOS the first launch may be blocked as an unidentified developer —
right-click `Transcriber.command` and choose **Open**; if a double-click does
nothing after unzipping, run `chmod +x Transcriber.command` once.

### Manual start

```bash
cd frontend && npm install && npm run build && cd ..
transcriber-server        # or: python -m backend.server
# → http://127.0.0.1:8000
```

Set `PORT` to use a different port (default 8000).

Then open http://127.0.0.1:8000 and go to **⚙️ Settings** to:
- paste your **Groq API key** (free at https://console.groq.com/keys) — needed
  for the fast cloud engine; the offline `local` engine works without any key;
- optionally switch the interface language (RU/EN) and add a YouTube `cookies.txt`.

### Open it like an app

The UI is an installable PWA. In Chrome or Edge, open the site and use the
install icon in the address bar (or ⋮ menu → **Install / Add to apps**). You get
a desktop/taskbar icon that launches it in its own window — no address bar, no
"open the project".

### Getting a cookies.txt

Only needed when YouTube answers a download with "confirm you're not a bot".
yt-dlp recommends exporting from an **incognito window** so YouTube doesn't
rotate (invalidate) the cookies:

1. Install the **"Get cookies.txt LOCALLY"** browser extension (Chrome/Edge/Firefox).
2. Open a **private/incognito** window and sign in to `youtube.com`.
3. Open a new tab and **close the YouTube tab** so the session isn't refreshed.
4. Click the extension → **Export** — it downloads `cookies.txt` (stay in incognito).
5. Close the incognito window, then upload the file in **Settings → YouTube cookies**.

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
| `GROQ_API_KEY` | Groq API key. Optional — the web UI stores the key you enter in Settings; this env var is a fallback (handy for CLI use). |
| `WHISPER_MODEL` | Groq model (default `whisper-large-v3-turbo`). |
| `WHISPER_LOCAL_MODEL` | faster-whisper model (default `large-v3-turbo` — fast on CPU). |
| `WHISPER_DEVICE` | `auto` / `cpu` / `cuda` for the local engine. |
| `YT_DLP_BROWSER` / `YT_DLP_COOKIES` | Cookies for YouTube "confirm you're not a bot" (CLI). The web UI uses a `cookies.txt` uploaded in Settings instead. |
| `SCAN_CONCURRENCY` | Parallel files in `scan` mode (default 3). |
| `PORT` | Web server port (default 8000). |
| `HOST` | Bind address (default `127.0.0.1`). |
| `MAX_UPLOAD_MB` | Reject web uploads larger than this (default 4096). |
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

## Project structure

```
backend/                # Python package
  config.py             # constants and directory setup
  cli.py                # argument parsing, interactive mode, dispatch
  server.py             # FastAPI backend with SSE progress
  deps.py               # external command checks (ffmpeg, yt-dlp)
  download.py           # media download via yt-dlp
  audio.py              # ffmpeg/ffprobe: probe, convert, split
  pipeline.py           # orchestration: compress → split → transcribe → stitch
  formatting.py         # txt / srt / vtt / json / docx / pdf rendering
  pool.py               # concurrency pool and retry/backoff
  engines/              # groq (cloud) and local (faster-whisper)
frontend/               # Vite + React + shadcn/ui web UI
tests/                  # pytest suite (no external services needed)
Transcriber.bat         # Windows launcher (double-click: set up, then run)
Transcriber.command     # macOS launcher (double-click: set up, then run)
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
