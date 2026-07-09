import { execa } from 'execa';

// Verify an external command is available in PATH, with a helpful hint if not.
export async function ensureCommand(cmd, versionArg, hint) {
  try {
    await execa(cmd, [versionArg]);
  } catch {
    throw new Error(`Command "${cmd}" not found in PATH. ${hint}`);
  }
}
