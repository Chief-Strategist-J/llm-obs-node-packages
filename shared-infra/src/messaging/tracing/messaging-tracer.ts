/**
 * @file messaging-tracer.ts
 * @description W3C Traceparent Context Propagation & OpenTelemetry Messaging Spans.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Trace ID & Span ID Generation:
 *    - Generates 128-bit hex trace IDs and 64-bit hex span IDs for distributed context propagation.
 * 2. W3C Traceparent Header Encoding/Decoding:
 *    - Parses `00-{traceId}-{parentSpanId}-01` and generates fresh child span traceparents.
 * 3. OpenTelemetry Messaging Semantics:
 *    - Spans are initiated with PRODUCER / CONSUMER kinds and decorated with destination and correlation IDs.
 */

import { SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import { getTracer } from '../../tracing/tracer';
import type { KafkaHeaders, KafkaEvent } from '../client/client-factory';
import { MESSAGING_CONSTANTS } from '../constants/constants';

export interface MessagingTraceSpan {
  readonly otelSpan: Span;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly operation: 'publish' | 'process';
  readonly topic: string;
  readonly eventName: string;
  readonly startTime: number;
}

export class MessagingTracer {
  public static generateTraceId(): string {
    const hexChars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += hexChars[Math.floor(Math.random() * 16)];
    }
    return result;
  }

  public static generateSpanId(): string {
    const hexChars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += hexChars[Math.floor(Math.random() * 16)];
    }
    return result;
  }

  public static parseTraceparent(traceparent?: string): { traceId: string; parentSpanId?: string } {
    if (!traceparent) {
      return { traceId: this.generateTraceId() };
    }
    const parts = traceparent.split('-');
    if (parts.length >= 3 && parts[1] && parts[2]) {
      return { traceId: parts[1], parentSpanId: parts[2] };
    }
    return { traceId: this.generateTraceId() };
  }

  public static formatTraceparent(traceId: string, spanId: string): string {
    return `00-${traceId}-${spanId}-01`;
  }

  public static createProducerSpan(
    topic: string,
    eventName: string,
    existingHeaders?: KafkaHeaders,
    serviceName: string = MESSAGING_CONSTANTS.DEFAULT_SERVICE_NAME,
  ): { span: MessagingTraceSpan; headers: KafkaHeaders } {
    const tracer = getTracer(serviceName);
    const parsed = this.parseTraceparent(existingHeaders?.traceparent);

    const otelSpan = tracer.startSpan(`Kafka PRODUCE ${eventName}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'kafka',
        'messaging.destination': topic,
        'messaging.kafka.event_name': eventName,
        'messaging.operation': 'publish',
        'messaging.correlation_id': existingHeaders?.correlationId || '',
        'messaging.request_id': existingHeaders?.requestId || '',
        'messaging.tenant_id': existingHeaders?.tenantId || MESSAGING_CONSTANTS.TENANT_DEFAULT,
      },
    });

    const spanContext = otelSpan.spanContext();
    const spanId = spanContext.spanId;
    const traceId = spanContext.traceId;
    const newTraceparent = this.formatTraceparent(traceId, spanId);

    const headers: KafkaHeaders = {
      ...existingHeaders,
      traceparent: newTraceparent,
      tracestate: existingHeaders?.tracestate || MESSAGING_CONSTANTS.ROJO_STATE,
      correlationId: existingHeaders?.correlationId,
      requestId: existingHeaders?.requestId,
      idempotencyKey: existingHeaders?.idempotencyKey,
      tenantId: existingHeaders?.tenantId || MESSAGING_CONSTANTS.TENANT_DEFAULT,
    };

    const span: MessagingTraceSpan = {
      otelSpan,
      traceId,
      spanId,
      parentSpanId: parsed.parentSpanId,
      operation: MESSAGING_CONSTANTS.OPERATION_PUBLISH,
      topic,
      eventName,
      startTime: Date.now(),
    };

    return { span, headers };
  }

  public static createConsumerSpan(
    event: KafkaEvent<unknown>,
    topic: string,
    serviceName: string = MESSAGING_CONSTANTS.DEFAULT_SERVICE_NAME,
  ): MessagingTraceSpan {
    const tracer = getTracer(serviceName);
    const parsed = this.parseTraceparent(event.headers?.traceparent);

    const otelSpan = tracer.startSpan(`Kafka CONSUMER ${event.eventName}`, {
      kind: SpanKind.CONSUMER,
      attributes: {
        'messaging.system': MESSAGING_CONSTANTS.MESSAGING_SYSTEM_KAFKA,
        'messaging.destination': topic,
        'messaging.kafka.event_name': event.eventName,
        'messaging.operation': MESSAGING_CONSTANTS.OPERATION_PROCESS,
        'messaging.message_id': event.id,
        'messaging.correlation_id': event.headers?.correlationId || '',
        'messaging.request_id': event.headers?.requestId || '',
        'messaging.tenant_id': event.headers?.tenantId || '',
      },
    });

    const spanContext = otelSpan.spanContext();

    const span: MessagingTraceSpan = {
      otelSpan,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      parentSpanId: parsed.parentSpanId,
      operation: MESSAGING_CONSTANTS.OPERATION_PROCESS,
      topic,
      eventName: event.eventName,
      startTime: Date.now(),
    };

    return span;
  }

  public static finishSpan(span: MessagingTraceSpan, error?: Error): void {
    const durationMs = Date.now() - span.startTime;
    if (error) {
      span.otelSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.otelSpan.recordException(error);
      span.otelSpan.setAttribute('error', true);
      console.error(
        `[MessagingTracer] SPAN FAILED [traceId=${span.traceId}, spanId=${span.spanId}] (${durationMs}ms) -> Error: ${error.message}`,
      );
    } else {
      span.otelSpan.setStatus({ code: SpanStatusCode.OK });
    }
    span.otelSpan.end();
  }
}
