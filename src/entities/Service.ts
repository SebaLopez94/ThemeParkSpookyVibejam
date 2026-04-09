import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GridPosition, ServiceData, ServiceType, BuildingType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';

const gltfLoader = new GLTFLoader();

export class Service {
  public mesh: THREE.Group;
  public data: ServiceData;

  constructor(position: GridPosition, serviceType: ServiceType, id: string, accessCell: GridPosition) {
    const config = getBuildingCatalogItem(serviceType);

    this.data = {
      id,
      type: BuildingType.SERVICE,
      position,
      serviceType,
      cost: config.cost,
      price: 2,
      quality: config.quality,
      valueScore: config.valueScore,
      satisfactionEffects: { hygiene: 40 },
      accessCell,
      unlockRequirement: config.unlockRequirement
    };

    this.mesh = new THREE.Group();
    this.loadGlb('/models/wc.glb');

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0, worldPos.z);
  }

  private loadGlb(path: string): void {
    gltfLoader.load(path, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 0.9;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.mesh.add(model);
    });
  }

  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
