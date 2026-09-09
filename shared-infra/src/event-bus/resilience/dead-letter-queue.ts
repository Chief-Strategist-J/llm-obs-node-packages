/**
 * @file dead-letter-queue.ts
 * @description Pure, Non-Mutating Dead Letter Queue with Ring Buffer Eviction for EventBus.
 *
 * DLQ ALGORITHM:
 * 1. Generate an immutable DLQ entry with timestamp, stack trace, and error details.
 * 2. Prepend/append entry to the immutable entries array without in-place mutation.
 * 3. Enforce maximum DLQ limit by slicing oldest records if threshold is exceeded.
 * 4. Return deeply frozen entry and entry arrays.
 */

import { EVENT_BUS_CONSTANTS } from "../constants/constants";
import type { DLQEntry, EventEnvelope } from "../types/event-bus.types";

export class DeadLetterQueue {
  private entries: readonly DLQEntry[] = Object.freeze([]);
  private readonly maxLimit: number;

  constructor(maxLimit = EVENT_BUS_CONSTANTS.DEFAULT_DLQ_LIMIT) {
    this.maxLimit = maxLimit;
  }

  public push<T = unknown>(
    envelope: Readonly<EventEnvelope<T>>,
    failedListenerId: string,
    error: Error | string,
    retryCount = 0
  ): Readonly<DLQEntry<T>> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const entry: DLQEntry<T> = Object.freeze({
      id: `${EVENT_BUS_CONSTANTS.PREFIX_DLQ_ID}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      envelope,
      failedListenerId,
      error: errorMsg,
      stack,
      failedAt: new Date().toISOString(),
      retryCount,
    });

    // Pure non-mutating list update
    const nextEntries = [...this.entries, entry as DLQEntry<unknown>];
    this.entries = Object.freeze(
      nextEntries.length > this.maxLimit ? nextEntries.slice(-this.maxLimit) : nextEntries
    );

    console.error(
      `[EventBus:DLQ] Routed to DLQ -> Event: ${envelope.headers.eventName} | Listener: ${failedListenerId} | Error: ${errorMsg}`
    );

    return entry;
  }

  public getEntries(): readonly DLQEntry[] {
    return this.entries;
  }

  public getEntriesByEventName(eventName: string): readonly DLQEntry[] {
    return Object.freeze(this.entries.filter((e) => e.envelope.headers.eventName === eventName));
  }

  public clear(): void {
    this.entries = Object.freeze([]);
  }

  public remove(id: string): boolean {
    const initialLength = this.entries.length;
    this.entries = Object.freeze(this.entries.filter((e) => e.id !== id));
    return this.entries.length < initialLength;
  }
}
