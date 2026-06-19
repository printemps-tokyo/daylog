import { describe, expect, it } from "vitest";
import { parseDate, dayWindow, inWindow, weekdayJp, localDateString } from "../src/window.js";

describe("parseDate", () => {
  it("accepts valid dates and rejects bad ones", () => {
    expect(parseDate("2026-06-19")).toEqual({ year: 2026, month: 6, day: 19 });
    expect(() => parseDate("2026-6-9")).toThrow();
    expect(() => parseDate("2026-02-30")).toThrow();
  });
});

describe("dayWindow", () => {
  it("spans the calendar day when rollover is 0", () => {
    const w = dayWindow("2026-06-19", 0);
    expect(w.startMs).toBe(new Date(2026, 5, 19, 0, 0, 0, 0).getTime());
    expect(w.endMs).toBe(new Date(2026, 5, 20, 0, 0, 0, 0).getTime());
  });

  it("extends into the next morning with a rollover hour", () => {
    const w = dayWindow("2026-06-19", 6);
    expect(w.endMs).toBe(new Date(2026, 5, 20, 6, 0, 0, 0).getTime());
  });

  it("rejects an out-of-range rollover", () => {
    expect(() => dayWindow("2026-06-19", 24)).toThrow();
  });
});

describe("inWindow", () => {
  it("is inclusive of start and exclusive of end", () => {
    const w = { startMs: 100, endMs: 200 };
    expect(inWindow(100, w)).toBe(true);
    expect(inWindow(199, w)).toBe(true);
    expect(inWindow(200, w)).toBe(false);
    expect(inWindow(99, w)).toBe(false);
  });
});

describe("weekdayJp / localDateString", () => {
  it("returns the Japanese weekday and a YYYY-MM-DD string", () => {
    expect(weekdayJp("2026-06-19")).toBe("金"); // 2026-06-19 is a Friday
    expect(localDateString(new Date(2026, 5, 19, 12, 0, 0).getTime())).toBe("2026-06-19");
  });
});
