import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dayWindow,
  monthDates,
  parseGeminiLogs,
  readGeminiLogs,
  renderSummaryMarkdown,
  summarize,
  weekOf,
  type Activity,
} from "../src/index.js";

describe("week and month", () => {
  it("takes the Monday-to-Sunday week around a date", () => {
    // 2026-11-12 is a Thursday.
    expect(weekOf("2026-11-12")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(weekOf("2026-11-15")[0]).toBe("2026-11-09");
    expect(weekOf("2026-11-16")[0]).toBe("2026-11-16");
  });

  it("takes a whole month, leap years included", () => {
    expect(monthDates("2028-02")).toHaveLength(29);
    expect(monthDates("2026-12").at(-1)).toBe("2026-12-31");
    expect(() => monthDates("2026-13")).toThrow(/invalid month/);
  });
});

describe("Gemini CLI logs", () => {
  const window = dayWindow("2026-11-12");
  const at = (h: number) => new Date(2026, 10, 12, h, 0).toISOString();

  it("reads the user's prompts in the window", () => {
    const json = JSON.stringify([
      { sessionId: "abcdef123456", messageId: 0, timestamp: at(10), type: "user", message: "fix the  build\nplease" },
      { sessionId: "abcdef123456", messageId: 1, timestamp: at(11), type: "model", message: "not a prompt" },
      { sessionId: "x", messageId: 2, timestamp: "2026-11-11T00:00:00Z", type: "user", message: "a day early" },
      { sessionId: "x", messageId: 3, timestamp: at(12), type: "user", message: "token=sk-abcdefghijklmnopqrstuvwxyz123456" },
    ]);
    const acts = parseGeminiLogs(json, window, "daylog");
    expect(acts.map((a) => a.title)).toEqual(["fix the build please", expect.not.stringContaining("sk-abcdefghij")]);
    expect(acts[0]).toMatchObject({ source: "gemini", project: "daylog", detail: "abcdef12" });
  });

  it("ignores a file that is not a log", () => {
    expect(parseGeminiLogs("{", window)).toEqual([]);
    expect(parseGeminiLogs('{"a":1}', window)).toEqual([]);
  });

  it("finds each project's log and names the project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "daylog-gemini-"));
    try {
      const log = JSON.stringify([{ sessionId: "s", messageId: 0, timestamp: at(9), type: "user", message: "hi" }]);
      await mkdir(join(dir, "slug-name"));
      await writeFile(join(dir, "slug-name", "logs.json"), log);
      await writeFile(join(dir, "slug-name", ".project_root"), "/work/real-project\n");
      const hash = "a".repeat(64);
      await mkdir(join(dir, hash));
      await writeFile(join(dir, hash, "logs.json"), log);
      await mkdir(join(dir, "plain"));
      await writeFile(join(dir, "plain", "logs.json"), log);
      await mkdir(join(dir, "empty"));
      const logs = await readGeminiLogs(dir);
      expect(logs.map((l) => l.project)).toEqual([undefined, "plain", "real-project"]);
      expect(await readGeminiLogs(join(dir, "missing"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("summary", () => {
  const act = (source: Activity["source"], project: string | undefined, h: number): Activity => ({
    source,
    project,
    ts: new Date(2026, 10, 9, h).getTime(),
    title: "x",
  });
  const days = [
    { date: "2026-11-09", activities: [act("git", "a", 9), act("git", "a", 10), act("claude", "b", 11)] },
    { date: "2026-11-10", activities: [] },
    { date: "2026-11-11", activities: [act("gemini", undefined, 9), act("git", "a", 12)] },
  ];

  it("counts per project and per day", () => {
    const s = summarize(days);
    expect(s).toMatchObject({ from: "2026-11-09", to: "2026-11-11", days: 3, activeDays: 2 });
    expect(s.totals.bySource).toEqual({ git: 3, claude: 1, codex: 0, gemini: 1 });
    expect(s.projects.map((p) => [p.project, p.tally.total, p.days])).toEqual([
      ["a", 3, 2],
      ["(no project)", 1, 1],
      ["b", 1, 1],
    ]);
    expect(s.perDay.map((d) => d.tally.total)).toEqual([3, 0, 2]);
  });

  it("renders tables", () => {
    const md = renderSummaryMarkdown(days);
    expect(md).toContain("- Days with activity: 2 of 3");
    expect(md).toContain("| Project | Days | git | Claude Code | Codex | Gemini CLI |");
    expect(md).toContain("| a | 2 | 3 | 0 | 0 | 0 |");
    expect(md).toContain("| 2026-11-10（火） | 0 | 0 | 0 | 0 | 0 |");
  });
});
