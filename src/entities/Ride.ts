import * as THREE from 'three';
import { GridPosition, RideData, BuildingType, RideType, RIDE_SIZES } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';
import { sharedGLTFLoader } from '../core/AssetLoader';

export class Ride {
  public mesh: THREE.Group;
  public data: RideData;
  private animationParts: THREE.Object3D[] = [];
  private rotationSpeed: number = 0;

  constructor(position: GridPosition, rideType: RideType, id: string, accessCell: GridPosition) {
    const config = getBuildingCatalogItem(rideType);

    this.data = {
      id,
      type: BuildingType.RIDE,
      position,
      rideType,
      cost: config.cost,
      capacity: this.getRideCapacity(rideType),
      price: this.getRidePrice(rideType),
      duration: this.getRideDuration(rideType),
      funFactor: this.getHappinessBoost(rideType),
      intensity: this.getRideIntensity(rideType),
      reliability: this.getRideReliability(rideType),
      quality: config.quality,
      valueScore: config.valueScore,
      queue: [],
      accessCell,
      unlockRequirement: config.unlockRequirement
    };

    this.mesh = new THREE.Group();
    this.createRideMesh(rideType);

    const size = RIDE_SIZES[rideType];
    const scaleFactor = size.width / 2;
    this.mesh.scale.setScalar(scaleFactor);

    const worldPos = GridHelper.gridToWorld(position);
    const centerX = worldPos.x + (size.width - 1) * GRID_SIZE / 2;
    const centerZ = worldPos.z + (size.height - 1) * GRID_SIZE / 2;
    this.mesh.position.set(centerX, 0, centerZ);
  }

  private getRideCapacity(type: RideType): number {
    const capacities: Record<RideType, number> = {
      [RideType.CAROUSEL]: 8,
      [RideType.FERRIS_WHEEL]: 12,
      [RideType.ROLLER_COASTER]: 16,
      [RideType.HAUNTED_HOUSE]: 6
    };
    return capacities[type];
  }

  private getRidePrice(type: RideType): number {
    const prices: Record<RideType, number> = {
      [RideType.CAROUSEL]: 4,
      [RideType.FERRIS_WHEEL]: 6,
      [RideType.ROLLER_COASTER]: 10,
      [RideType.HAUNTED_HOUSE]: 8
    };
    return prices[type];
  }

  private getRideDuration(type: RideType): number {
    const durations: Record<RideType, number> = {
      [RideType.CAROUSEL]: 30,
      [RideType.FERRIS_WHEEL]: 40,
      [RideType.ROLLER_COASTER]: 50,
      [RideType.HAUNTED_HOUSE]: 45
    };
    return durations[type];
  }

  private getHappinessBoost(type: RideType): number {
    const boosts: Record<RideType, number> = {
      [RideType.CAROUSEL]: 15,
      [RideType.FERRIS_WHEEL]: 25,
      [RideType.ROLLER_COASTER]: 40,
      [RideType.HAUNTED_HOUSE]: 30
    };
    return boosts[type];
  }

  private getRideIntensity(type: RideType): number {
    const intensities: Record<RideType, number> = {
      [RideType.CAROUSEL]: 35,
      [RideType.FERRIS_WHEEL]: 50,
      [RideType.ROLLER_COASTER]: 82,
      [RideType.HAUNTED_HOUSE]: 65
    };
    return intensities[type];
  }

  private getRideReliability(type: RideType): number {
    const reliabilities: Record<RideType, number> = {
      [RideType.CAROUSEL]: 85,
      [RideType.FERRIS_WHEEL]: 80,
      [RideType.ROLLER_COASTER]: 72,
      [RideType.HAUNTED_HOUSE]: 78
    };
    return reliabilities[type];
  }

  private createRideMesh(type: RideType): void {
    switch (type) {
      case RideType.CAROUSEL:
        this.createCarousel();
        break;
      case RideType.FERRIS_WHEEL:
        this.createFerrisWheel();
        break;
      case RideType.ROLLER_COASTER:
        this.createRollerCoaster();
        break;
      case RideType.HAUNTED_HOUSE:
        this.createHauntedHouse();
        break;
    }
  }

  private createCarousel(): void {
    sharedGLTFLoader.load('/models/carusel.glb', (gltf) => {
      const model = gltf.scene;

      // Fit model within the 2×2 footprint (4×4 world units), use 90% of it
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 2 * 0.9;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      // Re-compute after scaling: center on XZ, sit on ground
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

      // Enable rotation once the model is in the scene
      this.animationParts.push(model);
      this.rotationSpeed = 0.3;
    });
  }

  private createFerrisWheel(): void {
    sharedGLTFLoader.load('/models/noria.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.62;
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
      this.rotationSpeed = 0; // Static unless the model has built-in animations
    });
  }

  private createRollerCoaster(): void {
    sharedGLTFLoader.load('/models/rusa.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 4 * 0.7; // Modificado para que sea más pequeño
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
      this.rotationSpeed = 0; // Static unless the model has built-in animations
    });
  }

  private createHauntedHouse(): void {
    sharedGLTFLoader.load('/models/house.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.65;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;
      model.position.y += 0.04;

      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.mesh.add(model);
    });
  }

  public update(deltaTime: number): void {
    if (this.rotationSpeed > 0) {
      this.animationParts.forEach(part => {
        part.rotation.y += this.rotationSpeed * deltaTime;
      });
    }
  }

  public addToQueue(visitorId: string): boolean {
    if (this.data.queue.length < this.data.capacity * 2) {
      this.data.queue.push(visitorId);
      return true;
    }
    return false;
  }

  public removeFromQueue(): string | undefined {
    return this.data.queue.shift();
  }

  public dispose(): void {
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
