import { Banknote, Coins, Ticket, TrendingDown, TrendingUp, Users } from 'lucide-react';
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
  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '48vh', overflow: 'auto' }}>
      <div className="px-panel px-panel--hud" style={{ padding: 0 }}>
        <div style={{ padding: '16px 16px 18px', display: 'grid', gap: 12 }}>
          <div className="px-stat">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ticket size={16} color="var(--px-gold)" />
              <div className="px-label">Entry Price</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontFamily: "'Press Start 2P', monospace", color: 'var(--px-gold)', fontSize: 18 }}>$</span>
              <input
                className="px-input"
                type="number"
                min={0}
                max={50}
                value={localTicketPrice}
                onChange={event => onTicketPriceChange(Number(event.target.value))}
                onBlur={onTicketPriceCommit}
                onKeyDown={event => event.key === 'Enter' && onTicketPriceCommit()}
              />
            </div>
          </div>

          <div className="px-chip-row">
            <div className="px-chip">
              <Banknote size={16} />
              ${economy.money.toLocaleString()}
            </div>
            <div className="px-chip">
              <Users size={16} />
              {economy.activeVisitors}/{economy.totalVisitors}
            </div>
          </div>

          <div className="px-stat-grid">
            <div className="px-stat">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="var(--px-green-hi)" />
                <div className="px-label">Income</div>
              </div>
              <div className="px-stat__value" style={{ fontSize: 16, color: 'var(--px-gold)' }}>
                ${economy.dailyIncome.toLocaleString()}
              </div>
            </div>
            <div className="px-stat">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingDown size={16} color="var(--px-red)" />
                <div className="px-label">Expenses</div>
              </div>
              <div className="px-stat__value" style={{ fontSize: 16, color: 'var(--px-red)' }}>
                ${economy.dailyExpenses.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="px-stat">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={16} color="var(--px-cyan)" />
              <div className="px-label">Active Research</div>
            </div>
            <div className="px-stat__value" style={{ fontSize: 11, color: 'var(--px-text)', lineHeight: 1.9 }}>
              {activeResearchLabel.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
