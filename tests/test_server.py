import pytest

from transcriber.server import safe_basename

fastapi = pytest.importorskip("fastapi")


def test_safe_basename_strips_paths_and_unsafe_chars():
    assert safe_basename("../../etc/passwd") == "passwd"
    assert safe_basename("my clip!.mp4") == "my clip_.mp4"
    assert safe_basename("") == "upload"
    assert safe_basename(None) == "upload"


@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient

    import transcriber.server as server

    class DummyEngine:
        name = "groq"
        label = "Dummy"
        max_file_size_mb = float("inf")

        def ensure_ready(self):
            return None

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


def test_create_job_requires_input(client):
    assert client.post("/api/jobs", data={"format": "txt"}).status_code == 400


def test_unknown_job_events_404(client):
    assert client.get("/api/jobs/nope/events").status_code == 404


def test_run_job_produces_a_done_result(monkeypatch, tmp_path):
    # Exercise the job machinery directly with asyncio — TestClient tears down
    # the request's event loop before a background task can finish, so the SSE
    # flow can't be driven through it reliably.
    import asyncio

    import transcriber.server as server

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
