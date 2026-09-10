import type { ListOp } from '../types/transform.types';
import { ListOpKind, SortDirection, DATA_TRANSFORM_CONSTANTS } from '../types/transform.types';

export function transformList<T extends Record<string, unknown>>(
  rows: readonly T[],
  ops: readonly ListOp[]
): readonly T[] {
  let result: T[] = [...rows];

  for (const op of ops) {
    switch (op.op) {
      case ListOpKind.FILTER:
      case DATA_TRANSFORM_CONSTANTS.OP_FILTER: {
        result = result.filter((row) => row[op.field] === op.value);
        break;
      }
      case ListOpKind.SEARCH:
      case DATA_TRANSFORM_CONSTANTS.OP_SEARCH: {
        const q = op.query.toLowerCase();
        result = result.filter((row) =>
          op.fields.some((field) => {
            const val = row[field];
            return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
          })
        );
        break;
      }
      case ListOpKind.SORT:
      case DATA_TRANSFORM_CONSTANTS.OP_SORT: {
        const sortDir = 'dir' in op && op.dir ? op.dir : ('direction' in op && op.direction ? op.direction : SortDirection.ASC);
        const dir = sortDir === SortDirection.ASC ? 1 : -1;
        result = [...result].sort((a, b) => {
          const aVal = a[op.field];
          const bVal = b[op.field];
          if (aVal === bVal) return 0;
          if (aVal === undefined || aVal === null) return 1;
          if (bVal === undefined || bVal === null) return -1;
          return aVal < bVal ? -dir : dir;
        });
        break;
      }
      case ListOpKind.PAGINATE:
      case DATA_TRANSFORM_CONSTANTS.OP_PAGINATE: {
        const start = (op.page - 1) * op.pageSize;
        result = result.slice(start, start + op.pageSize);
        break;
      }
      case ListOpKind.PICK:
      case DATA_TRANSFORM_CONSTANTS.OP_PICK: {
        result = result.map((row) => {
          const picked = {} as Record<string, unknown>;
          for (const field of op.fields) {
            if (field in row) {
              picked[field] = row[field];
            }
          }
          return picked as T;
        });
        break;
      }
      case ListOpKind.GROUP_BY:
      case DATA_TRANSFORM_CONSTANTS.OP_GROUP_BY: {
        break;
      }
    }
  }

  const frozenItems = result.map((item) => Object.freeze({ ...item }));
  return Object.freeze(frozenItems) as readonly T[];
}

export function groupByList<T extends Record<string, unknown>>(
  rows: readonly T[],
  key: string
): Readonly<Record<string, readonly T[]>> {
  const grouped: Record<string, T[]> = {};
  for (const row of rows) {
    const k = String(row[key] ?? '');
    if (!grouped[k]) {
      grouped[k] = [];
    }
    grouped[k].push({ ...row });
  }

  const frozenGrouped: Record<string, readonly T[]> = {};
  for (const [groupKey, items] of Object.entries(grouped)) {
    frozenGrouped[groupKey] = Object.freeze(items.map((item) => Object.freeze({ ...item })));
  }
  return Object.freeze(frozenGrouped);
}

export function partitionList<T extends Record<string, unknown>>(
  rows: readonly T[],
  predicate: (item: T) => boolean
): readonly [readonly T[], readonly T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const row of rows) {
    if (predicate(row)) {
      pass.push({ ...row });
    } else {
      fail.push({ ...row });
    }
  }
  return Object.freeze([
    Object.freeze(pass.map((item) => Object.freeze({ ...item }))),
    Object.freeze(fail.map((item) => Object.freeze({ ...item }))),
  ]);
}

export function distinctByList<T extends Record<string, unknown>>(
  rows: readonly T[],
  key: string
): readonly T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const row of rows) {
    const val = row[key];
    if (!seen.has(val)) {
      seen.add(val);
      result.push({ ...row });
    }
  }
  return Object.freeze(result.map((item) => Object.freeze({ ...item })));
}
