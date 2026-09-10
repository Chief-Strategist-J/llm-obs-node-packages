import { featureRegistry } from '../../store/feature-registry';
import { createEntitySlice } from '../redux/create-entity-slice';
import { createEntitySagas } from '../redux/create-entity-sagas';
import type { CrudPort } from './create-entity-adapter';
import type { EntitySchema } from '../types/entity-schema.types';

export function registerEntity<T extends { id: string }>(schema: EntitySchema<T>, adapter: CrudPort<T>) {
  const { slice, selectors } = createEntitySlice<T>(schema.name);
  const saga = createEntitySagas<T>(schema.name, adapter, slice);
  featureRegistry.register(schema.name, { reducer: slice.reducer, saga });
  return Object.freeze({ schema, adapter, slice, selectors, actions: slice.actions });
}
