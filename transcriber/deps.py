"""External command checks (ffmpeg, ffprobe, yt-dlp)."""

import shutil


def ensure_command(cmd, hint):
    if shutil.which(cmd) is None:
        raise RuntimeError(f'Command "{cmd}" not found in PATH. {hint}')
