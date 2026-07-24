import * as groq from './groq.js';
import * as local from './local.js';
import { DEFAULT_ENGINE } from '../config.js';

const ENGINES = { groq, local };

export const ENGINE_NAMES = Object.keys(ENGINES);

// Resolve a transcription engine by name. Every engine exposes the same shape:
// { name, label, maxFileSizeMB, ensureReady(), transcribeChunk(path, lang) }.
export function getEngine(name = DEFAULT_ENGINE) {
  const engine = ENGINES[name];
  if (!engine) {
    throw new Error(`Unknown engine "${name}". Use one of: ${ENGINE_NAMES.join(', ')}`);
  }
  return engine;
}
