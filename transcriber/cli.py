"""Command-line interface."""

import argparse
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from .config import (
    DEFAULT_ENGINE,
    DEFAULT_LANGUAGE,
    DIRS,
    OUTPUT_FORMATS,
    SCAN_CONCURRENCY,
    SCAN_EXTENSIONS,
    ensure_dirs,
)
from .deps import ensure_command
from .download import download_media
from .engines import get_engine
from .pipeline import process_file
from .pool import run_pool

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def build_parser():
    parser = argparse.ArgumentParser(
        prog="transcribe",
        description="Transcribe a URL (YouTube and hundreds of other sites) or local "
        "audio/video files, in the cloud (Groq) or fully offline (faster-whisper).",
    )
    parser.add_argument("input", nargs="?", help="URL, file path, or 'scan' for the input/ folder")
    parser.add_argument("language", nargs="?", default=DEFAULT_LANGUAGE, help="language code (default: ru)")
    parser.add_argument("-f", "--format", default="txt", help="output format: txt, srt, vtt, json")
    parser.add_argument("-o", "--out", default=None, help="output directory (default: transcripts/)")
    parser.add_argument(
        "-e", "--engine", default=DEFAULT_ENGINE, help="engine: groq (cloud) or local (offline)"
    )
    parser.add_argument(
        "--keep",
        action="store_true",
        default=os.environ.get("KEEP_AUDIO") == "true",
        help="keep the downloaded audio after transcription",
    )
    parser.add_argument(
        "-i", "--interactive", action="store_true", help="prompt for URL and language step by step"
    )
    return parser


def parse_args(argv):
    opts = build_parser().parse_args(list(argv))
    opts.format = (opts.format or "txt").lower()
    return opts


def _ask_interactive():
    prompt = "🔗 URL or file path (Enter — scan the input/ folder): "
    input_ = input(prompt).strip()
    language = input(f"🌐 Language [{DEFAULT_LANGUAGE}]: ").strip() or DEFAULT_LANGUAGE
    fmt = input("📄 Format [txt/srt/vtt/json] [txt]: ").strip().lower() or "txt"
    return input_ or "scan", language, fmt


def _scan(language, fmt, output_dir, engine):
    files = [p for p in sorted(DIRS["input"].iterdir()) if p.suffix.lower() in SCAN_EXTENSIONS]
    print(f"▶️  Files: {len(files)}, concurrency: {SCAN_CONCURRENCY}")

    def worker(path, _index):
        try:
            process_file(path, path.stem, language=language, fmt=fmt, output_dir=output_dir, engine=engine)
            print(f"✅ {path.name}")
            return (path.name, True)
        except Exception as error:  # noqa: BLE001 — one bad file shouldn't stop the batch
            print(f"❌ Skipped {path.name}: {error}")
            return (path.name, False)

    results = run_pool(files, SCAN_CONCURRENCY, worker)
    failed = [name for name, ok in results if not ok]
    print(f"\n📊 Done: {len(results) - len(failed)} succeeded, {len(failed)} failed")
    if failed:
        print(f"   Not processed: {', '.join(failed)}")


def run(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    load_dotenv()

    opts = parse_args(argv)
    input_, language, fmt = opts.input, opts.language, opts.format

    if opts.interactive:
        input_, language, fmt = _ask_interactive()

    if not input_:
        build_parser().print_help()
        return 0

    if fmt not in OUTPUT_FORMATS:
        print(f'❌ Unknown format "{fmt}". Use one of: {", ".join(OUTPUT_FORMATS)}', file=sys.stderr)
        return 1

    try:
        engine = get_engine(opts.engine)
        engine.ensure_ready()
    except (ValueError, RuntimeError) as error:
        print(f"❌ {error}", file=sys.stderr)
        return 1

    ensure_dirs()
    output_dir = Path(opts.out).resolve() if opts.out else DIRS["transcripts"]

    try:
        is_url = bool(_URL_RE.match(input_))

        ensure_command("ffmpeg", "Install FFmpeg: https://ffmpeg.org/download.html")
        ensure_command("ffprobe", "ffprobe ships with FFmpeg.")
        if is_url:
            ensure_command("yt-dlp", "Install yt-dlp: https://github.com/yt-dlp/yt-dlp")

        if input_ == "scan":
            _scan(language, fmt, output_dir, engine)
            return 0

        if is_url:
            audio_path = download_media(input_)
            try:
                process_file(
                    audio_path, audio_path.stem,
                    language=language, fmt=fmt, output_dir=output_dir, engine=engine,
                )
            finally:
                if opts.keep:
                    print(f"💾 Audio kept: {audio_path}")
                elif audio_path.exists():
                    audio_path.unlink()
            return 0

        audio_path = Path(input_) if os.path.isabs(input_) else Path.cwd() / input_
        if not audio_path.exists():
            print(f"❌ File not found: {audio_path}", file=sys.stderr)
            return 1

        process_file(
            audio_path, audio_path.stem,
            language=language, fmt=fmt, output_dir=output_dir, engine=engine,
        )
        return 0
    except Exception as error:  # noqa: BLE001 — top-level guard prints a friendly message
        print(f"❌ Error: {error}", file=sys.stderr)
        return 1


def main():
    sys.exit(run())


if __name__ == "__main__":
    main()
