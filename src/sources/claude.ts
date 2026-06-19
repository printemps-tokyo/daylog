import type { Activity, Window } from "../types.js";
import { inWindow } from "../window.js";
import { maskSecrets, oneLine } from "../mask.js";

/** One record in Claude Code's `~/.claude/history.jsonl`. */
interface ClaudeRecord {
  timestamp?: number;
  project?: string;
  display?: string;
}

/** Reduce a project path to its last path segment for display. */
function projectLabel(project: string | undefined): string | undefined {
  if (!project) {
    return undefined;
  }
  const parts = project.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : project;
}

/**
 * Parse Claude Code's `history.jsonl` into activities within `window`. Each
 * line is a JSON object with a millisecond `timestamp`, the `project` path, and
 * the `display` prompt text. Malformed lines are skipped.
 */
export function parseClaudeHistory(jsonl: string, window: Window): Activity[] {
  const activities: Activity[] = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    let record: ClaudeRecord;
    try {
      record = JSON.parse(trimmed) as ClaudeRecord;
    } catch {
      continue;
    }
    const ts = record.timestamp;
    if (typeof ts !== "number" || !inWindow(ts, window)) {
      continue;
    }
    const title = maskSecrets(oneLine(record.display ?? ""));
    if (title === "") {
      continue;
    }
    activities.push({ source: "claude", ts, project: projectLabel(record.project), title });
  }
  return activities;
}
