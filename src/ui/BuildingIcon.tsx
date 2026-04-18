import {
  FlaskConical,
  Gift,
  Hammer,
  Landmark,
  LucideProps,
  Mountain,
  Package,
  PartyPopper,
  Route,
  Soup,
  Sparkles,
  Trash2,
  TreePine,
} from 'lucide-react';
import { BuildingType, DecorationType, PlaceableBuildingKind, RideType, ServiceType, ShopType } from '../types';

interface BuildingIconProps extends Omit<LucideProps, 'ref'> {
  type: BuildingType;
  subType?: PlaceableBuildingKind;
}

export function BuildingIcon({ type, subType, ...props }: BuildingIconProps) {
  const Icon = getBuildingIcon(type, subType);
  return <Icon {...props} />;
}

function getBuildingIcon(type: BuildingType, subType?: PlaceableBuildingKind) {
  if (type === BuildingType.PATH) return Route;
  if (type === BuildingType.DELETE) return Trash2;

  switch (subType) {
    case RideType.CAROUSEL:
      return PartyPopper;
    case RideType.FERRIS_WHEEL:
      return Landmark;
    case RideType.ROLLER_COASTER:
      return Mountain;
    case RideType.HAUNTED_HOUSE:
      return Landmark;
    case ShopType.FOOD_STALL:
      return Soup;
    case ShopType.DRINK_STAND:
      return FlaskConical;
    case ShopType.GIFT_SHOP:
      return Gift;
    case ServiceType.RESTROOM:
      return Package;
    case DecorationType.SPOOKY_TREE:
      return TreePine;
    case DecorationType.JACK_O_LANTERN:
      return Sparkles;
    case DecorationType.STONE:
      return Package;
    case DecorationType.PUMPKIN:
      return Sparkles;
    default:
      if (type === BuildingType.RIDE) return PartyPopper;
      if (type === BuildingType.SHOP) return Gift;
      if (type === BuildingType.SERVICE) return Hammer;
      if (type === BuildingType.DECORATION) return TreePine;
      return Route;
  }
}
