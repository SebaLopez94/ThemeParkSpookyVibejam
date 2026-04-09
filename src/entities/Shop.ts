import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GridPosition, ShopData, BuildingType, ShopType } from '../types';
import { GridHelper, GRID_SIZE } from '../utils/GridHelper';
import { getBuildingCatalogItem } from '../data/buildings';

const gltfLoader = new GLTFLoader();

export class Shop {
  public mesh: THREE.Group;
  public data: ShopData;

  constructor(position: GridPosition, shopType: ShopType, id: string, accessCell: GridPosition) {
    const config = getBuildingCatalogItem(shopType);

    this.data = {
      id,
      type: BuildingType.SHOP,
      position,
      shopType,
      cost: config.cost,
      price: this.getShopPrice(shopType),
      quality: config.quality,
      valueScore: config.valueScore,
      satisfactionEffects: this.getSatisfactionEffects(shopType),
      accessCell,
      unlockRequirement: config.unlockRequirement
    };

    this.mesh = new THREE.Group();
    this.createShopMesh(shopType);

    const worldPos = GridHelper.gridToWorld(position);
    this.mesh.position.set(worldPos.x, 0, worldPos.z);
  }

  private getShopPrice(type: ShopType): number {
    const prices: Record<ShopType, number> = {
      [ShopType.FOOD_STALL]: 8,
      [ShopType.DRINK_STAND]: 5,
      [ShopType.GIFT_SHOP]: 12
    };
    return prices[type];
  }

  private getSatisfactionEffects(type: ShopType): ShopData['satisfactionEffects'] {
    switch (type) {
      case ShopType.FOOD_STALL:
        return { hunger: 28 };
      case ShopType.DRINK_STAND:
        return { thirst: 34 };
      case ShopType.GIFT_SHOP:
        return { fun: 8 };
    }
  }

  private loadGlbShop(path: string): void {
    gltfLoader.load(path, (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = GRID_SIZE * 0.9;
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
    });
  }

  private createShopMesh(type: ShopType): void {
    if (type === ShopType.FOOD_STALL) {
      this.loadGlbShop('/models/food.glb');
      return;
    }
    if (type === ShopType.DRINK_STAND) {
      this.loadGlbShop('/models/drinks.glb');
      return;
    }
    if (type === ShopType.GIFT_SHOP) {
      this.loadGlbShop('/models/gift.glb');
      return;
    }
    const baseGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.9, 2, GRID_SIZE * 0.9);
    const baseMaterial = new THREE.MeshLambertMaterial({
      color: this.getShopColor(type)
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 1;
    base.castShadow = true;
    this.mesh.add(base);

    const roofGeometry = new THREE.ConeGeometry(GRID_SIZE * 0.7, 1, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 2.5;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.mesh.add(roof);

    const counterGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.6, 0.8, 0.3);
    const counterMaterial = new THREE.MeshLambertMaterial({ color: 0xa0522d });
    const counter = new THREE.Mesh(counterGeometry, counterMaterial);
    counter.position.set(0, 0.4, GRID_SIZE * 0.3);
    counter.castShadow = true;
    this.mesh.add(counter);

    this.addShopSpecificDetails(type);
  }

  private getShopColor(type: ShopType): THREE.Color {
    const colors: Record<ShopType, number> = {
      [ShopType.FOOD_STALL]: 0xff8c42,
      [ShopType.DRINK_STAND]: 0x42d4ff,
      [ShopType.GIFT_SHOP]: 0xff42d4
    };
    return new THREE.Color(colors[type]);
  }

  private addShopSpecificDetails(type: ShopType): void {
    switch (type) {
      case ShopType.FOOD_STALL: {
        const plateGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
        const plateMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        plate.position.set(0.3, 0.8, GRID_SIZE * 0.3);
        this.mesh.add(plate);
        break;
      }

      case ShopType.DRINK_STAND: {
        const cupGeometry = new THREE.CylinderGeometry(0.15, 0.1, 0.4, 16);
        const cupMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const cup = new THREE.Mesh(cupGeometry, cupMaterial);
        cup.position.set(-0.3, 0.6, GRID_SIZE * 0.3);
        this.mesh.add(cup);
        break;
      }

      case ShopType.GIFT_SHOP: {
        const boxGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const boxMaterial = new THREE.MeshLambertMaterial({ color: 0xffd700 });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.set(0, 0.95, GRID_SIZE * 0.3);
        box.rotation.y = Math.PI / 4;
        this.mesh.add(box);
        break;
      }
    }
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
