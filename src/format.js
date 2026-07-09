import { PARAGRAPH_MIN_CHARS } from './config.js';

// Group Whisper segments into readable paragraphs. A paragraph closes once it
// reaches a minimum length AND the current segment ends on sentence punctuation,
// which avoids breaking on abbreviations or numbers.
export function formatTranscript(segments) {
  const paragraphs = [];
  let current = '';

  for (const seg of segments) {
    const piece = (seg.text || '').trim();
    if (!piece) continue;

    current = current ? `${current} ${piece}` : piece;

    if (current.length >= PARAGRAPH_MIN_CHARS && /[.!?…]$/.test(piece)) {
      paragraphs.push(current);
      current = '';
    }
  }

  if (current) paragraphs.push(current);
  return paragraphs.join('\n\n');
}

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

// Format a duration in seconds as HH:MM:SS<sep>mmm (sep is "," for SRT, "." for VTT).
export function formatTimestamp(totalSeconds, sep = ',') {
  const ms = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  const millis = ms % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${sep}${pad(millis, 3)}`;
}

function timedSegments(segments) {
  return segments.filter(
    s => Number.isFinite(s.start) && Number.isFinite(s.end) && (s.text || '').trim()
  );
}

// Render subtitle cues. Throws if the segments carry no timing information
// (e.g. the API returned plain text only) — subtitles need timestamps.
export function toSRT(segments) {
  const cues = timedSegments(segments);
  if (!cues.length) {
    throw new Error('No timestamps available — subtitles require verbose output');
  }
  return cues
    .map((s, i) =>
      `${i + 1}\n${formatTimestamp(s.start, ',')} --> ${formatTimestamp(s.end, ',')}\n${s.text.trim()}\n`
    )
    .join('\n');
}

export function toVTT(segments) {
  const cues = timedSegments(segments);
  if (!cues.length) {
    throw new Error('No timestamps available — subtitles require verbose output');
  }
  const body = cues
    .map(s => `${formatTimestamp(s.start, '.')} --> ${formatTimestamp(s.end, '.')}\n${s.text.trim()}\n`)
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

// Render segments into the requested output format.
export function renderTranscript(segments, format = 'txt') {
  switch (format) {
    case 'srt':
      return toSRT(segments);
    case 'vtt':
      return toVTT(segments);
    case 'txt':
      return formatTranscript(segments);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}
