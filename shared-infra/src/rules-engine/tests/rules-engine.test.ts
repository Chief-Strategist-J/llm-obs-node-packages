import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateRules,
  resolveRules,
  composeRuleSets,
  conditionRegistry,
  asyncCheckerRegistry,
  ruleRegistry,
  errorRegistry,
  RULES_ENGINE_CONSTANTS,
  RuleSchema,
  RuleConditionSchema,
  getSafeContextValue,
  type Rule,
} from "../index";

describe("Rules Engine Core Architecture", () => {
  beforeEach(() => {
    ruleRegistry.clear();
    asyncCheckerRegistry.clear();
  });

  describe("1. Condition Operators & Safe Property Path Resolution", () => {
    it("evaluates all standard operators accurately", () => {
      const ctx = {
        user: { role: "admin", age: 30, tags: ["v1", "beta"], score: 95.5 },
        status: "ACTIVE_USER",
        nullField: null,
      };

      expect(conditionRegistry.evaluate({ field: "user.role", op: "equals", value: "admin" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.role", op: "not_equals", value: "guest" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.age", op: "greater_than", value: 25 }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.age", op: "less_than", value: 40 }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.score", op: "gte", value: 95.5 }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.score", op: "lte", value: 95.5 }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.role", op: "contains", value: "adm" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.role", op: "in", value: ["admin", "root"] }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "status", op: "regex", value: "^ACTIVE_" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "status", op: "starts_with", value: "ACTIVE" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "status", op: "ends_with", value: "USER" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "user.age", op: "exists" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "nullField", op: "is_null" }, ctx)).toBe(true);
      expect(conditionRegistry.evaluate({ field: "missingField", op: "is_null" }, ctx)).toBe(true);
    });

    it("protects against Prototype Pollution attacks on context lookup", () => {
      const pollutedCtx: any = { a: 1 };
      expect(getSafeContextValue(pollutedCtx, "__proto__.admin")).toBeUndefined();
      expect(getSafeContextValue(pollutedCtx, "constructor.prototype")).toBeUndefined();
      expect(getSafeContextValue(pollutedCtx, "prototype.polluted")).toBeUndefined();
    });
  });

  describe("2. Rule Evaluation Engine & Deny-Override Strategy", () => {
    it("evaluates rules in priority order and applies Deny-Override", async () => {
      const rules: Rule[] = [
        {
          id: "rule_allow_admin",
          name: "Allow Admin Role",
          priority: 10,
          effect: "allow",
          conditions: [{ field: "user.role", op: "equals", value: "admin" }],
        },
        {
          id: "rule_deny_suspended",
          name: "Deny Suspended Account",
          priority: 100,
          effect: "deny",
          conditions: [{ field: "user.status", op: "equals", value: "SUSPENDED" }],
        },
      ];

      const ctxActive = { user: { role: "admin", status: "ACTIVE" } };
      const resActive = await evaluateRules(rules, ctxActive);
      expect(resActive.decision).toBe("ALLOW");
      expect(resActive.allowedRules).toContain("rule_allow_admin");
      expect(resActive.deniedRules.length).toBe(0);

      const ctxSuspended = { user: { role: "admin", status: "SUSPENDED" } };
      const resSuspended = await evaluateRules(rules, ctxSuspended);
      expect(resSuspended.decision).toBe("DENY");
      expect(resSuspended.deniedRules).toContain("rule_deny_suspended");
    });

    it("executes named async checkers dynamically", async () => {
      asyncCheckerRegistry.register("checkCreditLimit", async (ctx) => {
        const amount = ctx.amount as number;
        return amount <= 1000;
      });

      const rules: Rule[] = [
        {
          id: "rule_credit_check",
          name: "Credit Limit Rule",
          priority: 50,
          effect: "allow",
          conditions: [{ field: "transactionType", op: "equals", value: "TRANSFER" }],
          asyncCheckName: "checkCreditLimit",
        },
      ];

      const validRes = await evaluateRules(rules, { transactionType: "TRANSFER", amount: 500 });
      expect(validRes.decision).toBe("ALLOW");

      const exceededRes = await evaluateRules(rules, { transactionType: "TRANSFER", amount: 2000 });
      expect(exceededRes.allowedRules.length).toBe(0);
    });

    it("maintains backwards compatibility with resolveRules()", async () => {
      const rules: Rule[] = [
        {
          id: "r1",
          name: "Rule 1",
          priority: 5,
          effect: "allow",
          conditions: [{ field: "env", op: "equals", value: "prod" }],
        },
      ];

      const active = await resolveRules(rules, { env: "prod" });
      expect(active.length).toBe(1);
      expect(active[0].id).toBe("r1");
    });
  });

  describe("3. Multi-Scope Rule Composition Engine", () => {
    it("composes global, tenant, and feature rules with deduplication and priority sorting", async () => {
      const globalRules: Rule[] = [
        { id: "g1", name: "Global Rate Limit", priority: 1, effect: "allow", conditions: [] },
      ];
      const tenantRules: Rule[] = [
        { id: "t1", name: "Tenant Quota", tenantId: "tenant_acme", priority: 50, effect: "allow", conditions: [] },
      ];
      const featureRules: Rule[] = [
        { id: "g1", name: "Override Global Rate Limit", priority: 100, effect: "allow", conditions: [] },
      ];

      const composed = await composeRuleSets(globalRules, tenantRules, featureRules, { tenantId: "tenant_acme" });
      expect(composed.length).toBe(2);
      expect(composed[0].id).toBe("g1");
      expect(composed[0].priority).toBe(100);
      expect(composed[1].id).toBe("t1");
    });
  });

  describe("4. Strict Zod Contracts & Error Registry", () => {
    it("validates Rule schema contracts using Zod", () => {
      expect(() => {
        RuleSchema.parse({
          id: "",
          name: "Test",
          conditions: [],
        });
      }).toThrow();

      expect(() => {
        RuleConditionSchema.parse({
          field: "role",
          op: "invalid_op" as any,
        });
      }).toThrow();
    });

    it("retrieves standard error descriptors from Centralized Error Registry", () => {
      const err = errorRegistry.get(RULES_ENGINE_CONSTANTS.ERR_FORBIDDEN);
      expect(err.httpStatus).toBe(403);
      expect(err.category).toBe(RULES_ENGINE_CONSTANTS.CAT_RULE_BREACH);
    });
  });

  describe("5. Structural Immutability", () => {
    it("freezes evaluation outputs and rule composition arrays", async () => {
      const rules: Rule[] = [
        { id: "r1", name: "Freeze Test", priority: 1, effect: "allow", conditions: [] },
      ];
      const res = await evaluateRules(rules, {});
      expect(Object.isFrozen(res)).toBe(true);
      expect(Object.isFrozen(res.allowedRules)).toBe(true);

      const composed = await composeRuleSets(rules, [], [], {});
      expect(Object.isFrozen(composed)).toBe(true);
    });
  });
});
