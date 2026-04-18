import { GridPosition } from '../types';
import { GridHelper } from '../utils/GridHelper';
import { MinHeap } from '../utils/MinHeap';

interface PathNode {
  position: GridPosition;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathfindingSystem {
  private readonly pathGrid: Set<string> = new Set();
  private pathPositions: GridPosition[] = [];

  /** Cached A* results; invalidated whenever the walkable grid changes. */
  private readonly pathCache: Map<string, GridPosition[]> = new Map();

  public registerPath(position: GridPosition): void {
    const key = GridHelper.getGridKey(position);
    if (!this.pathGrid.has(key)) {
      this.pathGrid.add(key);
      this.pathPositions.push(position);
      this.pathCache.clear();
    }
  }

  public unregisterPath(position: GridPosition): void {
    const key = GridHelper.getGridKey(position);
    if (this.pathGrid.has(key)) {
      this.pathGrid.delete(key);
      this.pathPositions = this.pathPositions.filter(
        p => p.x !== position.x || p.z !== position.z
      );
      this.pathCache.clear();
    }
  }

  public hasPath(position: GridPosition): boolean {
    return this.pathGrid.has(GridHelper.getGridKey(position));
  }

  public findPath(start: GridPosition, goal: GridPosition): GridPosition[] {
    if (!this.hasPath(start) || !this.hasPath(goal)) return [];

    const cacheKey = `${start.x},${start.z}|${goal.x},${goal.z}`;
    const cached = this.pathCache.get(cacheKey);
    if (cached) return cached;

    const result = this.astar(start, goal);
    this.pathCache.set(cacheKey, result);
    return result;
  }

  private astar(start: GridPosition, goal: GridPosition): GridPosition[] {
    const open = new MinHeap<PathNode>(node => node.f);
    const openMap = new Map<string, PathNode>();
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      position: start,
      g: 0,
      h: GridHelper.getDistance(start, goal),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.h;
    open.push(startNode);
    openMap.set(GridHelper.getGridKey(start), startNode);

    while (open.size > 0) {
      const current = open.pop();
      const currentKey = GridHelper.getGridKey(current.position);
      openMap.delete(currentKey);

      if (GridHelper.gridPositionEquals(current.position, goal)) {
        return this.reconstructPath(current);
      }

      closedSet.add(currentKey);

      for (const neighborPos of GridHelper.getAdjacentPositions(current.position)) {
        if (!this.hasPath(neighborPos)) continue;

        const neighborKey = GridHelper.getGridKey(neighborPos);
        if (closedSet.has(neighborKey)) continue;

        const g = current.g + 1;
        const existing = openMap.get(neighborKey);

        if (existing) {
          if (g < existing.g) {
            existing.g = g;
            existing.f = g + existing.h;
            existing.parent = current;
            // Re-heapify by re-inserting; duplicate is naturally skipped via closedSet
            open.push(existing);
          }
        } else {
          const h = GridHelper.getDistance(neighborPos, goal);
          const neighbor: PathNode = { position: neighborPos, g, h, f: g + h, parent: current };
          open.push(neighbor);
          openMap.set(neighborKey, neighbor);
        }
      }
    }

    return [];
  }

  private reconstructPath(node: PathNode): GridPosition[] {
    const path: GridPosition[] = [];
    let current: PathNode | null = node;
    while (current !== null) {
      path.unshift(current.position);
      current = current.parent;
    }
    return path;
  }

  public getRandomPathPosition(): GridPosition | null {
    if (this.pathPositions.length === 0) return null;
    return this.pathPositions[Math.floor(Math.random() * this.pathPositions.length)];
  }

  public clear(): void {
    this.pathGrid.clear();
    this.pathPositions = [];
    this.pathCache.clear();
  }
}
