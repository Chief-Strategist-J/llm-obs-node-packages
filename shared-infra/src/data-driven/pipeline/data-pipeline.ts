/**
 * ALGORITHM SPECIFICATION:
 * 1. Universal DataPipeline engine exposing every data-driven operation in a unified, chainable pipeline interface.
 * 2. Chains query clauses, 8-type relationships, JSON mappings, nested transforms, tree/graph transforms, and collection operations.
 * 3. Envelopes pipeline execution into JsonEnvelope with duration telemetry, step counts, and OpenTelemetry trace parents.
 */

import { withSpan } from '../../tracing/tracer';
import { createEnvelope } from '../../utils/json-utils';
import type {
  WhereClause,
  WhereOperator,
  SortClause,
  GroupByClause,
  LengthAwarePaginationSpec,
  CursorPaginationSpec,
  LengthAwarePaginatorResult,
  CursorPaginatorResult,
  OneToOneSpec,
  OneToManySpec,
  ManyToManySpec,
  HasOneThroughSpec,
  HasManyThroughSpec,
  PolymorphicOneSpec,
  PolymorphicManySpec,
  PolymorphicManyToManySpec,
  StepTelemetry,
  PipelineMeta,
  DataPipelineEnvelope,
} from '../types/query-relation.types';
import type { JsonMapOp, ListOp, Path } from '../types/transform.types';

import { mapJson } from '../transforms/json-map';
import { transformList } from '../transforms/list-transform';
import { setIn, updateIn, mergeNested, flattenNested, unflattenNested, remapDeepPaths, type DeepPathMapping } from '../transforms/nested-transform';
import {
  evaluateWhereClauses,
  evaluateOrdering,
  evaluateInRandomOrder,
  evaluateGrouping,
  evaluateLimitOffset,
  paginateQuery,
  paginateCursor,
} from '../transforms/query-builder';

import {
  loadOneToOne,
  loadOneToMany,
  loadManyToMany,
  loadHasOneThrough,
  loadHasManyThrough,
  loadOneToOnePolymorphic,
  loadOneToManyPolymorphic,
  loadManyToManyPolymorphic,
} from '../transforms/relationship-transform';

import {
  appendItem,
  setAppends,
  containsItem,
  diffCollection,
  intersectCollection,
  exceptKeys,
  onlyKeys,
  findInCollection,
  findOrFailInCollection,
  freshInCollection,
  modelKeys,
  makeHidden,
  setHidden,
  mergeHidden,
  makeVisible,
  setVisible,
  mergeVisible,
  partitionCollection,
  uniqueCollection,
  toQueryStringCollection,
} from '../transforms/collection-transform';

export type PipelineStepFn<T extends Record<string, unknown>> = (
  input: readonly T[]
) => { readonly name: string; readonly result: any };

export class DataPipeline<T extends Record<string, unknown>> {
  private readonly collection: readonly T[];
  private readonly steps: readonly PipelineStepFn<T>[];

  constructor(collection: readonly T[], steps: readonly PipelineStepFn<T>[] = []) {
    this.collection = Object.freeze(collection.map((item) => Object.freeze({ ...item })));
    this.steps = Object.freeze([...steps]);
  }

  private addStep(name: string, fn: (collection: readonly T[]) => any): DataPipeline<T> {
    const stepFn: PipelineStepFn<T> = (input) => ({
      name,
      result: fn(input),
    });
    return new DataPipeline(this.collection, [...this.steps, stepFn]);
  }

  public tap(inspector: (collection: readonly T[]) => void): DataPipeline<T> {
    return this.addStep('tap', (coll) => {
      inspector(coll);
      return coll;
    });
  }

  public mapJson(ops: readonly JsonMapOp[]): DataPipeline<T> {
    return this.addStep('mapJson', (coll) => coll.map((item) => mapJson(item, ops))) as any;
  }

  public transformList(ops: readonly ListOp[]): DataPipeline<T> {
    return this.addStep('transformList', (coll) => transformList(coll, ops));
  }

  public setInPath(path: Path, value: unknown): DataPipeline<T> {
    return this.addStep(`setInPath(${path.join('.')})`, (coll) => coll.map((item) => setIn(item, path, value))) as any;
  }

  public remapDeepPaths(mappings: readonly DeepPathMapping[]): DataPipeline<T> {
    return this.addStep('remapDeepPaths', (coll) => coll.map((item) => remapDeepPaths(item, mappings))) as any;
  }

  public updateInPath(path: Path, updater: (val: unknown) => unknown): DataPipeline<T> {
    return this.addStep(`updateInPath(${path.join('.')})`, (coll) => coll.map((item) => updateIn(item, path, updater))) as any;
  }

  public mergeNested(source: Readonly<Record<string, unknown>>): DataPipeline<T> {
    return this.addStep('mergeNested', (coll) => coll.map((item) => mergeNested(item, source))) as any;
  }

  public flattenNested(delimiter = '.'): DataPipeline<T> {
    return this.addStep('flattenNested', (coll) => coll.map((item) => flattenNested(item, delimiter))) as any;
  }

  public unflattenNested(delimiter = '.'): DataPipeline<T> {
    return this.addStep('unflattenNested', (coll) => coll.map((item) => unflattenNested(item, delimiter))) as any;
  }

  public where(field: string, operator: WhereOperator, value: unknown, boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'basic', field, operator, value, boolean };
    return this.addStep(`where(${field} ${operator} ${value})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereNot(clause: WhereClause, boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const notClause: WhereClause = { kind: 'not', clause, boolean };
    return this.addStep('whereNot', (coll) => evaluateWhereClauses(coll, [notClause]));
  }

  public whereGroup(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const groupClause: WhereClause = { kind: 'group', clauses, boolean };
    return this.addStep('whereGroup', (coll) => evaluateWhereClauses(coll, [groupClause]));
  }

  public whereAny(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'any_all_none', mode: 'any', clauses, boolean };
    return this.addStep('whereAny', (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereAll(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'any_all_none', mode: 'all', clauses, boolean };
    return this.addStep('whereAll', (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereNone(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'any_all_none', mode: 'none', clauses, boolean };
    return this.addStep('whereNone', (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereJsonContains(path: string, value: unknown, boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'json', path, op: 'contains', value, boolean };
    return this.addStep(`whereJsonContains(${path})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereJsonLength(path: string, length: number, boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'json', path, op: 'length', value: length, boolean };
    return this.addStep(`whereJsonLength(${path})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereDate(
    field: string,
    operator: WhereOperator,
    value: unknown,
    part: 'date' | 'month' | 'year' | 'time' = 'date',
    boolean: 'and' | 'or' = 'and'
  ): DataPipeline<T> {
    const clause: WhereClause = { kind: 'date', field, part, operator, value, boolean };
    return this.addStep(`whereDate(${field})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereExists(
    subqueryCollection: readonly Record<string, unknown>[],
    parentKey: string,
    subqueryKey: string,
    boolean: 'and' | 'or' = 'and'
  ): DataPipeline<T> {
    const clause: WhereClause = { kind: 'exists', subqueryCollection, parentKey, subqueryKey, boolean };
    return this.addStep('whereExists', (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereFullText(fields: readonly string[], query: string, boolean: 'and' | 'or' = 'and'): DataPipeline<T> {
    const clause: WhereClause = { kind: 'fulltext', fields, query, boolean };
    return this.addStep(`whereFullText(${query})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public whereVectorSimilarity(
    vectorField: string,
    targetVector: readonly number[],
    minSimilarity: number,
    boolean: 'and' | 'or' = 'and'
  ): DataPipeline<T> {
    const clause: WhereClause = { kind: 'vector_similarity', vectorField, targetVector, minSimilarity, boolean };
    return this.addStep(`whereVectorSimilarity(${vectorField})`, (coll) => evaluateWhereClauses(coll, [clause]));
  }

  public orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): DataPipeline<T> {
    const sort: SortClause = { field, direction };
    return this.addStep(`orderBy(${field} ${direction})`, (coll) => evaluateOrdering(coll, [sort]));
  }

  public inRandomOrder(seed?: number): DataPipeline<T> {
    return this.addStep('inRandomOrder', (coll) => evaluateInRandomOrder(coll, seed));
  }

  public limit(count: number, offset = 0): DataPipeline<T> {
    return this.addStep(`limit(${count}, offset=${offset})`, (coll) => evaluateLimitOffset(coll, { limit: count, offset }));
  }

  public groupBy(fields: readonly string[], having?: GroupByClause['having']): DataPipeline<T> {
    return this.addStep(`groupBy(${fields.join(',')})`, (coll) => evaluateGrouping(coll, { fields, having })) as any;
  }

  public loadOneToOne<R extends Record<string, unknown>>(relatedCollection: readonly R[], spec: OneToOneSpec): DataPipeline<T> {
    return this.addStep(`loadOneToOne(${spec.as})`, (coll) => loadOneToOne(coll, relatedCollection, spec));
  }

  public loadOneToMany<R extends Record<string, unknown>>(relatedCollection: readonly R[], spec: OneToManySpec): DataPipeline<T> {
    return this.addStep(`loadOneToMany(${spec.as})`, (coll) => loadOneToMany(coll, relatedCollection, spec));
  }

  public loadManyToMany<R extends Record<string, unknown>>(relatedCollection: readonly R[], spec: ManyToManySpec): DataPipeline<T> {
    return this.addStep(`loadManyToMany(${spec.as})`, (coll) => loadManyToMany(coll, relatedCollection, spec));
  }

  public loadHasOneThrough<Through extends Record<string, unknown>, R extends Record<string, unknown>>(
    throughCollection: readonly Through[],
    relatedCollection: readonly R[],
    spec: HasOneThroughSpec
  ): DataPipeline<T> {
    return this.addStep(`loadHasOneThrough(${spec.as})`, (coll) => loadHasOneThrough(coll, throughCollection, relatedCollection, spec));
  }

  public loadHasManyThrough<Through extends Record<string, unknown>, R extends Record<string, unknown>>(
    throughCollection: readonly Through[],
    relatedCollection: readonly R[],
    spec: HasManyThroughSpec
  ): DataPipeline<T> {
    return this.addStep(`loadHasManyThrough(${spec.as})`, (coll) => loadHasManyThrough(coll, throughCollection, relatedCollection, spec));
  }

  public loadOneToOnePolymorphic<R extends Record<string, unknown>>(relatedCollection: readonly R[], spec: PolymorphicOneSpec): DataPipeline<T> {
    return this.addStep(`loadOneToOnePolymorphic(${spec.as})`, (coll) => loadOneToOnePolymorphic(coll, relatedCollection, spec));
  }

  public loadOneToManyPolymorphic<R extends Record<string, unknown>>(relatedCollection: readonly R[], spec: PolymorphicManySpec): DataPipeline<T> {
    return this.addStep(`loadOneToManyPolymorphic(${spec.as})`, (coll) => loadOneToManyPolymorphic(coll, relatedCollection, spec));
  }

  public loadManyToManyPolymorphic<R extends Record<string, unknown>>(
    relatedCollection: readonly R[],
    spec: PolymorphicManyToManySpec
  ): DataPipeline<T> {
    return this.addStep(`loadManyToManyPolymorphic(${spec.as})`, (coll) => loadManyToManyPolymorphic(coll, relatedCollection, spec));
  }

  public append(key: string, computer: (item: T) => unknown): DataPipeline<T> {
    return this.addStep(`append(${key})`, (coll) => appendItem(coll, key, computer));
  }

  public setAppends(appends: Readonly<Record<string, (item: T) => unknown>>): DataPipeline<T> {
    return this.addStep('setAppends', (coll) => setAppends(coll, appends));
  }

  public diff<B extends Record<string, unknown>>(collectionB: readonly B[], keyField = 'id'): DataPipeline<T> {
    return this.addStep('diff', (coll) => diffCollection(coll, collectionB as any, keyField));
  }

  public intersect<B extends Record<string, unknown>>(collectionB: readonly B[], keyField = 'id'): DataPipeline<T> {
    return this.addStep('intersect', (coll) => intersectCollection(coll, collectionB as any, keyField));
  }

  public makeHidden(hiddenKeys: readonly string[]): DataPipeline<T> {
    return this.addStep(`makeHidden(${hiddenKeys.join(',')})`, (coll) => makeHidden(coll, hiddenKeys));
  }

  public setHidden(hiddenKeys: readonly string[]): DataPipeline<T> {
    return this.addStep(`setHidden(${hiddenKeys.join(',')})`, (coll) => setHidden(coll, hiddenKeys));
  }

  public mergeHidden(existingHidden: readonly string[], additionalHidden: readonly string[]): DataPipeline<T> {
    return this.addStep('mergeHidden', (coll) => mergeHidden(coll, existingHidden, additionalHidden));
  }

  public makeVisible(sourceCollection: readonly T[], visibleKeys: readonly string[], idField = 'id'): DataPipeline<T> {
    return this.addStep(`makeVisible(${visibleKeys.join(',')})`, (coll) => makeVisible(coll, sourceCollection, visibleKeys, idField));
  }

  public setVisible(sourceCollection: readonly T[], visibleKeys: readonly string[], idField = 'id'): DataPipeline<T> {
    return this.addStep(`setVisible(${visibleKeys.join(',')})`, (coll) => setVisible(coll, sourceCollection, visibleKeys, idField));
  }

  public mergeVisible(
    sourceCollection: readonly T[],
    existingVisible: readonly string[],
    additionalVisible: readonly string[],
    idField = 'id'
  ): DataPipeline<T> {
    return this.addStep('mergeVisible', (coll) => mergeVisible(coll, sourceCollection, existingVisible, additionalVisible, idField));
  }

  public only(keys: readonly string[]): DataPipeline<T> {
    return this.addStep(`only(${keys.join(',')})`, (coll) => onlyKeys(coll, keys));
  }

  public except(keys: readonly string[]): DataPipeline<T> {
    return this.addStep(`except(${keys.join(',')})`, (coll) => exceptKeys(coll, keys));
  }

  public distinctBy(keyField = 'id'): DataPipeline<T> {
    return this.addStep(`distinctBy(${keyField})`, (coll) => uniqueCollection(coll, keyField));
  }

  public unique(keyField = 'id'): DataPipeline<T> {
    return this.distinctBy(keyField);
  }

  public partition(predicate: (item: T) => boolean): DataPipeline<T> {
    return this.addStep('partition', (coll) => partitionCollection(coll, predicate)) as any;
  }

  public paginate(spec: LengthAwarePaginationSpec): DataPipeline<T> {
    return this.addStep(`paginate(page=${spec.page})`, (coll) => paginateQuery(coll, spec)) as any;
  }

  public paginateCursor(spec: CursorPaginationSpec): DataPipeline<T> {
    return this.addStep(`paginateCursor`, (coll) => paginateCursor(coll, spec)) as any;
  }

  public find(idOrPredicate: unknown | ((item: T) => boolean), idField = 'id'): T | undefined {
    const executed = this.execute('PipelineFind');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return findInCollection(items, idOrPredicate, idField);
  }

  public findOrFail(idOrPredicate: unknown | ((item: T) => boolean), idField = 'id'): T {
    const executed = this.execute('PipelineFindOrFail');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return findOrFailInCollection(items, idOrPredicate, idField);
  }

  public fresh(sourceCollection: readonly T[], idField = 'id'): T[] {
    const executed = this.execute('PipelineFresh');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return items.map((item: T) => freshInCollection(item, sourceCollection, idField));
  }

  public modelKeys(idField = 'id'): readonly unknown[] {
    const executed = this.execute('PipelineModelKeys');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return modelKeys(items, idField);
  }

  public contains(keyOrPredicate: string | ((item: T) => boolean), value?: unknown): boolean {
    const executed = this.execute('PipelineContains');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return containsItem(items, keyOrPredicate, value);
  }

  public toQueryString(): string[] {
    const executed = this.execute('PipelineToQueryString');
    const items = Array.isArray(executed) ? executed : executed.items || [];
    return items.map(toQueryStringCollection);
  }

  public execute(operationName = 'DataPipelineExecution'): any {
    let currentData: any = this.collection;
    for (const step of this.steps) {
      const stepInput = Array.isArray(currentData) ? currentData : this.collection;
      const { result } = step(stepInput);
      currentData = result;
    }
    return currentData;
  }

  public executeEnveloped(operationName = 'DataPipelineExecution'): DataPipelineEnvelope<any> {
    const startTime = Date.now();
    const stepTelemetryList: StepTelemetry[] = [];
    let currentData: any = this.collection;

    for (const step of this.steps) {
      const stepStart = Date.now();
      const stepInput = Array.isArray(currentData) ? currentData : this.collection;
      const inputCount = stepInput.length;

      const { name, result } = step(stepInput);
      const stepDuration = Date.now() - stepStart;
      currentData = result;

      const outputCount = Array.isArray(currentData)
        ? currentData.length
        : currentData && typeof currentData === 'object' && 'items' in currentData && Array.isArray((currentData as any).items)
        ? (currentData as any).items.length
        : 1;

      stepTelemetryList.push(
        Object.freeze({
          stepName: name,
          durationMs: stepDuration,
          inputCount,
          outputCount,
        })
      );
    }

    const totalDuration = Date.now() - startTime;
    const baseEnvelope = createEnvelope(operationName, startTime, currentData, null);

    const pipelineMeta: PipelineMeta = Object.freeze({
      executionTimeMs: totalDuration,
      traceparent: baseEnvelope.meta.traceparent,
      operation: operationName,
      stepsExecuted: this.steps.length,
      stepTelemetry: Object.freeze(stepTelemetryList),
    });

    return Object.freeze({
      ...baseEnvelope,
      pipelineMeta,
      originalData: this.collection,
    });
  }

  public async executeTracedEnveloped(operationName = 'DataPipelineExecution'): Promise<DataPipelineEnvelope<any>> {
    return withSpan(operationName, async (span) => {
      span.setAttribute('data_pipeline.steps_count', this.steps.length);
      const env = this.executeEnveloped(operationName);
      span.setAttribute('data_pipeline.execution_time_ms', env.pipelineMeta.executionTimeMs);
      return env;
    });
  }
}

export function createDataPipeline<T extends Record<string, unknown>>(
  collection: readonly T[]
): DataPipeline<T> {
  return new DataPipeline(collection);
}
