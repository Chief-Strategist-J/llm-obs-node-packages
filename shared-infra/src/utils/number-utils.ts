/**
 * @file number-utils.ts
 * @description Data-Driven Numerical Processing & Mathematical Operations Utilities.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Safe Boundary Clamping (`clamp`):
 *    - Restricts value within specified lower and upper bounds: $\min(\max(val, min), max)$.
 * 2. Human-Readable Byte Formatting (`formatBytes`):
 *    - Uses binary IEC scale ($1024^k$) or decimal scale ($1000^k$) to convert raw bytes to formatted unit strings (B, KB, MB, GB, TB).
 * 3. Percentile Calculation (`calculatePercentile`):
 *    - Sorts numerical series using nearest-rank algorithm to calculate exact $P_{50}$, $P_{90}$, $P_{95}$, $P_{99}$ latency telemetry values.
 */

import { z } from "zod";
import { HTTP_CONSTANTS } from "../http/constants";

export const ClampSchema = z.object({
  val: z.number(),
  min: z.number(),
  max: z.number(),
});

export function clamp(val: number, min: number, max: number): number {
  ClampSchema.parse({ val, min, max });
  if (isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
}

export function safeParseInt(val: unknown, fallback: number): number {
  if (typeof val === HTTP_CONSTANTS.TYPE_NUMBER && !isNaN(val as number)) return Math.floor(val as number);
  if (typeof val === HTTP_CONSTANTS.TYPE_STRING) {
    const parsed = parseInt((val as string).trim(), 10);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function safeParseFloat(val: unknown, fallback: number): number {
  if (typeof val === HTTP_CONSTANTS.TYPE_NUMBER && !isNaN(val as number)) return val as number;
  if (typeof val === HTTP_CONSTANTS.TYPE_STRING) {
    const parsed = parseFloat((val as string).trim());
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function roundTo(val: number, precision = 2): number {
  if (isNaN(val)) return 0;
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0 || bytes < 0 || isNaN(bytes)) return HTTP_CONSTANTS.ZERO_BYTES;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = HTTP_CONSTANTS.BYTE_UNITS;

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  const value = parseFloat((bytes / Math.pow(k, index)).toFixed(dm));

  return `${value} ${sizes[index]}`;
}

export function formatCurrency(
  val: number,
  currency = HTTP_CONSTANTS.DEFAULT_CURRENCY,
  locale = HTTP_CONSTANTS.DEFAULT_LOCALE
): string {
  if (isNaN(val)) return `$0.00`;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(val);
  } catch {
    return `$${val.toFixed(2)}`;
  }
}

export function calculatePercentile(numbers: readonly number[], percentile: number): number {
  if (!numbers || numbers.length === 0) return 0;
  // Clone array prior to sorting to strictly prevent in-place mutation of frozen inputs
  const sorted = [...numbers].sort((a, b) => a - b);
  const p = clamp(percentile, 0, 100);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const safeIndex = clamp(index, 0, sorted.length - 1);
  return sorted[safeIndex] ?? 0;
}

export function calculateExponentialBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const cap = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
  return cap;
}

