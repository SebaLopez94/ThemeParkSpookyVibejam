import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GridPosition, VisitorData, VisitorNeedType, VisitorPersonality, VisitorThought } from '../types';
import { GridHelper } from '../utils/GridHelper';
import { sharedGLTFLoader } from '../core/AssetLoader';
import { isMobile } from '../utils/platform';

const PERSONALITIES: VisitorPersonality[] = ['thrill_seeker', 'foodie', 'relaxer'];
const VISITOR_MODEL_PATHS = ['/models/kid1.glb', '/models/kid2.glb', '/models/kid3.glb'] as const;
export type VisitorKidNumber = 1 | 2 | 3;
const MOBILE_DEVICE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i;

/**
 * Cached once at module load — avoids re-running the UA regex on every Visitor
 * constructor call (200 visitors × regex = measurable overhead; also used to
 * skip GLTF loading on mobile where SkinnedMesh + AnimationMixer cause OOM).
 */
const IS_MOBILE = isMobile();
const SHOULD_SKIP_VISITOR_MIXER = MOBILE_DEVICE_REGEX.test(navigator.userAgent);

function pickRandomPersonality(): VisitorPersonality {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

// ---------------------------------------------------------------------------
// Shared fallback model resources — allocated once, reused by every visitor.
// This eliminates O(N) geometry/material objects that were previously created
// per visitor (200 visitors × 2 geos + 2 mats = 400 + 400 GPU objects → 4).
// ---------------------------------------------------------------------------
const FALLBACK_BODY_GEO = new THREE.CapsuleGeometry(0.18, 0.36, 4, 8);
const FALLBACK_HEAD_GEO = new THREE.SphereGeometry(0.16, 12, 10);
const FALLBACK_SKIN_MAT = new THREE.MeshStandardMaterial({ color: 0x8d7161, roughness: 0.76, metalness: 0 });
// Small fixed palette — random pick avoids visual monotony without unique materials.
const FALLBACK_BODY_MATS = [
  0xed857b, 0x85a6c9, 0x8eb07f, 0xdfae63,
  0xaf8dc9, 0x84b0a5, 0xd39267, 0x78848d,
].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 }));

// ---------------------------------------------------------------------------
// GLTF model cache — process each model path exactly once, then clone it for
// every subsequent visitor with SkeletonUtils.clone().
//
// Result: geometries + materials are shared across all visitors of the same
// model. GPU material count: 200 visitors × ~4 mats → 3 models × ~4 mats = 12.
// AnimationClips are read-only data and safe to share across mixers.
// ---------------------------------------------------------------------------
interface CachedGltfModel {
  scene:    THREE.Group;
  clips:    THREE.AnimationClip[];
}
const GLTF_MODEL_CACHE = new Map<string, CachedGltfModel>();

const EMOJI_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

/** Call once at game shutdown to release GPU memory held by cached emoji textures. */
export function disposeEmojiTextureCache(): void {
  EMOJI_TEXTURE_CACHE.forEach(tex => tex.dispose());
  EMOJI_TEXTURE_CACHE.clear();
}

export function disposeVisitorModelCache(): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  GLTF_MODEL_CACHE.forEach(entry => {
    entry.scene.traverse(child => {
      if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;
      if (child.geometry && !disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material as THREE.Material];
      materials.forEach(material => {
        if (!material || disposedMaterials.has(material)) return;
        Object.values(material).forEach(value => {
          if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
            value.source.data?.close?.();
            value.dispose();
            disposedTextures.add(value);
          }
        });
        material.dispose();
        disposedMaterials.add(material);
      });
    });
  });
  GLTF_MODEL_CACHE.clear();
}

function getEmojiTexture(emoji: string): THREE.CanvasTexture {
  const cached = EMOJI_TEXTURE_CACHE.get(emoji);
  if (cached) return cached;

  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    EMOJI_TEXTURE_CACHE.set(emoji, fallback);
    return fallback;
  }

  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2 + 2, 31, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(emoji, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  EMOJI_TEXTURE_CACHE.set(emoji, texture);
  return texture;
}

export class Visitor {
  public mesh: THREE.Group;
  public data: VisitorData;
  public readonly kidNumber: number;
  private moveSpeed = 1;

  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private isMoving = false;
  private fallbackModel: THREE.Group | null = null;
  private walkBobPhase = Math.random() * Math.PI * 2;

  /**
   * Cursor into data.path — advances with O(1) instead of O(n) shift().
   * Reset to 0 on every setPath() call; never stored in VisitorData (not saved).
   */
  private pathIndex = 0;

  /**
   * Personality-driven need-decay multipliers, baked once at construction.
   * Avoids 6 string comparisons × 200 visitors × 60 fps = 72 000 comparisons/sec.
   */
  private readonly funMult: number;
  private readonly hungerMult: number;
  private readonly thirstMult: number;

  private emojiSprite: THREE.Sprite;
  private emojiMaterial: THREE.SpriteMaterial;
  private activeMoodUntil = 0;
  private moodCooldownUntil = 0;
  private activeMoodKind: VisitorThought['kind'] | null = null;

  private entryAnimTimer = 0;
  private exitAnimTimer = 0;
  private static readonly RIDE_ANIM_DURATION = 0.35;
  private static readonly RIDE_COOLDOWN = 60; // seconds before re-entering same ride
  private rideLastUsed: Map<string, number> = new Map();

  constructor(id: string, startPosition: GridPosition, forcedKidNumber?: VisitorKidNumber) {
    const worldPos = GridHelper.gridToWorld(startPosition);

    const personality = pickRandomPersonality();
    this.kidNumber = forcedKidNumber ?? ((Math.floor(Math.random() * 3) + 1) as VisitorKidNumber);

    // Bake personality multipliers once — never recomputed per frame.
    this.funMult    = personality === 'thrill_seeker' ? 1.25 : personality === 'relaxer' ? 0.80 : 1.0;
    this.hungerMult = personality === 'foodie'        ? 1.20 : personality === 'relaxer' ? 0.85 : 1.0;
    this.thirstMult = personality === 'foodie'        ? 1.15 : personality === 'relaxer' ? 0.85 : 1.0;

    this.data = {
      id,
      position: worldPos,
      targetPosition: null,
      path: [],
      needs: {
        fun: 30,
        hunger: 70,
        thirst: 70,
        hygiene: 90,
        money: 60 + Math.floor(Math.random() * 91), // $60–$150
        happiness: 30 * 0.4 + 70 * 0.2 + 70 * 0.2 + 90 * 0.2 // = 58
      },
      currentActivity: null,
      activityTimer: 0,
      lastThought: null,
      personality,
      moodMomentum: 0,
      timeInPark: 0,
      naturalLeaveDuration: 180 + Math.random() * 120,
      rideUseCounts: {},
    };

    this.mesh = new THREE.Group();
    this.mesh.position.set(worldPos.x, 0, worldPos.z);

    this.emojiMaterial = new THREE.SpriteMaterial({
      map: null,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    this.emojiSprite = new THREE.Sprite(this.emojiMaterial);
    this.emojiSprite.visible = false;
    this.emojiSprite.renderOrder = 12;
    this.emojiSprite.position.set(0, IS_MOBILE ? 1.45 : 1.58, 0);
    const emojiScale = IS_MOBILE ? 0.68 : 0.82;
    this.emojiSprite.scale.setScalar(emojiScale);
    this.mesh.add(this.emojiSprite);

    this.createFallbackModel();
    this.loadModel();
  }

  private createFallbackModel(): void {
    const group = new THREE.Group();
    // Pick from the shared material pool — no new material or geometry allocated.
    const bodyMat = FALLBACK_BODY_MATS[Math.floor(Math.random() * FALLBACK_BODY_MATS.length)];

    const body = new THREE.Mesh(FALLBACK_BODY_GEO, bodyMat);
    body.position.y = 0.45;
    const head = new THREE.Mesh(FALLBACK_HEAD_GEO, FALLBACK_SKIN_MAT);
    head.position.y = 0.86;

    group.add(body, head);
    if (!IS_MOBILE) {
      body.castShadow = true;
      head.castShadow = true;
    }

    this.fallbackModel = group;
    this.mesh.add(group);
  }

  private removeFallbackModel(): void {
    if (!this.fallbackModel) return;
    this.mesh.remove(this.fallbackModel);
    // Geometries and materials are module-level singletons — never dispose them here.
    this.fallbackModel = null;
  }

  private loadModel(): void {
    const modelPath = VISITOR_MODEL_PATHS[this.kidNumber - 1];

    const cached = GLTF_MODEL_CACHE.get(modelPath);
    if (cached) {
      // Fast path: clone the pre-processed template — zero parse, shared GPU resources.
      this.attachCachedModel(cached);
      return;
    }

    sharedGLTFLoader.load(modelPath, (gltf) => {
      // First visitor of this model type: process, cache, then attach.
      const entry = this.processAndCacheGltf(gltf, modelPath);
      this.attachCachedModel(entry);
    }, undefined, () => {
      // Keep the lightweight fallback visible if the model cannot be loaded.
    });
  }

  /**
   * Processes a raw GLTF result: computes scale, applies material tweaks, stores
   * the result in GLTF_MODEL_CACHE.  Runs exactly once per model path.
   */
  private processAndCacheGltf(gltf: GLTF, modelPath: string): CachedGltfModel {
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);

    const box    = new THREE.Box3().setFromObject(scene);
    const height = box.getSize(new THREE.Vector3()).y;
    const scale  = height > 0.01 ? 0.9 / height : 0.5;
    const yNudge = modelPath.includes('kid2') ? 0.12 : modelPath.includes('kid3') ? 0.08 : 0.05;
    const isKid3 = modelPath.includes('kid3');

    scene.scale.setScalar(scale);
    scene.position.y = -box.min.y * scale + yNudge;

    // Visitors never cast shadows — from isometric view they're too small to notice,
    // and keeping them out of the shadow pass removes ~200 skinned-mesh draw calls
    // from the depth render, allowing shadowMap.autoUpdate = false to be effective.
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.SkinnedMesh)) return;
      child.castShadow = false;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(mat => {
        if (!mat) return;
        const colorMat = mat as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
          emissiveIntensity?: number;
          roughness?: number;
          metalness?: number;
          envMapIntensity?: number;
          toneMapped?: boolean;
        };

        if (colorMat.color) {
          colorMat.color.multiplyScalar(1.48);
          colorMat.color.offsetHSL(0, -0.01, 0.17);
        }
        if (typeof colorMat.roughness === 'number') {
          colorMat.roughness = Math.max(colorMat.roughness, 0.66);
        }
        if (typeof colorMat.metalness === 'number') {
          colorMat.metalness = 0;
        }
        if (typeof colorMat.envMapIntensity === 'number') {
          colorMat.envMapIntensity = 0.18;
        }
        if (colorMat.emissive) {
          colorMat.emissive.setRGB(0, 0, 0);
        }
        if (typeof colorMat.emissiveIntensity === 'number') {
          colorMat.emissiveIntensity = 0;
        }
        colorMat.needsUpdate = true;
        if (mat.alphaTest > 0) {
          // Keep cutout materials in alpha-test mode so faces/hair cards
          // don't sort like translucent glass and appear sliced.
          mat.transparent = false;
          mat.depthWrite  = true;
        } else if (mat.transparent) {
          mat.transparent = true;
          mat.depthWrite  = false;
        }
        // kid3 uses facial card layering that breaks with global polygon offset.
        if (isKid3) {
          mat.polygonOffset       = false;
          mat.polygonOffsetFactor = 0;
          mat.polygonOffsetUnits  = 0;
        } else {
          mat.polygonOffset       = true;
          mat.polygonOffsetFactor = -1;
          mat.polygonOffsetUnits  = -1;
        }
      });
    });

    const entry: CachedGltfModel = { scene, clips: gltf.animations };
    GLTF_MODEL_CACHE.set(modelPath, entry);
    return entry;
  }

  /**
   * Clones the cached scene with SkeletonUtils (handles SkinnedMesh / bone rebinding).
   * Clones share geometries and materials with the template — only transforms and
   * skeleton state are independent per visitor.
   */
  private attachCachedModel(cached: CachedGltfModel): void {
    const model = SkeletonUtils.clone(cached.scene) as THREE.Group;
    this.removeFallbackModel();
    this.mesh.add(model);

    this.showMoodWithOptions(
      { kind: 'excited', emoji: '🎉', message: 'Arrived at the park!', duration: 2.2 },
      { force: true, cooldownSeconds: 0 }
    );

    // Mobile caps at 20 visitors — 20 AnimationMixers is negligible overhead.
    // Always enable the walk animation so visitors look alive on all devices.
    if (cached.clips.length > 0) {
      this.mixer    = new THREE.AnimationMixer(model);
      const walkClip = cached.clips.find(c => c.name.toLowerCase().includes('walk')) ?? cached.clips[0];
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
      if (this.isMoving) this.walkAction.play();
    }
  }

  private setMoving(moving: boolean): void {
    if (moving === this.isMoving) return;
    this.isMoving = moving;

    if (!this.walkAction) return;
    if (moving) {
      this.walkAction.play();
    } else {
      this.walkAction.stop();
    }
  }

  public setPath(path: GridPosition[]): void {
    this.data.path = path;
    this.pathIndex = 0;
    if (path.length > 0) {
      this.data.targetPosition = GridHelper.gridToWorld(path[0]);
    }
  }

  /**
   * @param now       - performance.now()/1000, computed once in VisitorSystem.update()
   * @param moodDecay - Math.pow(0.995, deltaTime*60), computed once per frame
   */
  public update(deltaTime: number, hygieneDecayMultiplier: number, now: number, moodDecay: number): void {
    if (this.mixer && this.isMoving) this.mixer.update(deltaTime);

    // Entry animation: shrink + rise as visitor "boards" the ride
    if (this.entryAnimTimer > 0) {
      this.entryAnimTimer = Math.max(0, this.entryAnimTimer - deltaTime);
      const t = 1 - this.entryAnimTimer / Visitor.RIDE_ANIM_DURATION;
      const eased = t * t;
      this.mesh.scale.setScalar(1 - eased);
      this.mesh.position.y = eased * 0.6;
      if (this.entryAnimTimer <= 0) {
        this.mesh.visible = false;
        this.mesh.scale.setScalar(1);
        this.mesh.position.y = 0;
      }
    }

    if (this.data.activityTimer > 0) {
      this.data.activityTimer -= deltaTime;
      this.setMoving(false);
      if (this.data.activityTimer <= 0) {
        if (this.data.currentActivity === 'ride') {
          // Start exit animation: pop up from ground with a bounce
          this.mesh.scale.setScalar(0);
          this.mesh.position.y = 0.5;
          this.mesh.visible = true;
          this.exitAnimTimer = Visitor.RIDE_ANIM_DURATION;
        } else {
          this.data.currentActivity = null;
          this.mesh.visible = true;
        }
      }
      this.updateNeeds(deltaTime, hygieneDecayMultiplier, moodDecay);
      this.updateMoodSprite(now);
      return;
    }

    // Exit animation: grow + drop to ground with a slight bounce
    if (this.exitAnimTimer > 0) {
      this.exitAnimTimer = Math.max(0, this.exitAnimTimer - deltaTime);
      const t = 1 - this.exitAnimTimer / Visitor.RIDE_ANIM_DURATION;
      const scale = 1 - Math.pow(1 - t, 2);
      const bounce = Math.sin(t * Math.PI) * 0.12;
      this.mesh.scale.setScalar(scale + bounce);
      this.mesh.position.y = Math.pow(1 - t, 2) * 0.5;
      if (this.exitAnimTimer <= 0) {
        this.data.currentActivity = null;
        this.mesh.scale.setScalar(1);
        this.mesh.position.y = 0;
      }
      this.setMoving(false);
      this.updateMoodSprite(now);
      return;
    }

    if (this.data.currentActivity) {
      this.data.currentActivity = null;
      this.mesh.visible = true;
    }

    if (this.data.targetPosition) {
      this.moveTowardsTarget(deltaTime);
    } else {
      this.setMoving(false);
    }

    this.updateWalkPresentation(deltaTime);
    this.updateNeeds(deltaTime, hygieneDecayMultiplier, moodDecay);
    this.updateMoodSprite(now);
  }

  private updateWalkPresentation(deltaTime: number): void {
    if (this.entryAnimTimer > 0 || this.exitAnimTimer > 0 || this.data.currentActivity) return;
    if (this.mixer) {
      if (!this.isMoving) {
        this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, 0.22);
      }
      return;
    }

    if (this.isMoving) {
      this.walkBobPhase += deltaTime * 11;
      this.mesh.position.y = Math.abs(Math.sin(this.walkBobPhase)) * 0.05;
      return;
    }

    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, 0, 0.22);
  }

  private moveTowardsTarget(deltaTime: number): void {
    if (!this.data.targetPosition) return;

    const dx = this.data.targetPosition.x - this.data.position.x;
    const dz = this.data.targetPosition.z - this.data.position.z;
    // Compare squared distance — skips Math.sqrt() on the most common (moving) path.
    const distSq = dx * dx + dz * dz;

    if (distSq < 0.01) { // 0.1² = 0.01
      // O(1) cursor advance — no array mutation, no memory reshuffling.
      this.pathIndex++;
      if (this.pathIndex < this.data.path.length) {
        this.data.targetPosition = GridHelper.gridToWorld(this.data.path[this.pathIndex]);
      } else {
        this.data.targetPosition = null;
        this.setMoving(false);
      }
      return;
    }

    this.setMoving(true);

    const moveDistance = this.moveSpeed * deltaTime;
    const distance = Math.sqrt(distSq); // sqrt only when actually moving
    const ratio = Math.min(moveDistance / distance, 1);

    this.data.position.x += dx * ratio;
    this.data.position.z += dz * ratio;
    this.mesh.position.x = this.data.position.x;
    this.mesh.position.z = this.data.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private updateNeeds(deltaTime: number, hygieneDecayMultiplier: number, moodDecay: number): void {
    // funMult/hungerMult/thirstMult are baked at construction — no string comparisons per frame.
    this.data.needs.fun    = Math.max(0, this.data.needs.fun    - deltaTime * 0.70 * this.funMult);
    this.data.needs.hunger = Math.max(0, this.data.needs.hunger - deltaTime * 0.50 * this.hungerMult);
    this.data.needs.thirst = Math.max(0, this.data.needs.thirst - deltaTime * 0.60 * this.thirstMult);
    // hygieneDecayMultiplier arrives already clamped [0.35, 1] from VisitorSystem — no re-clamp needed.
    this.data.needs.hygiene   = Math.max(0, this.data.needs.hygiene - deltaTime * 0.30 * hygieneDecayMultiplier);
    this.data.needs.happiness = this.calculateHappiness();

    this.data.timeInPark += deltaTime;
    // moodDecay = Math.pow(0.995, deltaTime*60) computed once per frame in VisitorSystem.
    this.data.moodMomentum *= moodDecay;
  }

  private calculateHappiness(): number {
    const { fun, hunger, thirst, hygiene } = this.data.needs;

    const base = fun * 0.4 + hunger * 0.2 + thirst * 0.2 + hygiene * 0.2;

    // Critical-need penalties: being bored, hungry, thirsty or dirty actively drags
    // down happiness — no single need should mask the others.
    // Each ramps up linearly below its threshold to a max of −24.
    const funPenalty     = fun     < 35 ? (35 - fun)     * 0.80 : 0; // up to −28
    const hungerPenalty  = hunger  < 40 ? (40 - hunger)  * 1.20 : 0; // up to −48
    const thirstPenalty  = thirst  < 40 ? (40 - thirst)  * 1.20 : 0; // up to −48
    const hygienePenalty = hygiene < 30 ? (30 - hygiene) * 0.80 : 0; // up to −24

    return Math.max(0, base - funPenalty - hungerPenalty - thirstPenalty - hygienePenalty);
  }

  private updateMoodSprite(now: number): void {
    const suppressedByAnim = this.entryAnimTimer > 0;
    const isMoodVisible = !suppressedByAnim && this.mesh.visible && this.data.lastThought !== null && now < this.activeMoodUntil;
    this.emojiSprite.visible = isMoodVisible;

    if (!isMoodVisible) {
      this.emojiMaterial.opacity = Math.max(0, this.emojiMaterial.opacity - 0.12);
      if (now >= this.activeMoodUntil) {
        this.data.lastThought = null;
      }
      return;
    }

    const remaining = Math.max(0, this.activeMoodUntil - now);
    const duration = this.data.lastThought?.duration ?? 1.8;
    const fadeWindow = Math.min(0.32, duration * 0.28);
    const targetOpacity = remaining < fadeWindow ? Math.max(0, remaining / fadeWindow) : 1;
    this.emojiMaterial.opacity = THREE.MathUtils.lerp(this.emojiMaterial.opacity, targetOpacity, 0.28);
  }

  /**
   * @param now - pass performance.now()/1000 from the caller to avoid a redundant system call
   *              in the per-frame hot path; omit only in event-driven (non-frame) contexts.
   */
  public canShowMood(kind: VisitorThought['kind'], now = performance.now() / 1000): boolean {
    if (now < this.moodCooldownUntil) return false;
    if (!this.mesh.visible) return false;
    if (this.activeMoodKind === kind && now < this.activeMoodUntil) return false;
    return true;
  }

  public showMood(thought: VisitorThought): void {
    this.showMoodWithOptions(thought);
  }

  public showMoodWithOptions(
    thought: VisitorThought,
    options?: { force?: boolean; cooldownSeconds?: number },
    now = performance.now() / 1000
  ): void {
    if (!options?.force && !this.canShowMood(thought.kind)) return;
    this.data.lastThought = thought;
    this.activeMoodKind = thought.kind;
    this.activeMoodUntil = now + thought.duration;
    this.moodCooldownUntil = now + thought.duration + (options?.cooldownSeconds ?? (10 + Math.random() * 6));
    this.emojiMaterial.map = getEmojiTexture(thought.emoji);
    this.emojiMaterial.opacity = 0;
    this.emojiMaterial.needsUpdate = true;
    this.emojiSprite.visible = this.mesh.visible;
  }

  public clearMood(kind?: VisitorThought['kind']): void {
    if (kind && this.activeMoodKind !== kind) return;
    this.data.lastThought = null;
    this.activeMoodUntil = 0;
    this.activeMoodKind = null;
    this.emojiSprite.visible = false;
    this.emojiMaterial.opacity = 0;
  }

  public startActivity(activityType: string, duration: number): void {
    this.data.currentActivity = activityType;
    this.data.activityTimer = duration;
    if (activityType === 'ride') {
      this.entryAnimTimer = Visitor.RIDE_ANIM_DURATION;
      this.exitAnimTimer = 0;
      this.emojiSprite.visible = false;
    }
  }

  public faceWorldPosition(target: THREE.Vector3): void {
    const dx = target.x - this.data.position.x;
    const dz = target.z - this.data.position.z;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  public spendMoney(amount: number): boolean {
    if (this.data.needs.money < amount) return false;
    this.data.needs.money -= amount;
    return true;
  }

  public boostFun(amount: number): void {
    this.data.needs.fun = Math.min(100, this.data.needs.fun + amount);
    this.data.needs.happiness = this.calculateHappiness();
    this.data.moodMomentum = Math.min(1, this.data.moodMomentum + amount * 0.004);
  }

  public boostNeed(need: VisitorNeedType, amount: number): void {
    this.data.needs[need] = Math.min(100, this.data.needs[need] + amount);
    this.data.needs.happiness = this.calculateHappiness();
  }

  public adjustHappiness(amount: number): void {
    this.data.needs.happiness = Math.max(0, Math.min(100, this.data.needs.happiness + amount));
    this.data.moodMomentum = Math.max(-1, Math.min(1, this.data.moodMomentum + amount * 0.015));
  }

  public setThought(thought: VisitorThought | null): void {
    if (thought === null) {
      this.clearMood();
      return;
    }
    this.data.lastThought = thought;
  }

  public markRideUsed(rideId: string, now = performance.now() / 1000): void {
    this.rideLastUsed.set(rideId, now);
    this.data.rideUseCounts[rideId] = (this.data.rideUseCounts[rideId] ?? 0) + 1;
  }

  public canUseRide(rideId: string, now = performance.now() / 1000): boolean {
    const lastUsed = this.rideLastUsed.get(rideId);
    if (lastUsed === undefined) return true;
    return now - lastUsed >= Visitor.RIDE_COOLDOWN;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    this.removeFallbackModel();

    // emojiMaterial is per-visitor — safe to dispose.
    // Its texture map comes from EMOJI_TEXTURE_CACHE (module-level shared) — do NOT
    // dispose the texture itself, only detach the reference.
    this.emojiMaterial.map = null;
    this.emojiMaterial.dispose();

    // GLTF model meshes use geometries and materials that are SHARED across all
    // visitors of the same model type via SkeletonUtils.clone().  Disposing them
    // here would corrupt every other visitor still in the scene that references
    // the same GPU buffers — causing missing/black textures and WebGL errors.
    // The VisitorSystem already calls scene.remove(visitor.mesh) before dispose(),
    // which is sufficient for the cloned Object3D tree to be GC'd by JS.
    // Fallback model resources (FALLBACK_*_GEO, FALLBACK_*_MAT) are module-level
    // singletons and are likewise never disposed per-visitor.
  }
}
