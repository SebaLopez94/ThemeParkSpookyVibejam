import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Coins, HeartPulse, Landmark, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { EconomyState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

function Stars({ count }: { count: number }) {
  return (
    <span style={{ fontSize: 18, letterSpacing: 2, color: 'var(--px-gold)', textShadow: '0 0 6px rgba(251,191,36,0.5)' }}>
      {'★'.repeat(count)}{'☆'.repeat(5 - count)}
    </span>
  );
}

interface HUDProps {
  economy: EconomyState;
}

export function HUD({ economy }: HUDProps) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isMobile = useIsMobile();

  const [joyStars, setJoyStars] = useState(() => Math.round(economy.averageHappiness / 20));
  const [ratingStars, setRatingStars] = useState(() => Math.round(economy.parkRating / 20));
  const [moneyFlash, setMoneyFlash] = useState<'green' | 'red' | null>(null);
  useEffect(() => {
    const s = Math.round(economy.averageHappiness / 20);
    setJoyStars(prev => prev === s ? prev : s);
  }, [economy.averageHappiness]);
  useEffect(() => {
    const s = Math.round(economy.parkRating / 20);
    setRatingStars(prev => prev === s ? prev : s);
  }, [economy.parkRating]);

  const prevMoneyRef2 = useRef(economy.money);
  useEffect(() => {
    const diff = economy.money - prevMoneyRef2.current;
    if (diff > 0) { setMoneyFlash('green'); setTimeout(() => setMoneyFlash(null), 500); }
    else if (diff < 0) { setMoneyFlash('red'); setTimeout(() => setMoneyFlash(null), 500); }
    prevMoneyRef2.current = economy.money;
  }, [economy.money]);

  if (!mounted) return null;

  const netColor = economy.netProfit >= 0 ? 'var(--px-green-hi)' : 'var(--px-red)';
  const sz = isMobile ? 12 : 13;

  return (
    <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 40, maxWidth: 'calc(100vw - 32px)' }}>
      <div className="px-panel px-panel--hud" style={{ padding: 0, minWidth: isMobile ? 180 : 300 }}>

        {/* Titlebar */}
        <div className="px-titlebar px-titlebar--hud">
          <span className="px-titlebar__label" style={{ gap: 6 }}>
            <Landmark size={isMobile ? 13 : 15} />
            <span style={{ fontSize: isMobile ? 9 : 11 }}>PARK LIVE</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {collapsed && (
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: 'var(--px-gold)' }}>
                ${economy.money.toLocaleString()}
              </span>
            )}
            <button
              className="px-btn"
              style={{ padding: '2px 6px', minHeight: 0 }}
              onClick={() => setCollapsed(v => !v)}
            >
              {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div style={{ padding: isMobile ? '8px 10px 10px' : '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>

            {/* Money — full width highlight */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)', padding: isMobile ? '6px 8px' : '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Coins size={sz} color="var(--px-gold)" />
                <span className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>GOLD</span>
              </div>
              <span
                className={moneyFlash === 'green' ? 'px-flash-green' : moneyFlash === 'red' ? 'px-flash-red' : ''}
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 12 : 15, color: 'var(--px-gold)', textShadow: '0 0 8px rgba(251,191,36,0.4), 2px 2px 0 #000' }}
              >
                ${economy.money.toLocaleString()}
              </span>
            </div>

            {/* 2-col grid: Guests + Net */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <StatBox icon={<Users size={sz} color="var(--px-cyan)" />} label="GUESTS" value={`${economy.activeVisitors}`} color="var(--px-cyan)" mobile={isMobile} />
              <StatBox
                icon={<TrendingUp size={sz} color={netColor} />}
                label="NET"
                value={`${economy.netProfit >= 0 ? '+' : ''}$${economy.netProfit.toLocaleString()}`}
                color={netColor}
                mobile={isMobile}
              />
            </div>

            {/* Joy + Rating */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              <StarBox icon={<HeartPulse size={sz} color="var(--px-green-hi)" />} label="JOY" count={joyStars} mobile={isMobile} />
              <StarBox icon={<Landmark size={sz} color="var(--px-cyan)" />} label="RATING" count={ratingStars} mobile={isMobile} />
            </div>

            {/* Income / Expenses — only desktop */}
            {!isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <StatBox icon={<TrendingUp size={sz} color="var(--px-green-hi)" />} label="INCOME" value={`$${economy.dailyIncome.toLocaleString()}`} color="var(--px-green-hi)" mobile={false} />
                <StatBox icon={<TrendingDown size={sz} color="var(--px-red)" />} label="EXPENSES" value={`$${economy.dailyExpenses.toLocaleString()}`} color="var(--px-red)" mobile={false} />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, label, value, color, mobile }: { icon: React.ReactNode; label: string; value: string; color: string; mobile: boolean }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', padding: mobile ? '5px 7px' : '7px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span className="px-label" style={{ fontSize: mobile ? 7 : 8 }}>{label}</span>
      </div>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: mobile ? 10 : 12, color, textShadow: '1px 1px 0 #000' }}>{value}</span>
    </div>
  );
}

function StarBox({ icon, label, count, mobile }: { icon: React.ReactNode; label: string; count: number; mobile: boolean }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)', padding: mobile ? '5px 7px' : '7px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span className="px-label" style={{ fontSize: mobile ? 7 : 8 }}>{label}</span>
      </div>
      <Stars count={count} />
    </div>
  );
}
