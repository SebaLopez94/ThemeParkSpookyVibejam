import * as THREE from 'three';
import { BuildingType, DecorationData, DecorationType, GridPosition } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';

export class Decoration {
  public mesh: THREE.Group;
  public data: DecorationData;

  constructor(position: GridPosition, decorationType: DecorationType, id: string) {
    const config = getBuildingCatalogItem(decorationType);
    const [appealRadius, appealBonus] = decorationType === DecorationType.SPOOKY_TREE ? [4, 5] : [3, 7];

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

  private createMesh(type: DecorationType): void {
    if (type === DecorationType.SPOOKY_TREE) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.22, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x4b2e1f, roughness: 0.9 })
      );
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      this.mesh.add(trunk);

      for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(0.7 - i * 0.12, 0.9, 7),
          new THREE.MeshStandardMaterial({ color: 0x1f4d30, roughness: 0.85 })
        );
        crown.position.y = 1.2 + i * 0.45;
        crown.castShadow = true;
        this.mesh.add(crown);
      }
      return;
    }

    const pumpkin = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0x6b2d00, emissiveIntensity: 0.35 })
    );
    pumpkin.scale.y = 0.8;
    pumpkin.position.y = 0.38;
    pumpkin.castShadow = true;
    this.mesh.add(pumpkin);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0x365314 })
    );
    stem.position.y = 0.78;
    this.mesh.add(stem);

    const glow = new THREE.PointLight(0xffb347, 0.4, GRID_SIZE * 3.5);
    glow.position.set(0, 0.45, 0);
    this.mesh.add(glow);
  }

  public dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
