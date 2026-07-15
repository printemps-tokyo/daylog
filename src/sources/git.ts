import type { Activity, Window } from "../types.js";
import { inWindow } from "../window.js";
import { maskSecrets, oneLine } from "../mask.js";

/** The `git log` pretty format daylog parses: hash, author-time, subject. */
export const GIT_LOG_FORMAT = "%H%x09%at%x09%s";

/**
 * Build the `git log` argv used to collect commits from one repository.
 * Each entry in `authors` becomes a `--author=<pattern>` flag; git ORs
 * repeated flags and matches each pattern as a regex over `Name <email>`.
 * An empty `authors` list means no filter (all authors).
 */
export function buildGitLogArgs(repo: string, since: string, until: string, authors: string[] = []): string[] {
  return [
    "-C",
    repo,
    "log",
    "--all",
    `--since=${since}`,
    `--until=${until}`,
    ...authors.map((author) => `--author=${author}`),
    `--pretty=${GIT_LOG_FORMAT}`,
  ];
}

/**
 * Parse `git log --pretty=GIT_LOG_FORMAT` output into activities, keeping only
 * commits inside `window`. Author time (`%at`) is in seconds; it is converted
 * to milliseconds. `project` labels every commit with its repository.
 */
export function parseGitLog(output: string, project: string, window: Window): Activity[] {
  const activities: Activity[] = [];
  for (const line of output.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    const [hash, atSecs, ...subjectParts] = line.split("\t");
    const seconds = Number(atSecs);
    if (!hash || !Number.isFinite(seconds)) {
      continue;
    }
    const ts = seconds * 1000;
    if (!inWindow(ts, window)) {
      continue;
    }
    activities.push({
      source: "git",
      ts,
      project,
      title: maskSecrets(oneLine(subjectParts.join("\t"))),
      detail: hash.slice(0, 9),
    });
  }
  return activities;
}
