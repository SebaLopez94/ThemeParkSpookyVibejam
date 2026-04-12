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

const BUILDING_CATALOG: Record<PlaceableBuildingKind, BuildingCatalogItem> = {
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
    valueScore: 10,
    unlockRequirement: 'research_voodoo_shop'
  },
  [ServiceType.RESTROOM]: {
    type: BuildingType.SERVICE,
    subType: ServiceType.RESTROOM,
    ...BUILDING_DISPLAY[ServiceType.RESTROOM],
    cost: 100,
    quality: 52,
    valueScore: 2
  },
  [DecorationType.SPOOKY_TREE]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.SPOOKY_TREE,
    ...BUILDING_DISPLAY[DecorationType.SPOOKY_TREE],
    cost: 30,
    quality: 45,
    valueScore: 0
  },
  [DecorationType.JACK_O_LANTERN]: {
    type: BuildingType.DECORATION,
    subType: DecorationType.JACK_O_LANTERN,
    ...BUILDING_DISPLAY[DecorationType.JACK_O_LANTERN],
    cost: 50,
    quality: 52,
    valueScore: 0,
    unlockRequirement: 'research_pumpkin_lights'
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
    cost: 15,
    quality: 46,
    valueScore: 0
  }
};

export const INITIAL_UNLOCKED_BUILDINGS: PlaceableBuildingKind[] = [
  RideType.CAROUSEL,
  ServiceType.RESTROOM,
  DecorationType.SPOOKY_TREE,
  DecorationType.STONE,
  DecorationType.PUMPKIN
];

export function getPathDefinition(): BuildingDefinition {
  return { ...PATH_DEFINITION };
}

export function getBuildingCatalogItem(kind: PlaceableBuildingKind): BuildingCatalogItem {
  return { ...BUILDING_CATALOG[kind] };
}

export function getAllCatalogItems(): BuildingCatalogItem[] {
  return Object.values(BUILDING_CATALOG).map(item => ({ ...item }));
}
