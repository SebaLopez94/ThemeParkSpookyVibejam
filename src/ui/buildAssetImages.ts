import {
  DecorationType,
  PlaceableBuildingKind,
  RideType,
  ServiceType,
  ShopType,
} from '../types';

const BUILD_ASSET_IMAGE_BY_KIND: Partial<Record<PlaceableBuildingKind, string>> = {
  [RideType.CAROUSEL]: '/models/carusel.png',
  [RideType.FERRIS_WHEEL]: '/models/noria.png',
  [RideType.ROLLER_COASTER]: '/models/rusa.png',
  [RideType.PIRATE_SHIP]: '/models/pirate_ship.png',
  [RideType.KRAKEN_RIDE]: '/models/kraken.png',
  [RideType.INFERNAL_TOWER]: '/models/infernal_tower.png',
  [ShopType.FOOD_STALL]: '/models/food.png',
  [ShopType.DRINK_STAND]: '/models/drinks.png',
  [ShopType.GIFT_SHOP]: '/models/gift.png',
  [ServiceType.RESTROOM]: '/models/wc.png',
  [DecorationType.SPOOKY_TREE]: '/models/tree.png',
  [DecorationType.PUMPKIN]: '/models/pumpkin.png',
  [DecorationType.LANTERN]: '/models/lantern.png',
  [DecorationType.TRASH_CUBE]: '/models/trash_cube.png',
  [DecorationType.SKELETON_DECORATION]: '/models/skeleton_decoration.png',
  [DecorationType.FRANKENSTEIN_DECORATION]: '/models/frankenstein_decoration.png',
};

const WIDE_BUILD_ASSETS = new Set<PlaceableBuildingKind>([
  RideType.FERRIS_WHEEL,
  RideType.ROLLER_COASTER,
  RideType.PIRATE_SHIP,
  RideType.KRAKEN_RIDE,
  ServiceType.RESTROOM,
]);

const TALL_BUILD_ASSETS = new Set<PlaceableBuildingKind>([
  RideType.INFERNAL_TOWER,
  DecorationType.FRANKENSTEIN_DECORATION,
  DecorationType.LANTERN,
  DecorationType.SKELETON_DECORATION,
  DecorationType.TRASH_CUBE,
]);

const DECORATION_BUILD_ASSETS = new Set<PlaceableBuildingKind>([
  DecorationType.SPOOKY_TREE,
  DecorationType.PUMPKIN,
  DecorationType.SKELETON_DECORATION,
  DecorationType.FRANKENSTEIN_DECORATION,
  DecorationType.LANTERN,
  DecorationType.TRASH_CUBE,
]);

const RAISED_BUILD_ASSETS = new Set<PlaceableBuildingKind>([
  RideType.CAROUSEL,
]);

export function getBuildAssetImageSrc(kind?: PlaceableBuildingKind): string | null {
  if (!kind) return null;
  return BUILD_ASSET_IMAGE_BY_KIND[kind] ?? null;
}

export function getBuildAssetFitClass(kind?: PlaceableBuildingKind): string {
  if (!kind) return 'px-build-asset--standard';
  if (WIDE_BUILD_ASSETS.has(kind)) return 'px-build-asset--wide';
  if (TALL_BUILD_ASSETS.has(kind)) return 'px-build-asset--tall';
  return 'px-build-asset--standard';
}

export function getBuildAssetCategoryClass(kind?: PlaceableBuildingKind): string {
  if (!kind) return '';
  return DECORATION_BUILD_ASSETS.has(kind) ? 'px-build-asset--decor' : '';
}

export function getBuildAssetPositionClass(kind?: PlaceableBuildingKind): string {
  if (!kind) return '';
  if (kind === RideType.INFERNAL_TOWER) return 'px-build-asset--raised-high';
  return RAISED_BUILD_ASSETS.has(kind) ? 'px-build-asset--raised' : '';
}
