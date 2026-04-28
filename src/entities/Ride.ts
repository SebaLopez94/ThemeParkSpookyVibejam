import * as THREE from 'three';
import { GridPosition, RideData, BuildingType, RideType, RIDE_SIZES } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';
import { loadBuildingGLTF } from '../core/AssetLoader';

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
      ridersCount: 0,
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
      [RideType.HAUNTED_HOUSE]: 6,
      [RideType.PIRATE_SHIP]: 12,
      [RideType.KRAKEN_RIDE]: 18,
      [RideType.INFERNAL_TOWER]: 14
    };
    return capacities[type];
  }

  private getRidePrice(type: RideType): number {
    const prices: Record<RideType, number> = {
      [RideType.CAROUSEL]: 5,
      [RideType.FERRIS_WHEEL]: 8,
      [RideType.ROLLER_COASTER]: 13,
      [RideType.HAUNTED_HOUSE]: 9,
      [RideType.PIRATE_SHIP]: 8,
      [RideType.KRAKEN_RIDE]: 11,
      [RideType.INFERNAL_TOWER]: 10
    };
    return prices[type];
  }

  private getRideDuration(type: RideType): number {
    const durations: Record<RideType, number> = {
      [RideType.CAROUSEL]: 8,
      [RideType.FERRIS_WHEEL]: 12,
      [RideType.ROLLER_COASTER]: 10,
      [RideType.HAUNTED_HOUSE]: 11,
      [RideType.PIRATE_SHIP]: 9,
      [RideType.KRAKEN_RIDE]: 11,
      [RideType.INFERNAL_TOWER]: 9
    };
    return durations[type];
  }

  private getHappinessBoost(type: RideType): number {
    // funBoost = funFactor × (quality / 60)
    // Tier 1 – Entry (450):   Carousel  → ~8
    // Tier 2 – Standard:      Ferris/Pirate → ~21 / ~27
    // Tier 3 – Mid:           Haunted/Infernal → ~40 / ~50
    // Tier 4 – Premium:       Kraken/Coaster → ~63 / ~80
    const boosts: Record<RideType, number> = {
      [RideType.CAROUSEL]:      10,  // 900  → ~8
      [RideType.FERRIS_WHEEL]:  20,  // 850  → ~21
      [RideType.KRAKEN_RIDE]:   26,  // 900  → ~29
      [RideType.PIRATE_SHIP]:   32,  // 1100 → ~37
      [RideType.HAUNTED_HOUSE]: 32,  // 1050 → ~40  (research needed)
      [RideType.INFERNAL_TOWER]:38,  // 1250 → ~49
      [RideType.ROLLER_COASTER]:56,  // 1700 → ~80
    };
    return boosts[type];
  }

  private getRideIntensity(type: RideType): number {
    const intensities: Record<RideType, number> = {
      [RideType.CAROUSEL]: 35,
      [RideType.FERRIS_WHEEL]: 50,
      [RideType.ROLLER_COASTER]: 82,
      [RideType.HAUNTED_HOUSE]: 65,
      [RideType.PIRATE_SHIP]: 66,
      [RideType.KRAKEN_RIDE]: 79,
      [RideType.INFERNAL_TOWER]: 76
    };
    return intensities[type];
  }

  private getRideReliability(type: RideType): number {
    const reliabilities: Record<RideType, number> = {
      [RideType.CAROUSEL]: 85,
      [RideType.FERRIS_WHEEL]: 80,
      [RideType.ROLLER_COASTER]: 72,
      [RideType.HAUNTED_HOUSE]: 78,
      [RideType.PIRATE_SHIP]: 79,
      [RideType.KRAKEN_RIDE]: 74,
      [RideType.INFERNAL_TOWER]: 77
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
      case RideType.PIRATE_SHIP:
        this.createPirateShip();
        break;
      case RideType.KRAKEN_RIDE:
        this.createKrakenRide();
        break;
      case RideType.INFERNAL_TOWER:
        this.createInfernalTower();
        break;
    }
  }

  private tuneModelMaterials(
    model: THREE.Object3D,
    options?: {
      colorLift?: number;
      whiteMix?: number;
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
      castShadow?: boolean;
      receiveShadow?: boolean;
    }
  ): void {
    const {
      colorLift = 1,
      whiteMix = 0,
      emissiveIntensity = 0,
      roughness,
      metalness,
      castShadow = true,
      receiveShadow = true,
    } = options ?? {};

    model.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(material => {
        if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshPhysicalMaterial)) return;

        material.side = THREE.FrontSide;
        material.color.multiplyScalar(colorLift);
        if (whiteMix > 0) {
          material.color.lerp(new THREE.Color(0xffffff), whiteMix);
        }
        material.emissive.setRGB(1, 1, 1);
        if (material.map) {
          material.emissiveMap = material.map;
        }
        material.emissiveIntensity = emissiveIntensity;
        material.envMapIntensity = 0.72;
        if (roughness !== undefined) material.roughness = roughness;
        if (metalness !== undefined) material.metalness = metalness;
        material.needsUpdate = true;
      });
    });
  }

  private applyRidePresentation(
    model: THREE.Object3D,
    options?: {
      colorLift?: number;
      whiteMix?: number;
      emissiveIntensity?: number;
      roughness?: number;
      metalness?: number;
    }
  ): void {
    this.tuneModelMaterials(model, {
      colorLift: options?.colorLift ?? 1.95,
      whiteMix: options?.whiteMix ?? 0.24,
      emissiveIntensity: options?.emissiveIntensity ?? 0.55,
      roughness: options?.roughness ?? 0.52,
      metalness: options?.metalness ?? 0.05,
      castShadow: true,
      receiveShadow: true,
    });
  }

  private createCarousel(): void {
    loadBuildingGLTF('/models/carusel.glb', (model) => {

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

      this.applyRidePresentation(model, {
        colorLift: 1.1,
        whiteMix: 0.04,
        emissiveIntensity: 0.08,
        roughness: 0.66,
      });

      this.mesh.add(model);

      // Enable rotation once the model is in the scene
      this.animationParts.push(model);
      this.rotationSpeed = 0.3;
    });
  }

  private createFerrisWheel(): void {
    loadBuildingGLTF('/models/noria.glb', (model) => {

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.68;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      this.applyRidePresentation(model, {
        colorLift: 1.62,
        whiteMix: 0.34,
        emissiveIntensity: 0.38,
        roughness: 0.58,
      });

      this.mesh.add(model);
      this.rotationSpeed = 0; // Static unless the model has built-in animations
    });
  }

  private createRollerCoaster(): void {
    loadBuildingGLTF('/models/rusa.glb', (model) => {

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 4 * 0.66;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      this.applyRidePresentation(model, {
        colorLift: 1.82,
        whiteMix: 0.3,
        emissiveIntensity: 0.46,
        roughness: 0.52,
      });

      this.mesh.add(model);
      this.rotationSpeed = 0; // Static unless the model has built-in animations
    });
  }

  private createHauntedHouse(): void {
    loadBuildingGLTF('/models/house.glb', (model) => {

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
      model.position.y -= 0.4;

      this.applyRidePresentation(model, {
        colorLift: 1.52,
        whiteMix: 0.34,
        emissiveIntensity: 0.32,
        roughness: 0.6,
      });

      this.mesh.add(model);
    });
  }

  private createPirateShip(): void {
    loadBuildingGLTF('/models/pirate_ship.glb', (model) => {

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.72;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      this.applyRidePresentation(model, {
        colorLift: 2.02,
        whiteMix: 0.26,
        emissiveIntensity: 0.6,
        roughness: 0.48,
        metalness: 0.06,
      });

      this.mesh.add(model);
    });
  }

  private createKrakenRide(): void {
    loadBuildingGLTF('/models/kraken.glb', (model) => {

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.74;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      this.applyRidePresentation(model, {
        colorLift: 1.78,
        whiteMix: 0.38,
        emissiveIntensity: 0.5,
        roughness: 0.5,
        metalness: 0.05,
      });

      this.mesh.add(model);
    });
  }

  private createInfernalTower(): void {
    loadBuildingGLTF('/models/infernal_tower.glb', (model) => {

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 3 * 0.68;
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y;

      this.applyRidePresentation(model, {
        colorLift: 2.18,
        whiteMix: 0.34,
        emissiveIntensity: 0.78,
        roughness: 0.42,
        metalness: 0.06,
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
    // Geometry is shared via loadBuildingGLTF cache — must NOT dispose.
    // Each clone has its own material copy (via material.clone()) — safe to dispose.
    this.mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
