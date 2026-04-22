import { GridPosition, WorldPosition } from '../types';

export const GRID_SIZE = 2;
export const GRID_WIDTH = 25;
export const GRID_HEIGHT = 25;

// Offset so grid center maps to world origin
const GRID_OFFSET_X = -(GRID_WIDTH * GRID_SIZE) / 2;
const GRID_OFFSET_Z = -(GRID_HEIGHT * GRID_SIZE) / 2;

export class GridHelper {
  static worldToGrid(worldPos: WorldPosition): GridPosition {
    return {
      x: Math.floor((worldPos.x - GRID_OFFSET_X) / GRID_SIZE),
      z: Math.floor((worldPos.z - GRID_OFFSET_Z) / GRID_SIZE)
    };
  }

  static gridToWorld(gridPos: GridPosition): WorldPosition {
    return {
      x: gridPos.x * GRID_SIZE + GRID_SIZE / 2 + GRID_OFFSET_X,
      y: 0,
      z: gridPos.z * GRID_SIZE + GRID_SIZE / 2 + GRID_OFFSET_Z
    };
  }

  static isValidGridPosition(pos: GridPosition): boolean {
    return pos.x >= 0 && pos.x < GRID_WIDTH && pos.z >= 0 && pos.z < GRID_HEIGHT;
  }

  static gridPositionEquals(a: GridPosition, b: GridPosition): boolean {
    return a.x === b.x && a.z === b.z;
  }

  /**
   * Encodes a grid position as a unique integer: x * GRID_HEIGHT + z.
   * Returns a plain number — V8 stores integer Map/Set keys as SMIs (no string
   * allocation, ~2–3× faster lookup than template-literal string keys).
   * Safe for any grid up to GRID_WIDTH × GRID_HEIGHT = 25 × 25.
   */
  static getGridKey(pos: GridPosition): number {
    return pos.x * GRID_HEIGHT + pos.z;
  }

  static getAdjacentPositions(pos: GridPosition): GridPosition[] {
    return [
      { x: pos.x + 1, z: pos.z },
      { x: pos.x - 1, z: pos.z },
      { x: pos.x, z: pos.z + 1 },
      { x: pos.x, z: pos.z - 1 }
    ].filter(p => this.isValidGridPosition(p));
  }

  /**
   * Zero-allocation variant — calls `fn` for each valid adjacent cell.
   * Eliminates the intermediate GridPosition[] + filter() that getAdjacentPositions creates.
   * Safe for synchronous use (JS single-threaded); do NOT call forEachAdjacent recursively inside `fn`.
   */
  static forEachAdjacent(pos: GridPosition, fn: (adj: GridPosition) => void): void {
    const { x, z } = pos;
    if (x + 1 < GRID_WIDTH)  fn({ x: x + 1, z });
    if (x - 1 >= 0)          fn({ x: x - 1, z });
    if (z + 1 < GRID_HEIGHT) fn({ x, z: z + 1 });
    if (z - 1 >= 0)          fn({ x, z: z - 1 });
  }

  static getDistance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }
}
