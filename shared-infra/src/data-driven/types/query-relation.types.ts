/**
 * ALGORITHM SPECIFICATION:
 * 1. Define relationship specifications for 1-to-1, 1-to-many, many-to-many, through, and polymorphic relationships.
 * 2. Define query builder clause types covering basic, group, not, any/all/none, json, date, exists, fulltext, and vector similarity filter operations.
 * 3. Define specifications and result shapes for length-aware and cursor-based pagination.
 * 4. Define pipeline telemetry envelopes and step execution metadata types.
 */

import type { JsonEnvelope } from '../../utils/json-utils';

export enum RelationType {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY',
  MANY_TO_MANY = 'MANY_TO_MANY',
  HAS_ONE_THROUGH = 'HAS_ONE_THROUGH',
  HAS_MANY_THROUGH = 'HAS_MANY_THROUGH',
  ONE_TO_ONE_POLYMORPHIC = 'ONE_TO_ONE_POLYMORPHIC',
  ONE_TO_MANY_POLYMORPHIC = 'ONE_TO_MANY_POLYMORPHIC',
  MANY_TO_MANY_POLYMORPHIC = 'MANY_TO_MANY_POLYMORPHIC',
}

export interface OneToOneSpec {
  readonly foreignKey: string;
  readonly localKey: string;
  readonly as: string;
}

export interface OneToManySpec {
  readonly foreignKey: string;
  readonly localKey: string;
  readonly as: string;
}

export interface ManyToManySpec {
  readonly pivotStore: readonly Record<string, unknown>[];
  readonly foreignPivotKey: string;
  readonly relatedPivotKey: string;
  readonly parentLocalKey: string;
  readonly relatedLocalKey: string;
  readonly as: string;
}

export interface HasOneThroughSpec {
  readonly throughForeignKey: string;
  readonly throughLocalKey: string;
  readonly foreignKey: string;
  readonly localKey: string;
  readonly as: string;
}

export interface HasManyThroughSpec {
  readonly throughForeignKey: string;
  readonly throughLocalKey: string;
  readonly foreignKey: string;
  readonly localKey: string;
  readonly as: string;
}

export interface PolymorphicOneSpec {
  readonly typeField: string;
  readonly idField: string;
  readonly entityType: string;
  readonly localKey: string;
  readonly as: string;
}

export interface PolymorphicManySpec {
  readonly typeField: string;
  readonly idField: string;
  readonly entityType: string;
  readonly localKey: string;
  readonly as: string;
}

export interface PolymorphicManyToManySpec {
  readonly pivotStore: readonly Record<string, unknown>[];
  readonly pivotTypeField: string;
  readonly pivotIdField: string;
  readonly relatedPivotKey: string;
  readonly entityType: string;
  readonly parentLocalKey: string;
  readonly relatedLocalKey: string;
  readonly as: string;
}

export type WhereOperator =
  | 'eq'
  | '='
  | 'neq'
  | '!='
  | 'gt'
  | '>'
  | 'gte'
  | '>='
  | 'lt'
  | '<'
  | 'lte'
  | '<='
  | 'like'
  | 'in'
  | 'notIn'
  | 'null'
  | 'notNull'
  | 'between';

export interface WhereBasicClause {
  readonly kind: 'basic';
  readonly field: string;
  readonly operator: WhereOperator;
  readonly value: unknown;
  readonly boolean: 'and' | 'or';
}

export interface WhereNotClause {
  readonly kind: 'not';
  readonly clause: WhereClause;
  readonly boolean: 'and' | 'or';
}

export interface WhereGroupClause {
  readonly kind: 'group';
  readonly clauses: readonly WhereClause[];
  readonly boolean: 'and' | 'or';
}

export interface WhereAnyAllNoneClause {
  readonly kind: 'any_all_none';
  readonly mode: 'any' | 'all' | 'none';
  readonly clauses: readonly WhereClause[];
  readonly boolean: 'and' | 'or';
}

export interface WhereJsonClause {
  readonly kind: 'json';
  readonly path: string;
  readonly op: 'contains' | 'length' | 'eq';
  readonly value: unknown;
  readonly boolean: 'and' | 'or';
}

export interface WhereDateClause {
  readonly kind: 'date';
  readonly field: string;
  readonly part: 'date' | 'month' | 'year' | 'time';
  readonly operator: WhereOperator;
  readonly value: unknown;
  readonly boolean: 'and' | 'or';
}

export interface WhereExistsClause {
  readonly kind: 'exists';
  readonly subqueryCollection: readonly Record<string, unknown>[];
  readonly parentKey: string;
  readonly subqueryKey: string;
  readonly boolean: 'and' | 'or';
}

export interface WhereFullTextClause {
  readonly kind: 'fulltext';
  readonly fields: readonly string[];
  readonly query: string;
  readonly boolean: 'and' | 'or';
}

export interface WhereVectorSimilarityClause {
  readonly kind: 'vector_similarity';
  readonly vectorField: string;
  readonly targetVector: readonly number[];
  readonly minSimilarity: number;
  readonly boolean: 'and' | 'or';
}

export type WhereClause =
  | WhereBasicClause
  | WhereNotClause
  | WhereGroupClause
  | WhereAnyAllNoneClause
  | WhereJsonClause
  | WhereDateClause
  | WhereExistsClause
  | WhereFullTextClause
  | WhereVectorSimilarityClause;

export interface SortClause {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

export interface GroupByClause {
  readonly fields: readonly string[];
  readonly having?: readonly {
    readonly field: string;
    readonly aggregate: 'sum' | 'avg' | 'count' | 'min' | 'max';
    readonly operator: WhereOperator;
    readonly value: number;
  }[];
}

export interface LimitOffsetClause {
  readonly limit: number;
  readonly offset: number;
}

export interface LengthAwarePaginationSpec {
  readonly page: number;
  readonly pageSize: number;
  readonly url?: string;
}

export interface CursorPaginationSpec {
  readonly cursor?: string;
  readonly pageSize: number;
  readonly cursorField?: string;
}

export interface LengthAwarePaginatorResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly perPage: number;
  readonly currentPage: number;
  readonly lastPage: number;
  readonly nextPageUrl: string | null;
  readonly prevPageUrl: string | null;
  readonly pageUrls: readonly { readonly page: number; readonly url: string }[];
}

export interface CursorPaginatorResult<T> {
  readonly items: readonly T[];
  readonly perPage: number;
  readonly nextCursor: string | null;
  readonly prevCursor: string | null;
  readonly hasMore: boolean;
}

export interface StepTelemetry {
  readonly stepName: string;
  readonly durationMs: number;
  readonly inputCount: number;
  readonly outputCount: number;
}

export interface PipelineMeta {
  readonly executionTimeMs: number;
  readonly traceparent?: string;
  readonly operation: string;
  readonly stepsExecuted: number;
  readonly stepTelemetry: readonly StepTelemetry[];
}

export type DataPipelineEnvelope<T> = JsonEnvelope<T> & {
  readonly pipelineMeta: PipelineMeta;
  readonly originalData: readonly Record<string, unknown>[];
};
