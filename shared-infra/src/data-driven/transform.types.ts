/**
 * @file transform.types.ts
 * @description Strongly Typed Enums, Constants, and Readonly Operation Descriptors for Data Transformations.
 */

export const DATA_TRANSFORM_CONSTANTS = {
  OP_RENAME: 'rename',
  OP_PICK: 'pick',
  OP_OMIT: 'omit',
  OP_DEFAULT: 'default',
  OP_COERCE: 'coerce',

  TARGET_STRING: 'string',
  TARGET_NUMBER: 'number',
  TARGET_BOOLEAN: 'boolean',
  TARGET_DATE: 'date',

  OP_FILTER: 'filter',
  OP_SEARCH: 'search',
  OP_SORT: 'sort',
  OP_PAGINATE: 'paginate',
  OP_GROUP_BY: 'groupBy',

  CMP_EQ: 'eq',
  CMP_NEQ: 'neq',
  CMP_GT: 'gt',
  CMP_LT: 'lt',
  CMP_CONTAINS: 'contains',

  DIR_ASC: 'asc',
  DIR_DESC: 'desc',
  EMPTY_STRING: '',
} as const;

export enum JsonMapOpKind {
  RENAME = 'rename',
  PICK = 'pick',
  OMIT = 'omit',
  DEFAULT = 'default',
  COERCE = 'coerce',
}

export enum CoerceTarget {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
}

export enum ListOpKind {
  FILTER = 'filter',
  SEARCH = 'search',
  SORT = 'sort',
  PAGINATE = 'paginate',
  PICK = 'pick',
  GROUP_BY = 'groupBy',
}

export enum FilterComparison {
  EQ = 'eq',
  NEQ = 'neq',
  GT = 'gt',
  LT = 'lt',
  CONTAINS = 'contains',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export type ListOp =
  | { readonly op: ListOpKind.FILTER | 'filter'; readonly field: string; readonly value: unknown; readonly cmp?: FilterComparison | `${FilterComparison}` }
  | { readonly op: ListOpKind.SEARCH | 'search'; readonly fields: readonly string[]; readonly query: string }
  | { readonly op: ListOpKind.SORT | 'sort'; readonly field: string; readonly direction?: SortDirection | `${SortDirection}`; readonly dir?: SortDirection | `${SortDirection}` }
  | { readonly op: ListOpKind.PAGINATE | 'paginate'; readonly page: number; readonly pageSize: number }
  | { readonly op: ListOpKind.PICK | 'pick'; readonly fields: readonly string[] }
  | { readonly op: ListOpKind.GROUP_BY | 'groupBy'; readonly field: string };

export type JsonMapOp =
  | { readonly op: JsonMapOpKind.RENAME | 'rename'; readonly from: string; readonly to: string }
  | { readonly op: JsonMapOpKind.PICK | 'pick'; readonly keys: readonly string[] }
  | { readonly op: JsonMapOpKind.PICK | 'pick'; readonly fields: readonly string[] }
  | { readonly op: JsonMapOpKind.OMIT | 'omit'; readonly keys: readonly string[] }
  | { readonly op: JsonMapOpKind.OMIT | 'omit'; readonly fields: readonly string[] }
  | { readonly op: JsonMapOpKind.DEFAULT | 'default'; readonly key: string; readonly value: unknown }
  | { readonly op: JsonMapOpKind.DEFAULT | 'default'; readonly field: string; readonly value: unknown }
  | { readonly op: JsonMapOpKind.COERCE | 'coerce'; readonly key: string; readonly to: CoerceTarget | `${CoerceTarget}` }
  | { readonly op: JsonMapOpKind.COERCE | 'coerce'; readonly field: string; readonly to: CoerceTarget | `${CoerceTarget}` };
