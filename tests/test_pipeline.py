from backend.pipeline import offset_segments


def test_offset_segments_returns_input_for_zero_offset():
    segs = [{"start": 0, "end": 1, "text": "a"}]
    assert offset_segments(segs, 0) is segs


def test_offset_segments_shifts_start_and_end():
    out = offset_segments(
        [{"start": 0, "end": 1.5, "text": "a"}, {"start": 1.5, "end": 2, "text": "b"}], 10
    )
    assert out == [
        {"start": 10, "end": 11.5, "text": "a"},
        {"start": 11.5, "end": 12, "text": "b"},
    ]


def test_offset_segments_leaves_untimed_segments_untouched():
    out = offset_segments([{"text": "no timing"}, {"start": 1, "end": 2, "text": "timed"}], 5)
    assert out == [{"text": "no timing"}, {"start": 6, "end": 7, "text": "timed"}]


def test_offset_segments_does_not_mutate_original():
    original = [{"start": 1, "end": 2, "text": "a"}]
    offset_segments(original, 3)
    assert original == [{"start": 1, "end": 2, "text": "a"}]
