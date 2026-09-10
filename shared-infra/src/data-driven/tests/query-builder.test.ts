import { describe, it, expect } from 'vitest';
import {
  evaluateWhereClauses,
  evaluateOrdering,
  evaluateGrouping,
  evaluateLimitOffset,
  paginateQuery,
  paginateCursor,
} from '../transforms/query-builder';

describe('Query Builder & Evaluator Suite', () => {
  const collection = Object.freeze([
    { id: '1', name: 'Alice', age: 30, status: 'active', tags: ['admin', 'dev'], createdAt: '2026-01-15T10:00:00Z', embedding: [1, 0, 0] },
    { id: '2', name: 'Bob', age: 25, status: 'inactive', tags: ['user'], createdAt: '2026-02-20T12:00:00Z', embedding: [0, 1, 0] },
    { id: '3', name: 'Charlie', age: 40, status: 'active', tags: ['admin'], createdAt: '2026-03-10T14:00:00Z', embedding: [0.9, 0.1, 0] },
  ]);

  it('evaluates basic, nested, date, and json where clauses', () => {
    const activeDevs = evaluateWhereClauses(collection, [
      { kind: 'basic', field: 'status', operator: 'eq', value: 'active', boolean: 'and' },
      { kind: 'json', path: 'tags', op: 'contains', value: 'admin', boolean: 'and' },
    ]);

    expect(activeDevs.length).toBe(2);
    expect(activeDevs.map((r) => r.name)).toEqual(['Alice', 'Charlie']);

    const dateFiltered = evaluateWhereClauses(collection, [
      { kind: 'date', field: 'createdAt', part: 'month', operator: '>=', value: 2, boolean: 'and' },
    ]);
    expect(dateFiltered.length).toBe(2);
    expect(dateFiltered.map((r) => r.name)).toEqual(['Bob', 'Charlie']);
  });

  it('evaluates vector similarity clauses', () => {
    const similar = evaluateWhereClauses(collection, [
      { kind: 'vector_similarity', vectorField: 'embedding', targetVector: [1, 0, 0], minSimilarity: 0.8, boolean: 'and' },
    ]);

    expect(similar.length).toBe(2);
    expect(similar.map((r) => r.name)).toEqual(['Alice', 'Charlie']);
  });

  it('evaluates ordering, grouping, and limit/offset', () => {
    const sorted = evaluateOrdering(collection, [{ field: 'age', direction: 'desc' }]);
    expect(sorted[0].name).toBe('Charlie');
    expect(sorted[2].name).toBe('Bob');

    const grouped = evaluateGrouping(collection, {
      fields: ['status'],
      having: [{ field: 'age', aggregate: 'avg', operator: '>=', value: 30 }],
    });
    expect(Object.keys(grouped)).toEqual(['active']);

    const sliced = evaluateLimitOffset(collection, { limit: 1, offset: 1 });
    expect(sliced.length).toBe(1);
    expect(sliced[0].name).toBe('Bob');
  });

  it('paginates collections with length-aware pagination', () => {
    const pageResult = paginateQuery(collection, { page: 1, pageSize: 2, url: 'https://example.com/users' });

    expect(pageResult.total).toBe(3);
    expect(pageResult.lastPage).toBe(2);
    expect(pageResult.items.length).toBe(2);
    expect(pageResult.nextPageUrl).toBe('https://example.com/users?page=2&pageSize=2');
    expect(pageResult.prevPageUrl).toBeNull();
  });

  it('paginates collections with cursor pagination', () => {
    const cursorResult = paginateCursor(collection, { pageSize: 2, cursorField: 'id' });

    expect(cursorResult.items.length).toBe(2);
    expect(cursorResult.hasMore).toBe(true);
    expect(cursorResult.nextCursor).toBeDefined();

    const nextResult = paginateCursor(collection, { pageSize: 2, cursor: cursorResult.nextCursor!, cursorField: 'id' });
    expect(nextResult.items.length).toBe(1);
    expect(nextResult.items[0].name).toBe('Charlie');
  });
});
