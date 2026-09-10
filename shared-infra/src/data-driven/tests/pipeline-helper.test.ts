import { describe, it, expect } from 'vitest';
import { createPipeline } from '../index';

describe('Pipeline Helper DX Utilities', () => {
  it('runs fluid pipeline and exports JSON spec effortlessly', () => {
    const rawUsers = Object.freeze([
      { id: '1', name: 'Alice', status: 'active', secret: 'abc' },
      { id: '2', name: 'Bob', status: 'inactive', secret: 'xyz' },
    ]);

    const p = createPipeline(rawUsers)
      .where('status', 'eq', 'active')
      .makeHidden(['secret'])
      .paginate(1, 10);

    const result = p.run('FetchActiveUsers');

    expect(result.success).toBe(true);
    expect(result.data.total).toBe(1);
    expect(result.data.items[0].name).toBe('Alice');
    expect(result.data.items[0].secret).toBeUndefined();

    // Verify explain plan
    const plan = p.explain();
    expect(plan.inputCount).toBe(2);
    expect(plan.spec.name).toBe('ExplainedPipeline');
  });

  it('runs dynamically from JSON spec string using createPipeline(data).fromSpec(jsonStr)', () => {
    const rawUsers = Object.freeze([
      { id: '1', score: 90 },
      { id: '2', score: 40 },
    ]);

    const jsonSpec = JSON.stringify({
      name: 'DynamicSpec',
      steps: [{ type: 'where', field: 'score', operator: '>=', value: 50 }],
    });

    const envelope = createPipeline(rawUsers).fromSpec(jsonSpec);
    expect(envelope.success).toBe(true);
    expect(envelope.data.length).toBe(1);
    expect(envelope.data[0].score).toBe(90);
  });
});
