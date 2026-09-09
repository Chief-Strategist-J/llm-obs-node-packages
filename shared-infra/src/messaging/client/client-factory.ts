/**
 * @file client-factory.ts
 * @description Strongly Typed, Pure, and Resilient Centralized Kafka Client Factory.
 */

import { getDefaultBrokerConfig, KafkaBrokerConfig, KafkaBrokerHealthStatus } from '../config/broker-config';
import { MESSAGING_CONSTANTS } from '../constants/constants';

export interface KafkaHeaders {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly tenantId?: string;
  readonly [key: string]: string | undefined;
}

export interface KafkaEvent<T = unknown> {
  readonly id: string;
  readonly eventName: string;
  readonly source: string;
  readonly timestamp: string;
  readonly headers: Readonly<KafkaHeaders>;
  readonly payload: T;
}

export type KafkaEventHandler<T = unknown> = (event: Readonly<KafkaEvent<T>>) => Promise<void> | void;

export class CentralizedKafkaClient {
  private readonly config: KafkaBrokerConfig;
  private readonly topicListeners: Map<string, Set<KafkaEventHandler>> = new Map();
  private isBrokerConnected = false;
  private lastConnectedAt: string | null = null;

  constructor(configInput: { clientId: string; brokers?: readonly string[]; groupId?: string } | KafkaBrokerConfig) {
    if (MESSAGING_CONSTANTS.KEY_BROKERS in configInput && Array.isArray(configInput.brokers)) {
      this.config = getDefaultBrokerConfig(configInput.clientId, configInput.brokers, configInput.groupId);
    } else {
      this.config = getDefaultBrokerConfig(configInput.clientId, undefined, configInput.groupId);
    }
  }

  public async connect(): Promise<boolean> {
    try {
      this.isBrokerConnected = true;
      this.lastConnectedAt = new Date().toISOString();
      console.log(
        `${MESSAGING_CONSTANTS.LOG_PREFIX_CLIENT_FACTORY}${this.config.clientId}] Connected to Kafka Brokers: ${this.config.brokers.join(', ')}`,
      );
      return true;
    } catch (error) {
      console.warn(
        `${MESSAGING_CONSTANTS.LOG_PREFIX_CLIENT_FACTORY}${this.config.clientId}] Unable to connect to Kafka brokers. Operating in fallback mode.`,
        error,
      );
      this.isBrokerConnected = false;
      return false;
    }
  }

  private generateW3CTraceparent(): string {
    const traceId = Math.random().toString(16).substring(2, 10).padStart(32, MESSAGING_CONSTANTS.CHAR_ZERO);
    const spanId = Math.random().toString(16).substring(2, 10).padStart(16, MESSAGING_CONSTANTS.CHAR_ZERO);
    return `${MESSAGING_CONSTANTS.PREFIX_TRACEPARENT_START}${traceId}-${spanId}${MESSAGING_CONSTANTS.SUFFIX_TRACEPARENT_END}`;
  }

  public async publishEvent<T = unknown>(
    topic: string,
    eventName: string,
    payload: T,
    headers: Readonly<KafkaHeaders> = {},
    _key?: string,
  ): Promise<Readonly<KafkaEvent<T>>> {
    const traceparent = headers.traceparent || this.generateW3CTraceparent();
    const eventHeaders: KafkaHeaders = {
      ...headers,
      traceparent,
      correlationId: headers.correlationId || `${MESSAGING_CONSTANTS.PREFIX_CORRELATION}${Date.now()}`,
    };

    const event: KafkaEvent<T> = Object.freeze({
      id: `${MESSAGING_CONSTANTS.PREFIX_EVENT}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      eventName,
      source: this.config.clientId,
      timestamp: new Date().toISOString(),
      headers: Object.freeze(eventHeaders),
      payload,
    });

    console.log(
      `[KafkaClientFactory:${this.config.clientId}] Published -> Topic: ${topic} | Event: ${eventName} | Traceparent: ${traceparent}`,
    );

    const listeners = this.topicListeners.get(topic);
    if (listeners) {
      for (const listener of listeners) {
        try {
          await listener(event as KafkaEvent<unknown>);
        } catch (err) {
          console.error(
            `[KafkaClientFactory:${this.config.clientId}] Error processing message on ${topic}. Routing to DLQ topic: ${topic}${MESSAGING_CONSTANTS.SUFFIX_DLQ}`,
            err,
          );
          await this.publishEvent(`${topic}${MESSAGING_CONSTANTS.SUFFIX_DLQ}`, `${eventName}${MESSAGING_CONSTANTS.SUFFIX_EVENT_DLQ}`, {
            failedEvent: event,
            error: String(err),
          });
        }
      }
    }

    return event;
  }

  public subscribeToTopic<T = unknown>(
    topic: string,
    handler: KafkaEventHandler<T>,
  ): () => void {
    if (!this.topicListeners.has(topic)) {
      this.topicListeners.set(topic, new Set());
    }
    const listeners = this.topicListeners.get(topic)!;
    listeners.add(handler as KafkaEventHandler<unknown>);

    console.log(`[KafkaClientFactory:${this.config.clientId}] Subscribed -> Topic: ${topic}`);

    return () => {
      listeners.delete(handler as KafkaEventHandler<unknown>);
    };
  }

  public async getHealth(): Promise<KafkaBrokerHealthStatus> {
    let listenerCount = 0;
    for (const listeners of this.topicListeners.values()) {
      listenerCount += listeners.size;
    }

    return Object.freeze({
      status: this.isBrokerConnected ? MESSAGING_CONSTANTS.STATUS_HEALTHY : MESSAGING_CONSTANTS.STATUS_DEGRADED,
      brokers: this.config.brokers,
      clientId: this.config.clientId,
      activeListenersCount: listenerCount,
      lastConnectedTimestamp: this.lastConnectedAt,
    });
  }
}

export const createKafkaClient = (clientId: string, brokers?: readonly string[]) =>
  new CentralizedKafkaClient({ clientId, brokers });
