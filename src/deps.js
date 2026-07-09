import { execa } from 'execa';

export async function ensureCommand(cmd, versionArg, hint) {
  try {
    await execa(cmd, [versionArg]);
  } catch {
    throw new Error(`Command "${cmd}" not found in PATH. ${hint}`);
  }
}
