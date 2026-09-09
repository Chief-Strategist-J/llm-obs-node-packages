/**
 * @file rule.types.ts
 * @description Strongly Typed Domain Definitions & Zod Runtime Validation Schemas for Rules Engine.
 */

import { z } from "zod";
import { RULES_ENGINE_CONSTANTS } from "../constants/rules.constants";

export const RuleConditionOpSchema = z.enum([
  RULES_ENGINE_CONSTANTS.OP_EQUALS,
  RULES_ENGINE_CONSTANTS.OP_NOT_EQUALS,
  RULES_ENGINE_CONSTANTS.OP_GREATER_THAN,
  RULES_ENGINE_CONSTANTS.OP_LESS_THAN,
  RULES_ENGINE_CONSTANTS.OP_GTE,
  RULES_ENGINE_CONSTANTS.OP_LTE,
  RULES_ENGINE_CONSTANTS.OP_CONTAINS,
  RULES_ENGINE_CONSTANTS.OP_IN,
  RULES_ENGINE_CONSTANTS.OP_REGEX,
  RULES_ENGINE_CONSTANTS.OP_MATCHES,
  RULES_ENGINE_CONSTANTS.OP_EXISTS,
  RULES_ENGINE_CONSTANTS.OP_IS_NULL,
  RULES_ENGINE_CONSTANTS.OP_STARTS_WITH,
  RULES_ENGINE_CONSTANTS.OP_ENDS_WITH,
]);

export type RuleConditionOp = z.infer<typeof RuleConditionOpSchema>;

export const RuleConditionSchema = z.object({
  field: z.string().min(1),
  op: RuleConditionOpSchema,
  value: z.unknown().optional(),
});

export interface RuleCondition {
  readonly field: string;
  readonly op: RuleConditionOp;
  readonly value?: unknown;
}

export type AsyncCheckFn = (ctx: Readonly<Record<string, unknown>>) => Promise<boolean>;

export const RuleEffectSchema = z.enum([
  RULES_ENGINE_CONSTANTS.EFFECT_ALLOW,
  RULES_ENGINE_CONSTANTS.EFFECT_DENY,
]);

export type RuleEffect = z.infer<typeof RuleEffectSchema>;

export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  tenantId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().int().default(0),
  effect: RuleEffectSchema.default(RULES_ENGINE_CONSTANTS.EFFECT_ALLOW as RuleEffect),
  enabled: z.boolean().optional().default(true),
  conditions: z.array(RuleConditionSchema),
  asyncCheckName: z.string().optional(),
});

export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly tenantId?: string;
  readonly tags?: readonly string[];
  readonly priority?: number;
  readonly effect?: RuleEffect;
  readonly enabled?: boolean;
  readonly conditions: readonly RuleCondition[];
  readonly asyncCheckName?: string;
  readonly asyncCheck?: AsyncCheckFn;
}

export const RuleEvaluationContextSchema = z.record(z.string(), z.unknown());

export type RuleEvaluationContext = Readonly<Record<string, unknown>>;

export const RuleEvaluationResultSchema = z.object({
  decision: z.enum([RULES_ENGINE_CONSTANTS.DECISION_ALLOW, RULES_ENGINE_CONSTANTS.DECISION_DENY]),
  allowedRules: z.array(z.string()),
  deniedRules: z.array(z.string()),
  triggeredRules: z.array(z.string()),
  evaluatedCount: z.number().int().nonnegative(),
  executionTimeMs: z.number().nonnegative(),
});

export interface RuleEvaluationResult {
  readonly decision: typeof RULES_ENGINE_CONSTANTS.DECISION_ALLOW | typeof RULES_ENGINE_CONSTANTS.DECISION_DENY;
  readonly allowedRules: readonly string[];
  readonly deniedRules: readonly string[];
  readonly triggeredRules: readonly string[];
  readonly evaluatedCount: number;
  readonly executionTimeMs: number;
}

export interface ComposeOptions {
  readonly tenantId?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
}
