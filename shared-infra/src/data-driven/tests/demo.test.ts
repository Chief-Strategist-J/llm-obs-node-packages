import { describe, it, expect } from 'vitest';
import { createDataPipeline } from '../index';

describe('Data Pipeline - Comprehensive End-to-End Demo', () => {
  it('demonstrates pipeline execution while preserving original data immutably', () => {
    // 1. ORIGINAL RAW DATASET (Remains 100% Untouched)
    const rawUsers = Object.freeze([
      Object.freeze({
        id: 'u1',
        profile: {
          firstName: 'Alice',
          lastName: 'Smith',
          credentials: { passwordHash: 'secret_1', score: 95 },
        },
        tags: ['admin', 'dev'],
        status: 'active',
        createdAt: '2026-01-15T00:00:00Z',
      }),
      Object.freeze({
        id: 'u2',
        profile: {
          firstName: 'Bob',
          lastName: 'Jones',
          credentials: { passwordHash: 'secret_2', score: 70 },
        },
        tags: ['user'],
        status: 'inactive',
        createdAt: '2026-02-01T00:00:00Z',
      }),
    ]);

    const rawPosts = Object.freeze([
      { id: 'post1', userId: 'u1', title: 'Data Driven Pipelines' },
      { id: 'post2', userId: 'u1', title: 'Pure Functional TS' },
    ]);

    // Snapshot of original data for immutability verification
    const originalSnapshot = JSON.parse(JSON.stringify(rawUsers));

    // 2. CHAIN EVERYTHING IN A DATA PIPELINE
    const envelope = createDataPipeline(rawUsers)
      // Filter & Query
      .where('status', 'eq', 'active')
      .whereDate('createdAt', '>=', 2026, 'year')
      .whereJsonContains('tags', 'dev')

      // Relational Load (1-to-Many Join)
      .loadOneToMany(rawPosts, { localKey: 'id', foreignKey: 'userId', as: 'userPosts' })

      // Appends & Nested Mutations
      .append('fullName', (u: any) => `${u.profile.firstName} ${u.profile.lastName}`)

      // Hide Sensitive Fields
      .makeHidden(['profile.credentials.passwordHash'])

      // Order & Paginate
      .orderBy('fullName', 'asc')
      .paginate({ page: 1, pageSize: 10, url: 'https://api.company.com/users' })

      // Execute & Collect Telemetry Envelope
      .executeEnveloped('FetchActiveUsersPipeline');

    // 3. VERIFY BOTH ORIGINAL DATA & MANIPULATED DATA EXIST SIDE-BY-SIDE

    // A. Original Data is Completely Intact & Unchanged
    expect(rawUsers).toEqual(originalSnapshot);
    expect(Object.isFrozen(rawUsers)).toBe(true);
    expect(Object.isFrozen(rawUsers[0])).toBe(true);
    expect('fullName' in rawUsers[0]).toBe(false);
    expect('userPosts' in rawUsers[0]).toBe(false);
    expect(rawUsers[0].profile.credentials.passwordHash).toBe('secret_1');

    // B. Manipulated Data is Pure, Enveloped & Transformed
    expect(envelope.success).toBe(true);
    expect(envelope.data.total).toBe(1);
    expect(envelope.data.items.length).toBe(1);

    const transformedItem = envelope.data.items[0];
    expect(transformedItem.fullName).toBe('Alice Smith');
    expect(transformedItem.userPosts.length).toBe(2);
    expect(transformedItem.userPosts[0].title).toBe('Data Driven Pipelines');
    expect('passwordHash' in (transformedItem.profile?.credentials || {})).toBe(false);

    // C. Telemetry Metadata is Captured
    expect(envelope.pipelineMeta.stepsExecuted).toBe(8);
    expect(envelope.pipelineMeta.executionTimeMs).toBeGreaterThanOrEqual(0);
  });
});
