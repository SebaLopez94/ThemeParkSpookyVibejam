import * as THREE from 'three';
import { Decoration } from '../entities/Decoration';
import { Path } from '../entities/Path';
import { Ride } from '../entities/Ride';
import { Service } from '../entities/Service';
import { Shop } from '../entities/Shop';
import {
  BuildingType,
  DecorationType,
  GridPosition,
  PlaceableBuildingKind,
  RideType,
  RIDE_SIZES,
  ServiceType,
  ShopType
} from '../types';
import { GridHelper } from '../utils/GridHelper';
import { PathfindingSystem } from './PathfindingSystem';

export class BuildingSystem {
  private scene: THREE.Scene;
  private pathfinding: PathfindingSystem;
  private paths: Map<string, Path> = new Map();
  private rides: Map<string, Ride> = new Map();
  private shops: Map<string, Shop> = new Map();
  private services: Map<string, Service> = new Map();
  private decorations: Map<string, Decoration> = new Map();
  private occupiedCells: Map<string, string> = new Map();
  private buildingIdCounter = 0;

  private ridesCache: Ride[] | null = null;
  private shopsCache: Shop[] | null = null;
  private servicesCache: Service[] | null = null;
  private decorationsCache: Decoration[] | null = null;

  constructor(scene: THREE.Scene, pathfinding: PathfindingSystem) {
    this.scene = scene;
    this.pathfinding = pathfinding;
  }

  private getRideFootprintCells(anchor: GridPosition, rideType: RideType): GridPosition[] {
    const size = RIDE_SIZES[rideType];
    const cells: GridPosition[] = [];
    for (let dx = 0; dx < size.width; dx++) {
      for (let dz = 0; dz < size.height; dz++) {
        cells.push({ x: anchor.x + dx, z: anchor.z + dz });
      }
    }
    return cells;
  }

  private findAccessCell(cells: GridPosition[]): GridPosition | null {
    for (const cell of cells) {
      const neighbors = GridHelper.getAdjacentPositions(cell);
      const pathNeighbor = neighbors.find(neighbor => this.pathfinding.hasPath(neighbor));
      if (pathNeighbor) return pathNeighbor;
    }
    return null;
  }

  private isCellOccupied(position: GridPosition): boolean {
    const key = GridHelper.getGridKey(position);
    return this.paths.has(key) || this.occupiedCells.has(key);
  }

  private updatePathConnectionsAt(position: GridPosition): void {
    const key = GridHelper.getGridKey(position);
    const path = this.paths.get(key);
    if (!path) return;

    const connections = GridHelper
      .getAdjacentPositions(position)
      .filter(neighbor => this.paths.has(GridHelper.getGridKey(neighbor)));

    path.updateConnections(connections);
  }

  private refreshPathConnectionsAround(position: GridPosition): void {
    this.updatePathConnectionsAt(position);
    GridHelper.getAdjacentPositions(position).forEach(neighbor => this.updatePathConnectionsAt(neighbor));
  }

  public canPlaceBuilding(
    position: GridPosition,
    type: BuildingType,
    subType?: PlaceableBuildingKind
  ): boolean {
    if (type === BuildingType.RIDE && subType) {
      const cells = this.getRideFootprintCells(position, subType as RideType);
      for (const cell of cells) {
        if (!GridHelper.isValidGridPosition(cell) || this.isCellOccupied(cell)) {
          return false;
        }
      }

      return this.findAccessCell(cells) !== null;
    }

    if (!GridHelper.isValidGridPosition(position) || this.isCellOccupied(position)) {
      return false;
    }

    if (type === BuildingType.PATH || type === BuildingType.DECORATION) {
      return true;
    }

    const neighbors = GridHelper.getAdjacentPositions(position);
    return neighbors.some(neighbor => this.pathfinding.hasPath(neighbor));
  }

  public placePath(position: GridPosition): Path | null {
    if (!this.canPlaceBuilding(position, BuildingType.PATH)) return null;

    const id = `path_${this.buildingIdCounter++}`;
    const path = new Path(position, id);
    const key = GridHelper.getGridKey(position);

    this.paths.set(key, path);
    this.scene.add(path.mesh);
    this.pathfinding.registerPath(position);
    this.refreshPathConnectionsAround(position);

    return path;
  }

  public placeRide(position: GridPosition, rideType: RideType): Ride | null {
    if (!this.canPlaceBuilding(position, BuildingType.RIDE, rideType)) return null;

    const footprintCells = this.getRideFootprintCells(position, rideType);
    const accessCell = this.findAccessCell(footprintCells)!;
    const id = `ride_${this.buildingIdCounter++}`;
    const ride = new Ride(position, rideType, id, accessCell);
    const anchorKey = GridHelper.getGridKey(position);

    this.rides.set(anchorKey, ride);
    footprintCells.forEach(cell => this.occupiedCells.set(GridHelper.getGridKey(cell), anchorKey));
    this.scene.add(ride.mesh);
    this.ridesCache = null;

    return ride;
  }

  public placeShop(position: GridPosition, shopType: ShopType): Shop | null {
    if (!this.canPlaceBuilding(position, BuildingType.SHOP, shopType)) return null;

    const accessCell = GridHelper.getAdjacentPositions(position).find(neighbor => this.pathfinding.hasPath(neighbor))!;
    const id = `shop_${this.buildingIdCounter++}`;
    const shop = new Shop(position, shopType, id, accessCell);
    const key = GridHelper.getGridKey(position);

    this.shops.set(key, shop);
    this.occupiedCells.set(key, key);
    this.scene.add(shop.mesh);
    this.shopsCache = null;

    return shop;
  }

  public placeService(position: GridPosition, serviceType: ServiceType): Service | null {
    if (!this.canPlaceBuilding(position, BuildingType.SERVICE, serviceType)) return null;

    const accessCell = GridHelper.getAdjacentPositions(position).find(neighbor => this.pathfinding.hasPath(neighbor))!;
    const id = `service_${this.buildingIdCounter++}`;
    const service = new Service(position, serviceType, id, accessCell);
    const key = GridHelper.getGridKey(position);

    this.services.set(key, service);
    this.occupiedCells.set(key, key);
    this.scene.add(service.mesh);
    this.servicesCache = null;

    return service;
  }

  public placeDecoration(position: GridPosition, decorationType: DecorationType): Decoration | null {
    if (!this.canPlaceBuilding(position, BuildingType.DECORATION, decorationType)) return null;

    const id = `decoration_${this.buildingIdCounter++}`;
    const decoration = new Decoration(position, decorationType, id);
    const key = GridHelper.getGridKey(position);

    this.decorations.set(key, decoration);
    this.occupiedCells.set(key, key);
    this.scene.add(decoration.mesh);
    this.decorationsCache = null;

    return decoration;
  }

  public removeBuilding(position: GridPosition): boolean {
    const key = GridHelper.getGridKey(position);

    if (this.paths.has(key)) {
      const path = this.paths.get(key)!;
      this.scene.remove(path.mesh);
      path.dispose();
      this.paths.delete(key);
      this.pathfinding.unregisterPath(position);
      this.refreshPathConnectionsAround(position);
      return true;
    }

    if (!this.occupiedCells.has(key)) return false;

    const anchorKey = this.occupiedCells.get(key)!;

    if (this.rides.has(anchorKey)) {
      const ride = this.rides.get(anchorKey)!;
      this.getRideFootprintCells(ride.data.position, ride.data.rideType).forEach(cell => {
        this.occupiedCells.delete(GridHelper.getGridKey(cell));
      });
      this.scene.remove(ride.mesh);
      ride.dispose();
      this.rides.delete(anchorKey);
      this.ridesCache = null;
      return true;
    }

    if (this.shops.has(anchorKey)) {
      const shop = this.shops.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(shop.mesh);
      shop.dispose();
      this.shops.delete(anchorKey);
      this.shopsCache = null;
      return true;
    }

    if (this.services.has(anchorKey)) {
      const service = this.services.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(service.mesh);
      service.dispose();
      this.services.delete(anchorKey);
      this.servicesCache = null;
      return true;
    }

    if (this.decorations.has(anchorKey)) {
      const decoration = this.decorations.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(decoration.mesh);
      decoration.dispose();
      this.decorations.delete(anchorKey);
      this.decorationsCache = null;
      return true;
    }

    return false;
  }

  public update(deltaTime: number): void {
    this.rides.forEach(ride => ride.update(deltaTime));
  }

  public getRides(): Ride[] {
    if (!this.ridesCache) this.ridesCache = Array.from(this.rides.values());
    return this.ridesCache;
  }

  public getShops(): Shop[] {
    if (!this.shopsCache) this.shopsCache = Array.from(this.shops.values());
    return this.shopsCache;
  }

  public getServices(): Service[] {
    if (!this.servicesCache) this.servicesCache = Array.from(this.services.values());
    return this.servicesCache;
  }

  public getDecorations(): Decoration[] {
    if (!this.decorationsCache) this.decorationsCache = Array.from(this.decorations.values());
    return this.decorationsCache;
  }

  public getBuildingAtCell(position: GridPosition):
    | { ride: Ride }
    | { shop: Shop }
    | { service: Service }
    | { decoration: Decoration }
    | null {
    const key = GridHelper.getGridKey(position);
    if (!this.occupiedCells.has(key)) return null;

    const anchorKey = this.occupiedCells.get(key)!;
    if (this.rides.has(anchorKey)) return { ride: this.rides.get(anchorKey)! };
    if (this.shops.has(anchorKey)) return { shop: this.shops.get(anchorKey)! };
    if (this.services.has(anchorKey)) return { service: this.services.get(anchorKey)! };
    if (this.decorations.has(anchorKey)) return { decoration: this.decorations.get(anchorKey)! };
    return null;
  }

  public updateBuildingPrice(position: GridPosition, newPrice: number): boolean {
    const result = this.getBuildingAtCell(position);
    if (!result) return false;
    if ('ride' in result) {
      result.ride.data.price = newPrice;
      return true;
    }
    if ('shop' in result) {
      result.shop.data.price = newPrice;
      return true;
    }
    if ('service' in result) {
      result.service.data.price = newPrice;
      return true;
    }
    return false;
  }

  public getBuildingCounts(): Record<BuildingType, number> {
    return {
      [BuildingType.PATH]: this.paths.size,
      [BuildingType.RIDE]: this.rides.size,
      [BuildingType.SHOP]: this.shops.size,
      [BuildingType.SERVICE]: this.services.size,
      [BuildingType.DECORATION]: this.decorations.size,
      [BuildingType.DELETE]: 0
    };
  }

  public getFacilityScore(): number {
    return this.rides.size * 4 + this.shops.size * 3 + this.services.size * 3 + this.decorations.size * 2 + this.paths.size;
  }

  public getDecorationAppeal(): number {
    return this.getDecorations().reduce((total, decoration) => total + decoration.data.appealBonus, 0) / 2;
  }

  public getLocalDecorationBonus(position: GridPosition): number {
    let total = 0;
    this.getDecorations().forEach(decoration => {
      const distance = GridHelper.getDistance(position, decoration.data.position);
      if (distance <= decoration.data.appealRadius) {
        total += Math.max(0, decoration.data.appealBonus - distance);
      }
    });
    return total;
  }

  public clear(): void {
    this.paths.forEach(path => {
      this.scene.remove(path.mesh);
      path.dispose();
    });
    this.paths.clear();

    this.rides.forEach(ride => {
      this.scene.remove(ride.mesh);
      ride.dispose();
    });
    this.rides.clear();
    this.ridesCache = null;

    this.shops.forEach(shop => {
      this.scene.remove(shop.mesh);
      shop.dispose();
    });
    this.shops.clear();
    this.shopsCache = null;

    this.services.forEach(service => {
      this.scene.remove(service.mesh);
      service.dispose();
    });
    this.services.clear();
    this.servicesCache = null;

    this.decorations.forEach(decoration => {
      this.scene.remove(decoration.mesh);
      decoration.dispose();
    });
    this.decorations.clear();
    this.decorationsCache = null;

    this.occupiedCells.clear();
  }
}
