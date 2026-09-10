/**
 * ALGORITHM SPECIFICATION:
 * 1. Fluid, type-safe DataPipelineSpec builder providing compile-time IntelliSense autocompletion for step creation.
 * 2. Accumulate steps immutably without mutating internal state.
 * 3. Validate compiled spec on build using validatePipelineSpec.
 */

import type { DataPipelineSpec, PipelineSpecStep } from '../types/pipeline-spec.types';
import type {
  WhereClause,
  WhereOperator,
  SortClause,
  GroupByClause,
  LengthAwarePaginationSpec,
  CursorPaginationSpec,
  OneToOneSpec,
  OneToManySpec,
  ManyToManySpec,
  HasOneThroughSpec,
  HasManyThroughSpec,
  PolymorphicOneSpec,
  PolymorphicManySpec,
  PolymorphicManyToManySpec,
} from '../types/query-relation.types';
import type { JsonMapOp, ListOp, Path } from '../types/transform.types';
import { validatePipelineSpec } from './spec-validator';

export class SpecBuilder {
  private readonly name: string;
  private readonly steps: readonly PipelineSpecStep[];

  constructor(name: string, steps: readonly PipelineSpecStep[] = []) {
    this.name = name;
    this.steps = Object.freeze([...steps]);
  }

  private addStep(step: PipelineSpecStep): SpecBuilder {
    return new SpecBuilder(this.name, [...this.steps, Object.freeze(step)]);
  }

  public where(field: string, operator: WhereOperator, value: unknown, boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'where', field, operator, value, boolean });
  }

  public whereNot(clause: WhereClause, boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereNot', clause, boolean });
  }

  public whereGroup(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereGroup', clauses, boolean });
  }

  public whereAny(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereAny', clauses, boolean });
  }

  public whereAll(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereAll', clauses, boolean });
  }

  public whereNone(clauses: readonly WhereClause[], boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereNone', clauses, boolean });
  }

  public whereJsonContains(path: string, value: unknown, boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereJsonContains', path, value, boolean });
  }

  public whereJsonLength(path: string, length: number, boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereJsonLength', path, length, boolean });
  }

  public whereDate(
    field: string,
    operator: WhereOperator,
    value: unknown,
    part: 'date' | 'month' | 'year' | 'time' = 'date',
    boolean: 'and' | 'or' = 'and'
  ): SpecBuilder {
    return this.addStep({ type: 'whereDate', field, operator, value, part, boolean });
  }

  public whereExists(
    subqueryCollectionName: string,
    parentKey: string,
    subqueryKey: string,
    boolean: 'and' | 'or' = 'and'
  ): SpecBuilder {
    return this.addStep({ type: 'whereExists', subqueryCollectionName, parentKey, subqueryKey, boolean });
  }

  public whereFullText(fields: readonly string[], query: string, boolean: 'and' | 'or' = 'and'): SpecBuilder {
    return this.addStep({ type: 'whereFullText', fields, query, boolean });
  }

  public whereVectorSimilarity(
    vectorField: string,
    targetVector: readonly number[],
    minSimilarity: number,
    boolean: 'and' | 'or' = 'and'
  ): SpecBuilder {
    return this.addStep({ type: 'whereVectorSimilarity', vectorField, targetVector, minSimilarity, boolean });
  }

  public orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): SpecBuilder {
    return this.addStep({ type: 'orderBy', field, direction });
  }

  public inRandomOrder(seed?: number): SpecBuilder {
    return this.addStep({ type: 'inRandomOrder', seed });
  }

  public limit(count: number, offset = 0): SpecBuilder {
    return this.addStep({ type: 'limit', count, offset });
  }

  public groupBy(fields: readonly string[], having?: GroupByClause['having']): SpecBuilder {
    return this.addStep({ type: 'groupBy', fields, having });
  }

  public loadOneToOne(storeName: string, spec: OneToOneSpec): SpecBuilder {
    return this.addStep({ type: 'loadOneToOne', storeName, spec });
  }

  public loadOneToMany(storeName: string, spec: OneToManySpec): SpecBuilder {
    return this.addStep({ type: 'loadOneToMany', storeName, spec });
  }

  public loadManyToMany(storeName: string, spec: ManyToManySpec): SpecBuilder {
    return this.addStep({ type: 'loadManyToMany', storeName, spec });
  }

  public loadHasOneThrough(throughStoreName: string, relatedStoreName: string, spec: HasOneThroughSpec): SpecBuilder {
    return this.addStep({ type: 'loadHasOneThrough', throughStoreName, relatedStoreName, spec });
  }

  public loadHasManyThrough(throughStoreName: string, relatedStoreName: string, spec: HasManyThroughSpec): SpecBuilder {
    return this.addStep({ type: 'loadHasManyThrough', throughStoreName, relatedStoreName, spec });
  }

  public loadOneToOnePolymorphic(storeName: string, spec: PolymorphicOneSpec): SpecBuilder {
    return this.addStep({ type: 'loadOneToOnePolymorphic', storeName, spec });
  }

  public loadOneToManyPolymorphic(storeName: string, spec: PolymorphicManySpec): SpecBuilder {
    return this.addStep({ type: 'loadOneToManyPolymorphic', storeName, spec });
  }

  public loadManyToManyPolymorphic(storeName: string, spec: PolymorphicManyToManySpec): SpecBuilder {
    return this.addStep({ type: 'loadManyToManyPolymorphic', storeName, spec });
  }

  public mapJson(ops: readonly JsonMapOp[]): SpecBuilder {
    return this.addStep({ type: 'mapJson', ops });
  }

  public transformList(ops: readonly ListOp[]): SpecBuilder {
    return this.addStep({ type: 'transformList', ops });
  }

  public setInPath(path: Path, value: unknown): SpecBuilder {
    return this.addStep({ type: 'setInPath', path, value });
  }

  public remapDeepPaths(mappings: readonly { readonly from: string; readonly to: string; readonly default?: unknown }[]): SpecBuilder {
    return this.addStep({ type: 'remapDeepPaths', mappings });
  }

  public flattenNested(delimiter = '.'): SpecBuilder {
    return this.addStep({ type: 'flattenNested', delimiter });
  }

  public unflattenNested(delimiter = '.'): SpecBuilder {
    return this.addStep({ type: 'unflattenNested', delimiter });
  }

  public makeHidden(keys: readonly string[]): SpecBuilder {
    return this.addStep({ type: 'makeHidden', keys });
  }

  public setHidden(keys: readonly string[]): SpecBuilder {
    return this.addStep({ type: 'setHidden', keys });
  }

  public makeVisible(keys: readonly string[], idField = 'id'): SpecBuilder {
    return this.addStep({ type: 'makeVisible', keys, idField });
  }

  public only(keys: readonly string[]): SpecBuilder {
    return this.addStep({ type: 'only', keys });
  }

  public except(keys: readonly string[]): SpecBuilder {
    return this.addStep({ type: 'except', keys });
  }

  public unique(keyField = 'id'): SpecBuilder {
    return this.addStep({ type: 'unique', keyField });
  }

  public paginate(spec: LengthAwarePaginationSpec): SpecBuilder {
    return this.addStep({ type: 'paginate', spec });
  }

  public paginateCursor(spec: CursorPaginationSpec): SpecBuilder {
    return this.addStep({ type: 'paginateCursor', spec });
  }

  public build(): DataPipelineSpec {
    const rawSpec: DataPipelineSpec = Object.freeze({
      name: this.name,
      steps: this.steps,
    });
    return validatePipelineSpec(rawSpec);
  }
}

export function createSpecBuilder(name: string): SpecBuilder {
  return new SpecBuilder(name);
}
