/**
 * ALGORITHM SPECIFICATION:
 * 1. Pure Functional Relationship Engine resolving 8 relational patterns immutably.
 * 2. Hash-indexed joining for 1-to-1, 1-to-many, many-to-many via pivot stores using relationalJoin from json-utils.
 * 3. Intermediate through-collection indexing for HasOneThrough and HasManyThrough queries.
 * 4. Discriminator filtering on type fields for 1-to-1, 1-to-many, and many-to-many polymorphic relations.
 */

import { relationalJoin, deepGet, deepClone } from '../../utils/json-utils';
import type {
  OneToOneSpec,
  OneToManySpec,
  ManyToManySpec,
  HasOneThroughSpec,
  HasManyThroughSpec,
  PolymorphicOneSpec,
  PolymorphicManySpec,
  PolymorphicManyToManySpec,
} from '../types/query-relation.types';

export function loadOneToOne<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: OneToOneSpec
): readonly T[] {
  return relationalJoin(
    parentCollection,
    relatedCollection,
    spec.localKey,
    spec.foreignKey,
    spec.as,
    false
  ) as unknown as readonly T[];
}

export function loadOneToMany<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: OneToManySpec
): readonly T[] {
  return relationalJoin(
    parentCollection,
    relatedCollection,
    spec.localKey,
    spec.foreignKey,
    spec.as,
    true
  ) as unknown as readonly T[];
}

export function loadManyToMany<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: ManyToManySpec
): readonly T[] {
  const relatedMap = new Map<unknown, R>();
  for (const r of relatedCollection) {
    const k = deepGet(r, spec.relatedLocalKey);
    if (k !== undefined && k !== null) {
      relatedMap.set(k, r);
    }
  }

  const pivotGroup = new Map<unknown, R[]>();
  for (const p of spec.pivotStore) {
    const parentFk = deepGet(p, spec.foreignPivotKey);
    const relatedFk = deepGet(p, spec.relatedPivotKey);
    if (parentFk !== undefined && parentFk !== null && relatedFk !== undefined && relatedFk !== null) {
      const relObj = relatedMap.get(relatedFk);
      if (relObj) {
        const list = pivotGroup.get(parentFk) || [];
        list.push(relObj);
        pivotGroup.set(parentFk, list);
      }
    }
  }

  const result = parentCollection.map((parent) => {
    const pk = deepGet(parent, spec.parentLocalKey);
    const matched = pivotGroup.get(pk) || [];
    return Object.freeze({
      ...parent,
      [spec.as]: Object.freeze(matched.map((m) => Object.freeze(deepClone(m)))),
    }) as T;
  });

  return Object.freeze(result);
}

export function loadHasOneThrough<
  T extends Record<string, unknown>,
  Through extends Record<string, unknown>,
  R extends Record<string, unknown>
>(
  parentCollection: readonly T[],
  throughCollection: readonly Through[],
  relatedCollection: readonly R[],
  spec: HasOneThroughSpec
): readonly T[] {
  const throughMap = new Map<unknown, Through>();
  for (const t of throughCollection) {
    const k = deepGet(t, spec.throughForeignKey);
    if (k !== undefined && k !== null) {
      throughMap.set(k, t);
    }
  }

  const relatedMap = new Map<unknown, R>();
  for (const r of relatedCollection) {
    const k = deepGet(r, spec.foreignKey);
    if (k !== undefined && k !== null) {
      relatedMap.set(k, r);
    }
  }

  const result = parentCollection.map((parent) => {
    const pk = deepGet(parent, spec.localKey);
    const throughItem = throughMap.get(pk);
    let matchedRel: R | null = null;
    if (throughItem) {
      const throughPk = deepGet(throughItem, spec.throughLocalKey);
      matchedRel = relatedMap.get(throughPk) ?? null;
    }
    return Object.freeze({
      ...parent,
      [spec.as]: matchedRel ? Object.freeze(deepClone(matchedRel)) : null,
    }) as T;
  });

  return Object.freeze(result);
}

export function loadHasManyThrough<
  T extends Record<string, unknown>,
  Through extends Record<string, unknown>,
  R extends Record<string, unknown>
>(
  parentCollection: readonly T[],
  throughCollection: readonly Through[],
  relatedCollection: readonly R[],
  spec: HasManyThroughSpec
): readonly T[] {
  const throughGroup = new Map<unknown, Through[]>();
  for (const t of throughCollection) {
    const fk = deepGet(t, spec.throughForeignKey);
    if (fk !== undefined && fk !== null) {
      const list = throughGroup.get(fk) || [];
      list.push(t);
      throughGroup.set(fk, list);
    }
  }

  const relatedGroup = new Map<unknown, R[]>();
  for (const r of relatedCollection) {
    const fk = deepGet(r, spec.foreignKey);
    if (fk !== undefined && fk !== null) {
      const list = relatedGroup.get(fk) || [];
      list.push(r);
      relatedGroup.set(fk, list);
    }
  }

  const result = parentCollection.map((parent) => {
    const pk = deepGet(parent, spec.localKey);
    const throughList = throughGroup.get(pk) || [];
    const matchedRelations: R[] = [];
    for (const t of throughList) {
      const throughPk = deepGet(t, spec.throughLocalKey);
      const rels = relatedGroup.get(throughPk) || [];
      matchedRelations.push(...rels);
    }
    return Object.freeze({
      ...parent,
      [spec.as]: Object.freeze(matchedRelations.map((m) => Object.freeze(deepClone(m)))),
    }) as T;
  });

  return Object.freeze(result);
}

export function loadOneToOnePolymorphic<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: PolymorphicOneSpec
): readonly T[] {
  const filteredRelated = relatedCollection.filter(
    (r) => String(deepGet(r, spec.typeField)) === spec.entityType
  );

  return relationalJoin(
    parentCollection,
    filteredRelated,
    spec.localKey,
    spec.idField,
    spec.as,
    false
  ) as unknown as readonly T[];
}

export function loadOneToManyPolymorphic<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: PolymorphicManySpec
): readonly T[] {
  const filteredRelated = relatedCollection.filter(
    (r) => String(deepGet(r, spec.typeField)) === spec.entityType
  );

  return relationalJoin(
    parentCollection,
    filteredRelated,
    spec.localKey,
    spec.idField,
    spec.as,
    true
  ) as unknown as readonly T[];
}

export function loadManyToManyPolymorphic<T extends Record<string, unknown>, R extends Record<string, unknown>>(
  parentCollection: readonly T[],
  relatedCollection: readonly R[],
  spec: PolymorphicManyToManySpec
): readonly T[] {
  const filteredPivots = spec.pivotStore.filter(
    (p) => String(deepGet(p, spec.pivotTypeField)) === spec.entityType
  );

  return loadManyToMany(parentCollection, relatedCollection, {
    pivotStore: filteredPivots,
    foreignPivotKey: spec.pivotIdField,
    relatedPivotKey: spec.relatedPivotKey,
    parentLocalKey: spec.parentLocalKey,
    relatedLocalKey: spec.relatedLocalKey,
    as: spec.as,
  });
}
