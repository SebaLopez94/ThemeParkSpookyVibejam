import { CSSProperties, HTMLAttributes, RefObject, useEffect, useMemo, useState } from 'react';
import { Hammer, Map, Package, PartyPopper, Store, Trash2, TreePine, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAllCatalogItems } from '../data/buildings';
import { BuildingCatalogItem, BuildingDefinition, BuildingType, PlaceableBuildingKind, RIDE_SIZES, RideType } from '../types';

const STAT_DOT_FILL: Record<string, string> = {
  FUN:     'linear-gradient(180deg, #e9d5ff 0%, #a78bfa 45%, #5b21b6 100%)',
  HUNGER:  'linear-gradient(180deg, #fef3c7 0%, #fbbf24 45%, #a16207 100%)',
  THIRST:  'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 45%, #0369a1 100%)',
  HYGIENE: 'linear-gradient(180deg, #d1fae5 0%, #4ade80 45%, #15803d 100%)',
  APPEAL:  'linear-gradient(180deg, #ffedd5 0%, #fb923c 45%, #c2410c 100%)',
};
import { useIsMobile } from '../hooks/useIsMobile';
import { BuildAssetPreview } from './BuildAssetPreview';

interface BuildMenuProps {
  onSelectBuilding: (definition: BuildingDefinition) => void;
  onCancel: () => void;
  canAfford: (cost: number) => boolean;
  unlockedBuildings: PlaceableBuildingKind[];
  bottom?: number | string;
  mobileSheetClassName?: string;
  mobileSheetStyle?: CSSProperties;
  mobileSheetHandlers?: HTMLAttributes<HTMLDivElement>;
  mobileSheetRef?: RefObject<HTMLDivElement>;
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

function getFunDots(quality: number): number {
  return Math.max(1, Math.min(10, Math.round(quality / 10)));
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

export function BuildMenu({
  onSelectBuilding,
  onCancel,
  canAfford,
  unlockedBuildings,
  bottom,
  mobileSheetClassName,
  mobileSheetStyle,
  mobileSheetHandlers,
  mobileSheetRef
}: BuildMenuProps) {
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
        top: 0,
        bottom: 'calc(56px + var(--safe-bottom))',
        left: 0,
        right: 0,
        zIndex: 80,
        ...mobileSheetStyle,
      }
    : {
        position: 'fixed' as const,
        bottom: bottom ?? 16,
        left: '50%',
        zIndex: 40,
      };

  return (
    <motion.div
      ref={isMobile ? mobileSheetRef : undefined}
      className={isMobile ? mobileSheetClassName : undefined}
      style={shellStyle}
      initial={isMobile ? { y: "100%", opacity: 0.98 } : { y: 20, x: "-50%", opacity: 0 }}
      animate={isMobile ? { y: 0, opacity: 1 } : { y: 0, x: "-50%", opacity: 1 }}
      exit={isMobile ? { y: "100%", opacity: 0.98, transition: { type: "tween", duration: 0.25, ease: "easeInOut" } } : { y: 20, x: "-50%", opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      {...(isMobile ? mobileSheetHandlers : undefined)}
    >
      <div
        className={`px-panel px-panel--build px-build-menu${isMobile ? '' : ' px-anim-enter-up'}`}
        style={{
          width: isMobile ? undefined : 920,
          maxWidth: isMobile ? undefined : '96vw',
          height: isMobile ? '100%' : undefined,
          margin: isMobile ? 0 : undefined,
          padding: 0,
          maxHeight: isMobile ? '100%' : 'min(78vh, 760px)',
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
                    className={`px-btn px-build-menu__tab px-build-menu__tab--${id} ${isActive ? 'px-btn--active' : ''}`}
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
                      <BuildAssetPreview item={item} />

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
    </motion.div>
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

  const funDots = getFunDots(item.quality);

  return (
    <div className={`px-build-selection ${compact ? 'px-build-selection--compact' : ''}`}>
      <div className="px-build-selection__copy">
        <div className="px-build-selection__name">{item.name}</div>
        <p className="px-body px-build-selection__description">{item.description}</p>
      </div>

      {item.type === BuildingType.RIDE && (
        <div className="px-build-selection__fun">
          <div className="px-build-selection__fun-head">
            <span>FUN</span>
            <span>{funDots}/10</span>
          </div>
          <div className="px-build-selection__fun-dots" aria-label={`Fun ${funDots} out of 10`}>
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={index}
                className={`px-build-selection__fun-dot${index < funDots ? ' px-build-selection__fun-dot--filled' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {item.type !== BuildingType.RIDE && item.statBars && item.statBars.length > 0 && (
        <div className="px-build-selection__fun" style={{ gap: 6 }}>
          {item.statBars.map(bar => (
            <div key={bar.label}>
              <div className="px-build-selection__fun-head">
                <span>{bar.label}</span>
                <span>{bar.filled}/10</span>
              </div>
              <div className="px-build-selection__fun-dots" aria-label={`${bar.label} ${bar.filled} out of 10`}>
                {Array.from({ length: 10 }).map((_, index) => (
                  <span
                    key={index}
                    className="px-build-selection__fun-dot"
                    style={index < bar.filled
                      ? { background: STAT_DOT_FILL[bar.label] ?? STAT_DOT_FILL.FUN }
                      : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-build-selection__facts">
        <span>${item.cost}</span>
        <span>{getSizeLabel(item)}</span>
      </div>
    </div>
  );
}
