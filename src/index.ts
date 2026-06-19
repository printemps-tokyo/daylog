/**
 * Public API for daylog.
 *
 * `daylog` aggregates a single day of development activity from local sources
 * (git commits and AI coding-tool histories) into a Markdown or JSON digest.
 * It is fully offline: it reads local files and runs `git`, and never calls a
 * network service. Every parser and renderer here is a pure function.
 */

export type { Activity, Window } from "./types.js";

export { parseDate, dayWindow, localDateString, weekdayJp, inWindow } from "./window.js";
export { maskSecrets, oneLine } from "./mask.js";

export { parseGitLog, GIT_LOG_FORMAT } from "./sources/git.js";
export { parseClaudeHistory } from "./sources/claude.js";
export { parseCodexHistory } from "./sources/codex.js";

export { renderMarkdown, renderJson } from "./render.js";
