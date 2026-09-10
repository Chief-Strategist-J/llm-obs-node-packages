/**
 * ALGORITHM SPECIFICATION:
 * 1. Define JSON-serializable pipeline step specification types for data-driven query building and transformation.
 * 2. Support data-driven query clauses, 8-type relationship loading, JSON field mapping, nested transforms, collection ops, and pagination.
 * 3. Provide DataPipelineSpec structure to enable 100% JSON-spec-driven execution without imperative code.
 */

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
} from './query-relation.types';
import type { JsonMapOp, ListOp, Path } from './transform.types';

export type PipelineSpecStep =
  | { readonly type: 'where'; readonly field: string; readonly operator: WhereOperator; readonly value: unknown; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereNot'; readonly clause: WhereClause; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereGroup'; readonly clauses: readonly WhereClause[]; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereAny'; readonly clauses: readonly WhereClause[]; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereAll'; readonly clauses: readonly WhereClause[]; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereNone'; readonly clauses: readonly WhereClause[]; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereJsonContains'; readonly path: string; readonly value: unknown; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereJsonLength'; readonly path: string; readonly length: number; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereDate'; readonly field: string; readonly operator: WhereOperator; readonly value: unknown; readonly part?: 'date' | 'month' | 'year' | 'time'; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereExists'; readonly subqueryCollectionName: string; readonly parentKey: string; readonly subqueryKey: string; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereFullText'; readonly fields: readonly string[]; readonly query: string; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'whereVectorSimilarity'; readonly vectorField: string; readonly targetVector: readonly number[]; readonly minSimilarity: number; readonly boolean?: 'and' | 'or' }
  | { readonly type: 'orderBy'; readonly field: string; readonly direction?: 'asc' | 'desc' }
  | { readonly type: 'inRandomOrder'; readonly seed?: number }
  | { readonly type: 'limit'; readonly count: number; readonly offset?: number }
  | { readonly type: 'groupBy'; readonly fields: readonly string[]; readonly having?: GroupByClause['having'] }
  | { readonly type: 'loadOneToOne'; readonly storeName: string; readonly spec: OneToOneSpec }
  | { readonly type: 'loadOneToMany'; readonly storeName: string; readonly spec: OneToManySpec }
  | { readonly type: 'loadManyToMany'; readonly storeName: string; readonly spec: ManyToManySpec }
  | { readonly type: 'loadHasOneThrough'; readonly throughStoreName: string; readonly relatedStoreName: string; readonly spec: HasOneThroughSpec }
  | { readonly type: 'loadHasManyThrough'; readonly throughStoreName: string; readonly relatedStoreName: string; readonly spec: HasManyThroughSpec }
  | { readonly type: 'loadOneToOnePolymorphic'; readonly storeName: string; readonly spec: PolymorphicOneSpec }
  | { readonly type: 'loadOneToManyPolymorphic'; readonly storeName: string; readonly spec: PolymorphicManySpec }
  | { readonly type: 'loadManyToManyPolymorphic'; readonly storeName: string; readonly spec: PolymorphicManyToManySpec }
  | { readonly type: 'mapJson'; readonly ops: readonly JsonMapOp[] }
  | { readonly type: 'transformList'; readonly ops: readonly ListOp[] }
  | { readonly type: 'setInPath'; readonly path: Path; readonly value: unknown }
  | { readonly type: 'remapDeepPaths'; readonly mappings: readonly { readonly from: string; readonly to: string; readonly default?: unknown }[] }
  | { readonly type: 'flattenNested'; readonly delimiter?: string }
  | { readonly type: 'unflattenNested'; readonly delimiter?: string }
  | { readonly type: 'makeHidden'; readonly keys: readonly string[] }
  | { readonly type: 'setHidden'; readonly keys: readonly string[] }
  | { readonly type: 'makeVisible'; readonly keys: readonly string[]; readonly idField?: string }
  | { readonly type: 'only'; readonly keys: readonly string[] }
  | { readonly type: 'except'; readonly keys: readonly string[] }
  | { readonly type: 'unique'; readonly keyField?: string }
  | { readonly type: 'paginate'; readonly spec: LengthAwarePaginationSpec }
  | { readonly type: 'paginateCursor'; readonly spec: CursorPaginationSpec };

export interface DataPipelineSpec {
  readonly name: string;
  readonly steps: readonly PipelineSpecStep[];
}
