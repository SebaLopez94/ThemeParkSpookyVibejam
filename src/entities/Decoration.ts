import * as THREE from 'three';
import { BuildingType, DecorationData, DecorationType, GridPosition } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';
import { sharedGLTFLoader } from '../core/AssetLoader';

// Shared fallback geometry for jack-o-lantern (procedural, still used)
const sharedPumpkinGeo = {
  body: new THREE.SphereGeometry(0.45, 12, 12),
  stem: new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8),
};
const sharedPumpkinMat = {
  body: new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x6b2d00, emissiveIntensity: 0.35 }),
  stem: new THREE.MeshStandardMaterial({ color: 0x365314 }),
};

const APPEAL: Record<DecorationType, [number, number]> = {
  [DecorationType.SPOOKY_TREE]:   [4, 5],
  [DecorationType.JACK_O_LANTERN]:[3, 7],
  [DecorationType.STONE]:         [3, 4],
  [DecorationType.PUMPKIN]:       [3, 6],
};

export class Decoration {
  public mesh: THREE.Group;
  public data: DecorationData;

  constructor(position: GridPosition, decorationType: DecorationType, id: string) {
    const config = getBuildingCatalogItem(decorationType);
    const [appealRadius, appealBonus] = APPEAL[decorationType];

    this.data = {
      id,
      type: BuildingType.DECORATION,
      position,
      decorationType,
      cost: config.cost,
      quality: config.quality,
      valueScore: config.valueScore,
      appealRadius,
      appealBonus,
      unlockRequirement: config.unlockRequirement
    };

    this.mesh = new THREE.Group();
    this.createMesh(decorationType);

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0, worldPos.z);
  }

  private loadGlb(path: string, targetSize: number): void {
    sharedGLTFLoader.load(path, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
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

  private createMesh(type: DecorationType): void {
    switch (type) {
      case DecorationType.SPOOKY_TREE:
        // tree.glb — scale to fit within one grid cell height
        this.loadGlb('/models/tree.glb', GRID_SIZE * 1.35);
        break;

      case DecorationType.STONE:
        this.loadGlb('/models/stone.glb', GRID_SIZE * 0.9);
        break;

      case DecorationType.PUMPKIN:
        this.loadGlb('/models/pumpkin.glb', GRID_SIZE * 0.7);
        break;

      case DecorationType.JACK_O_LANTERN: {
        // Procedural fallback — glowing carved pumpkin
        const pumpkin = new THREE.Mesh(sharedPumpkinGeo.body, sharedPumpkinMat.body);
        pumpkin.scale.y = 0.8;
        pumpkin.position.y = 0.38;
        pumpkin.castShadow = true;
        this.mesh.add(pumpkin);

        const stem = new THREE.Mesh(sharedPumpkinGeo.stem, sharedPumpkinMat.stem);
        stem.position.y = 0.78;
        this.mesh.add(stem);
        break;
      }
    }
  }

  public dispose(): void {
    // GLB-loaded children have unique resources — dispose them.
    // Procedural shared resources (jack-o-lantern) must NOT be disposed.
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const isSharedGeo = (Object.values(sharedPumpkinGeo) as THREE.BufferGeometry[]).includes(child.geometry);
        if (!isSharedGeo) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    this.mesh.clear();
  }
}
