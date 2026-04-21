import {
  BuildingCatalogItem,
  BuildingDefinition,
  BuildingType,
  BUILDING_DISPLAY,
  DecorationType,
  PlaceableBuildingKind,
  RideType,
  ServiceType,
  ShopType
} from '../types';

const PATH_DEFINITION: BuildingCatalogItem = {
  type: BuildingType.PATH,
  name: 'Cobbled Path',
  description: 'Directs visitor flow through the park',
  cost: 0,
  icon: '🛤️',
  quality: 0,
  valueScore: 0
};

const BUILDING_CATALOG: Partial<Record<PlaceableBuildingKind, BuildingCatalogItem>> = {
  [RideType.CAROUSEL]: {
    type: BuildingType.RIDE,
    subType: RideType.CAROUSEL,
    ...BUILDING_DISPLAY[RideType.CAROUSEL],
    cost: 500,
    quality: 58,
    valueScore: 5
  },
  [RideType.FERRIS_WHEEL]: {
    type: BuildingType.RIDE,
    subType: RideType.FERRIS_WHEEL,
    ...BUILDING_DISPLAY[RideType.FERRIS_WHEEL],
    cost: 800,
    quality: 68,
    valueScore: 8,
    unlockRequirement: 'research_eye_of_doom'
  },
  [RideType.ROLLER_COASTER]: {
    type: BuildingType.RIDE,
    subType: RideType.ROLLER_COASTER,
    ...BUILDING_DISPLAY[RideType.ROLLER_COASTER],
    cost: 1500,
    quality: 82,
    valueScore: 12,
    unlockRequirement: 'research_terror_coaster'
  },
  [RideType.HAUNTED_HOUSE]: {
    type: BuildingType.RIDE,
    subType: RideType.HAUNTED_HOUSE,
    ...BUILDING_DISPLAY[RideType.HAUNTED_HOUSE],
    cost: 1000,
    quality: 74,
    valueScore: 10,
    unlockRequirement: 'research_haunted_house'
  },
  [RideType.PIRATE_SHIP]: {
    type: BuildingType.RIDE,
    subType: RideType.PIRATE_SHIP,
    ...BUILDING_DISPLAY[RideType.PIRATE_SHIP],
    cost: 950,
    quality: 72,
    valueScore: 9
  },
  [RideType.KRAKEN_RIDE]: {
    type: BuildingType.RIDE,
    subType: RideType.KRAKEN_RIDE,
    ...BUILDING_DISPLAY[RideType.KRAKEN_RIDE],
    cost: 1350,
    quality: 79,
    valueScore: 11
  },
  [RideType.INFERNAL_TOWER]: {
    type: BuildingType.RIDE,
    subType: RideType.INFERNAL_TOWER,
    ...BUILDING_DISPLAY[RideType.INFERNAL_TOWER],
    cost: 1150,
    quality: 76,
    valueScore: 10
  },
  [ShopType.FOOD_STALL]: {
    type: BuildingType.SHOP,
    subType: ShopType.FOOD_STALL,
    ...BUILDING_DISPLAY[ShopType.FOOD_STALL],
    cost: 200,
    quality: 55,
    valueScore: 7
  },
  [ShopType.DRINK_STAND]: {
    type: BuildingType.SHOP,
    subType: ShopType.DRINK_STAND,
    ...BUILDING_DISPLAY[ShopType.DRINK_STAND],
    cost: 150,
    quality: 50,
    valueScore: 5
  },
  [ShopType.GIFT_SHOP]: {
    type: BuildingType.SHOP,
    subType: ShopType.GIFT_SHOP,
    ...BUILDING_DISPLAY[ShopType.GIFT_SHOP],
    cost: 300,
    quality: 60,
    valueScore: 10
  },
  [ServiceType.RESTROOM]: {
    type: BuildingType.SERVICE,
    subType: ServiceType.RESTROOM,
    ...BUILDING_DISPLAY[ServiceType.RESTROOM],
    cost: 100,
    quality: 52,
    valueScore: 4
  },
  [DecorationType.LANTERN]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.LANTERN,
    ...BUILDING_DISPLAY[DecorationType.LANTERN],
    cost: 35,
    quality: 58,
    valueScore: 0
  },
  [DecorationType.TRASH_CUBE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.TRASH_CUBE,
    ...BUILDING_DISPLAY[DecorationType.TRASH_CUBE],
    cost: 40,
    quality: 57,
    valueScore: 0
  },
  [DecorationType.SPOOKY_TREE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.SPOOKY_TREE,
    ...BUILDING_DISPLAY[DecorationType.SPOOKY_TREE],
    cost: 30,
    quality: 45,
    valueScore: 0
  },
  [DecorationType.STONE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.STONE,
    ...BUILDING_DISPLAY[DecorationType.STONE],
    cost: 20,
    quality: 48,
    valueScore: 0
  },
  [DecorationType.PUMPKIN]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.PUMPKIN,
    ...BUILDING_DISPLAY[DecorationType.PUMPKIN],
    cost: 50,
    quality: 52,
    valueScore: 0,
    unlockRequirement: 'research_pumpkin_lights'
  },
  [DecorationType.SKELETON_DECORATION]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.SKELETON_DECORATION,
    ...BUILDING_DISPLAY[DecorationType.SKELETON_DECORATION],
    cost: 45,
    quality: 54,
    valueScore: 0
  },
  [DecorationType.FRANKENSTEIN_DECORATION]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.FRANKENSTEIN_DECORATION,
    ...BUILDING_DISPLAY[DecorationType.FRANKENSTEIN_DECORATION],
    cost: 55,
    quality: 56,
    valueScore: 0
  }
};

export const INITIAL_UNLOCKED_BUILDINGS: PlaceableBuildingKind[] = [
  RideType.CAROUSEL,
  RideType.PIRATE_SHIP,
  RideType.KRAKEN_RIDE,
  RideType.INFERNAL_TOWER,
  ShopType.FOOD_STALL,
  ShopType.DRINK_STAND,
  ShopType.GIFT_SHOP,
  ServiceType.RESTROOM,
  DecorationType.SPOOKY_TREE,
  DecorationType.STONE,
  DecorationType.SKELETON_DECORATION,
  DecorationType.FRANKENSTEIN_DECORATION,
  DecorationType.LANTERN,
  DecorationType.TRASH_CUBE
];

export function getPathDefinition(): BuildingDefinition {
  return { ...PATH_DEFINITION };
}

export function getBuildingCatalogItem(kind: PlaceableBuildingKind): BuildingCatalogItem {
  const item = BUILDING_CATALOG[kind];
  if (!item) {
    throw new Error(`Missing building catalog entry for ${kind}`);
  }
  return { ...item };
}

export function getAllCatalogItems(): BuildingCatalogItem[] {
  return Object.values(BUILDING_CATALOG)
    .filter((item): item is BuildingCatalogItem => Boolean(item))
    .map(item => ({ ...item }));
}
