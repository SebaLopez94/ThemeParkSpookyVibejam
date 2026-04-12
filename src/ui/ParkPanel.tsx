import { Banknote, FlaskConical, Lock, Ticket, Unlock, X } from 'lucide-react';
import { EconomyState } from '../types';

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
  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '52vh', overflow: 'auto' }}>
      <div className="px-panel px-panel--park" style={{ padding: 0 }}>
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
            <button className="px-btn" style={{ padding: '4px 8px', minHeight: 0 }} onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        )}
        <div style={{ padding: '10px 14px 14px', display: 'grid', gap: 12 }}>

          {/* ── Park Status Toggle ─────────────────────────────── */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {economy.isOpen ? <Unlock size={14} color="var(--px-green-hi)" /> : <Lock size={14} color="var(--px-red)" />}
              <span className="px-label" style={{ fontSize: 10 }}>PARK STATUS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: economy.isOpen ? 'var(--px-green-hi)' : 'var(--px-red)' }}>
                {economy.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
              <input
                type="checkbox"
                checked={economy.isOpen}
                onChange={e => onToggleParkOpen(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--px-green)', cursor: 'pointer' }}
              />
            </div>
          </label>

          <hr className="px-divider" />

          {/* ── Entry ticket ───────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 100, flexShrink: 0 }}>
              <Ticket size={13} color="var(--px-gold)" />
              <span className="px-label" style={{ fontSize: 10 }}>ENTRY FEE</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: 'var(--px-gold)' }}>$</span>
              <input
                className="px-input"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Entry ticket price (0–50)"
                min={0}
                max={50}
                value={localTicketPrice}
                onChange={e => onTicketPriceChange(Number(e.target.value))}
                onBlur={onTicketPriceCommit}
                onKeyDown={e => e.key === 'Enter' && onTicketPriceCommit()}
                style={{ fontSize: 13, padding: '7px 10px' }}
              />
            </div>
          </div>

          <hr className="px-divider" />

          {/* ── Active research ────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={13} color="var(--px-border)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="px-label" style={{ fontSize: 9, marginBottom: 4 }}>ACTIVE RESEARCH</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: 'var(--px-text)', lineHeight: 1.8, wordBreak: 'break-word' }}>
                {activeResearchLabel.toUpperCase()}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
