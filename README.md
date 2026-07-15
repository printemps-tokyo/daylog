# daylog

> Aggregate a day of dev activity from git and AI coding-tool histories into a digest. Zero-dependency CLI.

[![CI](https://github.com/printemps-tokyo/daylog/actions/workflows/ci.yml/badge.svg)](https://github.com/printemps-tokyo/daylog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

`daylog` answers "what did I work on today?" by collecting your git commits and
your AI coding-tool prompts (Claude Code, Codex) for a single day and printing a
tidy Markdown or JSON digest. It is perfect for a daily standup, a progress
report, or the first draft of a changelog.

```console
$ daylog
# 2026-06-19（金）daylog

## git: api (3)
- 10:14 fix: handle empty upload (a1b2c3d4e)
- 11:02 feat: add rate limit (f5e6d7c8b)

## Claude Code: web (4)
- 09:30 (x2) add a login form
- 13:11 refactor the router
```

It is fully offline: it reads local files and runs `git`, and never calls a
network service.

## Why

If you use git plus one or more AI coding assistants, the record of your day is
scattered across `~/.claude`, `~/.codex`, and a dozen repositories. `daylog`
stitches those local trails into one chronological digest so you can report your
work without trying to remember it.

## Requirements

- Node.js >= 20
- `git` on your `PATH` (for the git source)

## Install

Not published to npm yet — install from source:

```bash
git clone https://github.com/printemps-tokyo/daylog
cd daylog
npm install && npm run build
npm link   # optional: puts the `daylog` command on your PATH
```

Then run `daylog …` (after `npm link`), or `node dist/cli.js …` from the clone.

## Usage

```bash
daylog                          # today, scanning the current directory for repos
daylog 2026-06-19               # a specific day
daylog --root ~/src --rollover 6   # scan ~/src; the day ends at 06:00 next morning
daylog --source git,claude      # only some sources
daylog --author me@example.com  # only your commits on shared repos (repeatable)
daylog --format json -o day.json   # machine-readable output to a file
```

| Option | Description | Default |
| --- | --- | --- |
| `[date]` | Day to report, `YYYY-MM-DD` | today (local) |
| `--root <dir>` | Directory to scan for git repos (repeatable) | current directory |
| `--depth <n>` | Max scan depth for repositories | `3` |
| `--rollover <hour>` | Day ends at this hour the next morning (`0`..`23`) | `0` |
| `--author <pattern>` | Only count commits whose author matches (repeatable) | all authors |
| `--source <list>` | Comma list of `git`, `claude`, `codex` | all |
| `--format <md\|json>` | Output format | `md` |
| `--claude-history <file>` | Path to Claude Code `history.jsonl` | `~/.claude/history.jsonl` |
| `--codex-history <file>` | Path to Codex `history.jsonl` | `~/.codex/history.jsonl` |
| `-o, --output <file>` | Write to a file | stdout |

### Author filter

On shared repositories, `git log` sees everyone's commits. Pass `--author` one
or more times to keep only your own; multiple patterns are ORed. git matches
each pattern as a regular expression against the commit author in
`Name <email>` form, so `--author 'alice@example\.com'` and `--author Alice`
both work.

### Rollover

Late-night work usually belongs to the day it started. `--rollover 6` makes a
day run from midnight to 6:00 the next morning, so a commit at 01:30 still counts
toward the previous day.

## Sources

- **git** - commits (author time) across every repository found under `--root`,
  including nested repositories, labelled by repository name.
- **Claude Code** - prompts from `~/.claude/history.jsonl`, grouped by project.
- **Codex** - prompts from `~/.codex/history.jsonl`.

Repeated identical entries are folded into one line tagged `(xN)`.

## Privacy and secrets

Everything runs locally; no data is sent anywhere. Text that matches common
secret shapes (`password:`, `api_key=`, `token: ...`) is masked as `[masked]`
before output. This is a best-effort safety net, not a guarantee, so keep real
secrets out of commit messages and prompts in the first place.

## Programmatic API

```ts
import { dayWindow, parseClaudeHistory, renderMarkdown } from "@printemps-tokyo/daylog";

const window = dayWindow("2026-06-19", 6);
const activities = parseClaudeHistory(historyJsonl, window);
const digest = renderMarkdown("2026-06-19", activities);
```

The parsers and renderers are pure functions over `Activity` objects
(`{ source, ts, project?, title, detail? }`).

## License

[MIT](./LICENSE) (c) printemps.tokyo
