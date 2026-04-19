import {
  Brain,
  ChessKnight,
  CupSoda,
  FerrisWheel,
  Fish,
  Flame,
  Gift,
  Hamburger,
  Hammer,
  Landmark,
  Lamp,
  LucideProps,
  Package,
  PartyPopper,
  Route,
  RollerCoaster,
  Ship,
  Skull,
  Sparkles,
  Toilet,
  Trash,
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
      return ChessKnight;
    case RideType.FERRIS_WHEEL:
      return FerrisWheel;
    case RideType.ROLLER_COASTER:
      return RollerCoaster;
    case RideType.HAUNTED_HOUSE:
      return Landmark;
    case RideType.PIRATE_SHIP:
      return Ship;
    case RideType.KRAKEN_RIDE:
      return Fish;
    case RideType.INFERNAL_TOWER:
      return Flame;
    case ShopType.FOOD_STALL:
      return Hamburger;
    case ShopType.DRINK_STAND:
      return CupSoda;
    case ShopType.GIFT_SHOP:
      return Gift;
    case ServiceType.RESTROOM:
      return Toilet;
    case DecorationType.SPOOKY_TREE:
      return TreePine;
    case DecorationType.JACK_O_LANTERN:
      return Sparkles;
    case DecorationType.STONE:
      return Package;
    case DecorationType.PUMPKIN:
      return Sparkles;
    case DecorationType.SKELETON_DECORATION:
      return Skull;
    case DecorationType.FRANKENSTEIN_DECORATION:
      return Brain;
    case DecorationType.LANTERN:
      return Lamp;
    case DecorationType.TRASH_CUBE:
      return Trash;
    default:
      if (type === BuildingType.RIDE) return PartyPopper;
      if (type === BuildingType.SHOP) return Gift;
      if (type === BuildingType.SERVICE) return Hammer;
      if (type === BuildingType.DECORATION) return TreePine;
      return Route;
  }
}
