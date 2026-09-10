import { httpClient } from '../../http/http-client';
import { mapJson } from '../transforms/json-map';
import type { EntitySchema } from '../types/entity-schema.types';

export interface CrudPort<T> {
  readonly list: () => Promise<readonly T[]>;
  readonly get: (id: string) => Promise<T>;
  readonly create: (payload: Partial<T>) => Promise<T>;
  readonly update: (id: string, payload: Partial<T>) => Promise<T>;
  readonly remove: (id: string) => Promise<void>;
}

export function createEntityAdapter<T extends Record<string, unknown>>(
  schema: EntitySchema<T>
): CrudPort<T> {
  const fromApi = (raw: unknown): T =>
    schema.validate.parse(schema.fromApi ? mapJson(raw as Record<string, unknown>, schema.fromApi) : raw);

  const toApi = (entity: Partial<T>): unknown =>
    schema.toApi ? mapJson(entity as Record<string, unknown>, schema.toApi) : entity;

  return Object.freeze({
    async list(): Promise<readonly T[]> {
      const { data } = await httpClient.get(schema.endpoint);
      const items = (data as unknown[]).map(fromApi);
      return Object.freeze(items.map((item) => Object.freeze({ ...item })));
    },
    async get(id: string): Promise<T> {
      const { data } = await httpClient.get(`${schema.endpoint}/${id}`);
      return Object.freeze({ ...fromApi(data) });
    },
    async create(payload: Partial<T>): Promise<T> {
      const { data } = await httpClient.post(schema.endpoint, toApi(payload));
      return Object.freeze({ ...fromApi(data) });
    },
    async update(id: string, payload: Partial<T>): Promise<T> {
      const { data } = await httpClient.patch(`${schema.endpoint}/${id}`, toApi(payload));
      return Object.freeze({ ...fromApi(data) });
    },
    async remove(id: string): Promise<void> {
      await httpClient.delete(`${schema.endpoint}/${id}`);
    },
  });
}
