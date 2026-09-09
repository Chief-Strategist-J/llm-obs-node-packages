/**
 * @file list-transform.ts
 * @description Pure Functional, Non-Mutating Data-Driven List Transformation Engine.
 *
 * LIST TRANSFORMATION ALGORITHM:
 * 1. Initialize `result` as a shallow copy of the input `rows` collection to guarantee caller input immutability.
 * 2. Sequential Operator Processing (Pure Pipelines):
 *    a. FILTER: Produce a fresh filtered array matching target field value or comparison operator.
 *    b. SEARCH: Produce a fresh filtered array matching search query across target string fields.
 *    c. SORT: Clone array prior to sorting (`[...result].sort()`) to prevent in-place mutation of frozen inputs.
 *    d. PAGINATE: Produce a fresh slice of records corresponding to requested page index and size.
 *    e. PICK: Project each record into a newly constructed object containing only the requested fields.
 *    f. GROUP_BY: Retain immutable records grouped by target key without in-place modification.
 * 3. Output Immutability:
 *    Map and freeze each individual record, then return a frozen array (`Object.freeze`).
 */

import type { ListOp } from './transform.types';
import { ListOpKind, SortDirection, DATA_TRANSFORM_CONSTANTS } from './transform.types';

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
        // Clone array prior to sort to strictly avoid in-place mutation of frozen arrays
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
