/**
 * @file event-bus-engine.ts
 * @description Enterprise-Grade, Pure, Resilient, and Immutable In-Memory EventBus Engine.
 *
 * EVENTBUS ENGINE ALGORITHM:
 * 1. Subscription Management (`on`/`off`):
 *    a. Enforce immutable listener arrays per event topic (`Object.freeze`).
 *    b. Protect against memory leaks by warning if `maxListenersPerEvent` threshold is exceeded.
 *    c. Return pure un-subscription lambda.
 * 2. Event Publishing & Cascade Loop Detection (`publish`):
 *    a. Extract execution context and increment cascade depth.
 *    b. Check infinite cascade loops using `CascadeLoopDetector`. If depth exceeded, route to DLQ immediately and reject.
 *    c. Construct immutable `EventEnvelope` containing W3C traceparent, tenant ID, and idempotency key.
 *    d. Record event envelope in a pure, non-mutating ring buffer (`eventHistory`).
 *    e. Query matching listeners by topic equality or wildcard pattern matching (`*`, `#`).
 *    f. Sort matching listeners by priority descending without in-place mutation of stored lists.
 * 3. Resilient Listener Execution (`executeListenerWithResilience`):
 *    a. Short-circuit execution if circuit breaker state is OPEN for target listener.
 *    b. Evaluate conditional filter predicates prior to invoking listener callback.
 *    c. Unsubscribe one-time (`once`) listeners before invocation.
 *    d. Wrap callback in timeout protection promise (`executeWithTimeout`).
 *    e. On non-cascade failure, evaluate retry policy and apply exponential backoff.
 *    f. Route persistent failures or timeouts to the immutable `DeadLetterQueue` (DLQ).
 */

import { RequestContextHolder } from "../../tracing/request-context";
import { getCallerInfo } from "../../tracing/caller-info";
import { StandardCircuitBreaker } from "../../http/resilience/standard-circuit-breaker";
import { retryPolicyRegistry } from "../../http/resilience/retry-policy";
import { HTTP_CONSTANTS } from "../../http/constants";
import { EVENT_BUS_CONSTANTS } from "../constants/constants";
import { DeadLetterQueue } from "../resilience/dead-letter-queue";
import { CascadeLoopDetector } from "../resilience/loop-detector";
import { patternMatcher } from "../resilience/pattern-matcher";
import { EventBusTracer } from "../tracing/event-bus-tracer";
import type {
  EventBusConfig,
  EventCallback,
  EventEnvelope,
  EventHeaders,
  ListenerOptions,
  RegisteredListener,
} from "../types/event-bus.types";

export class EventBusEngine {
  private readonly listenersMap = new Map<string, readonly RegisteredListener[]>();
  private readonly dlq: DeadLetterQueue;
  private readonly loopDetector: CascadeLoopDetector;
  private readonly circuitBreaker: StandardCircuitBreaker;
  private eventHistory: readonly EventEnvelope[] = Object.freeze([]);
  private readonly inFlightPromises = new Set<Promise<unknown>>();

  private readonly maxListeners: number;
  private readonly defaultTimeoutMs: number;
  private readonly historyLimit: number;
  private readonly enableLogging: boolean;
  private readonly enableTracing: boolean;

  constructor(config: EventBusConfig = {}) {
    this.maxListeners = config.maxListenersPerEvent || EVENT_BUS_CONSTANTS.DEFAULT_MAX_LISTENERS;
    this.defaultTimeoutMs = config.defaultListenerTimeoutMs || EVENT_BUS_CONSTANTS.DEFAULT_LISTENER_TIMEOUT_MS;
    this.historyLimit = config.historyLimit || EVENT_BUS_CONSTANTS.DEFAULT_HISTORY_LIMIT;
    this.enableLogging = config.enableLogging !== false;
    this.enableTracing = config.enableTracing !== false;

    this.dlq = new DeadLetterQueue(config.dlqLimit || EVENT_BUS_CONSTANTS.DEFAULT_DLQ_LIMIT);
    this.loopDetector = new CascadeLoopDetector(config.maxCascadeDepth || EVENT_BUS_CONSTANTS.DEFAULT_MAX_CASCADE_DEPTH);
    this.circuitBreaker = new StandardCircuitBreaker(
      EVENT_BUS_CONSTANTS.DEFAULT_CIRCUIT_FAILURE_THRESHOLD,
      EVENT_BUS_CONSTANTS.DEFAULT_CIRCUIT_COOLDOWN_MS,
      1000
    );
  }

  public getDLQ(): DeadLetterQueue {
    return this.dlq;
  }

  public getHistory(): readonly EventEnvelope[] {
    return this.eventHistory;
  }

  public getListenersCount(eventName?: string): number {
    if (eventName) {
      return this.listenersMap.get(eventName)?.length || 0;
    }
    let total = 0;
    for (const list of this.listenersMap.values()) {
      total += list.length;
    }
    return total;
  }

  public on<T = unknown>(
    eventName: string,
    callback: EventCallback<T>,
    options: ListenerOptions = {}
  ): () => void {
    const currentList = this.listenersMap.get(eventName) || Object.freeze([]);
    if (currentList.length >= this.maxListeners) {
      console.warn(
        `[EventBus:Warning] Max listeners (${this.maxListeners}) exceeded for event '${eventName}'. Possible memory leak!`
      );
    }

    const caller = getCallerInfo(3);
    const listenerId = options.id || `${EVENT_BUS_CONSTANTS.PREFIX_LISTENER_ID}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const registered: RegisteredListener<T> = Object.freeze({
      id: listenerId,
      eventName,
      callback,
      priority: options.priority ?? 0,
      once: options.once ?? false,
      timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
      maxRetries: options.maxRetries ?? EVENT_BUS_CONSTANTS.DEFAULT_MAX_RETRIES,
      retryDelayMs: options.retryDelayMs ?? EVENT_BUS_CONSTANTS.DEFAULT_RETRY_DELAY_MS,
      consecutiveFailures: 0,
      circuitOpenUntil: null,
      filter: options.filter,
      filePath: caller.filePath,
      functionName: caller.functionName,
    });

    this.listenersMap.set(eventName, Object.freeze([...currentList, registered as RegisteredListener<unknown>]));

    if (this.enableLogging) {
      console.log(`[EventBus:Subscribe] Subscribed -> Event: '${eventName}' | ListenerId: ${listenerId}`);
    }

    return () => {
      this.off(eventName, listenerId);
    };
  }

  public once<T = unknown>(
    eventName: string,
    callback: EventCallback<T>,
    options: Omit<ListenerOptions, "once"> = {}
  ): () => void {
    return this.on<T>(eventName, callback, { ...options, once: true });
  }

  public off(eventName: string, listenerIdOrCallback: string | EventCallback): void {
    const list = this.listenersMap.get(eventName);
    if (!list) return;

    const initialLength = list.length;
    const filtered = list.filter((l) => {
      if (typeof listenerIdOrCallback === "string") {
        return l.id !== listenerIdOrCallback;
      }
      return l.callback !== listenerIdOrCallback;
    });

    if (filtered.length === 0) {
      this.listenersMap.delete(eventName);
    } else {
      this.listenersMap.set(eventName, Object.freeze(filtered));
    }

    if (this.enableLogging && filtered.length < initialLength) {
      console.log(`[EventBus:Unsubscribe] Unsubscribed -> Event: '${eventName}' | Target: ${String(listenerIdOrCallback)}`);
    }
  }

  public emit<T = unknown>(eventName: string, payload: T, headers?: Partial<EventHeaders>): void {
    void this.publish<T>(eventName, payload, headers);
  }

  public async publish<T = unknown>(
    eventName: string,
    payload: T,
    customHeaders?: Partial<EventHeaders>
  ): Promise<Readonly<EventEnvelope<T>>> {
    const currentContext = RequestContextHolder.get();
    const currentDepth = (customHeaders?.cascadeDepth ?? (currentContext as any)?.cascadeDepth ?? 0) + 1;

    const headers: EventHeaders = Object.freeze({
      eventId: customHeaders?.eventId || RequestContextHolder.generateId(EVENT_BUS_CONSTANTS.PREFIX_EVENT_ID),
      eventName,
      timestamp: new Date().toISOString(),
      source: customHeaders?.source || EVENT_BUS_CONSTANTS.DEFAULT_SOURCE,
      tenantId: customHeaders?.tenantId || currentContext.tenantId || HTTP_CONSTANTS.DEFAULT_TENANT_ID,
      traceparent: customHeaders?.traceparent || currentContext.traceparent || RequestContextHolder.generateW3CTraceparent(),
      tracestate: customHeaders?.tracestate || currentContext.tracestate,
      correlationId: customHeaders?.correlationId || currentContext.correlationId,
      idempotencyKey: customHeaders?.idempotencyKey || customHeaders?.eventId || currentContext.idempotencyKey || RequestContextHolder.generateId(HTTP_CONSTANTS.PREFIX_IDEM),
      cascadeDepth: currentDepth,
      ...customHeaders,
    });

    const envelope: EventEnvelope<T> = Object.freeze({ headers, payload });

    try {
      this.loopDetector.checkCascadeDepth(currentDepth, eventName);
    } catch (err: any) {
      this.dlq.push(envelope as EventEnvelope<unknown>, EVENT_BUS_CONSTANTS.ID_CASCADE_DETECTOR, err, 0);
      return Promise.reject(err);
    }

    // Pure non-mutating history buffer update
    const nextHistory = [...this.eventHistory, envelope as EventEnvelope<unknown>];
    this.eventHistory = Object.freeze(
      nextHistory.length > this.historyLimit ? nextHistory.slice(-this.historyLimit) : nextHistory
    );

    const matchingListeners = this.findMatchingListeners(eventName);

    if (this.enableLogging) {
      console.log(
        `[EventBus:Publish] Published -> Event: '${eventName}' | Listeners: ${matchingListeners.length} | ID: ${headers.eventId} | Depth: ${currentDepth}`
      );
    }

    let otelSpan: any = null;
    if (this.enableTracing) {
      otelSpan = EventBusTracer.startPublishSpan(envelope, matchingListeners.length);
    }

    const publishStartTime = Date.now();
    const dispatchPromises: Promise<void>[] = [];

    // Snapshot of listeners
    const targetListeners = [...matchingListeners];

    for (const listener of targetListeners) {
      if (!this.circuitBreaker.canExecute(listener.id)) {
        if (this.enableLogging) {
          console.warn(`[EventBus:CircuitOpen] Skipping listener '${listener.id}' on event '${eventName}' due to active StandardCircuitBreaker.`);
        }
        continue;
      }

      if (listener.filter && !listener.filter(envelope)) {
        continue;
      }

      if (listener.once) {
        this.off(listener.eventName, listener.id);
      }

      const p = this.executeListenerWithResilience(listener, envelope);
      this.inFlightPromises.add(p);
      p.finally(() => this.inFlightPromises.delete(p));
      dispatchPromises.push(p);
    }

    await Promise.all(dispatchPromises);

    if (otelSpan) {
      EventBusTracer.recordSuccess(otelSpan, Date.now() - publishStartTime);
    }

    return envelope;
  }

  private findMatchingListeners(eventName: string): readonly RegisteredListener[] {
    const result: RegisteredListener[] = [];
    for (const [key, list] of this.listenersMap.entries()) {
      if (key === eventName || patternMatcher.match(key, eventName)) {
        result.push(...list);
      }
    }
    // Clone prior to sorting to guarantee stored list immutability
    return Object.freeze([...result].sort((a, b) => b.priority - a.priority));
  }

  private async executeListenerWithResilience(
    listener: Readonly<RegisteredListener>,
    envelope: Readonly<EventEnvelope>
  ): Promise<void> {
    const startTime = Date.now();
    let listenerSpan: any = null;
    if (this.enableTracing) {
      listenerSpan = EventBusTracer.startListenerSpan(envelope, listener);
    }

    let attempt = 0;
    let lastError: Error | string = EVENT_BUS_CONSTANTS.VAL_UNKNOWN_ERROR;

    while (attempt <= listener.maxRetries) {
      try {
        await this.executeWithTimeout(listener, envelope);

        this.circuitBreaker.onSuccess(listener.id);

        const durationMs = Date.now() - startTime;
        if (this.enableLogging) {
          console.log(`[EventBus:Success] Listener '${listener.id}' executed event '${envelope.headers.eventName}' in ${durationMs}ms`);
        }
        if (listenerSpan) {
          EventBusTracer.recordSuccess(listenerSpan, durationMs);
        }
        return;
      } catch (err: any) {
        attempt++;
        lastError = err;

        const isCascadeError =
          err?.code === EVENT_BUS_CONSTANTS.ERR_CASCADE_LOOP_DETECTED ||
          String(err?.message || err).includes(EVENT_BUS_CONSTANTS.ERR_MSG_CASCADE_DEPTH) ||
          String(err?.message || err).includes(EVENT_BUS_CONSTANTS.ERR_MSG_INFINITE_LOOP);
        const isRetryable = !isCascadeError && retryPolicyRegistry.isRetryable(err);

        if (this.enableLogging) {
          console.warn(
            `[EventBus:Retry] Listener '${listener.id}' attempt ${attempt}/${listener.maxRetries + 1} failed for '${envelope.headers.eventName}' (retryable=${isRetryable}): ${err?.message || String(err)}`
          );
        }

        if (attempt <= listener.maxRetries && isRetryable) {
          await new Promise((res) => setTimeout(res, listener.retryDelayMs * attempt));
        } else {
          break;
        }
      }
    }

    this.circuitBreaker.onFailure(listener.id);

    const durationMs = Date.now() - startTime;
    if (listenerSpan) {
      EventBusTracer.recordError(listenerSpan, lastError, durationMs);
    }

    this.dlq.push(envelope, listener.id, lastError, attempt - 1);
  }

  private async executeWithTimeout(
    listener: Readonly<RegisteredListener>,
    envelope: Readonly<EventEnvelope>
  ): Promise<void> {
    let timer: any = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (listener.timeoutMs > 0) {
          timer = setTimeout(() => {
            reject(new Error(`[EventBus:Timeout] Listener '${listener.id}' timed out after ${listener.timeoutMs}ms`));
          }, listener.timeoutMs);
        }
      });

      const execPromise = (async () => {
        const res = RequestContextHolder.run(envelope.headers as any, () =>
          listener.callback(envelope.payload, envelope)
        );
        if (res && typeof (res as any).then === "function") {
          (res as Promise<void>).catch(() => {});
          await res;
        }
      })();

      await Promise.race([execPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  public async drain(): Promise<void> {
    if (this.enableLogging) {
      console.log(`[EventBus:Drain] Draining ${this.inFlightPromises.size} in-flight listener promises...`);
    }
    await Promise.allSettled(Array.from(this.inFlightPromises));
  }

  public clear(): void {
    this.listenersMap.clear();
    this.eventHistory = Object.freeze([]);
    this.dlq.clear();
  }
}
