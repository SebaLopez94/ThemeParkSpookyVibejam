import { CSSProperties } from 'react';
import { Coins, Download, FlaskConical, Lock, Ticket, Unlock, Upload, Users, X } from 'lucide-react';
import { EconomyState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ParkPanelProps {
  economy: EconomyState;
  localTicketPrice: number;
  onTicketPriceChange: (value: number) => void;
  onTicketPriceCommit: () => void;
  onToggleParkOpen: (isOpen: boolean) => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  activeResearchLabel: string;
  onClose?: () => void;
  style?: CSSProperties;
}

export function ParkPanel({
  economy,
  localTicketPrice,
  onTicketPriceChange,
  onTicketPriceCommit,
  onToggleParkOpen,
  onSaveGame,
  onLoadGame,
  activeResearchLabel,
  onClose,
  style
}: ParkPanelProps) {
  const isMobile = useIsMobile();
  return (
    <div className="px-panel px-panel--park px-overlay-panel" style={{ width: '100%', maxHeight: isMobile ? '56vh' : 'calc(100vh - 32px)', padding: 0, ...style }}>
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <span className="px-label" style={{ color: 'var(--px-muted)' }}>Manage Park</span>
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

              <label className="px-toggle" style={{ gap: isMobile ? 8 : 10 }}>
                <span className="px-label" style={{ fontSize: isMobile ? 7 : 8, color: economy.isOpen ? 'var(--px-green-hi)' : 'var(--px-red)' }}>
                  {economy.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
                <input
                  className="px-toggle__input"
                  type="checkbox"
                  checked={economy.isOpen}
                  onChange={e => onToggleParkOpen(e.target.checked)}
                />
                <span className="px-toggle__track" aria-hidden="true">
                  <span className="px-toggle__thumb" />
                </span>
              </label>
            </div>

            <div className="px-body" style={{ marginTop: 8, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
              {economy.isOpen
                ? 'Guests can enter, spend money, and keep your park alive.'
                : 'Spawns stop and current visitors head back toward the entrance.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 6 : 8 }}>
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

            <div className="px-body" style={{ marginBottom: 10, fontSize: isMobile ? 10 : 12, lineHeight: 1.45 }}>
              Current upkeep is ${economy.maintenancePerMinute.toLocaleString()} per minute.
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

          <div
            className="px-card"
            style={{
              cursor: 'default',
              padding: isMobile ? '10px' : '12px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(14,10,28,0.98) 100%)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexDirection: isMobile ? 'column' : 'row'
              }}
            >
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                  SAVE FILE
                </div>
                <div className="px-body" style={{ marginTop: 8, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
                  Export the current park to a file or load a saved park from your device.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="px-btn" style={{ minWidth: isMobile ? 0 : 118, justifyContent: 'center' }} onClick={onSaveGame}>
                  <Download size={15} />
                  SAVE
                </button>
                <button className="px-btn" style={{ minWidth: isMobile ? 0 : 118, justifyContent: 'center' }} onClick={onLoadGame}>
                  <Upload size={15} />
                  LOAD
                </button>
              </div>
            </div>
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
