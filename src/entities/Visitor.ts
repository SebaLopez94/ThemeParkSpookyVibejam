import * as THREE from 'three';
import { GridPosition, VisitorData, VisitorNeedType, VisitorThought } from '../types';
import { GridHelper } from '../utils/GridHelper';
import { sharedGLTFLoader } from '../core/AssetLoader';

export class Visitor {
  public mesh: THREE.Group;
  public data: VisitorData;
  private moveSpeed = 1;

  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private isMoving = false;

  constructor(id: string, startPosition: GridPosition) {
    const worldPos = GridHelper.gridToWorld(startPosition);

    this.data = {
      id,
      position: worldPos,
      targetPosition: null,
      path: [],
      needs: {
        fun: 50,
        hunger: 100,
        thirst: 100,
        hygiene: 100,
        money: 30 + Math.floor(Math.random() * 71),
        happiness: 70
      },
      currentActivity: null,
      activityTimer: 0,
      lastThought: null
    };

    this.mesh = new THREE.Group();
    this.loadModel();
    this.mesh.position.set(worldPos.x, 0, worldPos.z);
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
            // Fix transparent / alpha materials (e.g. face planes layered over head)
            if (mat.alphaTest > 0 || mat.transparent) {
              mat.transparent = true;
              mat.depthWrite = false;
              mat.alphaTest = 0;
            }
            // Prevent z-fighting on overlapping geometry
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

    if (this.data.activityTimer > 0) {
      this.data.activityTimer -= deltaTime;
      this.setMoving(false);
      if (this.data.activityTimer <= 0) {
        this.data.currentActivity = null;
        this.mesh.visible = true;
      }
      this.updateNeeds(deltaTime);
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
    this.data.needs.fun = Math.max(0, this.data.needs.fun - deltaTime * 2.2);
    this.data.needs.hunger = Math.max(0, this.data.needs.hunger - deltaTime * 1.5);
    this.data.needs.thirst = Math.max(0, this.data.needs.thirst - deltaTime * 1.9);
    this.data.needs.hygiene = Math.max(0, this.data.needs.hygiene - deltaTime * 1.1);
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

  public startActivity(activityType: string, duration: number): void {
    this.data.currentActivity = activityType;
    this.data.activityTimer = duration;
    if (activityType === 'ride') {
      this.mesh.visible = false;
    }
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
    this.data.lastThought = thought;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
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
