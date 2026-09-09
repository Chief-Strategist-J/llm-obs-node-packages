/**
 * @file broker-config.ts
 * @description Strongly Typed, Pure, and Immutable Configuration for Kafka Messaging Infrastructure.
 */

import { MESSAGING_CONSTANTS } from '../constants/constants';

declare const process: { env: Record<string, string | undefined> };

export interface KafkaBrokerConfig {
  readonly clientId: string;
  readonly brokers: readonly string[];
  readonly groupId: string;
  readonly connectionTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly maxInFlightRequests: number;
  readonly enableIdempotence: boolean;
  readonly retryOptions: {
    readonly maxRetries: number;
    readonly initialRetryTimeMs: number;
  };
}

function getEnvNumber(key: string, fallback: number): number {
  if (typeof process !== 'undefined' && process?.env?.[key]) {
    const val = parseInt(process.env[key]!, 10);
    if (!isNaN(val)) return val;
  }
  return fallback;
}

export function getDefaultBrokerConfig(
  clientId: string,
  overrideBrokers?: readonly string[],
  groupId?: string
): KafkaBrokerConfig {
  const envBrokersRaw = process?.env?.[MESSAGING_CONSTANTS.ENV_KAFKA_BROKERS] || process?.env?.[MESSAGING_CONSTANTS.ENV_KAFKA_URL];
  const envBrokers = envBrokersRaw
    ? envBrokersRaw.split(MESSAGING_CONSTANTS.SEPARATOR_COMMA).map((b) => b.trim()).filter(Boolean)
    : undefined;

  const envGroupId = process?.env?.[MESSAGING_CONSTANTS.ENV_KAFKA_GROUP_ID];

  return Object.freeze({
    clientId,
    brokers: Object.freeze(overrideBrokers || envBrokers || [MESSAGING_CONSTANTS.DEFAULT_KAFKA_BROKER]),
    groupId: groupId || envGroupId || `${clientId}${MESSAGING_CONSTANTS.DEFAULT_GROUP_ID_SUFFIX}`,
    connectionTimeoutMs: getEnvNumber(MESSAGING_CONSTANTS.ENV_KAFKA_CONNECTION_TIMEOUT_MS, MESSAGING_CONSTANTS.DEFAULT_CONNECTION_TIMEOUT_MS),
    requestTimeoutMs: getEnvNumber(MESSAGING_CONSTANTS.ENV_KAFKA_REQUEST_TIMEOUT_MS, MESSAGING_CONSTANTS.DEFAULT_REQUEST_TIMEOUT_MS),
    maxInFlightRequests: getEnvNumber(MESSAGING_CONSTANTS.ENV_KAFKA_MAX_IN_FLIGHT_REQUESTS, MESSAGING_CONSTANTS.DEFAULT_MAX_IN_FLIGHT_REQUESTS),
    enableIdempotence: true,
    retryOptions: Object.freeze({
      maxRetries: getEnvNumber(MESSAGING_CONSTANTS.ENV_KAFKA_MAX_RETRIES, MESSAGING_CONSTANTS.DEFAULT_MAX_RETRIES),
      initialRetryTimeMs: getEnvNumber(MESSAGING_CONSTANTS.ENV_KAFKA_INITIAL_RETRY_TIME_MS, MESSAGING_CONSTANTS.DEFAULT_INITIAL_RETRY_TIME_MS),
    }),
  });
}

export interface KafkaBrokerHealthStatus {
  readonly status: typeof MESSAGING_CONSTANTS.STATUS_HEALTHY | typeof MESSAGING_CONSTANTS.STATUS_DEGRADED | typeof MESSAGING_CONSTANTS.STATUS_UNHEALTHY;
  readonly brokers: readonly string[];
  readonly clientId: string;
  readonly activeListenersCount: number;
  readonly lastConnectedTimestamp: string | null;
}
