import json

import pytest

from backend.formatting import (
    format_timestamp,
    format_transcript,
    render_transcript,
    to_json,
    to_srt,
    to_vtt,
)

SEGMENTS = [
    {"start": 0, "end": 1.5, "text": "First line."},
    {"start": 1.5, "end": 3, "text": "Second line."},
]


def test_format_transcript_joins_short_segments():
    out = format_transcript([{"text": "Hello."}, {"text": "World."}])
    assert out == "Hello. World."


def test_format_transcript_breaks_on_sentence_end_past_min_length():
    long = "a" * 300 + "."
    out = format_transcript([{"text": long}, {"text": "Next sentence."}])
    assert out == f"{long}\n\nNext sentence."


def test_format_transcript_does_not_break_mid_sentence():
    long = ("word " * 80).strip()  # > 280 chars, no ending punctuation
    out = format_transcript([{"text": long}, {"text": "tail."}])
    assert out == f"{long} tail."


def test_format_transcript_ignores_empty_segments():
    out = format_transcript([{"text": "  "}, {"text": "Only this."}, {}])
    assert out == "Only this."


def test_format_timestamp_separators():
    assert format_timestamp(3661.5, ",") == "01:01:01,500"
    assert format_timestamp(3661.5, ".") == "01:01:01.500"
    assert format_timestamp(0, ",") == "00:00:00,000"


def test_to_srt_numbers_cues_with_comma_milliseconds():
    srt = to_srt(SEGMENTS)
    assert srt.startswith("1\n00:00:00,000 --> 00:00:01,500\nFirst line.")
    assert "2\n00:00:01,500 --> 00:00:03,000\nSecond line." in srt


def test_to_vtt_header_and_dot_milliseconds():
    vtt = to_vtt(SEGMENTS)
    assert vtt.startswith("WEBVTT\n\n")
    assert "00:00:00.000 --> 00:00:01.500" in vtt


def test_subtitles_raise_without_timing():
    with pytest.raises(ValueError, match="No timestamps"):
        to_srt([{"text": "no timing"}])
    with pytest.raises(ValueError, match="No timestamps"):
        to_vtt([{"text": "no timing"}])


def test_to_json_emits_segment_timings():
    payload = json.loads(to_json(SEGMENTS))
    assert payload == [
        {"start": 0, "end": 1.5, "text": "First line."},
        {"start": 1.5, "end": 3, "text": "Second line."},
    ]


def test_render_transcript_dispatches_and_rejects_unknown():
    assert render_transcript([{"text": "Hi."}], "txt") == "Hi."
    assert "-->" in render_transcript(SEGMENTS, "srt")
    assert json.loads(render_transcript(SEGMENTS, "json"))
    with pytest.raises(ValueError, match="Unknown output format"):
        render_transcript(SEGMENTS, "doc")
