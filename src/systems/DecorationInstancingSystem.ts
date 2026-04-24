import * as THREE from 'three';
import { Decoration } from '../entities/Decoration';
import { loadBuildingGLTF } from '../core/AssetLoader';
import { DecorationType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';

interface DecorationInstanceEntry {
  id: string;
  decoration: Decoration;
}

interface DecorationVisualConfig {
  path: string;
  targetSize: number;
  colorLift?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
}

interface InstancedSubmeshTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  localMatrix: THREE.Matrix4;
}

interface DecorationBatch {
  entries: DecorationInstanceEntry[];
  templates: InstancedSubmeshTemplate[] | null;
  meshes: THREE.InstancedMesh[];
  loading: boolean;
}

const VISUAL_CONFIG: Partial<Record<DecorationType, DecorationVisualConfig>> = {
  [DecorationType.SPOOKY_TREE]: {
    path: '/models/tree.glb',
    targetSize: GRID_SIZE * 1.35,
  },
  [DecorationType.STONE]: {
    path: '/models/stone.glb',
    targetSize: GRID_SIZE * 0.9,
  },
  [DecorationType.PUMPKIN]: {
    path: '/models/pumpkin.glb',
    targetSize: GRID_SIZE * 0.7,
  },
  [DecorationType.SKELETON_DECORATION]: {
    path: '/models/skeleton_decoration.glb',
    targetSize: GRID_SIZE * 0.95,
  },
  [DecorationType.FRANKENSTEIN_DECORATION]: {
    path: '/models/frankenstein_decoration.glb',
    targetSize: GRID_SIZE * 1.0,
  },
  [DecorationType.LANTERN]: {
    path: '/models/lantern.glb',
    targetSize: GRID_SIZE * 1.0,
    colorLift: 1.18,
    emissiveColor: 0xffd38a,
    emissiveIntensity: 0.42,
    roughness: 0.6,
    metalness: 0.04,
  },
  [DecorationType.TRASH_CUBE]: {
    path: '/models/trash_cube.glb',
    targetSize: GRID_SIZE * 0.82,
  },
};

export class DecorationInstancingSystem {
  private readonly batches = new Map<DecorationType, DecorationBatch>();
  private readonly scene: THREE.Scene;
  private readonly instanceMatrix = new THREE.Matrix4();
  private readonly worldMatrix = new THREE.Matrix4();
  private readonly worldPosition = new THREE.Vector3();
  private readonly worldQuaternion = new THREE.Quaternion();
  private readonly worldScale = new THREE.Vector3(1, 1, 1);
  private version = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public supports(type: DecorationType): boolean {
    return VISUAL_CONFIG[type] !== undefined;
  }

  public add(decoration: Decoration): void {
    const type = decoration.data.decorationType;
    const config = VISUAL_CONFIG[type];
    if (!config) return;

    const batch = this.getBatch(type);
    batch.entries.push({ id: decoration.data.id, decoration });
    this.ensureTemplates(type, config, batch);
    this.rebuild(type);
  }

  public remove(decoration: Decoration): void {
    const type = decoration.data.decorationType;
    const batch = this.batches.get(type);
    if (!batch) return;

    const index = batch.entries.findIndex(entry => entry.id === decoration.data.id);
    if (index === -1) return;
    batch.entries.splice(index, 1);
    this.rebuild(type);
  }

  public update(decoration: Decoration): void {
    const type = decoration.data.decorationType;
    if (!this.batches.has(type)) return;
    this.rebuild(type);
  }

  public clear(): void {
    this.version++;
    this.batches.forEach(batch => {
      this.removeMeshes(batch);
      batch.entries.length = 0;
    });
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

  private getBatch(type: DecorationType): DecorationBatch {
    let batch = this.batches.get(type);
    if (!batch) {
      batch = {
        entries: [],
        templates: null,
        meshes: [],
        loading: false,
      };
      this.batches.set(type, batch);
    }
    return batch;
  }

  private ensureTemplates(type: DecorationType, config: DecorationVisualConfig, batch: DecorationBatch): void {
    if (batch.templates || batch.loading) return;
    batch.loading = true;
    const loadVersion = this.version;

    loadBuildingGLTF(config.path, (model) => {
      if (this.version !== loadVersion || this.batches.get(type) !== batch) return;
      batch.templates = this.createTemplates(model, config);
      batch.loading = false;
      this.rebuild(type);
    }, { cloneMaterials: false });
  }

  private createTemplates(model: THREE.Group, config: DecorationVisualConfig): InstancedSubmeshTemplate[] {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
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
      const material = this.cloneAndTuneMaterial(child.material, config);
      child.castShadow = false;
      child.receiveShadow = false;
      templates.push({
        geometry: child.geometry,
        material,
        localMatrix: child.matrixWorld.clone(),
      });
    });
    return templates;
  }

  private cloneAndTuneMaterial(
    source: THREE.Material | THREE.Material[],
    config: DecorationVisualConfig
  ): THREE.Material | THREE.Material[] {
    const cloneOne = (material: THREE.Material): THREE.Material => {
      const clone = material.clone();
      if (clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshPhysicalMaterial) {
        clone.side = THREE.FrontSide;
        if (config.colorLift) clone.color.multiplyScalar(config.colorLift);
        if (config.emissiveColor !== undefined) clone.emissive.setHex(config.emissiveColor);
        if (config.emissiveIntensity !== undefined) clone.emissiveIntensity = config.emissiveIntensity;
        if (config.roughness !== undefined) clone.roughness = config.roughness;
        if (config.metalness !== undefined) clone.metalness = config.metalness;
        clone.needsUpdate = true;
      }
      return clone;
    };

    return Array.isArray(source) ? source.map(cloneOne) : cloneOne(source);
  }

  private rebuild(type: DecorationType): void {
    const batch = this.batches.get(type);
    if (!batch || !batch.templates) return;

    this.removeMeshes(batch);
    if (batch.entries.length === 0) return;

    for (const template of batch.templates) {
      const mesh = new THREE.InstancedMesh(template.geometry, template.material, batch.entries.length);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;

      batch.entries.forEach((entry, index) => {
        const worldPos = GridHelper.gridToWorld(entry.decoration.data.position);
        this.worldPosition.set(worldPos.x, 0, worldPos.z);
        this.worldQuaternion.setFromEuler(entry.decoration.mesh.rotation);
        this.worldMatrix.compose(this.worldPosition, this.worldQuaternion, this.worldScale);
        this.instanceMatrix.multiplyMatrices(this.worldMatrix, template.localMatrix);
        mesh.setMatrixAt(index, this.instanceMatrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      batch.meshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  private removeMeshes(batch: DecorationBatch): void {
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
