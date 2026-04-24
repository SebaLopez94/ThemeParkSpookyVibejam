import * as THREE from 'three';
import { BuildingType, DecorationData, DecorationType, GridPosition } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';
import { loadBuildingGLTF } from '../core/AssetLoader';
import { lanternPool } from '../utils/LanternPool';

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
  [DecorationType.SKELETON_DECORATION]: [3, 5],
  [DecorationType.FRANKENSTEIN_DECORATION]: [3, 6],
  [DecorationType.LANTERN]: [3, 5],
  [DecorationType.TRASH_CUBE]: [2, 2],
};

const HYGIENE_SUPPORT: Partial<Record<DecorationType, [number, number]>> = {
  [DecorationType.TRASH_CUBE]: [4, 16],
};

export class Decoration {
  public mesh: THREE.Group;
  public data: DecorationData;
  private pooledLight: THREE.PointLight | null = null;

  constructor(position: GridPosition, decorationType: DecorationType, id: string) {
    const config = getBuildingCatalogItem(decorationType);
    const [appealRadius, appealBonus] = APPEAL[decorationType];
    const hygieneSupport = HYGIENE_SUPPORT[decorationType];

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
      hygieneRadius: hygieneSupport?.[0],
      hygieneBonus: hygieneSupport?.[1],
      unlockRequirement: config.unlockRequirement
    };

    this.mesh = new THREE.Group();
    this.createMesh(decorationType);

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0, worldPos.z);

    // Claim a pooled lantern light (world coords, no scene add = no shader recompile)
    if (decorationType === DecorationType.LANTERN) {
      this.pooledLight = lanternPool.claim(worldPos.x + 0.42, 1.40, worldPos.z + 0.50);
    }
  }

  private loadGlb(
    path: string,
    targetSize: number,
    options?: {
      colorLift?: number;
      emissiveColor?: number;
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
    }
  ): void {
    loadBuildingGLTF(path, (model) => {
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

          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => {
            if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshPhysicalMaterial)) return;

            if (options?.colorLift) {
              material.color.multiplyScalar(options.colorLift);
            }
            if (options?.emissiveColor !== undefined) {
              material.emissive.setHex(options.emissiveColor);
            }
            if (options?.emissiveIntensity !== undefined) {
              material.emissiveIntensity = options.emissiveIntensity;
            }
            if (options?.roughness !== undefined) {
              material.roughness = options.roughness;
            }
            if (options?.metalness !== undefined) {
              material.metalness = options.metalness;
            }
            material.needsUpdate = true;
          });
        }
      });

      this.mesh.add(model);
    });
  }

  private createLantern(): void {
    this.loadGlb('/models/lantern.glb', GRID_SIZE * 1.0, {
      colorLift: 1.18,
      emissiveColor: 0xffd38a,
      emissiveIntensity: 0.42,
      roughness: 0.6,
      metalness: 0.04,
    });
    // PointLight is claimed from the pool in the constructor after world position
    // is known — avoids adding lights to the scene at placement time (no shader recompile).
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

      case DecorationType.SKELETON_DECORATION:
        this.loadGlb('/models/skeleton_decoration.glb', GRID_SIZE * 0.95);
        break;

      case DecorationType.FRANKENSTEIN_DECORATION:
        this.loadGlb('/models/frankenstein_decoration.glb', GRID_SIZE * 1.0);
        break;

      case DecorationType.LANTERN:
        this.createLantern();
        break;

      case DecorationType.TRASH_CUBE:
        this.loadGlb('/models/trash_cube.glb', GRID_SIZE * 0.82);
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
    // Return pooled lantern light before disposing mesh resources
    if (this.pooledLight) {
      lanternPool.release(this.pooledLight);
      this.pooledLight = null;
    }

    // GLB geometry is shared via loadBuildingGLTF cache — must NOT dispose.
    // Procedural jack-o-lantern geometry/materials are shared module-level — must NOT dispose.
    // GLB clones have independent material copies (material.clone()) — safe to dispose.
    const sharedGeos = new Set<THREE.BufferGeometry>(Object.values(sharedPumpkinGeo));
    const sharedMats = new Set<THREE.Material>(Object.values(sharedPumpkinMat));
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (sharedGeos.has(child.geometry)) return; // skip procedural jack-o-lantern
      const mats = Array.isArray(child.material) ? child.material : [child.material as THREE.Material];
      mats.forEach(m => { if (!sharedMats.has(m)) m.dispose(); });
    });
    this.mesh.clear();
  }
}
