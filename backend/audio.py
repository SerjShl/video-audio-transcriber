"""ffmpeg / ffprobe helpers: probe, convert, split."""

import math
from pathlib import Path

from .config import AUDIO_BITRATE, AUDIO_CHANNELS, AUDIO_SAMPLE_RATE
from .deps import run_command


def size_mb(path) -> float:
    return Path(path).stat().st_size / (1024 * 1024)


def get_duration(path) -> float:
    """Return the media duration in seconds, or NaN if it can't be read."""
    result = run_command(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        "Reading duration",
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return math.nan


def convert_to_audio(input_path, output_dir=None) -> Path:
    """Extract a compact mono audio track suitable for the Groq Whisper API.

    Written into ``output_dir`` (callers pass an isolated scratch dir so
    intermediates never land in ``input/``).
    """
    print("🔄 Converting to audio...")
    input_path = Path(input_path)
    out_dir = Path(output_dir) if output_dir else input_path.parent
    output_path = out_dir / f"{input_path.stem}_converted.mp3"

    run_command(
        [
            "ffmpeg", "-i", str(input_path),
            "-vn",
            "-ar", AUDIO_SAMPLE_RATE,
            "-ac", AUDIO_CHANNELS,
            "-b:a", AUDIO_BITRATE,
            "-y", str(output_path),
        ],
        "Conversion",
    )
    return output_path


def split_audio(input_path, chunk_seconds) -> list[Path]:
    """Split audio into fixed-length chunks and return their paths in order."""
    input_path = Path(input_path)
    pattern = str(input_path.parent / f"{input_path.stem}_chunk_%03d.mp3")

    run_command(
        [
            "ffmpeg", "-i", str(input_path),
            "-f", "segment",
            "-segment_time", str(chunk_seconds),
            "-c", "copy",
            "-y", pattern,
        ],
        "Splitting",
    )

    prefix = f"{input_path.stem}_chunk_"
    return sorted(p for p in input_path.parent.iterdir() if p.name.startswith(prefix))
