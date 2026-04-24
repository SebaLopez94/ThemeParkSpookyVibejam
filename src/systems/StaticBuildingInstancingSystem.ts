import * as THREE from 'three';
import { loadBuildingGLTF } from '../core/AssetLoader';
import { Service } from '../entities/Service';
import { Shop } from '../entities/Shop';
import { PlaceableBuildingKind, ServiceType, ShopType } from '../types';
import { GRID_SIZE } from '../utils/GridHelper';

type InstancedEntity = Shop | Service;

interface StaticBuildingVisualConfig {
  path: string;
  targetSize: number;
  maxDimension: 'xz' | 'xyz';
  materialProfile: 'facility';
}

interface StaticInstanceEntry {
  id: string;
  entity: InstancedEntity;
}

interface InstancedSubmeshTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  localMatrix: THREE.Matrix4;
}

interface StaticBatch {
  entries: StaticInstanceEntry[];
  templates: InstancedSubmeshTemplate[] | null;
  meshes: THREE.InstancedMesh[];
  loading: boolean;
}

const STATIC_CONFIG: Partial<Record<PlaceableBuildingKind, StaticBuildingVisualConfig>> = {
  [ShopType.FOOD_STALL]: {
    path: '/models/food.glb',
    targetSize: GRID_SIZE * 0.9,
    maxDimension: 'xz',
    materialProfile: 'facility',
  },
  [ShopType.DRINK_STAND]: {
    path: '/models/drinks.glb',
    targetSize: GRID_SIZE * 0.9 * 1.12,
    maxDimension: 'xz',
    materialProfile: 'facility',
  },
  [ShopType.GIFT_SHOP]: {
    path: '/models/gift.glb',
    targetSize: GRID_SIZE * 0.9 * 1.14,
    maxDimension: 'xz',
    materialProfile: 'facility',
  },
  [ServiceType.RESTROOM]: {
    path: '/models/wc.glb',
    targetSize: GRID_SIZE * 0.9,
    maxDimension: 'xz',
    materialProfile: 'facility',
  },
};

export class StaticBuildingInstancingSystem {
  private readonly scene: THREE.Scene;
  private readonly batches = new Map<PlaceableBuildingKind, StaticBatch>();
  private readonly instanceMatrix = new THREE.Matrix4();
  private readonly worldPosition = new THREE.Vector3();
  private readonly worldQuaternion = new THREE.Quaternion();
  private readonly worldScale = new THREE.Vector3(1, 1, 1);
  private version = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public supports(kind: PlaceableBuildingKind): boolean {
    return STATIC_CONFIG[kind] !== undefined;
  }

  public add(entity: InstancedEntity): void {
    const kind = this.getKind(entity);
    const config = STATIC_CONFIG[kind];
    if (!config) return;

    const batch = this.getBatch(kind);
    batch.entries.push({ id: entity.data.id, entity });
    this.ensureTemplates(kind, config, batch);
    this.rebuild(kind);
  }

  public remove(entity: InstancedEntity): void {
    const kind = this.getKind(entity);
    const batch = this.batches.get(kind);
    if (!batch) return;

    const index = batch.entries.findIndex(entry => entry.id === entity.data.id);
    if (index === -1) return;
    batch.entries.splice(index, 1);
    this.rebuild(kind);
  }

  public update(entity: InstancedEntity): void {
    const kind = this.getKind(entity);
    if (!this.batches.has(kind)) return;
    this.rebuild(kind);
  }

  public dispose(): void {
    this.version++;
    this.batches.forEach(batch => {
      this.removeMeshes(batch);
      batch.templates?.forEach(template => this.disposeMaterial(template.material));
      batch.entries.length = 0;
    });
    this.batches.clear();
  }

  private getKind(entity: InstancedEntity): PlaceableBuildingKind {
    return entity instanceof Shop
      ? entity.data.shopType
      : entity.data.serviceType;
  }

  private getBatch(kind: PlaceableBuildingKind): StaticBatch {
    let batch = this.batches.get(kind);
    if (!batch) {
      batch = {
        entries: [],
        templates: null,
        meshes: [],
        loading: false,
      };
      this.batches.set(kind, batch);
    }
    return batch;
  }

  private ensureTemplates(
    kind: PlaceableBuildingKind,
    config: StaticBuildingVisualConfig,
    batch: StaticBatch
  ): void {
    if (batch.templates || batch.loading) return;
    batch.loading = true;
    const loadVersion = this.version;

    loadBuildingGLTF(config.path, (model) => {
      if (this.version !== loadVersion || this.batches.get(kind) !== batch) return;
      batch.templates = this.createTemplates(model, config);
      batch.loading = false;
      this.rebuild(kind);
    }, { cloneMaterials: false });
  }

  private createTemplates(model: THREE.Group, config: StaticBuildingVisualConfig): InstancedSubmeshTemplate[] {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = config.maxDimension === 'xz'
      ? Math.max(size.x, size.z)
      : Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? config.targetSize / maxDim : 1;
    model.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;
    model.updateMatrixWorld(true);

    const templates: InstancedSubmeshTemplate[] = [];
    model.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      templates.push({
        geometry: child.geometry,
        material: this.cloneAndTuneMaterial(child.material, config),
        localMatrix: child.matrixWorld.clone(),
      });
    });
    return templates;
  }

  private cloneAndTuneMaterial(
    source: THREE.Material | THREE.Material[],
    config: StaticBuildingVisualConfig
  ): THREE.Material | THREE.Material[] {
    const hsl = { h: 0, s: 0, l: 0 };
    const cloneOne = (material: THREE.Material): THREE.Material => {
      const clone = material.clone();
      if (
        config.materialProfile === 'facility' &&
        (clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshPhysicalMaterial)
      ) {
        clone.side = THREE.FrontSide;
        clone.color.getHSL(hsl);
        clone.color.setHSL(hsl.h, Math.min(hsl.s * 1.08, 1.0), Math.min(hsl.l + 0.05, 0.78));
        clone.roughness = Math.min((clone.roughness ?? 0.5) + 0.03, 1.0);
        clone.emissiveMap = null;
        clone.emissive.setHex(0x000000);
        clone.emissiveIntensity = 0;
        clone.envMapIntensity = 0.42;
        clone.needsUpdate = true;
      }
      return clone;
    };

    return Array.isArray(source) ? source.map(cloneOne) : cloneOne(source);
  }

  private rebuild(kind: PlaceableBuildingKind): void {
    const batch = this.batches.get(kind);
    if (!batch || !batch.templates) return;

    this.removeMeshes(batch);
    if (batch.entries.length === 0) return;

    for (const template of batch.templates) {
      const mesh = new THREE.InstancedMesh(template.geometry, template.material, batch.entries.length);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;

      batch.entries.forEach((entry, index) => {
        this.worldPosition.copy(entry.entity.mesh.position);
        this.worldQuaternion.setFromEuler(entry.entity.mesh.rotation);
        this.instanceMatrix.compose(this.worldPosition, this.worldQuaternion, this.worldScale);
        this.instanceMatrix.multiply(template.localMatrix);
        mesh.setMatrixAt(index, this.instanceMatrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      batch.meshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  private removeMeshes(batch: StaticBatch): void {
    for (const mesh of batch.meshes) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
    batch.meshes.length = 0;
  }

  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach(entry => entry.dispose());
      return;
    }
    material.dispose();
  }
}
