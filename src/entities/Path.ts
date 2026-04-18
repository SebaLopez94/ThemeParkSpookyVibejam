import * as THREE from 'three';
import { GridPosition, PathData, BuildingType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';

const pathTexture = new THREE.TextureLoader().load('/models/path.png');
pathTexture.wrapS = THREE.RepeatWrapping;
pathTexture.wrapT = THREE.RepeatWrapping;
pathTexture.repeat.set(1.15, 1.15);

const sharedCenterGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.98, 0.08, GRID_SIZE * 0.98);
const sharedNorthSouthGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.52, 0.08, GRID_SIZE * 0.26);
const sharedEastWestGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.26, 0.08, GRID_SIZE * 0.52);
const sharedPathMaterial = new THREE.MeshStandardMaterial({
  map: pathTexture,
  roughness: 0.8,
  metalness: 0.1
});

type ConnectionDirection = 'north' | 'south' | 'east' | 'west';

const DIRECTION_OFFSETS: Record<ConnectionDirection, { x: number; z: number }> = {
  north: { x: 0, z: -GRID_SIZE * 0.37 },
  south: { x: 0, z: GRID_SIZE * 0.37 },
  east: { x: GRID_SIZE * 0.37, z: 0 },
  west: { x: -GRID_SIZE * 0.37, z: 0 }
};

export class Path {
  public mesh: THREE.Group;
  public data: PathData;
  private readonly connectorMeshes: Record<ConnectionDirection, THREE.Mesh>;

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

    this.mesh = new THREE.Group();

    const centerMesh = new THREE.Mesh(sharedCenterGeometry, sharedPathMaterial);
    centerMesh.castShadow = true;
    centerMesh.receiveShadow = true;
    this.mesh.add(centerMesh);

    this.connectorMeshes = {
      north: new THREE.Mesh(sharedNorthSouthGeometry, sharedPathMaterial),
      south: new THREE.Mesh(sharedNorthSouthGeometry, sharedPathMaterial),
      east: new THREE.Mesh(sharedEastWestGeometry, sharedPathMaterial),
      west: new THREE.Mesh(sharedEastWestGeometry, sharedPathMaterial),
    };

    (Object.entries(this.connectorMeshes) as Array<[ConnectionDirection, THREE.Mesh]>).forEach(([direction, mesh]) => {
      const offset = DIRECTION_OFFSETS[direction];
      mesh.position.set(offset.x, 0, offset.z);
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.mesh.add(mesh);
    });

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0.05, worldPos.z);
  }

  public updateConnections(connections: GridPosition[]): void {
    this.data.connections = connections;
    const activeDirections = new Set(connections.map(connection => this.getConnectionDirection(connection)));

    (Object.entries(this.connectorMeshes) as Array<[ConnectionDirection, THREE.Mesh]>).forEach(([direction, mesh]) => {
      mesh.visible = activeDirections.has(direction);
    });
  }

  public dispose(): void {
    // Geometry and material are shared singletons - do not dispose them here
  }

  private getConnectionDirection(connection: GridPosition): ConnectionDirection {
    if (connection.x > this.data.position.x) return 'east';
    if (connection.x < this.data.position.x) return 'west';
    if (connection.z > this.data.position.z) return 'south';
    return 'north';
  }
}
