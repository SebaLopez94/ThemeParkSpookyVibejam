import * as THREE from 'three';
import { GridPosition, VisitorData, VisitorNeedType, VisitorThought } from '../types';
import { GridHelper } from '../utils/GridHelper';
import { sharedGLTFLoader } from '../core/AssetLoader';

const EMOJI_TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();

function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
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
  private moveSpeed = 1;

  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private isMoving = false;

  private emojiSprite: THREE.Sprite;
  private emojiMaterial: THREE.SpriteMaterial;
  private activeMoodUntil = 0;
  private moodCooldownUntil = 0;
  private activeMoodKind: VisitorThought['kind'] | null = null;

  private entryAnimTimer = 0;
  private exitAnimTimer = 0;
  private static readonly RIDE_ANIM_DURATION = 0.35;
  private static readonly RIDE_COOLDOWN = 120; // seconds before re-entering same ride
  private rideLastUsed: Map<string, number> = new Map();

  constructor(id: string, startPosition: GridPosition) {
    const worldPos = GridHelper.gridToWorld(startPosition);

    this.data = {
      id,
      position: worldPos,
      targetPosition: null,
      path: [],
      needs: {
        fun: 0,        // no fun yet — visitor hasn't done anything in the park
        hunger: 60,    // travelled here, somewhat hungry
        thirst: 60,    // somewhat thirsty
        hygiene: 85,   // arrived clean
        money: 30 + Math.floor(Math.random() * 71),
        happiness: 0 * 0.4 + 60 * 0.2 + 60 * 0.2 + 85 * 0.2 // = 41 → NEUTRAL
      },
      currentActivity: null,
      activityTimer: 0,
      lastThought: null
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
    this.emojiSprite.position.set(0, isMobile() ? 1.45 : 1.58, 0);
    const emojiScale = isMobile() ? 0.68 : 0.82;
    this.emojiSprite.scale.setScalar(emojiScale);
    this.mesh.add(this.emojiSprite);

    this.loadModel();
  }

  private loadModel(): void {
    const modelPath = Math.random() < 0.5 ? '/models/kid1.glb' : '/models/kid2.glb';
    sharedGLTFLoader.load(modelPath, (gltf) => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const height = box.getSize(new THREE.Vector3()).y;
      const scale = height > 0.01 ? 0.9 / height : 0.5;

      const yNudge = modelPath.includes('kid2') ? 0.12 : 0.05;
      model.scale.setScalar(scale);
      model.position.y = -box.min.y * scale + yNudge;

      model.traverse(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          child.castShadow = true;
          child.frustumCulled = false;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => {
            if (!mat) return;
            if (mat.alphaTest > 0 || mat.transparent) {
              mat.transparent = true;
              mat.depthWrite = false;
              mat.alphaTest = 0;
            }
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -1;
            mat.polygonOffsetUnits = -1;
          });
        }
      });

      this.mesh.frustumCulled = false;
      this.mesh.add(model);

      if (gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        const walkClip = gltf.animations.find(animation => animation.name.toLowerCase().includes('walk')) ?? gltf.animations[0];
        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
        if (this.isMoving) this.walkAction.play();
      }
    });
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
    if (path.length > 0) {
      this.data.targetPosition = GridHelper.gridToWorld(path[0]);
    }
  }

  public update(deltaTime: number): void {
    this.mixer?.update(deltaTime);

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
      this.updateNeeds(deltaTime);
      this.updateMoodSprite();
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
      this.updateMoodSprite();
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

    this.updateNeeds(deltaTime);
    this.updateMoodSprite();
  }

  private moveTowardsTarget(deltaTime: number): void {
    if (!this.data.targetPosition) return;

    const dx = this.data.targetPosition.x - this.data.position.x;
    const dz = this.data.targetPosition.z - this.data.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.1) {
      this.data.path.shift();
      if (this.data.path.length > 0) {
        this.data.targetPosition = GridHelper.gridToWorld(this.data.path[0]);
      } else {
        this.data.targetPosition = null;
        this.setMoving(false);
      }
      return;
    }

    this.setMoving(true);

    const moveDistance = this.moveSpeed * deltaTime;
    const ratio = Math.min(moveDistance / distance, 1);

    this.data.position.x += dx * ratio;
    this.data.position.z += dz * ratio;
    this.mesh.position.x = this.data.position.x;
    this.mesh.position.z = this.data.position.z;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  private updateNeeds(deltaTime: number): void {
    this.data.needs.fun = Math.max(0, this.data.needs.fun - deltaTime * 0.7);
    this.data.needs.hunger = Math.max(0, this.data.needs.hunger - deltaTime * 0.6);
    this.data.needs.thirst = Math.max(0, this.data.needs.thirst - deltaTime * 0.8);
    this.data.needs.hygiene = Math.max(0, this.data.needs.hygiene - deltaTime * 0.45);
    this.data.needs.happiness = this.calculateHappiness();
  }

  private calculateHappiness(): number {
    return (
      this.data.needs.fun * 0.4 +
      this.data.needs.hunger * 0.2 +
      this.data.needs.thirst * 0.2 +
      this.data.needs.hygiene * 0.2
    );
  }

  private updateMoodSprite(): void {
    const now = performance.now() / 1000;
    const isMoodVisible = this.mesh.visible && this.data.lastThought !== null && now < this.activeMoodUntil;
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

  public canShowMood(kind: VisitorThought['kind']): boolean {
    const now = performance.now() / 1000;
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
    options?: { force?: boolean; cooldownSeconds?: number }
  ): void {
    const now = performance.now() / 1000;
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
  }

  public boostNeed(need: VisitorNeedType, amount: number): void {
    this.data.needs[need] = Math.min(100, this.data.needs[need] + amount);
    this.data.needs.happiness = this.calculateHappiness();
  }

  public adjustHappiness(amount: number): void {
    this.data.needs.happiness = Math.max(0, Math.min(100, this.data.needs.happiness + amount));
  }

  public setThought(thought: VisitorThought | null): void {
    if (thought === null) {
      this.clearMood();
      return;
    }
    this.data.lastThought = thought;
  }

  public markRideUsed(rideId: string): void {
    this.rideLastUsed.set(rideId, performance.now() / 1000);
  }

  public canUseRide(rideId: string): boolean {
    const lastUsed = this.rideLastUsed.get(rideId);
    if (lastUsed === undefined) return true;
    return (performance.now() / 1000) - lastUsed >= Visitor.RIDE_COOLDOWN;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    this.emojiMaterial.dispose();
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
