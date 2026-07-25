"""Orchestration: compress/split oversized files, transcribe, stitch, save."""

import math
import shutil
import tempfile
from pathlib import Path

from .audio import convert_to_audio, get_duration, size_mb, split_audio
from .config import DEFAULT_LANGUAGE, DIRS, MIN_CHUNK_BYTES
from .engines import get_engine
from .formatting import render_output


def offset_segments(segments, offset):
    """Shift segment timings by ``offset`` seconds (used when stitching chunks
    so subtitle timestamps stay continuous across the whole recording)."""
    if not offset:
        return segments
    shifted = []
    for seg in segments:
        start, end = seg.get("start"), seg.get("end")
        if isinstance(start, (int, float)) and isinstance(end, (int, float)):
            shifted.append({**seg, "start": start + offset, "end": end + offset})
        else:
            shifted.append(seg)
    return shifted


def transcribe(audio_path, language, engine=None):
    """Transcribe a file, compressing/splitting as needed to fit the engine's
    size limit. Returns a flat list of segment dicts."""
    engine = engine or get_engine()
    print(f"🎤 Transcribing via {engine.label} (language: {language})...")

    audio_path = Path(audio_path)
    if size_mb(audio_path) <= engine.max_file_size_mb:
        return engine.transcribe_chunk(audio_path, language)

    print(
        f"⚠️  File is {size_mb(audio_path):.1f} MB "
        f"(over the {engine.max_file_size_mb} MB limit), compressing..."
    )
    # Isolated scratch dir so intermediates never touch input/ and parallel
    # scan jobs with matching basenames can't collide; removed on the way out.
    work_dir = Path(tempfile.mkdtemp(prefix="work-", dir=DIRS["downloads"]))

    try:
        compressed = convert_to_audio(audio_path, work_dir)
        compressed_mb = size_mb(compressed)
        print(f"✅ After compression: {compressed_mb:.1f} MB")

        if compressed_mb <= engine.max_file_size_mb:
            return engine.transcribe_chunk(compressed, language)

        duration = get_duration(compressed)
        if not math.isfinite(duration) or duration <= 0:
            raise RuntimeError("Could not determine audio duration — cannot split the file")

        num_chunks = math.ceil(compressed_mb / engine.max_file_size_mb)
        chunk_seconds = math.ceil(duration / num_chunks)
        print(
            f"✂️  Long recording ({round(duration / 60)} min) — "
            f"splitting into {num_chunks} parts of ~{round(chunk_seconds / 60)} min"
        )

        chunks = split_audio(compressed, chunk_seconds)
        real_count = sum(1 for f in chunks if f.stat().st_size > MIN_CHUNK_BYTES)

        segments = []
        offset = 0.0
        part = 0
        # Accumulate the offset over EVERY chunk (even skipped near-empty ones)
        # so subtitle timestamps stay aligned to the original timeline.
        for chunk in chunks:
            chunk_duration = get_duration(chunk)
            if chunk.stat().st_size > MIN_CHUNK_BYTES:
                part += 1
                print(f"   🎤 Part {part}/{real_count}...")
                chunk_segments = engine.transcribe_chunk(chunk, language)
                segments.extend(offset_segments(chunk_segments, offset))
            if math.isfinite(chunk_duration):
                offset += chunk_duration
        return segments
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def save_transcript(filename, segments, fmt="txt", output_dir=None):
    output_dir = Path(output_dir) if output_dir else DIRS["transcripts"]
    preview, data, _media_type = render_output(segments, fmt)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{filename}.{fmt}"

    out_path.write_bytes(data)
    print(f"\n✅ Saved: {out_path}\n")
    print(preview[:500] + ("..." if len(preview) > 500 else ""))
    return out_path


def process_file(audio_path, filename, language=None, fmt="txt", output_dir=None, engine=None):
    segments = transcribe(audio_path, language or DEFAULT_LANGUAGE, engine)
    return save_transcript(filename, segments, fmt, output_dir)
