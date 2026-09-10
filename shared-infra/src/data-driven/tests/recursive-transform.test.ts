import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../types/transform.types';
import {
  traverseTreeDFS,
  traverseTreeBFS,
  treeMap,
  treeFilter,
  treeFindPath,
  detectTreeCycle,
} from '../transforms/recursive-transform';

describe('Data-Driven Recursive Transforms - Pure Functional & Immutable', () => {
  const tree: TreeNode<number> = Object.freeze({
    id: 'root',
    value: 1,
    children: Object.freeze([
      Object.freeze({
        id: 'child1',
        value: 2,
        children: Object.freeze([
          Object.freeze({ id: 'grandchild1', value: 3, children: Object.freeze([]) }),
        ]),
      }),
      Object.freeze({
        id: 'child2',
        value: 4,
        children: Object.freeze([]),
      }),
    ]),
  });

  it('traverses tree DFS and BFS cleanly', () => {
    const dfsVisited: string[] = [];
    traverseTreeDFS(tree, (node) => dfsVisited.push(node.id));
    expect(dfsVisited).toEqual(['root', 'child1', 'grandchild1', 'child2']);

    const bfsVisited: string[] = [];
    traverseTreeBFS(tree, (node) => bfsVisited.push(node.id));
    expect(bfsVisited).toEqual(['root', 'child1', 'child2', 'grandchild1']);
  });

  it('maps tree values immutably', () => {
    const mapped = treeMap(tree, (val) => val * 10);

    expect(mapped.value).toBe(10);
    expect(mapped.children[0].value).toBe(20);
    expect(mapped.children[0].children[0].value).toBe(30);

    expect(Object.isFrozen(mapped)).toBe(true);
    expect(Object.isFrozen(mapped.children[0])).toBe(true);
    expect(tree.value).toBe(1);
  });

  it('filters tree nodes immutably', () => {
    const filtered = treeFilter(tree, (node) => node.id !== 'child2');

    expect(filtered).not.toBeNull();
    expect(filtered!.children.length).toBe(1);
    expect(filtered!.children[0].id).toBe('child1');
    expect(Object.isFrozen(filtered)).toBe(true);
  });

  it('finds node paths in tree structures', () => {
    const path = treeFindPath(tree, 'grandchild1');
    expect(path).toEqual(['root', 'child1', 'grandchild1']);
    expect(Object.isFrozen(path)).toBe(true);
  });

  it('detects cycles in tree structures', () => {
    expect(detectTreeCycle(tree)).toBe(false);
  });
});
