/**
 * @file feature-registry.ts
 * @description Pure, Strongly-Typed, and Immutable Redux Feature Registry.
 * 
 * ALGORITHM & SPECIFICATION:
 * 1. Feature Module Registration:
 *    - Registers feature slices with their corresponding sagas into an immutable store map.
 * 2. Immutable Entries Lookup:
 *    - Returns frozen tuples of registered feature modules (`Object.freeze`).
 */

export interface FeatureModule {
  readonly reducer: any;
  readonly saga: () => Generator;
}

const registry = new Map<string, Readonly<FeatureModule>>();

export const featureRegistry = {
  register(name: string, mod: Readonly<FeatureModule>): void {
    registry.set(name, Object.freeze({ ...mod }));
  },
  getAll(): readonly (readonly [string, Readonly<FeatureModule>])[] {
    return Object.freeze(Array.from(registry.entries()).map(([k, v]) => Object.freeze([k, v] as const)));
  },
  get(name: string): Readonly<FeatureModule> | undefined {
    return registry.get(name);
  },
};
