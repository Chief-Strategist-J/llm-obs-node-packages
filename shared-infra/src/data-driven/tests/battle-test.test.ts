import { describe, it, expect } from 'vitest';
import { createDataPipeline } from '../pipeline/data-pipeline';
import { evaluateWhereClauses, paginateCursor } from '../transforms/query-builder';

describe('Battle-Tested Stress & Edge Case Test Suite', () => {
  it('Edge Case 1: Handles prototype pollution attempts, dangerous keys, and deeply nested paths', () => {
    const maliciousObj1: Record<string, unknown> = { id: 'user1' };
    (maliciousObj1 as any)['__proto__'] = { admin: true };
    (maliciousObj1 as any)['constructor'] = { name: 'Fake' };
    maliciousObj1.meta = {
      profile: {
        deep: {
          level4: {
            level5: { secret: 'top_secret', score: 100 },
          },
        },
      },
    };

    const maliciousObj2: Record<string, unknown> = {
      id: 'user2',
      meta: null,
    };

    const maliciousPayload = Object.freeze([
      Object.freeze(maliciousObj1),
      Object.freeze(maliciousObj2),
    ]);

    const pipeline = createDataPipeline(maliciousPayload)
      .where('meta.profile.deep.level4.level5.score', '>=', 50)
      .makeHidden(['meta.profile.deep.level4.level5.secret']);

    const envelope = pipeline.executeEnveloped('BattleTestPrototypePollution');

    expect(envelope.success).toBe(true);
    expect(envelope.data.length).toBe(1);
    const item = envelope.data[0];
    expect(item.id).toBe('user1');
    expect('secret' in (item.meta?.profile?.deep?.level4?.level5 || {})).toBe(false);
  });

  it('Edge Case 2: Handles null, undefined, NaN, and malformed inputs gracefully without throwing', () => {
    const chaoticCollection = Object.freeze([
      { id: 'c1', val: null, date: 'invalid-date', vec: [NaN, Infinity] },
      { id: 'c2', val: undefined, date: null, vec: undefined },
      { id: 'c3', val: 50, date: '2026-05-10T00:00:00Z', vec: [0.5, 0.5] },
    ]);

    const filtered = evaluateWhereClauses(chaoticCollection, [
      { kind: 'basic', field: 'val', operator: 'gt', value: 10, boolean: 'and' },
    ]);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('c3');

    const dateFiltered = evaluateWhereClauses(chaoticCollection, [
      { kind: 'date', field: 'date', part: 'year', operator: 'eq', value: 2026, boolean: 'and' },
    ]);
    expect(dateFiltered.length).toBe(1);
    expect(dateFiltered[0].id).toBe('c3');
  });

  it('Edge Case 3: Executes full 8-relationship multi-model join in a single composite pipeline', () => {
    const users = Object.freeze([{ id: 'u1', name: 'Alice' }]);
    const profiles = Object.freeze([{ id: 'p1', userId: 'u1', bio: 'Bio 1' }]);
    const posts = Object.freeze([{ id: 'post1', userId: 'u1', title: 'Post 1' }]);
    const roles = Object.freeze([{ id: 'r1', name: 'Admin' }]);
    const rolePivot = Object.freeze([{ userId: 'u1', roleId: 'r1' }]);
    const mechanics = Object.freeze([{ id: 'm1', name: 'Mike' }]);
    const cars = Object.freeze([{ id: 'car1', mechanicId: 'm1', ownerId: 'u1' }]);
    const countryUsers = Object.freeze([{ id: 'u1', countryId: 'cnt1' }]);
    const countryPosts = Object.freeze([{ id: 'post1', userId: 'u1', title: 'USA Post' }]);
    const avatars = Object.freeze([{ id: 'av1', imageableType: 'User', imageableId: 'u1', url: 'avatar.png' }]);
    const comments = Object.freeze([{ id: 'cm1', commentableType: 'User', commentableId: 'u1', text: 'Comment 1' }]);
    const tags = Object.freeze([{ id: 't1', name: 'Dev' }]);
    const taggables = Object.freeze([{ tagId: 't1', taggableType: 'User', taggableId: 'u1' }]);

    const pipeline = createDataPipeline(users)
      .loadOneToOne(profiles, { localKey: 'id', foreignKey: 'userId', as: 'profile' })
      .loadOneToMany(posts, { localKey: 'id', foreignKey: 'userId', as: 'posts' })
      .loadManyToMany(roles, { pivotStore: rolePivot, foreignPivotKey: 'userId', relatedPivotKey: 'roleId', parentLocalKey: 'id', relatedLocalKey: 'id', as: 'roles' })
      .loadHasOneThrough(cars, users, { throughForeignKey: 'mechanicId', throughLocalKey: 'ownerId', foreignKey: 'id', localKey: 'id', as: 'ownerCar' })
      .loadHasManyThrough(countryUsers, countryPosts, { throughForeignKey: 'countryId', throughLocalKey: 'id', foreignKey: 'userId', localKey: 'id', as: 'countryPosts' })
      .loadOneToOnePolymorphic(avatars, { typeField: 'imageableType', idField: 'imageableId', entityType: 'User', localKey: 'id', as: 'avatar' })
      .loadOneToManyPolymorphic(comments, { typeField: 'commentableType', idField: 'commentableId', entityType: 'User', localKey: 'id', as: 'comments' })
      .loadManyToManyPolymorphic(tags, { pivotStore: taggables, pivotTypeField: 'taggableType', pivotIdField: 'taggableId', relatedPivotKey: 'tagId', entityType: 'User', parentLocalKey: 'id', relatedLocalKey: 'id', as: 'tags' });

    const envelope = pipeline.executeEnveloped('Composite8RelationshipPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.pipelineMeta.stepsExecuted).toBe(8);
    const user = envelope.data[0];
    expect(user.profile.bio).toBe('Bio 1');
    expect(user.posts.length).toBe(1);
    expect(user.roles.length).toBe(1);
    expect(user.avatar.url).toBe('avatar.png');
    expect(user.comments.length).toBe(1);
    expect(user.tags.length).toBe(1);
  });

  it('Edge Case 4: Guarantees strict immutability across 100+ items and multiple pipeline stages', () => {
    const dataset = Object.freeze(
      Array.from({ length: 50 }, (_, i) => Object.freeze({ id: `id_${i}`, score: i, active: i % 2 === 0 }))
    );

    const pipeline = createDataPipeline(dataset)
      .where('active', 'eq', true)
      .orderBy('score', 'desc')
      .append('doubleScore', (item) => item.score * 2)
      .makeHidden(['score'])
      .paginate({ page: 1, pageSize: 5 });

    const envelope = pipeline.executeEnveloped('ImmutabilityStressTest');

    expect(Object.isFrozen(dataset)).toBe(true);
    expect(Object.isFrozen(dataset[0])).toBe(true);
    expect(Object.isFrozen(envelope.data.items)).toBe(true);
    expect(Object.isFrozen(envelope.data.items[0])).toBe(true);
  });

  it('Edge Case 5: Cursor pagination fallback under invalid or out-of-bounds cursors', () => {
    const dataset = Object.freeze([
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ]);

    const resultWithInvalidCursor = paginateCursor(dataset, { pageSize: 1, cursor: 'invalid_base64_string!!!' });
    expect(resultWithInvalidCursor.items.length).toBe(1);
    expect(resultWithInvalidCursor.items[0].id).toBe('1');
  });

  it('Edge Case 6: Handles deep nested arrays of arrays of objects (nest1 -> nest4[] -> nest2[] -> nest2)', () => {
    const complexNestedDataset = Object.freeze([
      {
        id: 'u1',
        nest1: {
          nest2: 'val',
          nest4: [
            {
              nest2: [
                { nest2: 'target_1', secret: 'hide_me_1' },
                { nest2: 'target_2', secret: 'hide_me_2' },
              ],
            },
            { nest2: 'target_3', secret: 'hide_me_3' },
          ],
        },
      },
    ]);

    const pipeline = createDataPipeline(complexNestedDataset)
      .whereJsonContains('nest1.nest4.nest2.nest2', 'target_1')
      .makeHidden(['nest1.nest4.nest2.secret']);

    const envelope = pipeline.executeEnveloped('DeepNestedArrayPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.data.length).toBe(1);

    const leafValues = (envelope.data[0] as any).nest1.nest4[0].nest2;
    expect(leafValues[0].nest2).toBe('target_1');
    expect('secret' in leafValues[0]).toBe(false);
  });
});
