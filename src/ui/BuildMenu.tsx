import { useState } from 'react';
import { Hammer, Map, Package, PartyPopper, Store, Trash2, TreePine, X } from 'lucide-react';
import { getAllCatalogItems, getPathDefinition } from '../data/buildings';
import { BuildingDefinition, BuildingType, PlaceableBuildingKind, RIDE_SIZES, RideType } from '../types';

interface BuildMenuProps {
  onSelectBuilding: (definition: BuildingDefinition) => void;
  onCancel: () => void;
  canAfford: (cost: number) => boolean;
  unlockedBuildings: PlaceableBuildingKind[];
}

type Tab = 'paths' | 'rides' | 'shops' | 'services' | 'decor';

const TABS: Array<{ id: Tab; label: string; Icon: typeof Map }> = [
  { id: 'paths',    label: 'PATHS',    Icon: Map },
  { id: 'rides',    label: 'RIDES',    Icon: PartyPopper },
  { id: 'shops',    label: 'SHOPS',    Icon: Store },
  { id: 'services', label: 'SERVICES', Icon: Package },
  { id: 'decor',    label: 'DECOR',    Icon: TreePine },
];

function getSizeLabel(def: BuildingDefinition): string {
  if (def.type === BuildingType.RIDE && def.subType) {
    const s = RIDE_SIZES[def.subType as RideType];
    return `${s.width}×${s.height}`;
  }
  return '1×1';
}

export function BuildMenu({ onSelectBuilding, onCancel, canAfford, unlockedBuildings }: BuildMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab>('paths');
  const [hovered, setHovered] = useState<BuildingDefinition | null>(null);

  const catalog = getAllCatalogItems();
  const unlockedSet = new Set(unlockedBuildings);

  const groups: Record<Tab, BuildingDefinition[]> = {
    paths:    [getPathDefinition()],
    rides:    [],
    shops:    [],
    services: [],
    decor:    [],
  };

  catalog.forEach(item => {
    if (item.type !== BuildingType.PATH && item.subType && !unlockedSet.has(item.subType)) return;
    if (item.type === BuildingType.RIDE)       groups.rides.push(item);
    if (item.type === BuildingType.SHOP)       groups.shops.push(item);
    if (item.type === BuildingType.SERVICE)    groups.services.push(item);
    if (item.type === BuildingType.DECORATION) groups.decor.push(item);
  });

  const items = groups[activeTab];
  const info = hovered ?? items[0] ?? null;

  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
      <div
        className="px-panel px-panel--build"
        style={{ width: 740, maxWidth: '96vw', padding: 0 }}
      >

        {/* ── Title bar ──────────────────────────────────────────────── */}
        <div className="px-titlebar px-titlebar--build">
          <span className="px-titlebar__label">
            <Hammer />
            CONSTRUCTION
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="px-btn px-btn--danger"
              style={{ fontSize: 11, padding: '8px 14px' }}
              onClick={() => onSelectBuilding({
                type: BuildingType.DELETE, name: 'Banish',
                description: 'Remove a building (50% refund)', cost: 0, icon: '🗑️'
              })}
            >
              <Trash2 size={16} /> DELETE
            </button>
            <button
              className="px-btn"
              style={{ fontSize: 11, padding: '8px 14px' }}
              onClick={onCancel}
            >
              <X size={16} /> CLOSE
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>

          {/* ── Category tabs ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`px-btn ${activeTab === id ? 'px-btn--active' : ''}`}
                style={{ fontSize: 11, padding: '9px 14px', flex: 1, justifyContent: 'center' }}
                onClick={() => { setActiveTab(id); setHovered(null); }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Item row ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {items.map(def => {
              const affordable = canAfford(def.cost);
              const isHovered  = hovered === def;
              return (
                <button
                  key={`${def.type}:${def.subType ?? def.name}`}
                  className={`px-card${!affordable ? ' px-card--disabled' : ''}`}
                  style={{
                    width: 148,
                    padding: '12px 10px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    outline: isHovered ? '2px solid var(--px-green)' : 'none',
                    outlineOffset: 2,
                  }}
                  onMouseEnter={() => setHovered(def)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => affordable && onSelectBuilding(def)}
                >
                  {/* icon */}
                  <div className="px-emoji" style={{ fontSize: 30, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {def.icon}
                  </div>

                  {/* name */}
                  <div style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 9,
                    color: 'var(--px-text)',
                    textAlign: 'center',
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                  }}>
                    {def.name}
                  </div>

                  {/* cost + size row */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 12,
                      color: affordable ? 'var(--px-gold)' : 'var(--px-red)',
                      textShadow: '1px 1px 0 #000',
                    }}>
                      ${def.cost}
                    </span>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 9,
                      color: 'var(--px-muted)',
                      background: 'rgba(0,0,0,0.35)',
                      padding: '3px 5px',
                    }}>
                      {getSizeLabel(def)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Info strip ─────────────────────────────────────────────── */}
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.35)',
            border: '2px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            minHeight: 44,
          }}>
            {info ? (
              <>
                <span className="px-emoji" style={{ fontSize: 22, flexShrink: 0 }}>{info.icon}</span>
                <div>
                  <div style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 11,
                    color: 'var(--px-green-hi)',
                    marginBottom: 4,
                  }}>
                    {info.name}
                  </div>
                  <div className="px-body" style={{ fontSize: 12 }}>
                    {info.description || 'Hover an item to see details.'}
                  </div>
                </div>
              </>
            ) : (
              <div className="px-body">Hover an item to see details.</div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
