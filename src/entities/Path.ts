import * as THREE from 'three';
import { GridPosition, PathData, BuildingType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { sharedTextureLoader } from '../core/AssetLoader';

// --------------------------------------------------------------------------
// Shared material — world-UV geometry handles tiling, so no repeat needed.
// --------------------------------------------------------------------------
const pathTexture = sharedTextureLoader.load('/models/path.png');
pathTexture.wrapS = THREE.RepeatWrapping;
pathTexture.wrapT = THREE.RepeatWrapping;
pathTexture.colorSpace = THREE.SRGBColorSpace;

const sharedPathMaterial = new THREE.MeshStandardMaterial({
  map: pathTexture,
  roughness: 0.88,
  metalness: 0.04,
});

// --------------------------------------------------------------------------
// World-space UV builder
//
// Each tile's UV coordinates are derived from its world-space XZ position
// instead of local 0→1. This guarantees that the right edge of tile A and
// the left edge of tile B share the exact same UV value, producing seamless
// texture continuity across any path layout.
//
// We only inset corners that are truly exposed on the outside of the path
// network. Connected edges remain perfectly square so adjacent tiles keep
// their continuity.
// --------------------------------------------------------------------------
function buildWorldUVPlane(
  worldCenterX: number,
  worldCenterZ: number,
  exposedCorners?: {
    topLeft: boolean;
    topRight: boolean;
    bottomLeft: boolean;
    bottomRight: boolean;
  }
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, 3, 3);
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute;

  const h  = GRID_SIZE / 2;
  const cornerInset = GRID_SIZE * 0.1;

  for (let i = 0; i < posAttr.count; i++) {
    let x = posAttr.getX(i);
    let y = posAttr.getY(i);

    const isCornerX = Math.abs(Math.abs(x) - h) < 0.001;
    const isCornerY = Math.abs(Math.abs(y) - h) < 0.001;

    if (isCornerX && isCornerY) {
      const top = y > 0;
      const left = x < 0;
      const shouldInset =
        (top && left && exposedCorners?.topLeft) ||
        (top && !left && exposedCorners?.topRight) ||
        (!top && left && exposedCorners?.bottomLeft) ||
        (!top && !left && exposedCorners?.bottomRight);

      if (shouldInset) {
        x -= Math.sign(x) * cornerInset;
        y -= Math.sign(y) * cornerInset;
        posAttr.setXY(i, x, y);
      }
    }

    const worldX = worldCenterX + x;
    const worldZ = worldCenterZ + y;
    uvAttr.setXY(i, worldX / GRID_SIZE, worldZ / GRID_SIZE);
  }

  posAttr.needsUpdate = true;
  uvAttr.needsUpdate = true;
  geo.computeVertexNormals();

  return geo;
}

// --------------------------------------------------------------------------
// Path entity
// --------------------------------------------------------------------------
export class Path {
  public mesh: THREE.Group;
  public data: PathData;
  private planeMesh: THREE.Mesh;

  constructor(position: GridPosition, id: string) {
    this.data = {
      id,
      type: BuildingType.PATH,
      position,
      cost: 1,
      quality: 0,
      valueScore: 0,
      connections: [],
    };

    const worldPos = GridHelper.gridToWorld(position);

    // Full-size plane (100 % of GRID_SIZE) — no gap, no connector meshes needed.
    const geo = buildWorldUVPlane(worldPos.x, worldPos.z);
    this.planeMesh = new THREE.Mesh(geo, sharedPathMaterial);
    this.planeMesh.rotation.x = -Math.PI / 2;
    this.planeMesh.receiveShadow = true;

    this.mesh = new THREE.Group();
    this.mesh.add(this.planeMesh);
    // Raise slightly so path sits above the base ground plane.
    this.mesh.position.set(worldPos.x, 0.09, worldPos.z);
  }

  /** Connections tracked for pathfinding data; no visual connectors needed. */
  public updateConnections(connections: GridPosition[]): void {
    this.data.connections = connections;
    this.rebuildGeometry();
  }

  /**
   * Returns a world-space clone of this tile's geometry.
   * Used by BuildingSystem to merge all path tiles into one draw call.
   * Caller is responsible for disposing the returned geometry after merging.
   */
  public cloneTransformedGeometry(): THREE.BufferGeometry {
    // updateMatrixWorld works correctly even when the mesh is not in the scene
    // (parent is null → worldMatrix = localMatrix chain).
    this.mesh.updateMatrixWorld(true);
    const geo = this.planeMesh.geometry.clone();
    geo.applyMatrix4(this.planeMesh.matrixWorld);
    return geo;
  }

  private rebuildGeometry(): void {
    const worldPos = GridHelper.gridToWorld(this.data.position);
    const { x, z } = this.data.position;
    const hasNorth = this.data.connections.some(c => c.x === x && c.z === z - 1);
    const hasSouth = this.data.connections.some(c => c.x === x && c.z === z + 1);
    const hasWest = this.data.connections.some(c => c.x === x - 1 && c.z === z);
    const hasEast = this.data.connections.some(c => c.x === x + 1 && c.z === z);

    const nextGeometry = buildWorldUVPlane(worldPos.x, worldPos.z, {
      topLeft: !hasNorth && !hasWest,
      topRight: !hasNorth && !hasEast,
      bottomLeft: !hasSouth && !hasWest,
      bottomRight: !hasSouth && !hasEast,
    });

    this.planeMesh.geometry.dispose();
    this.planeMesh.geometry = nextGeometry;
  }

  public dispose(): void {
    this.planeMesh.geometry.dispose();
    // sharedPathMaterial is a module singleton — never dispose it here.
  }
}
