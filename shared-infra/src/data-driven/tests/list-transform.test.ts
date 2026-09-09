import { describe, it, expect } from 'vitest';
import { transformList } from '../list-transform';
import { mapJson } from '../json-map';
import { ListOpKind, SortDirection, JsonMapOpKind, CoerceTarget } from '../transform.types';

describe('Data-Driven Transforms - Immutability & Pure Functions', () => {
  describe('transformList - Non-Mutating Pure List Operations', () => {
    it('does NOT mutate the input array when sorting, and handles frozen input arrays', () => {
      const input = Object.freeze([
        Object.freeze({ id: '2', score: 20 }),
        Object.freeze({ id: '1', score: 10 }),
        Object.freeze({ id: '3', score: 30 }),
      ]);

      const originalOrder = [...input];

      const sorted = transformList(input, [
        { op: ListOpKind.SORT, field: 'score', direction: SortDirection.ASC },
      ]);

      // Original input was NOT mutated
      expect(input[0].id).toBe(originalOrder[0].id);
      expect(input[1].id).toBe(originalOrder[1].id);
      expect(input[2].id).toBe(originalOrder[2].id);

      // Result is correctly sorted
      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');

      // Result and items are deeply frozen
      expect(Object.isFrozen(sorted)).toBe(true);
      expect(Object.isFrozen(sorted[0])).toBe(true);
    });

    it('filters and searches without mutating original lists', () => {
      const input = Object.freeze([
        { id: '1', name: 'Alpha Service', active: true },
        { id: '2', name: 'Beta Worker', active: false },
        { id: '3', name: 'Gamma Service', active: true },
      ]);

      const filtered = transformList(input, [
        { op: ListOpKind.FILTER, field: 'active', value: true },
        { op: ListOpKind.SEARCH, fields: ['name'], query: 'service' },
      ]);

      expect(input.length).toBe(3);
      expect(filtered.length).toBe(2);
      expect(filtered.map((r) => r.id)).toEqual(['1', '3']);
      expect(Object.isFrozen(filtered)).toBe(true);
    });

    it('picks specific fields into new immutable objects without mutating sources', () => {
      const input = Object.freeze([
        { id: '1', secret: '123', name: 'Visible' },
      ]);

      const picked = transformList(input, [
        { op: ListOpKind.PICK, fields: ['id', 'name'] },
      ]);

      expect(picked[0]).toEqual({ id: '1', name: 'Visible' });
      expect('secret' in picked[0]).toBe(false);
      expect('secret' in input[0]).toBe(true);
      expect(Object.isFrozen(picked)).toBe(true);
      expect(Object.isFrozen(picked[0])).toBe(true);
    });

    it('paginates lists purely', () => {
      const input = Object.freeze([
        { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' },
      ]);

      const paged = transformList(input, [
        { op: ListOpKind.PAGINATE, page: 2, pageSize: 2 },
      ]);

      expect(paged.length).toBe(2);
      expect(paged[0].id).toBe('3');
      expect(paged[1].id).toBe('4');
      expect(Object.isFrozen(paged)).toBe(true);
    });
  });

  describe('mapJson - Pure Non-Mutating JSON Transformations', () => {
    it('renames, omits, defaults, and coerces fields without mutating input', () => {
      const source = Object.freeze({
        user_name: 'alice',
        age_str: '28',
        internal_key: 'sensitive',
      });

      const mapped = mapJson(source, [
        { op: JsonMapOpKind.RENAME, from: 'user_name', to: 'username' },
        { op: JsonMapOpKind.COERCE, field: 'age_str', to: CoerceTarget.NUMBER },
        { op: JsonMapOpKind.DEFAULT, field: 'role', value: 'developer' },
        { op: JsonMapOpKind.OMIT, fields: ['internal_key'] },
      ]);

      // Original source untouched
      expect(source).toEqual({
        user_name: 'alice',
        age_str: '28',
        internal_key: 'sensitive',
      });

      // Mapped result matches contract
      expect(mapped).toEqual({
        username: 'alice',
        age_str: 28,
        role: 'developer',
      });
      expect('internal_key' in mapped).toBe(false);
      expect(Object.isFrozen(mapped)).toBe(true);
    });
  });
});
