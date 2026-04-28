import { BuildingType, DecorationType, PlaceableBuildingKind, RideType, ServiceType, ShopType } from '../types';

export const MAINTENANCE_CHARGE_INTERVAL_SECONDS = 20;

export const RIDE_MAINTENANCE: Record<RideType, number> = {
  [RideType.CAROUSEL]:        4,
  [RideType.FERRIS_WHEEL]:    6,
  [RideType.ROLLER_COASTER]: 10,
  [RideType.HAUNTED_HOUSE]:   7,
  [RideType.PIRATE_SHIP]:     7,
  [RideType.KRAKEN_RIDE]:     9,
  [RideType.INFERNAL_TOWER]:  8,
};

export const SHOP_MAINTENANCE: Record<ShopType, number> = {
  [ShopType.FOOD_STALL]:  3,
  [ShopType.DRINK_STAND]: 2,
  [ShopType.GIFT_SHOP]:   3,
};

export const SERVICE_MAINTENANCE: Record<ServiceType, number> = {
  [ServiceType.RESTROOM]: 3,
};

export function getMaintenanceChargePerInterval(type: BuildingType, subType: PlaceableBuildingKind): number {
  switch (type) {
    case BuildingType.RIDE:
      return RIDE_MAINTENANCE[subType as RideType] ?? 0;
    case BuildingType.SHOP:
      return SHOP_MAINTENANCE[subType as ShopType] ?? 0;
    case BuildingType.SERVICE:
      return SERVICE_MAINTENANCE[subType as ServiceType] ?? 0;
    case BuildingType.DECORATION:
      return 0;
    default:
      return 0;
  }
}

export function getMaintenancePerMinute(type: BuildingType, subType: PlaceableBuildingKind): number {
  return getMaintenanceChargePerInterval(type, subType) * (60 / MAINTENANCE_CHARGE_INTERVAL_SECONDS);
}

export function getRecommendedPrice(valueScore: number, quality: number): number {
  return Math.max(1, Math.round(1.5 + valueScore * 0.75 + quality * 0.045));
}
