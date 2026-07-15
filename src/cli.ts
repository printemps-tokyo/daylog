#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import {
  dayWindow,
  localDateString,
  parseGitLog,
  buildGitLogArgs,
  parseClaudeHistory,
  parseCodexHistory,
  renderJson,
  renderMarkdown,
  type Activity,
  type Window,
} from "./index.js";

const ALL_SOURCES = ["git", "claude", "codex"] as const;
type Source = (typeof ALL_SOURCES)[number];

const HELP = `daylog - aggregate a day of dev activity into a digest

Usage:
  daylog [date] [options]

Collects git commits and AI coding-tool (Claude Code, Codex) prompts for one
day and prints a Markdown or JSON digest. Fully offline. Secrets matching common
key/value shapes are masked automatically.

Arguments:
  date                    Day to report, YYYY-MM-DD (default: today, local time)

Options:
  --root <dir>            Directory to scan for git repos (repeatable; default: cwd)
  --depth <n>             Max scan depth for repos (default: 3)
  --rollover <hour>       Day ends at this hour next morning, 0..23 (default: 0)
  --author <pattern>      Only count commits whose author matches (repeatable;
                          git regex over "Name <email>"; default: all authors)
  --source <list>         Comma list of sources: git,claude,codex (default: all)
  --format <md|json>      Output format (default: md)
  --claude-history <file> Path to Claude history.jsonl (default: ~/.claude/history.jsonl)
  --codex-history <file>  Path to Codex history.jsonl (default: ~/.codex/history.jsonl)
  -o, --output <file>     Write to a file (default: stdout)
  -h, --help              Show this help
  -v, --version           Show version
`;

async function readVersion(): Promise<string> {
  const { fileURLToPath } = await import("node:url");
  const { dirname } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const raw = await readFile(join(here, "..", "package.json"), "utf8");
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

/** Find git repositories under `root`, up to `depth` levels deep. */
async function findRepos(root: string, depth: number): Promise<string[]> {
  const repos: string[] = [];
  const skip = new Set(["node_modules", ".next", ".nuxt", "dist", "target", ".obsidian"]);

  async function walk(dir: string, level: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === ".git")) {
      repos.push(dir);
      // Keep descending: a repo may contain nested repos (the `.git` directory
      // itself is skipped below because it starts with a dot).
    }
    if (level >= depth) {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !skip.has(entry.name)) {
        await walk(join(dir, entry.name), level + 1);
      }
    }
  }

  await walk(root, 0);
  return repos;
}

/** Collect git commits across every repo found under the given roots. */
async function collectGit(
  roots: string[],
  depth: number,
  window: Window,
  authors: string[] = [],
): Promise<Activity[]> {
  const since = `@${Math.floor(window.startMs / 1000) - 86_400}`;
  const until = `@${Math.floor(window.endMs / 1000) + 86_400}`;
  const seen = new Set<string>();
  const activities: Activity[] = [];

  for (const root of roots) {
    for (const repo of await findRepos(root, depth)) {
      if (seen.has(repo)) {
        continue;
      }
      seen.add(repo);
      let output = "";
      try {
        output = execFileSync("git", buildGitLogArgs(repo, since, until, authors), {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
      } catch {
        continue; // Not a git repo, or no matching commits.
      }
      activities.push(...parseGitLog(output, basename(repo), window));
    }
  }
  return activities;
}

async function readIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write((await readVersion()) + "\n");
    return 0;
  }

  let values;
  let positionals;
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        root: { type: "string", multiple: true },
        depth: { type: "string" },
        rollover: { type: "string" },
        author: { type: "string", multiple: true },
        source: { type: "string" },
        format: { type: "string" },
        "claude-history": { type: "string" },
        "codex-history": { type: "string" },
        output: { type: "string", short: "o" },
      },
    });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  const date = positionals[0] ?? localDateString(Date.now());
  const depth = values.depth ? Number(values.depth) : 3;
  const rollover = values.rollover ? Number(values.rollover) : 0;
  const format = values.format ?? "md";
  if (format !== "md" && format !== "json") {
    process.stderr.write(`error: --format must be md or json (got "${format}")\n`);
    return 1;
  }
  if (!Number.isInteger(depth) || depth < 0) {
    process.stderr.write(`error: --depth must be a non-negative integer\n`);
    return 1;
  }

  let sources: Source[] = [...ALL_SOURCES];
  if (values.source) {
    sources = values.source.split(",").map((s) => s.trim()) as Source[];
    const bad = sources.find((s) => !ALL_SOURCES.includes(s));
    if (bad) {
      process.stderr.write(`error: unknown source "${bad}" (use git,claude,codex)\n`);
      return 1;
    }
  }

  let window: Window;
  try {
    window = dayWindow(date, rollover);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  const roots = values.root && values.root.length > 0 ? values.root : [process.cwd()];
  const home = homedir();
  const activities: Activity[] = [];

  if (sources.includes("git")) {
    activities.push(...(await collectGit(roots, depth, window, values.author ?? [])));
  }
  if (sources.includes("claude")) {
    const path = values["claude-history"] ?? join(home, ".claude", "history.jsonl");
    activities.push(...parseClaudeHistory(await readIfExists(path), window));
  }
  if (sources.includes("codex")) {
    const path = values["codex-history"] ?? join(home, ".codex", "history.jsonl");
    activities.push(...parseCodexHistory(await readIfExists(path), window));
  }

  const output = format === "json" ? renderJson(date, activities) : renderMarkdown(date, activities);
  if (values.output) {
    try {
      await writeFile(values.output, output, "utf8");
    } catch (err) {
      process.stderr.write(`error: cannot write "${values.output}": ${(err as Error).message}\n`);
      return 1;
    }
    process.stderr.write(`daylog: wrote ${values.output} (${activities.length} activities)\n`);
  } else {
    process.stdout.write(output);
  }
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
