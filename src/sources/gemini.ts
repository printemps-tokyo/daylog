import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Activity, Window } from "../types.js";
import { inWindow } from "../window.js";
import { maskSecrets, oneLine } from "../mask.js";

/** One entry in a Gemini CLI `logs.json` (an array of the user's prompts). */
interface GeminiEntry {
  sessionId?: string;
  timestamp?: string;
  type?: string;
  message?: string;
}

/**
 * Parse one Gemini CLI `logs.json` into activities within `window`. The file
 * is a JSON array of `{ sessionId, messageId, timestamp, type, message }`,
 * with an ISO timestamp; only `type: "user"` entries are prompts. A file that
 * is not such an array yields nothing.
 */
export function parseGeminiLogs(json: string, window: Window, project?: string): Activity[] {
  let entries: unknown;
  try {
    entries = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(entries)) return [];
  const activities: Activity[] = [];
  for (const raw of entries as GeminiEntry[]) {
    if (typeof raw !== "object" || raw === null || raw.type !== "user") continue;
    const ts = Date.parse(raw.timestamp ?? "");
    if (!Number.isFinite(ts) || !inWindow(ts, window)) continue;
    const title = maskSecrets(oneLine(raw.message ?? ""));
    if (title === "") continue;
    const detail = typeof raw.sessionId === "string" ? raw.sessionId.slice(0, 8) : undefined;
    activities.push({ source: "gemini", ts, title, detail, ...(project ? { project } : {}) });
  }
  return activities;
}

/** A Gemini CLI project log: its text and the project it belongs to, when known. */
export interface GeminiLog {
  text: string;
  project?: string;
}

/**
 * Read every `<dir>/<project>/logs.json` under Gemini CLI's temp directory
 * (`~/.gemini/tmp`). The project is the folder named in its `.project_root`
 * marker, or else the folder's own name when it is a readable slug (older
 * versions name the folder by a hash of the path, which says nothing).
 */
export async function readGeminiLogs(dir: string): Promise<GeminiLog[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const logs: GeminiLog[] = [];
  for (const name of names.sort()) {
    let text: string;
    try {
      text = await readFile(join(dir, name, "logs.json"), "utf8");
    } catch {
      continue;
    }
    let project: string | undefined;
    try {
      const root = (await readFile(join(dir, name, ".project_root"), "utf8")).trim();
      if (root !== "") project = basename(root);
    } catch {
      if (!/^[0-9a-f]{64}$/.test(name)) project = name;
    }
    logs.push({ text, project });
  }
  return logs;
}
