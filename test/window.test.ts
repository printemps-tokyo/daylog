import { describe, expect, it } from "vitest";
import {
  parseDate,
  dayWindow,
  inWindow,
  weekdayJp,
  localDateString,
  shiftDate,
  dateRange,
  datesEndingAt,
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
});

describe("weekdayJp / localDateString", () => {
  it("returns the Japanese weekday and a YYYY-MM-DD string", () => {
    expect(weekdayJp("2026-06-19")).toBe("金"); // 2026-06-19 is a Friday
    expect(localDateString(new Date(2026, 5, 19, 12, 0, 0).getTime())).toBe("2026-06-19");
  });
});
