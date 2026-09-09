/**
 * @file cqrs.types.ts
 * @description Strongly Typed, Immutable Command, Event, and Projection Contracts for CQRS Architecture.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Command Definition: Encapsulates immutable intent to mutate domain state.
 * 2. Domain Event Definition: Immutable record of past domain state occurrences.
 * 3. Materialized Projection: State store snapshot updated asynchronously in response to domain events.
 */

export interface Command<TPayload = unknown> {
  readonly commandId: string;
  readonly commandName: string;
  readonly timestamp: string;
  readonly tenantId: string;
  readonly payload: TPayload;
}

export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventName: string;
  readonly timestamp: string;
  readonly tenantId: string;
  readonly version: number;
  readonly payload: TPayload;
}

export interface MaterializedProjection<TState = unknown> {
  readonly projectionName: string;
  readonly lastHandledEventId: string | null;
  readonly state: TState;
  readonly updatedAt: string;
}

export interface ProjectionStore<TState = unknown> {
  get(id: string): Promise<Readonly<MaterializedProjection<TState>> | null>;
  save(id: string, projection: Readonly<MaterializedProjection<TState>>): Promise<void>;
}

export interface QuerySelector<TQuery = unknown, TResult = unknown> {
  readonly queryName: string;
  execute(query: TQuery): Promise<TResult>;
}
