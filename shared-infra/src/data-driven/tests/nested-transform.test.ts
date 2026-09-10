import { describe, it, expect } from 'vitest';
import {
  getIn,
  setIn,
  updateIn,
  mergeNested,
  flattenNested,
  unflattenNested,
} from '../transforms/nested-transform';

describe('Data-Driven Nested Transforms - Pure Functional & Immutable', () => {
  it('gets nested path values cleanly without erroring on missing paths', () => {
    const data = Object.freeze({
      user: Object.freeze({
        profile: Object.freeze({
          name: 'Alice',
        }),
      }),
    });

    expect(getIn(data, ['user', 'profile', 'name'])).toBe('Alice');
    expect(getIn(data, ['user', 'profile', 'age'])).toBeUndefined();
    expect(getIn(data, ['user', 'nonexistent', 'key'])).toBeUndefined();
  });

  it('sets nested path values immutably without mutating original objects', () => {
    const initial = Object.freeze({
      a: Object.freeze({ b: 1 }),
    });

    const updated = setIn(initial, ['a', 'c'], 2);

    expect(initial).toEqual({ a: { b: 1 } });
    expect(updated).toEqual({ a: { b: 1, c: 2 } });
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.a)).toBe(true);
  });

  it('updates nested path values immutably via updater function', () => {
    const initial = Object.freeze({
      counter: Object.freeze({ count: 5 }),
    });

    const updated = updateIn(initial, ['counter', 'count'], (val) => (val as number) + 10);

    expect(initial.counter.count).toBe(5);
    expect((updated.counter as Record<string, number>).count).toBe(15);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('merges deeply nested objects immutably', () => {
    const target = Object.freeze({
      config: Object.freeze({ theme: 'light', debug: false }),
    });
    const source = Object.freeze({
      config: Object.freeze({ theme: 'dark', version: 2 }),
    });

    const merged = mergeNested(target, source);

    expect(merged).toEqual({
      config: { theme: 'dark', debug: false, version: 2 },
    });
    expect(Object.isFrozen(merged)).toBe(true);
    expect(Object.isFrozen(merged.config)).toBe(true);
  });

  it('flattens and unflattens nested structures losslessly and immutably', () => {
    const nested = Object.freeze({
      app: Object.freeze({
        server: Object.freeze({
          port: 8080,
        }),
      }),
    });

    const flat = flattenNested(nested, '.');
    expect(flat).toEqual({ 'app.server.port': 8080 });
    expect(Object.isFrozen(flat)).toBe(true);

    const restored = unflattenNested(flat, '.');
    expect(restored).toEqual(nested);
    expect(Object.isFrozen(restored)).toBe(true);
  });
});
