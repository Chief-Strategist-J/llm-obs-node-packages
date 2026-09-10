import { describe, it, expect } from 'vitest';
import {
  createGraph,
  addGraphNode,
  addGraphEdge,
  topologicalSort,
  bfsGraph,
  dfsGraph,
  findShortestPath,
  detectGraphCycle,
  filterGraph,
} from '../transforms/graph-transform';

describe('Data-Driven Graph Transforms - Pure Functional & Immutable', () => {
  const initialGraph = createGraph<string>(
    [
      { id: 'A', data: 'Node A' },
      { id: 'B', data: 'Node B' },
      { id: 'C', data: 'Node C' },
    ],
    [
      { from: 'A', to: 'B', weight: 1 },
      { from: 'B', to: 'C', weight: 2 },
    ]
  );

  it('creates immutable graph representations', () => {
    expect(Object.isFrozen(initialGraph)).toBe(true);
    expect(Object.isFrozen(initialGraph.nodes)).toBe(true);
    expect(Object.isFrozen(initialGraph.edges)).toBe(true);
  });

  it('adds nodes and edges immutably without mutating original graph', () => {
    const withNode = addGraphNode(initialGraph, { id: 'D', data: 'Node D' });
    const withEdge = addGraphEdge(withNode, { from: 'C', to: 'D', weight: 3 });

    expect(initialGraph.nodes.length).toBe(3);
    expect(withEdge.nodes.length).toBe(4);
    expect(withEdge.edges.length).toBe(3);
    expect(Object.isFrozen(withEdge)).toBe(true);
  });

  it('performs topological sort on DAG', () => {
    const order = topologicalSort(initialGraph);
    expect(order).toEqual(['A', 'B', 'C']);
    expect(Object.isFrozen(order)).toBe(true);
  });

  it('traverses graph via BFS and DFS', () => {
    const bfsVisited: string[] = [];
    bfsGraph(initialGraph, 'A', (node) => bfsVisited.push(node.id));
    expect(bfsVisited).toEqual(['A', 'B', 'C']);

    const dfsVisited: string[] = [];
    dfsGraph(initialGraph, 'A', (node) => dfsVisited.push(node.id));
    expect(dfsVisited).toEqual(['A', 'B', 'C']);
  });

  it('finds shortest path between graph nodes', () => {
    const path = findShortestPath(initialGraph, 'A', 'C');
    expect(path).toEqual(['A', 'B', 'C']);
    expect(Object.isFrozen(path)).toBe(true);
  });

  it('detects cycles in graphs accurately', () => {
    expect(detectGraphCycle(initialGraph)).toBe(false);

    const cyclicGraph = addGraphEdge(initialGraph, { from: 'C', to: 'A', weight: 1 });
    expect(detectGraphCycle(cyclicGraph)).toBe(true);
  });

  it('filters graph nodes and edges immutably', () => {
    const filtered = filterGraph(initialGraph, (node) => node.id !== 'C');
    expect(filtered.nodes.length).toBe(2);
    expect(filtered.edges.length).toBe(1);
    expect(Object.isFrozen(filtered)).toBe(true);
  });
});
