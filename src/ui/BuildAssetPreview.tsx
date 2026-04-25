import { BuildingCatalogItem, BuildingType, PlaceableBuildingKind } from '../types';
import { BuildingIcon } from './BuildingIcon';
import {
  getBuildAssetCategoryClass,
  getBuildAssetFitClass,
  getBuildAssetImageSrc,
  getBuildAssetPositionClass,
} from './buildAssetImages';

type BuildAssetPreviewVariant = 'card' | 'selection' | 'research';

interface BuildAssetPreviewProps {
  item: Pick<BuildingCatalogItem, 'name' | 'type' | 'subType'>;
  variant?: BuildAssetPreviewVariant;
  locked?: boolean;
}

export function BuildAssetPreview({ item, variant = 'card', locked = false }: BuildAssetPreviewProps) {
  const imageSrc = getBuildAssetImageSrc(item.subType);
  const fitClass = getBuildAssetFitClass(item.subType);
  const categoryClass = getBuildAssetCategoryClass(item.subType);
  const positionClass = getBuildAssetPositionClass(item.subType);

  return (
    <div className={`px-build-asset px-build-asset--${variant} ${fitClass} ${categoryClass} ${positionClass}${locked ? ' px-build-asset--locked' : ''}`}>
      {imageSrc ? (
        <img
          className="px-build-asset__image"
          src={imageSrc}
          alt={item.name}
          loading={variant === 'selection' ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <BuildingIcon
          type={item.type as BuildingType}
          subType={item.subType as PlaceableBuildingKind | undefined}
          className="px-build-asset__fallback"
          aria-label={item.name}
        />
      )}
    </div>
  );
}
