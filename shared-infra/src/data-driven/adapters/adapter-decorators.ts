import { trace } from '@opentelemetry/api';
import type { CrudPort } from './create-entity-adapter';

const tracer = trace.getTracer('shared-infra-adapters');

export function withRetry<T>(
  adapter: CrudPort<T>,
  options: number | { readonly retries?: number; readonly maxRetries?: number; readonly backoffMs?: number }
): CrudPort<T> {
  const maxRetries = typeof options === 'number' ? options : (options.retries ?? options.maxRetries ?? 3);
  const retryCall = async <R>(fn: () => Promise<R>): Promise<R> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  };

  return Object.freeze({
    list: () => retryCall(adapter.list),
    get: (id: string) => retryCall(() => adapter.get(id)),
    create: (payload: Partial<T>) => retryCall(() => adapter.create(payload)),
    update: (id: string, payload: Partial<T>) => retryCall(() => adapter.update(id, payload)),
    remove: (id: string) => retryCall(() => adapter.remove(id)),
  });
}

export function withCache<T>(
  adapter: CrudPort<T>,
  options: number | { readonly ttlMs?: number }
): CrudPort<T> {
  const ttlMs = typeof options === 'number' ? options : (options.ttlMs ?? 5000);
  const cache = new Map<string, { value: unknown; expiry: number }>();

  return Object.freeze({
    ...adapter,
    get: async (id: string): Promise<T> => {
      const now = Date.now();
      const cached = cache.get(id);
      if (cached && cached.expiry > now) {
        return cached.value as T;
      }
      const fresh = await adapter.get(id);
      cache.set(id, { value: fresh, expiry: now + ttlMs });
      return fresh;
    },
  });
}

export function withCircuitBreaker<T>(
  adapter: CrudPort<T>,
  options: number | { readonly threshold?: number; readonly failureThreshold?: number; readonly resetTimeoutMs?: number }
): CrudPort<T> {
  const threshold = typeof options === 'number' ? options : (options.failureThreshold ?? options.threshold ?? 5);
  let failures = 0;
  let state: 'CLOSED' | 'OPEN' = 'CLOSED';

  const check = () => {
    if (state === 'OPEN') throw new Error('Circuit breaker OPEN');
  };

  const onSuccess = () => {
    failures = 0;
  };

  const onFailure = () => {
    failures++;
    if (failures >= threshold) state = 'OPEN';
  };

  const wrap = async <R>(fn: () => Promise<R>): Promise<R> => {
    check();
    try {
      const res = await fn();
      onSuccess();
      return res;
    } catch (err) {
      onFailure();
      throw err;
    }
  };

  return Object.freeze({
    list: () => wrap(adapter.list),
    get: (id: string) => wrap(() => adapter.get(id)),
    create: (payload: Partial<T>) => wrap(() => adapter.create(payload)),
    update: (id: string, payload: Partial<T>) => wrap(() => adapter.update(id, payload)),
    remove: (id: string) => wrap(() => adapter.remove(id)),
  });
}

export function withTracing<T>(adapter: CrudPort<T>, entityName: string): CrudPort<T> {
  const wrap = async <R>(opName: string, fn: () => Promise<R>): Promise<R> => {
    return tracer.startActiveSpan(`${entityName}.${opName}`, async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1 });
        return result;
      } catch (err) {
        span.setStatus({ code: 2, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  };

  return Object.freeze({
    list: () => wrap('list', adapter.list),
    get: (id: string) => wrap('get', () => adapter.get(id)),
    create: (payload: Partial<T>) => wrap('create', () => adapter.create(payload)),
    update: (id: string, payload: Partial<T>) => wrap('update', () => adapter.update(id, payload)),
    remove: (id: string) => wrap('remove', () => adapter.remove(id)),
  });
}
