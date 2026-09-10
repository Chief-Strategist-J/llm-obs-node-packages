/**
 * ALGORITHM SPECIFICATION:
 * 1. Provide universal high-level pipeline() helper combining fluent execution, JSON spec import/export, and visual execution plan inspection (explain).
 * 2. Support key autocomplete typing on entity fields and automated JSON serialization/deserialization.
 * 3. Enforce immutability and return telemetry-enveloped outputs.
 */

import { DataPipeline } from '../pipeline/data-pipeline';
import { executeDataDrivenPipeline } from './data-driven-interpreter';
import { createSpecBuilder } from './spec-builder';
import { validatePipelineSpec } from './spec-validator';
import type { DataPipelineSpec } from '../types/pipeline-spec.types';
import type { DataPipelineEnvelope, WhereOperator, OneToManySpec } from '../types/query-relation.types';

export class PipelineHelper<T extends Record<string, unknown>> {
  private readonly collection: readonly T[];
  private readonly pipelineInstance: DataPipeline<T>;
  private readonly specBuilderInstance: ReturnType<typeof createSpecBuilder>;

  constructor(collection: readonly T[], name = 'AnonymousPipeline', pipelineInst?: DataPipeline<T>, specInst?: ReturnType<typeof createSpecBuilder>) {
    this.collection = Object.freeze(collection.map((item) => Object.freeze({ ...item })));
    this.pipelineInstance = pipelineInst ?? new DataPipeline<T>(this.collection);
    this.specBuilderInstance = specInst ?? createSpecBuilder(name);
  }

  public where(field: Extract<keyof T, string> | string, operator: WhereOperator, value: unknown): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.where(field, operator, value),
      this.specBuilderInstance.where(field, operator, value)
    );
  }

  public tap(inspector: (collection: readonly T[]) => void): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.tap(inspector),
      this.specBuilderInstance
    );
  }

  public makeHidden(keys: readonly string[]): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.makeHidden(keys),
      this.specBuilderInstance.makeHidden(keys)
    );
  }

  public remapDeepPaths(mappings: readonly { readonly from: string; readonly to: string; readonly default?: unknown }[]): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.remapDeepPaths(mappings),
      this.specBuilderInstance.remapDeepPaths(mappings)
    );
  }

  public loadOneToMany(storeName: string, relatedCollection: readonly Record<string, unknown>[], spec: OneToManySpec): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.loadOneToMany(relatedCollection as any, spec),
      this.specBuilderInstance.loadOneToMany(storeName, spec)
    );
  }

  public orderBy(field: Extract<keyof T, string> | string, direction: 'asc' | 'desc' = 'asc'): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.orderBy(field, direction),
      this.specBuilderInstance.orderBy(field, direction)
    );
  }

  public paginate(page: number, pageSize: number): PipelineHelper<T> {
    return new PipelineHelper(
      this.collection,
      'Pipeline',
      this.pipelineInstance.paginate({ page, pageSize }),
      this.specBuilderInstance.paginate({ page, pageSize })
    );
  }

  public toSpec(name = 'ExportedPipelineSpec'): DataPipelineSpec {
    return createSpecBuilder(name).build();
  }

  public toSpecJson(name = 'ExportedPipelineSpec'): string {
    return JSON.stringify(this.toSpec(name), null, 2);
  }

  public explain(): { readonly inputCount: number; readonly spec: DataPipelineSpec } {
    return Object.freeze({
      inputCount: this.collection.length,
      spec: this.toSpec('ExplainedPipeline'),
    });
  }

  public run(operationName = 'PipelineExecution'): DataPipelineEnvelope<any> {
    return this.pipelineInstance.executeEnveloped(operationName);
  }

  public fromSpec(
    specOrJson: DataPipelineSpec | string,
    stores: Readonly<Record<string, readonly Record<string, unknown>[]>> = {}
  ): DataPipelineEnvelope<any> {
    const parsedSpec: DataPipelineSpec =
      typeof specOrJson === 'string' ? JSON.parse(specOrJson) : specOrJson;
    const validatedSpec = validatePipelineSpec(parsedSpec);
    return executeDataDrivenPipeline(this.collection, validatedSpec, stores);
  }
}

export function createPipeline<T extends Record<string, unknown>>(collection: readonly T[], name = 'Pipeline'): PipelineHelper<T> {
  return new PipelineHelper<T>(collection, name);
}

export const dataPipeline = createPipeline;
