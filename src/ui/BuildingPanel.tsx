import { useEffect, useState } from 'react';
import { ArrowRightLeft, Coins, Settings2, Trash2, X } from 'lucide-react';
import { GridPosition, SelectedBuildingInfo } from '../types';

interface BuildingPanelProps {
  building: SelectedBuildingInfo;
  onClose: () => void;
  onDelete: (position: GridPosition) => void;
  onMove: (info: SelectedBuildingInfo) => void;
  onPriceChange: (position: GridPosition, newPrice: number) => void;
}

const MIN_PRICE = 1;
const MAX_PRICE = 999;

export function BuildingPanel({ building, onClose, onDelete, onMove, onPriceChange }: BuildingPanelProps) {
  const [localPrice, setLocalPrice] = useState(building.currentPrice ?? MIN_PRICE);

  useEffect(() => {
    setLocalPrice(building.currentPrice ?? MIN_PRICE);
  }, [building.id, building.currentPrice]);

  const commitPrice = () => {
    if (building.currentPrice === null) return;

    const clamped = Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(localPrice)));
    setLocalPrice(clamped);
    if (clamped !== building.currentPrice) {
      onPriceChange(building.position, clamped);
    }
  };

  const refundAmount = Math.floor(building.buildCost * 0.5);

  return (
    <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
      <div className="px-panel px-panel--manage" style={{ padding: 0, width: 410 }}>
        <div className="px-titlebar px-titlebar--manage">
          <span className="px-titlebar__label">
            <Settings2 size={16} />
            {building.name.toUpperCase()}
          </span>
          <button className="px-btn" style={{ fontSize: 10, padding: '6px 10px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '14px 18px 18px' }}>
          <div className="px-chip-row">
            <div className="px-chip">{building.icon} {building.buildingType}</div>
            <div className="px-chip">
              <Coins size={12} />
              Build ${building.buildCost}
            </div>
          </div>

          <hr className="px-divider" />

          {building.currentPrice !== null ? (
            <div style={{ marginBottom: 16 }}>
              <div className="px-label" style={{ marginBottom: 8 }}>
                {building.buildingType === 'ride' ? 'Admission Price' : 'Service Price'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: 'var(--px-gold)' }}>$</span>
                <input
                  className="px-input"
                  type="number"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  value={localPrice}
                  onChange={event => setLocalPrice(Number(event.target.value))}
                  onBlur={commitPrice}
                  onKeyDown={event => event.key === 'Enter' && commitPrice()}
                />
              </div>
            </div>
          ) : (
            <div className="px-stat" style={{ marginBottom: 16 }}>
              <div className="px-label">Decor Effect</div>
              <div className="px-stat__value" style={{ fontSize: 11, color: 'var(--px-green-hi)', lineHeight: 1.9 }}>
                Boosts nearby appeal and helps make zones more attractive.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="px-btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: 10 }}
              onClick={() => onMove(building)}
            >
              <ArrowRightLeft size={14} />
              Move
            </button>
            <button
              className="px-btn px-btn--danger"
              style={{ flex: 1, justifyContent: 'center', fontSize: 10 }}
              onClick={() => onDelete(building.position)}
            >
              <Trash2 size={14} />
              Sell +${refundAmount}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
