import { describe, it, expect } from 'vitest';
import {
  appendItem,
  setAppends,
  withoutAppends,
  containsItem,
  diffCollection,
  intersectCollection,
  exceptKeys,
  onlyKeys,
  findInCollection,
  findOrFailInCollection,
  freshInCollection,
  modelKeys,
  makeHidden,
  makeVisible,
  partitionCollection,
  uniqueCollection,
  toQueryStringCollection,
} from '../transforms/collection-transform';

describe('Collection & Model Transforms Suite', () => {
  const collection = Object.freeze([
    { id: '1', name: 'Alice', age: 30, secret: '123' },
    { id: '2', name: 'Bob', age: 20, secret: '456' },
  ]);

  it('handles appends, setAppends, and withoutAppends', () => {
    const appended = appendItem(collection, 'isAdult', (item) => item.age >= 21);
    expect((appended[0] as any).isAdult).toBe(true);
    expect((appended[1] as any).isAdult).toBe(false);

    const stripped = withoutAppends(appended, ['isAdult']);
    expect('isAdult' in stripped[0]).toBe(false);
  });

  it('handles contains, diff, and intersect', () => {
    expect(containsItem(collection, 'name', 'Alice')).toBe(true);
    expect(containsItem(collection, (i) => i.age > 40)).toBe(false);

    const colB = Object.freeze([{ id: '2', name: 'Bob', age: 20, secret: '456' }]);
    const diff = diffCollection(collection, colB);
    expect(diff.length).toBe(1);
    expect(diff[0].name).toBe('Alice');

    const intersect = intersectCollection(collection, colB);
    expect(intersect.length).toBe(1);
    expect(intersect[0].name).toBe('Bob');
  });

  it('handles find, findOrFail, fresh, and modelKeys', () => {
    const found = findInCollection(collection, '2');
    expect(found?.name).toBe('Bob');

    expect(() => findOrFailInCollection(collection, '99')).toThrow();

    const fresh = freshInCollection({ id: '1', name: 'Stale' }, collection);
    expect(fresh.name).toBe('Alice');

    const keys = modelKeys(collection);
    expect(keys).toEqual(['1', '2']);
  });

  it('handles makeHidden and makeVisible', () => {
    const hidden = makeHidden(collection, ['secret']);
    expect('secret' in hidden[0]).toBe(false);

    const visible = makeVisible(hidden, collection, ['secret']);
    expect(visible[0].secret).toBe('123');
  });
});
