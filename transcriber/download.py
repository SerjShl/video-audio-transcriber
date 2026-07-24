"""Media download via yt-dlp (YouTube and hundreds of other sites)."""

import os
import subprocess
from pathlib import Path

from .config import DIRS


def download_media(url) -> Path:
    print("⬇️  Downloading...")
    output_template = str(DIRS["downloads"] / "audio_%(id)s.%(ext)s")
    args = ["yt-dlp", "-x", "--audio-format", "mp3", "-o", output_template]

    cookies_file = os.environ.get("YT_DLP_COOKIES")
    browser = os.environ.get("YT_DLP_BROWSER")
    if cookies_file:
        print(f"🍪 Using cookies file: {cookies_file}")
        args += ["--cookies", cookies_file]
    elif browser:
        print(f"🍪 Using cookies from browser: {browser}")
        args += ["--cookies-from-browser", browser]

    args += ["--print", "after_move:filepath", "--no-simulate", url]

    result = subprocess.run(args, capture_output=True, text=True, check=True)
    # dict.fromkeys de-duplicates while preserving order.
    paths = list(dict.fromkeys(line.strip() for line in result.stdout.splitlines() if line.strip()))

    if len(paths) > 1:
        print(f"⚠️  {len(paths)} items downloaded (looks like a playlist) — transcribing only the last one.")

    if not paths:
        raise RuntimeError("Could not determine the path of the downloaded file")

    file_path = Path(paths[-1])
    if not file_path.exists():
        raise RuntimeError("Could not determine the path of the downloaded file")
    return file_path
