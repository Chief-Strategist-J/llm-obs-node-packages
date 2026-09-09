/**
 * @file json-map.ts
 * @description Pure Functional, Non-Mutating JSON Mapping and Anti-Corruption Layer.
 *
 * JSON MAPPING ALGORITHM:
 * 1. Initialize `result` as an immutable shallow copy of input `obj`.
 * 2. Process Transformation Operations Sequentially:
 *    a. RENAME: Construct a fresh object mapping `from` key to `to` key without in-place delete mutations.
 *    b. PICK: Construct a fresh object containing only explicitly targeted keys.
 *    c. OMIT: Construct a fresh object excluding omitted keys via pure destructuring/filtering.
 *    d. DEFAULT: Inject default value if field is undefined/null in a fresh copy.
 *    e. COERCE: Type-cast target value to string, number, boolean, or date in a fresh copy.
 * 3. Return a deeply frozen (`Object.freeze`) immutable output object.
 */

import type { JsonMapOp } from './transform.types';
import { JsonMapOpKind, CoerceTarget, DATA_TRANSFORM_CONSTANTS } from './transform.types';

function coerceValue(value: unknown, to: CoerceTarget | `${CoerceTarget}`): unknown {
  switch (to) {
    case CoerceTarget.STRING:
    case DATA_TRANSFORM_CONSTANTS.TARGET_STRING:
      return String(value);
    case CoerceTarget.NUMBER:
    case DATA_TRANSFORM_CONSTANTS.TARGET_NUMBER:
      return Number(value);
    case CoerceTarget.BOOLEAN:
    case DATA_TRANSFORM_CONSTANTS.TARGET_BOOLEAN:
      return Boolean(value);
    case CoerceTarget.DATE:
    case DATA_TRANSFORM_CONSTANTS.TARGET_DATE:
      return new Date(value as string | number);
    default:
      return value;
  }
}

export function mapJson(
  obj: Readonly<Record<string, unknown>>,
  ops: readonly JsonMapOp[]
): Readonly<Record<string, unknown>> {
  let current: Record<string, unknown> = { ...obj };

  for (const op of ops) {
    switch (op.op) {
      case JsonMapOpKind.RENAME:
      case DATA_TRANSFORM_CONSTANTS.OP_RENAME: {
        if (op.from in current) {
          const next: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(current)) {
            if (k === op.from) {
              next[op.to] = v;
            } else {
              next[k] = v;
            }
          }
          current = next;
        }
        break;
      }
      case JsonMapOpKind.PICK:
      case DATA_TRANSFORM_CONSTANTS.OP_PICK: {
        const picked: Record<string, unknown> = {};
        const keys = 'keys' in op && Array.isArray(op.keys) ? op.keys : ('fields' in op && Array.isArray(op.fields) ? op.fields : []);
        for (const k of keys) {
          if (k in current) {
            picked[k] = current[k];
          }
        }
        current = picked;
        break;
      }
      case JsonMapOpKind.OMIT:
      case DATA_TRANSFORM_CONSTANTS.OP_OMIT: {
        const omitKeys = new Set(
          'keys' in op && Array.isArray(op.keys) ? op.keys : ('fields' in op && Array.isArray(op.fields) ? op.fields : [])
        );
        const next: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(current)) {
          if (!omitKeys.has(k)) {
            next[k] = v;
          }
        }
        current = next;
        break;
      }
      case JsonMapOpKind.DEFAULT:
      case DATA_TRANSFORM_CONSTANTS.OP_DEFAULT: {
        const k = 'key' in op && op.key ? op.key : ('field' in op && op.field ? op.field : DATA_TRANSFORM_CONSTANTS.EMPTY_STRING);
        if (k && (!(k in current) || current[k] === undefined || current[k] === null)) {
          current = { ...current, [k]: op.value };
        }
        break;
      }
      case JsonMapOpKind.COERCE:
      case DATA_TRANSFORM_CONSTANTS.OP_COERCE: {
        const k = 'key' in op && op.key ? op.key : ('field' in op && op.field ? op.field : DATA_TRANSFORM_CONSTANTS.EMPTY_STRING);
        if (k && k in current) {
          current = { ...current, [k]: coerceValue(current[k], op.to) };
        }
        break;
      }
    }
  }

  return Object.freeze(current);
}
