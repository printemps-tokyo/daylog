import type { Activity } from "./types.js";
import { weekdayJp } from "./window.js";

const SOURCE_ORDER: Activity["source"][] = ["git", "claude", "codex", "gemini"];
const SOURCE_LABEL: Record<Activity["source"], string> = {
  git: "git",
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
};

function timeHHMM(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Group {
  source: Activity["source"];
  project: string | undefined;
  items: Activity[];
}

/** Group activities by (source, project) and order them for display. */
function groupActivities(activities: Activity[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of activities) {
    const key = `${a.source}\u0000${a.project ?? ""}`;
    let group = map.get(key);
    if (!group) {
      group = { source: a.source, project: a.project, items: [] };
      map.set(key, group);
    }
    group.items.push(a);
  }
  const groups = [...map.values()];
  for (const g of groups) {
    g.items.sort((x, y) => x.ts - y.ts);
  }
  groups.sort(
    (a, b) =>
      SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source) ||
      b.items.length - a.items.length ||
      (a.project ?? "").localeCompare(b.project ?? ""),
  );
  return groups;
}

/** Fold runs of the same title into one line, keeping the earliest time. */
function foldItems(items: Activity[]): { ts: number; title: string; detail?: string; count: number }[] {
  const order: string[] = [];
  const byTitle = new Map<string, { ts: number; title: string; detail?: string; count: number }>();
  for (const item of items) {
    const existing = byTitle.get(item.title);
    if (existing) {
      existing.count += 1;
      existing.ts = Math.min(existing.ts, item.ts);
    } else {
      order.push(item.title);
      byTitle.set(item.title, { ts: item.ts, title: item.title, detail: item.detail, count: 1 });
    }
  }
  return order.map((t) => byTitle.get(t)!);
}

/** Render the activities for `date` as a Markdown digest. */
export function renderMarkdown(date: string, activities: Activity[]): string {
  const lines: string[] = [`# ${date}（${weekdayJp(date)}）daylog`, ""];
  if (activities.length === 0) {
    lines.push("_No activity recorded._");
    return lines.join("\n") + "\n";
  }
  for (const group of groupActivities(activities)) {
    const project = group.project ? `: ${group.project}` : "";
    lines.push(`## ${SOURCE_LABEL[group.source]}${project} (${group.items.length})`);
    for (const item of foldItems(group.items)) {
      const prefix = item.count > 1 ? `(x${item.count}) ` : "";
      const detail = item.count === 1 && item.detail ? ` (${item.detail})` : "";
      lines.push(`- ${timeHHMM(item.ts)} ${prefix}${item.title}${detail}`);
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

/** One day's collected activities, used by the multi-day renderers. */
export interface DayReport {
  date: string;
  activities: Activity[];
}

function dayJson(date: string, activities: Activity[]): Record<string, unknown> {
  const sorted = [...activities].sort((a, b) => a.ts - b.ts);
  return {
    date,
    weekday: weekdayJp(date),
    count: sorted.length,
    activities: sorted.map((a) => ({ ...a, time: timeHHMM(a.ts) })),
  };
}

/** Render the activities for `date` as JSON (sorted by time). */
export function renderJson(date: string, activities: Activity[]): string {
  return JSON.stringify(dayJson(date, activities), null, 2) + "\n";
}

/**
 * Render several days as concatenated per-day Markdown digests plus a one-line
 * summary footer. Days with no activity are skipped unless `includeEmpty`.
 */
export function renderMarkdownMulti(days: DayReport[], includeEmpty = false): string {
  const active = days.filter((d) => d.activities.length > 0);
  const shown = includeEmpty ? days : active;
  const parts = shown.map((d) => renderMarkdown(d.date, d.activities));
  parts.push(`_${active.length} of ${days.length} days had activity._\n`);
  return parts.join("\n");
}

/**
 * Render several days as a JSON array of per-day objects (same shape as the
 * single-day JSON). Days with no activity are skipped unless `includeEmpty`.
 */
export function renderJsonMulti(days: DayReport[], includeEmpty = false): string {
  const shown = includeEmpty ? days : days.filter((d) => d.activities.length > 0);
  return JSON.stringify(shown.map((d) => dayJson(d.date, d.activities)), null, 2) + "\n";
}

/** Counts for one period, one project, or one day. */
interface Tally {
  total: number;
  bySource: Record<Activity["source"], number>;
}

function emptyTally(): Tally {
  return { total: 0, bySource: { git: 0, claude: 0, codex: 0, gemini: 0 } };
}

function add(t: Tally, a: Activity): void {
  t.total += 1;
  t.bySource[a.source] += 1;
}

/** The numbers behind a weekly or monthly summary. */
export interface Summary {
  from: string;
  to: string;
  days: number;
  activeDays: number;
  totals: Tally;
  projects: { project: string; tally: Tally; days: number }[];
  perDay: { date: string; weekday: string; tally: Tally }[];
}

/** Aggregate several days: totals, per project (busiest first) and per day. */
export function summarize(days: DayReport[]): Summary {
  const totals = emptyTally();
  const projects = new Map<string, { tally: Tally; dates: Set<string> }>();
  const perDay = days.map((d) => {
    const tally = emptyTally();
    for (const a of d.activities) {
      add(tally, a);
      add(totals, a);
      const key = a.project ?? "(no project)";
      let p = projects.get(key);
      if (!p) {
        p = { tally: emptyTally(), dates: new Set() };
        projects.set(key, p);
      }
      add(p.tally, a);
      p.dates.add(d.date);
    }
    return { date: d.date, weekday: weekdayJp(d.date), tally };
  });
  return {
    from: days[0]?.date ?? "",
    to: days[days.length - 1]?.date ?? "",
    days: days.length,
    activeDays: perDay.filter((d) => d.tally.total > 0).length,
    totals,
    projects: [...projects.entries()]
      .map(([project, p]) => ({ project, tally: p.tally, days: p.dates.size }))
      .sort((a, b) => b.tally.total - a.tally.total || a.project.localeCompare(b.project)),
    perDay,
  };
}

function sourceCells(t: Tally): string {
  return SOURCE_ORDER.map((s) => String(t.bySource[s])).join(" | ");
}

/** A weekly or monthly report in Markdown: totals, then a table per project and per day. */
export function renderSummaryMarkdown(days: DayReport[]): string {
  const s = summarize(days);
  const header = `| ${SOURCE_ORDER.map((x) => SOURCE_LABEL[x]).join(" | ")} |`;
  const rule = `|${" --- |".repeat(SOURCE_ORDER.length)}`;
  const lines = [
    `# ${s.from}（${weekdayJp(s.from)}）..${s.to}（${weekdayJp(s.to)}）daylog summary`,
    "",
    `- Days with activity: ${s.activeDays} of ${s.days}`,
    `- Activities: ${s.totals.total} (${SOURCE_ORDER.map((x) => `${SOURCE_LABEL[x]} ${s.totals.bySource[x]}`).join(", ")})`,
    "",
  ];
  if (s.totals.total === 0) {
    lines.push("_No activity recorded._");
    return lines.join("\n") + "\n";
  }
  lines.push("## By project", "", `| Project | Days ${header}`, `| --- | --- ${rule}`);
  for (const p of s.projects) {
    lines.push(`| ${p.project.replace(/\|/g, "\\|")} | ${p.days} | ${sourceCells(p.tally)} |`);
  }
  lines.push("", "## By day", "", `| Date | Total ${header}`, `| --- | --- ${rule}`);
  for (const d of s.perDay) {
    lines.push(`| ${d.date}（${d.weekday}） | ${d.tally.total} | ${sourceCells(d.tally)} |`);
  }
  return lines.join("\n") + "\n";
}

/** The same summary as JSON. */
export function renderSummaryJson(days: DayReport[]): string {
  return JSON.stringify(summarize(days), null, 2) + "\n";
}
