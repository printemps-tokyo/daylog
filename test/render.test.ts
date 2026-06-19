import { describe, expect, it } from "vitest";
import { renderMarkdown, renderJson } from "../src/render.js";
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

describe("renderJson", () => {
  it("emits sorted activities with a local time field", () => {
    const parsed = JSON.parse(renderJson("2026-06-19", activities));
    expect(parsed.date).toBe("2026-06-19");
    expect(parsed.count).toBe(4);
    expect(parsed.activities[0]).toMatchObject({ source: "claude", time: "09:00" });
  });
});
