# Video/Audio Transcriber

[![CI](https://github.com/SerjShl/video-audio-transcriber/actions/workflows/ci.yml/badge.svg)](https://github.com/SerjShl/video-audio-transcriber/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-%3E%3D3.10-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Turn video and audio into text. It reads a URL (YouTube and hundreds of other
sites) or a local file, and transcribes it either through the
[Groq](https://console.groq.com/) Whisper API or offline on your own machine
with [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

There are two ways to use it: a command-line tool, or a small web UI where you
drop a file in or paste a link. It takes care of the boring parts, so you don't
have to: downloading, converting to audio, shrinking files the API would reject,
cutting long recordings into chunks and stitching the pieces back into one
transcript.

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

### Without a command line

Download `Transcriber-<version>.zip` from [Releases](../../releases), unpack it
anywhere, and double-click `Transcriber.bat` on Windows or
`Transcriber.command` on macOS. The first run installs what it needs and opens
the browser by itself; it takes under a minute, and later runs start in seconds.

Install [Python](https://www.python.org/downloads/) 3.10 or newer first, with
the *Add python.exe to PATH* box ticked. If ffmpeg is missing the launcher
offers to download it for you. See [Quick start](#quick-start-no-command-line)
for the details.

### From source

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

Building the web UI from source also needs [Node.js](https://nodejs.org/):
`cd frontend && npm install && npm run build`. The release archive above ships
it prebuilt, so Node is not required there.

For the cloud engine you need a free Groq key: enter it in the web UI Settings,
or set the `GROQ_API_KEY` env var for the CLI. Get one at
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
entirely on your own machine: no cloud, no account, no login. The server binds
to `127.0.0.1`, so nothing is reachable from outside unless you change `HOST`.

### Quick start (no command line)

Take the latest `Transcriber-<version>.zip` from [Releases](../../releases). The
interface is already built inside, so you don't need Node.js. Unpack it and
double-click `Transcriber.bat` on Windows or `Transcriber.command` on macOS.
Cloning the repository works too, but then the first run has to build the
interface, and for that Node.js does have to be installed.

The first run sets itself up: it creates a `.venv`, installs the Python
dependencies, builds the interface if you cloned the repo, then starts the
server and opens the browser. From the release archive that takes under a
minute, and later runs start in seconds. When something is missing, the window
tells you what to install and stops there rather than closing on you.

Keep the launcher window open while you work, because closing it stops the
server. To put it on your desktop, make a shortcut (or an alias on macOS) to the
file. Copying the file itself somewhere else breaks it, since it finds the
project by its own location.

Python 3.10+ has to be installed by hand; the launcher can't do that for you, so
it opens the download page and reminds you to tick *Add python.exe to PATH*.
ffmpeg it can handle on its own: if there is none, it offers to download a copy
into `tools/ffmpeg/` inside the project folder (about 160 MB to fetch, 280 MB on
disk). That copy is private to the project, nothing is installed system-wide and
no PATH is touched, so deleting the folder undoes it. On macOS, when Homebrew is
present, it runs `brew install ffmpeg` instead.

macOS may block the first launch as an unidentified developer; right-click
`Transcriber.command` and choose Open. If a double-click does nothing after
unzipping, run `chmod +x Transcriber.command` once.

### Manual start

```bash
cd frontend && npm install && npm run build && cd ..
transcriber-server        # or: python -m backend.server
# → http://127.0.0.1:8000
```

Set `PORT` to use a different port (default 8000).

Then open http://127.0.0.1:8000 and click the Settings button to paste your Groq
API key (free at https://console.groq.com/keys). The key is what the cloud engine
runs on; the offline `local` engine needs none. The same dialog switches the
interface language between Russian and English and takes a YouTube
`cookies.txt`.

### Open it like an app

The UI is an installable PWA. In Chrome or Edge, open the site and use the
install icon in the address bar, or the menu entry "Install / Add to apps". You
end up with a desktop or taskbar icon that opens it in its own window, with no
address bar and no "open the project" step.

### Getting a cookies.txt

You only need this when YouTube answers a download with "confirm you're not a
bot". yt-dlp recommends exporting from an incognito window, otherwise YouTube
rotates the cookies and invalidates them:

1. Install the "Get cookies.txt LOCALLY" browser extension (Chrome/Edge/Firefox).
2. Open a private window and sign in to `youtube.com`.
3. Open a new tab, then close the YouTube tab so the session isn't refreshed.
4. Click the extension and press Export. It saves `cookies.txt`. Stay in incognito.
5. Close the incognito window, then upload the file in Settings, under YouTube cookies.

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
| `WHISPER_DEVICE` | `cpu` (default) / `cuda` / `auto` for the local engine. |
| `WHISPER_COMPUTE_TYPE` | Precision for the local engine (default `int8` — fastest on CPU). |
| `KEEP_AUDIO` | Set to `true` to keep downloaded audio by default (same as `--keep`). |
| `YT_DLP_BROWSER` / `YT_DLP_COOKIES` | Cookies for YouTube "confirm you're not a bot" (CLI). The web UI uses a `cookies.txt` uploaded in Settings instead. |
| `SCAN_CONCURRENCY` | Parallel files in `scan` mode (default 3). |
| `PORT` | Web server port (default 8000). |
| `HOST` | Bind address (default `127.0.0.1`). |
| `MAX_UPLOAD_MB` | Reject web uploads larger than this (default 4096). |
| `PDF_FONT` | Optional path to a Unicode `.ttf` for PDF export (a system font is used otherwise). |

## How it works

1. Fetch: download from a URL with yt-dlp, or read the local file.
2. Prepare: for the cloud engine, audio over the API size limit is compressed to
   mono 16 kHz, and split into time-based chunks if that isn't enough. The local
   engine has no size limit and skips this step.
3. Transcribe: send each chunk to the chosen engine. Cloud failures that look
   transient are retried with exponential backoff.
4. Format: merge the segments into readable paragraphs, subtitle cues or JSON,
   and write the transcript to `data/transcripts/`.

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
tools/                  # not in git: ffmpeg the launcher may download here
.github/workflows/      # ci.yml (lint + tests + UI build), release.yml (archive)
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

The tests cover the pure logic: paragraph formatting, subtitle and JSON
rendering, the concurrency pool, retry and backoff, argument parsing, engine
resolution, segment stitching, plus one full server job run. None of it needs
ffmpeg, yt-dlp or an API key. CI runs lint and tests on Python 3.10, 3.11 and
3.12, and builds the frontend.

### Cutting a release

Bump `version` in `pyproject.toml`, then push a matching `v*` tag. CI builds the
UI, packs it together with the backend and the launchers, and publishes the
archive to Releases:

```bash
git tag v2.3.0
git push origin v2.3.0
```

The workflow checks the archive before publishing and refuses to release a
broken one: no built UI, launchers with the wrong line endings, or a missing
executable bit on the macOS launcher.

## License

[MIT](LICENSE)
