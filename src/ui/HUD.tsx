import { useEffect, useState, type ReactNode } from 'react';
import { Coins, HeartPulse, Landmark, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { EconomyState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

function Stars({ count }: { count: number }) {
  return (
    <span className="px-emoji" style={{ fontSize: 22, letterSpacing: 2 }}>
      {'★'.repeat(count)}{'☆'.repeat(5 - count)}
    </span>
  );
}

interface HUDProps {
  economy: EconomyState;
}

export function HUD({ economy }: HUDProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isMobile = useIsMobile();

  // Only update star counts when the actual star value changes (prevents constant re-renders)
  const [joyStars, setJoyStars] = useState(() => Math.round(economy.averageHappiness / 20));
  const [ratingStars, setRatingStars] = useState(() => Math.round(economy.parkRating / 20));
  useEffect(() => {
    const s = Math.round(economy.averageHappiness / 20);
    setJoyStars(prev => prev === s ? prev : s);
  }, [economy.averageHappiness]);
  useEffect(() => {
    const s = Math.round(economy.parkRating / 20);
    setRatingStars(prev => prev === s ? prev : s);
  }, [economy.parkRating]);

  if (!mounted) return null;

  const allRows: { label: string; value: ReactNode; color: string; icon: typeof Coins }[] = [
    { label: 'Gold', value: `$${economy.money.toLocaleString()}`, color: 'var(--px-gold)', icon: Coins },
    { label: 'Guests', value: `${economy.activeVisitors}`, color: 'var(--px-green-hi)', icon: Users },
    { label: 'Joy', value: <Stars count={joyStars} />, color: 'var(--px-green-hi)', icon: HeartPulse },
    { label: 'Rating', value: <Stars count={ratingStars} />, color: 'var(--px-cyan)', icon: Landmark },
    { label: 'Income', value: `$${economy.dailyIncome.toLocaleString()}`, color: 'var(--px-gold)', icon: TrendingUp },
    { label: 'Expenses', value: `$${economy.dailyExpenses.toLocaleString()}`, color: 'var(--px-red)', icon: TrendingDown }
  ];

  // On mobile: show only 4 key stats in a 2x2 grid, skip the net balance row
  const rows = isMobile ? allRows.slice(0, 4) : allRows;

  return (
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 40, maxWidth: 'calc(100vw - 32px)' }}>
      <div className="px-panel px-panel--hud" style={{ padding: 0, minWidth: isMobile ? 0 : 360 }}>
        <div className="px-titlebar px-titlebar--hud">
          <span className="px-titlebar__label">
            <Landmark size={isMobile ? 14 : 16} />
            {isMobile ? 'PARK' : 'PARK COMMAND'}
          </span>
          <span style={{ fontSize: 10, opacity: 0.8 }}>LIVE</span>
        </div>

        <div style={{ padding: isMobile ? '8px 10px 10px' : '14px 18px 18px' }}>
          <div className="px-stat-grid">
            {rows.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="px-stat">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={isMobile ? 12 : 14} color={color} />
                  <div className="px-label">{label}</div>
                </div>
                <div className="px-stat__value" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {!isMobile && (
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
          )}
        </div>
      </div>
    </div>
  );
}
