import type { Strings } from "@/i18n";

export function deriveStage(logs: string[], t: Strings): string {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i].toLowerCase();
    const part = line.match(/part\s+(\d+)\/(\d+)/);
    if (part) return t.statusPart.replace("{n}", part[1]).replace("{total}", part[2]);
    if (line.includes("transcrib") || line.includes("🎤")) return t.statusTranscribing;
    if (line.includes("loading local model") || line.includes("📦")) return t.statusModel;
    if (line.includes("compress")) return t.statusCompressing;
    if (line.includes("split")) return t.statusSplitting;
    if (line.includes("download") || line.includes("⬇")) return t.statusDownloading;
  }
  return t.statusPreparing;
}
