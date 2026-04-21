import { useEffect, useMemo, useState } from 'react';
import { Hammer, Map, Package, PartyPopper, Store, Trash2, TreePine, X } from 'lucide-react';
import { getAllCatalogItems } from '../data/buildings';
import { BuildingCatalogItem, BuildingDefinition, BuildingType, PlaceableBuildingKind, RIDE_SIZES, RideType } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { BuildingIcon } from './BuildingIcon';

interface BuildMenuProps {
  onSelectBuilding: (definition: BuildingDefinition) => void;
  onCancel: () => void;
  canAfford: (cost: number) => boolean;
  unlockedBuildings: PlaceableBuildingKind[];
  bottom?: number | string;
}

type Tab = 'rides' | 'shops' | 'services' | 'decor';

const TABS: Array<{ id: Tab; label: string; Icon: typeof Map; tone: string; blurb: string }> = [
  { id: 'rides', label: 'RIDES', Icon: PartyPopper, tone: 'var(--px-gold)', blurb: 'Big attractions that pull guests into the park.' },
  { id: 'shops', label: 'SHOPS', Icon: Store, tone: 'var(--px-cyan)', blurb: 'Food and retail that turn foot traffic into profit.' },
  { id: 'services', label: 'SERVICES', Icon: Package, tone: 'var(--px-green-hi)', blurb: 'Utility buildings that keep guest comfort under control.' },
  { id: 'decor', label: 'DECOR', Icon: TreePine, tone: 'var(--px-orange)', blurb: 'Atmosphere pieces that make areas feel alive.' }
];

function getItemKey(item: BuildingCatalogItem): string {
  return `${item.type}:${item.subType ?? item.name}`;
}

function getSizeLabel(def: BuildingDefinition): string {
  if (def.type === BuildingType.RIDE && def.subType) {
    const size = RIDE_SIZES[def.subType as RideType];
    return `${size.width}x${size.height}`;
  }
  return '1x1';
}

function groupByTab(items: BuildingCatalogItem[], unlockedBuildings: PlaceableBuildingKind[]): Record<Tab, BuildingCatalogItem[]> {
  const unlockedSet = new Set(unlockedBuildings);
  const groups: Record<Tab, BuildingCatalogItem[]> = {
    rides: [],
    shops: [],
    services: [],
    decor: [],
  };

  items.forEach(item => {
    if (item.type !== BuildingType.PATH && item.subType && !unlockedSet.has(item.subType)) return;
    if (item.type === BuildingType.RIDE) groups.rides.push(item);
    if (item.type === BuildingType.SHOP) groups.shops.push(item);
    if (item.type === BuildingType.SERVICE) groups.services.push(item);
    if (item.type === BuildingType.DECORATION) groups.decor.push(item);
  });

  return groups;
}

function findBestTab(groups: Record<Tab, BuildingCatalogItem[]>, preferred: Tab): Tab {
  if (groups[preferred].length > 0) return preferred;
  return TABS.find(tab => groups[tab.id].length > 0)?.id ?? preferred;
}

export function BuildMenu({ onSelectBuilding, onCancel, canAfford, unlockedBuildings, bottom }: BuildMenuProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<Tab>('rides');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const catalogItems = useMemo(() => getAllCatalogItems(), []);
  const groups = useMemo(() => groupByTab(catalogItems, unlockedBuildings), [catalogItems, unlockedBuildings]);

  useEffect(() => {
    const nextTab = findBestTab(groups, activeTab);
    if (nextTab !== activeTab) setActiveTab(nextTab);
  }, [groups, activeTab]);

  const items = groups[activeTab];

  useEffect(() => {
    if (items.length === 0) {
      setSelectedKey(null);
      return;
    }

    const selectedStillExists = selectedKey !== null && items.some(item => getItemKey(item) === selectedKey);
    if (!selectedStillExists) setSelectedKey(getItemKey(items[0]));
  }, [items, selectedKey]);

  const activeTabMeta = TABS.find(tab => tab.id === activeTab) ?? TABS[0];
  const selectedItem = items.find(item => getItemKey(item) === selectedKey) ?? items[0] ?? null;
  const selectedAffordable = selectedItem ? canAfford(selectedItem.cost) : false;

  const buildDeleteDefinition = {
    type: BuildingType.DELETE,
    name: 'Banish',
    description: 'Remove a building for a 50% refund.',
    cost: 0,
    icon: '\u{1F5D1}\uFE0F',
  } satisfies BuildingDefinition;

  const shellStyle = isMobile
    ? {
        position: 'fixed' as const,
        bottom: bottom ?? 90,
        left: 0,
        right: 0,
        zIndex: 40,
      }
    : {
        position: 'fixed' as const,
        bottom: bottom ?? 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
      };

  return (
    <div style={shellStyle}>
      <div
        className="px-panel px-panel--build px-anim-enter-up px-build-menu"
        style={{
          width: isMobile ? undefined : 920,
          maxWidth: isMobile ? undefined : '96vw',
          margin: isMobile ? '0 8px' : undefined,
          padding: 0,
          maxHeight: isMobile ? 'calc(100dvh - 76px - var(--safe-bottom))' : 'min(78vh, 760px)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="px-build-menu__topbar">
          <div className="px-build-menu__heading">
            <div className="px-build-menu__title-wrap">
              <Hammer className="px-icon-sm" color="var(--px-green-hi)" />
              <div className="px-build-menu__title-copy">
                <span className="px-label" style={{ color: 'var(--px-green-hi)' }}>Construction</span>
                <span className="px-build-menu__title">Build Menu</span>
              </div>
            </div>
            {!isMobile && (
              <div className="px-build-menu__status">
                <span className="px-build-menu__status-dot" />
                <span>{items.length} available</span>
              </div>
            )}
          </div>

          <div className="px-build-menu__actions">
            <button
              className="px-btn px-btn--danger px-btn--sm"
              onClick={() => onSelectBuilding(buildDeleteDefinition)}
            >
              <Trash2 className="px-icon-sm" />
              {!isMobile && 'Delete'}
            </button>
            <button className="px-btn px-btn--sm" onClick={onCancel} aria-label="Close build menu">
              <X className="px-icon-sm" />
            </button>
          </div>
        </div>

        <div className={`px-build-menu__body ${isMobile ? 'px-build-menu__body--mobile' : ''}`}>
          <section className="px-build-menu__sidebar">
            {!isMobile && (
              <div className="px-build-menu__intro">
                <div className="px-build-menu__intro-top">
                  <span className="px-label" style={{ color: activeTabMeta.tone }}>Category</span>
                  <span className="px-build-menu__count">{items.length}</span>
                </div>
                <div className="px-build-menu__intro-title">{activeTabMeta.label}</div>
                <p className="px-body px-build-menu__intro-copy">{activeTabMeta.blurb}</p>
              </div>
            )}

            {isMobile && (
              <div className="px-build-menu__mobile-summary">
                <span className="px-build-menu__mobile-category" style={{ color: activeTabMeta.tone }}>
                  {activeTabMeta.label}
                </span>
                <span className="px-build-menu__mobile-count">{items.length}</span>
              </div>
            )}

            <div className={`px-build-menu__tabs ${isMobile ? 'px-build-menu__tabs--mobile' : ''}`}>
              {TABS.map(({ id, label, Icon, tone }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    className={`px-btn px-build-menu__tab ${isActive ? 'px-btn--active' : ''}`}
                    style={{ color: isActive ? '#fff' : tone }}
                    onClick={() => setActiveTab(id)}
                  >
                    <span className="px-build-menu__tab-main">
                      <Icon className="px-icon-sm" />
                      <span>{label}</span>
                    </span>
                    <span className="px-build-menu__tab-count">{groups[id].length}</span>
                  </button>
                );
              })}
            </div>

            {!isMobile && (
              <BuildSelectionCard
                item={selectedItem}
                canAfford={selectedAffordable}
                compact={false}
              />
            )}
          </section>

          <section className="px-build-menu__catalog">
            <div className="px-build-menu__catalog-head">
              <div className="px-build-menu__catalog-copy">
                <span className="px-label">{isMobile ? 'Build' : 'Choose a piece'}</span>
                <span className="px-build-menu__catalog-title">{isMobile ? activeTabMeta.blurb : 'Select what you want to place'}</span>
              </div>
              {!isMobile && (
                <div className="px-build-menu__catalog-hint">
                  Select an item to review size, cost and placement
                </div>
              )}
            </div>

            {items.length > 0 ? (
                <div className="px-build-menu__grid px-scroll-hidden">
                {items.map(item => {
                  const affordable = canAfford(item.cost);
                  const active = selectedItem ? getItemKey(item) === getItemKey(selectedItem) : false;

                  return (
                    <button
                      key={getItemKey(item)}
                      className={`px-card px-build-item${!affordable ? ' px-build-item--locked' : ''}${active ? ' px-build-item--active' : ''}`}
                      onMouseEnter={() => {
                        if (!isMobile) setSelectedKey(getItemKey(item));
                      }}
                      onFocus={() => setSelectedKey(getItemKey(item))}
                      onClick={() => {
                        setSelectedKey(getItemKey(item));
                        if (affordable) onSelectBuilding(item);
                      }}
                    >
                      <div className="px-build-item__thumb">
                        <BuildingIcon type={item.type} subType={item.subType} className="px-build-item__emoji" />
                      </div>

                      <div className="px-build-item__body">
                        <div className="px-build-item__name">{item.name}</div>
                        <div className="px-build-item__meta">
                          <span className="px-build-item__price" style={{ color: affordable ? 'var(--px-gold)' : 'var(--px-red)' }}>
                            ${item.cost}
                          </span>
                          <span className="px-build-item__size">{getSizeLabel(item)}</span>
                        </div>
                        {isMobile && active && (
                          <div className="px-build-item__mobile-detail">
                            <span className="px-build-item__mobile-desc">{item.description}</span>
                            {!affordable && <span className="px-build-item__mobile-lock">Not enough money</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-build-menu__empty">
                <div className="px-build-menu__empty-title">Nothing here yet</div>
                <p className="px-body">
                  This category has no unlocked items right now. Research more content or switch to another tab.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function BuildSelectionCard({
  item,
  canAfford,
  compact,
}: {
  item: BuildingCatalogItem | null;
  canAfford: boolean;
  compact: boolean;
}) {
  if (!item) {
    return (
      <div className="px-build-selection px-build-selection--empty">
        <div className="px-build-selection__empty-title">No selection</div>
        <p className="px-body">Choose an item from the catalog to preview its cost and placement rules.</p>
      </div>
    );
  }

  return (
    <div className={`px-build-selection ${compact ? 'px-build-selection--compact' : ''}`}>
      <div className="px-build-selection__top">
        <div className="px-build-selection__identity">
          <BuildingIcon type={item.type} subType={item.subType} className="px-build-selection__emoji" />
          <div className="px-build-selection__copy">
            <div className="px-build-selection__name">{item.name}</div>
            <p className="px-body px-build-selection__description">{item.description}</p>
          </div>
        </div>
      </div>

      <div className="px-build-selection__facts">
        <div className="px-chip">${item.cost}</div>
        <div className="px-chip">{getSizeLabel(item)}</div>
      </div>
      {!canAfford && (
        <div className="px-build-selection__status px-build-selection__status--locked">
          <Hammer className="px-icon-sm" />
          <span>Not enough money for this item</span>
        </div>
      )}
    </div>
  );
}
