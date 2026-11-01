"""External command checks (ffmpeg, ffprobe, yt-dlp)."""

import shutil
import subprocess

STDERR_TAIL_LINES = 5


def ensure_command(cmd, hint):
    if shutil.which(cmd) is None:
        raise RuntimeError(f'Command "{cmd}" not found in PATH. {hint}')


def stderr_detail(error: subprocess.CalledProcessError) -> str:
    lines = [line.strip() for line in (error.stderr or "").splitlines() if line.strip()]
    error_lines = [line for line in lines if line.startswith("ERROR:")]
    return "\n".join(error_lines or lines[-STDERR_TAIL_LINES:]) or f"exit status {error.returncode}"


def run_command(args, label) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(args, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"{label} failed: {stderr_detail(error)}") from error
