import { GridPosition, WorldPosition } from '../types';

export const GRID_SIZE = 2;
export const GRID_WIDTH = 50;
export const GRID_HEIGHT = 50;

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

  static getGridKey(pos: GridPosition): string {
    return `${pos.x},${pos.z}`;
  }

  static getAdjacentPositions(pos: GridPosition): GridPosition[] {
    return [
      { x: pos.x + 1, z: pos.z },
      { x: pos.x - 1, z: pos.z },
      { x: pos.x, z: pos.z + 1 },
      { x: pos.x, z: pos.z - 1 }
    ].filter(p => this.isValidGridPosition(p));
  }

  static getDistance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }
}
