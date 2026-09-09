/**
 * @file http-utils.ts
 * @description HTTP Utility & Telemetry Sanitization Functions.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. URL Credential Sanitization (`sanitizeUrlForTelemetry`):
 *    - Strips search parameters, query tokens, and inline credentials (username:password) from URLs.
 * 2. Key Hashing (`generateHashedKey`):
 *    - Generates SHA-256 hex digest using `tenantId:method:url:bodyString` for singleflight and caching lookup.
 * 3. Route Template Derivation (`deriveRouteTemplate`):
 *    - Replaces numeric IDs (`/123`) and UUIDs (`/550e8400-e29b-41d4-a716-446655440000`) with `:id` parameters
 *      to aggregate circuit breaker metrics per route template.
 * 4. AWS Full Jitter Backoff (`calculateFullJitterBackoff`):
 *    - Calculates exponential backoff with full randomized jitter:
 *      $\text{cap} = \min(\text{maxMs}, \text{baseMs} \times 2^{\text{attempt}-1})$, $\text{sleep} = \text{random}(0, \text{cap})$.
 */

import type { Attributes } from "@opentelemetry/api";
import { HTTP_CONSTANTS } from "../http/constants";

const ALLOWED_TELEMETRY_SET = new Set<string>(HTTP_CONSTANTS.ALLOWED_TELEMETRY_ATTRIBUTES);

export function sanitizeUrlForTelemetry(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.username = HTTP_CONSTANTS.EMPTY_STRING;
    parsed.password = HTTP_CONSTANTS.EMPTY_STRING;
    parsed.search = HTTP_CONSTANTS.EMPTY_STRING;
    return parsed.toString();
  } catch {
    return rawUrl.split("?")[0] || rawUrl;
  }
}

export function filterAllowedAttributes(attributes: Readonly<Record<string, unknown>>): Attributes {
  const filtered: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (ALLOWED_TELEMETRY_SET.has(key)) {
      if (typeof value === HTTP_CONSTANTS.TYPE_STRING || typeof value === HTTP_CONSTANTS.TYPE_NUMBER || typeof value === HTTP_CONSTANTS.TYPE_BOOLEAN) {
        filtered[key] = value as string | number | boolean;
      } else if (Array.isArray(value)) {
        filtered[key] = value.map((item) => String(item));
      } else if (value !== null && value !== undefined) {
        filtered[key] = String(value);
      }
    }
  }
  return filtered;
}

function generateFastHash(str: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 0x01000193);
    hash2 ^= code;
    hash2 = Math.imul(hash2, 0x85ebca6b);
  }
  const hex1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  return `${hex1}${hex2}`;
}

export function generateHashedKey(tenantId: string, method: string, url: string, body?: unknown): string {
  const bodyStr = body ? JSON.stringify(body) : HTTP_CONSTANTS.EMPTY_STRING;
  const rawKey = `${tenantId}:${method.toUpperCase()}:${url}:${bodyStr}`;
  return generateFastHash(rawKey);
}

export function deriveRouteTemplate(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const pathParts = parsed.pathname.split(HTTP_CONSTANTS.CHAR_SLASH).map((part) => {
      if (!part) return part;
      if (/^[0-9]+$/.test(part) || /^[0-9a-fA-F-]{36}$/.test(part)) {
        return HTTP_CONSTANTS.PARAM_ID_TEMPLATE;
      }
      return part;
    });
    return `${parsed.hostname}${pathParts.join(HTTP_CONSTANTS.CHAR_SLASH)}`;
  } catch {
    return urlStr;
  }
}

export function calculateFullJitterBackoff(attempt: number, baseMs = 200, maxMs = 10000): number {
  const cap = Math.min(maxMs, baseMs * Math.pow(2, attempt - 1));
  return Math.floor(Math.random() * cap);
}

export function isCacheDisabled(noCacheOption?: boolean, headers: Readonly<Record<string, string>> = {}): boolean {
  const cacheControlHeader = (headers[HTTP_CONSTANTS.HEADER_CACHE_CONTROL] || HTTP_CONSTANTS.EMPTY_STRING).toLowerCase();
  const hasNoCacheDirective =
    cacheControlHeader.includes(HTTP_CONSTANTS.CACHE_NO_CACHE) ||
    cacheControlHeader.includes(HTTP_CONSTANTS.CACHE_NO_STORE);
  return Boolean(noCacheOption || hasNoCacheDirective);
}

export function isMethodIdempotent(method: string): boolean {
  const m = method.toUpperCase();
  return m === HTTP_CONSTANTS.METHOD_GET || m === HTTP_CONSTANTS.METHOD_PUT || m === HTTP_CONSTANTS.METHOD_DELETE;
}

