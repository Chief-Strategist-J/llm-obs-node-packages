/**
 * @file entity-schema.types.ts
 * @description Strongly Typed Entity Schema & Runtime Zod Anti-Corruption Contracts.
 */

import type { z } from 'zod';
import type { JsonMapOp } from './transform.types';

export type FieldKind = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface FieldConfig<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly options?: readonly { readonly label: string; readonly value: T }[];
  readonly defaultValue?: T;
}

export interface EntitySchema<T = Record<string, unknown>> {
  readonly name: string;
  readonly endpoint: string;
  readonly fields: readonly FieldConfig[];
  readonly validate: z.ZodType<T>;
  readonly fromApi?: readonly JsonMapOp[];
  readonly toApi?: readonly JsonMapOp[];
}
