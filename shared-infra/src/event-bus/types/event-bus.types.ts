/**
 * @file event-bus.types.ts
 * @description Strongly Typed, Pure, and Immutable Types for EventBus Infrastructure.
 */

export interface EventHeaders {
  readonly eventId: string;
  readonly eventName: string;
  readonly timestamp: string;
  readonly source?: string;
  readonly tenantId: string;
  readonly traceparent: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly cascadeDepth: number;
  readonly [key: string]: unknown;
}

export interface EventEnvelope<T = unknown> {
  readonly headers: Readonly<EventHeaders>;
  readonly payload: T;
}

export type EventCallback<T = unknown> = (
  payload: T,
  envelope: Readonly<EventEnvelope<T>>
) => Promise<void> | void;

export interface ListenerOptions {
  readonly id?: string;
  readonly priority?: number;
  readonly once?: boolean;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly filter?: (envelope: Readonly<EventEnvelope>) => boolean;
}

export interface RegisteredListener<T = unknown> {
  readonly id: string;
  readonly eventName: string;
  readonly callback: EventCallback<T>;
  readonly priority: number;
  readonly once: boolean;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly consecutiveFailures: number;
  readonly circuitOpenUntil: number | null;
  readonly filter?: (envelope: Readonly<EventEnvelope>) => boolean;
  readonly filePath?: string;
  readonly functionName?: string;
}

export interface DLQEntry<T = unknown> {
  readonly id: string;
  readonly envelope: Readonly<EventEnvelope<T>>;
  readonly failedListenerId: string;
  readonly error: string;
  readonly stack?: string;
  readonly failedAt: string;
  readonly retryCount: number;
}

export interface EventBusConfig {
  readonly maxListenersPerEvent?: number;
  readonly defaultListenerTimeoutMs?: number;
  readonly maxCascadeDepth?: number;
  readonly historyLimit?: number;
  readonly dlqLimit?: number;
  readonly enableLogging?: boolean;
  readonly enableTracing?: boolean;
}
