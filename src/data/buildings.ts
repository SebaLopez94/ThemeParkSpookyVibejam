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
    cost: 450,
    quality: 48,   // funBoost ≈  8  (10 × 48/60)
    valueScore: 4
  },
  [RideType.FERRIS_WHEEL]: {
    type: BuildingType.RIDE,
    subType: RideType.FERRIS_WHEEL,
    ...BUILDING_DISPLAY[RideType.FERRIS_WHEEL],
    cost: 850,
    quality: 63,   // funBoost ≈ 21  (20 × 63/60)
    valueScore: 7,
    unlockRequirement: 'research_eye_of_doom'
  },
  [RideType.ROLLER_COASTER]: {
    type: BuildingType.RIDE,
    subType: RideType.ROLLER_COASTER,
    ...BUILDING_DISPLAY[RideType.ROLLER_COASTER],
    cost: 1700,
    quality: 86,   // funBoost ≈ 80  (56 × 86/60)
    valueScore: 14,
    unlockRequirement: 'research_terror_coaster'
  },
  [RideType.HAUNTED_HOUSE]: {
    type: BuildingType.RIDE,
    subType: RideType.HAUNTED_HOUSE,
    ...BUILDING_DISPLAY[RideType.HAUNTED_HOUSE],
    cost: 1050,
    quality: 74,   // funBoost ≈ 40  (32 × 74/60)
    valueScore: 10,
    unlockRequirement: 'research_haunted_house'
  },
  [RideType.PIRATE_SHIP]: {
    type: BuildingType.RIDE,
    subType: RideType.PIRATE_SHIP,
    ...BUILDING_DISPLAY[RideType.PIRATE_SHIP],
    cost: 1100,
    quality: 70,   // funBoost ≈ 33  (28 × 70/60)
    valueScore: 9
  },
  [RideType.KRAKEN_RIDE]: {
    type: BuildingType.RIDE,
    subType: RideType.KRAKEN_RIDE,
    ...BUILDING_DISPLAY[RideType.KRAKEN_RIDE],
    cost: 900,
    quality: 66,   // funBoost ≈ 27  (24 × 66/60)
    valueScore: 8
  },
  [RideType.INFERNAL_TOWER]: {
    type: BuildingType.RIDE,
    subType: RideType.INFERNAL_TOWER,
    ...BUILDING_DISPLAY[RideType.INFERNAL_TOWER],
    cost: 1250,
    quality: 78,   // funBoost ≈ 49  (38 × 78/60)
    valueScore: 10
  },
  [ShopType.FOOD_STALL]: {
    type: BuildingType.SHOP,
    subType: ShopType.FOOD_STALL,
    ...BUILDING_DISPLAY[ShopType.FOOD_STALL],
    cost: 240,
    quality: 55,
    valueScore: 7,
    statBars: [{ label: 'HUNGER', filled: 6 }]
  },
  [ShopType.DRINK_STAND]: {
    type: BuildingType.SHOP,
    subType: ShopType.DRINK_STAND,
    ...BUILDING_DISPLAY[ShopType.DRINK_STAND],
    cost: 180,
    quality: 50,
    valueScore: 5,
    statBars: [{ label: 'THIRST', filled: 7 }]
  },
  [ShopType.GIFT_SHOP]: {
    type: BuildingType.SHOP,
    subType: ShopType.GIFT_SHOP,
    ...BUILDING_DISPLAY[ShopType.GIFT_SHOP],
    cost: 360,
    quality: 60,
    valueScore: 10,
    statBars: [{ label: 'FUN', filled: 5 }]
  },
  [ServiceType.RESTROOM]: {
    type: BuildingType.SERVICE,
    subType: ServiceType.RESTROOM,
    ...BUILDING_DISPLAY[ServiceType.RESTROOM],
    cost: 180,
    quality: 52,
    valueScore: 4,
    statBars: [{ label: 'HYGIENE', filled: 7 }]
  },
  [DecorationType.LANTERN]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.LANTERN,
    ...BUILDING_DISPLAY[DecorationType.LANTERN],
    cost: 45,
    quality: 58,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 6 }]
  },
  [DecorationType.TRASH_CUBE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.TRASH_CUBE,
    ...BUILDING_DISPLAY[DecorationType.TRASH_CUBE],
    cost: 70,
    quality: 57,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 3 }, { label: 'HYGIENE', filled: 8 }]
  },
  [DecorationType.SPOOKY_TREE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.SPOOKY_TREE,
    ...BUILDING_DISPLAY[DecorationType.SPOOKY_TREE],
    cost: 35,
    quality: 45,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 6 }]
  },
  [DecorationType.PUMPKIN]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.PUMPKIN,
    ...BUILDING_DISPLAY[DecorationType.PUMPKIN],
    cost: 30,
    quality: 52,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 8 }]
  },
  [DecorationType.SKELETON_DECORATION]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.SKELETON_DECORATION,
    ...BUILDING_DISPLAY[DecorationType.SKELETON_DECORATION],
    cost: 65,
    quality: 54,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 6 }]
  },
  [DecorationType.FRANKENSTEIN_DECORATION]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.FRANKENSTEIN_DECORATION,
    ...BUILDING_DISPLAY[DecorationType.FRANKENSTEIN_DECORATION],
    cost: 80,
    quality: 56,
    valueScore: 0,
    statBars: [{ label: 'APPEAL', filled: 8 }]
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
  DecorationType.PUMPKIN,
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
