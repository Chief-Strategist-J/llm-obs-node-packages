import { CentralizedKafkaClient, KafkaEvent, KafkaHeaders } from '../client/client-factory';
import { MESSAGING_CONSTANTS } from '../constants/constants';
import {
  ProducerMiddlewarePipeline,
  tracingProducerMiddleware,
  loggingProducerMiddleware,
  retryProducerMiddleware,
} from '../middleware/producer-pipeline';

export class TypedEventProducer {
  private pipeline: ProducerMiddlewarePipeline;

  constructor(
    private kafkaClient: CentralizedKafkaClient,
    maxRetries = MESSAGING_CONSTANTS.DEFAULT_MAX_RETRIES,
    initialDelayMs = MESSAGING_CONSTANTS.DEFAULT_INITIAL_RETRY_TIME_MS,
  ) {
    this.pipeline = new ProducerMiddlewarePipeline();
    this.pipeline
      .use(tracingProducerMiddleware)
      .use(loggingProducerMiddleware)
      .use(retryProducerMiddleware(maxRetries, initialDelayMs));
  }

  public publish<T = unknown>(
    topic: string,
    eventName: string,
    payload: T,
    headers?: KafkaHeaders,
  ): Promise<KafkaEvent<T>> {
    return this.pipeline.execute(
      topic,
      eventName,
      payload,
      headers,
      (t, e, p, h) => this.kafkaClient.publishEvent(t, e, p, h),
    );
  }
}
