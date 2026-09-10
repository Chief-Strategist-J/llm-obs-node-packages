import type { TreeNode } from '../types/transform.types';

export function traverseTreeDFS<T>(
  root: TreeNode<T>,
  visitor: (node: TreeNode<T>) => void
): void {
  visitor(root);
  for (const child of root.children) {
    traverseTreeDFS(child, visitor);
  }
}

export function traverseTreeBFS<T>(
  root: TreeNode<T>,
  visitor: (node: TreeNode<T>) => void
): void {
  const queue: TreeNode<T>[] = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitor(current);
    for (const child of current.children) {
      queue.push(child);
    }
  }
}

export function treeMap<T, R>(
  root: TreeNode<T>,
  mapper: (val: T, node: TreeNode<T>) => R
): TreeNode<R> {
  const mappedValue = mapper(root.value, root);
  const mappedChildren = root.children.map((child) => treeMap(child, mapper));
  return Object.freeze({
    id: root.id,
    value: mappedValue,
    children: Object.freeze(mappedChildren),
  });
}

export function treeFilter<T>(
  root: TreeNode<T>,
  predicate: (node: TreeNode<T>) => boolean
): TreeNode<T> | null {
  if (!predicate(root)) {
    return null;
  }
  const filteredChildren: TreeNode<T>[] = [];
  for (const child of root.children) {
    const filteredChild = treeFilter(child, predicate);
    if (filteredChild !== null) {
      filteredChildren.push(filteredChild);
    }
  }
  return Object.freeze({
    id: root.id,
    value: root.value,
    children: Object.freeze(filteredChildren),
  });
}

export function treeFindPath<T>(
  root: TreeNode<T>,
  targetId: string
): readonly string[] {
  function search(node: TreeNode<T>, currentPath: readonly string[]): readonly string[] {
    const newPath = Object.freeze([...currentPath, node.id]);
    if (node.id === targetId) {
      return newPath;
    }
    for (const child of node.children) {
      const resultPath = search(child, newPath);
      if (resultPath.length > 0) {
        return resultPath;
      }
    }
    return Object.freeze([]);
  }

  return search(root, Object.freeze([]));
}

export function detectTreeCycle<T>(root: TreeNode<T>): boolean {
  const visited = new Set<string>();

  function hasCycle(node: TreeNode<T>): boolean {
    if (visited.has(node.id)) {
      return true;
    }
    visited.add(node.id);
    for (const child of node.children) {
      if (hasCycle(child)) {
        return true;
      }
    }
    visited.delete(node.id);
    return false;
  }

  return hasCycle(root);
}
