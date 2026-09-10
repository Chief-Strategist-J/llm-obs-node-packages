/**
 * ALGORITHM SPECIFICATION:
 * 1. Pure non-mutating collection & model operations over immutable nested & unstructured JSON collections.
 * 2. Immutably append dynamic properties, strip flat or deeply nested dot-path fields (except, makeHidden), pick fields (only, makeVisible).
 * 3. Evaluate collection diffs, intersections, key extractions, fresh model lookup, partitioning, and unique key deduplication using deep path accessors.
 */

import {
  deepGet,
  deepSet,
  pickKeys,
  omitKeys,
  deepPick,
  jsonToQueryString,
} from '../../utils/json-utils';
import { partitionList, distinctByList } from './list-transform';

function omitDotPath(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return obj;

  const parts = path.split('.');
  if (parts.length === 1) {
    const key = parts[0].replace(/\[\*\]$/, '');
    if (Array.isArray(obj)) {
      return Object.freeze(obj.map((item) => omitDotPath(item, key)));
    }
    if (typeof obj === 'object') {
      return omitKeys(obj as Record<string, unknown>, [key]);
    }
    return obj;
  }

  const [head, ...tail] = parts;
  const cleanHead = head.replace(/\[\*\]$/, '');
  const restPath = tail.join('.');

  if (Array.isArray(obj)) {
    return Object.freeze(obj.map((item) => omitDotPath(item, path)));
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (!(cleanHead in record) || record[cleanHead] === null) {
      return record;
    }
    const updatedChild = omitDotPath(record[cleanHead], restPath);
    return Object.freeze({
      ...record,
      [cleanHead]: updatedChild,
    });
  }

  return obj;
}

export function appendItem<T extends Record<string, unknown>>(
  collection: readonly T[],
  key: string,
  computer: (item: T) => unknown
): readonly T[] {
  const result = collection.map((item) => {
    const val = computer(item);
    return Object.freeze(deepSet(item, key, val)) as T;
  });
  return Object.freeze(result);
}

export function setAppends<T extends Record<string, unknown>>(
  collection: readonly T[],
  appends: Readonly<Record<string, (item: T) => unknown>>
): readonly T[] {
  let result = collection;
  for (const [key, computer] of Object.entries(appends)) {
    result = appendItem(result, key, computer);
  }
  return result;
}

export function withoutAppends<T extends Record<string, unknown>>(
  collection: readonly T[],
  appendKeys: readonly string[]
): readonly T[] {
  return exceptKeys(collection, appendKeys);
}

export function containsItem<T extends Record<string, unknown>>(
  collection: readonly T[],
  keyOrPredicate: string | ((item: T) => boolean),
  value?: unknown
): boolean {
  if (typeof keyOrPredicate === 'function') {
    return collection.some(keyOrPredicate as (item: T) => boolean);
  }
  return collection.some((item) => deepGet(item, keyOrPredicate) === value);
}

export function diffCollection<T extends Record<string, unknown>>(
  collectionA: readonly T[],
  collectionB: readonly T[],
  keyField = 'id'
): readonly T[] {
  const keysB = new Set(collectionB.map((b) => deepGet(b, keyField)));
  const diff = collectionA.filter((a) => !keysB.has(deepGet(a, keyField)));
  return Object.freeze(diff.map((item) => Object.freeze({ ...item })));
}

export function intersectCollection<T extends Record<string, unknown>>(
  collectionA: readonly T[],
  collectionB: readonly T[],
  keyField = 'id'
): readonly T[] {
  const keysB = new Set(collectionB.map((b) => deepGet(b, keyField)));
  const intersected = collectionA.filter((a) => keysB.has(deepGet(a, keyField)));
  return Object.freeze(intersected.map((item) => Object.freeze({ ...item })));
}

export function exceptKeys<T extends Record<string, unknown>>(
  collection: readonly T[],
  keys: readonly string[]
): readonly T[] {
  const result = collection.map((item) => {
    let current: Record<string, unknown> = { ...item };
    for (const key of keys) {
      if (key.includes('.')) {
        current = omitDotPath(current, key) as Record<string, unknown>;
      } else {
        current = omitKeys(current, [key]) as Record<string, unknown>;
      }
    }
    return Object.freeze(current) as T;
  });
  return Object.freeze(result);
}

export function onlyKeys<T extends Record<string, unknown>>(
  collection: readonly T[],
  keys: readonly string[]
): readonly T[] {
  const hasNested = keys.some((k) => k.includes('.'));
  const result = collection.map((item) =>
    Object.freeze(hasNested ? deepPick(item, keys) : pickKeys(item, keys as any))
  ) as unknown as readonly T[];
  return Object.freeze(result);
}

export function findInCollection<T extends Record<string, unknown>>(
  collection: readonly T[],
  idOrPredicate: unknown | ((item: T) => boolean),
  idField = 'id'
): T | undefined {
  if (typeof idOrPredicate === 'function') {
    return collection.find(idOrPredicate as (item: T) => boolean);
  }
  return collection.find((item) => deepGet(item, idField) === idOrPredicate);
}

export function findOrFailInCollection<T extends Record<string, unknown>>(
  collection: readonly T[],
  idOrPredicate: unknown | ((item: T) => boolean),
  idField = 'id'
): T {
  const found = findInCollection(collection, idOrPredicate, idField);
  if (!found) {
    throw new Error(`Model missing or not found in collection matching query.`);
  }
  return found;
}

export function freshInCollection<T extends Record<string, unknown>>(
  item: Record<string, unknown>,
  sourceCollection: readonly T[],
  idField = 'id'
): T {
  const idVal = deepGet(item, idField);
  return findOrFailInCollection(sourceCollection, idVal, idField);
}

export function modelKeys<T extends Record<string, unknown>>(
  collection: readonly T[],
  idField = 'id'
): readonly unknown[] {
  const keys = collection.map((item) => deepGet(item, idField));
  return Object.freeze(keys);
}

export function makeHidden<T extends Record<string, unknown>>(
  collection: readonly T[],
  hiddenKeys: readonly string[]
): readonly T[] {
  return exceptKeys(collection, hiddenKeys);
}

export function setHidden<T extends Record<string, unknown>>(
  collection: readonly T[],
  hiddenKeys: readonly string[]
): readonly T[] {
  return makeHidden(collection, hiddenKeys);
}

export function mergeHidden<T extends Record<string, unknown>>(
  collection: readonly T[],
  existingHidden: readonly string[],
  additionalHidden: readonly string[]
): readonly T[] {
  const allHidden = [...new Set([...existingHidden, ...additionalHidden])];
  return makeHidden(collection, allHidden);
}

export function makeVisible<T extends Record<string, unknown>>(
  collection: readonly T[],
  sourceCollection: readonly T[],
  visibleKeys: readonly string[],
  idField = 'id'
): readonly T[] {
  const sourceMap = new Map(sourceCollection.map((s) => [deepGet(s, idField), s]));
  const hasNested = visibleKeys.some((k) => k.includes('.'));

  const result = collection.map((item) => {
    const idVal = deepGet(item, idField);
    const original = sourceMap.get(idVal) || item;
    const restoredFields = hasNested ? deepPick(original, visibleKeys) : pickKeys(original, visibleKeys as any);
    return Object.freeze({
      ...item,
      ...restoredFields,
    }) as T;
  });
  return Object.freeze(result);
}

export function setVisible<T extends Record<string, unknown>>(
  collection: readonly T[],
  sourceCollection: readonly T[],
  visibleKeys: readonly string[],
  idField = 'id'
): readonly T[] {
  return makeVisible(collection, sourceCollection, visibleKeys, idField);
}

export function mergeVisible<T extends Record<string, unknown>>(
  collection: readonly T[],
  sourceCollection: readonly T[],
  existingVisible: readonly string[],
  additionalVisible: readonly string[],
  idField = 'id'
): readonly T[] {
  const allVisible = [...new Set([...existingVisible, ...additionalVisible])];
  return makeVisible(collection, sourceCollection, allVisible, idField);
}

export function partitionCollection<T extends Record<string, unknown>>(
  collection: readonly T[],
  predicate: (item: T) => boolean
): readonly [readonly T[], readonly T[]] {
  return partitionList(collection, predicate);
}

export function uniqueCollection<T extends Record<string, unknown>>(
  collection: readonly T[],
  keyField = 'id'
): readonly T[] {
  return distinctByList(collection, keyField);
}

export function toQueryStringCollection<T extends Record<string, unknown>>(
  item: T
): string {
  return jsonToQueryString(item);
}
