/**
 * @file condition-registry.ts
 * @description Safe Operator Evaluation Registry & Dynamic Condition Evaluation Engine.
 *
 * CONDITION EVALUATION & CONTEXT RESOLUTION ALGORITHM:
 * 1. Safe Deep Context Retrieval (`getSafeContextValue`):
 *    a. Return `undefined` if `ctx` is invalid or `fieldPath` is empty.
 *    b. Split `fieldPath` by `RULES_ENGINE_CONSTANTS.PATH_SEPARATOR` (`.`).
 *    c. Traverse object graph iteratively, checking prototype safety on every access step.
 *    d. Reject dangerous property accesses (`__proto__`, `constructor`, `prototype`) by returning `undefined`.
 * 2. Operator Handler Lookup & Execution:
 *    a. Retrieve condition operator handler from `ConditionHandlerRegistry`.
 *    b. Return `false` if operator handler is un-registered.
 *    c. Safely execute condition handler with actual context value and expected condition value.
 *    d. Wrap execution in try-catch to guarantee crash resilience.
 */

import type { RuleCondition } from "../types/rule.types";
import { RULES_ENGINE_CONSTANTS } from "../constants/rules.constants";

export type ConditionHandlerFn = (actual: unknown, expected: unknown) => boolean;

function isNumber(val: unknown): val is number {
  return typeof val === RULES_ENGINE_CONSTANTS.TYPE_NUMBER && !isNaN(val as number);
}

function isString(val: unknown): val is string {
  return typeof val === RULES_ENGINE_CONSTANTS.TYPE_STRING;
}

const DANGEROUS_PROPERTIES = new Set<string>([
  RULES_ENGINE_CONSTANTS.PROP_PROTO,
  RULES_ENGINE_CONSTANTS.PROP_CONSTRUCTOR,
  RULES_ENGINE_CONSTANTS.PROP_PROTOTYPE,
]);

export function getSafeContextValue(ctx: Readonly<Record<string, unknown>>, fieldPath: string): unknown {
  if (!ctx || typeof ctx !== RULES_ENGINE_CONSTANTS.TYPE_OBJECT || !fieldPath) {
    return undefined;
  }

  const parts = fieldPath.split(RULES_ENGINE_CONSTANTS.PATH_SEPARATOR);
  let current: any = ctx;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== RULES_ENGINE_CONSTANTS.TYPE_OBJECT) {
      return undefined;
    }
    if (DANGEROUS_PROPERTIES.has(part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

export class ConditionHandlerRegistry {
  private readonly handlers = new Map<string, ConditionHandlerFn>();

  constructor() {
    this.registerDefaults();
  }

  public register(op: string, handler: ConditionHandlerFn): void {
    this.handlers.set(op, handler);
  }

  public evaluate(cond: Readonly<RuleCondition>, ctx: Readonly<Record<string, unknown>>): boolean {
    const actual = getSafeContextValue(ctx, cond.field);
    const handler = this.handlers.get(cond.op);
    if (!handler) return false;
    try {
      return handler(actual, cond.value);
    } catch {
      return false;
    }
  }

  private registerDefaults(): void {
    this.register(RULES_ENGINE_CONSTANTS.OP_EQUALS, (actual, expected) => actual === expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_NOT_EQUALS, (actual, expected) => actual !== expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_GREATER_THAN, (actual, expected) => isNumber(actual) && isNumber(expected) && actual > expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_LESS_THAN, (actual, expected) => isNumber(actual) && isNumber(expected) && actual < expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_GTE, (actual, expected) => isNumber(actual) && isNumber(expected) && actual >= expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_LTE, (actual, expected) => isNumber(actual) && isNumber(expected) && actual <= expected);
    this.register(RULES_ENGINE_CONSTANTS.OP_CONTAINS, (actual, expected) => isString(actual) && isString(expected) && actual.includes(expected));
    this.register(RULES_ENGINE_CONSTANTS.OP_IN, (actual, expected) => Array.isArray(expected) && expected.includes(actual));
    this.register(RULES_ENGINE_CONSTANTS.OP_REGEX, (actual, expected) => {
      if (!isString(actual) || !isString(expected)) return false;
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    });
    this.register(RULES_ENGINE_CONSTANTS.OP_MATCHES, (actual, expected) => {
      if (!isString(actual) || !isString(expected)) return false;
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    });
    this.register(RULES_ENGINE_CONSTANTS.OP_EXISTS, (actual) => actual !== undefined && actual !== null);
    this.register(RULES_ENGINE_CONSTANTS.OP_IS_NULL, (actual) => actual === undefined || actual === null);
    this.register(RULES_ENGINE_CONSTANTS.OP_STARTS_WITH, (actual, expected) => isString(actual) && isString(expected) && actual.startsWith(expected));
    this.register(RULES_ENGINE_CONSTANTS.OP_ENDS_WITH, (actual, expected) => isString(actual) && isString(expected) && actual.endsWith(expected));
  }
}

export const conditionRegistry = new ConditionHandlerRegistry();
