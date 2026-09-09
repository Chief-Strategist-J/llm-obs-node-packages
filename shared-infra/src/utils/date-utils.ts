/**
 * @file date-utils.ts
 * @description High-Performance Date Parsing, Formatting & Expiration Evaluation Utilities.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Safe Date Parsing (`parseDate`):
 *    - Parses Date instances, epoch millisecond timestamps, ISO-8601 strings, and Unix timestamps.
 * 2. Relative Time Description (`formatTimeAgo`):
 *    - Converts time delta into relative human-readable strings (just now, X mins ago, X hours ago, X days ago).
 * 3. Expiration Evaluation (`isExpired`):
 *    - Evaluates whether a timestamp + TTL duration in milliseconds has elapsed relative to current time.
 */

import { z } from "zod";
import { HTTP_CONSTANTS } from "../http/constants";

export const DateDurationSchema = z.object({
  days: z.number().optional(),
  hours: z.number().optional(),
  minutes: z.number().optional(),
  seconds: z.number().optional(),
  ms: z.number().optional(),
});

export type DateDuration = z.infer<typeof DateDurationSchema>;

export function isValidDate(val: unknown): val is Date {
  return val instanceof Date && !isNaN(val.getTime());
}

export function parseDate(val: unknown): Date | null {
  if (val === null || val === undefined) return null;
  if (isValidDate(val)) return val;
  if (typeof val === HTTP_CONSTANTS.TYPE_NUMBER) {
    const d = new Date(val as number);
    return isValidDate(d) ? d : null;
  }
  if (typeof val === HTTP_CONSTANTS.TYPE_STRING) {
    const trimmed = (val as string).trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!isNaN(numeric) && trimmed.length >= 10) {
      const d = new Date(numeric);
      if (isValidDate(d)) return d;
    }
    const d = new Date(trimmed);
    return isValidDate(d) ? d : null;
  }
  return null;
}

export function formatISO(dateInput: Date | string | number): string {
  const date = parseDate(dateInput);
  if (!date) return new Date().toISOString();
  return date.toISOString();
}

export function formatDate(
  dateInput: Date | string | number,
  formatPattern: string = HTTP_CONSTANTS.DEFAULT_DATE_FORMAT
): string {
  const date = parseDate(dateInput);
  if (!date) return HTTP_CONSTANTS.EMPTY_STRING;

  const pad = (n: number) => n.toString().padStart(2, "0");

  const year = date.getUTCFullYear().toString();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());

  return formatPattern
    .replace("YYYY", year)
    .replace("MM", month)
    .replace("DD", day)
    .replace("HH", hours)
    .replace("mm", minutes)
    .replace("ss", seconds);
}

export function addDuration(dateInput: Date | string | number, duration: Readonly<DateDuration>): Date {
  const validatedDuration = DateDurationSchema.parse(duration);
  const date = parseDate(dateInput) || new Date();
  const res = new Date(date.getTime());

  if (validatedDuration.ms) res.setTime(res.getTime() + validatedDuration.ms);
  if (validatedDuration.seconds) res.setTime(res.getTime() + validatedDuration.seconds * 1000);
  if (validatedDuration.minutes) res.setTime(res.getTime() + validatedDuration.minutes * 60 * 1000);
  if (validatedDuration.hours) res.setTime(res.getTime() + validatedDuration.hours * 60 * 60 * 1000);
  if (validatedDuration.days) res.setUTCDate(res.getUTCDate() + validatedDuration.days);

  return res;
}

export function isExpired(dateInput: Date | string | number, ttlMs: number): boolean {
  const date = parseDate(dateInput);
  if (!date) return true;
  return Date.now() > date.getTime() + ttlMs;
}

export function formatTimeAgo(dateInput: Date | string | number): string {
  const date = parseDate(dateInput);
  if (!date) return HTTP_CONSTANTS.VAL_UNKNOWN;

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return HTTP_CONSTANTS.TIME_JUST_NOW;
  if (diffSec < 60) return `${diffSec}${HTTP_CONSTANTS.TIME_AGO_SECONDS}`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${diffMin === 1 ? HTTP_CONSTANTS.TIME_AGO_MINUTE : HTTP_CONSTANTS.TIME_AGO_MINUTES}`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}${diffHour === 1 ? HTTP_CONSTANTS.TIME_AGO_HOUR : HTTP_CONSTANTS.TIME_AGO_HOURS}`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}${diffDay === 1 ? HTTP_CONSTANTS.TIME_AGO_DAY : HTTP_CONSTANTS.TIME_AGO_DAYS}`;

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}${diffMonth === 1 ? HTTP_CONSTANTS.TIME_AGO_MONTH : HTTP_CONSTANTS.TIME_AGO_MONTHS}`;

  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}${diffYear === 1 ? HTTP_CONSTANTS.TIME_AGO_YEAR : HTTP_CONSTANTS.TIME_AGO_YEARS}`;
}

export function getStartOfDay(dateInput?: Date | string | number): Date {
  const date = parseDate(dateInput) || new Date();
  const res = new Date(date.getTime());
  res.setUTCHours(0, 0, 0, 0);
  return res;
}

export function getEndOfDay(dateInput?: Date | string | number): Date {
  const date = parseDate(dateInput) || new Date();
  const res = new Date(date.getTime());
  res.setUTCHours(23, 59, 59, 999);
  return res;
}

