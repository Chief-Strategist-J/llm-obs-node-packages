import type { Graph, GraphNode, GraphEdge } from '../types/transform.types';

export function createGraph<T>(
  nodes: readonly GraphNode<T>[],
  edges: readonly GraphEdge[]
): Graph<T> {
  const frozenNodes = Object.freeze(nodes.map((n) => Object.freeze({ ...n })));
  const frozenEdges = Object.freeze(edges.map((e) => Object.freeze({ ...e })));
  return Object.freeze({
    nodes: frozenNodes,
    edges: frozenEdges,
  });
}

export function addGraphNode<T>(
  graph: Graph<T>,
  node: GraphNode<T>
): Graph<T> {
  const nextNodes = Object.freeze([...graph.nodes, Object.freeze({ ...node })]);
  return Object.freeze({
    nodes: nextNodes,
    edges: graph.edges,
  });
}

export function addGraphEdge<T>(
  graph: Graph<T>,
  edge: GraphEdge
): Graph<T> {
  const nextEdges = Object.freeze([...graph.edges, Object.freeze({ ...edge })]);
  return Object.freeze({
    nodes: graph.nodes,
    edges: nextEdges,
  });
}

export function buildAdjacencyList<T>(
  graph: Graph<T>
): Readonly<Map<string, readonly GraphEdge[]>> {
  const map = new Map<string, GraphEdge[]>();
  for (const node of graph.nodes) {
    map.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!map.has(edge.from)) {
      map.set(edge.from, []);
    }
    map.get(edge.from)!.push({ ...edge });
  }
  const frozenMap = new Map<string, readonly GraphEdge[]>();
  for (const [k, v] of map.entries()) {
    frozenMap.set(k, Object.freeze(v.map((e) => Object.freeze({ ...e }))));
  }
  return Object.freeze(frozenMap);
}

export function topologicalSort<T>(graph: Graph<T>): readonly string[] {
  const inDegree = new Map<string, number>();
  const adj = buildAdjacencyList(graph);

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(nodeId);
    }
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    result.push(curr);

    const neighbors = adj.get(curr) ?? [];
    for (const edge of neighbors) {
      const nextDeg = (inDegree.get(edge.to) ?? 0) - 1;
      inDegree.set(edge.to, nextDeg);
      if (nextDeg === 0) {
        queue.push(edge.to);
      }
    }
  }

  if (result.length !== graph.nodes.length) {
    throw new Error('Graph has a cycle, topological sort impossible.');
  }

  return Object.freeze(result);
}

export function bfsGraph<T>(
  graph: Graph<T>,
  startId: string,
  visitor: (node: GraphNode<T>) => void
): void {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacencyList(graph);
  const visited = new Set<string>();
  const queue: string[] = [startId];

  visited.add(startId);

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currNode = nodeMap.get(currId);
    if (currNode) {
      visitor(currNode);
    }
    const neighbors = adj.get(currId) ?? [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
}

export function dfsGraph<T>(
  graph: Graph<T>,
  startId: string,
  visitor: (node: GraphNode<T>) => void
): void {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacencyList(graph);
  const visited = new Set<string>();

  function search(currId: string): void {
    visited.add(currId);
    const currNode = nodeMap.get(currId);
    if (currNode) {
      visitor(currNode);
    }
    const neighbors = adj.get(currId) ?? [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        search(edge.to);
      }
    }
  }

  search(startId);
}

export function findShortestPath<T>(
  graph: Graph<T>,
  startId: string,
  endId: string
): readonly string[] {
  const adj = buildAdjacencyList(graph);
  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const queue: string[] = [startId];

  visited.add(startId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === endId) {
      const path: string[] = [];
      let step: string | undefined = endId;
      while (step) {
        path.unshift(step);
        step = parent.get(step);
      }
      return Object.freeze(path);
    }

    const neighbors = adj.get(curr) ?? [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        parent.set(edge.to, curr);
        queue.push(edge.to);
      }
    }
  }

  return Object.freeze([]);
}

export function detectGraphCycle<T>(graph: Graph<T>): boolean {
  const adj = buildAdjacencyList(graph);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adj.get(nodeId) ?? [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        if (hasCycle(edge.to)) {
          return true;
        }
      } else if (recursionStack.has(edge.to)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        return true;
      }
    }
  }

  return false;
}

export function filterGraph<T>(
  graph: Graph<T>,
  nodePredicate: (node: GraphNode<T>) => boolean
): Graph<T> {
  const retainedNodes = graph.nodes.filter(nodePredicate);
  const retainedNodeIds = new Set(retainedNodes.map((n) => n.id));
  const retainedEdges = graph.edges.filter(
    (e) => retainedNodeIds.has(e.from) && retainedNodeIds.has(e.to)
  );
  return createGraph(retainedNodes, retainedEdges);
}
