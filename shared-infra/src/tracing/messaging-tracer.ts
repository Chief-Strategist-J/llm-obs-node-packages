import { MessagingTracer, type MessagingTraceSpan } from '../messaging/tracing/messaging-tracer';
import type { KafkaHeaders, KafkaEvent } from '../messaging/client/client-factory';

export type CentralKafkaHeaders = KafkaHeaders;
export type CentralKafkaEvent<T = unknown> = KafkaEvent<T>;
export type { MessagingTraceSpan };

export class CentralMessagingTracer extends MessagingTracer {}
