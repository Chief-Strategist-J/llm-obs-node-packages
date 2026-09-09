/**
 * @file json-utils.ts
 * @description Pure Functional, Non-Mutating, Enterprise Safe JSON Operations & Data Transformations.
 * 
 * ALGORITHM SPECIFICATION:
 * 1. Prototype Pollution Defense: Recursively sanitize and strip dangerous property keys (__proto__, constructor, prototype).
 * 2. Pure Data Operations: Ensure deepClone, deepEqual, pickKeys, omitKeys, deepPick, deepOmit, flatten, unflatten immutably return frozen structures.
 * 3. Safe Parsing & Stringifying: Non-throwing circular-safe JSON parse & stringify with telemetry enveloping.
 * 4. List Operations: Clones all arrays before transformation/sorting, preventing in-place mutations on frozen inputs, and returns deeply frozen arrays.
 * 5. Relational Join & Aggregation: Pure hash-indexed joining and multi-level aggregation returning frozen collections.
 */

import { createHash } from "crypto";
import { RequestContextHolder } from "../tracing/request-context";
import { HTTP_CONSTANTS } from "../http/constants";

export interface JsonEnvelope<T = unknown> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: { readonly code: string; readonly message: string; readonly stack?: string } | null;
  readonly meta: {
    readonly executionTimeMs: number;
    readonly inputBytes?: number;
    readonly outputBytes?: number;
    readonly traceparent?: string;
    readonly operation: string;
  };
}

export const DEFAULT_SENSITIVE_KEYS: readonly string[] = HTTP_CONSTANTS.DEFAULT_SENSITIVE_KEYS;

const DANGEROUS_KEYS = new Set<string>([
  HTTP_CONSTANTS.DANGEROUS_KEY_PROTO,
  HTTP_CONSTANTS.DANGEROUS_KEY_CONSTRUCTOR,
  HTTP_CONSTANTS.DANGEROUS_KEY_PROTOTYPE,
]);

function getByteSize(str: string): number {
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(str, HTTP_CONSTANTS.ENCODING_UTF8 as BufferEncoding);
  }
  return new TextEncoder().encode(str).length;
}

export function createEnvelope<T>(
  operation: string,
  startTime: number,
  data: T | null,
  error: Error | string | null = null,
  inputBytes?: number,
  outputBytes?: number
): Readonly<JsonEnvelope<T>> {
  const currentContext = RequestContextHolder.get();
  const durationMs = Date.now() - startTime;

  let errPayload: { readonly code: string; readonly message: string; readonly stack?: string } | null = null;
  if (error) {
    const isErrInstance = error instanceof Error;
    errPayload = Object.freeze({
      code: HTTP_CONSTANTS.ERR_JSON_OPERATION_FAILED,
      message: isErrInstance ? error.message : String(error),
      stack: isErrInstance ? error.stack : undefined,
    });
  }

  return Object.freeze({
    success: !error,
    data: error ? null : data,
    error: errPayload,
    meta: Object.freeze({
      executionTimeMs: durationMs,
      inputBytes,
      outputBytes,
      traceparent: currentContext?.traceparent,
      operation,
    }),
  });
}


/**
 * 1. Prototype Pollution Defense Sanitizer
 */
export function sanitizeJson<T>(input: T): T {
  if (input === null || typeof input !== HTTP_CONSTANTS.TYPE_OBJECT) return input;

  if (Array.isArray(input)) {
    return Object.freeze(input.map((item) => sanitizeJson(item))) as unknown as T;
  }

  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) {
      console.warn(`${HTTP_CONSTANTS.LOG_PREFIX_SECURITY} Stripped dangerous key '${key}' to prevent Prototype Pollution.`);
      continue;
    }
    cleanObj[key] = sanitizeJson(value);
  }
  return Object.freeze(cleanObj) as T;
}

/**
 * 2. Safe JSON Parse with Fallback
 */
export function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr || typeof jsonStr !== HTTP_CONSTANTS.TYPE_STRING) return fallback;
  try {
    const parsed = JSON.parse(jsonStr);
    return sanitizeJson(parsed) as T;
  } catch {
    return fallback;
  }
}

/**
 * 3. Safe JSON Parse Enveloped with Telemetry
 */
export function safeJsonParseEnveloped<T>(jsonStr: string | null | undefined): Readonly<JsonEnvelope<T>> {
  const startTime = Date.now();
  const inputBytes = jsonStr ? getByteSize(jsonStr) : 0;

  if (!jsonStr || typeof jsonStr !== HTTP_CONSTANTS.TYPE_STRING) {
    return createEnvelope<T>(HTTP_CONSTANTS.OP_JSON_PARSE, startTime, null, new Error(HTTP_CONSTANTS.ERR_MSG_INVALID_JSON_INPUT), inputBytes, 0);
  }

  try {
    const parsed = sanitizeJson(JSON.parse(jsonStr)) as T;
    return createEnvelope<T>(HTTP_CONSTANTS.OP_JSON_PARSE, startTime, parsed, null, inputBytes, getByteSize(jsonStr));
  } catch (err: any) {
    console.error(`${HTTP_CONSTANTS.LOG_PREFIX_PARSE_ERROR} Failed to parse JSON payload: ${err?.message}`);
    return createEnvelope<T>(HTTP_CONSTANTS.OP_JSON_PARSE, startTime, null, err, inputBytes, 0);
  }
}

/**
 * 4. Safe JSON Stringify (Circular & BigInt safe)
 */
export function safeJsonStringify(val: unknown, space?: number): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(
      val,
      (key, value) => {
        if (DANGEROUS_KEYS.has(key)) return undefined;
        if (typeof value === HTTP_CONSTANTS.TYPE_BIGINT) return `${value.toString()}n`;
        if (value instanceof RegExp) return value.toString();
        if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
        if (value instanceof Map) return Object.fromEntries(value.entries());
        if (value instanceof Set) return Array.from(value.values());
        if (typeof value === HTTP_CONSTANTS.TYPE_OBJECT && value !== null) {
          if (seen.has(value)) return HTTP_CONSTANTS.MARKER_CIRCULAR;
          seen.add(value);
        }
        return value;
      },
      space
    );
  } catch {
    return String(val);
  }
}

/**
 * 5. Safe JSON Stringify Enveloped
 */
export function safeJsonStringifyEnveloped(val: unknown, space?: number): Readonly<JsonEnvelope<string>> {
  const startTime = Date.now();
  try {
    const str = safeJsonStringify(val, space);
    const outputBytes = getByteSize(str);
    return createEnvelope<string>(HTTP_CONSTANTS.OP_JSON_STRINGIFY, startTime, str, null, undefined, outputBytes);
  } catch (err: any) {
    console.error(`${HTTP_CONSTANTS.LOG_PREFIX_STRINGIFY_ERROR} Failed to stringify payload: ${err?.message}`);
    return createEnvelope<string>(HTTP_CONSTANTS.OP_JSON_STRINGIFY, startTime, null, err);
  }
}

/**
 * 6. Deep Clone (Circular-safe, preserves Date/RegExp/Map/Set, Prototype-safe)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return obj;

  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as unknown as T;
  if (obj instanceof Map) {
    const copy = new Map();
    obj.forEach((v, k) => copy.set(deepClone(k), deepClone(v)));
    return copy as unknown as T;
  }
  if (obj instanceof Set) {
    const copy = new Set();
    obj.forEach((v) => copy.add(deepClone(v)));
    return copy as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    result[key] = deepClone(value);
  }
  return result as T;
}

/**
 * 7. Deep Structural Equality
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== HTTP_CONSTANTS.TYPE_OBJECT || typeof b !== HTTP_CONSTANTS.TYPE_OBJECT) return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a as Record<string, unknown>).filter((k) => !DANGEROUS_KEYS.has(k));
  const keysB = Object.keys(b as Record<string, unknown>).filter((k) => !DANGEROUS_KEYS.has(k));

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    const valA = (a as Record<string, unknown>)[key];
    const valB = (b as Record<string, unknown>)[key];
    if (!deepEqual(valA, valB)) return false;
  }
  return true;
}

/**
 * 8. Pick Keys (Flat)
 */
export function pickKeys<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> {
  const res = {} as any;
  if (!obj || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return Object.freeze(res);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && !DANGEROUS_KEYS.has(String(key))) {
      res[key] = obj[key];
    }
  }
  return Object.freeze(res);
}

/**
 * 9. Omit Keys (Flat)
 */
export function omitKeys<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> {
  const res: any = {};
  if (!obj || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return Object.freeze(res);
  const omitSet = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (!omitSet.has(k as K) && !DANGEROUS_KEYS.has(k)) {
      res[k] = v;
    }
  }
  return Object.freeze(res);
}

/**
 * 10. Deep Pick Keys
 */
export function deepPick<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const keySet = new Set(keys);
  const filter = (item: unknown): unknown => {
    if (item === null || typeof item !== HTTP_CONSTANTS.TYPE_OBJECT) return item;
    if (Array.isArray(item)) return Object.freeze(item.map(filter));

    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      if (keySet.has(k)) {
        res[k] = deepClone(v);
      } else if (v !== null && typeof v === HTTP_CONSTANTS.TYPE_OBJECT) {
        const sub = filter(v);
        if (sub && typeof sub === HTTP_CONSTANTS.TYPE_OBJECT && Object.keys(sub as object).length > 0) {
          res[k] = sub;
        }
      }
    }
    return Object.freeze(res);
  };
  return filter(obj) as Partial<T>;
}

/**
 * 11. Deep Omit Keys
 */
export function deepOmit<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Partial<T> {
  const keySet = new Set(keys);
  const filter = (item: unknown): unknown => {
    if (item === null || typeof item !== HTTP_CONSTANTS.TYPE_OBJECT) return item;
    if (Array.isArray(item)) return Object.freeze(item.map(filter));

    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k) || keySet.has(k)) continue;
      res[k] = filter(v);
    }
    return Object.freeze(res);
  };
  return filter(obj) as Partial<T>;
}


/**
 * 12. Flatten Object (Dot notation)
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix: string = HTTP_CONSTANTS.EMPTY_STRING
): Record<string, unknown> {
  const res: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(obj || {})) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const propName = prefix ? `${prefix}${HTTP_CONSTANTS.CHAR_DOT}${key}` : key;
    if (val !== null && typeof val === HTTP_CONSTANTS.TYPE_OBJECT && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(res, flattenObject(val as Record<string, unknown>, propName));
    } else {
      res[propName] = val;
    }
  }
  return res;
}

/**
 * 13. Unflatten Object (Reconstructs nested object from dot notation)
 */
export function unflattenObject(flatObj: Record<string, unknown>): Record<string, unknown> {
  let result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flatObj || {})) {
    result = deepSet(result, key, value);
  }
  return result;
}

/**
 * 14. Deep Getter (Dot & Bracket notation: "a.b[0].c")
 */
export function deepGet<T = unknown>(obj: unknown, path: string | string[], fallback?: T): T {
  if (obj === null || obj === undefined) return fallback as T;

  const parts = Array.isArray(path)
    ? path
    : path.replace(/^\//, HTTP_CONSTANTS.EMPTY_STRING).replace(/\//g, HTTP_CONSTANTS.CHAR_DOT).replace(/\[(\d+)\]/g, `${HTTP_CONSTANTS.CHAR_DOT}$1`).split(HTTP_CONSTANTS.CHAR_DOT).filter(Boolean);

  let curr: any = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || DANGEROUS_KEYS.has(part)) return fallback as T;
    curr = curr[part];
  }
  return (curr === undefined ? fallback : curr) as T;
}

/**
 * 15. Deep Setter (Dot, Bracket & JSON Pointer notation - Immutably returns new structure)
 */
export function deepSet<T extends Record<string, unknown>>(obj: T, path: string | string[], value: unknown): T {
  if (!obj || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return obj;

  const parts = Array.isArray(path)
    ? path
    : path
        .replace(/^\//, HTTP_CONSTANTS.EMPTY_STRING)
        .replace(/\//g, HTTP_CONSTANTS.CHAR_DOT)
        .replace(/\[(\d+)\]/g, `${HTTP_CONSTANTS.CHAR_DOT}$1`)
        .split(HTTP_CONSTANTS.CHAR_DOT)
        .filter(Boolean);

  if (parts.length === 0) return obj;

  function setRecursive(current: any, index: number): any {
    if (index >= parts.length) return value;
    const part = parts[index];
    if (!part || DANGEROUS_KEYS.has(part)) return current;

    const nextPart = parts[index + 1];
    const isNextNumber = nextPart !== undefined && /^\d+$/.test(nextPart);

    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      const copy = [...current];
      copy[idx] = setRecursive(index + 1 < parts.length ? current[idx] ?? (isNextNumber ? [] : {}) : undefined, index + 1);
      return copy;
    } else {
      const sub = current && typeof current === HTTP_CONSTANTS.TYPE_OBJECT ? current[part] : undefined;
      const nextVal = setRecursive(index + 1 < parts.length ? sub ?? (isNextNumber ? [] : {}) : undefined, index + 1);
      return {
        ...(current && typeof current === HTTP_CONSTANTS.TYPE_OBJECT ? current : {}),
        [part]: nextVal,
      };
    }
  }

  return setRecursive(obj, 0) as T;
}

/**
 * 16. Deep Merge (Prototype Pollution Guarded - Immutably returns new structure)
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T {
  let result: Record<string, unknown> = target && typeof target === HTTP_CONSTANTS.TYPE_OBJECT ? { ...target } : {};

  for (const source of sources) {
    if (!source || typeof source !== HTTP_CONSTANTS.TYPE_OBJECT) continue;

    const next: Record<string, unknown> = { ...result };
    for (const [key, value] of Object.entries(source)) {
      if (DANGEROUS_KEYS.has(key)) continue;

      if (
        value !== null &&
        typeof value === HTTP_CONSTANTS.TYPE_OBJECT &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        const existingSub = next[key];
        const subTarget =
          existingSub && typeof existingSub === HTTP_CONSTANTS.TYPE_OBJECT && !Array.isArray(existingSub)
            ? existingSub
            : {};
        next[key] = deepMerge(subTarget as any, value as any);
      } else if (Array.isArray(value)) {
        next[key] = [...value];
      } else {
        next[key] = deepClone(value);
      }
    }
    result = next;
  }
  return result as T;
}

/**
 * 17. Deep Structural Diff (Added, Modified, Removed)
 */
export interface JsonDiffResult {
  added: Record<string, unknown>;
  modified: Record<string, { from: unknown; to: unknown }>;
  removed: Record<string, unknown>;
}

export function deepDiff(obj1: Record<string, unknown>, obj2: Record<string, unknown>): JsonDiffResult {
  const flat1 = flattenObject(obj1);
  const flat2 = flattenObject(obj2);

  const added: Record<string, unknown> = {};
  const modified: Record<string, { from: unknown; to: unknown }> = {};
  const removed: Record<string, unknown> = {};

  for (const [k, v2] of Object.entries(flat2)) {
    if (!(k in flat1)) {
      added[k] = v2;
    } else if (!deepEqual(flat1[k], v2)) {
      modified[k] = { from: flat1[k], to: v2 };
    }
  }

  for (const [k, v1] of Object.entries(flat1)) {
    if (!(k in flat2)) {
      removed[k] = v1;
    }
  }

  return { added, modified, removed };
}

/**
 * 18. Rename Object Keys
 */
export function renameKeys(obj: Record<string, unknown>, keyMap: Record<string, string>): Record<string, unknown> {
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (DANGEROUS_KEYS.has(k)) continue;
    const newKey = keyMap[k] || k;
    if (DANGEROUS_KEYS.has(newKey)) continue;
    res[newKey] = v !== null && typeof v === HTTP_CONSTANTS.TYPE_OBJECT && !Array.isArray(v) ? renameKeys(v as Record<string, unknown>, keyMap) : v;
  }
  return res;
}

/**
 * 19. Type Coercion (Strings to numbers, booleans, dates)
 */
export function coerceJsonTypes(input: unknown): unknown {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === HTTP_CONSTANTS.VAL_TRUE) return true;
    if (trimmed === HTTP_CONSTANTS.VAL_FALSE) return false;
    if (trimmed === HTTP_CONSTANTS.VAL_NULL) return null;
    if (!isNaN(Number(trimmed)) && trimmed !== HTTP_CONSTANTS.EMPTY_STRING) return Number(trimmed);
    const dateParsed = Date.parse(trimmed);
    if (!isNaN(dateParsed) && trimmed.length >= 10 && (trimmed.includes(HTTP_CONSTANTS.CHAR_HYPHEN) || trimmed.includes(HTTP_CONSTANTS.CHAR_T))) {
      return new Date(dateParsed);
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(coerceJsonTypes);
  }

  if (input !== null && typeof input === HTTP_CONSTANTS.TYPE_OBJECT && !(input instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      res[k] = coerceJsonTypes(v);
    }
    return res;
  }
  return input;
}

/**
 * 20. Compact JSON (Removes null, undefined, empty strings, empty objects/arrays)
 */
export function compactJson(input: unknown): unknown {
  if (input === null || input === undefined || input === HTTP_CONSTANTS.EMPTY_STRING) return undefined;

  if (Array.isArray(input)) {
    const cleaned = input.map(compactJson).filter((v) => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof input === HTTP_CONSTANTS.TYPE_OBJECT && !(input instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      const compacted = compactJson(v);
      if (compacted !== undefined) {
        res[k] = compacted;
      }
    }
    return Object.keys(res).length > 0 ? res : undefined;
  }
  return input;
}

/**
 * 21. Canonicalize JSON (Alphabetically sort keys recursively)
 */
export function canonicalizeJson(input: unknown): unknown {
  if (input === null || typeof input !== HTTP_CONSTANTS.TYPE_OBJECT) return input;

  if (Array.isArray(input)) {
    return Object.freeze(input.map(canonicalizeJson));
  }

  const sortedKeys = [...Object.keys(input as Record<string, unknown>).filter((k) => !DANGEROUS_KEYS.has(k))].sort();
  const res: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    res[k] = canonicalizeJson((input as Record<string, unknown>)[k]);
  }
  return Object.freeze(res);
}

/**
 * 22. Hash JSON (SHA-256 of Canonical JSON)
 */
export function hashJson(obj: unknown): string {
  const canonical = safeJsonStringify(canonicalizeJson(obj));
  return createHash(HTTP_CONSTANTS.HASH_ALG_SHA256).update(canonical).digest(HTTP_CONSTANTS.ENCODING_HEX as import("crypto").BinaryToTextEncoding);
}

/**
 * 23. Truncate JSON (Limits string lengths & max depth)
 */
export function truncateJson(input: unknown, maxStringLength = 1000, maxDepth = 10, currentDepth = 0): unknown {
  if (currentDepth > maxDepth) return HTTP_CONSTANTS.MARKER_TRUNCATED_MAX_DEPTH;

  if (typeof input === "string") {
    if (input.length > maxStringLength) {
      return `${input.substring(0, maxStringLength)}${HTTP_CONSTANTS.TRUNCATED_PREFIX}${input.length - maxStringLength}${HTTP_CONSTANTS.TRUNCATED_BYTES_SUFFIX}`;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => truncateJson(item, maxStringLength, maxDepth, currentDepth + 1));
  }

  if (input !== null && typeof input === HTTP_CONSTANTS.TYPE_OBJECT && !(input instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      res[k] = truncateJson(v, maxStringLength, maxDepth, currentDepth + 1);
    }
    return res;
  }
  return input;
}

/**
 * 24. Sensitive Payload Masking
 */
export function maskSensitiveJson(
  payload: unknown,
  sensitiveKeys: readonly string[] = DEFAULT_SENSITIVE_KEYS,
  maskChar: string = HTTP_CONSTANTS.MASK_DEFAULT_CHAR
): unknown {
  if (payload === null || payload === undefined) return payload;
  if (typeof payload !== HTTP_CONSTANTS.TYPE_OBJECT) return payload;

  if (Array.isArray(payload)) {
    return Object.freeze(payload.map((item) => maskSensitiveJson(item, sensitiveKeys, maskChar)));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const isSensitive = sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()));
    if (isSensitive) {
      result[key] = maskChar;
    } else if (value !== null && typeof value === HTTP_CONSTANTS.TYPE_OBJECT) {
      result[key] = maskSensitiveJson(value, sensitiveKeys, maskChar);
    } else {
      result[key] = value;
    }
  }
  return Object.freeze(result);
}

/**
 * 25. JSON to URL Query String
 */
export function jsonToQueryString(obj: Record<string, unknown>): string {
  const flat = flattenObject(obj);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(flat)) {
    if (v !== undefined && v !== null) {
      params.append(k, String(v));
    }
  }
  return params.toString();
}

/**
 * 26. URL Query String to JSON
 */
export function queryStringToJson(qs: string): Readonly<Record<string, unknown>> {
  const params = new URLSearchParams(qs.startsWith(HTTP_CONSTANTS.CHAR_QUESTION_MARK) ? qs.substring(1) : qs);
  const flat: Record<string, unknown> = {};
  params.forEach((v, k) => {
    flat[k] = v;
  });
  return Object.freeze(unflattenObject(flat));
}

/**
 * 27. Schema Validation Envelope Enforcer
 */
export function validateJsonSchema<T>(
  obj: unknown,
  validatorFn: (data: unknown) => { success: boolean; error?: string }
): JsonEnvelope<T> {
  const startTime = Date.now();
  try {
    const result = validatorFn(obj);
    if (!result.success) {
      return createEnvelope<T>(HTTP_CONSTANTS.OP_VALIDATE_SCHEMA, startTime, null, new Error(result.error || HTTP_CONSTANTS.ERR_MSG_SCHEMA_VALIDATION_FAILED));
    }
    return createEnvelope<T>(HTTP_CONSTANTS.OP_VALIDATE_SCHEMA, startTime, obj as T);
  } catch (err: any) {
    return createEnvelope<T>(HTTP_CONSTANTS.OP_VALIDATE_SCHEMA, startTime, null, err);
  }
}

/**
 * 28. RFC 6902 JSON Patch Application (add, remove, replace)
 */
export interface JsonPatchOp {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

export function patchJson<T extends Record<string, unknown>>(target: T, patches: readonly JsonPatchOp[]): T {
  let result: any = target;
  for (const patch of patches) {
    if (patch.op === HTTP_CONSTANTS.PATCH_OP_ADD || patch.op === HTTP_CONSTANTS.PATCH_OP_REPLACE) {
      result = deepSet(result, patch.path, patch.value);
    } else if (patch.op === HTTP_CONSTANTS.PATCH_OP_REMOVE) {
      const parts = patch.path.replace(/\[(\d+)\]/g, `${HTTP_CONSTANTS.CHAR_DOT}$1`).split(HTTP_CONSTANTS.CHAR_DOT).filter(Boolean);
      const parentPath = parts.slice(0, -1).join(HTTP_CONSTANTS.CHAR_DOT);
      const key = parts[parts.length - 1];
      const parent = parentPath ? deepGet(result, parentPath) : result;
      if (parent && typeof parent === HTTP_CONSTANTS.TYPE_OBJECT) {
        const updatedParent = omitKeys(parent as Record<string, unknown>, [key as any]);
        result = parentPath ? deepSet(result, parentPath, updatedParent) : (updatedParent as T);
      }
    }
  }
  return result;
}

/**
 * 29. Generate RFC 6902 Patches from Diff
 */
export function diffToPatch(obj1: Record<string, unknown>, obj2: Record<string, unknown>): readonly JsonPatchOp[] {
  const diff = deepDiff(obj1, obj2);
  const patches: JsonPatchOp[] = [];

  for (const [path, value] of Object.entries(diff.added)) {
    patches.push(Object.freeze({ op: HTTP_CONSTANTS.PATCH_OP_ADD, path: `${HTTP_CONSTANTS.CHAR_SLASH}${path.replace(/\./g, HTTP_CONSTANTS.CHAR_SLASH)}`, value }));
  }
  for (const [path, { to }] of Object.entries(diff.modified)) {
    patches.push(Object.freeze({ op: HTTP_CONSTANTS.PATCH_OP_REPLACE, path: `${HTTP_CONSTANTS.CHAR_SLASH}${path.replace(/\./g, HTTP_CONSTANTS.CHAR_SLASH)}`, value: to }));
  }
  for (const path of Object.keys(diff.removed)) {
    patches.push(Object.freeze({ op: HTTP_CONSTANTS.PATCH_OP_REMOVE, path: `${HTTP_CONSTANTS.CHAR_SLASH}${path.replace(/\./g, HTTP_CONSTANTS.CHAR_SLASH)}` }));
  }

  return Object.freeze(patches);
}

/**
 * 30. Find Matching Nodes
 */
export function findMatchingNodes(
  obj: unknown,
  predicate: (key: string, value: unknown) => boolean
): readonly { readonly path: string; readonly value: unknown }[] {
  const results: { readonly path: string; readonly value: unknown }[] = [];
  const walk = (item: unknown, currentPath: string) => {
    if (item === null || typeof item !== HTTP_CONSTANTS.TYPE_OBJECT) return;

    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      const path = currentPath ? `${currentPath}${HTTP_CONSTANTS.CHAR_DOT}${k}` : k;
      if (predicate(k, v)) {
        results.push(Object.freeze({ path, value: v }));
      }
      walk(v, path);
    }
  };
  walk(obj, HTTP_CONSTANTS.EMPTY_STRING);
  return Object.freeze(results);
}

/**
 * 31. Map JSON Primitive Values
 */
export function mapJsonValues(obj: unknown, mapper: (val: unknown, key: string) => unknown): unknown {
  if (obj === null || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => mapJsonValues(item, mapper));
  }

  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    if (v !== null && typeof v === HTTP_CONSTANTS.TYPE_OBJECT) {
      res[k] = mapJsonValues(v, mapper);
    } else {
      res[k] = mapper(v, k);
    }
  }
  return res;
}

/**
 * 32. Key Case Conversions (camelCase, snake_case, kebab-case)
 */
export function mapJsonKeys(obj: unknown, keyMapper: (key: string) => string): unknown {
  if (obj === null || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => mapJsonKeys(item, keyMapper));
  }

  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    const newKey = keyMapper(k);
    if (DANGEROUS_KEYS.has(newKey)) continue;
    res[newKey] = mapJsonKeys(v, keyMapper);
  }
  return res;
}

export function camelCaseKeys(obj: unknown): unknown {
  return mapJsonKeys(obj, (k) => k.replace(/[-_]([a-z])/g, (_, g) => g.toUpperCase()));
}

export function snakeCaseKeys(obj: unknown): unknown {
  return mapJsonKeys(obj, (k) => k.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, HTTP_CONSTANTS.EMPTY_STRING));
}

export function kebabCaseKeys(obj: unknown): unknown {
  return mapJsonKeys(obj, (k) => k.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, HTTP_CONSTANTS.EMPTY_STRING));
}

/**
 * 33. JSON Size Measurement
 */
export function jsonSizeInBytes(obj: unknown): number {
  return getByteSize(safeJsonStringify(obj));
}

/**
 * 34. JSON to CSV & CSV to JSON
 */
export function jsonToCsv(arr: readonly Record<string, unknown>[]): string {
  if (!Array.isArray(arr) || arr.length === 0) return HTTP_CONSTANTS.EMPTY_STRING;
  const headers = Object.keys(flattenObject(arr[0]));
  const rows = [headers.join(HTTP_CONSTANTS.CHAR_COMMA)];

  for (const item of arr) {
    const flat = flattenObject(item);
    const row = headers.map((h) => {
      const val = flat[h];
      const str = val === undefined || val === null ? HTTP_CONSTANTS.EMPTY_STRING : String(val);
      return str.includes(HTTP_CONSTANTS.CHAR_COMMA) || str.includes(HTTP_CONSTANTS.CHAR_QUOTE) || str.includes(HTTP_CONSTANTS.CHAR_NEWLINE)
        ? `${HTTP_CONSTANTS.CHAR_QUOTE}${str.replace(/"/g, '""')}${HTTP_CONSTANTS.CHAR_QUOTE}`
        : str;
    });
    rows.push(row.join(HTTP_CONSTANTS.CHAR_COMMA));
  }
  return rows.join(HTTP_CONSTANTS.CHAR_NEWLINE);
}

export function csvToJson(csv: string): readonly Record<string, unknown>[] {
  if (!csv || typeof csv !== HTTP_CONSTANTS.TYPE_STRING) return Object.freeze([]);
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return Object.freeze([]);

  const firstLine = lines[0];
  if (!firstLine) return Object.freeze([]);
  const headers = firstLine.split(HTTP_CONSTANTS.CHAR_COMMA).map((h) => h.trim().replace(/^"|"$/g, HTTP_CONSTANTS.EMPTY_STRING));
  const result: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    if (!currentLine) continue;
    const values = currentLine.split(HTTP_CONSTANTS.CHAR_COMMA).map((v) => v.trim().replace(/^"|"$/g, HTTP_CONSTANTS.EMPTY_STRING));
    const flat: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      flat[h] = values[idx] ?? HTTP_CONSTANTS.EMPTY_STRING;
    });
    result.push(Object.freeze(unflattenObject(flat)));
  }
  return Object.freeze(result);
}

/**
 * 35. Wildcard Deep Getter (N-th Level Pattern Matcher: "users.*.id", "orders[*].items[*].price")
 */
export function deepGetWildcard(obj: unknown, pattern: string): readonly { readonly path: string; readonly value: unknown }[] {
  if (obj === null || obj === undefined) return Object.freeze([]);

  const parts = pattern
    .replace(/\[(\d+|\*)\]/g, `${HTTP_CONSTANTS.CHAR_DOT}$1`)
    .split(HTTP_CONSTANTS.CHAR_DOT)
    .filter(Boolean);

  const results: { readonly path: string; readonly value: unknown }[] = [];

  function matchStep(curr: unknown, idx: number, currentPath: string) {
    if (idx >= parts.length) {
      results.push(Object.freeze({ path: currentPath, value: curr }));
      return;
    }
    if (curr === null || curr === undefined) return;

    const part = parts[idx];
    if (!part) return;

    if (part === HTTP_CONSTANTS.WILDCARD_ALL || part === HTTP_CONSTANTS.CHAR_ASTERISK) {
      if (Array.isArray(curr)) {
        curr.forEach((item, index) => {
          const path = currentPath ? `${currentPath}[${index}]` : `[${index}]`;
          matchStep(item, idx + 1, path);
        });
      } else if (typeof curr === HTTP_CONSTANTS.TYPE_OBJECT) {
        for (const [k, v] of Object.entries(curr as Record<string, unknown>)) {
          if (DANGEROUS_KEYS.has(k)) continue;
          const path = currentPath ? `${currentPath}${HTTP_CONSTANTS.CHAR_DOT}${k}` : k;
          matchStep(v, idx + 1, path);
        }
      }
    } else {
      if (typeof curr === HTTP_CONSTANTS.TYPE_OBJECT && !Array.isArray(curr)) {
        if (DANGEROUS_KEYS.has(part)) return;
        const val = (curr as Record<string, unknown>)[part];
        const path = currentPath ? `${currentPath}${HTTP_CONSTANTS.CHAR_DOT}${part}` : part;
        if (idx === parts.length - 1 || val !== undefined) {
          matchStep(val, idx + 1, path);
        }
      } else if (Array.isArray(curr) && /^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        if (idx === parts.length - 1 || index < curr.length) {
          const path = `${currentPath}[${index}]`;
          matchStep(curr[index], idx + 1, path);
        }
      }
    }
  }

  matchStep(obj, 0, HTTP_CONSTANTS.EMPTY_STRING);
  return Object.freeze(results);
}

/**
 * 36. Wildcard Deep Setter (N-th Level Pattern Mutator)
 */
export function deepSetWildcard<T>(obj: T, pattern: string, value: unknown): T {
  let result: any = obj;
  const matches = deepGetWildcard(result, pattern);
  for (const match of matches) {
    result = deepSet(result as Record<string, unknown>, match.path, value);
  }
  return result as T;
}

/**
 * 37. Depth-Filtered N-th Level Transformer
 */
export function deepMapAtDepth(
  obj: unknown,
  targetDepth: number,
  transformFn: (val: unknown, key: string, path: string) => unknown,
  currentDepth = 0,
  currentPath: string = HTTP_CONSTANTS.EMPTY_STRING
): unknown {
  if (obj === null || typeof obj !== HTTP_CONSTANTS.TYPE_OBJECT) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item, idx) =>
      deepMapAtDepth(item, targetDepth, transformFn, currentDepth + 1, `${currentPath}[${idx}]`)
    );
  }

  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    const path = currentPath ? `${currentPath}${HTTP_CONSTANTS.CHAR_DOT}${k}` : k;

    if (currentDepth + 1 === targetDepth) {
      res[k] = transformFn(v, k, path);
    } else if (v !== null && typeof v === HTTP_CONSTANTS.TYPE_OBJECT) {
      res[k] = deepMapAtDepth(v, targetDepth, transformFn, currentDepth + 1, path);
    } else {
      res[k] = v;
    }
  }
  return res;
}

/**
 * 38. Relational Join (Joins primary array with lookup store by foreign key path)
 */
export function relationalJoin<P extends Record<string, unknown>, R extends Record<string, unknown>>(
  primary: readonly P[],
  lookup: readonly R[],
  foreignKeyPath: string,
  primaryKeyPath: string,
  asField: string,
  many = false
): readonly (P & Record<string, unknown>)[] {
  if (!Array.isArray(primary) || !Array.isArray(lookup)) return Object.freeze([]);

  const lookupIndex = new Map<unknown, R[]>();
  for (const item of lookup) {
    const keyVal = deepGet(item, primaryKeyPath);
    if (keyVal !== undefined && keyVal !== null) {
      const existing = lookupIndex.get(keyVal) || [];
      existing.push(item);
      lookupIndex.set(keyVal, existing);
    }
  }

  const result = primary.map((item) => {
    const fkVal = deepGet(item, foreignKeyPath);
    const matched = lookupIndex.get(fkVal) || [];
    const joinedValue = many
      ? Object.freeze(matched.map((m) => Object.freeze(deepClone(m))))
      : matched.length > 0
      ? Object.freeze(deepClone(matched[0]))
      : null;
    return Object.freeze({
      ...item,
      [asField]: joinedValue,
    }) as P & Record<string, unknown>;
  });

  return Object.freeze(result);
}

/**
 * 39. Deep Relational Embedder (Embeds entities into N-th level nested structures)
 */
export function embedRelations(
  target: unknown,
  foreignKeyName: string,
  relationMap: Readonly<Record<string, unknown>>,
  embedAsField: string
): unknown {
  if (target === null || typeof target !== HTTP_CONSTANTS.TYPE_OBJECT) return target;

  if (Array.isArray(target)) {
    return Object.freeze(
      target.map((item) => embedRelations(item, foreignKeyName, relationMap, embedAsField))
    );
  }

  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(target as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;

    if (k === foreignKeyName && (typeof v === HTTP_CONSTANTS.TYPE_STRING || typeof v === HTTP_CONSTANTS.TYPE_NUMBER)) {
      res[k] = v;
      const relationData = relationMap[String(v)];
      res[embedAsField] = relationData ? Object.freeze(deepClone(relationData)) : null;
    } else if (v !== null && typeof v === HTTP_CONSTANTS.TYPE_OBJECT) {
      res[k] = embedRelations(v, foreignKeyName, relationMap, embedAsField);
    } else {
      res[k] = v;
    }
  }
  return Object.freeze(res);
}

/**
 * 40. Deep Relational Aggregator (Aggregates N-th level nested values by path)
 */
export function aggregateRelationalByPath(
  dataset: readonly Record<string, unknown>[],
  groupByPath: string,
  aggregatePath: string,
  operation:
    | typeof HTTP_CONSTANTS.AGG_SUM
    | typeof HTTP_CONSTANTS.AGG_COUNT
    | typeof HTTP_CONSTANTS.AGG_AVG
    | typeof HTTP_CONSTANTS.AGG_MIN
    | typeof HTTP_CONSTANTS.AGG_MAX = HTTP_CONSTANTS.AGG_SUM
): Readonly<Record<string, number>> {
  if (!Array.isArray(dataset)) return Object.freeze({});

  const groups = new Map<string, number[]>();

  for (const item of dataset) {
    const groupKey = String(deepGet(item, groupByPath) ?? HTTP_CONSTANTS.EMPTY_STRING);
    const aggValue = Number(deepGet(item, aggregatePath) ?? 0);
    const list = groups.get(groupKey) || [];
    if (!isNaN(aggValue)) {
      list.push(aggValue);
    }
    groups.set(groupKey, list);
  }

  const result: Record<string, number> = {};
  groups.forEach((values, key) => {
    if (values.length === 0) {
      result[key] = 0;
      return;
    }
    if (operation === HTTP_CONSTANTS.AGG_COUNT) {
      result[key] = values.length;
    } else if (operation === HTTP_CONSTANTS.AGG_SUM) {
      result[key] = values.reduce((acc: number, curr: number) => acc + curr, 0);
    } else if (operation === HTTP_CONSTANTS.AGG_AVG) {
      result[key] = values.reduce((acc: number, curr: number) => acc + curr, 0) / values.length;
    } else if (operation === HTTP_CONSTANTS.AGG_MIN) {
      result[key] = Math.min(...values);
    } else if (operation === HTTP_CONSTANTS.AGG_MAX) {
      result[key] = Math.max(...values);
    }
  });
  return Object.freeze(result);
}

