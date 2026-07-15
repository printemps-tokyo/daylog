import { describe, expect, it } from "vitest";
import {
  parseDate,
  dayWindow,
  dayWindows,
  inWindow,
  weekdayJp,
  localDateString,
  shiftDate,
  dateRange,
  datesEndingAt,
  MAX_RANGE_DAYS,
} from "../src/window.js";

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

  it("starts at the rollover hour with startAtRollover", () => {
    const w = dayWindow("2026-06-19", 6, { startAtRollover: true });
    expect(w.startMs).toBe(new Date(2026, 5, 19, 6, 0, 0, 0).getTime());
    expect(w.endMs).toBe(new Date(2026, 5, 20, 6, 0, 0, 0).getTime());
  });
});

describe("dayWindows", () => {
  it("never overlaps adjacent days with a rollover hour", () => {
    const [d1, d2] = dayWindows(["2026-06-19", "2026-06-20"], 5);
    // Day 1 covers its midnight through 05:00 next morning.
    expect(d1!.startMs).toBe(new Date(2026, 5, 19, 0, 0, 0, 0).getTime());
    expect(d1!.endMs).toBe(new Date(2026, 5, 20, 5, 0, 0, 0).getTime());
    // Day 2 starts where day 1 ends, so the windows are contiguous.
    expect(d2!.startMs).toBe(d1!.endMs);
    expect(d2!.endMs).toBe(new Date(2026, 5, 21, 5, 0, 0, 0).getTime());
    // An event at 02:00 on day 2 counts toward day 1 only.
    const earlyMorning = new Date(2026, 5, 20, 2, 0, 0, 0).getTime();
    expect(inWindow(earlyMorning, d1!)).toBe(true);
    expect(inWindow(earlyMorning, d2!)).toBe(false);
  });

  it("puts exact-boundary instants in exactly one day", () => {
    const [d1, d2] = dayWindows(["2026-06-19", "2026-06-20"], 5);
    // Exactly midnight on day 2 still belongs to day 1 (before its rollover).
    const midnight = new Date(2026, 5, 20, 0, 0, 0, 0).getTime();
    expect(inWindow(midnight, d1!)).toBe(true);
    expect(inWindow(midnight, d2!)).toBe(false);
    // Exactly the rollover hour on day 2 belongs to day 2 only.
    const rolloverInstant = new Date(2026, 5, 20, 5, 0, 0, 0).getTime();
    expect(inWindow(rolloverInstant, d1!)).toBe(false);
    expect(inWindow(rolloverInstant, d2!)).toBe(true);
  });

  it("matches plain calendar days when rollover is 0", () => {
    const windows = dayWindows(["2026-06-19", "2026-06-20"], 0);
    expect(windows[0]).toEqual(dayWindow("2026-06-19", 0));
    expect(windows[1]).toEqual(dayWindow("2026-06-20", 0));
  });

  it("keeps the single-day window unchanged", () => {
    expect(dayWindows(["2026-06-19"], 6)).toEqual([dayWindow("2026-06-19", 6)]);
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

describe("shiftDate", () => {
  it("moves across month and year boundaries", () => {
    expect(shiftDate("2026-06-30", 1)).toBe("2026-07-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("datesEndingAt", () => {
  it("returns just the anchor for days = 1", () => {
    expect(datesEndingAt("2026-07-15", 1)).toEqual(["2026-07-15"]);
  });

  it("spans a month boundary for days = 3", () => {
    expect(datesEndingAt("2026-07-02", 3)).toEqual(["2026-06-30", "2026-07-01", "2026-07-02"]);
  });

  it("rejects a non-positive or non-integer day count", () => {
    expect(() => datesEndingAt("2026-07-15", 0)).toThrow();
    expect(() => datesEndingAt("2026-07-15", -2)).toThrow();
    expect(() => datesEndingAt("2026-07-15", 2.5)).toThrow();
  });

  it("accepts up to 366 days and rejects more", () => {
    expect(datesEndingAt("2026-07-15", MAX_RANGE_DAYS)).toHaveLength(366);
    expect(() => datesEndingAt("2026-07-15", 367)).toThrow("date range too large: 367 days (max 366)");
    // The CLI's --days flag funnels through this check (e.g. --days 400).
    expect(() => datesEndingAt("2026-07-15", 400)).toThrow("date range too large: 400 days (max 366)");
  });
});

describe("dateRange", () => {
  it("is inclusive of both endpoints", () => {
    expect(dateRange("2026-06-28", "2026-07-01")).toEqual([
      "2026-06-28",
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
    ]);
    expect(dateRange("2026-07-15", "2026-07-15")).toEqual(["2026-07-15"]);
  });

  it("rejects a range whose end is before its start", () => {
    expect(() => dateRange("2026-07-02", "2026-07-01")).toThrow();
  });

  it("rejects malformed endpoints", () => {
    expect(() => dateRange("2026-7-1", "2026-07-02")).toThrow();
    expect(() => dateRange("2026-07-01", "2026-02-30")).toThrow();
  });

  it("accepts a full leap year and rejects anything longer", () => {
    expect(dateRange("2024-01-01", "2024-12-31")).toHaveLength(366);
    expect(() => dateRange("2024-01-01", "2025-01-01")).toThrow("date range too large: 367 days (max 366)");
    // A pathological range fails fast instead of iterating millions of days.
    expect(() => dateRange("1000-01-01", "9999-12-31")).toThrow(/date range too large/);
  });
});

describe("weekdayJp / localDateString", () => {
  it("returns the Japanese weekday and a YYYY-MM-DD string", () => {
    expect(weekdayJp("2026-06-19")).toBe("金"); // 2026-06-19 is a Friday
    expect(localDateString(new Date(2026, 5, 19, 12, 0, 0).getTime())).toBe("2026-06-19");
  });
});
