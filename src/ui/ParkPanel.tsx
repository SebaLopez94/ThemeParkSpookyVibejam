import { Coins, FlaskConical, Lock, Ticket, TrendingDown, TrendingUp, Unlock, Users, X } from 'lucide-react';
import { EconomyState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ParkPanelProps {
  economy: EconomyState;
  localTicketPrice: number;
  onTicketPriceChange: (value: number) => void;
  onTicketPriceCommit: () => void;
  onToggleParkOpen: (isOpen: boolean) => void;
  activeResearchLabel: string;
  onClose?: () => void;
}

export function ParkPanel({
  economy,
  localTicketPrice,
  onTicketPriceChange,
  onTicketPriceCommit,
  onToggleParkOpen,
  activeResearchLabel,
  onClose
}: ParkPanelProps) {
  const isMobile = useIsMobile();
  const netPositive = economy.netProfit >= 0;

  return (
    <div className="px-panel px-panel--park px-overlay-panel" style={{ width: '100%', maxHeight: isMobile ? '56vh' : '52vh', padding: 0 }}>
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <span className="px-label" style={{ color: 'var(--px-muted)' }}>Manage Park</span>
          <span className="px-overlay-panel__count">{economy.isOpen ? 'ON' : 'OFF'}</span>
        </div>
        {onClose && (
          <button className="px-btn px-btn--sm" aria-label="Close panel" onClick={onClose} style={isMobile ? { padding: '4px 8px', minHeight: 32 } : undefined}>
            <X />
          </button>
        )}
      </div>

      <div className="px-overlay-panel__body px-scroll-hidden" style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', gap: isMobile ? 10 : 12 }}>
          <div
            className="px-stat"
            style={{
              background: 'linear-gradient(180deg, rgba(34,18,56,0.96) 0%, rgba(14,10,30,0.96) 100%)',
              border: '2px solid rgba(167,139,250,0.18)',
              padding: isMobile ? '10px' : '12px 14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                  PARK STATUS
                </div>
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: isMobile ? 10 : 12,
                    color: economy.isOpen ? 'var(--px-green-hi)' : 'var(--px-red)',
                    lineHeight: 1.7
                  }}
                >
                  {economy.isOpen ? <Unlock className="px-icon-sm" color="var(--px-green-hi)" /> : <Lock className="px-icon-sm" color="var(--px-red)" />}
                  {economy.isOpen ? 'OPEN TO GUESTS' : 'PARK CLOSED'}
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <span className="px-label" style={{ fontSize: isMobile ? 7 : 8, color: economy.isOpen ? 'var(--px-green-hi)' : 'var(--px-red)' }}>
                  {economy.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
                <input
                  type="checkbox"
                  checked={economy.isOpen}
                  onChange={e => onToggleParkOpen(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--px-green)', cursor: 'pointer' }}
                />
              </label>
            </div>

            <div className="px-body" style={{ marginTop: 8, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
              {economy.isOpen
                ? 'Guests can enter, spend money, and keep your park alive.'
                : 'Spawns stop and current visitors head back toward the entrance.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))', gap: isMobile ? 6 : 8 }}>
            <StatTile
              icon={<Coins className="px-icon-sm" color="var(--px-gold)" />}
              label="CASH"
              value={`$${economy.money.toLocaleString()}`}
              color="var(--px-gold)"
              mobile={isMobile}
            />
            <StatTile
              icon={<Users className="px-icon-sm" color="var(--px-cyan)" />}
              label="GUESTS"
              value={`${economy.activeVisitors}`}
              color="var(--px-cyan)"
              mobile={isMobile}
            />
            <StatTile
              icon={<TrendingUp className="px-icon-sm" color={netPositive ? 'var(--px-green-hi)' : 'var(--px-red)'} />}
              label="NET"
              value={`${netPositive ? '+' : ''}$${economy.netProfit.toLocaleString()}`}
              color={netPositive ? 'var(--px-green-hi)' : 'var(--px-red)'}
              mobile={isMobile}
            />
            <StatTile
              icon={<FlaskConical className="px-icon-sm" color="var(--px-cyan)" />}
              label="RESEARCH"
              value={activeResearchLabel.toUpperCase()}
              color="var(--px-text)"
              mobile={isMobile}
              compact
            />
          </div>

          <div
            className="px-card"
            style={{
              cursor: 'default',
              padding: isMobile ? '10px' : '12px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(20,13,36,0.98) 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Ticket className="px-icon-sm" color="var(--px-gold)" />
                <div
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: isMobile ? 9 : 10,
                    color: 'var(--px-text)',
                    lineHeight: 1.7
                  }}
                >
                  ENTRY PRICE
                </div>
              </div>
              <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px', color: 'var(--px-gold)' }}>
                ${Math.max(0, Math.min(50, Math.round(localTicketPrice || 0)))}
              </div>
            </div>

            <div className="px-body" style={{ marginBottom: 8, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
              Higher prices raise ticket income, but pushing too hard can slow long-term momentum.
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 11 : 13, color: 'var(--px-gold)' }}>$</span>
              <input
                className="px-input"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Entry ticket price"
                min={0}
                max={50}
                value={localTicketPrice}
                onChange={e => onTicketPriceChange(Number(e.target.value))}
                onBlur={onTicketPriceCommit}
                onKeyDown={e => e.key === 'Enter' && onTicketPriceCommit()}
                style={{ fontSize: 13, padding: isMobile ? '7px 10px' : '8px 10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
            <MiniStat
              icon={<TrendingUp className="px-icon-sm" color="var(--px-green-hi)" />}
              label="INCOME"
              value={`$${economy.dailyIncome.toLocaleString()}`}
              valueColor="var(--px-green-hi)"
              mobile={isMobile}
            />
            <MiniStat
              icon={<TrendingDown className="px-icon-sm" color="var(--px-red)" />}
              label="EXPENSES"
              value={`$${economy.dailyExpenses.toLocaleString()}`}
              valueColor="var(--px-red)"
              mobile={isMobile}
            />
          </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
  mobile,
  compact = false
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  mobile: boolean;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: mobile ? '7px 8px' : '8px 10px',
        display: 'grid',
        gap: 5,
        minWidth: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span className="px-label" style={{ fontSize: mobile ? 7 : 8 }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: compact ? "ui-monospace, 'Consolas', 'Courier New', monospace" : "'Press Start 2P', monospace",
          fontSize: compact ? (mobile ? 9 : 11) : (mobile ? 10 : 11),
          color,
          lineHeight: compact ? 1.4 : 1.6,
          wordBreak: 'break-word'
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  valueColor,
  mobile
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
  mobile: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: mobile ? '8px 9px' : '9px 10px',
        display: 'grid',
        gap: 6
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span className="px-label" style={{ fontSize: mobile ? 7 : 8 }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: mobile ? 10 : 11,
          color: valueColor,
          lineHeight: 1.6
        }}
      >
        {value}
      </div>
    </div>
  );
}
