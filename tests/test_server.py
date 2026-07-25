import pytest

from backend.server import safe_basename

fastapi = pytest.importorskip("fastapi")


def test_safe_basename_strips_paths_and_unsafe_chars():
    assert safe_basename("../../etc/passwd") == "passwd"
    assert safe_basename("my clip!.mp4") == "my clip_.mp4"
    assert safe_basename("") == "upload"
    assert safe_basename(None) == "upload"


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient

    import backend.server as server

    class DummyEngine:
        name = "groq"
        label = "Dummy"
        max_file_size_mb = float("inf")

        def ensure_ready(self):
            return None

    # A developer's local .env may set APP_PASSWORD; tests run in open mode.
    monkeypatch.delenv("APP_PASSWORD", raising=False)
    monkeypatch.setattr(server, "ensure_command", lambda *a, **k: None)
    monkeypatch.setattr(server, "get_engine", lambda name=None: DummyEngine())
    monkeypatch.setattr(
        server, "transcribe", lambda path, lang, engine: [{"start": 0, "end": 1, "text": "hello"}]
    )
    return TestClient(server.create_app())


def test_engines_endpoint(client):
    body = client.get("/api/engines").json()
    names = [e["name"] for e in body["engines"]]
    assert "groq" in names
    assert all("available" in e for e in body["engines"])
    assert "json" in body["formats"]
    assert body["default"] in names


def test_formats_include_docx_and_pdf(client):
    formats = client.get("/api/engines").json()["formats"]
    assert "docx" in formats
    assert "pdf" in formats


def test_create_job_requires_input(client):
    assert client.post("/api/jobs", data={"format": "txt"}).status_code == 400


def test_unknown_job_events_404(client):
    assert client.get("/api/jobs/nope/events").status_code == 404


def test_download_serves_the_result_file(client, tmp_path):
    import backend.server as server

    out = tmp_path / "clip.txt"
    out.write_text("привет мир", encoding="utf-8")
    job = server.Job("dl-job")
    job.status = "done"
    job.result = {
        "text": "привет мир", "filename": "clip.txt", "format": "txt",
        "path": str(out), "media_type": "text/plain; charset=utf-8",
    }
    server._jobs[job.id] = job
    try:
        res = client.get(f"/api/jobs/{job.id}/download")
        assert res.status_code == 200
        assert res.content.decode("utf-8") == "привет мир"
    finally:
        server._jobs.pop(job.id, None)


def test_login_gate_and_flow(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    import backend.server as server

    monkeypatch.setenv("APP_PASSWORD", "s3cret")
    monkeypatch.setattr(server, "_SETTINGS_PATH", tmp_path / "settings.json")
    client = TestClient(server.create_app())

    # The API is gated until login; the status endpoint stays reachable.
    assert client.get("/api/engines").status_code == 401
    status = client.get("/api/auth").json()
    assert status["required"] is True
    assert status["authed"] is False
    assert status["passwordConfigured"] is True

    assert client.post("/api/login", json={"password": "wrong"}).status_code == 401
    assert client.post("/api/login", json={"password": "s3cret"}).status_code == 200

    # The session cookie now rides along on the TestClient's jar.
    assert client.get("/api/auth").json()["authed"] is True
    assert client.get("/api/engines").status_code == 200

    client.post("/api/logout")
    assert client.get("/api/engines").status_code == 401


def test_auth_follows_app_password(monkeypatch):
    from fastapi.testclient import TestClient

    import backend.server as server

    # No password configured → the site is open, no login required.
    monkeypatch.delenv("APP_PASSWORD", raising=False)
    open_client = TestClient(server.create_app())
    assert open_client.get("/api/auth").json()["required"] is False
    assert open_client.get("/api/engines").status_code == 200

    # Password configured → login is required.
    monkeypatch.setenv("APP_PASSWORD", "s3cret")
    gated_client = TestClient(server.create_app())
    assert gated_client.get("/api/auth").json()["required"] is True
    assert gated_client.get("/api/engines").status_code == 401


def test_rejects_private_url(client):
    res = client.post("/api/jobs", data={"url": "http://localhost/video", "format": "txt"})
    assert res.status_code == 400


def test_rejects_oversized_upload(client, monkeypatch):
    import backend.server as server

    monkeypatch.setattr(server, "MAX_UPLOAD_MB", 1)
    big = b"x" * (2 * 1024 * 1024)  # 2 MB > 1 MB cap
    res = client.post(
        "/api/jobs",
        data={"format": "txt"},
        files={"file": ("big.mp3", big, "audio/mpeg")},
    )
    assert res.status_code == 413


def test_login_is_rate_limited(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    import backend.server as server

    monkeypatch.setenv("APP_PASSWORD", "s3cret")
    monkeypatch.setattr(server, "_SETTINGS_PATH", tmp_path / "settings.json")
    monkeypatch.setattr(server, "_login_fails", {})
    client = TestClient(server.create_app())

    for _ in range(server._LOGIN_MAX_FAILS):
        assert client.post("/api/login", json={"password": "nope"}).status_code == 401
    # Further attempts are blocked, even with the correct password.
    assert client.post("/api/login", json={"password": "s3cret"}).status_code == 429


def test_shared_cookies_upload_and_delete(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    import backend.server as server

    monkeypatch.delenv("APP_PASSWORD", raising=False)
    monkeypatch.setattr(server, "DATA_DIR", tmp_path)
    monkeypatch.setattr(server, "_SETTINGS_PATH", tmp_path / "settings.json")
    client = TestClient(server.create_app())

    assert client.get("/api/settings").json()["cookies"] == {"present": False, "name": None}

    res = client.post(
        "/api/cookies",
        files={"cookies": ("mycookies.txt", b"# Netscape HTTP Cookie File\n")},
    )
    assert res.status_code == 200
    assert res.json()["cookies"] == {"present": True, "name": "mycookies.txt"}
    assert (tmp_path / "cookies.txt").exists()

    assert client.delete("/api/cookies").json()["cookies"] == {"present": False, "name": None}
    assert not (tmp_path / "cookies.txt").exists()


def test_run_job_produces_a_done_result(monkeypatch, tmp_path):
    # Exercise the job machinery directly with asyncio — TestClient tears down
    # the request's event loop before a background task can finish, so the SSE
    # flow can't be driven through it reliably.
    import asyncio

    import backend.server as server

    class DummyEngine:
        max_file_size_mb = float("inf")

        def ensure_ready(self):
            return None

    monkeypatch.setattr(server, "ensure_command", lambda *a, **k: None)
    monkeypatch.setattr(server, "get_engine", lambda name=None: DummyEngine())
    monkeypatch.setattr(
        server, "transcribe", lambda path, lang, engine: [{"start": 0, "end": 1, "text": "hello"}]
    )

    clip = tmp_path / "clip.mp3"
    clip.write_bytes(b"fake audio bytes")
    job = server.Job("test-job")
    params = {
        "source": "file", "file_path": str(clip),
        "language": "en", "format": "txt", "engine": "groq",
    }

    asyncio.run(server._run_job(job, params))

    assert job.status == "done"
    assert job.result["text"] == "hello"
    assert job.result["filename"] == "clip.txt"
    assert any(e["type"] == "done" for e in job.events)
