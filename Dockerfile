# syntax=docker/dockerfile:1

# --- Stage 1: build the React frontend -------------------------------------
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build            # -> /app/frontend/dist

# --- Stage 2: Python runtime -----------------------------------------------
FROM python:3.12-slim AS runtime

# ffmpeg ships ffprobe too (convert/split audio); fonts-dejavu-core gives a
# Unicode TTF so PDF exports render Cyrillic.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the backend (cloud engine + web server). yt-dlp is added as a CLI so
# URL downloads work; the offline "local" engine is intentionally left out — it
# needs ~1 GB of model and far more RAM than a free tier provides.
COPY pyproject.toml README.md ./
COPY backend/ ./backend/
RUN pip install --no-cache-dir ".[server]" yt-dlp

# The built UI, at the path the server serves from (ROOT/frontend/dist).
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV HOST=0.0.0.0 \
    PORT=8000 \
    TRANSCRIBER_ENGINE=groq

EXPOSE 8000

# Render (and most PaaS) inject their own $PORT; the server reads it.
CMD ["python", "-m", "backend.server"]
