/**
 * ALGORITHM SPECIFICATION:
 * 1. Comprehensive Master Integration Test Suite combining 10-level deep nesting, 12-level recursive objects, 8 relationship types, data shaping, field privacy hiding, and pagination into one unified master object.
 * 2. Validate 100% JSON Spec-Driven execution, high-level createPipeline() DX helpers, and deep nested wildcard data durability with null/undefined edge cases.
 * 3. Enforce immutability and return telemetry-enveloped output.
 */

import { describe, it, expect } from 'vitest';
import {
  createPipeline,
  createDataPipeline,
  executeDataDrivenPipeline,
  type DataPipelineSpec,
} from '../index';

describe('Master Data Transformer — Unified Pipeline Engine', () => {
  it('combines 10-level deep nesting, 12-level recursive objects, 8 relationship types, data shaping, field privacy hiding, and dual pagination into ONE master object dataset', () => {
    function build12LevelTree(depth = 1): any {
      if (depth > 12) return null;
      return {
        nodeId: `rec_node_${depth}`,
        level: depth,
        secretToken: `recursive_secret_${depth}`,
        childNode: build12LevelTree(depth + 1),
      };
    }

    const masterUsers = Object.freeze([
      {
        user_id: 'usr_master_1',
        first_name: 'Alice',
        last_name: 'Vance',
        user_score: '98',
        status: 'active',
        created_at: '2026-05-20T10:00:00Z',
        profile: {
          bio: 'Chief Architect',
          credentials: { password_hash: 'master_pass_123', ssn: '000-11-2222' },
        },
        l1: {
          l2: [
            {
              l3: {
                l4: [
                  {
                    l5: {
                      l6: [
                        {
                          l7: {
                            l8: [
                              {
                                l9: {
                                  l10: [
                                    { secretKey: 'level10_deep_secret_1', val: 'data_10a' },
                                    null,
                                    undefined,
                                    { secretKey: 'level10_deep_secret_2', val: 'data_10b' }
                                  ]
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        },
        recursiveTree: build12LevelTree(1),
        tags: ['admin', 'chief-architect']
      },
      {
        user_id: 'usr_master_2',
        first_name: 'Bob',
        last_name: 'Builder',
        user_score: '45',
        status: 'inactive',
        created_at: '2025-01-01T10:00:00Z',
        profile: null,
        l1: null,
        recursiveTree: null,
        tags: ['guest']
      }
    ]);

    const rawPosts = Object.freeze([
      { id: 'p101', author_id: 'usr_master_1', title: 'Master Data Pipeline Architecture' },
      { id: 'p102', author_id: 'usr_master_1', title: 'Deep Wildcard Traversal Engine' }
    ]);

    const rawRoles = Object.freeze([
      { id: 'r1', name: 'SuperAdmin' },
      { id: 'r2', name: 'EnterpriseArchitect' }
    ]);

    const rawUserRolesPivot = Object.freeze([
      { user_id: 'usr_master_1', role_id: 'r1' },
      { user_id: 'usr_master_1', role_id: 'r2' }
    ]);

    const rawAttachments = Object.freeze([
      { id: 'att_master', attachable_type: 'User', attachable_id: 'usr_master_1', url: 'https://cdn.com/alice_master.jpg' }
    ]);

    const recursivePathsToHide: string[] = [];
    let currentPath = 'recursiveTree.childNode';
    for (let i = 1; i <= 12; i++) {
      recursivePathsToHide.push(`${currentPath}.secretToken`);
      currentPath += '.childNode';
    }

    const envelope = createDataPipeline(masterUsers)
      .mapJson([
        { op: 'rename', from: 'user_id', to: 'id' },
        { op: 'rename', from: 'first_name', to: 'firstName' },
        { op: 'rename', from: 'last_name', to: 'lastName' },
        { op: 'coerce', field: 'user_score', to: 'number' }
      ])
      .where('status', 'eq', 'active')
      .where('user_score', '>=', 70)
      .whereJsonContains('tags', 'chief-architect')
      .whereDate('created_at', '>=', 2026, 'year')
      .loadOneToMany(rawPosts, { localKey: 'id', foreignKey: 'author_id', as: 'posts' })
      .loadManyToMany(rawRoles, {
        pivotStore: rawUserRolesPivot,
        foreignPivotKey: 'user_id',
        relatedPivotKey: 'role_id',
        parentLocalKey: 'id',
        relatedLocalKey: 'id',
        as: 'roles'
      })
      .loadOneToOnePolymorphic(rawAttachments, {
        typeField: 'attachable_type',
        idField: 'attachable_id',
        entityType: 'User',
        localKey: 'id',
        as: 'avatar'
      })
      .makeHidden([
        'profile.credentials.password_hash',
        'profile.credentials.ssn',
        'l1.l2[*].l3.l4[*].l5.l6[*].l7.l8[*].l9.l10[*].secretKey',
        'recursiveTree.secretToken',
        ...recursivePathsToHide
      ])
      .orderBy('user_score', 'desc')
      .paginate({ page: 1, pageSize: 10, url: 'https://api.company.com/v1/master-users' })
      .executeEnveloped('CombinedMasterObjectPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.data.total).toBe(1);

    const masterObj = envelope.data.items[0];
    expect(masterObj.id).toBe('usr_master_1');
    expect(masterObj.firstName).toBe('Alice');
    expect(masterObj.user_score).toBe(98);
    expect(masterObj.posts.length).toBe(2);
    expect(masterObj.roles.map((r: any) => r.name)).toEqual(['SuperAdmin', 'EnterpriseArchitect']);
    expect(masterObj.avatar.url).toBe('https://cdn.com/alice_master.jpg');

    expect(masterObj.profile.credentials.password_hash).toBeUndefined();
    expect(masterObj.profile.credentials.ssn).toBeUndefined();

    const l10Array = masterObj.l1.l2[0].l3.l4[0].l5.l6[0].l7.l8[0].l9.l10;
    expect(l10Array[0].secretKey).toBeUndefined();
    expect(l10Array[0].val).toBe('data_10a');
    expect(l10Array[1]).toBeNull();
    expect(l10Array[2]).toBeUndefined();
    expect(l10Array[3].secretKey).toBeUndefined();
    expect(l10Array[3].val).toBe('data_10b');

    let currTree = masterObj.recursiveTree;
    for (let d = 1; d <= 12; d++) {
      expect(currTree.nodeId).toBe(`rec_node_${d}`);
      expect(currTree.secretToken).toBeUndefined();
      currTree = currTree.childNode;
    }

    expect(envelope.originalData[0].user_id).toBe('usr_master_1');
    expect((envelope.originalData[0] as any).profile.credentials.password_hash).toBe('master_pass_123');
    expect((envelope.originalData[0] as any).l1.l2[0].l3.l4[0].l5.l6[0].l7.l8[0].l9.l10[0].secretKey).toBe('level10_deep_secret_1');
    expect((envelope.originalData[0] as any).recursiveTree.childNode.secretToken).toBe('recursive_secret_2');
  });

  it('executes 100% JSON Spec-Driven pipeline with relational loading and field privacy', () => {
    const rawUsers = Object.freeze([
      {
        id: 'u1',
        name: 'Charlie',
        secret_token: 'tok_abc123',
        department: 'Engineering',
        salary: '120000',
      },
      {
        id: 'u2',
        name: 'David',
        secret_token: 'tok_xyz456',
        department: 'Sales',
        salary: '80000',
      },
    ]);

    const rawProjects = Object.freeze([
      { id: 'proj1', member_id: 'u1', name: 'Cloud Migration' },
      { id: 'proj2', member_id: 'u1', name: 'Security Audit' },
    ]);

    const jsonSpec: DataPipelineSpec = Object.freeze({
      name: 'PureJSONDrivenSpec',
      steps: Object.freeze([
        { type: 'where' as const, field: 'department', operator: 'eq' as const, value: 'Engineering' },
        {
          type: 'loadOneToMany' as const,
          storeName: 'projectsStore',
          spec: { localKey: 'id', foreignKey: 'member_id', as: 'assignedProjects' },
        },
        { type: 'makeHidden' as const, keys: ['secret_token'] },
        { type: 'orderBy' as const, field: 'name', direction: 'asc' as const },
        { type: 'paginate' as const, spec: { page: 1, pageSize: 5 } },
      ]),
    });

    const envelope = executeDataDrivenPipeline(rawUsers, jsonSpec, { projectsStore: rawProjects });

    expect(envelope.success).toBe(true);
    expect(envelope.data.total).toBe(1);

    const user = envelope.data.items[0];
    expect(user.id).toBe('u1');
    expect(user.name).toBe('Charlie');
    expect(user.assignedProjects.length).toBe(2);
    expect(user.secret_token).toBeUndefined();

    expect((envelope.originalData[0] as any).secret_token).toBe('tok_abc123');
  });

  it('demonstrates high-level createPipeline DX helper with explain plan and toSpecJson export', () => {
    const rawItems = Object.freeze([
      { id: 'i1', price: 100, isAvailable: true, internal_cost: 50 },
      { id: 'i2', price: 200, isAvailable: false, internal_cost: 120 },
    ]);

    const helper = createPipeline(rawItems)
      .where('isAvailable', 'eq', true)
      .makeHidden(['internal_cost'])
      .orderBy('price', 'desc')
      .paginate(1, 10);

    const plan = helper.explain();
    expect(plan.inputCount).toBe(2);
    expect(plan.spec.name).toBe('ExplainedPipeline');

    const exportedJson = helper.toSpecJson('ExportedItemSpec');
    expect(typeof exportedJson).toBe('string');
    expect(exportedJson).toContain('ExportedItemSpec');

    const envelope = helper.run('RunHelperPipeline');
    expect(envelope.success).toBe(true);
    expect(envelope.data.total).toBe(1);
    expect(envelope.data.items[0].id).toBe('i1');
    expect(envelope.data.items[0].internal_cost).toBeUndefined();
  });
});
