/**
 * @file constants.ts
 * @description Centralized Constants, OpenTelemetry Attributes, and Identifiers for EventBus.
 */

export const EVENT_BUS_CONSTANTS = {
  DEFAULT_MAX_LISTENERS: 50 as number,
  DEFAULT_LISTENER_TIMEOUT_MS: 5000 as number,
  DEFAULT_MAX_CASCADE_DEPTH: 10 as number,
  DEFAULT_MAX_RETRIES: 3 as number,
  DEFAULT_RETRY_DELAY_MS: 100 as number,
  DEFAULT_HISTORY_LIMIT: 100 as number,
  DEFAULT_DLQ_LIMIT: 500 as number,
  DEFAULT_CIRCUIT_FAILURE_THRESHOLD: 5 as number,
  DEFAULT_CIRCUIT_COOLDOWN_MS: 30000 as number,

  TRACER_NAME: "event-bus-tracer",
  
  // OpenTelemetry Attribute Keys
  ATTR_EVENT_ID: "event_bus.event_id",
  ATTR_EVENT_NAME: "event_bus.event_name",
  ATTR_LISTENER_ID: "event_bus.listener_id",
  ATTR_LISTENER_COUNT: "event_bus.listener_count",
  ATTR_LISTENER_PRIORITY: "event_bus.listener_priority",
  ATTR_DURATION_MS: "event_bus.duration_ms",
  ATTR_RETRY_COUNT: "event_bus.retry_count",
  ATTR_STATUS: "event_bus.status",
  ATTR_ERROR_MESSAGE: "event_bus.error_message",
  ATTR_CASCADE_DEPTH: "event_bus.cascade_depth",
  ATTR_TENANT_ID: "tenant.id",

  STATUS_SUCCESS: "success",
  STATUS_FAILURE: "failure",
  STATUS_TIMEOUT: "timeout",
  STATUS_DLQ: "dlq",
  STATUS_CIRCUIT_OPEN: "circuit_open",

  ERR_LISTENER_TIMEOUT: "ERR_EVENT_BUS_LISTENER_TIMEOUT",
  ERR_CASCADE_LOOP_DETECTED: "ERR_CASCADE_LOOP",
  ERR_MAX_LISTENERS_EXCEEDED: "ERR_EVENT_BUS_MAX_LISTENERS",
  ERR_VALIDATION_FAILED: "ERR_EVENT_BUS_VALIDATION_FAILED",

  ATTR_CODE_FILEPATH: "code.filepath",
  ATTR_CODE_FUNCTION: "code.function",
  VAL_UNKNOWN: "unknown",
  VAL_ANONYMOUS: "anonymous",
  VAL_UNKNOWN_ERROR: "Unknown Error",
  SPAN_PREFIX_PUBLISH: "EventBus PUBLISH ",
  SPAN_PREFIX_HANDLE: "EventBus HANDLE ",
  SPAN_HANDLE_DELIMITER: " -> ",
  CHAR_HASH: "#",
  CHAR_ASTERISK: "*",
  DEFAULT_SOURCE: "event-bus",
  PREFIX_EVENT_ID: "evt",
  PREFIX_LISTENER_ID: "lst",
  PREFIX_DLQ_ID: "dlq",
  PROMISE_STATUS_REJECTED: "rejected",
  ERR_MSG_CASCADE_DEPTH: "Maximum cascade depth",
  ERR_MSG_INFINITE_LOOP: "Infinite event loop detected",
  ID_CASCADE_DETECTOR: "cascade-loop-detector",
} as const;
