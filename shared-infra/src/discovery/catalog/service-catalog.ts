import { HTTP_CONSTANTS } from "../../http/constants";

declare const process: { env: Record<string, string | undefined> };

export interface ServiceDefinition {
  name: string;
  defaultPort: number;
  protocol: string;
  defaultUrl: string;
  serviceSub: string;
  healthPath?: string;
}

function getEnv(key: string, fallback: string): string {
  if (typeof process !== "undefined" && process?.env?.[key]) {
    return process.env[key]!;
  }
  return fallback;
}

function getEnvPort(key: string, fallback: number): number {
  if (typeof process !== "undefined" && process?.env?.[key]) {
    const parsed = parseInt(process.env[key]!, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

export function getServiceCatalog(): Record<string, ServiceDefinition> {
  return {
    [HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_LATENCY_ENGINE,
      defaultPort: getEnvPort("LATENCY_ENGINE_PORT", 8003),
      protocol: HTTP_CONSTANTS.PROTOCOL_HTTP,
      defaultUrl: getEnv("LATENCY_ENGINE_URL", "http://localhost:8003"),
      serviceSub: "latency-engine-service",
      healthPath: "/health",
    },
    [HTTP_CONSTANTS.SERVICE_NAME_AUTH_SERVICE]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_AUTH_SERVICE,
      defaultPort: getEnvPort("AUTH_SERVICE_PORT", 3001),
      protocol: HTTP_CONSTANTS.PROTOCOL_HTTP,
      defaultUrl: getEnv("AUTH_SERVICE_URL", "http://localhost:3001"),
      serviceSub: "auth-service",
      healthPath: "/health",
    },
    [HTTP_CONSTANTS.SERVICE_NAME_WEB_APP]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_WEB_APP,
      defaultPort: getEnvPort("WEB_APP_PORT", 31400),
      protocol: HTTP_CONSTANTS.PROTOCOL_HTTP,
      defaultUrl: getEnv("WEB_APP_URL", "http://localhost:31400"),
      serviceSub: HTTP_CONSTANTS.DEFAULT_SERVICE_SUB,
      healthPath: HTTP_CONSTANTS.ENDPOINT_HEALTH,
    },
    [HTTP_CONSTANTS.SERVICE_NAME_CLICKHOUSE]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_CLICKHOUSE,
      defaultPort: getEnvPort("CLICKHOUSE_PORT", 31421),
      protocol: HTTP_CONSTANTS.PROTOCOL_HTTP,
      defaultUrl: getEnv("CLICKHOUSE_URL", "http://localhost:31421"),
      serviceSub: "clickhouse-service",
      healthPath: "/ping",
    },
    [HTTP_CONSTANTS.SERVICE_NAME_REDIS]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_REDIS,
      defaultPort: getEnvPort("REDIS_PORT", 31413),
      protocol: HTTP_CONSTANTS.PROTOCOL_TCP,
      defaultUrl: getEnv("REDIS_URL", "redis://localhost:31413"),
      serviceSub: "redis-service",
    },
    [HTTP_CONSTANTS.SERVICE_NAME_KAFKA]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_KAFKA,
      defaultPort: getEnvPort("KAFKA_PORT", 31414),
      protocol: HTTP_CONSTANTS.PROTOCOL_TCP,
      defaultUrl: getEnv("KAFKA_URL", getEnv("KAFKA_BROKERS", "kafka://localhost:31414")),
      serviceSub: "kafka-service",
    },
    [HTTP_CONSTANTS.SERVICE_NAME_OTEL_COLLECTOR]: {
      name: HTTP_CONSTANTS.SERVICE_NAME_OTEL_COLLECTOR,
      defaultPort: getEnvPort("OTEL_COLLECTOR_PORT", 31417),
      protocol: HTTP_CONSTANTS.PROTOCOL_HTTP,
      defaultUrl: getEnv("OTEL_COLLECTOR_URL", getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:31417")),
      serviceSub: "otel-collector-service",
    },
  };
}

export const SERVICE_CATALOG: Record<string, ServiceDefinition> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      const catalog = getServiceCatalog();
      return catalog[prop];
    },
    ownKeys() {
      return Object.keys(getServiceCatalog());
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const catalog = getServiceCatalog();
      if (prop in catalog) {
        return {
          enumerable: true,
          configurable: true,
          value: catalog[prop],
        };
      }
      return undefined;
    },
  }
);
