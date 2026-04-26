import { CSSProperties } from 'react';
import { Download, Lock, Ticket, Unlock, Upload, X } from 'lucide-react';
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

const CARD: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%), rgba(139,92,246,0.06)',
  border: '1px solid rgba(139,92,246,0.22)',
  borderRadius: 8,
};

export function ParkPanel({
  economy,
  localTicketPrice,
  onTicketPriceChange,
  onTicketPriceCommit,
  onToggleParkOpen,
  onSaveGame,
  onLoadGame,
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

      <div className="px-overlay-panel__body px-scroll-hidden" style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', alignContent: 'start', gap: isMobile ? 10 : 12 }}>

        {/* ── Park Status ──────────────────────────── */}
        <div style={{ ...CARD, padding: isMobile ? '10px 12px' : '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {economy.isOpen
                ? <Unlock size={14} color="var(--px-green-hi)" />
                : <Lock size={14} color="var(--px-red)" />}
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: isMobile ? 9 : 10,
                color: economy.isOpen ? 'var(--px-green-hi)' : 'var(--px-red)',
                textShadow: economy.isOpen ? '0 0 8px rgba(217,249,157,0.35)' : '0 0 8px rgba(251,113,133,0.35)',
              }}>
                {economy.isOpen ? 'OPEN TO GUESTS' : 'PARK CLOSED'}
              </span>
            </div>
            <label className="px-toggle" style={{ gap: isMobile ? 8 : 10 }}>
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
          <div className="px-body" style={{ marginTop: 8, fontSize: isMobile ? 11 : undefined, lineHeight: 1.6, color: 'rgba(221,214,254,0.65)' }}>
            {economy.isOpen
              ? 'Guests can enter, spend money, and keep your park alive.'
              : 'Spawns stop and current visitors head back toward the entrance.'}
          </div>
        </div>

        {/* ── Entry ticket price ───────────────────── */}
        <div style={{ ...CARD, padding: isMobile ? '10px 12px' : '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Ticket size={12} color="var(--px-gold)" />
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 8 : 9, color: 'rgba(221,214,254,0.75)', letterSpacing: '0.5px' }}>
                ENTRY PRICE
              </span>
            </div>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 10 : 11, color: 'var(--px-gold)', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 5, padding: '4px 8px' }}>
              ${Math.max(0, Math.min(50, Math.round(localTicketPrice || 0)))}
            </span>
          </div>

          <div className="px-body" style={{ marginBottom: 8, fontSize: isMobile ? 10 : 11, lineHeight: 1.6, color: 'rgba(196,181,253,0.6)' }}>
            Higher prices raise income, but can slow long-term momentum.
          </div>
          <div className="px-body" style={{ marginBottom: 10, fontSize: isMobile ? 10 : 11, lineHeight: 1.5, color: 'rgba(196,181,253,0.5)' }}>
            Upkeep: <span style={{ color: 'var(--px-gold)' }}>${economy.maintenancePerMinute.toLocaleString()}</span> / min
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

        {/* ── Save / Load ──────────────────────────── */}
        <div style={{ ...CARD, padding: isMobile ? '10px 12px' : '12px 14px' }}>
          <div style={{
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 8 : 9, color: 'rgba(221,214,254,0.75)', letterSpacing: '0.5px', marginBottom: 6 }}>
                SAVE FILE
              </div>
              <div className="px-body" style={{ fontSize: isMobile ? 10 : 11, lineHeight: 1.6, color: 'rgba(196,181,253,0.6)' }}>
                Export the current park or load a saved one.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <button className="px-btn" style={{ minWidth: isMobile ? 0 : 104, justifyContent: 'center' }} onClick={onSaveGame}>
                <Download size={14} /> SAVE
              </button>
              <button className="px-btn" style={{ minWidth: isMobile ? 0 : 104, justifyContent: 'center' }} onClick={onLoadGame}>
                <Upload size={14} /> LOAD
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

