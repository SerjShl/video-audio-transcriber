from transcriber.cli import parse_args


def test_parse_args_reads_positionals():
    opts = parse_args(["video.mp4", "en"])
    assert opts.input == "video.mp4"
    assert opts.language == "en"
    assert opts.format == "txt"


def test_parse_args_defaults_language_to_ru():
    opts = parse_args(["scan"])
    assert opts.input == "scan"
    assert opts.language == "ru"


def test_parse_args_accepts_format_in_both_styles():
    assert parse_args(["a.mp4", "en", "--format", "srt"]).format == "srt"
    assert parse_args(["a.mp4", "en", "--format=vtt"]).format == "vtt"
    assert parse_args(["a.mp4", "-f", "SRT"]).format == "srt"  # lower-cased


def test_parse_args_collects_flags_and_output_dir():
    opts = parse_args(["url", "en", "--keep", "--out", "./subs"])
    assert opts.keep is True
    assert opts.out == "./subs"
    assert opts.input == "url"
    assert opts.language == "en"


def test_parse_args_reads_engine():
    assert parse_args(["a.mp4", "--engine", "local"]).engine == "local"
    assert parse_args(["a.mp4", "-e", "groq"]).engine == "groq"


def test_parse_args_recognizes_interactive():
    assert parse_args(["-i"]).interactive is True
