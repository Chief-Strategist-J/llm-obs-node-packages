/**
 * @file async-checkers.ts
 * @description Registry for Named Live-Data Dependent Async Rule Checkers with Timeout Protection.
 *
 * ASYNC CHECKER EXECUTION ALGORITHM:
 * 1. Lookup named asynchronous checker from the internal registry Map.
 * 2. Return `false` immediately if no checker is registered under the given name.
 * 3. Race checker execution promise against a timeout timer promise (`Promise.race`).
 * 4. If the checker promise resolves before `timeoutMs`, return its boolean outcome.
 * 5. If timeout expires or an exception is thrown, catch error and safely return `false`.
 */

import type { AsyncCheckFn } from "../types/rule.types";
import { RULES_ENGINE_CONSTANTS } from "../constants/rules.constants";

export class AsyncCheckerRegistry {
  private readonly checkers = new Map<string, AsyncCheckFn>();

  public register(name: string, checkFn: AsyncCheckFn): void {
    this.checkers.set(name, checkFn);
  }

  public get(name: string): AsyncCheckFn | undefined {
    return this.checkers.get(name);
  }

  public has(name: string): boolean {
    return this.checkers.has(name);
  }

  public async execute(
    name: string,
    ctx: Readonly<Record<string, unknown>>,
    timeoutMs: number = RULES_ENGINE_CONSTANTS.DEFAULT_ASYNC_TIMEOUT_MS
  ): Promise<boolean> {
    const checker = this.get(name);
    if (!checker) return false;

    try {
      const timerPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error(RULES_ENGINE_CONSTANTS.MSG_ASYNC_CHECK_FAILED)), timeoutMs);
      });

      return await Promise.race([checker(ctx), timerPromise]);
    } catch {
      return false;
    }
  }

  public clear(): void {
    this.checkers.clear();
  }
}

export const asyncCheckerRegistry = new AsyncCheckerRegistry();
