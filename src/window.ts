import type { Window } from "./types.js";

const WEEKDAYS_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

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

/**
 * Compute the local-time window for a day. It runs from the date's midnight to
 * `rolloverHour` o'clock the next morning, so late-night work counts toward the
 * day it started. With `rolloverHour = 0` the window is exactly the calendar
 * day. `rolloverHour` must be 0..=23.
 */
export function dayWindow(dateStr: string, rolloverHour = 0): Window {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > 23) {
    throw new Error(`rollover hour must be an integer 0..23 (got ${rolloverHour})`);
  }
  const { year, month, day } = parseDate(dateStr);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
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

/** Every date from `from` to `to`, inclusive and ascending. */
export function dateRange(from: string, to: string): string[] {
  parseDate(from);
  parseDate(to);
  if (to < from) {
    throw new Error(`invalid range: end "${to}" is before start "${from}"`);
  }
  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) {
    dates.push(d);
  }
  return dates;
}

/** The `days` consecutive dates ending at `end`, inclusive and ascending. */
export function datesEndingAt(end: string, days: number): string[] {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`days must be a positive integer (got ${days})`);
  }
  return dateRange(shiftDate(end, 1 - days), end);
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
