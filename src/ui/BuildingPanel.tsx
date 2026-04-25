import { useEffect, useState } from 'react';
import { ArrowRightLeft, Settings2, Trash2, X } from 'lucide-react';
import { BuildingType, GridPosition, SelectedBuildingInfo } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';
import { getRecommendedPrice } from '../data/buildingEconomy';

interface BuildingPanelProps {
  building: SelectedBuildingInfo;
  onClose: () => void;
  onDelete: (position: GridPosition) => void;
  onMove: (info: SelectedBuildingInfo) => void;
  onPriceChange: (position: GridPosition, newPrice: number) => void;
}

const MIN_PRICE = 1;
const MAX_PRICE = 999;

function getPriceStatus(currentPrice: number | null, recommendedPrice: number | null): { label: string; tone: 'good' | 'warn' | 'neutral' } {
  if (currentPrice === null || recommendedPrice === null) return { label: 'Ambience support', tone: 'neutral' };
  if (currentPrice <= 0) return { label: 'Free entry', tone: 'warn' };
  if (currentPrice > recommendedPrice * 1.35) return { label: 'Price may slow demand', tone: 'warn' };
  if (currentPrice < recommendedPrice * 0.7) return { label: 'Room to raise price', tone: 'good' };
  return { label: 'Fair price', tone: 'good' };
}

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function getJoyImpact(effectSummary: string): number | null {
  const match = effectSummary.match(/Joy \+(\d+)/i);
  return match ? Number(match[1]) : null;
}

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
  const recommendedPrice = building.currentPrice === null ? null : getRecommendedPrice(building.valueScore, building.quality);
  const previewPrice = building.currentPrice === null ? null : Math.max(MIN_PRICE, Math.min(MAX_PRICE, Math.round(localPrice || 0)));
  const priceStatus = getPriceStatus(previewPrice, recommendedPrice);
  const breakEvenVisits = previewPrice && previewPrice > 0
    ? Math.ceil(building.maintenancePerMinute / previewPrice)
    : null;
  const isDecoration = building.buildingType === BuildingType.DECORATION;
  const priceLabel = building.buildingType === BuildingType.RIDE ? 'Admission Price' : 'Service Price';
  const joyImpact = getJoyImpact(building.effectSummary);

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
          <div className="px-building-summary">
            <div className="px-building-summary__copy">
              <span className="px-building-type-tag">{building.buildingType}</span>
              {joyImpact !== null ? (
                <JoyImpactBar value={joyImpact} />
              ) : (
                <strong>{building.effectSummary}</strong>
              )}
            </div>
            <div className={`px-building-status px-building-status--${priceStatus.tone}`}>
              {priceStatus.label}
            </div>
          </div>

          <div className="px-building-metrics">
            <Metric
              label="Upkeep"
              value={building.maintenancePerMinute > 0 ? `${formatMoney(building.maintenancePerMinute)} / min` : '$0 / min'}
              tone={building.maintenancePerMinute > 0 ? 'warn' : 'good'}
            />
            {isDecoration ? (
              <Metric label="Effect" value={building.effectSummary} tone="good" />
            ) : (
              <Metric
                label="Break-even"
                value={breakEvenVisits === null ? 'Needs price' : `${breakEvenVisits} guests / min`}
                tone={breakEvenVisits !== null && breakEvenVisits <= 4 ? 'good' : 'warn'}
              />
            )}
            <Metric label="Refund" value={formatMoney(refundAmount)} tone="neutral" />
          </div>

          {building.currentPrice !== null ? (
            <div className="px-building-price" style={{ marginBottom: isMobile ? 12 : 16 }}>
              <label
                htmlFor="building-price"
                className="px-label"
                style={{ display: 'block', marginBottom: 8, fontSize: isMobile ? 9 : undefined }}
              >
                {priceLabel}
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
              {recommendedPrice !== null && (
                <div className="px-building-hint">
                  Recommended around {formatMoney(recommendedPrice)} for this value/quality.
                </div>
              )}
            </div>
          ) : (
            <div className="px-building-hint-card" style={{ marginBottom: isMobile ? 12 : 16 }}>
              Decorations do not charge guests. Use them near paths and busy areas to improve park appeal.
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

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral';
}) {
  return (
    <div className={`px-building-metric px-building-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JoyImpactBar({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, (value / 40) * 100));
  const tone = value >= 32 ? 'high' : value >= 22 ? 'mid' : 'low';

  return (
    <div className="px-building-impact">
      <div className="px-building-impact__head">
        <span>Joy impact</span>
        <strong>+{value}</strong>
      </div>
      <div className={`px-building-impact__bar px-building-impact__bar--${tone}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
