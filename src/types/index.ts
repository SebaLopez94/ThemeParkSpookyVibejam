export interface GridPosition {
  x: number;
  z: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

export enum BuildingType {
  PATH = 'path',
  RIDE = 'ride',
  SHOP = 'shop',
  SERVICE = 'service',
  DECORATION = 'decoration',
  DELETE = 'delete'
}

export enum RideType {
  CAROUSEL = 'carousel',
  FERRIS_WHEEL = 'ferrisWheel',
  ROLLER_COASTER = 'rollerCoaster',
  HAUNTED_HOUSE = 'hauntedHouse'
}

export const RIDE_SIZES: Record<RideType, { width: number; height: number }> = {
  [RideType.CAROUSEL]: { width: 2, height: 2 },
  [RideType.FERRIS_WHEEL]: { width: 3, height: 3 },
  [RideType.ROLLER_COASTER]: { width: 4, height: 4 },
  [RideType.HAUNTED_HOUSE]: { width: 3, height: 3 }
};

export enum ShopType {
  FOOD_STALL = 'foodStall',
  DRINK_STAND = 'drinkStand',
  GIFT_SHOP = 'giftShop'
}

export enum ServiceType {
  RESTROOM = 'restroom'
}

export enum DecorationType {
  SPOOKY_TREE = 'spookyTree',
  JACK_O_LANTERN = 'jackOLantern',
  STONE = 'stone',
  PUMPKIN = 'pumpkin'
}

export type PlaceableBuildingKind = RideType | ShopType | ServiceType | DecorationType;

export interface BuildingDisplay {
  name: string;
  icon: string;
  description: string;
}

export const BUILDING_DISPLAY: Record<PlaceableBuildingKind, BuildingDisplay> = {
  [RideType.CAROUSEL]: { name: 'Cursed Carousel', icon: '🎠', description: 'Spins visitors into gleeful dread' },
  [RideType.FERRIS_WHEEL]: { name: 'Eye of Doom', icon: '🎡', description: 'A towering view over the haunted grounds' },
  [RideType.ROLLER_COASTER]: { name: 'Terror Coaster', icon: '🎢', description: 'High thrill route through the underworld' },
  [RideType.HAUNTED_HOUSE]: { name: 'Haunted House', icon: '👻', description: 'A walk-through horror experience that leaves guests screaming' },
  [ShopType.FOOD_STALL]: { name: 'Witch Cauldron', icon: '🍲', description: 'Warm stew that fights off hunger' },
  [ShopType.DRINK_STAND]: { name: 'Poison Stand', icon: '🧪', description: 'Toxic-looking drinks for thirsty guests' },
  [ShopType.GIFT_SHOP]: { name: 'Voodoo Shop', icon: '🔮', description: 'Souvenirs for guests who still have cash' },
  [ServiceType.RESTROOM]: { name: 'Haunted WC', icon: '🚻', description: 'Essential hygiene relief for brave souls' },
  [DecorationType.SPOOKY_TREE]: { name: 'Spooky Tree', icon: '🌲', description: 'Boosts appeal around nearby paths' },
  [DecorationType.JACK_O_LANTERN]: { name: 'Jack-o-Lantern', icon: '🎃', description: 'Cheap ambience with a tiny local charm bonus' },
  [DecorationType.STONE]: { name: 'Gravestone', icon: '🪦', description: 'A weathered gravestone that adds dark atmosphere' },
  [DecorationType.PUMPKIN]: { name: 'Pumpkin', icon: '🎃', description: 'A carved pumpkin that glows with spooky charm' }
};

export interface SelectedBuildingInfo {
  id: string;
  buildingType: BuildingType;
  subType: PlaceableBuildingKind;
  name: string;
  icon: string;
  position: GridPosition;
  currentPrice: number | null;
  buildCost: number;
}

export interface BuildingData {
  id: string;
  type: BuildingType;
  position: GridPosition;
  cost: number;
  quality: number;
  valueScore: number;
  unlockRequirement?: string;
}

export interface RideData extends BuildingData {
  rideType: RideType;
  capacity: number;
  price: number;
  duration: number;
  funFactor: number;
  intensity: number;
  reliability: number;
  queue: string[];
  accessCell: GridPosition;
}

export interface ShopData extends BuildingData {
  shopType: ShopType;
  price: number;
  satisfactionEffects: Partial<Record<VisitorNeedType, number>>;
  accessCell: GridPosition;
}

export interface ServiceData extends BuildingData {
  serviceType: ServiceType;
  price: number;
  satisfactionEffects: Partial<Record<VisitorNeedType, number>>;
  accessCell: GridPosition;
}

export interface DecorationData extends BuildingData {
  decorationType: DecorationType;
  appealRadius: number;
  appealBonus: number;
}

export interface PathData extends BuildingData {
  connections: GridPosition[];
}

export type VisitorNeedType = 'fun' | 'hunger' | 'thirst' | 'hygiene';

export interface VisitorNeeds {
  fun: number;
  hunger: number;
  thirst: number;
  hygiene: number;
  money: number;
  happiness: number;
}

export interface VisitorThought {
  type: 'price' | 'crowd' | 'need';
  message: string;
}

export interface VisitorData {
  id: string;
  position: WorldPosition;
  targetPosition: WorldPosition | null;
  path: GridPosition[];
  needs: VisitorNeeds;
  currentActivity: string | null;
  activityTimer: number;
  lastThought: VisitorThought | null;
}

export interface EconomyState {
  money: number;
  ticketPrice: number;
  totalVisitors: number;
  activeVisitors: number;
  parkRating: number;
  averageHappiness: number;
  dailyIncome: number;
  dailyExpenses: number;
  netProfit: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  subType?: PlaceableBuildingKind;
  name: string;
  description: string;
  cost: number;
  icon: string;
  unlockRequirement?: string;
}

export interface BuildingCatalogItem extends BuildingDefinition {
  quality: number;
  valueScore: number;
}

export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  duration: number;
  unlocks: PlaceableBuildingKind[];
  dependencies: string[];
}

export interface ResearchState {
  unlocked: PlaceableBuildingKind[];
  completed: string[];
  activeResearchId: string | null;
  remainingTime: number;
}

export type ChallengeType =
  | 'visitor_count'
  | 'happiness_streak'
  | 'profit_streak'
  | 'build_count'
  | 'ride_count'
  | 'shop_count'
  | 'rating_threshold';

export interface ChallengeReward {
  money: number;
  rating: number;
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  target: number;
  duration?: number;
  reward: ChallengeReward;
}

export interface ChallengeState extends ChallengeDefinition {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface SimulationSnapshot {
  totalVisitors: number;
  averageHappiness: number;
  netProfit: number;
  parkRating: number;
  buildingCounts: Record<BuildingType, number>;
  serviceAndDecorationCount: number;
  rideCount: number;
  shopCount: number;
}
