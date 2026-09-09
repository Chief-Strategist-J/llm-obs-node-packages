/**
 * @file compose-rules.ts
 * @description Pure Rule Set Composition Engine for Merging Global, Tenant & Feature Scope Rules.
 *
 * RULE COMPOSITION ALGORITHM:
 * 1. Merge input rule collections (`globalRules`, `tenantRules`, `featureRules`) into a single combined array.
 * 2. Scope Filtering:
 *    a. If `options.tenantId` is specified, retain rules matching `tenantId` or un-scoped rules.
 *    b. If `options.category` is specified, retain rules matching `category` or un-categorized rules.
 *    c. If `options.tags` are specified, retain rules sharing at least one tag.
 * 3. Priority Deduplication:
 *    a. Iterate through filtered candidate rules in order.
 *    b. Exclude disabled rules (`enabled === false`).
 *    c. Upsert rules into a Map keyed by `rule.id` (higher index / feature-level rules override lower index / global rules).
 * 4. Priority Ordering & Immutability:
 *    a. Extract Map values into an array and sort by priority descending.
 *    b. Telemetry tracing attributes and composition events are recorded on the span.
 *    c. Return a frozen array (`Object.freeze`) of composed rules.
 */

import type { ComposeOptions, Rule } from "../types/rule.types";
import { withSpan } from "../../tracing/tracer";
import { RULES_ENGINE_CONSTANTS } from "../constants/rules.constants";

export async function composeRuleSets(
  globalRules: readonly Rule[],
  tenantRules: readonly Rule[],
  featureRules: readonly Rule[],
  options: Readonly<ComposeOptions>
): Promise<readonly Rule[]> {
  return withSpan(RULES_ENGINE_CONSTANTS.SPAN_COMPOSE_RULES, async (span) => {
    const combined = [...globalRules, ...tenantRules, ...featureRules];

    let filtered = combined;
    if (options.tenantId) {
      filtered = filtered.filter((r) => !r.tenantId || r.tenantId === options.tenantId);
    }

    if (options.category) {
      filtered = filtered.filter((r) => !r.category || r.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      const tagSet = new Set(options.tags);
      filtered = filtered.filter((r) => !r.tags || r.tags.some((t) => tagSet.has(t)));
    }

    const ruleMap = new Map<string, Rule>();
    for (const r of filtered) {
      if (r.enabled !== false) {
        ruleMap.set(r.id, r);
      }
    }

    const composed = Array.from(ruleMap.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_EVALUATED_COUNT, combined.length);
    span.setAttribute(RULES_ENGINE_CONSTANTS.ATTR_TRIGGERED_COUNT, composed.length);
    span.addEvent(RULES_ENGINE_CONSTANTS.EVENT_RULE_COMPOSED, {
      [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULES_TOTAL]: combined.length,
      [RULES_ENGINE_CONSTANTS.EVENT_ATTR_RULES_COMPOSED]: composed.length,
    });

    return Object.freeze(composed) as readonly Rule[];
  });
}
