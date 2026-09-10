import { describe, it, expect } from 'vitest';
import {
  createDataPipeline,
  createSpecBuilder,
  executeDataDrivenPipeline,
  validatePipelineSpec,
} from '../index';

describe('Data-Driven DX & Immutability Verification', () => {
  it('returns both originalData and manipulated data in the pipeline envelope', () => {
    const rawUsers = Object.freeze([
      { id: '1', name: 'Alice', role: 'admin' },
      { id: '2', name: 'Bob', role: 'user' },
    ]);

    const envelope = createDataPipeline(rawUsers)
      .where('role', 'eq', 'admin')
      .makeHidden(['role'])
      .executeEnveloped('DualDataTest');

    expect(envelope.success).toBe(true);
    expect(envelope.originalData).toBeDefined();
    expect(envelope.originalData.length).toBe(2);
    expect(envelope.originalData[0].role).toBe('admin');

    expect(envelope.data.length).toBe(1);
    expect(envelope.data[0].role).toBeUndefined();
  });

  it('builds type-safe spec via createSpecBuilder with IDE autocomplete', () => {
    const spec = createSpecBuilder('AutocompleteSpec')
      .where('score', '>=', 50)
      .makeHidden(['password'])
      .build();

    expect(spec.name).toBe('AutocompleteSpec');
    expect(spec.steps.length).toBe(2);
    expect(spec.steps[0].type).toBe('where');
  });

  it('detects typos in step types and provides intelligent suggestions', () => {
    const typoSpec = {
      name: 'TypoTestPipeline',
      steps: [
        { type: 'wher', field: 'age', operator: 'gt', value: 18 },
      ],
    };

    expect(() => validatePipelineSpec(typoSpec)).toThrowError(
      /Invalid step type "wher".*Did you mean "where"\?/
    );
  });

  it('detects typos in operators and provides intelligent suggestions', () => {
    const typoOperatorSpec = {
      name: 'TypoOpTestPipeline',
      steps: [
        { type: 'where', field: 'age', operator: 'gtt', value: 18 },
      ],
    };

    expect(() => executeDataDrivenPipeline([], typoOperatorSpec as any)).toThrowError(
      /Invalid operator "gtt" in "where" step.*Did you mean "gt"\?/
    );
  });
});
