import { describe, it, expect } from 'vitest';
import { executeDataDrivenPipeline } from '../index';
import type { DataPipelineSpec } from '../index';

describe('Data Driven Pipeline Interpreter', () => {
  it('executes query building and transformation pipeline entirely driven by a JSON spec', () => {
    const rawUsers = Object.freeze([
      Object.freeze({
        id: 'u1',
        profile: { firstName: 'Alice', lastName: 'Smith', secretKey: 'key_123' },
        tags: ['admin', 'dev'],
        score: 90,
      }),
      Object.freeze({
        id: 'u2',
        profile: { firstName: 'Bob', lastName: 'Jones', secretKey: 'key_456' },
        tags: ['user'],
        score: 60,
      }),
    ]);

    const rawPosts = Object.freeze([
      { id: 'p1', userId: 'u1', title: 'Data Driven Pipelines' },
      { id: 'p2', userId: 'u1', title: 'Pure Functional TS' },
    ]);

    const spec: DataPipelineSpec = Object.freeze({
      name: 'JSONDrivenUserPipeline',
      steps: Object.freeze([
        { type: 'where' as const, field: 'score', operator: '>=' as const, value: 70 },
        { type: 'whereJsonContains' as const, path: 'tags', value: 'dev' },
        {
          type: 'loadOneToMany' as const,
          storeName: 'posts',
          spec: { localKey: 'id', foreignKey: 'userId', as: 'userPosts' },
        },
        { type: 'makeHidden' as const, keys: ['profile.secretKey'] },
        { type: 'orderBy' as const, field: 'score', direction: 'desc' as const },
        { type: 'paginate' as const, spec: { page: 1, pageSize: 10 } },
      ]),
    });

    const envelope = executeDataDrivenPipeline(rawUsers, spec, { posts: rawPosts });

    expect(envelope.success).toBe(true);
    expect(envelope.data.total).toBe(1);
    expect(envelope.data.items.length).toBe(1);

    const user = envelope.data.items[0];
    expect(user.id).toBe('u1');
    expect(user.userPosts.length).toBe(2);
    expect(user.profile.secretKey).toBeUndefined();

    expect(rawUsers[0].profile.secretKey).toBe('key_123');
  });
});
