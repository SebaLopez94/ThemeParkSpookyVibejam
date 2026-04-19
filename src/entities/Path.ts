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
// PlaneGeometry(2,2) after rotateX(-PI/2) places 4 vertices at:
//   Vtx 0 (TL): (-1, 0, -1)   Vtx 1 (TR): (+1, 0, -1)
//   Vtx 2 (BL): (-1, 0, +1)   Vtx 3 (BR): (+1, 0, +1)
//
// World position = group.position.xz + local vertex xz.
// --------------------------------------------------------------------------
function buildWorldUVPlane(worldCenterX: number, worldCenterZ: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute;

  const h  = GRID_SIZE / 2;
  const uL = (worldCenterX - h) / GRID_SIZE; // left  edge
  const uR = (worldCenterX + h) / GRID_SIZE; // right edge
  const vN = (worldCenterZ - h) / GRID_SIZE; // north edge (-Z)
  const vS = (worldCenterZ + h) / GRID_SIZE; // south edge (+Z)

  uvAttr.setXY(0, uL, vN); // TL
  uvAttr.setXY(1, uR, vN); // TR
  uvAttr.setXY(2, uL, vS); // BL
  uvAttr.setXY(3, uR, vS); // BR
  uvAttr.needsUpdate = true;

  return geo;
}

// --------------------------------------------------------------------------
// Path entity
// --------------------------------------------------------------------------
export class Path {
  public mesh: THREE.Group;
  public data: PathData;

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
    const planeMesh = new THREE.Mesh(geo, sharedPathMaterial);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.receiveShadow = true;

    this.mesh = new THREE.Group();
    this.mesh.add(planeMesh);
    // Raise slightly so path sits above the base ground plane.
    this.mesh.position.set(worldPos.x, 0.09, worldPos.z);
  }

  /** Connections tracked for pathfinding data; no visual connectors needed. */
  public updateConnections(connections: GridPosition[]): void {
    this.data.connections = connections;
  }

  public dispose(): void {
    const mesh = this.mesh.children[0] as THREE.Mesh | undefined;
    if (mesh) mesh.geometry.dispose();
    // sharedPathMaterial is a module singleton — never dispose it here.
  }
}
