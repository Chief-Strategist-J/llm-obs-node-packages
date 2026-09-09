/**
 * @file topic-catalog.ts
 * @description Pure Functional, Strongly-Typed, and Immutable Topic Catalog Registry.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Topic Registration:
 *    - Stores deeply frozen `TopicMetadata` definitions in an internal lookup map.
 * 2. Topic Querying:
 *    - Supports direct key lookup or reverse name lookup.
 * 3. Topic Listing:
 *    - Returns frozen arrays of topic metadata (`Object.freeze`), preserving data immutability.
 */

export interface TopicMetadata {
  readonly name: string;
  readonly category: string;
  readonly schemaVersion: string;
  readonly partitions: number;
  readonly description: string;
}

export class TopicCatalogRegistry {
  private readonly topics: Map<string, Readonly<TopicMetadata>> = new Map();

  public registerTopic(key: string, metadata: Readonly<TopicMetadata>): void {
    this.topics.set(key, Object.freeze({ ...metadata }));
  }

  public getTopic(keyOrName: string): Readonly<TopicMetadata> | undefined {
    if (this.topics.has(keyOrName)) {
      return this.topics.get(keyOrName);
    }
    return Array.from(this.topics.values()).find((t) => t.name === keyOrName);
  }

  public getAllTopics(): readonly TopicMetadata[] {
    return Object.freeze(Array.from(this.topics.values()));
  }

  public hasTopic(keyOrName: string): boolean {
    return this.getTopic(keyOrName) !== undefined;
  }
}

export const topicCatalogRegistry = new TopicCatalogRegistry();

export function getTopicMetadata(topicName: string): Readonly<TopicMetadata> | undefined {
  return topicCatalogRegistry.getTopic(topicName);
}
