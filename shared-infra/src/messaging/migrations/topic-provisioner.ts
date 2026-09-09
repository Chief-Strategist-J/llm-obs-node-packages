/**
 * @file topic-provisioner.ts
 * @description Pure, Strongly Typed, and Resilient Kafka Topic Provisioner.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Topic Migration (`applyMigration`):
 *    - Verifies whether topic is already provisioned in local state map.
 *    - If already exists, returns immutable `already_exists` status result.
 *    - Otherwise, registers topic specification and returns immutable `created` status.
 * 2. Topic Rollback (`rollbackMigration`):
 *    - Removes topic from registry and returns immutable `rolled_back` or `failed` status result.
 */

import { MESSAGING_CONSTANTS } from '../constants/constants';

export interface KafkaTopicSpec {
  readonly name: string;
  readonly numPartitions: number;
  readonly replicationFactor: number;
  readonly configEntries?: Readonly<{
    readonly 'retention.ms'?: string;
    readonly 'cleanup.policy'?: 'delete' | 'compact' | 'delete,compact';
    readonly 'min.insync.replicas'?: string;
    readonly 'segment.bytes'?: string;
  }>;
}

export type TopicMigrationStatus =
  | typeof MESSAGING_CONSTANTS.MIGRATION_CREATED
  | typeof MESSAGING_CONSTANTS.MIGRATION_UPDATED
  | typeof MESSAGING_CONSTANTS.MIGRATION_ALREADY_EXISTS
  | typeof MESSAGING_CONSTANTS.MIGRATION_ROLLED_BACK
  | typeof MESSAGING_CONSTANTS.MIGRATION_FAILED;

export interface TopicMigrationResult {
  readonly topic: string;
  readonly status: TopicMigrationStatus;
  readonly details?: string;
}

export class KafkaTopicProvisioner {
  private readonly provisionedTopics = new Map<string, Readonly<KafkaTopicSpec>>();

  public async applyMigration(spec: Readonly<KafkaTopicSpec>): Promise<Readonly<TopicMigrationResult>> {
    if (this.provisionedTopics.has(spec.name)) {
      return Object.freeze({
        topic: spec.name,
        status: MESSAGING_CONSTANTS.MIGRATION_ALREADY_EXISTS,
        details: `Topic ${spec.name} is already provisioned with ${spec.numPartitions} partitions`,
      });
    }

    this.provisionedTopics.set(spec.name, Object.freeze({ ...spec }));
    console.log(
      `[KafkaTopicProvisioner] Provisioned Topic '${spec.name}' [Partitions: ${spec.numPartitions}, RepFactor: ${spec.replicationFactor}]`,
    );

    return Object.freeze({
      topic: spec.name,
      status: MESSAGING_CONSTANTS.MIGRATION_CREATED,
    });
  }

  public async rollbackMigration(topicName: string): Promise<Readonly<TopicMigrationResult>> {
    if (this.provisionedTopics.has(topicName)) {
      this.provisionedTopics.delete(topicName);
      console.log(`[KafkaTopicProvisioner] Rolled back Topic '${topicName}'`);
      return Object.freeze({
        topic: topicName,
        status: MESSAGING_CONSTANTS.MIGRATION_ROLLED_BACK,
      });
    }

    return Object.freeze({
      topic: topicName,
      status: MESSAGING_CONSTANTS.MIGRATION_FAILED,
      details: `Topic ${topicName} was not found in provisioner state`,
    });
  }
}
