"""Render Whisper segments into txt / srt / vtt / json / docx / pdf.

A *segment* is a plain dict ``{"start": float|None, "end": float|None,
"text": str}``. ``start``/``end`` are seconds; they may be ``None`` when the
engine returned plain text without timing.

Text formats return a ``str``; the document formats (docx, pdf) return ``bytes``.
``render_output`` is the unified entry point: it returns a human-readable text
preview plus the file bytes and media type, so callers can both show and save.
"""

import json
import math
import os
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


# --- document formats (binary) ---------------------------------------------
def to_docx(text) -> bytes:
    """Render the readable transcript as a .docx document."""
    try:
        from docx import Document
    except ImportError as error:  # pragma: no cover - depends on optional extra
        raise RuntimeError(
            'DOCX output needs python-docx. Install it with: pip install ".[server]"'
        ) from error
    from io import BytesIO

    doc = Document()
    for paragraph in text.split("\n\n"):
        doc.add_paragraph(paragraph)
    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def _unicode_font_path():
    """Find a Unicode TTF so PDFs render Cyrillic (fpdf's core fonts can't)."""
    candidates = [
        os.environ.get("PDF_FONT"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Debian/Docker
        "C:/Windows/Fonts/segoeui.ttf",                     # Windows
        "C:/Windows/Fonts/arial.ttf",                       # Windows
        "/Library/Fonts/Arial Unicode.ttf",                 # macOS
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def to_pdf(text) -> bytes:
    """Render the readable transcript as a PDF (Unicode font embedded)."""
    try:
        from fpdf import FPDF
    except ImportError as error:  # pragma: no cover - depends on optional extra
        raise RuntimeError(
            'PDF output needs fpdf2. Install it with: pip install ".[server]"'
        ) from error

    font_path = _unicode_font_path()
    if not font_path:
        raise RuntimeError(
            "No Unicode TTF font found for PDF output. Set the PDF_FONT env var to "
            "a .ttf path (e.g. DejaVuSans.ttf)."
        )

    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_font("uni", "", font_path)
    pdf.set_font("uni", size=12)
    for paragraph in text.split("\n\n"):
        pdf.multi_cell(0, 7, paragraph)
        pdf.ln(4)
    return bytes(pdf.output())


_MEDIA_TYPES = {
    "txt": "text/plain; charset=utf-8",
    "srt": "application/x-subrip; charset=utf-8",
    "vtt": "text/vtt; charset=utf-8",
    "json": "application/json; charset=utf-8",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf": "application/pdf",
}


def render_output(segments, fmt="txt"):
    """Return ``(preview_text, data_bytes, media_type)`` for any format.

    ``preview_text`` is always human-readable (used for on-screen display and
    copy); ``data_bytes`` is the exact file to save/download.
    """
    fmt = (fmt or "txt").lower()
    if fmt not in _MEDIA_TYPES:
        raise ValueError(f"Unknown output format: {fmt}")

    if fmt in ("txt", "srt", "vtt", "json"):
        text = render_transcript(segments, fmt)
        return text, text.encode("utf-8"), _MEDIA_TYPES[fmt]

    # docx / pdf: a readable paragraph transcript wrapped in a document.
    preview = format_transcript(segments)
    data = to_docx(preview) if fmt == "docx" else to_pdf(preview)
    return preview, data, _MEDIA_TYPES[fmt]
