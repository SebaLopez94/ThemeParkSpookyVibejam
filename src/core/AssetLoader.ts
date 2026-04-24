import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Single shared GLTFLoader for the whole application.
 * Using one instance ensures the internal parse cache is shared, so the same
 * GLB is never decoded twice (critical when multiple entities load the same
 * model, e.g. 30 Visitors all loading kid1.glb).
 * DRACOLoader is attached so Draco-compressed GLBs are decoded automatically.
 *
 * gameLoadingManager tracks every GLTF load so the game can fire an
 * "assetsLoaded" event when the initial scene + building models are ready.
 */
export const gameLoadingManager = new THREE.LoadingManager();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.preload();

export const sharedGLTFLoader = new GLTFLoader(gameLoadingManager);
sharedGLTFLoader.setDRACOLoader(dracoLoader);

export const sharedTextureLoader = new THREE.TextureLoader(gameLoadingManager);
export const sharedAudioLoader = new THREE.AudioLoader(gameLoadingManager);

// ---------------------------------------------------------------------------
// Building GLTF cache
// ---------------------------------------------------------------------------
// Session-level cache for parsed building model scenes. Stores the raw
// (pre-mutation) gltf.scene so each placement gets a fresh clone. Caching
// prevents re-uploading the same textures to GPU for every placed building —
// the #1 cause of mobile OOM kills when placing many buildings of the same type.
//
// Callers use loadBuildingGLTF() instead of sharedGLTFLoader.load() directly.
// dispose() on building entities must NOT call geometry.dispose() — geometry
// is shared across all clones.  material.dispose() is safe since each clone
// receives its own independent material objects (textures remain shared).
// ---------------------------------------------------------------------------
const _buildingSceneCache = new Map<string, THREE.Group>();

function _disposeMaterial(material: THREE.Material, disposedTextures: Set<THREE.Texture>): void {
  Object.values(material).forEach(value => {
    if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
      value.source.data?.close?.();
      value.dispose();
      disposedTextures.add(value);
    }
  });
  material.dispose();
}

function _disposeSceneResources(scene: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  scene.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.geometry && !disposedGeometries.has(child.geometry)) {
      child.geometry.dispose();
      disposedGeometries.add(child.geometry);
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material as THREE.Material];
    materials.forEach(material => {
      if (!material || disposedMaterials.has(material)) return;
      _disposeMaterial(material, disposedTextures);
      disposedMaterials.add(material);
    });
  });
}

/**
 * Returns a deep clone of `source` where every Mesh gets its own material
 * copy (via material.clone()) while geometry and texture references stay
 * shared with the cached original — zero extra GPU VRAM per extra building.
 */
function _cloneWithOwnMaterials(source: THREE.Object3D): THREE.Group {
  const clone = source.clone(true);
  clone.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m: THREE.Material) => m.clone());
    } else {
      child.material = (child.material as THREE.Material).clone();
    }
  });
  return clone as THREE.Group;
}

function _cloneWithSharedMaterials(source: THREE.Object3D): THREE.Group {
  return source.clone(true) as THREE.Group;
}

/**
 * Loads a building GLTF model with session-level caching.
 *
 * • First call per URL  → parses via sharedGLTFLoader, caches gltf.scene,
 *   calls callback with a clone-with-own-materials of the raw scene.
 * • Subsequent calls    → clones from cache immediately (synchronous fast path).
 *
 * Every caller receives an independent clone so per-instance colour/emissive
 * tuning (colorLift, roughness, etc.) only affects that instance, never the
 * cache or other buildings.  Geometry and texture GPU objects are shared.
 */
export function loadBuildingGLTF(
  url: string,
  callback: (model: THREE.Group) => void,
  options?: { cloneMaterials?: boolean }
): void {
  const cloneMaterials = options?.cloneMaterials ?? true;
  const cloneModel = cloneMaterials ? _cloneWithOwnMaterials : _cloneWithSharedMaterials;
  const cached = _buildingSceneCache.get(url);
  if (cached) {
    callback(cloneModel(cached));
    return;
  }
  sharedGLTFLoader.load(url, (gltf) => {
    _buildingSceneCache.set(url, gltf.scene);
    callback(cloneModel(gltf.scene));
  });
}

export function disposeBuildingGLTFCache(): void {
  _buildingSceneCache.forEach(scene => _disposeSceneResources(scene));
  _buildingSceneCache.clear();
}
