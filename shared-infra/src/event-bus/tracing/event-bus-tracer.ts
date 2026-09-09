/**
 * @file event-bus-tracer.ts
 * @description Distributed OpenTelemetry Tracing Instrumentation for EventBus.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Publish Span Instrumentation:
 *    - Initiates PRODUCER span with topic name, event ID, tenant ID, and cascade depth.
 * 2. Listener Span Instrumentation:
 *    - Initiates CONSUMER span linked to the parent event with caller file and function attributes.
 * 3. Status Recording:
 *    - Records execution latency duration and marks span OK or ERROR with exception attributes.
 */

import { SpanKind, SpanStatusCode, type Span } from "@opentelemetry/api";
import { getTracer } from "../../tracing/tracer";
import { EVENT_BUS_CONSTANTS } from "../constants/constants";
import type { EventEnvelope, RegisteredListener } from "../types/event-bus.types";

const tracer = getTracer();

export class EventBusTracer {
  public static startPublishSpan(envelope: Readonly<EventEnvelope>, listenerCount: number): Span {
    return tracer.startSpan(`${EVENT_BUS_CONSTANTS.SPAN_PREFIX_PUBLISH}${envelope.headers.eventName}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        [EVENT_BUS_CONSTANTS.ATTR_EVENT_ID]: envelope.headers.eventId,
        [EVENT_BUS_CONSTANTS.ATTR_EVENT_NAME]: envelope.headers.eventName,
        [EVENT_BUS_CONSTANTS.ATTR_LISTENER_COUNT]: listenerCount,
        [EVENT_BUS_CONSTANTS.ATTR_TENANT_ID]: envelope.headers.tenantId,
        [EVENT_BUS_CONSTANTS.ATTR_CASCADE_DEPTH]: envelope.headers.cascadeDepth,
      },
    });
  }

  public static startListenerSpan(
    envelope: Readonly<EventEnvelope>,
    listener: Readonly<RegisteredListener>
  ): Span {
    return tracer.startSpan(
      `${EVENT_BUS_CONSTANTS.SPAN_PREFIX_HANDLE}${envelope.headers.eventName}${EVENT_BUS_CONSTANTS.SPAN_HANDLE_DELIMITER}${listener.id}`,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          [EVENT_BUS_CONSTANTS.ATTR_EVENT_ID]: envelope.headers.eventId,
          [EVENT_BUS_CONSTANTS.ATTR_EVENT_NAME]: envelope.headers.eventName,
          [EVENT_BUS_CONSTANTS.ATTR_LISTENER_ID]: listener.id,
          [EVENT_BUS_CONSTANTS.ATTR_LISTENER_PRIORITY]: listener.priority,
          [EVENT_BUS_CONSTANTS.ATTR_TENANT_ID]: envelope.headers.tenantId,
          [EVENT_BUS_CONSTANTS.ATTR_CODE_FILEPATH]: listener.filePath || EVENT_BUS_CONSTANTS.VAL_UNKNOWN,
          [EVENT_BUS_CONSTANTS.ATTR_CODE_FUNCTION]: listener.functionName || EVENT_BUS_CONSTANTS.VAL_ANONYMOUS,
        },
      }
    );
  }

  public static recordSuccess(span: Span, durationMs: number): void {
    span.setAttribute(EVENT_BUS_CONSTANTS.ATTR_STATUS, EVENT_BUS_CONSTANTS.STATUS_SUCCESS);
    span.setAttribute(EVENT_BUS_CONSTANTS.ATTR_DURATION_MS, durationMs);
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  public static recordError(span: Span, error: Error | string, durationMs: number): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    span.setAttribute(EVENT_BUS_CONSTANTS.ATTR_STATUS, EVENT_BUS_CONSTANTS.STATUS_FAILURE);
    span.setAttribute(EVENT_BUS_CONSTANTS.ATTR_DURATION_MS, durationMs);
    span.setAttribute(EVENT_BUS_CONSTANTS.ATTR_ERROR_MESSAGE, errorMsg);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: errorMsg,
    });
    if (error instanceof Error) {
      span.recordException(error);
    }
    span.end();
  }
}
