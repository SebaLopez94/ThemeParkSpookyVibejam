import { Banknote, FlaskConical, Ticket, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { EconomyState } from '../types';

interface ParkPanelProps {
  economy: EconomyState;
  localTicketPrice: number;
  onTicketPriceChange: (value: number) => void;
  onTicketPriceCommit: () => void;
  activeResearchLabel: string;
}

export function ParkPanel({
  economy,
  localTicketPrice,
  onTicketPriceChange,
  onTicketPriceCommit,
  activeResearchLabel
}: ParkPanelProps) {
  const profit = economy.netProfit;
  const profitColor = profit >= 0 ? 'var(--px-green-hi)' : 'var(--px-red)';

  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '52vh', overflow: 'auto' }}>
      <div className="px-panel px-panel--park" style={{ padding: 0 }}>

        <div className="px-titlebar px-titlebar--park">
          <span className="px-titlebar__label">
            <Banknote size={18} />
            PARK OVERVIEW
          </span>
        </div>

        <div style={{ padding: '12px 14px 14px', display: 'grid', gap: 8 }}>

          {/* ── Entry ticket ───────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 120, flexShrink: 0 }}>
              <Ticket size={13} color="var(--px-gold)" />
              <span className="px-label" style={{ fontSize: 10 }}>ENTRY</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: 'var(--px-gold)' }}>$</span>
              <input
                className="px-input"
                type="number"
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

          {/* ── Visitor count ──────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} color="var(--px-cyan)" />
              <span className="px-label" style={{ fontSize: 10 }}>VISITORS</span>
            </div>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: 'var(--px-cyan)', textShadow: '1px 1px 0 #000' }}>
              {economy.activeVisitors}
            </span>
          </div>

          {/* ── Income ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} color="var(--px-green-hi)" />
              <span className="px-label" style={{ fontSize: 10 }}>INCOME</span>
            </div>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: 'var(--px-gold)', textShadow: '1px 1px 0 #000' }}>
              +${economy.dailyIncome.toLocaleString()}
            </span>
          </div>

          {/* ── Expenses ───────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingDown size={13} color="var(--px-red)" />
              <span className="px-label" style={{ fontSize: 10 }}>EXPENSES</span>
            </div>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: 'var(--px-red)', textShadow: '1px 1px 0 #000' }}>
              -${economy.dailyExpenses.toLocaleString()}
            </span>
          </div>

          {/* ── Net profit ─────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.3)',
            border: `2px solid ${profit >= 0 ? 'rgba(190,242,100,0.22)' : 'rgba(251,113,133,0.22)'}`,
          }}>
            <span className="px-label" style={{ fontSize: 10, color: profitColor }}>NET PROFIT</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: profitColor, textShadow: '1px 1px 0 #000' }}>
              {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
            </span>
          </div>

          <hr className="px-divider" />

          {/* ── Active research ────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical size={13} color="var(--px-border)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="px-label" style={{ fontSize: 9, marginBottom: 4 }}>RESEARCH</div>
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
