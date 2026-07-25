"""FastAPI backend for the web UI.

Exposes a job-based transcription API with live progress over Server-Sent
Events. Jobs run one at a time (stdout from the pipeline is captured per job to
stream progress), which is plenty for a personal, local-only tool.
"""

import asyncio
import hashlib
import hmac
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import sys
import tempfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

from .config import (
    DATA_DIR,
    DEFAULT_LANGUAGE,
    DIRS,
    MAX_UPLOAD_MB,
    OUTPUT_FORMATS,
    ROOT,
    ensure_dirs,
)
from .deps import ensure_command
from .download import download_media
from .engines import ENGINE_NAMES, engine_availability, get_engine, resolve_default_engine
from .formatting import render_output
from .pipeline import transcribe

load_dotenv()

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)

# --- session auth + runtime settings ----------------------------------------
SESSION_COOKIE = "vat_session"
_SETTINGS_PATH = DATA_DIR / "settings.json"


def _app_password():
    return os.environ.get("APP_PASSWORD") or ""


def password_configured():
    return bool(_app_password())


def _load_settings():
    try:
        return json.loads(_SETTINGS_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_settings(settings):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _SETTINGS_PATH.write_text(json.dumps(settings, indent=2), encoding="utf-8")


def _stored_cookies_path():
    """A single shared cookies.txt for yt-dlp, managed via Settings.

    One person uploads it once; every URL job reuses it, so non-technical users
    never touch cookies. It lives under data/ and is never served back out.
    """
    return DATA_DIR / "cookies.txt"


def _cookies_meta():
    if _stored_cookies_path().exists():
        return {"present": True, "name": _load_settings().get("cookies_name") or "cookies.txt"}
    return {"present": False, "name": None}


def auth_required():
    """Whether the web UI currently gates access behind the password.

    Requires a password to be configured at all; within that, a runtime toggle
    (persisted in data/settings.json) can turn the gate off. Defaults to on.
    """
    if not password_configured():
        return False
    return bool(_load_settings().get("auth_required", True))


def _session_secret():
    # Deriving the signing key from APP_PASSWORD means changing the password
    # instantly invalidates every existing session, with no separate secret.
    base = os.environ.get("SESSION_SECRET") or _app_password()
    return base.encode("utf-8")


def _make_session_token():
    return hmac.new(_session_secret(), b"authenticated", hashlib.sha256).hexdigest()


def _valid_session(token):
    return bool(token) and secrets.compare_digest(token, _make_session_token())


# --- brute-force throttling for login --------------------------------------
_LOGIN_WINDOW_S = 300
_LOGIN_MAX_FAILS = 10
_login_fails: dict[str, list[float]] = {}


def _client_ip(request):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _login_blocked(ip):
    now = time.time()
    recent = [t for t in _login_fails.get(ip, []) if now - t < _LOGIN_WINDOW_S]
    _login_fails[ip] = recent
    return len(recent) >= _LOGIN_MAX_FAILS


def _record_login_fail(ip):
    _login_fails.setdefault(ip, []).append(time.time())


# --- SSRF guard for user-supplied URLs -------------------------------------
def url_targets_private_host(url):
    """True if the URL points at a private/loopback/link-local/metadata host.

    Defence in depth for the URL job: even an authenticated user shouldn't be
    able to make the server fetch its own cloud metadata or internal services.
    yt-dlp does its own resolution/redirects, so this is a best-effort check.
    """
    try:
        host = urlparse(url).hostname
    except ValueError:
        return True
    if not host:
        return True
    if host.lower() in {"localhost", "metadata.google.internal", "metadata"}:
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False  # can't resolve — let yt-dlp try and fail normally
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return True
    return False


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
        cookies = _stored_cookies_path()
        cookies_file = str(cookies) if cookies.exists() else None
        audio_path = download_media(params["url"], cookies_file=cookies_file)
        cleanup_dir = audio_path.parent if audio_path.parent == DIRS["downloads"] else None
        remove_file = audio_path
    else:
        audio_path = Path(params["file_path"])
        cleanup_dir = audio_path.parent
        remove_file = None

    try:
        segments = transcribe(audio_path, params["language"], engine)
        preview, data, media_type = render_output(segments, params["format"])
        out_name = f"{audio_path.stem}.{params['format']}"
        DIRS["transcripts"].mkdir(parents=True, exist_ok=True)
        out_path = DIRS["transcripts"] / out_name
        out_path.write_bytes(data)
        return {
            "text": preview,
            "filename": out_name,
            "format": params["format"],
            "path": str(out_path),
            "media_type": media_type,
        }
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
    from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

    app = FastAPI(title="Video/Audio Transcriber")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # local-only tool
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # The API is gated by a signed session cookie whenever a login is required
    # (a password is configured AND the runtime toggle is on): the user logs in
    # once via /api/login and the cookie rides along afterwards. The static UI
    # and the auth/status endpoints stay public so the login screen can load.
    _public_paths = {"/healthz", "/api/login", "/api/logout", "/api/auth"}

    @app.middleware("http")
    async def require_login(request: Request, call_next):
        path = request.url.path
        # Only the JSON API is gated; the SPA + its assets load freely.
        if not auth_required() or path in _public_paths or not path.startswith("/api/"):
            return await call_next(request)
        if not _valid_session(request.cookies.get(SESSION_COOKIE)):
            return JSONResponse({"detail": "Authentication required"}, status_code=401)
        return await call_next(request)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    @app.get("/api/auth")
    def auth_status(request: Request):
        """Let the frontend know whether a login is required and if it's done."""
        required = auth_required()
        authed = (not required) or _valid_session(request.cookies.get(SESSION_COOKIE))
        return {
            "required": required,
            "authed": authed,
            "passwordConfigured": password_configured(),
        }

    @app.post("/api/login")
    async def login(request: Request):
        if not auth_required():
            return {"ok": True}
        ip = _client_ip(request)
        if _login_blocked(ip):
            return JSONResponse(
                {"detail": "Слишком много попыток. Подождите несколько минут."},
                status_code=429,
            )
        try:
            body = await request.json()
        except Exception:
            body = dict(await request.form())
        supplied = str(body.get("password", ""))
        if not secrets.compare_digest(supplied, _app_password()):
            _record_login_fail(ip)
            return JSONResponse({"detail": "Неверный пароль"}, status_code=401)
        _login_fails.pop(ip, None)
        response = JSONResponse({"ok": True})
        response.set_cookie(
            SESSION_COOKIE,
            _make_session_token(),
            httponly=True,
            samesite="lax",
            secure=request.url.scheme == "https",
            max_age=60 * 60 * 24 * 30,
        )
        return response

    @app.post("/api/logout")
    def logout():
        response = JSONResponse({"ok": True})
        response.delete_cookie(SESSION_COOKIE)
        return response

    def _settings_payload():
        return {
            "authRequired": auth_required(),
            "passwordConfigured": password_configured(),
            "cookies": _cookies_meta(),
        }

    @app.get("/api/settings")
    def get_settings():
        return _settings_payload()

    @app.post("/api/settings")
    async def update_settings(request: Request):
        try:
            body = await request.json()
        except Exception:
            body = dict(await request.form())
        settings = _load_settings()
        if "authRequired" in body:
            want = bool(body["authRequired"])
            if want and not password_configured():
                raise HTTPException(400, "Set an APP_PASSWORD before requiring login.")
            settings["auth_required"] = want
        _save_settings(settings)
        return _settings_payload()

    @app.post("/api/cookies")
    async def upload_cookies(cookies: UploadFile = File(...)):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        await _stream_to(cookies, _stored_cookies_path(), max_bytes=5 * 1024 * 1024)
        settings = _load_settings()
        settings["cookies_name"] = safe_basename(cookies.filename, "cookies.txt")
        _save_settings(settings)
        return _settings_payload()

    @app.delete("/api/cookies")
    def delete_cookies():
        path = _stored_cookies_path()
        if path.exists():
            path.unlink()
        settings = _load_settings()
        settings.pop("cookies_name", None)
        _save_settings(settings)
        return _settings_payload()

    @app.get("/api/engines")
    def engines():
        default, _reason = resolve_default_engine()
        items = []
        for name in ENGINE_NAMES:
            available, note = engine_availability(name)
            items.append({"name": name, "available": available, "note": note})
        return {"engines": items, "default": default, "formats": OUTPUT_FORMATS}

    async def _stream_to(upload, path, max_bytes=None):
        """Write an UploadFile to disk in chunks (never fully in RAM).

        Aborts with 413 if it grows past ``max_bytes``, so a single request
        can't exhaust the instance's disk.
        """
        size = 0
        with path.open("wb") as out:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if max_bytes and size > max_bytes:
                    out.close()
                    path.unlink(missing_ok=True)
                    raise HTTPException(413, f"Файл больше лимита ({MAX_UPLOAD_MB} МБ)")
                out.write(chunk)

    @app.post("/api/jobs")
    async def create_job(
        language: str = Form(DEFAULT_LANGUAGE),
        format: str = Form("txt"),
        engine: str | None = Form(None),
        url: str | None = Form(None),
        file: UploadFile | None = File(None),
    ):
        fmt = (format or "txt").lower()
        if fmt not in OUTPUT_FORMATS:
            raise HTTPException(400, f'Unknown format "{fmt}"')
        engine = engine or resolve_default_engine()[0]
        if engine not in ENGINE_NAMES:
            raise HTTPException(400, f'Unknown engine "{engine}"')

        if url:
            if not _URL_RE.match(url):
                raise HTTPException(400, "A valid http(s) URL is required")
            if url_targets_private_host(url):
                raise HTTPException(400, "URL ведёт на приватный адрес")
            params = {
                "source": "url", "url": url,
                "language": language, "format": fmt, "engine": engine,
            }
        elif file is not None:
            DIRS["downloads"].mkdir(parents=True, exist_ok=True)
            work_dir = Path(tempfile.mkdtemp(prefix="upload-", dir=DIRS["downloads"]))
            file_path = work_dir / safe_basename(file.filename)
            await _stream_to(file, file_path, max_bytes=MAX_UPLOAD_MB * 1024 * 1024)
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

    @app.get("/api/jobs/{job_id}/download")
    def download_result(job_id: str):
        job = _jobs.get(job_id)
        if not job or job.status != "done" or not job.result:
            raise HTTPException(404, "No finished result for this job")
        path = Path(job.result["path"])
        if not path.exists():
            raise HTTPException(404, "The result file is no longer available")
        return FileResponse(
            path,
            media_type=job.result.get("media_type", "application/octet-stream"),
            filename=job.result["filename"],
        )

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
    # 0.0.0.0 inside a container (Render/Docker); 127.0.0.1 for local runs.
    host = os.environ.get("HOST", "127.0.0.1")
    default_engine, _reason = resolve_default_engine()
    shown_host = "127.0.0.1" if host in ("127.0.0.1", "0.0.0.0") else host
    print(f"🌐 Transcriber API on http://{shown_host}:{port}  (default engine: {default_engine})")
    uvicorn.run(create_app(), host=host, port=port)


if __name__ == "__main__":
    main()
