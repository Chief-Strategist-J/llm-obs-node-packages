import type { Path } from '../types/transform.types';
import { deepGet } from '../../utils/json-utils';

export interface DeepPathMapping {
  readonly from: string;
  readonly to: string;
  readonly default?: unknown;
  readonly transform?: (val: unknown) => unknown;
}

export function remapDeepPaths(
  source: Readonly<Record<string, unknown>>,
  mappings: readonly DeepPathMapping[]
): Readonly<Record<string, unknown>> {
  let result: Record<string, unknown> = {};

  for (const map of mappings) {
    const rawVal = deepGet(source, map.from);
    const val = rawVal !== undefined ? rawVal : map.default;
    if (val !== undefined) {
      const finalVal = map.transform ? map.transform(val) : val;
      const pathParts = map.to.split('.');
      result = setIn(result, pathParts, finalVal) as Record<string, unknown>;
    }
  }

  return Object.freeze(result);
}

export function getIn(target: Readonly<Record<string, unknown>>, path: Path): unknown {
  let current: unknown = target;
  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

export function setIn(
  target: Readonly<Record<string, unknown>>,
  path: Path,
  value: unknown
): Readonly<Record<string, unknown>> {
  if (path.length === 0) {
    return Object.freeze(value as Record<string, unknown>);
  }

  const [head, ...tail] = path;
  const key = String(head);

  if (path.length === 1) {
    const updated = { ...target, [key]: value };
    return Object.freeze(updated);
  }

  const childTarget = (target[key] && typeof target[key] === 'object' ? target[key] : {}) as Record<string, unknown>;
  const updatedChild = setIn(childTarget, tail, value);
  const updated = { ...target, [key]: updatedChild };
  return Object.freeze(updated);
}

export function updateIn(
  target: Readonly<Record<string, unknown>>,
  path: Path,
  updater: (val: unknown) => unknown
): Readonly<Record<string, unknown>> {
  const currentVal = getIn(target, path);
  const nextVal = updater(currentVal);
  return setIn(target, path, nextVal);
}

export function mergeNested(
  target: Readonly<Record<string, unknown>>,
  source: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = { ...target };

  for (const [key, sourceVal] of Object.entries(source)) {
    const targetVal = result[key];
    if (
      targetVal &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal) &&
      sourceVal &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = mergeNested(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else if (Array.isArray(sourceVal)) {
      result[key] = Object.freeze([...sourceVal]);
    } else {
      result[key] = sourceVal;
    }
  }

  return Object.freeze(result);
}

export function flattenNested(
  target: Readonly<Record<string, unknown>>,
  delimiter: string
): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};

  function recurse(current: Readonly<Record<string, unknown>>, prefix: string): void {
    for (const [key, value] of Object.entries(current)) {
      const newKey = prefix ? `${prefix}${delimiter}${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        recurse(value as Record<string, unknown>, newKey);
      } else {
        result[newKey] = value;
      }
    }
  }

  recurse(target, '');
  return Object.freeze(result);
}

export function unflattenNested(
  target: Readonly<Record<string, unknown>>,
  delimiter: string
): Readonly<Record<string, unknown>> {
  let result: Record<string, unknown> = {};

  for (const [flatKey, value] of Object.entries(target)) {
    const path = flatKey.split(delimiter);
    result = setIn(result, path, value) as Record<string, unknown>;
  }

  return Object.freeze(result);
}
