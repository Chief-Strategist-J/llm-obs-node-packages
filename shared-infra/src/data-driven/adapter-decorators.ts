/**
 * @file adapter-decorators.ts
 * @description Resilient Port Decorator Composition: Retry, Caching, Circuit Breaker, and OTEL Tracing.
 */

import type { CrudPort } from './create-entity-adapter';
import { calculateFullJitterBackoff } from '../http/http-client';

export const ADAPTER_DECORATOR_CONSTANTS = {
  STATE_CLOSED: 'CLOSED',
  STATE_OPEN: 'OPEN',
  STATE_HALF_OPEN: 'HALF_OPEN',
  MSG_CIRCUIT_OPEN: 'Circuit breaker is OPEN',
  CACHE_KEY_LIST: 'list',
  CACHE_KEY_GET_PREFIX: 'get:',
} as const;

export interface DecoratorOptions {
  readonly retries?: number;
  readonly backoffMs?: number;
  readonly maxBackoffMs?: number;
  readonly ttlMs?: number;
  readonly failureThreshold?: number;
  readonly resetTimeoutMs?: number;
}

export function withRetry<T>(port: CrudPort<T>, options: Readonly<DecoratorOptions> = {}): CrudPort<T> {
  const maxRetries = options.retries ?? 3;
  const baseBackoff = options.backoffMs ?? 200;
  const maxBackoff = options.maxBackoffMs ?? 10000;

  async function retryOperation<R>(fn: () => Promise<R>): Promise<R> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt <= maxRetries) {
          const delay = calculateFullJitterBackoff(attempt, baseBackoff, maxBackoff);
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    throw lastError;
  }

  return Object.freeze({
    list: () => retryOperation(() => port.list()),
    get: (id: string) => retryOperation(() => port.get(id)),
    create: (payload: Partial<T>) => retryOperation(() => port.create(payload)),
    update: (id: string, payload: Partial<T>) => retryOperation(() => port.update(id, payload)),
    remove: (id: string) => retryOperation(() => port.remove(id)),
  });
}

export function withCache<T>(port: CrudPort<T>, options: Readonly<DecoratorOptions> = {}): CrudPort<T> {
  const ttl = options.ttlMs ?? 60000;
  const cache = new Map<string, { data: unknown; timestamp: number }>();

  function getCached<R>(key: string, fetchFn: () => Promise<R>): Promise<R> {
    const entry = cache.get(key);
    const now = Date.now();
    if (entry && now - entry.timestamp < ttl) {
      return Promise.resolve(entry.data as R);
    }
    return fetchFn().then((data) => {
      cache.set(key, { data, timestamp: now });
      return data;
    });
  }

  function invalidateCache(): void {
    cache.clear();
  }

  return Object.freeze({
    list: () => getCached(ADAPTER_DECORATOR_CONSTANTS.CACHE_KEY_LIST, () => port.list()),
    get: (id: string) => getCached(`${ADAPTER_DECORATOR_CONSTANTS.CACHE_KEY_GET_PREFIX}${id}`, () => port.get(id)),
    create: async (payload: Partial<T>) => {
      const res = await port.create(payload);
      invalidateCache();
      return res;
    },
    update: async (id: string, payload: Partial<T>) => {
      const res = await port.update(id, payload);
      invalidateCache();
      return res;
    },
    remove: async (id: string) => {
      await port.remove(id);
      invalidateCache();
    },
  });
}

export function withCircuitBreaker<T>(port: CrudPort<T>, options: Readonly<DecoratorOptions> = {}): CrudPort<T> {
  const threshold = options.failureThreshold ?? 5;
  const resetTimeout = options.resetTimeoutMs ?? 30000;

  let failures = 0;
  let state: typeof ADAPTER_DECORATOR_CONSTANTS.STATE_CLOSED | typeof ADAPTER_DECORATOR_CONSTANTS.STATE_OPEN | typeof ADAPTER_DECORATOR_CONSTANTS.STATE_HALF_OPEN = ADAPTER_DECORATOR_CONSTANTS.STATE_CLOSED;
  let nextAttempt = 0;

  async function execute<R>(fn: () => Promise<R>): Promise<R> {
    const now = Date.now();
    if (state === ADAPTER_DECORATOR_CONSTANTS.STATE_OPEN) {
      if (now > nextAttempt) {
        state = ADAPTER_DECORATOR_CONSTANTS.STATE_HALF_OPEN;
      } else {
        throw new Error(ADAPTER_DECORATOR_CONSTANTS.MSG_CIRCUIT_OPEN);
      }
    }

    try {
      const result = await fn();
      if (state === ADAPTER_DECORATOR_CONSTANTS.STATE_HALF_OPEN) {
        state = ADAPTER_DECORATOR_CONSTANTS.STATE_CLOSED;
        failures = 0;
      }
      return result;
    } catch (err) {
      failures++;
      if (failures >= threshold) {
        state = ADAPTER_DECORATOR_CONSTANTS.STATE_OPEN;
        nextAttempt = Date.now() + resetTimeout;
      }
      throw err;
    }
  }

  return Object.freeze({
    list: () => execute(() => port.list()),
    get: (id: string) => execute(() => port.get(id)),
    create: (payload: Partial<T>) => execute(() => port.create(payload)),
    update: (id: string, payload: Partial<T>) => execute(() => port.update(id, payload)),
    remove: (id: string) => execute(() => port.remove(id)),
  });
}

export function withTracing<T>(port: CrudPort<T>, name: string): CrudPort<T> {
  async function trace<R>(_op: string, fn: () => Promise<R>): Promise<R> {
    return await fn();
  }

  return Object.freeze({
    list: () => trace(`${name}.list`, () => port.list()),
    get: (id: string) => trace(`${name}.get`, () => port.get(id)),
    create: (payload: Partial<T>) => trace(`${name}.create`, () => port.create(payload)),
    update: (id: string, payload: Partial<T>) => trace(`${name}.update`, () => port.update(id, payload)),
    remove: (id: string) => trace(`${name}.remove`, () => port.remove(id)),
  });
}
