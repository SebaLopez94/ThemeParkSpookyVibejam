import { useState } from 'react';
import { Hammer, Map, Package, PartyPopper, Store, Trash2, TreePine, X } from 'lucide-react';
import { getAllCatalogItems, getPathDefinition } from '../data/buildings';
import { BuildingDefinition, BuildingType, PlaceableBuildingKind, RIDE_SIZES, RideType } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface BuildMenuProps {
  onSelectBuilding: (definition: BuildingDefinition) => void;
  onCancel: () => void;
  canAfford: (cost: number) => boolean;
  unlockedBuildings: PlaceableBuildingKind[];
  bottom?: number;
}

type Tab = 'rides' | 'shops' | 'services' | 'decor';

const TABS: Array<{ id: Tab; label: string; Icon: typeof Map }> = [
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

export function BuildMenu({ onSelectBuilding, onCancel, canAfford, unlockedBuildings, bottom }: BuildMenuProps) {
  const [activeTab, setActiveTab] = useState<Tab>('rides');
  const [hovered, setHovered] = useState<BuildingDefinition | null>(null);
  const [expanded, setExpanded] = useState<BuildingDefinition | null>(null);
  const isMobile = useIsMobile();

  const catalog = getAllCatalogItems();
  const unlockedSet = new Set(unlockedBuildings);

  const groups: Record<Tab, BuildingDefinition[]> = {
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

  if (isMobile) {
    return (
      <div style={{ position: 'fixed', bottom: bottom ?? 90, left: 0, right: 0, zIndex: 40 }}>
        <div className="px-panel px-panel--build" style={{ padding: 0, margin: '0 8px', maxHeight: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>

          {/* Titlebar */}
          <div className="px-titlebar px-titlebar--build" style={{ flexShrink: 0 }}>
            <span className="px-titlebar__label" style={{ fontSize: 11 }}>
              <Hammer size={14} /> BUILD
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="px-btn px-btn--danger" style={{ fontSize: 10, padding: '6px 10px' }}
                onClick={() => onSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a building (50% refund)', cost: 0, icon: '🗑️' })}>
                <Trash2 size={13} />
              </button>
              <button className="px-btn" style={{ fontSize: 10, padding: '6px 10px' }} onClick={onCancel}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Category tabs — icon only */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 8px 0', flexShrink: 0 }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id}
                className={`px-btn ${activeTab === id ? 'px-btn--active' : ''}`}
                style={{ flex: 1, padding: '8px 4px', fontSize: 9, flexDirection: 'column', gap: 3, justifyContent: 'center' }}
                onClick={() => { setActiveTab(id); setHovered(null); setExpanded(null); }}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Expanded item detail sheet */}
          {expanded && (
            <div style={{ margin: '8px 8px 0', padding: '12px 14px', background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(139,92,246,0.3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="px-emoji" style={{ fontSize: 28 }}>{expanded.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-green-hi)', marginBottom: 4 }}>{expanded.name}</div>
                  <div className="px-body" style={{ fontSize: 11, lineHeight: 1.6 }}>{expanded.description}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: canAfford(expanded.cost) ? 'var(--px-gold)' : 'var(--px-red)' }}>${expanded.cost}</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: 'var(--px-muted)' }}>{getSizeLabel(expanded)}</span>
                <div style={{ flex: 1 }} />
                <button className="px-btn" style={{ fontSize: 9, padding: '8px 12px' }} onClick={() => setExpanded(null)}>
                  <X size={12} />
                </button>
                <button
                  className="px-btn"
                  style={{ fontSize: 9, padding: '8px 12px', background: canAfford(expanded.cost) ? undefined : 'rgba(0,0,0,0.3)' }}
                  disabled={!canAfford(expanded.cost)}
                  onClick={() => { onSelectBuilding(expanded); setExpanded(null); }}
                >
                  BUILD
                </button>
              </div>
            </div>
          )}

          {/* Items grid — scrollable */}
          <div className="px-scroll-hidden" style={{ overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6 }}>
            {items.map(def => {
              const affordable = canAfford(def.cost);
              const isExpanded = expanded === def;
              return (
                <button key={`${def.type}:${def.subType ?? def.name}`}
                  className={`px-card${!affordable ? ' px-card--disabled' : ''}`}
                  style={{ padding: '10px 6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, outline: isExpanded ? '2px solid var(--px-border)' : 'none', outlineOffset: 2 }}
                  aria-label={`${def.name}, $${def.cost}${!affordable ? ', cannot afford' : ''}`}
                  onClick={() => {
                    if (!affordable) return;
                    if (isExpanded) { onSelectBuilding(def); setExpanded(null); }
                    else setExpanded(def);
                  }}
                >
                  <div className="px-emoji" style={{ fontSize: 26 }}>{def.icon}</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-word', color: 'var(--px-text)' }}>
                    {def.name}
                  </div>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: affordable ? 'var(--px-gold)' : 'var(--px-red)' }}>
                    ${def.cost}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: bottom ?? 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
      <div className="px-panel px-panel--build" style={{ width: 740, maxWidth: '96vw', padding: 0 }}>

        {/* ── Title bar ──────────────────────────────────────────────── */}
        <div className="px-titlebar px-titlebar--build">
          <span className="px-titlebar__label">
            <Hammer />
            CONSTRUCTION
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="px-btn px-btn--danger" style={{ fontSize: 11, padding: '8px 14px' }}
              onClick={() => onSelectBuilding({ type: BuildingType.DELETE, name: 'Banish', description: 'Remove a building (50% refund)', cost: 0, icon: '🗑️' })}>
              <Trash2 size={16} /> DELETE
            </button>
            <button className="px-btn" style={{ fontSize: 11, padding: '8px 14px' }} onClick={onCancel}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>

          {/* ── Category tabs ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id}
                className={`px-btn ${activeTab === id ? 'px-btn--active' : ''}`}
                style={{ fontSize: 11, padding: '9px 14px', flex: 1, justifyContent: 'center' }}
                onClick={() => { setActiveTab(id); setHovered(null); }}>
                <Icon size={15} />{label}
              </button>
            ))}
          </div>

          {/* ── Item row ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {items.map(def => {
              const affordable = canAfford(def.cost);
              const isHovered  = hovered === def;
              return (
                <button key={`${def.type}:${def.subType ?? def.name}`}
                  className={`px-card${!affordable ? ' px-card--disabled' : ''}`}
                  style={{ width: 148, padding: '12px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, outline: isHovered ? '2px solid var(--px-green)' : 'none', outlineOffset: 2 }}
                  onMouseEnter={() => setHovered(def)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => affordable && onSelectBuilding(def)}>
                  <div className="px-emoji" style={{ fontSize: 30, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{def.icon}</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-text)', textAlign: 'center', lineHeight: 1.6, wordBreak: 'break-word' }}>{def.name}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: affordable ? 'var(--px-gold)' : 'var(--px-red)', textShadow: '1px 1px 0 #000' }}>${def.cost}</span>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-muted)', background: 'rgba(0,0,0,0.35)', padding: '3px 5px' }}>{getSizeLabel(def)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Info strip ─────────────────────────────────────────────── */}
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14, minHeight: 44 }}>
            {info ? (
              <>
                <span className="px-emoji" style={{ fontSize: 22, flexShrink: 0 }}>{info.icon}</span>
                <div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: 'var(--px-green-hi)', marginBottom: 4 }}>{info.name}</div>
                  <div className="px-body" style={{ fontSize: 12 }}>{info.description || 'Hover an item to see details.'}</div>
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
