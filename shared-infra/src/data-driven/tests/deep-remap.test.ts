import { describe, it, expect } from 'vitest';
import { remapDeepPaths, createPipeline, createDataPipeline } from '../index';

describe('Deep Nested to Deep Nested Transformation', () => {
  it('converts one deeply nested object structure into a completely different target nested object structure', () => {
    const rawLegacyPayload = Object.freeze({
      legacy_header: {
        meta: { transaction_id: 'tx_999' }
      },
      legacy_body: {
        user_info: {
          personal: {
            first_name: 'Alice',
            last_name: 'Smith'
          },
          contact: {
            emails: ['alice@company.com']
          }
        },
        financials: {
          scores: { user_score: '95' }
        }
      }
    });

    const reshaped = remapDeepPaths(rawLegacyPayload, [
      { from: 'legacy_header.meta.transaction_id', to: 'app.audit.txId' },
      { from: 'legacy_body.user_info.personal.first_name', to: 'app.user.profile.firstName' },
      { from: 'legacy_body.user_info.personal.last_name', to: 'app.user.profile.lastName' },
      { from: 'legacy_body.user_info.contact.emails[0]', to: 'app.user.contact.primaryEmail' },
      { from: 'legacy_body.financials.scores.user_score', to: 'app.user.metrics.score', transform: (val) => Number(val) },
      { from: 'missing.legacy.path', to: 'app.user.status', default: 'ACTIVE' }
    ]);

    expect(reshaped).toEqual({
      app: {
        audit: { txId: 'tx_999' },
        user: {
          profile: { firstName: 'Alice', lastName: 'Smith' },
          contact: { primaryEmail: 'alice@company.com' },
          metrics: { score: 95 },
          status: 'ACTIVE'
        }
      }
    });
  });

  it('runs remapDeepPaths in pipeline engine over a collection of objects', () => {
    const rawCollection = Object.freeze([
      {
        old_data: { user: { name: 'Bob', age: '30' } }
      }
    ]);

    const envelope = createDataPipeline(rawCollection)
      .remapDeepPaths([
        { from: 'old_data.user.name', to: 'domain.user.fullName' },
        { from: 'old_data.user.age', to: 'domain.user.ageNumber', transform: (v) => Number(v) }
      ])
      .executeEnveloped('DeepRemapPipeline');

    expect(envelope.success).toBe(true);
    expect(envelope.data[0]).toEqual({
      domain: {
        user: {
          fullName: 'Bob',
          ageNumber: 30
        }
      }
    });
  });
});
