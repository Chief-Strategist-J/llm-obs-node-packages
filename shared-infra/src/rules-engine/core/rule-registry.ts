/**
 * @file rule-registry.ts
 * @description Centralized Enterprise Rule Registry for Rule Storage, Querying, and Filtering.
 *
 * RULE REGISTRATION & QUERYING ALGORITHM:
 * 1. Rule Registration:
 *    a. Validate rule payload structure using runtime `RuleSchema.parse()`.
 *    b. Store validated rule in internal Map keyed by `rule.id`, preserving inline `asyncCheck` functions.
 * 2. Rule Querying:
 *    a. Single lookup: Return rule object by ID.
 *    b. Category query: Filter stored rules matching requested `category`.
 *    c. Tenant query: Filter stored rules matching requested `tenantId` or un-scoped rules.
 *    d. Tag query: Filter stored rules containing requested `tag`.
 */

import type { Rule } from "../types/rule.types";
import { RuleSchema } from "../types/rule.types";

export class CentralizedRuleRegistry {
  private readonly rulesMap = new Map<string, Rule>();

  public register(rule: Readonly<Rule>): void {
    const validated = RuleSchema.parse(rule);
    this.rulesMap.set(validated.id, { ...validated, asyncCheck: rule.asyncCheck });
  }

  public registerSet(rules: readonly Rule[]): void {
    rules.forEach((r) => this.register(r));
  }

  public get(id: string): Readonly<Rule> | undefined {
    return this.rulesMap.get(id);
  }

  public getAll(): readonly Rule[] {
    return Object.freeze(Array.from(this.rulesMap.values()));
  }

  public getByCategory(category: string): readonly Rule[] {
    return Object.freeze(this.getAll().filter((r) => r.category === category));
  }

  public getByTenant(tenantId: string): readonly Rule[] {
    return Object.freeze(this.getAll().filter((r) => r.tenantId === tenantId || !r.tenantId));
  }

  public getByTag(tag: string): readonly Rule[] {
    return Object.freeze(this.getAll().filter((r) => r.tags && r.tags.includes(tag)));
  }

  public remove(id: string): boolean {
    return this.rulesMap.delete(id);
  }

  public clear(): void {
    this.rulesMap.clear();
  }
}

export const ruleRegistry = new CentralizedRuleRegistry();
