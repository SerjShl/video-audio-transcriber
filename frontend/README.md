# Transcriber — web UI

Vite + React + TypeScript + Tailwind, with [shadcn/ui](https://ui.shadcn.com)
components. Talks to the FastAPI backend in `../transcriber/server.py`.

## Develop

```bash
# terminal 1 — backend (from the repo root)
transcriber-server            # or: python -m transcriber.server

# terminal 2 — frontend dev server
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to :8000
```

## Build for production

```bash
npm run build                 # outputs to frontend/dist/
```

Once `frontend/dist/` exists, the FastAPI server serves it directly at
`http://127.0.0.1:8000`, so the whole app runs from a single process.
