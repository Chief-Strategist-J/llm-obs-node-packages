import { AsyncLocalStorage } from "async_hooks";
import { z } from "zod";
import { RULES_ENGINE_CONSTANTS, errorRegistry } from "../rules-engine";
import { HTTP_CONSTANTS } from "../http/constants";

export const RequestContextSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  tenantId: z.string().min(1),
  traceparent: z.string().min(1),
  tracestate: z.string().optional(),
  cascadeDepth: z.number().int().optional(),
}).passthrough();

export type RequestContext = z.infer<typeof RequestContextSchema>;

interface StorageAdapter<T> {
  run<R>(store: T, callback: () => R): R;
  getStore(): T | undefined;
}

class InMemoryStorageAdapter<T> implements StorageAdapter<T> {
  private currentStore: T | undefined;

  public run<R>(store: T, callback: () => R): R {
    const prev = this.currentStore;
    this.currentStore = store;
    try {
      return callback();
    } finally {
      this.currentStore = prev;
    }
  }

  public getStore(): T | undefined {
    return this.currentStore;
  }
}

function initAsyncLocalStorage<T>(): StorageAdapter<T> {
  try {
    if (typeof AsyncLocalStorage === HTTP_CONSTANTS.TYPE_FUNCTION) {
      return new AsyncLocalStorage<T>();
    }
  } catch (err: any) {
    const errDesc = errorRegistry.get(RULES_ENGINE_CONSTANTS.ERR_CONTEXT_STORAGE_INIT_FAILED);
    if (typeof console !== HTTP_CONSTANTS.TYPE_UNDEFINED && console.warn) {
      console.warn(`${errDesc.message}: ${err?.message || String(err)}`);
    }
  }
  return new InMemoryStorageAdapter<T>();
}

function getRandomHex(bytes: number): string {
  if (typeof globalThis !== HTTP_CONSTANTS.TYPE_UNDEFINED && globalThis.crypto && typeof globalThis.crypto.getRandomValues === HTTP_CONSTANTS.TYPE_FUNCTION) {
    const arr = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Array.from({ length: bytes * 2 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export class RequestContextHolder {
  private static storage: StorageAdapter<RequestContext> = initAsyncLocalStorage<RequestContext>();

  public static generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${getRandomHex(4)}`;
  }

  public static generateW3CTraceparent(): string {
    const traceId = getRandomHex(16);
    const spanId = getRandomHex(8);
    return `00-${traceId}-${spanId}-01`;
  }

  public static create(incoming?: Partial<RequestContext>): RequestContext {
    const requestId = incoming?.requestId || this.generateId(HTTP_CONSTANTS.PREFIX_REQ);
    const correlationId = incoming?.correlationId || this.generateId(HTTP_CONSTANTS.PREFIX_CORR);
    const idempotencyKey = incoming?.idempotencyKey || incoming?.requestId || this.generateId(HTTP_CONSTANTS.PREFIX_IDEM);
    const traceparent = incoming?.traceparent || this.generateW3CTraceparent();

    const rawContext = {
      ...incoming,
      requestId,
      correlationId,
      idempotencyKey,
      tenantId: incoming?.tenantId || HTTP_CONSTANTS.DEFAULT_TENANT_ID,
      traceparent,
      tracestate: incoming?.tracestate || HTTP_CONSTANTS.DEFAULT_TRACESTATE,
    };

    return RequestContextSchema.parse(rawContext);
  }

  public static run<T>(context: Partial<RequestContext>, callback: () => T): T {
    const fullContext = this.create(context);
    return this.storage.run(fullContext, callback);
  }

  public static get(): RequestContext {
    try {
      const store = this.storage.getStore();
      if (!store) {
        return this.createDefault();
      }
      const merged = {
        ...store,
        requestId: store.requestId || this.generateId(HTTP_CONSTANTS.PREFIX_REQ),
        correlationId: store.correlationId || this.generateId(HTTP_CONSTANTS.PREFIX_CORR),
        idempotencyKey: store.idempotencyKey || store.requestId || this.generateId(HTTP_CONSTANTS.PREFIX_IDEM),
        tenantId: store.tenantId || HTTP_CONSTANTS.DEFAULT_TENANT_ID,
        traceparent: store.traceparent || this.generateW3CTraceparent(),
        tracestate: store.tracestate || HTTP_CONSTANTS.DEFAULT_TRACESTATE,
      };
      return RequestContextSchema.parse(merged);
    } catch (err: any) {
      const errDesc = errorRegistry.get(RULES_ENGINE_CONSTANTS.ERR_UNKNOWN);
      if (typeof console !== HTTP_CONSTANTS.TYPE_UNDEFINED && console.error) {
        console.error(`${errDesc.message}: ${err?.message || String(err)}`);
      }
      return this.createDefault();
    }
  }


  private static createDefault(): RequestContext {
    const rawContext = {
      requestId: this.generateId(HTTP_CONSTANTS.PREFIX_REQ),
      correlationId: this.generateId(HTTP_CONSTANTS.PREFIX_CORR),
      idempotencyKey: this.generateId(HTTP_CONSTANTS.PREFIX_IDEM),
      tenantId: HTTP_CONSTANTS.DEFAULT_TENANT_ID,
      traceparent: this.generateW3CTraceparent(),
      tracestate: HTTP_CONSTANTS.DEFAULT_TRACESTATE,
    };
    return RequestContextSchema.parse(rawContext);
  }
}

