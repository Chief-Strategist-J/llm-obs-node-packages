import { trace, context, type Tracer, SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export { SpanKind, SpanStatusCode, trace, context, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, type Span, type Tracer };

let providerInitialized = false;

declare const process: { env: Record<string, string | undefined> };

export function initNodeTracing(
  serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'observability-service',
  serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0',
): void {
  if (providerInitialized || typeof window !== 'undefined') return;

  try {
    const { NodeTracerProvider, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { AsyncLocalStorageContextManager } = require('@opentelemetry/context-async-hooks');

    process.env.OTEL_EXPORTER_OTLP_PROTOCOL = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || 'http/json';

    const contextManager = new AsyncLocalStorageContextManager();
    contextManager.enable();
    context.setGlobalContextManager(contextManager);

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    });

    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      process.env.OTEL_COLLECTOR_URL ||
      'http://localhost:31417/v1/traces';

    const exporter = new OTLPTraceExporter({
      url: otlpEndpoint,
    });

    const provider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        new SimpleSpanProcessor(exporter),
      ],
    });

    provider.register();
    providerInitialized = true;
  } catch (err) {
    providerInitialized = true;
  }
}

export function getTracer(
  serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'observability-service',
  serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0',
): Tracer {
  if (!providerInitialized && typeof window === 'undefined') {
    initNodeTracing(serviceName, serviceVersion);
  }
  return trace.getTracer(serviceName, serviceVersion);
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options: { kind?: SpanKind; attributes?: Record<string, string | number | boolean>; serviceName?: string } = {}
): Promise<T> {
  const tracer = getTracer(options.serviceName);
  return tracer.startActiveSpan(
    name,
    { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        span.setAttribute('error', true);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}
