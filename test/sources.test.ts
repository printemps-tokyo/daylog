import { describe, expect, it } from "vitest";
import { parseGitLog } from "../src/sources/git.js";
import { parseClaudeHistory } from "../src/sources/claude.js";
import { parseCodexHistory } from "../src/sources/codex.js";

// A window covering 2026-06-19 (local) in epoch ms.
const window = {
  startMs: new Date(2026, 5, 19, 0, 0, 0).getTime(),
  endMs: new Date(2026, 5, 20, 0, 0, 0).getTime(),
};
const at = (h: number): number => new Date(2026, 5, 19, h, 0, 0).getTime();

describe("parseGitLog", () => {
  it("parses tab-separated commits and filters by window", () => {
    const inside = Math.floor(at(10) / 1000);
    const outside = Math.floor(new Date(2026, 5, 18, 10).getTime() / 1000);
    const log = [
      `abcdef1234567890\t${inside}\tfix: bug`,
      `0987654321fedcba\t${outside}\tchore: old commit`,
      "",
    ].join("\n");
    const acts = parseGitLog(log, "myrepo", window);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ source: "git", project: "myrepo", title: "fix: bug", detail: "abcdef123" });
  });

  it("masks secrets in commit subjects", () => {
    const log = `aaaaaaaaaaaa\t${Math.floor(at(9) / 1000)}\tadd token=abc123secret`;
    expect(parseGitLog(log, "r", window)[0]?.title).toBe("add token=[masked]");
  });
});

describe("parseClaudeHistory", () => {
  it("keeps in-window records and shortens the project path", () => {
    const jsonl = [
      JSON.stringify({ timestamp: at(11), project: "/Users/me/srv/projects/web", display: "add a login form" }),
      JSON.stringify({ timestamp: new Date(2026, 5, 18, 11).getTime(), project: "/x", display: "old" }),
      "not json",
      "",
    ].join("\n");
    const acts = parseClaudeHistory(jsonl, window);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ source: "claude", project: "web", title: "add a login form" });
  });
});

describe("parseCodexHistory", () => {
  it("converts seconds to ms and trims the session id", () => {
    const jsonl = [
      JSON.stringify({ ts: Math.floor(at(13) / 1000), session_id: "abcdef123456", text: "refactor parser" }),
      JSON.stringify({ ts: Math.floor(new Date(2026, 5, 20, 1).getTime() / 1000), text: "next day" }),
    ].join("\n");
    const acts = parseCodexHistory(jsonl, window);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ source: "codex", title: "refactor parser", detail: "abcdef12" });
  });
});
