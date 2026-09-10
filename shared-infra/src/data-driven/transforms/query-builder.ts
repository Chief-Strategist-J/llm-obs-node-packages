/**
 * ALGORITHM SPECIFICATION:
 * 1. Evaluate single and compound where clauses (Basic, Not, Group, Any/All/None, JSON, Date, Exists, FullText, Vector Similarity).
 * 2. Evaluate single/multi-field ordering, random seeding, and limit/offset slicing immutably.
 * 3. Evaluate grouping and having aggregation predicates (sum, avg, count, min, max).
 * 4. Paginator engines producing length-aware page URLs or base64 cursor tokens.
 */

import { deepGet } from '../../utils/json-utils';
import type {
  WhereClause,
  WhereOperator,
  SortClause,
  GroupByClause,
  LimitOffsetClause,
  LengthAwarePaginationSpec,
  CursorPaginationSpec,
  LengthAwarePaginatorResult,
  CursorPaginatorResult,
} from '../types/query-relation.types';

function matchOperator(val: unknown, op: WhereOperator, target: unknown): boolean {
  if (val === undefined || val === null) {
    if (op === 'null') return true;
    if (op === 'notNull') return false;
    if (op === 'neq' || op === '!=') return target !== val;
    return false;
  }

  switch (op) {
    case 'eq':
    case '=':
      return val === target;
    case 'neq':
    case '!=':
      return val !== target;
    case 'gt':
    case '>':
      return typeof val === 'number' && typeof target === 'number' ? val > target : String(val) > String(target);
    case 'gte':
    case '>=':
      return typeof val === 'number' && typeof target === 'number' ? val >= target : String(val) >= String(target);
    case 'lt':
    case '<':
      return typeof val === 'number' && typeof target === 'number' ? val < target : String(val) < String(target);
    case 'lte':
    case '<=':
      return typeof val === 'number' && typeof target === 'number' ? val <= target : String(val) <= String(target);
    case 'like': {
      if (typeof val !== 'string' || typeof target !== 'string') return false;
      const regexPattern = target.replace(/%/g, '.*').replace(/_/g, '.');
      return new RegExp(`^${regexPattern}$`, 'i').test(val);
    }
    case 'in':
      return Array.isArray(target) && target.includes(val);
    case 'notIn':
      return Array.isArray(target) && !target.includes(val);
    case 'null':
      return val === null || val === undefined;
    case 'notNull':
      return val !== null && val !== undefined;
    case 'between': {
      if (!Array.isArray(target) || target.length < 2) return false;
      const [min, max] = target;
      return matchOperator(val, '>=', min) && matchOperator(val, '<=', max);
    }
    default:
      return false;
  }
}

export function evaluateSingleWhere<T extends Record<string, unknown>>(
  record: T,
  clause: WhereClause
): boolean {
  switch (clause.kind) {
    case 'basic': {
      const val = deepGet(record, clause.field);
      return matchOperator(val, clause.operator, clause.value);
    }

    case 'not': {
      return !evaluateSingleWhere(record, clause.clause);
    }

    case 'group': {
      if (clause.clauses.length === 0) return true;
      let result = evaluateSingleWhere(record, clause.clauses[0]);
      for (let i = 1; i < clause.clauses.length; i++) {
        const sub = clause.clauses[i];
        const pass = evaluateSingleWhere(record, sub);
        result = sub.boolean === 'or' ? result || pass : result && pass;
      }
      return result;
    }

    case 'any_all_none': {
      const passes = clause.clauses.map((c) => evaluateSingleWhere(record, c));
      if (clause.mode === 'any') return passes.some(Boolean);
      if (clause.mode === 'all') return passes.every(Boolean);
      if (clause.mode === 'none') return !passes.some(Boolean);
      return false;
    }

    case 'json': {
      const jsonVal = deepGet(record, clause.path);
      if (clause.op === 'contains') {
        if (Array.isArray(jsonVal)) return jsonVal.includes(clause.value);
        if (typeof jsonVal === 'string' && typeof clause.value === 'string') return jsonVal.includes(clause.value);
        return false;
      }
      if (clause.op === 'length') {
        const len = Array.isArray(jsonVal) ? jsonVal.length : typeof jsonVal === 'string' ? jsonVal.length : 0;
        return len === Number(clause.value);
      }
      return jsonVal === clause.value;
    }

    case 'date': {
      const val = deepGet(record, clause.field);
      const d = val instanceof Date ? val : new Date(String(val));
      if (isNaN(d.getTime())) return false;

      let extracted: unknown = d;
      if (clause.part === 'date') extracted = d.toISOString().split('T')[0];
      if (clause.part === 'month') extracted = d.getUTCMonth() + 1;
      if (clause.part === 'year') extracted = d.getUTCFullYear();
      if (clause.part === 'time') extracted = d.toISOString().split('T')[1].split('.')[0];

      return matchOperator(extracted, clause.operator, clause.value);
    }

    case 'exists': {
      const parentVal = deepGet(record, clause.parentKey);
      if (parentVal === undefined || parentVal === null) return false;
      return clause.subqueryCollection.some((subRecord) => {
        const subVal = deepGet(subRecord, clause.subqueryKey);
        return subVal === parentVal;
      });
    }

    case 'fulltext': {
      const q = clause.query.toLowerCase();
      return clause.fields.some((f) => {
        const val = deepGet(record, f);
        return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
      });
    }

    case 'vector_similarity': {
      const vec = deepGet(record, clause.vectorField);
      if (!Array.isArray(vec) || vec.length !== clause.targetVector.length) return false;

      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vec.length; i++) {
        const a = Number(vec[i]);
        const b = Number(clause.targetVector[i]);
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
      }
      const similarity = normA > 0 && normB > 0 ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
      return similarity >= clause.minSimilarity;
    }

    default:
      return false;
  }
}

export function evaluateWhereClauses<T extends Record<string, unknown>>(
  collection: readonly T[],
  clauses: readonly WhereClause[]
): readonly T[] {
  if (clauses.length === 0) return collection;

  const result = collection.filter((record) => {
    let pass = evaluateSingleWhere(record, clauses[0]);
    for (let i = 1; i < clauses.length; i++) {
      const sub = clauses[i];
      const subPass = evaluateSingleWhere(record, sub);
      pass = sub.boolean === 'or' ? pass || subPass : pass && subPass;
    }
    return pass;
  });

  return Object.freeze(result.map((r) => Object.freeze({ ...r })));
}

export function evaluateOrdering<T extends Record<string, unknown>>(
  collection: readonly T[],
  sorts: readonly SortClause[]
): readonly T[] {
  if (sorts.length === 0) return collection;

  const sorted = [...collection].sort((a, b) => {
    for (const s of sorts) {
      const aVal = deepGet(a, s.field);
      const bVal = deepGet(b, s.field);
      const dir = s.direction === 'asc' ? 1 : -1;

      if (aVal === bVal) continue;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      return aVal < bVal ? -dir : dir;
    }
    return 0;
  });

  return Object.freeze(sorted.map((item) => Object.freeze({ ...item })));
}

export function evaluateInRandomOrder<T extends Record<string, unknown>>(
  collection: readonly T[],
  seed?: number
): readonly T[] {
  const arr = [...collection];
  let currentSeed = seed ?? 42;
  const pseudoRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor((seed !== undefined ? pseudoRandom() : Math.random()) * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return Object.freeze(arr.map((item) => Object.freeze({ ...item })));
}

export function evaluateGrouping<T extends Record<string, unknown>>(
  collection: readonly T[],
  spec: GroupByClause
): Readonly<Record<string, readonly T[]>> {
  const grouped = new Map<string, T[]>();

  for (const item of collection) {
    const groupKey = spec.fields.map((f) => String(deepGet(item, f) ?? '')).join('::');
    const list = grouped.get(groupKey) || [];
    list.push(item);
    grouped.set(groupKey, list);
  }

  const result: Record<string, readonly T[]> = {};
  for (const [key, items] of grouped.entries()) {
    if (spec.having && spec.having.length > 0) {
      const passHaving = spec.having.every((h) => {
        const values = items.map((i) => Number(deepGet(i, h.field) ?? 0));
        let agg = 0;
        if (h.aggregate === 'count') agg = items.length;
        if (h.aggregate === 'sum') agg = values.reduce((a, b) => a + b, 0);
        if (h.aggregate === 'avg') agg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        if (h.aggregate === 'min') agg = values.length > 0 ? Math.min(...values) : 0;
        if (h.aggregate === 'max') agg = values.length > 0 ? Math.max(...values) : 0;

        return matchOperator(agg, h.operator, h.value);
      });
      if (!passHaving) continue;
    }
    result[key] = Object.freeze(items.map((i) => Object.freeze({ ...i })));
  }

  return Object.freeze(result);
}

export function evaluateLimitOffset<T extends Record<string, unknown>>(
  collection: readonly T[],
  spec: LimitOffsetClause
): readonly T[] {
  const sliced = collection.slice(spec.offset, spec.offset + spec.limit);
  return Object.freeze(sliced.map((item) => Object.freeze({ ...item })));
}

export function paginateQuery<T extends Record<string, unknown>>(
  collection: readonly T[],
  spec: LengthAwarePaginationSpec
): LengthAwarePaginatorResult<T> {
  const total = collection.length;
  const page = Math.max(1, spec.page);
  const pageSize = Math.max(1, spec.pageSize);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const start = (page - 1) * pageSize;
  const items = Object.freeze(collection.slice(start, start + pageSize).map((item) => Object.freeze({ ...item })));

  const baseUrl = spec.url || 'https://localhost/api';
  const buildUrl = (p: number) => `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${p}&pageSize=${pageSize}`;

  const nextPageUrl = page < lastPage ? buildUrl(page + 1) : null;
  const prevPageUrl = page > 1 ? buildUrl(page - 1) : null;

  const pageUrls: { page: number; url: string }[] = [];
  for (let p = 1; p <= lastPage; p++) {
    pageUrls.push(Object.freeze({ page: p, url: buildUrl(p) }));
  }

  return Object.freeze({
    items,
    total,
    perPage: pageSize,
    currentPage: page,
    lastPage,
    nextPageUrl,
    prevPageUrl,
    pageUrls: Object.freeze(pageUrls),
  });
}

export function paginateCursor<T extends Record<string, unknown>>(
  collection: readonly T[],
  spec: CursorPaginationSpec
): CursorPaginatorResult<T> {
  const cursorField = spec.cursorField || 'id';
  const pageSize = Math.max(1, spec.pageSize);

  let startIndex = 0;
  if (spec.cursor) {
    try {
      const decodedCursor = typeof Buffer !== 'undefined'
        ? Buffer.from(spec.cursor, 'base64').toString('utf-8')
        : atob(spec.cursor);
      const foundIdx = collection.findIndex((item) => String(deepGet(item, cursorField)) === decodedCursor);
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      }
    } catch {
      startIndex = 0;
    }
  }

  const items = collection.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < collection.length;

  const encodeCursor = (val: unknown) =>
    typeof Buffer !== 'undefined'
      ? Buffer.from(String(val)).toString('base64')
      : btoa(String(val));

  const nextCursor = hasMore && items.length > 0 ? encodeCursor(deepGet(items[items.length - 1], cursorField)) : null;
  const prevCursor = startIndex > 0 && collection.length > 0 ? encodeCursor(deepGet(collection[Math.max(0, startIndex - pageSize)], cursorField)) : null;

  return Object.freeze({
    items: Object.freeze(items.map((i) => Object.freeze({ ...i }))),
    perPage: pageSize,
    nextCursor,
    prevCursor,
    hasMore,
  });
}
