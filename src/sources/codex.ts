import type { Activity, Window } from "../types.js";
import { inWindow } from "../window.js";
import { maskSecrets, oneLine } from "../mask.js";

/** One record in Codex's `~/.codex/history.jsonl`. */
interface CodexRecord {
  ts?: number;
  session_id?: string;
  text?: string;
}

/**
 * Parse Codex's `history.jsonl` into activities within `window`. Each line has
 * a `ts` in seconds (converted to milliseconds), a `session_id`, and the
 * prompt `text`. Malformed lines are skipped.
 */
export function parseCodexHistory(jsonl: string, window: Window): Activity[] {
  const activities: Activity[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    let record: CodexRecord;
    try {
      record = JSON.parse(trimmed) as CodexRecord;
    } catch {
      continue;
    }
    if (typeof record.ts !== "number") {
      continue;
    }
    const ts = record.ts * 1000;
    if (!inWindow(ts, window)) {
      continue;
    }
    const title = maskSecrets(oneLine(record.text ?? ""));
    if (title === "") {
      continue;
    }
    const detail = record.session_id ? record.session_id.slice(0, 8) : undefined;
    activities.push({ source: "codex", ts, title, detail });
  }
  return activities;
}
