import * as THREE from 'three';
import { Decoration } from '../entities/Decoration';
import { Ride } from '../entities/Ride';
import { Service } from '../entities/Service';
import { Shop } from '../entities/Shop';
import { Visitor } from '../entities/Visitor';
import { PathfindingSystem } from './PathfindingSystem';
import { GridHelper } from '../utils/GridHelper';
import { GridPosition, ShopType, VisitorNeedType, VisitorThought } from '../types';
import { isMobile } from '../utils/platform';

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
  getLocalHygieneBonus: (position: GridPosition) => number;
  isOpen: boolean;
  ticketPrice: number;
  parkRating: number;
}

interface TargetChoice {
  id: string;
  type: 'ride' | 'shop' | 'service';
  score: number;
  path: GridPosition[];
}

interface TargetCandidate {
  id: string;
  type: 'ride' | 'shop' | 'service';
  accessCell: GridPosition;
  baseNeedScore: number;
  price: number;
  valueScore: number;
  quality: number;
  decorationBonus: number;
}

export class VisitorSystem {
  private visitors: Map<string, Visitor> = new Map();
  private visitorTargets: Map<string, VisitorTarget> = new Map();
  private visitorDecisionCooldowns: Map<string, number> = new Map();
  private scene: THREE.Scene;
  private pathfinding: PathfindingSystem;
  private spawnTimer = 0;
  private spawnInterval = 15 + Math.random() * 8;
  private restoreSpawnRemaining = 0;
  private restoreSpawnTimer = 0;
  private restoreSpawnInterval = 0.22;
  private entrancePosition: GridPosition = { x: 0, z: 0 };
  private visitorIdCounter = 0;
  // Mobile keeps far fewer visitors to avoid GPU/memory pressure.
  private readonly maxVisitors = isMobile() ? 35 : 200;
  private densityMapCache: Map<number, number> = new Map();
  private densityRefreshTimer = 0;
  private readonly densityRefreshInterval = 0.25;
  /** Reused each frame — avoids allocating a new string[] on every update tick. */
  private readonly toRemoveBuffer: string[] = [];
  /**
   * Scratch GridPosition reused every visitor-loop tick — eliminates one {x,z} allocation
   * per visitor per frame (200 visitors × 60fps = 12 000 objects/sec saved).
   * Never store a reference to this outside the synchronous forEach body.
   */
  private readonly _visitorGridPosScratch: GridPosition = { x: 0, z: 0 };

  /**
   * Pre-allocated candidate scratch arrays — reused across every visitor decision.
   * Reset with .length = 0 before each use; never held beyond the decision call.
   */
  private readonly _rideCandidates:    TargetCandidate[] = [];
  private readonly _shopCandidates:    TargetCandidate[] = [];
  private readonly _serviceCandidates: TargetCandidate[] = [];

  /**
   * Object pools for TargetCandidate — properties are overwritten before each use.
   * Eliminates ~4 000+ short-lived 8-property objects per second at 200 visitors.
   * Each pool grows lazily (push) if ever more buildings than the initial size exist.
   */
  private readonly _rideCandidatePool:    TargetCandidate[] = [];
  private readonly _shopCandidatePool:    TargetCandidate[] = [];
  private readonly _serviceCandidatePool: TargetCandidate[] = [];

  /**
   * Id → entity maps rebuilt only when the array references change.
   * Allows O(1) lookup in handleArrival instead of O(n) .find().
   */
  private ridesById:    Map<string, import('../entities/Ride').Ride>    = new Map();
  private shopsById:    Map<string, import('../entities/Shop').Shop>    = new Map();
  private servicesById: Map<string, import('../entities/Service').Service> = new Map();
  private _lastRidesRef:    unknown = null;
  private _lastShopsRef:    unknown = null;
  private _lastServicesRef: unknown = null;

  public onVisitorSpawn: (() => void) | null = null;
  public onVisitorRestoreSpawn: (() => void) | null = null;
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
    if (this.restoreSpawnRemaining > 0) {
      this.restoreSpawnTimer += deltaTime;
      while (
        this.restoreSpawnRemaining > 0 &&
        this.restoreSpawnTimer >= this.restoreSpawnInterval &&
        this.visitors.size < this.maxVisitors
      ) {
        this.restoreSpawnTimer -= this.restoreSpawnInterval;
        this.spawnVisitor(true);
      }
    }

    // Rebuild id-lookup maps only when the array references swap (O(n) rebuild, O(1) lookups).
    if (entities.rides !== this._lastRidesRef) {
      this._lastRidesRef = entities.rides;
      this.ridesById.clear();
      entities.rides.forEach(r => this.ridesById.set(r.data.id, r));
    }
    if (entities.shops !== this._lastShopsRef) {
      this._lastShopsRef = entities.shops;
      this.shopsById.clear();
      entities.shops.forEach(s => this.shopsById.set(s.data.id, s));
    }
    if (entities.services !== this._lastServicesRef) {
      this._lastServicesRef = entities.services;
      this.servicesById.clear();
      entities.services.forEach(s => this.servicesById.set(s.data.id, s));
    }

    this.spawnTimer += deltaTime;
    if (entities.isOpen && this.spawnTimer >= this.spawnInterval && this.visitors.size < this.maxVisitors) {
      this.spawnVisitor(false);
      this.spawnTimer = 0;
      this.spawnInterval = this.getNextSpawnInterval(entities);
    }

    this.densityRefreshTimer += deltaTime;
    if (this.densityRefreshTimer >= this.densityRefreshInterval) {
      this.densityRefreshTimer = 0;
      this.buildDensityMap();
    }
    const densityMap = this.densityMapCache;
    this.toRemoveBuffer.length = 0;
    const toRemove = this.toRemoveBuffer;
    const now = performance.now() / 1000;

    const gridScratch = this._visitorGridPosScratch;
    this.visitors.forEach((visitor, id) => {
      // worldToGridInto reuses gridScratch — no {x,z} allocation per visitor per frame.
      const visitorGridPos = GridHelper.worldToGridInto(visitor.data.position, gridScratch);
      const localHygieneSupport = entities.getLocalHygieneBonus(visitorGridPos);
      const hygieneDecayMultiplier = THREE.MathUtils.clamp(1 - localHygieneSupport / 100, 0.35, 1);
      visitor.update(deltaTime, hygieneDecayMultiplier);
      this.tryShowAmbientMood(visitor);

      if (visitor.data.needs.money <= 0) {
        toRemove.push(id);
        return;
      }

      // Natural leave arc: overtime in the park gradually lowers the leave threshold
      const overstayFactor = Math.max(0, visitor.data.timeInPark - visitor.data.naturalLeaveDuration) / 120;
      const leaveThreshold = 15 + overstayFactor * 25;
      if (visitor.data.needs.happiness < leaveThreshold) {
        toRemove.push(id);
        return;
      }

      // If park is closed, visitors head to the entrance and leave gradually
      if (!entities.isOpen) {
        const distToEntrance = Math.abs(visitorGridPos.x - this.entrancePosition.x) + Math.abs(visitorGridPos.z - this.entrancePosition.z);
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
            // Pass the already-computed grid pos — avoids a duplicate worldToGrid call inside.
            this.assignNewActivity(visitor, visitorGridPos, entities, densityMap);
            this.visitorDecisionCooldowns.set(id, now + 0.45);
          }
        } else {
          const nextDecisionAt = this.visitorDecisionCooldowns.get(id) ?? 0;
          if (now >= nextDecisionAt) {
            this.assignNewActivity(visitor, visitorGridPos, entities, densityMap);
            this.visitorDecisionCooldowns.set(id, now + 0.6 + Math.random() * 0.4);
          }
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
    densityMap: Map<number, number>
  ): void {
    this.visitorTargets.delete(visitor.data.id);

    if (target.type === 'ride') {
      const ride = this.ridesById.get(target.id);
      if (!ride) return;

      visitor.faceWorldPosition(ride.mesh.position);

      const fairness = this.getPriceFairness(ride.data.price, ride.data.valueScore, ride.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(ride.data.price)) {
        this.onVisitorSpend?.(ride.data.price);
        const decorBonus = Math.min(entities.getLocalDecorationBonus(ride.data.accessCell), 20);
        const funBoost = Math.min(100, ride.data.funFactor * (ride.data.quality / 60) + decorBonus);
        visitor.boostFun(funBoost);
        visitor.markRideUsed(ride.data.id);
        visitor.startActivity('ride', ride.data.duration);
        if (fairness < 0.45) visitor.adjustHappiness(-6);
        else visitor.adjustHappiness(3); // positive memory from a fair ride
      }
      return;
    }

    if (target.type === 'shop') {
      const shop = this.shopsById.get(target.id);
      if (!shop) return;

      const fairness = this.getPriceFairness(shop.data.price, shop.data.valueScore, shop.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(shop.data.price)) {
        visitor.faceWorldPosition(shop.mesh.position);
        this.onVisitorSpend?.(shop.data.price);
        // Avoid Object.entries() + forEach() allocation — iterate keys directly.
        for (const key in shop.data.satisfactionEffects) {
          visitor.boostNeed(key as VisitorNeedType, (shop.data.satisfactionEffects as Record<string, number>)[key] ?? 0);
        }
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
      const service = this.servicesById.get(target.id);
      if (!service) return;

      const fairness = this.getPriceFairness(service.data.price, service.data.valueScore, service.data.quality);
      if (!this.acceptPrice(visitor, fairness, 'price')) return;
      if (visitor.spendMoney(service.data.price)) {
        visitor.faceWorldPosition(service.mesh.position);
        this.onVisitorSpend?.(service.data.price);
        for (const key in service.data.satisfactionEffects) {
          visitor.boostNeed(key as VisitorNeedType, (service.data.satisfactionEffects as Record<string, number>)[key] ?? 0);
        }
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

  public scheduleRestoreVisitors(count: number): void {
    this.restoreSpawnRemaining = Math.max(0, Math.min(Math.round(count), this.maxVisitors));
    this.restoreSpawnTimer = 0;
  }

  private spawnVisitor(isRestoreSpawn: boolean): void {
    if (!this.pathfinding.hasPath(this.entrancePosition)) return;

    const id = `visitor_${this.visitorIdCounter++}`;
    const visitor = new Visitor(id, this.entrancePosition);
    this.visitors.set(id, visitor);
    this.visitorDecisionCooldowns.set(id, 0);
    this.scene.add(visitor.mesh);
    if (isRestoreSpawn) {
      this.restoreSpawnRemaining = Math.max(0, this.restoreSpawnRemaining - 1);
      this.onVisitorRestoreSpawn?.();
    } else {
      this.onVisitorSpawn?.();
    }
  }

  private getNextSpawnInterval(entities: SimulationEntities): number {
    const ratingFactor = THREE.MathUtils.clamp(entities.parkRating / 100, 0.1, 1);
    const fairTicket = 4 + ratingFactor * 12;
    const priceDemand = entities.ticketPrice <= fairTicket
      ? 1.08
      : THREE.MathUtils.clamp(fairTicket / Math.max(entities.ticketPrice, 1), 0.38, 1);
    const parkDemand = THREE.MathUtils.clamp(0.55 + ratingFactor * 0.9, 0.55, 1.35);
    const demand = parkDemand * priceDemand;
    const baseInterval = 10 + Math.random() * 8;

    return THREE.MathUtils.clamp(baseInterval / demand, 5.5, 24);
  }

  private assignNewActivity(
    visitor: Visitor,
    currentGridPos: GridPosition,
    entities: SimulationEntities,
    densityMap: Map<number, number>
  ): void {
    if (!this.pathfinding.hasPath(currentGridPos)) return;

    const rideChoice = this.selectBestRide(visitor, currentGridPos, entities.rides, densityMap, entities.getLocalDecorationBonus);
    const shopChoice = this.selectBestShop(visitor, currentGridPos, entities.shops, densityMap, entities.getLocalDecorationBonus);
    const serviceChoice = this.selectBestService(visitor, currentGridPos, entities.services, densityMap);

    // Pick best without allocating a temp array — inline three-way comparison
    let best: TargetChoice | null = null;
    if (rideChoice && (!best || rideChoice.score > best.score)) best = rideChoice;
    if (shopChoice && (!best || shopChoice.score > best.score)) best = shopChoice;
    if (serviceChoice && (!best || serviceChoice.score > best.score)) best = serviceChoice;

    if (best && best.score > 0.12 && entities.isOpen) {
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
    densityMap: Map<number, number>,
    getLocalDecorationBonus: (position: GridPosition) => number
  ): TargetChoice | null {
    const funNeed = (100 - visitor.data.needs.fun) / 100;
    if (funNeed < 0.12) return null;

    const p = visitor.data.personality;
    const personalityMult = p === 'thrill_seeker' ? 1.4 : p === 'foodie' ? 0.85 : 1.0;

    // Reuse pre-allocated scratch array + object pool — zero allocations per decision.
    const rideCandidates = this._rideCandidates;
    rideCandidates.length = 0;
    for (const ride of rides) {
      if (!visitor.canUseRide(ride.data.id)) continue;
      const useCount = visitor.data.rideUseCounts[ride.data.id] ?? 0;
      const varietyPenalty = Math.min(useCount * 0.12, 0.4);
      const idx = rideCandidates.length;
      // Grow pool lazily on first few playthroughs, then always reuses.
      if (idx >= this._rideCandidatePool.length) {
        this._rideCandidatePool.push({ id: '', type: 'ride', accessCell: { x: 0, z: 0 }, baseNeedScore: 0, price: 0, valueScore: 0, quality: 0, decorationBonus: 0 });
      }
      const c = this._rideCandidatePool[idx];
      c.id = ride.data.id;
      c.type = 'ride';
      c.accessCell = ride.data.accessCell;
      c.baseNeedScore = funNeed * (ride.data.funFactor / 40) * personalityMult * (1 - varietyPenalty);
      c.price = ride.data.price;
      c.valueScore = ride.data.valueScore;
      c.quality = ride.data.quality;
      c.decorationBonus = getLocalDecorationBonus(ride.data.accessCell);
      rideCandidates.push(c);
    }
    return this.pickBestTarget(rideCandidates, current, visitor, densityMap);
  }

  private selectBestShop(
    visitor: Visitor,
    current: GridPosition,
    shops: Shop[],
    densityMap: Map<number, number>,
    getLocalDecorationBonus: (position: GridPosition) => number
  ): TargetChoice | null {
    const hungerNeed = (100 - visitor.data.needs.hunger) / 100;
    const thirstNeed = (100 - visitor.data.needs.thirst) / 100;
    const giftNeed = visitor.data.needs.money > 20 && visitor.data.needs.happiness > 40
      ? (visitor.data.needs.happiness / 100) * 0.4
      : 0;

    const p = visitor.data.personality;
    const foodMult = p === 'foodie' ? 1.4 : 1.0;
    const giftMult = p === 'relaxer' ? 1.2 : p === 'thrill_seeker' ? 0.75 : 1.0;

    // Reuse pre-allocated scratch array + object pool — zero allocations per decision.
    const shopCandidates = this._shopCandidates;
    shopCandidates.length = 0;
    for (const shop of shops) {
      let needScore: number;
      let personalityMult: number;
      if (shop.data.shopType === ShopType.FOOD_STALL) {
        needScore = hungerNeed;
        personalityMult = foodMult;
      } else if (shop.data.shopType === ShopType.DRINK_STAND) {
        needScore = thirstNeed;
        personalityMult = foodMult;
      } else {
        needScore = giftNeed;
        personalityMult = giftMult;
      }
      const idx = shopCandidates.length;
      if (idx >= this._shopCandidatePool.length) {
        this._shopCandidatePool.push({ id: '', type: 'shop', accessCell: { x: 0, z: 0 }, baseNeedScore: 0, price: 0, valueScore: 0, quality: 0, decorationBonus: 0 });
      }
      const c = this._shopCandidatePool[idx];
      c.id = shop.data.id;
      c.type = 'shop';
      c.accessCell = shop.data.accessCell;
      c.baseNeedScore = needScore * (shop.data.quality / 55) * personalityMult;
      c.price = shop.data.price;
      c.valueScore = shop.data.valueScore;
      c.quality = shop.data.quality;
      c.decorationBonus = getLocalDecorationBonus(shop.data.accessCell);
      shopCandidates.push(c);
    }
    return this.pickBestTarget(shopCandidates, current, visitor, densityMap);
  }

  private selectBestService(
    visitor: Visitor,
    current: GridPosition,
    services: Service[],
    densityMap: Map<number, number>
  ): TargetChoice | null {
    const hygieneNeed = (100 - visitor.data.needs.hygiene) / 100;
    if (hygieneNeed < 0.1) return null;

    // Reuse pre-allocated scratch array + object pool — zero allocations per decision.
    const serviceCandidates = this._serviceCandidates;
    serviceCandidates.length = 0;
    for (const service of services) {
      const idx = serviceCandidates.length;
      if (idx >= this._serviceCandidatePool.length) {
        this._serviceCandidatePool.push({ id: '', type: 'service', accessCell: { x: 0, z: 0 }, baseNeedScore: 0, price: 0, valueScore: 0, quality: 0, decorationBonus: 0 });
      }
      const c = this._serviceCandidatePool[idx];
      c.id = service.data.id;
      c.type = 'service';
      c.accessCell = service.data.accessCell;
      c.baseNeedScore = hygieneNeed * (service.data.quality / 50);
      c.price = service.data.price;
      c.valueScore = Math.max(1, service.data.valueScore);
      c.quality = service.data.quality;
      c.decorationBonus = 0;
      serviceCandidates.push(c);
    }
    return this.pickBestTarget(serviceCandidates, current, visitor, densityMap);
  }

  private pickBestTarget(
    candidates: TargetCandidate[],
    current: GridPosition,
    visitor: Visitor,
    densityMap: Map<number, number>
  ): TargetChoice | null {
    // Phase 1: score every candidate using cheap Manhattan distance (no A*).
    // This avoids O(buildings) A* calls per visitor per frame.
    let bestCandidate: (typeof candidates)[0] | null = null;
    let bestHeuristicScore = -Infinity;

    // Relaxers tolerate crowds better; thrill-seekers prefer busy, exciting areas
    const crowdSensitivity = visitor.data.personality === 'relaxer' ? 0.5
                           : visitor.data.personality === 'thrill_seeker' ? 1.1
                           : 1.0;

    for (const candidate of candidates) {
      if (candidate.baseNeedScore <= 0 || visitor.data.needs.money < candidate.price) continue;

      const manhattanDist = GridHelper.getDistance(current, candidate.accessCell);
      if (manhattanDist === 0) continue; // Already standing on access cell

      const fairness = this.getPriceFairness(candidate.price, candidate.valueScore, candidate.quality);
      const density = densityMap.get(GridHelper.getGridKey(candidate.accessCell)) ?? 0;
      const travelPenalty = Math.min(manhattanDist / 30, 0.45);
      const densityPenalty = Math.min(density * 0.08, 0.32) * crowdSensitivity;
      const decorBonus = Math.min(candidate.decorationBonus / 40, 0.18);
      const score = candidate.baseNeedScore * 0.6 + fairness * 0.25 + decorBonus - travelPenalty - densityPenalty;

      if (score > bestHeuristicScore) {
        bestHeuristicScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate || bestHeuristicScore <= 0) return null;

    // Phase 2: run A* only for the winning candidate.
    const path = this.pathfinding.findPath(current, bestCandidate.accessCell);
    if (path.length <= 1) return null;

    return { id: bestCandidate.id, type: bestCandidate.type, score: bestHeuristicScore, path };
  }

  private getPriceFairness(price: number, valueScore: number, quality: number): number {
    const expectedPrice = 1.5 + valueScore * 0.75 + quality * 0.045;
    return Math.max(0.1, Math.min(1, expectedPrice / Math.max(price, 1)));
  }

  private acceptPrice(visitor: Visitor, fairness: number, thoughtType: 'price'): boolean {
    // moodMomentum [-1,+1] shifts tolerance: happy streak = more willing to spend
    const momentumBonus = visitor.data.moodMomentum * 0.07;
    const happinessBonus = visitor.data.needs.happiness / 625;
    const priceTolerance = Math.max(0.08, Math.min(0.94, 0.18 + fairness * 0.62 + happinessBonus + momentumBonus));
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
    const r = Math.random();

    // Inline checks — no array allocation. Each branch short-circuits as soon as one mood fires.
    const sickSeverity = THREE.MathUtils.clamp((18 - needs.hygiene) / 14, 0, 1);
    if (sickSeverity > 0 && visitor.canShowMood('sick') && r < 0.003 + sickSeverity * 0.012) {
      visitor.showMood({ kind: 'sick', emoji: '🤢', message: 'This place feels gross.', duration: 2.1 });
      return;
    }

    const hungerSeverity = THREE.MathUtils.clamp((55 - needs.hunger) / 35, 0, 1);
    if (hungerSeverity > 0 && visitor.canShowMood('hunger') && r < 0.008 + hungerSeverity * 0.02) {
      visitor.showMood({ kind: 'hunger', emoji: '🍔', message: 'I need food.', duration: 1.9 });
      return;
    }

    const thirstSeverity = THREE.MathUtils.clamp((60 - needs.thirst) / 35, 0, 1);
    if (thirstSeverity > 0 && visitor.canShowMood('thirst') && r < 0.008 + thirstSeverity * 0.02) {
      visitor.showMood({ kind: 'thirst', emoji: '🥤', message: 'I need a drink.', duration: 1.9 });
      return;
    }

    const boredSeverity = THREE.MathUtils.clamp((40 - needs.fun) / 25, 0, 1);
    if (boredSeverity > 0 && visitor.canShowMood('bored') && r < 0.005 + boredSeverity * 0.012) {
      visitor.showMood({ kind: 'bored', emoji: '🥱', message: 'This park needs more fun.', duration: 1.8 });
      return;
    }

    const sadSeverity = THREE.MathUtils.clamp((38 - needs.happiness) / 22, 0, 1);
    if (sadSeverity > 0 && visitor.canShowMood('sad') && r < 0.004 + sadSeverity * 0.01) {
      visitor.showMood({ kind: 'sad', emoji: '☹️', message: 'I am not having a great time.', duration: 1.8 });
      return;
    }

    const brokeSeverity = THREE.MathUtils.clamp((12 - needs.money) / 10, 0, 1);
    if (brokeSeverity > 0 && visitor.canShowMood('broke') && r < 0.006 + brokeSeverity * 0.015) {
      visitor.showMood({ kind: 'broke', emoji: '😔', message: 'I am running out of money.', duration: 1.8 });
      return;
    }

    const excitedSeverity = THREE.MathUtils.clamp((needs.happiness - 88) / 10, 0, 1);
    if (excitedSeverity > 0 && visitor.canShowMood('excited') && r < 0.001 + excitedSeverity * 0.004) {
      visitor.showMood({ kind: 'excited', emoji: '🤩', message: 'This park is amazing!', duration: 2.0 });
      return;
    }

    const happySeverity = THREE.MathUtils.clamp((needs.happiness - 78) / 18, 0, 1);
    if (happySeverity > 0 && visitor.canShowMood('happy') && r < 0.0015 + happySeverity * 0.003) {
      visitor.showMood({ kind: 'happy', emoji: '😊', message: 'This place is great!', duration: 1.7 });
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

  private buildDensityMap(): void {
    this.densityMapCache.clear();
    this.visitors.forEach(visitor => {
      // worldToGridKey skips the intermediate {x,z} object entirely.
      const key = GridHelper.worldToGridKey(visitor.data.position);
      this.densityMapCache.set(key, (this.densityMapCache.get(key) ?? 0) + 1);
    });
  }

  public removeVisitor(id: string): void {
    const visitor = this.visitors.get(id);
    if (!visitor) return;

    this.scene.remove(visitor.mesh);
    visitor.dispose();
    this.visitors.delete(id);
    this.visitorTargets.delete(id);
    this.visitorDecisionCooldowns.delete(id);
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
    this.visitorDecisionCooldowns.clear();
    this.spawnTimer = 0;
    this.spawnInterval = 15 + Math.random() * 8;
    this.restoreSpawnRemaining = 0;
    this.restoreSpawnTimer = 0;
    this.densityMapCache.clear();
    this.densityRefreshTimer = 0;
  }
}
