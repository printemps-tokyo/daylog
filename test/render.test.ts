import { describe, expect, it } from "vitest";
import { renderMarkdown, renderJson, renderMarkdownMulti, renderJsonMulti } from "../src/render.js";
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
