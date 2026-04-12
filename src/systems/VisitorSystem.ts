import * as THREE from 'three';
import { Decoration } from '../entities/Decoration';
import { Ride } from '../entities/Ride';
import { Service } from '../entities/Service';
import { Shop } from '../entities/Shop';
import { Visitor } from '../entities/Visitor';
import { PathfindingSystem } from './PathfindingSystem';
import { GridHelper } from '../utils/GridHelper';
import { GridPosition, ShopType, VisitorNeedType, VisitorThought } from '../types';

type VisitorTargetType = 'ride' | 'shop' | 'service' | 'wander';

interface VisitorTarget {
  type: VisitorTargetType;
  id: string;
}

interface SimulationEntities {
  rides: Ride[];
  shops: Shop[];
  services: Service[];
  decorations: Decoration[];
  getLocalDecorationBonus: (position: GridPosition) => number;
  isOpen: boolean;
}

interface TargetChoice {
  id: string;
  type: 'ride' | 'shop' | 'service';
  score: number;
  path: GridPosition[];
}

export class VisitorSystem {
  private visitors: Map<string, Visitor> = new Map();
  private visitorTargets: Map<string, VisitorTarget> = new Map();
  private scene: THREE.Scene;
  private pathfinding: PathfindingSystem;
  private spawnTimer = 0;
  private spawnInterval = 15 + Math.random() * 8;
  private entrancePosition: GridPosition = { x: 0, z: 0 };
  private visitorIdCounter = 0;
  private readonly maxVisitors = 22;

  public onVisitorSpawn: (() => void) | null = null;
  public onVisitorLeave: (() => void) | null = null;
  public onVisitorSpend: ((amount: number) => void) | null = null;

  constructor(scene: THREE.Scene, pathfinding: PathfindingSystem) {
    this.scene = scene;
    this.pathfinding = pathfinding;
  }

  public setEntrancePosition(position: GridPosition): void {
    this.entrancePosition = position;
  }

  public update(deltaTime: number, entities: SimulationEntities): void {
    this.spawnTimer += deltaTime;
    if (entities.isOpen && this.spawnTimer >= this.spawnInterval && this.visitors.size < this.maxVisitors) {
      this.spawnVisitor();
      this.spawnTimer = 0;
      this.spawnInterval = 15 + Math.random() * 8;
    }

    const densityMap = this.buildDensityMap();
    const toRemove: string[] = [];

    this.visitors.forEach((visitor, id) => {
      visitor.update(deltaTime);
      this.tryShowAmbientMood(visitor);

      if (visitor.data.needs.money <= 0 || visitor.data.needs.happiness < 15) {
        toRemove.push(id);
        return;
      }

      // If park is closed, visitors head to the entrance and leave gradually
      if (!entities.isOpen) {
        const gridPos = GridHelper.worldToGrid(visitor.data.position);
        const distToEntrance = Math.abs(gridPos.x - this.entrancePosition.x) + Math.abs(gridPos.z - this.entrancePosition.z);
        if (distToEntrance < 2) {
          toRemove.push(id);
          return;
        }
      }

      if (!visitor.data.targetPosition && !visitor.data.currentActivity) {
        const target = this.visitorTargets.get(id);
        if (target) {
          this.handleArrival(visitor, target, entities, densityMap);
          if (!visitor.data.currentActivity) {
            this.assignNewActivity(visitor, entities, densityMap);
          }
        } else {
          this.assignNewActivity(visitor, entities, densityMap);
        }
      }
    });

    toRemove.forEach(id => {
      this.removeVisitor(id);
      this.onVisitorLeave?.();
    });
  }

  private handleArrival(
    visitor: Visitor,
    target: VisitorTarget,
    entities: SimulationEntities,
    densityMap: Map<string, number>
  ): void {
    this.visitorTargets.delete(visitor.data.id);

    if (target.type === 'ride') {
      const ride = entities.rides.find(item => item.data.id === target.id);
      if (!ride) return;

      visitor.faceWorldPosition(ride.mesh.position);

      const fairness = this.getPriceFairness(ride.data.price, ride.data.valueScore, ride.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(ride.data.price)) {
        this.onVisitorSpend?.(ride.data.price);
        const decorBonus = Math.min(entities.getLocalDecorationBonus(ride.data.accessCell), 20);
        const funBoost = Math.min(100, ride.data.funFactor * (ride.data.price / 5) + decorBonus);
        visitor.boostFun(funBoost);
        visitor.markRideUsed(ride.data.id);
        visitor.startActivity('ride', ride.data.duration);
        if (fairness < 0.45) visitor.adjustHappiness(-6);
      }
      return;
    }

    if (target.type === 'shop') {
      const shop = entities.shops.find(item => item.data.id === target.id);
      if (!shop) return;

      const fairness = this.getPriceFairness(shop.data.price, shop.data.valueScore, shop.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(shop.data.price)) {
        visitor.faceWorldPosition(shop.mesh.position);
        this.onVisitorSpend?.(shop.data.price);
        Object.entries(shop.data.satisfactionEffects).forEach(([need, amount]) => {
          visitor.boostNeed(need as VisitorNeedType, amount ?? 0);
        });
        if (shop.data.shopType === ShopType.GIFT_SHOP) {
          visitor.adjustHappiness(fairness < 0.45 ? -3 : 4);
        } else if (fairness < 0.45) {
          visitor.adjustHappiness(-4);
        }
        visitor.showMoodWithOptions({
          kind: 'shopping',
          emoji: this.getShopActivityEmoji(shop.data.shopType),
          message: 'Buying something.',
          duration: 10,
        }, { force: true, cooldownSeconds: 2 });
        visitor.startActivity('shop', 10);
      }
      return;
    }

    if (target.type === 'service') {
      const service = entities.services.find(item => item.data.id === target.id);
      if (!service) return;

      const fairness = this.getPriceFairness(service.data.price, service.data.valueScore, service.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(service.data.price)) {
        visitor.faceWorldPosition(service.mesh.position);
        this.onVisitorSpend?.(service.data.price);
        Object.entries(service.data.satisfactionEffects).forEach(([need, amount]) => {
          visitor.boostNeed(need as VisitorNeedType, amount ?? 0);
        });
        if (fairness < 0.5) visitor.adjustHappiness(-2);
        visitor.showMoodWithOptions({
          kind: 'shopping',
          emoji: '🚻',
          message: 'Using the restroom.',
          duration: 8,
        }, { force: true, cooldownSeconds: 2 });
        visitor.startActivity('service', 8);
      }
      return;
    }

    const currentGridPos = GridHelper.worldToGrid(visitor.data.position);
    const localDensity = densityMap.get(GridHelper.getGridKey(currentGridPos)) ?? 0;
    if (localDensity > 3) {
      this.showPriorityMood(visitor, {
        kind: 'crowded',
        emoji: '😤',
        message: 'This path is too crowded.',
        duration: 1.9,
      });
      visitor.adjustHappiness(-2);
    }
  }

  private spawnVisitor(): void {
    if (!this.pathfinding.hasPath(this.entrancePosition)) return;

    const id = `visitor_${this.visitorIdCounter++}`;
    const visitor = new Visitor(id, this.entrancePosition);
    this.visitors.set(id, visitor);
    this.scene.add(visitor.mesh);
    this.onVisitorSpawn?.();
  }

  private assignNewActivity(
    visitor: Visitor,
    entities: SimulationEntities,
    densityMap: Map<string, number>
  ): void {
    const currentGridPos = GridHelper.worldToGrid(visitor.data.position);
    if (!this.pathfinding.hasPath(currentGridPos)) return;

    const rideChoice = this.selectBestRide(visitor, currentGridPos, entities.rides, densityMap, entities.getLocalDecorationBonus);
    const shopChoice = this.selectBestShop(visitor, currentGridPos, entities.shops, densityMap, entities.getLocalDecorationBonus);
    const serviceChoice = this.selectBestService(visitor, currentGridPos, entities.services, densityMap);
    const options: TargetChoice[] = [rideChoice, shopChoice, serviceChoice].filter(
      (value): value is TargetChoice => value !== null
    );
    options.sort((a, b) => b.score - a.score);

    if (options.length > 0 && options[0].score > 0.12 && entities.isOpen) {
      const best = options[0];
      visitor.setPath(best.path);
      this.visitorTargets.set(visitor.data.id, { type: best.type, id: best.id });
      visitor.setThought(null);
      return;
    }

    this.visitorTargets.delete(visitor.data.id);
    // If closed or no good activity, either head to entrance (if closed) or wander
    const targetPos = entities.isOpen ? this.pathfinding.getRandomPathPosition() : this.entrancePosition;
    if (!targetPos) return;

    const path = this.pathfinding.findPath(currentGridPos, targetPos);
    if (path.length > 0) {
      visitor.setPath(path);
      const wanderType = entities.isOpen ? 'wander' : 'leaving';
      this.visitorTargets.set(visitor.data.id, { type: 'wander', id: `${wanderType}:${targetPos.x},${targetPos.z}` });
      if (entities.isOpen && (densityMap.get(GridHelper.getGridKey(currentGridPos)) ?? 0) > 3) {
        this.showPriorityMood(visitor, {
          kind: 'crowded',
          emoji: '😤',
          message: 'Need some breathing room.',
          duration: 1.8,
        });
      }
    }
  }

  private selectBestRide(
    visitor: Visitor,
    current: GridPosition,
    rides: Ride[],
    densityMap: Map<string, number>,
    getLocalDecorationBonus: (position: GridPosition) => number
  ): TargetChoice | null {
    const funNeed = (100 - visitor.data.needs.fun) / 100;
    if (funNeed < 0.12) return null;

    return this.pickBestTarget(
      rides.filter(ride => visitor.canUseRide(ride.data.id)).map(ride => ({
        id: ride.data.id,
        type: 'ride' as const,
        accessCell: ride.data.accessCell,
        baseNeedScore: funNeed * (ride.data.funFactor / 40),
        price: ride.data.price,
        valueScore: ride.data.valueScore,
        quality: ride.data.quality,
        decorationBonus: getLocalDecorationBonus(ride.data.accessCell)
      })),
      current,
      visitor,
      densityMap
    );
  }

  private selectBestShop(
    visitor: Visitor,
    current: GridPosition,
    shops: Shop[],
    densityMap: Map<string, number>,
    getLocalDecorationBonus: (position: GridPosition) => number
  ): TargetChoice | null {
    const hungerNeed = (100 - visitor.data.needs.hunger) / 100;
    const thirstNeed = (100 - visitor.data.needs.thirst) / 100;
    const giftNeed = visitor.data.needs.money > 25 && visitor.data.needs.happiness > 45 ? 0.18 : 0;

    return this.pickBestTarget(
      shops.map(shop => {
        const needScore = shop.data.shopType === ShopType.FOOD_STALL
          ? hungerNeed
          : shop.data.shopType === ShopType.DRINK_STAND
            ? thirstNeed
            : giftNeed;

        return {
          id: shop.data.id,
          type: 'shop' as const,
          accessCell: shop.data.accessCell,
          baseNeedScore: needScore * (shop.data.quality / 55),
          price: shop.data.price,
          valueScore: shop.data.valueScore,
          quality: shop.data.quality,
          decorationBonus: getLocalDecorationBonus(shop.data.accessCell)
        };
      }),
      current,
      visitor,
      densityMap
    );
  }

  private selectBestService(
    visitor: Visitor,
    current: GridPosition,
    services: Service[],
    densityMap: Map<string, number>
  ): TargetChoice | null {
    const hygieneNeed = (100 - visitor.data.needs.hygiene) / 100;
    if (hygieneNeed < 0.1) return null;

    return this.pickBestTarget(
      services.map(service => ({
        id: service.data.id,
        type: 'service' as const,
        accessCell: service.data.accessCell,
        baseNeedScore: hygieneNeed * (service.data.quality / 50),
        price: service.data.price,
        valueScore: Math.max(1, service.data.valueScore),
        quality: service.data.quality,
        decorationBonus: 0
      })),
      current,
      visitor,
      densityMap
    );
  }

  private pickBestTarget(
    candidates: Array<{
      id: string;
      type: 'ride' | 'shop' | 'service';
      accessCell: GridPosition;
      baseNeedScore: number;
      price: number;
      valueScore: number;
      quality: number;
      decorationBonus: number;
    }>,
    current: GridPosition,
    visitor: Visitor,
    densityMap: Map<string, number>
  ): TargetChoice | null {
    let best: TargetChoice | null = null;

    candidates.forEach(candidate => {
      if (candidate.baseNeedScore <= 0 || visitor.data.needs.money < candidate.price) return;

      const path = this.pathfinding.findPath(current, candidate.accessCell);
      if (path.length <= 1) return; // Skip if already at destination

      const fairness = this.getPriceFairness(candidate.price, candidate.valueScore, candidate.quality);
      const density = densityMap.get(GridHelper.getGridKey(candidate.accessCell)) ?? 0;
      const travelPenalty = Math.min(path.length / 30, 0.45);
      const densityPenalty = Math.min(density * 0.08, 0.32);
      const decorBonus = Math.min(candidate.decorationBonus / 40, 0.18);
      const score = candidate.baseNeedScore * 0.6 + fairness * 0.25 + decorBonus - travelPenalty - densityPenalty;

      if (!best || score > best.score) {
        best = { id: candidate.id, type: candidate.type, score, path };
      }
    });

    return best;
  }

  private getPriceFairness(price: number, valueScore: number, quality: number): number {
    const expectedPrice = valueScore * 0.8 + quality * 0.08;
    return Math.max(0.1, Math.min(1, expectedPrice / Math.max(price, 1)));
  }

  private acceptPrice(visitor: Visitor, fairness: number, thoughtType: 'price'): boolean {
    const priceTolerance = Math.max(0.1, Math.min(0.95, fairness + visitor.data.needs.happiness / 200));
    if (Math.random() <= priceTolerance) {
      visitor.clearMood('price');
      return true;
    }

    this.showPriorityMood(visitor, {
      kind: thoughtType,
      emoji: '💸',
      message: 'Too expensive for what it offers.',
      duration: 2.1,
    });
    visitor.adjustHappiness(-3);
    return false;
  }

  private showPriorityMood(visitor: Visitor, mood: VisitorThought): void {
    if (!visitor.canShowMood(mood.kind)) return;
    visitor.showMood(mood);
  }

  private tryShowAmbientMood(visitor: Visitor): void {
    const needs = visitor.data.needs;

    const hungerSeverity = THREE.MathUtils.clamp((55 - needs.hunger) / 35, 0, 1);
    const thirstSeverity = THREE.MathUtils.clamp((60 - needs.thirst) / 35, 0, 1);
    const boredSeverity = THREE.MathUtils.clamp((40 - needs.fun) / 25, 0, 1);
    const sadSeverity = THREE.MathUtils.clamp((38 - needs.happiness) / 22, 0, 1);
    const sickSeverity = THREE.MathUtils.clamp((18 - needs.hygiene) / 14, 0, 1);
    const happySeverity = THREE.MathUtils.clamp((needs.happiness - 78) / 18, 0, 1);

    const moods: Array<{ thought: VisitorThought; threshold: boolean; chancePerTick: number }> = [
      {
        thought: { kind: 'sick', emoji: '🤢', message: 'This place feels gross.', duration: 2.1 },
        threshold: sickSeverity > 0,
        chancePerTick: 0.003 + sickSeverity * 0.012,
      },
      {
        thought: { kind: 'hunger', emoji: '🍔', message: 'I need food.', duration: 1.9 },
        threshold: hungerSeverity > 0,
        chancePerTick: 0.008 + hungerSeverity * 0.02,
      },
      {
        thought: { kind: 'thirst', emoji: '🥤', message: 'I need a drink.', duration: 1.9 },
        threshold: thirstSeverity > 0,
        chancePerTick: 0.008 + thirstSeverity * 0.02,
      },
      {
        thought: { kind: 'bored', emoji: '🥱', message: 'This park needs more fun.', duration: 1.8 },
        threshold: boredSeverity > 0,
        chancePerTick: 0.005 + boredSeverity * 0.012,
      },
      {
        thought: { kind: 'sad', emoji: '☹️', message: 'I am not having a great time.', duration: 1.8 },
        threshold: sadSeverity > 0,
        chancePerTick: 0.004 + sadSeverity * 0.01,
      },
      {
        thought: { kind: 'happy', emoji: '😊', message: 'This place is great!', duration: 1.7 },
        threshold: happySeverity > 0,
        chancePerTick: 0.0015 + happySeverity * 0.003,
      },
    ];

    for (const mood of moods) {
      if (!mood.threshold) continue;
      if (!visitor.canShowMood(mood.thought.kind)) continue;
      if (Math.random() > mood.chancePerTick) continue;
      visitor.showMood(mood.thought);
      return;
    }
  }

  private getShopActivityEmoji(type: ShopType): string {
    switch (type) {
      case ShopType.FOOD_STALL:
        return '🍲';
      case ShopType.DRINK_STAND:
        return '🥤';
      case ShopType.GIFT_SHOP:
        return '🛍️';
      default:
        return '🛒';
    }
  }

  private buildDensityMap(): Map<string, number> {
    const map = new Map<string, number>();
    this.visitors.forEach(visitor => {
      const current = GridHelper.worldToGrid(visitor.data.position);
      const key = GridHelper.getGridKey(current);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }

  public removeVisitor(id: string): void {
    const visitor = this.visitors.get(id);
    if (!visitor) return;

    this.scene.remove(visitor.mesh);
    visitor.dispose();
    this.visitors.delete(id);
    this.visitorTargets.delete(id);
  }

  public getVisitorCount(): number {
    return this.visitors.size;
  }

  public getAverageHappiness(): number {
    if (this.visitors.size === 0) return 50;
    let total = 0;
    this.visitors.forEach(visitor => {
      total += visitor.data.needs.happiness;
    });
    return total / this.visitors.size;
  }

  public clear(): void {
    this.visitors.forEach(visitor => {
      this.scene.remove(visitor.mesh);
      visitor.dispose();
    });
    this.visitors.clear();
    this.visitorTargets.clear();
  }
}
