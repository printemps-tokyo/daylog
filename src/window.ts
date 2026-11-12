import type { Window } from "./types.js";

const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** Largest number of days a single report may cover. */
export const MAX_RANGE_DAYS = 366;

/** Validate a `YYYY-MM-DD` string and return its numeric parts. */
export function parseDate(input: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) {
    throw new Error(`date must be YYYY-MM-DD (got "${input}")`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    throw new Error(`not a valid calendar date: "${input}"`);
  }
  return { year, month, day };
}

/** Options for {@link dayWindow}. */
export interface DayWindowOptions {
  /**
   * Start the window at `rolloverHour` on the date instead of midnight. Use
   * this for every day after the first in a multi-day report: the previous
   * day's window already covers midnight to the rollover hour, so starting at
   * the rollover hour keeps adjacent windows contiguous and non-overlapping.
   */
  startAtRollover?: boolean;
}

/**
 * Compute the local-time window for a day. It runs from the date's midnight to
 * `rolloverHour` o'clock the next morning, so late-night work counts toward the
 * day it started. With `rolloverHour = 0` the window is exactly the calendar
 * day. `rolloverHour` must be 0..=23. With `startAtRollover` the window begins
 * at `rolloverHour` on the date itself (see {@link DayWindowOptions}).
 */
export function dayWindow(dateStr: string, rolloverHour = 0, options: DayWindowOptions = {}): Window {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > 23) {
    throw new Error(`rollover hour must be an integer 0..23 (got ${rolloverHour})`);
  }
  const { year, month, day } = parseDate(dateStr);
  const startHour = options.startAtRollover ? rolloverHour : 0;
  const start = new Date(year, month - 1, day, startHour, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, rolloverHour, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/** The local-time date (`YYYY-MM-DD`) for an epoch-millisecond instant. */
export function localDateString(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The date `n` days after `dateStr` (`n` may be negative). */
export function shiftDate(dateStr: string, n: number): string {
  const { year, month, day } = parseDate(dateStr);
  return localDateString(new Date(year, month - 1, day + n).getTime());
}

/** Every date from `from` to `to`, inclusive and ascending (max 366 days). */
export function dateRange(from: string, to: string): string[] {
  const f = parseDate(from);
  const t = parseDate(to);
  if (to < from) {
    throw new Error(`invalid range: end "${to}" is before start "${from}"`);
  }
  const spanMs =
    new Date(t.year, t.month - 1, t.day).getTime() - new Date(f.year, f.month - 1, f.day).getTime();
  const span = Math.round(spanMs / 86_400_000) + 1;
  if (span > MAX_RANGE_DAYS) {
    throw new Error(`date range too large: ${span} days (max ${MAX_RANGE_DAYS})`);
  }
  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    dates.push(d);
  }
  return dates;
}

/** The `days` consecutive dates ending at `end`, inclusive and ascending (max 366). */
export function datesEndingAt(end: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`days must be a positive integer (got ${days})`);
  }
  if (days > MAX_RANGE_DAYS) {
    throw new Error(`date range too large: ${days} days (max ${MAX_RANGE_DAYS})`);
  }
  return dateRange(shiftDate(end, 1 - days), end);
}

/**
 * Non-overlapping windows for a run of consecutive dates. The first day runs
 * from its own midnight (exactly like `dayWindow`); every later day starts at
 * `rolloverHour` on its own date, so activity between midnight and the
 * rollover hour is attributed only to the previous day. Each day still ends at
 * `rolloverHour` the next morning. With `rolloverHour = 0` every window is
 * exactly the calendar day.
 */
export function dayWindows(dates: string[], rolloverHour = 0): Window[] {
  return dates.map((date, i) => dayWindow(date, rolloverHour, { startAtRollover: i > 0 }));
}

/** The single-character Japanese weekday label for a `YYYY-MM-DD` date. */
export function weekdayJp(dateStr: string): string {
  const { year, month, day } = parseDate(dateStr);
  return WEEKDAYS_JP[new Date(year, month - 1, day).getDay()] as string;
}

/** Whether `ms` falls within `[startMs, endMs)`. */
export function inWindow(ms: number, window: Window): boolean {
  return ms >= window.startMs && ms < window.endMs;
}

/** The Monday-to-Sunday week that contains `dateStr`. */
export function weekOf(dateStr: string): string[] {
  const { year, month, day } = parseDate(dateStr);
  const dow = new Date(year, month - 1, day).getDay(); // 0 = Sunday
  const monday = shiftDate(dateStr, -((dow + 6) % 7));
  return dateRange(monday, shiftDate(monday, 6));
}

/** Every day of the calendar month `YYYY-MM`. */
export function monthDates(yearMonth: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!m) throw new Error(`invalid month: "${yearMonth}" (expected YYYY-MM)`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`invalid month: "${yearMonth}"`);
  const last = new Date(year, month, 0).getDate();
  return dateRange(`${yearMonth}-01`, `${yearMonth}-${String(last).padStart(2, "0")}`);
}
