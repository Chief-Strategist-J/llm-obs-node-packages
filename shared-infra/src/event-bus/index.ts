import { EventBusEngine } from "./core/event-bus-engine";

export * from "./constants/constants";
export * from "./types/event-bus.types";
export * from "./tracing/event-bus-tracer";
export * from "./resilience/dead-letter-queue";
export * from "./resilience/pattern-matcher";
export * from "./resilience/loop-detector";
export * from "./core/event-bus-engine";

export const eventBus = new EventBusEngine();
export { EventBusEngine as EventBus };
