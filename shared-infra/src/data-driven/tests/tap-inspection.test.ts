import { describe, it, expect } from 'vitest';
import { createDataPipeline, createPipeline } from '../index';

describe('Mid-Pipeline Data Inspection & Telemetry', () => {
  it('inspects intermediate data at any step using tap()', () => {
    const rawUsers = Object.freeze([
      { id: '1', name: 'Alice', status: 'active' },
      { id: '2', name: 'Bob', status: 'inactive' },
    ]);

    const tappedSnapshots: any[] = [];

    const envelope = createDataPipeline(rawUsers)
      .where('status', 'eq', 'active')
      .tap((data) => tappedSnapshots.push([...data]))
      .makeHidden(['status'])
      .executeEnveloped('TapInspectionPipeline');

    expect(envelope.success).toBe(true);

    // Tapped snapshot captures data mid-pipeline (after where filter, before makeHidden)
    expect(tappedSnapshots.length).toBe(1);
    expect(tappedSnapshots[0].length).toBe(1);
    expect(tappedSnapshots[0][0].name).toBe('Alice');
    expect(tappedSnapshots[0][0].status).toBe('active');

    // Final result has status hidden
    expect(envelope.data[0].status).toBeUndefined();

    // Step telemetry tracks tap and all other steps
    expect(envelope.pipelineMeta.stepTelemetry.length).toBe(3);
    expect(envelope.pipelineMeta.stepTelemetry[1].stepName).toBe('tap');
  });
});
