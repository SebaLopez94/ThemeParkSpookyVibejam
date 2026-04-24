import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  SavedBuildingsData,
  ServiceType,
  ShopType
} from '../types';
import { GridHelper } from '../utils/GridHelper';
import { PathfindingSystem } from './PathfindingSystem';

// ---------------------------------------------------------------------------
// Maintenance cost tables — module-level constants so they are never
// re-allocated inside getMaintenanceChargePerInterval(), which is called
// every frame from Game.update().
// ---------------------------------------------------------------------------
const RIDE_MAINTENANCE: Record<RideType, number> = {
  [RideType.CAROUSEL]:        4,
  [RideType.FERRIS_WHEEL]:    6,
  [RideType.ROLLER_COASTER]: 10,
  [RideType.HAUNTED_HOUSE]:   7,
  [RideType.PIRATE_SHIP]:     7,
  [RideType.KRAKEN_RIDE]:     9,
  [RideType.INFERNAL_TOWER]:  8,
};

const SHOP_MAINTENANCE: Record<ShopType, number> = {
  [ShopType.FOOD_STALL]:  3,
  [ShopType.DRINK_STAND]: 2,
  [ShopType.GIFT_SHOP]:   3,
};

const SERVICE_MAINTENANCE: Record<ServiceType, number> = {
  [ServiceType.RESTROOM]: 3,
};

export class BuildingSystem {
  private scene: THREE.Scene;
  private pathfinding: PathfindingSystem;
  private paths: Map<number, Path> = new Map();
  private rides: Map<number, Ride> = new Map();
  private shops: Map<number, Shop> = new Map();
  private services: Map<number, Service> = new Map();
  private decorations: Map<number, Decoration> = new Map();
  private occupiedCells: Map<number, number> = new Map();
  private buildingIdCounter = 0;


  private ridesCache: Ride[] | null = null;
  private shopsCache: Shop[] | null = null;
  private servicesCache: Service[] | null = null;
  private decorationsCache: Decoration[] | null = null;
  private decorationBonusCache: Map<number, number> = new Map();
  private hygienesBonusCache:   Map<number, number> = new Map();
  /** Cached total decoration appeal — invalidated when any decoration is added/removed. */
  private decorationAppealCache: number | null = null;
  /**
   * Cached maintenance total — invalidated whenever any building is added or
   * removed.  Turns a per-frame reduce() across all buildings into an O(1)
   * lookup; the value only changes on user interaction, never during simulation.
   */
  private maintenanceCache: number | null = null;

  /**
   * Single merged Mesh that represents ALL path tiles.
   * Reduces N draw calls (one per tile) to exactly 1.
   * Rebuilt only when paths are added, removed, or change connections.
   */
  private pathMergedMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, pathfinding: PathfindingSystem) {
    this.scene = scene;
    this.pathfinding = pathfinding;
  }

  /**
   * Merges every path tile's world-space geometry into one Mesh.
   * Called after any path placement, removal, or connection update.
   * Cost: O(tiles × 16 verts) — only runs on user interaction, never per-frame.
   */
  private rebuildMergedPathMesh(): void {
    if (this.paths.size === 0) {
      if (this.pathMergedMesh) {
        this.scene.remove(this.pathMergedMesh);
        this.pathMergedMesh.geometry.dispose();
        this.pathMergedMesh = null;
      }
      return;
    }

    // Clone + world-transform each tile's geometry for merging.
    const geos = Array.from(this.paths.values()).map(p => p.cloneTransformedGeometry());
    const merged = mergeGeometries(geos, false);
    // Dispose temporary clones immediately — merged owns the data now.
    geos.forEach(g => g.dispose());

    if (this.pathMergedMesh) {
      // Reuse the existing Mesh object; only swap the geometry.
      this.pathMergedMesh.geometry.dispose();
      this.pathMergedMesh.geometry = merged;
    } else {
      // Import sharedPathMaterial from Path module via the first path instance.
      const anyPath = this.paths.values().next().value!;
      // Access the material through the planeMesh (exposed via the mesh's first child).
      const mat = (anyPath.mesh.children[0] as THREE.Mesh).material as THREE.Material;
      this.pathMergedMesh = new THREE.Mesh(merged, mat);
      this.pathMergedMesh.receiveShadow = true;
      // World-space geometry → mesh stays at origin with no rotation.
      this.pathMergedMesh.position.set(0, 0, 0);
      this.scene.add(this.pathMergedMesh);
    }
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
    // Geometries may have changed (corner rounding updates) — rebuild the merged mesh.
    this.rebuildMergedPathMesh();
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
    // Individual path meshes are NOT added to the scene — the single merged
    // mesh (rebuilt by refreshPathConnectionsAround) covers all tiles at once.
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
    this.maintenanceCache = null;

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
    this.maintenanceCache = null;

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
    this.maintenanceCache = null;

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
    this.maintenanceCache = null;
    this.decorationAppealCache = null;
    this.decorationBonusCache.clear();
    this.hygienesBonusCache.clear();

    return decoration;
  }

  public removeBuilding(position: GridPosition): boolean {
    const key = GridHelper.getGridKey(position);

    if (this.paths.has(key)) {
      const path = this.paths.get(key)!;
      // Individual mesh was never added to scene; just dispose its geometry.
      path.dispose();
      this.paths.delete(key);
      this.pathfinding.unregisterPath(position);
      // refreshPathConnectionsAround triggers rebuildMergedPathMesh internally.
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
      this.maintenanceCache = null;
      return true;
    }

    if (this.shops.has(anchorKey)) {
      const shop = this.shops.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(shop.mesh);
      shop.dispose();
      this.shops.delete(anchorKey);
      this.shopsCache = null;
      this.maintenanceCache = null;
      return true;
    }

    if (this.services.has(anchorKey)) {
      const service = this.services.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(service.mesh);
      service.dispose();
      this.services.delete(anchorKey);
      this.servicesCache = null;
      this.maintenanceCache = null;
      return true;
    }

    if (this.decorations.has(anchorKey)) {
      const decoration = this.decorations.get(anchorKey)!;
      this.occupiedCells.delete(anchorKey);
      this.scene.remove(decoration.mesh);
      decoration.dispose();
      this.decorations.delete(anchorKey);
      this.decorationsCache = null;
      this.maintenanceCache = null;
      this.decorationAppealCache = null;
      this.decorationBonusCache.clear();
      this.hygienesBonusCache.clear();
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

  /**
   * Returns the total maintenance cost per charge interval.
   * Result is cached and only recomputed when buildings are added or removed —
   * the previous implementation allocated 3 Record objects and ran 4 reduce()
   * passes on every call, which Game.update() invokes every frame.
   */
  public getMaintenanceChargePerInterval(): number {
    if (this.maintenanceCache !== null) return this.maintenanceCache;

    let total = 0;
    this.rides.forEach(ride => { total += RIDE_MAINTENANCE[ride.data.rideType]; });
    this.shops.forEach(shop => { total += SHOP_MAINTENANCE[shop.data.shopType]; });
    this.services.forEach(service => { total += SERVICE_MAINTENANCE[service.data.serviceType]; });
    this.decorations.forEach(decoration => {
      if (
        decoration.data.decorationType === DecorationType.LANTERN ||
        decoration.data.decorationType === DecorationType.TRASH_CUBE
      ) total += 1;
    });

    this.maintenanceCache = total;
    return total;
  }

  public exportSaveData(): SavedBuildingsData {
    return {
      paths: Array.from(this.paths.values()).map(path => ({
        position: { ...path.data.position }
      })),
      rides: this.getRides().map(ride => ({
        position: { ...ride.data.position },
        subType: ride.data.rideType,
        price: ride.data.price
      })),
      shops: this.getShops().map(shop => ({
        position: { ...shop.data.position },
        subType: shop.data.shopType,
        price: shop.data.price
      })),
      services: this.getServices().map(service => ({
        position: { ...service.data.position },
        subType: service.data.serviceType
      })),
      decorations: this.getDecorations().map(decoration => ({
        position: { ...decoration.data.position },
        subType: decoration.data.decorationType
      }))
    };
  }

  public getFacilityScore(): number {
    return this.rides.size * 4 + this.shops.size * 3 + this.services.size * 3 + this.decorations.size * 2 + this.paths.size;
  }

  public getDecorationAppeal(): number {
    if (this.decorationAppealCache !== null) return this.decorationAppealCache;
    let total = 0;
    // Iterate the Map directly — avoids the getDecorations() array allocation
    // and skips the cache-null check when decorations have recently changed.
    this.decorations.forEach(d => { total += d.data.appealBonus; });
    this.decorationAppealCache = total / 2;
    return this.decorationAppealCache;
  }

  public getLocalDecorationBonus(position: GridPosition): number {
    const key = GridHelper.getGridKey(position);
    const cached = this.decorationBonusCache.get(key);
    if (cached !== undefined) return cached;

    let total = 0;
    // Iterate the Map directly — avoids the getDecorations() array allocation.
    this.decorations.forEach(decoration => {
      const distance = GridHelper.getDistance(position, decoration.data.position);
      if (distance <= decoration.data.appealRadius) {
        total += Math.max(0, decoration.data.appealBonus - distance);
      }
    });
    this.decorationBonusCache.set(key, total);
    return total;
  }

  public getLocalHygieneBonus(position: GridPosition): number {
    const key = GridHelper.getGridKey(position);
    const cached = this.hygienesBonusCache.get(key);
    if (cached !== undefined) return cached;

    let total = 0;
    // Iterate the Map directly — avoids the getDecorations() array allocation.
    this.decorations.forEach(decoration => {
      const radius = decoration.data.hygieneRadius ?? 0;
      const bonus  = decoration.data.hygieneBonus  ?? 0;
      if (radius <= 0 || bonus <= 0) return;
      const distance = Math.abs(decoration.data.position.x - position.x) + Math.abs(decoration.data.position.z - position.z);
      if (distance <= radius) total += Math.max(0, bonus - distance * 3);
    });

    this.hygienesBonusCache.set(key, total);
    return total;
  }

  public clear(): void {
    this.paths.forEach(path => path.dispose());
    this.paths.clear();
    this.pathfinding.clear();

    // Remove and dispose the single merged path mesh.
    if (this.pathMergedMesh) {
      this.scene.remove(this.pathMergedMesh);
      this.pathMergedMesh.geometry.dispose();
      this.pathMergedMesh = null;
    }

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
    this.maintenanceCache = null;
    this.decorationAppealCache = null;
    this.decorationBonusCache.clear();
    this.hygienesBonusCache.clear();

    this.occupiedCells.clear();
    this.buildingIdCounter = 0;
  }
}
