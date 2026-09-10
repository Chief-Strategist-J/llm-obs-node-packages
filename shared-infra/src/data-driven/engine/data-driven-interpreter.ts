/**
 * ALGORITHM SPECIFICATION:
 * 1. Interpret a JSON-declarative DataPipelineSpec and dynamically execute it against a collection using DataPipeline.
 * 2. Resolve related stores by name from a provided stores dictionary for data-driven 8-type relationship loading.
 * 3. Enforce immutability and return telemetry-enveloped output with span tracing support.
 */

import { DataPipeline } from '../pipeline/data-pipeline';
import type { DataPipelineSpec } from '../types/pipeline-spec.types';
import type { DataPipelineEnvelope } from '../types/query-relation.types';
import { validatePipelineSpec } from './spec-validator';

export function executeDataDrivenPipeline<T extends Record<string, unknown>>(
  collection: readonly T[],
  spec: DataPipelineSpec,
  stores: Readonly<Record<string, readonly Record<string, unknown>[]>> = {}
): DataPipelineEnvelope<any> {
  const validatedSpec = validatePipelineSpec(spec);
  let pipeline = new DataPipeline<T>(collection);

  for (const step of validatedSpec.steps) {
    switch (step.type) {
      case 'where':
        pipeline = pipeline.where(step.field, step.operator, step.value, step.boolean ?? 'and');
        break;
      case 'whereNot':
        pipeline = pipeline.whereNot(step.clause, step.boolean ?? 'and');
        break;
      case 'whereGroup':
        pipeline = pipeline.whereGroup(step.clauses, step.boolean ?? 'and');
        break;
      case 'whereAny':
        pipeline = pipeline.whereAny(step.clauses, step.boolean ?? 'and');
        break;
      case 'whereAll':
        pipeline = pipeline.whereAll(step.clauses, step.boolean ?? 'and');
        break;
      case 'whereNone':
        pipeline = pipeline.whereNone(step.clauses, step.boolean ?? 'and');
        break;
      case 'whereJsonContains':
        pipeline = pipeline.whereJsonContains(step.path, step.value, step.boolean ?? 'and');
        break;
      case 'whereJsonLength':
        pipeline = pipeline.whereJsonLength(step.path, step.length, step.boolean ?? 'and');
        break;
      case 'whereDate':
        pipeline = pipeline.whereDate(step.field, step.operator, step.value, step.part ?? 'date', step.boolean ?? 'and');
        break;
      case 'whereExists':
        pipeline = pipeline.whereExists(stores[step.subqueryCollectionName] || [], step.parentKey, step.subqueryKey, step.boolean ?? 'and');
        break;
      case 'whereFullText':
        pipeline = pipeline.whereFullText(step.fields, step.query, step.boolean ?? 'and');
        break;
      case 'whereVectorSimilarity':
        pipeline = pipeline.whereVectorSimilarity(step.vectorField, step.targetVector, step.minSimilarity, step.boolean ?? 'and');
        break;
      case 'orderBy':
        pipeline = pipeline.orderBy(step.field, step.direction ?? 'asc');
        break;
      case 'inRandomOrder':
        pipeline = pipeline.inRandomOrder(step.seed);
        break;
      case 'limit':
        pipeline = pipeline.limit(step.count, step.offset ?? 0);
        break;
      case 'groupBy':
        pipeline = pipeline.groupBy(step.fields, step.having);
        break;
      case 'loadOneToOne':
        pipeline = pipeline.loadOneToOne(stores[step.storeName] || [], step.spec);
        break;
      case 'loadOneToMany':
        pipeline = pipeline.loadOneToMany(stores[step.storeName] || [], step.spec);
        break;
      case 'loadManyToMany':
        pipeline = pipeline.loadManyToMany(stores[step.storeName] || [], step.spec);
        break;
      case 'loadHasOneThrough':
        pipeline = pipeline.loadHasOneThrough(stores[step.throughStoreName] || [], stores[step.relatedStoreName] || [], step.spec);
        break;
      case 'loadHasManyThrough':
        pipeline = pipeline.loadHasManyThrough(stores[step.throughStoreName] || [], stores[step.relatedStoreName] || [], step.spec);
        break;
      case 'loadOneToOnePolymorphic':
        pipeline = pipeline.loadOneToOnePolymorphic(stores[step.storeName] || [], step.spec);
        break;
      case 'loadOneToManyPolymorphic':
        pipeline = pipeline.loadOneToManyPolymorphic(stores[step.storeName] || [], step.spec);
        break;
      case 'loadManyToManyPolymorphic':
        pipeline = pipeline.loadManyToManyPolymorphic(stores[step.storeName] || [], step.spec);
        break;
      case 'mapJson':
        pipeline = pipeline.mapJson(step.ops);
        break;
      case 'transformList':
        pipeline = pipeline.transformList(step.ops);
        break;
      case 'setInPath':
        pipeline = pipeline.setInPath(step.path, step.value);
        break;
      case 'remapDeepPaths':
        pipeline = pipeline.remapDeepPaths(step.mappings);
        break;
      case 'flattenNested':
        pipeline = pipeline.flattenNested(step.delimiter ?? '.');
        break;
      case 'unflattenNested':
        pipeline = pipeline.unflattenNested(step.delimiter ?? '.');
        break;
      case 'makeHidden':
        pipeline = pipeline.makeHidden(step.keys);
        break;
      case 'setHidden':
        pipeline = pipeline.setHidden(step.keys);
        break;
      case 'makeVisible':
        pipeline = pipeline.makeVisible(collection, step.keys, step.idField ?? 'id');
        break;
      case 'only':
        pipeline = pipeline.only(step.keys);
        break;
      case 'except':
        pipeline = pipeline.except(step.keys);
        break;
      case 'unique':
        pipeline = pipeline.unique(step.keyField ?? 'id');
        break;
      case 'paginate':
        pipeline = pipeline.paginate(step.spec);
        break;
      case 'paginateCursor':
        pipeline = pipeline.paginateCursor(step.spec);
        break;
    }
  }

  return pipeline.executeEnveloped(spec.name);
}
