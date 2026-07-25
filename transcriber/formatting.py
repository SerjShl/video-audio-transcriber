"""Render Whisper segments into txt / srt / vtt / json.

A *segment* is a plain dict ``{"start": float|None, "end": float|None,
"text": str}``. ``start``/``end`` are seconds; they may be ``None`` when the
engine returned plain text without timing.
"""

import json
import math
import re

from .config import PARAGRAPH_MIN_CHARS

_SENTENCE_END = re.compile(r"[.!?…]$")


def format_transcript(segments):
    """Group segments into readable paragraphs.

    A paragraph closes once it reaches ``PARAGRAPH_MIN_CHARS`` *and* the current
    piece ends on sentence punctuation — avoiding breaks on abbreviations or
    numbers mid-sentence.
    """
    paragraphs = []
    current = ""

    for seg in segments:
        piece = (seg.get("text") or "").strip()
        if not piece:
            continue

        current = f"{current} {piece}" if current else piece

        if len(current) >= PARAGRAPH_MIN_CHARS and _SENTENCE_END.search(piece):
            paragraphs.append(current)
            current = ""

    if current:
        paragraphs.append(current)
    return "\n\n".join(paragraphs)


def _pad(value, length=2):
    return str(value).zfill(length)


def format_timestamp(total_seconds, sep=","):
    """Format seconds as ``HH:MM:SS<sep>mmm`` (``,`` for SRT, ``.`` for VTT)."""
    # floor(x + 0.5) matches JavaScript's Math.round (half rounds up).
    ms = max(0, math.floor(total_seconds * 1000 + 0.5))
    hours = ms // 3_600_000
    minutes = (ms % 3_600_000) // 60_000
    seconds = (ms % 60_000) // 1000
    millis = ms % 1000
    return f"{_pad(hours)}:{_pad(minutes)}:{_pad(seconds)}{sep}{_pad(millis, 3)}"


def _timed_segments(segments):
    result = []
    for seg in segments:
        start, end = seg.get("start"), seg.get("end")
        text = (seg.get("text") or "").strip()
        if (
            isinstance(start, (int, float))
            and isinstance(end, (int, float))
            and math.isfinite(start)
            and math.isfinite(end)
            and text
        ):
            result.append(seg)
    return result


def to_srt(segments):
    cues = _timed_segments(segments)
    if not cues:
        raise ValueError("No timestamps available — subtitles require verbose output")
    return "\n".join(
        f"{i + 1}\n"
        f"{format_timestamp(s['start'], ',')} --> {format_timestamp(s['end'], ',')}\n"
        f"{s['text'].strip()}\n"
        for i, s in enumerate(cues)
    )


def to_vtt(segments):
    cues = _timed_segments(segments)
    if not cues:
        raise ValueError("No timestamps available — subtitles require verbose output")
    body = "\n".join(
        f"{format_timestamp(s['start'], '.')} --> {format_timestamp(s['end'], '.')}\n"
        f"{s['text'].strip()}\n"
        for s in cues
    )
    return f"WEBVTT\n\n{body}"


def to_json(segments):
    """Segment-level JSON with timings — useful for downstream tooling."""
    payload = [
        {"start": s.get("start"), "end": s.get("end"), "text": (s.get("text") or "").strip()}
        for s in segments
        if (s.get("text") or "").strip()
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)


def render_transcript(segments, fmt="txt"):
    renderers = {
        "txt": format_transcript,
        "srt": to_srt,
        "vtt": to_vtt,
        "json": to_json,
    }
    if fmt not in renderers:
        raise ValueError(f"Unknown output format: {fmt}")
    return renderers[fmt](segments)
