import subprocess

import pytest

from backend import download
from backend.deps import run_command, stderr_detail

YT_DLP_403_STDERR = (
    "WARNING: Your yt-dlp version (2026.06.09) is older than 90 days!\n"
    "         It is strongly recommended to always use the latest version.\n"
    "ERROR: unable to download video data: HTTP Error 403: Forbidden\n"
)


def failed(stderr, returncode=1):
    return subprocess.CalledProcessError(returncode, ["tool"], output="", stderr=stderr)


def test_stderr_detail_keeps_only_error_lines():
    assert stderr_detail(failed(YT_DLP_403_STDERR)) == (
        "ERROR: unable to download video data: HTTP Error 403: Forbidden"
    )


def test_stderr_detail_falls_back_to_stderr_tail():
    stderr = "\n".join(f"line {number}" for number in range(10))
    assert stderr_detail(failed(stderr)) == "\n".join(f"line {number}" for number in range(5, 10))


def test_stderr_detail_falls_back_to_exit_status():
    assert stderr_detail(failed("", returncode=2)) == "exit status 2"


def test_run_command_raises_with_label_and_stderr(monkeypatch):
    def fake_run(*_args, **_kwargs):
        raise failed("ffmpeg banner\nInvalid data found when processing input")

    monkeypatch.setattr(subprocess, "run", fake_run)
    with pytest.raises(RuntimeError, match="(?s)Conversion failed: .*Invalid data found"):
        run_command(["ffmpeg"], "Conversion")


def test_download_failure_shows_yt_dlp_error_and_update_hint(monkeypatch):
    def fake_run(*_args, **_kwargs):
        raise failed(YT_DLP_403_STDERR)

    monkeypatch.setattr(download.subprocess, "run", fake_run)
    with pytest.raises(RuntimeError) as raised:
        download.download_media("https://www.youtube.com/watch?v=X4IO_rHrWGI")

    message = str(raised.value)
    assert "HTTP Error 403: Forbidden" in message
    assert download.YT_DLP_UPDATE_COMMAND in message


def test_download_failure_without_outdated_warning_has_no_update_hint(monkeypatch):
    def fake_run(*_args, **_kwargs):
        raise failed("ERROR: Video unavailable")

    monkeypatch.setattr(download.subprocess, "run", fake_run)
    with pytest.raises(RuntimeError) as raised:
        download.download_media("https://www.youtube.com/watch?v=missing")

    assert str(raised.value) == "Download failed: ERROR: Video unavailable"
