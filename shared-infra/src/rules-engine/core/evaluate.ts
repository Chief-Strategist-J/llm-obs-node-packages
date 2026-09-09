/**
 * @file evaluate.ts
 * @description Pure Enterprise Rules Engine Evaluation Core with OTEL Tracing & Deny-Override Decision Strategy.
 *
 * PURE EVALUATION ALGORITHM:
 * 1. Capture execution start timestamp using pure time provider (`nowFn` or `Date.now`) and extract telemetry caller context.
 * 2. Initiate OpenTelemetry tracing span (`RulesEngine.evaluateRules`) and set execution metadata.
 * 3. Pre-process Candidate Rules (Pure Transformation):
 *    a. Filter disabled rules (`enabled === false`).
 *    b. Validate candidate rules against `RuleSchema` Zod contract.
 *    c. Sort candidate rules by priority descending into a new candidate collection without mutating inputs.
 * 4. Iterate & Evaluate Active Rules (Side-Effect Free):
 *    a. Evaluate synchronous conditions against `ctx` using registered condition handlers.
 *    b. Record evaluation telemetry event on OTEL span.
 *    c. Skip remaining rule processing if synchronous conditions fail.
 *    d. Execute asynchronous checkers if defined (`asyncCheck` or named checker lookup).
 *    e. Record async check evaluation event.
 *    f. Skip rule if async check fails.
 *    g. Categorize rule ID into `triggeredRules` and `deniedRules` or `allowedRules`.
 * 5. Resolve Final Security Decision (Deny-Override Policy):
 *    a. If `deniedRules.length > 0`, return `DENY`.
 *    b. Otherwise, return `ALLOW`.
 * 6. Construct, validate against `RuleEvaluationResultSchema`, and return a deeply frozen (`Object.freeze`) immutable output object.
 */

import type { Rule, RuleEvaluationResult, AsyncCheckFn } from "../types/rule.types";
import { RuleEvaluationResultSchema, RuleSchema } from "../types/rule.types";
import { withSpan } from "../../tracing/tracer";
import { getCallerInfo } from "../../tracing/caller-info";
import { RULES_ENGINE_CONSTANTS } from "../constants/rules.constants";
import { conditionRegistry, type ConditionHandlerFn } from "./condition-registry";
import { asyncCheckerRegistry } from "./async-checkers";

export interface PureEvaluateOptions {
  readonly conditionHandlers?: ReadonlyMap<string, ConditionHandlerFn>;
  readonly asyncCheckers?: ReadonlyMap<string, AsyncCheckFn>;
  readonly nowFn?: () => number;
}

export async function evaluateRules(
  rules: readonly Rule[],
  ctx: Readonly<Record<string, unknown>>,
  options?: PureEvaluateOptions
): Promise<RuleEvaluationResult> {
  const getNow = options?.nowFn ?? Date.now;
  const startTime = getNow();
  const caller = getCallerInfo(2);

  return withSpan(RULES_ENGINE_CONSTANTS.SPAN_EVALUATE_RULES, async (span) => {
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_FUNCTION, caller.functionName);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_FILEPATH, caller.filePath);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_LINENO, caller.lineNumber);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_EVALUATED_COUNT, rules.length);

    const activeCandidates = [
      ...rules
        .filter((r) => r && r.enabled !== false)
        .map((r) => RuleSchema.parse(r) as Rule),
    ].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const allowedRules: string[] = [];
    const deniedRules: string[] = [];
    const triggeredRules: string[] = [];

    for (const rule of activeCandidates) {
      const conditionsMet = rule.conditions.every((cond) => conditionRegistry.evaluate(cond, ctx));

      span.addEvent(RULES_ENGINE_CONSTANTS.EVENT_RULE_EVALUATED, {
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_ID]: rule.id,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_NAME]: rule.name,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_CONDITIONS_PASSED]: conditionsMet,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_PRIORITY]: rule.priority ?? 0,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_EFFECT]: rule.effect,
      });

      if (!conditionsMet) continue;

      let asyncPassed = true;
      if (rule.asyncCheck) {
        try {
          asyncPassed = await rule.asyncCheck(ctx);
        } catch {
          asyncPassed = false;
        }
      } else if (rule.asyncCheckName) {
        const customChecker = options?.asyncCheckers?.get(rule.asyncCheckName);
        if (customChecker) {
          try {
            asyncPassed = await customChecker(ctx);
          } catch {
            asyncPassed = false;
          }
        } else {
          asyncPassed = await asyncCheckerRegistry.execute(rule.asyncCheckName, ctx);
        }
      }

      span.addEvent(RULES_ENGINE_CONSTANTS.EVENT_ASYNC_CHECK_EVALUATED, {
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_ID]: rule.id,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_ASYNC_PASSED]: asyncPassed,
      });

      if (!asyncPassed) continue;

      triggeredRules.push(rule.id);
      if (rule.effect === RULES_ENGINE_CONSTANTS.EFFECT_DENY) {
        deniedRules.push(rule.id);
      } else {
        allowedRules.push(rule.id);
      }
    }

    const decision = deniedRules.length > 0 ? RULES_ENGINE_CONSTANTS.DECISION_DENY : RULES_ENGINE_CONSTANTS.DECISION_ALLOW;

    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_DECISION, decision);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_COUNT, triggeredRules.length);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_IDS, JSON.stringify(triggeredRules));

    const resultPayload = {
      decision,
      allowedRules,
      deniedRules,
      triggeredRules,
      evaluatedCount: rules.length,
      executionTimeMs: Math.max(0, getNow() - startTime),
    };

    const parsed = RuleEvaluationResultSchema.parse(resultPayload);
    return Object.freeze({
      ...parsed,
      allowedRules: Object.freeze([...parsed.allowedRules]),
      deniedRules: Object.freeze([...parsed.deniedRules]),
      triggeredRules: Object.freeze([...parsed.triggeredRules]),
    }) as RuleEvaluationResult;
  });
}

export async function resolveRules(
  rules: readonly Rule[],
  ctx: Readonly<Record<string, unknown>>,
  options?: PureEvaluateOptions
): Promise<readonly Rule[]> {
  const caller = getCallerInfo(2);
  return withSpan(RULES_ENGINE_CONSTANTS.SPAN_RESOLVE_RULES, async (span) => {
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_FUNCTION, caller.functionName);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_FILEPATH, caller.filePath);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_CODE_LINENO, caller.lineNumber);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_EVALUATED_COUNT, rules.length);

    const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const activeRules: Rule[] = [];

    for (const rule of sorted) {
      if (rule.enabled === false) continue;
      const conditionsMet = rule.conditions.every((cond) => conditionRegistry.evaluate(cond, ctx));

      span.addEvent(RULES_ENGINE_CONSTANTS.EVENT_RULE_EVALUATED, {
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_ID]: rule.id,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_NAME]: rule.name,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_CONDITIONS_PASSED]: conditionsMet,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_PRIORITY]: rule.priority ?? 0,
      });

      if (!conditionsMet) continue;

      let asyncPassed = true;
      if (rule.asyncCheck) {
        try {
          asyncPassed = await rule.asyncCheck(ctx);
        } catch {
          asyncPassed = false;
        }
      } else if (rule.asyncCheckName) {
        const customChecker = options?.asyncCheckers?.get(rule.asyncCheckName);
        if (customChecker) {
          try {
            asyncPassed = await customChecker(ctx);
          } catch {
            asyncPassed = false;
          }
        } else {
          asyncPassed = await asyncCheckerRegistry.execute(rule.asyncCheckName, ctx);
        }
      }

      span.addEvent(RULES_ENGINE_CONSTANTS.EVENT_ASYNC_CHECK_EVALUATED, {
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULE_ID]: rule.id,
        [RULES_ENGINE_CONSTANTS.EVENT_ATTR_ASYNC_PASSED]: asyncPassed,
      });

      if (asyncPassed) {
        activeRules.push(rule);
      }
    }

    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_COUNT, activeRules.length);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_IDS, JSON.stringify(activeRules.map((r) => r.id)));
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_NAMES, JSON.stringify(activeRules.map((r) => r.name)));

    return Object.freeze(activeRules) as readonly Rule[];
  });
}
