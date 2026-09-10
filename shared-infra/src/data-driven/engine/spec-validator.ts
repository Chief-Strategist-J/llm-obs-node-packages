/**
 * ALGORITHM SPECIFICATION:
 * 1. Validate DataPipelineSpec structure dynamically before execution.
 * 2. Calculate Levenshtein distance between user inputs and known keywords to provide intelligent typo suggestions.
 * 3. Validate step types, clause operators, and required spec properties, throwing descriptive error messages with recommendations.
 */

import type { DataPipelineSpec, PipelineSpecStep } from '../types/pipeline-spec.types';

const KNOWN_STEP_TYPES: readonly string[] = Object.freeze([
  'where',
  'whereNot',
  'whereGroup',
  'whereAny',
  'whereAll',
  'whereNone',
  'whereJsonContains',
  'whereJsonLength',
  'whereDate',
  'whereExists',
  'whereFullText',
  'whereVectorSimilarity',
  'orderBy',
  'inRandomOrder',
  'limit',
  'groupBy',
  'loadOneToOne',
  'loadOneToMany',
  'loadManyToMany',
  'loadHasOneThrough',
  'loadHasManyThrough',
  'loadOneToOnePolymorphic',
  'loadOneToManyPolymorphic',
  'loadManyToManyPolymorphic',
  'mapJson',
  'transformList',
  'setInPath',
  'remapDeepPaths',
  'flattenNested',
  'unflattenNested',
  'makeHidden',
  'setHidden',
  'makeVisible',
  'only',
  'except',
  'unique',
  'paginate',
  'paginateCursor',
]);

const KNOWN_OPERATORS: readonly string[] = Object.freeze([
  'eq',
  '=',
  'neq',
  '!=',
  'gt',
  '>',
  'gte',
  '>=',
  'lt',
  '<',
  'lte',
  '<=',
  'like',
  'in',
  'notIn',
  'null',
  'notNull',
  'between',
]);

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function findClosestMatch(input: string, candidates: readonly string[]): string | undefined {
  let closest: string | undefined = undefined;
  let minDistance = Infinity;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(input.toLowerCase(), candidate.toLowerCase());
    if (dist < minDistance && dist <= 4) {
      minDistance = dist;
      closest = candidate;
    }
  }

  return closest;
}

export function validatePipelineSpec(spec: unknown): DataPipelineSpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Pipeline specification must be a non-null object.');
  }

  const candidateSpec = spec as Record<string, unknown>;

  if (typeof candidateSpec.name !== 'string' || !candidateSpec.name.trim()) {
    throw new Error('Pipeline specification must have a valid non-empty string "name".');
  }

  if (!Array.isArray(candidateSpec.steps)) {
    throw new Error(`Pipeline specification "${candidateSpec.name}" must contain a "steps" array.`);
  }

  for (let i = 0; i < candidateSpec.steps.length; i++) {
    const step = candidateSpec.steps[i];
    if (!step || typeof step !== 'object') {
      throw new Error(`Step at index ${i} in pipeline "${candidateSpec.name}" must be an object.`);
    }

    const stepObj = step as Record<string, unknown>;
    const stepType = String(stepObj.type || '');

    if (!KNOWN_STEP_TYPES.includes(stepType)) {
      const suggestion = findClosestMatch(stepType, KNOWN_STEP_TYPES);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
      throw new Error(
        `Invalid step type "${stepType}" at index ${i} in pipeline "${candidateSpec.name}".${hint} Supported step types: [${KNOWN_STEP_TYPES.join(
          ', '
        )}]`
      );
    }

    if (stepType === 'where') {
      const op = String(stepObj.operator || '');
      if (!KNOWN_OPERATORS.includes(op)) {
        const suggestion = findClosestMatch(op, KNOWN_OPERATORS);
        const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
        throw new Error(
          `Invalid operator "${op}" in "where" step at index ${i} for field "${stepObj.field}".${hint} Supported operators: [${KNOWN_OPERATORS.join(
            ', '
          )}]`
        );
      }
    }
  }

  return spec as DataPipelineSpec;
}
