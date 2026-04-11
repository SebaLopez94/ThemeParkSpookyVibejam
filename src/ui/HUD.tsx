import { useEffect, useState } from 'react';
import { Coins, HeartPulse, Landmark, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { EconomyState } from '../types';

interface HUDProps {
  economy: EconomyState;
}

export function HUD({ economy }: HUDProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const rows = [
    { label: 'Gold', value: `$${economy.money.toLocaleString()}`, color: 'var(--px-gold)', icon: Coins },
    { label: 'Guests', value: `${economy.activeVisitors}`, color: 'var(--px-green-hi)', icon: Users },
    { label: 'Joy', value: `${economy.averageHappiness}/100`, color: 'var(--px-green-hi)', icon: HeartPulse },
    { label: 'Park Rating', value: `${economy.parkRating}/100`, color: 'var(--px-cyan)', icon: Landmark },
    { label: 'Income', value: `$${economy.dailyIncome.toLocaleString()}`, color: 'var(--px-gold)', icon: TrendingUp },
    { label: 'Expenses', value: `$${economy.dailyExpenses.toLocaleString()}`, color: 'var(--px-red)', icon: TrendingDown }
  ];

  return (
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 40 }}>
      <div className="px-panel px-panel--hud" style={{ padding: 0, minWidth: 360 }}>
        <div className="px-titlebar px-titlebar--hud">
          <span className="px-titlebar__label">
            <Landmark size={16} />
            PARK COMMAND
          </span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>LIVE</span>
        </div>

        <div style={{ padding: '14px 18px 18px' }}>
          <div className="px-stat-grid">
            {rows.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="px-stat">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} color={color} />
                  <div className="px-label">{label}</div>
                </div>
                <div className="px-stat__value" style={{ fontSize: 18, color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }} className="px-stat">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color={economy.netProfit >= 0 ? 'var(--px-green-hi)' : 'var(--px-red)'} />
                <div className="px-label">Net Balance</div>
              </div>
              <div className="px-stat__value" style={{ fontSize: 18, color: economy.netProfit >= 0 ? 'var(--px-green-hi)' : 'var(--px-red)', marginTop: 0 }}>
                ${economy.netProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
