import { describe, expect, it } from "vitest";
import { renderMarkdown, renderJson, renderMarkdownMulti, renderJsonMulti } from "../src/render.js";
import { dayWindows, inWindow } from "../src/window.js";
import type { Activity } from "../src/types.js";

const at = (h: number, m = 0): number => new Date(2026, 5, 19, h, m, 0).getTime();

const activities: Activity[] = [
  { source: "git", ts: at(10), project: "web", title: "fix: bug", detail: "abc123def" },
  { source: "claude", ts: at(9), project: "web", title: "add a form" },
  { source: "claude", ts: at(11), project: "web", title: "add a form" },
  { source: "codex", ts: at(13), title: "refactor", detail: "sess1234" },
];

describe("renderMarkdown", () => {
  it("groups by source/project and folds repeats", () => {
    const md = renderMarkdown("2026-06-19", activities);
    expect(md).toContain("# 2026-06-19（金）daylog");
    expect(md).toContain("## git: web (1)");
    expect(md).toContain("- 10:00 fix: bug (abc123def)");
    expect(md).toContain("## Claude Code: web (2)");
    // Two identical prompts fold into one line tagged (x2) at the earliest time.
    expect(md).toContain("- 09:00 (x2) add a form");
    expect(md).toContain("## Codex (1)");
  });

  it("notes when there is no activity", () => {
    expect(renderMarkdown("2026-06-19", [])).toContain("_No activity recorded._");
  });
});

describe("renderMarkdownMulti", () => {
  const days = [
    { date: "2026-06-18", activities: [] as Activity[] },
    { date: "2026-06-19", activities },
    { date: "2026-06-20", activities: [activities[0]!] },
  ];

  it("concatenates per-day digests, skipping empty days, with a footer", () => {
    const md = renderMarkdownMulti(days);
    expect(md).not.toContain("2026-06-18");
    expect(md).toContain("# 2026-06-19（金）daylog");
    expect(md).toContain("# 2026-06-20（土）daylog");
    expect(md).toContain("_2 of 3 days had activity._");
    expect(md).not.toContain("_No activity recorded._");
  });

  it("keeps empty days when includeEmpty is set", () => {
    const md = renderMarkdownMulti(days, true);
    expect(md).toContain("# 2026-06-18（木）daylog");
    expect(md).toContain("_No activity recorded._");
    expect(md).toContain("_2 of 3 days had activity._");
  });

  it("counts a rollover-window event once across a two-day report", () => {
    // One commit at 02:00 on day 2 with --rollover 5: it belongs to day 1's
    // window only, so it must appear once and the footer must say 1 of 2.
    const dates = ["2026-06-19", "2026-06-20"];
    const commit: Activity = {
      source: "git",
      ts: new Date(2026, 5, 20, 2, 0, 0).getTime(),
      project: "web",
      title: "fix: late night",
    };
    const windows = dayWindows(dates, 5);
    const reports = dates.map((date, i) => ({
      date,
      activities: [commit].filter((a) => inWindow(a.ts, windows[i]!)),
    }));
    expect(reports[0]!.activities).toHaveLength(1);
    expect(reports[1]!.activities).toHaveLength(0);
    const md = renderMarkdownMulti(reports);
    expect(md.match(/fix: late night/g)).toHaveLength(1);
    expect(md).toContain("# 2026-06-19（金）daylog");
    expect(md).not.toContain("# 2026-06-20");
    expect(md).toContain("_1 of 2 days had activity._");
  });
});

describe("renderJsonMulti", () => {
  it("emits an array of per-day objects, skipping empty days", () => {
    const parsed = JSON.parse(
      renderJsonMulti([
        { date: "2026-06-18", activities: [] },
        { date: "2026-06-19", activities },
      ]),
    );
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ date: "2026-06-19", count: 4 });
  });
});

describe("renderJson", () => {
  it("emits sorted activities with a local time field", () => {
    const parsed = JSON.parse(renderJson("2026-06-19", activities));
    expect(parsed.date).toBe("2026-06-19");
    expect(parsed.count).toBe(4);
    expect(parsed.activities[0]).toMatchObject({ source: "claude", time: "09:00" });
  });
});
