"""FastAPI backend for the web UI.

Exposes a job-based transcription API with live progress over Server-Sent
Events. Jobs run one at a time (stdout from the pipeline is captured per job to
stream progress), which is plenty for a personal, local-only tool.
"""

import asyncio
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv

from .config import DEFAULT_ENGINE, DEFAULT_LANGUAGE, DIRS, OUTPUT_FORMATS, ROOT, ensure_dirs
from .deps import ensure_command
from .download import download_media
from .engines import ENGINE_NAMES, get_engine
from .formatting import render_transcript
from .pipeline import transcribe

load_dotenv()

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)


def safe_basename(name, fallback="upload"):
    """Strip path components and unsafe characters from a client-supplied name."""
    base = re.sub(r"[^\w.\- ]+", "_", os.path.basename(str(name or ""))).strip()
    return base or fallback


# --- job registry -----------------------------------------------------------
class Job:
    def __init__(self, job_id):
        self.id = job_id
        self.events = []
        self.subscribers = set()
        self.status = "queued"
        self.result = None


_jobs: dict[str, Job] = {}
_job_lock = asyncio.Lock()


def _emit(job, event, loop):
    job.events.append(event)
    for queue in list(job.subscribers):
        loop.call_soon_threadsafe(queue.put_nowait, event)


class _LineWriter:
    """A stdout shim that forwards each completed line to a callback."""

    def __init__(self, on_line, passthrough):
        self._buffer = ""
        self._on_line = on_line
        self._passthrough = passthrough

    def write(self, text):
        self._passthrough.write(text)
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            if line.strip():
                self._on_line(line)

    def flush(self):
        self._passthrough.flush()


def _do_transcribe(params):
    engine = get_engine(params["engine"])
    engine.ensure_ready()
    ensure_command("ffmpeg", "Install FFmpeg: https://ffmpeg.org/download.html")
    ensure_command("ffprobe", "ffprobe ships with FFmpeg.")

    cleanup_dir = None
    if params["source"] == "url":
        ensure_command("yt-dlp", "Install yt-dlp: https://github.com/yt-dlp/yt-dlp")
        audio_path = download_media(params["url"])
        cleanup_dir = audio_path.parent if audio_path.parent == DIRS["downloads"] else None
        remove_file = audio_path
    else:
        audio_path = Path(params["file_path"])
        cleanup_dir = audio_path.parent
        remove_file = None

    try:
        segments = transcribe(audio_path, params["language"], engine)
        text = render_transcript(segments, params["format"])
        out_name = f"{audio_path.stem}.{params['format']}"
        DIRS["transcripts"].mkdir(parents=True, exist_ok=True)
        (DIRS["transcripts"] / out_name).write_text(text, encoding="utf-8")
        return {"text": text, "filename": out_name, "format": params["format"]}
    finally:
        if remove_file and remove_file.exists():
            remove_file.unlink()
        if cleanup_dir and cleanup_dir != DIRS["downloads"] and cleanup_dir.exists():
            shutil.rmtree(cleanup_dir, ignore_errors=True)


async def _run_job(job, params):
    loop = asyncio.get_running_loop()
    async with _job_lock:  # serialize: stdout capture is process-global
        job.status = "running"

        def work():
            writer = _LineWriter(
                lambda line: _emit(job, {"type": "log", "line": line}, loop), sys.__stdout__
            )
            previous = sys.stdout
            sys.stdout = writer
            try:
                return _do_transcribe(params)
            finally:
                sys.stdout = previous

        try:
            job.result = await loop.run_in_executor(None, work)
            job.status = "done"
            _emit(job, {"type": "done", "result": job.result}, loop)
        except Exception as error:
            job.status = "error"
            _emit(job, {"type": "error", "message": str(error)}, loop)


# --- app --------------------------------------------------------------------
def create_app():
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import StreamingResponse

    app = FastAPI(title="Video/Audio Transcriber")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # local-only tool
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/engines")
    def engines():
        return {"engines": ENGINE_NAMES, "default": DEFAULT_ENGINE, "formats": OUTPUT_FORMATS}

    @app.post("/api/jobs")
    async def create_job(
        language: str = Form(DEFAULT_LANGUAGE),
        format: str = Form("txt"),
        engine: str = Form(DEFAULT_ENGINE),
        url: str | None = Form(None),
        file: UploadFile | None = File(None),
    ):
        fmt = (format or "txt").lower()
        if fmt not in OUTPUT_FORMATS:
            raise HTTPException(400, f'Unknown format "{fmt}"')
        if engine not in ENGINE_NAMES:
            raise HTTPException(400, f'Unknown engine "{engine}"')

        if url:
            if not _URL_RE.match(url):
                raise HTTPException(400, "A valid http(s) URL is required")
            params = {
                "source": "url", "url": url,
                "language": language, "format": fmt, "engine": engine,
            }
        elif file is not None:
            DIRS["downloads"].mkdir(parents=True, exist_ok=True)
            work_dir = Path(tempfile.mkdtemp(prefix="upload-", dir=DIRS["downloads"]))
            file_path = work_dir / safe_basename(file.filename)
            file_path.write_bytes(await file.read())
            params = {
                "source": "file", "file_path": str(file_path),
                "language": language, "format": fmt, "engine": engine,
            }
        else:
            raise HTTPException(400, "Provide a file upload or a url")

        job = Job(uuid.uuid4().hex)
        _jobs[job.id] = job
        asyncio.create_task(_run_job(job, params))
        return {"jobId": job.id}

    @app.get("/api/jobs/{job_id}/events")
    async def job_events(job_id: str):
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown job")

        async def stream():
            queue = asyncio.Queue()
            job.subscribers.add(queue)
            try:
                for event in list(job.events):
                    yield f"data: {json.dumps(event)}\n\n"
                if job.status in ("done", "error"):
                    return
                while True:
                    event = await queue.get()
                    yield f"data: {json.dumps(event)}\n\n"
                    if event["type"] in ("done", "error"):
                        break
            finally:
                job.subscribers.discard(queue)

        return StreamingResponse(stream(), media_type="text/event-stream")

    # Serve the built frontend if present (production). In dev, Vite serves it.
    dist = ROOT / "frontend" / "dist"
    if dist.exists():
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")

    return app


def main():
    import uvicorn

    ensure_dirs()
    port = int(os.environ.get("PORT") or 8000)
    print(f"🌐 Transcriber API on http://127.0.0.1:{port}  (engine: {DEFAULT_ENGINE})")
    uvicorn.run(create_app(), host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
