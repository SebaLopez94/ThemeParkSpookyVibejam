import { GridPosition } from '../types';
import { GridHelper } from '../utils/GridHelper';

interface PathNode {
  position: GridPosition;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class PathfindingSystem {
  private pathGrid: Set<string> = new Set();
  private pathPositions: GridPosition[] = [];

  public registerPath(position: GridPosition): void {
    const key = GridHelper.getGridKey(position);
    if (!this.pathGrid.has(key)) {
      this.pathGrid.add(key);
      this.pathPositions.push(position);
    }
  }

  public unregisterPath(position: GridPosition): void {
    const key = GridHelper.getGridKey(position);
    if (this.pathGrid.has(key)) {
      this.pathGrid.delete(key);
      this.pathPositions = this.pathPositions.filter(
        p => p.x !== position.x || p.z !== position.z
      );
    }
  }

  public hasPath(position: GridPosition): boolean {
    return this.pathGrid.has(GridHelper.getGridKey(position));
  }

  public findPath(start: GridPosition, goal: GridPosition): GridPosition[] {
    if (!this.hasPath(start) || !this.hasPath(goal)) {
      return [];
    }

    const openList: PathNode[] = [];
    const openMap: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();

    const startNode: PathNode = {
      position: start,
      g: 0,
      h: GridHelper.getDistance(start, goal),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);
    openMap.set(GridHelper.getGridKey(start), startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;
      const currentKey = GridHelper.getGridKey(current.position);
      openMap.delete(currentKey);

      if (GridHelper.gridPositionEquals(current.position, goal)) {
        return this.reconstructPath(current);
      }

      closedSet.add(currentKey);

      const neighbors = GridHelper.getAdjacentPositions(current.position);

      for (const neighborPos of neighbors) {
        if (!this.hasPath(neighborPos)) continue;

        const neighborKey = GridHelper.getGridKey(neighborPos);
        if (closedSet.has(neighborKey)) continue;

        const g = current.g + 1;
        const h = GridHelper.getDistance(neighborPos, goal);
        const f = g + h;

        const existingNode = openMap.get(neighborKey);
        if (existingNode) {
          if (g < existingNode.g) {
            existingNode.g = g;
            existingNode.f = f;
            existingNode.parent = current;
          }
        } else {
          const neighborNode: PathNode = { position: neighborPos, g, h, f, parent: current };
          openList.push(neighborNode);
          openMap.set(neighborKey, neighborNode);
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
  }
}
