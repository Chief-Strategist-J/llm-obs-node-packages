import { describe, it, expect } from 'vitest';
import { createDataPipeline } from '../pipeline/data-pipeline';

describe('Data Pipeline Engine - End-to-End Pipeline & Telemetry Suite', () => {
  const users = Object.freeze([
    { id: '1', name: 'Alice', age: 30, status: 'active', passwordHash: 'secret1' },
    { id: '2', name: 'Bob', age: 20, status: 'inactive', passwordHash: 'secret2' },
    { id: '3', name: 'Charlie', age: 40, status: 'active', passwordHash: 'secret3' },
  ]);

  const posts = Object.freeze([
    { id: 'post1', userId: '1', title: 'Alice Post 1' },
    { id: 'post2', userId: '1', title: 'Alice Post 2' },
    { id: 'post3', userId: '3', title: 'Charlie Post' },
  ]);

  it('chains query, relationship, collection, and pagination steps seamlessly in a pipeline', () => {
    const pipeline = createDataPipeline(users)
      .where('status', 'eq', 'active')
      .loadOneToMany(posts, { localKey: 'id', foreignKey: 'userId', as: 'userPosts' })
      .makeHidden(['passwordHash'])
      .append('fullName', (u) => `User: ${u.name}`)
      .orderBy('age', 'desc')
      .paginate({ page: 1, pageSize: 1, url: 'https://api.test/users' });

    const envelope = pipeline.executeEnveloped('FetchActiveUsersPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.pipelineMeta.operation).toBe('FetchActiveUsersPipeline');
    expect(envelope.pipelineMeta.stepsExecuted).toBe(6);
    expect(envelope.pipelineMeta.stepTelemetry.length).toBe(6);

    const paginatedResult = envelope.data;
    expect(paginatedResult.total).toBe(2);
    expect(paginatedResult.currentPage).toBe(1);
    expect(paginatedResult.items.length).toBe(1);

    const firstUser = paginatedResult.items[0];
    expect(firstUser.name).toBe('Charlie');
    expect(firstUser.fullName).toBe('User: Charlie');
    expect(firstUser.userPosts.length).toBe(1);
    expect('passwordHash' in firstUser).toBe(false);
  });

  it('durable execution over deeply nested and unstructured payloads', () => {
    const unstructuredDataset = Object.freeze([
      {
        id: 'u1',
        meta: { profile: { details: { role: 'admin', score: 95 } } },
        tags: ['alpha', 'beta'],
        secretHash: 'xyz123',
      },
      {
        id: 'u2',
        meta: { profile: { details: { role: 'user', score: 40 } } },
        tags: ['gamma'],
        secretHash: 'abc456',
      },
      {
        id: 'u3',
        meta: null,
        tags: null,
      },
    ]);

    const pipeline = createDataPipeline(unstructuredDataset)
      .where('meta.profile.details.role', 'eq', 'admin')
      .whereJsonContains('tags', 'alpha')
      .append('meta.profile.computedTier', (item: any) => (item.meta?.profile?.details?.score > 90 ? 'VIP' : 'STANDARD'))
      .makeHidden(['secretHash', 'meta.profile.details.score']);

    const envelope = pipeline.executeEnveloped('UnstructuredDataPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.data.length).toBe(1);
    const item = envelope.data[0];
    expect(item.id).toBe('u1');
    expect(item.meta.profile.computedTier).toBe('VIP');
    expect('secretHash' in item).toBe(false);
  });
});
