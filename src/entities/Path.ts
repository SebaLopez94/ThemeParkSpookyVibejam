import * as THREE from 'three';
import { GridPosition, PathData, BuildingType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';

const pathTexture = new THREE.TextureLoader().load('/models/path.png');
const sharedPathGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.95, 0.1, GRID_SIZE * 0.95);
const sharedPathMaterial = new THREE.MeshStandardMaterial({
  map: pathTexture,
  roughness: 0.8,
  metalness: 0.1
});

export class Path {
  public mesh: THREE.Mesh;
  public data: PathData;

  constructor(position: GridPosition, id: string) {
    this.data = {
      id,
      type: BuildingType.PATH,
      position,
      cost: 1,
      quality: 0,
      valueScore: 0,
      connections: []
    };

    this.mesh = new THREE.Mesh(sharedPathGeometry, sharedPathMaterial);

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0.05, worldPos.z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  public updateConnections(connections: GridPosition[]): void {
    this.data.connections = connections;
  }

  public dispose(): void {
    // Geometry and material are shared singletons — do not dispose them here
  }
}
