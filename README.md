# daylog

> Aggregate a day of dev activity from git and AI coding-tool histories into a digest. Zero-dependency CLI.

[![CI](https://github.com/printemps-tokyo/daylog/actions/workflows/ci.yml/badge.svg)](https://github.com/printemps-tokyo/daylog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

`daylog` answers "what did I work on today?" by collecting your git commits and
your AI coding-tool prompts (Claude Code, Codex, Gemini CLI) for a single day and printing a
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

- Node.js >= 22
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
daylog --days 7 --author me --format md   # weekly report: the last 7 days, your commits only
daylog 2026-06-15..2026-06-19   # an explicit inclusive date range
daylog --week --summary         # this week (Monday to Sunday), as totals
daylog 2026-06 --summary        # a monthly report for June 2026
daylog --root ~/src --rollover 6   # scan ~/src; the day ends at 06:00 next morning
daylog --source git,claude      # only some sources
daylog --author me@example.com  # only your commits on shared repos (repeatable)
daylog --format json -o day.json   # machine-readable output to a file
```

| Option | Description | Default |
| --- | --- | --- |
| `[date]` | Day to report, `YYYY-MM-DD` | today (local) |
| `[FROM..TO]` | Inclusive date range, `YYYY-MM-DD..YYYY-MM-DD` | - |
| `[YYYY-MM]` | A whole calendar month | - |
| `--week` | The Monday-to-Sunday week containing `[date]` | off |
| `--summary` | For several days: totals per project and per day instead of every item | off |
| `--root <dir>` | Directory to scan for git repos (repeatable) | current directory |
| `--depth <n>` | Max scan depth for repositories | `3` |
| `--days <n>` | Report the `n` days ending at `[date]` (`n >= 1`) | `1` |
| `--include-empty` | Keep days with no activity in multi-day output | off |
| `--rollover <hour>` | Day ends at this hour the next morning (`0`..`23`) | `0` |
| `--author <pattern>` | Only count commits whose author matches (repeatable) | all authors |
| `--source <list>` | Comma list of `git`, `claude`, `codex`, `gemini` | all |
| `--format <md\|json>` | Output format | `md` |
| `--claude-history <file>` | Path to Claude Code `history.jsonl` | `~/.claude/history.jsonl` |
| `--codex-history <file>` | Path to Codex `history.jsonl` | `~/.codex/history.jsonl` |
| `--gemini-dir <dir>` | Gemini CLI's per-project logs | `~/.gemini/tmp` |
| `-o, --output <file>` | Write to a file | stdout |

### Multi-day reports

Pass `--days 7` for a weekly report: the last seven days ending at `[date]`
(today by default), each day rendered with its own heading. Or give an explicit
inclusive range such as `2026-06-15..2026-06-19`. Days with no activity are
skipped unless `--include-empty` is passed, and Markdown output ends with a
one-line `N of M days had activity` footer. With `--format json`, multi-day
output is an array of the usual per-day objects. `--author` applies across the
whole range. A report covers at most 366 days; a longer `--days` or range is
rejected with `date range too large: N days (max 366)` before any repo is
scanned.

Note that a one-day range such as `2026-06-19..2026-06-19` still uses the
multi-day output: with `--format json` it prints a one-element array, while
`--days 1` or a bare date keeps the single-object shape.

### Weekly and monthly summaries

`--summary` turns a multi-day report into totals: days with activity, the
number of commits and prompts per source, then a table per project (busiest
first, with the number of days it was worked on) and a table per day. Combine
it with `--week` (the Monday-to-Sunday week containing `[date]`, this week by
default), a month (`daylog 2026-06`), `--days N` or a `FROM..TO` range. With
`--format json` the same numbers come as one object. Prompt and commit texts
are not printed in a summary.

### Author filter

On shared repositories, `git log` sees everyone's commits. Pass `--author` one
or more times to keep only your own; multiple patterns are ORed. git matches
each pattern as a regular expression against the commit author in
`Name <email>` form, so `--author 'alice@example\.com'` and `--author Alice`
both work.

### Rollover

Late-night work usually belongs to the day it started. `--rollover 6` makes a
day run from midnight to 6:00 the next morning, so a commit at 01:30 still counts
toward the previous day. In a multi-day report the windows never overlap: each
day after the first starts at the rollover hour, so early-morning activity is
counted once, toward the day it started.

## Sources

- **git** - commits (author time) across every repository found under `--root`,
  including nested repositories, labelled by repository name.
- **Claude Code** - prompts from `~/.claude/history.jsonl`, grouped by project.
- **Codex** - prompts from `~/.codex/history.jsonl`.
- **Gemini CLI** - prompts from each project's `logs.json` under
  `~/.gemini/tmp` (entries of `type: "user"`). The project is the folder named
  in the log folder's `.project_root` marker, or the log folder's name when it
  is readable; older Gemini CLI versions name the folder by a hash of the
  path, so those prompts have no project.

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
