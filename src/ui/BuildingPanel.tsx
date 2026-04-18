import { useEffect, useState } from 'react';
import { ArrowRightLeft, Coins, Settings2, Trash2, X } from 'lucide-react';
import { GridPosition, SelectedBuildingInfo } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { BuildingIcon } from './BuildingIcon';

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
  const [confirmSell, setConfirmSell] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setLocalPrice(building.currentPrice ?? MIN_PRICE);
    setConfirmSell(false);
  }, [building.id, building.currentPrice]);

  const commitPrice = () => {
    if (building.currentPrice === null) return;
    const clamped = Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(localPrice)));
    setLocalPrice(clamped);
    if (clamped !== building.currentPrice) onPriceChange(building.position, clamped);
  };

  const refundAmount = Math.floor(building.buildCost * 0.5);

  const panelStyle = isMobile
    ? {
        position: 'fixed' as const,
        bottom: 'calc(72px + var(--safe-bottom))',
        left: 8,
        right: 8,
        zIndex: 46,
        maxHeight: 'calc(100dvh - 120px - var(--safe-bottom))',
      }
    : { position: 'fixed' as const, bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40 };

  return (
    <div style={panelStyle}>
      <div
        className="px-panel px-panel--manage px-anim-enter-up"
        style={{
          padding: 0,
          width: isMobile ? '100%' : 410,
          maxHeight: isMobile ? 'inherit' : undefined,
          overflow: 'hidden',
        }}
      >
        <div className="px-titlebar px-titlebar--manage">
          <span className="px-titlebar__label">
            <Settings2 className="px-icon-sm" />
            <span style={{ fontSize: isMobile ? 10 : 13 }}>{building.name.toUpperCase()}</span>
          </span>
          <button className="px-btn px-btn--sm" aria-label="Close panel" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            padding: isMobile ? '10px 12px 12px' : '14px 18px 18px',
            maxHeight: isMobile ? 'calc(100dvh - 176px - var(--safe-bottom))' : undefined,
            overflowY: isMobile ? 'auto' : undefined,
          }}
        >
          <div className="px-chip-row">
            <div className="px-chip" style={{ fontSize: isMobile ? 9 : 11 }}>
              <BuildingIcon type={building.buildingType} subType={building.subType} className="px-icon-sm" />
              {building.buildingType}
            </div>
            <div className="px-chip" style={{ fontSize: isMobile ? 9 : 11 }}>
              <Coins className="px-icon-sm" /> Build ${building.buildCost}
            </div>
          </div>

          <hr className="px-divider" />

          {building.currentPrice !== null ? (
            <div style={{ marginBottom: isMobile ? 12 : 16 }}>
              <label
                htmlFor="building-price"
                className="px-label"
                style={{ display: 'block', marginBottom: 8, fontSize: isMobile ? 9 : undefined }}
              >
                {building.buildingType === 'ride' ? 'Admission Price' : 'Service Price'}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 12 : 14, color: 'var(--px-gold)' }}>$</span>
                <input
                  id="building-price"
                  className="px-input"
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={MIN_PRICE}
                  max={MAX_PRICE}
                  value={localPrice}
                  onChange={e => setLocalPrice(Number(e.target.value))}
                  onBlur={commitPrice}
                  onKeyDown={e => e.key === 'Enter' && commitPrice()}
                />
              </div>
            </div>
          ) : (
            <div className="px-stat" style={{ marginBottom: isMobile ? 12 : 16 }}>
              <div className="px-label" style={{ fontSize: isMobile ? 9 : undefined }}>Decor Effect</div>
              <div className="px-stat__value" style={{ fontSize: isMobile ? 9 : 11, color: 'var(--px-green-hi)', lineHeight: 1.9 }}>
                Boosts nearby appeal and visitor happiness.
              </div>
            </div>
          )}

          {confirmSell ? (
            <div style={{ background: 'rgba(251,113,133,0.1)', border: '2px solid rgba(251,113,133,0.3)', padding: isMobile ? '10px 12px' : '12px 14px' }}>
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9, marginBottom: 10, color: 'var(--px-red)' }}>
                Sell for ${refundAmount}? (50% refund)
              </div>
              <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <button
                  className="px-btn px-btn--danger px-btn--sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => onDelete(building.position)}
                >
                  <Trash2 size={13} /> YES, SELL
                </button>
                <button
                  className="px-btn px-btn--sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setConfirmSell(false)}
                >
                  <X size={13} /> CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: isMobile ? 8 : 10, flexDirection: isMobile ? 'column' : 'row' }}>
              <button
                className="px-btn px-btn--sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onMove(building)}
              >
                <ArrowRightLeft size={13} /> Move
              </button>
              <button
                className="px-btn px-btn--danger px-btn--sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setConfirmSell(true)}
              >
                <Trash2 size={13} /> Sell +${refundAmount}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
