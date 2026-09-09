/**
 * @file resolve-flag.ts
 * @description Pure Functional Feature Flag Resolution Engine with Rules-Engine Integration & Murmur-Lite Rollouts.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Filter Rules: Purely extracts candidate rules matching flag category or flag ID from `readonly Rule[]`.
 * 2. Evaluate Candidate Rules: Evaluates async rules engine resolution (`resolveRules`).
 * 3. Security Decision:
 *    - If any active rule produces `deny`, flag resolution evaluates to `false` immediately (Deny-Override).
 *    - If an active rule produces `allow`, proceeds to user hash rollout bucket evaluation.
 * 4. Deterministic Hash Rollout: Maps user ID to bucket `[0, 99]` to determine percentage enablement deterministically.
 */

import { resolveRules, type Rule, RULES_ENGINE_CONSTANTS } from '../rules-engine';
import { HTTP_CONSTANTS } from '../http/constants';

export async function resolveFlag(
  flagName: string,
  ctx: Readonly<Record<string, unknown>>,
  flagRules: readonly Rule[],
  rolloutPercentage?: number,
): Promise<boolean> {
  const matchingRules = flagRules.filter((r) => r.category === flagName || r.id === flagName);
  if (matchingRules.length > 0) {
    const activeRules = await resolveRules(matchingRules, ctx);
    const hasDeny = activeRules.some((r) => r.effect === RULES_ENGINE_CONSTANTS.EFFECT_DENY);
    if (hasDeny) return false;

    const hasAllow = activeRules.some((r) => r.effect === RULES_ENGINE_CONSTANTS.EFFECT_ALLOW);
    if (hasAllow) {
      if (rolloutPercentage !== undefined && rolloutPercentage < 100) {
        const userId = (ctx.userId ?? ctx.id ?? HTTP_CONSTANTS.EMPTY_STRING) as string;
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = (hash << 5) - hash + userId.charCodeAt(i);
          hash |= 0;
        }
        const bucket = Math.abs(hash) % 100;
        return bucket < rolloutPercentage;
      }
      return true;
    }
  }

  if (rolloutPercentage !== undefined) {
    const userId = (ctx.userId ?? ctx.id ?? HTTP_CONSTANTS.EMPTY_STRING) as string;
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash |= 0;
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < rolloutPercentage;
  }

  return false;
}
