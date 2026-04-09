import { useMemo, useState } from 'react';
import { Hammer, Map, Package, PartyPopper, Store, Trash2, X } from 'lucide-react';
import { getAllCatalogItems, getPathDefinition } from '../data/buildings';
import { BuildingDefinition, BuildingType, PlaceableBuildingKind, RIDE_SIZES, RideType } from '../types';

interface BuildMenuProps {
  onSelectBuilding: (definition: BuildingDefinition) => void;
  onCancel: () => void;
  canAfford: (cost: number) => boolean;
  unlockedBuildings: PlaceableBuildingKind[];
}

type Tab = 'paths' | 'rides' | 'shops' | 'services' | 'decor';

const TABS: Array<{ id: Tab; label: string; icon: typeof Map }> = [
  { id: 'paths', label: 'Paths', icon: Map },
  { id: 'rides', label: 'Rides', icon: PartyPopper },
  { id: 'shops', label: 'Shops', icon: Store },
  { id: 'services', label: 'Services', icon: Package },
  { id: 'decor', label: 'Decor', icon: Hammer }
];

function getSizeLabel(definition: BuildingDefinition): string {
  if (definition.type === BuildingType.RIDE && definition.subType) {
    const size = RIDE_SIZES[definition.subType as RideType];
    return `${size.width}x${size.height}`;
  }
  return '1x1';
}

export function BuildMenu({ onSelectBuilding, onCancel, canAfford, unlockedBuildings }: BuildMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab>('paths');

  const catalog = useMemo(() => getAllCatalogItems(), []);
  const unlockedSet = useMemo(() => new Set(unlockedBuildings), [unlockedBuildings]);

  const groupedDefinitions = useMemo(() => {
    const base: Record<Tab, BuildingDefinition[]> = {
      paths: [getPathDefinition()],
      rides: [],
      shops: [],
      services: [],
      decor: []
    };

    catalog.forEach(item => {
      if (item.type !== BuildingType.PATH && item.subType && !unlockedSet.has(item.subType)) {
        return;
      }

      if (item.type === BuildingType.RIDE) base.rides.push(item);
      if (item.type === BuildingType.SHOP) base.shops.push(item);
      if (item.type === BuildingType.SERVICE) base.services.push(item);
      if (item.type === BuildingType.DECORATION) base.decor.push(item);
    });

    return base;
  }, [catalog, unlockedSet]);

  const current = groupedDefinitions[activeTab];

  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
      <div className="px-panel px-panel--build" style={{ minWidth: 940, maxWidth: '95vw', padding: 0 }}>
        <div className="px-titlebar px-titlebar--build">
          <span className="px-titlebar__label">
            <Hammer />
            CONSTRUCTION BAY
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="px-btn px-btn--danger"
              style={{ fontSize: 10, padding: '9px 14px' }}
              onClick={() => onSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Sell a building', cost: 0, icon: '🗑️' })}
            >
              <Trash2 />
              Delete
            </button>
            <button className="px-btn" style={{ fontSize: 10, padding: '9px 14px' }} onClick={onCancel}>
              <X />
              Close
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 18px 18px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`px-btn ${activeTab === tab.id ? 'px-btn--active' : ''}`}
                  style={{ fontSize: 10, padding: '10px 16px' }}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            {current.map(definition => {
              const affordable = canAfford(definition.cost);
              return (
                <button
                  key={`${definition.type}:${definition.subType ?? definition.name}`}
                  className={`px-card ${!affordable ? 'px-card--disabled' : ''}`}
                  onClick={() => affordable && onSelectBuilding(definition)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 34, marginBottom: 8 }}>{definition.icon}</div>
                    <div className="px-chip" style={{ fontSize: 8, padding: '6px 8px' }}>
                      {getSizeLabel(definition)}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: 'var(--px-text)', marginBottom: 6, lineHeight: 1.8 }}>
                    {definition.name}
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', marginBottom: 10, lineHeight: 1.9, minHeight: 46 }}>
                    {definition.description}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div className="px-label">Build Cost</div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: affordable ? 'var(--px-gold)' : 'var(--px-red)', textShadow: '1px 1px 0 #000' }}>
                      ${definition.cost}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-stat" style={{ marginTop: 14 }}>
            <div className="px-label">Build Flow</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-muted)', lineHeight: 1.9, marginTop: 8 }}>
              Select a building, place it on a valid tile, rotate with `R`, and cancel instantly with right click or `Esc`.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
