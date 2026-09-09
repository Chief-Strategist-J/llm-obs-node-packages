/**
 * @file string-utils.ts
 * @description High-Performance Production String Processing & Transformation Utilities.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Case Conversions (`toCamelCase`, `toKebabCase`, `toSnakeCase`, `slugify`):
 *    - Uses regex word boundary parsing (`/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]+|[0-9]+/g`)
 *      to tokenize alphanumeric sequences safely without mutating original casing logic.
 * 2. Sensitive Masking (`maskSensitiveString`):
 *    - Preserves visible start and end characters while replacing internal sensitive characters with mask token (`*`).
 * 3. Template Interpolation (`interpolateTemplate`):
 *    - Replaces `{varName}` or `${varName}` placeholders using dynamic variable substitution.
 */

import { z } from "zod";
import { HTTP_CONSTANTS } from "../http/constants";

export const TruncateSchema = z.object({
  str: z.string(),
  maxLength: z.number().min(0),
  suffix: z.string().optional(),
});

export const MaskSchema = z.object({
  str: z.string(),
  visibleStart: z.number().min(0).optional(),
  visibleEnd: z.number().min(0).optional(),
  maskChar: z.string().optional(),
});

export function capitalize(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function slugify(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, HTTP_CONSTANTS.EMPTY_STRING)
    .replace(/[\s_-]+/g, HTTP_CONSTANTS.CHAR_HYPHEN)
    .replace(/^-+|-+$/g, HTTP_CONSTANTS.EMPTY_STRING);
}

export function toCamelCase(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  const words = str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]+|[0-9]+/g) || [];
  return words
    .map((word, index) => {
      if (index === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(HTTP_CONSTANTS.EMPTY_STRING);
}

export function toKebabCase(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  const words = str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]+|[0-9]+/g) || [];
  return words.map((w) => w.toLowerCase()).join(HTTP_CONSTANTS.CHAR_HYPHEN);
}

export function toSnakeCase(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  const words = str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]+|[0-9]+/g) || [];
  return words.map((w) => w.toLowerCase()).join(HTTP_CONSTANTS.CHAR_UNDERSCORE);
}

export function truncate(str: string, maxLength: number, suffix = HTTP_CONSTANTS.SUFFIX_ELLIPSIS): string {
  TruncateSchema.parse({ str, maxLength, suffix });
  if (!str || str.length <= maxLength) return str;
  if (maxLength <= suffix.length) return suffix.slice(0, maxLength);
  return str.slice(0, maxLength - suffix.length) + suffix;
}

export function maskSensitiveString(
  str: string,
  visibleStart = 4,
  visibleEnd = 4,
  maskChar = HTTP_CONSTANTS.CHAR_ASTERISK
): string {
  MaskSchema.parse({ str, visibleStart, visibleEnd, maskChar });
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  if (str.length <= visibleStart + visibleEnd) {
    return maskChar.repeat(str.length);
  }
  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  const maskedLength = str.length - (visibleStart + visibleEnd);
  return `${start}${maskChar.repeat(maskedLength)}${end}`;
}

export function interpolateTemplate(template: string, vars: Readonly<Record<string, unknown>>): string {
  if (!template) return HTTP_CONSTANTS.EMPTY_STRING;
  return template.replace(/\{?\$?\{([a-zA-Z0-9_]+)\}\}?/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const val = vars[key];
      return val !== undefined && val !== null ? String(val) : HTTP_CONSTANTS.EMPTY_STRING;
    }
    return match;
  });
}

export function sanitizeHtml(str: string): string {
  if (!str) return HTTP_CONSTANTS.EMPTY_STRING;
  return str
    .replace(/&/g, HTTP_CONSTANTS.HTML_ENTITY_AMP)
    .replace(/</g, HTTP_CONSTANTS.HTML_ENTITY_LT)
    .replace(/>/g, HTTP_CONSTANTS.HTML_ENTITY_GT)
    .replace(/"/g, HTTP_CONSTANTS.HTML_ENTITY_QUOT)
    .replace(/'/g, HTTP_CONSTANTS.HTML_ENTITY_APOS)
    .replace(/\//g, HTTP_CONSTANTS.HTML_ENTITY_SLASH);
}

