import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  HeartPulse,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { EconomyState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

function Stars({ count, mobile }: { count: number; mobile: boolean }) {
  const clampedCount = Math.max(0, Math.min(5, count));
  const star = '\u2605';

  return (
    <span
      style={{
        fontSize: mobile ? 18 : 22,
        letterSpacing: mobile ? 1.5 : 2.5,
        color: 'var(--px-gold)',
        textShadow: '2px 2px 0 #000',
      }}
    >
      {star.repeat(clampedCount)}
      <span style={{ color: 'rgba(251,191,36,0.22)' }}>{star.repeat(5 - clampedCount)}</span>
    </span>
  );
}

const JOY_FACES: Array<{ emoji: string; label: string; color: string }> = [
  { emoji: '😡', label: 'FURIOUS',  color: '#ef4444' },
  { emoji: '😢', label: 'SAD',      color: '#93c5fd' },
  { emoji: '😐', label: 'NEUTRAL',  color: '#94a3b8' },
  { emoji: '🙂', label: 'HAPPY',    color: '#86efac' },
  { emoji: '😄', label: 'GREAT',    color: '#4ade80' },
  { emoji: '🤩', label: 'AMAZING',  color: '#fbbf24' },
];

function JoyFace({ stars, mobile }: { stars: number; mobile: boolean }) {
  const idx = Math.max(0, Math.min(5, stars));
  const { emoji, label, color } = JOY_FACES[idx];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: mobile ? 4 : 6 }}>
      <span style={{ fontSize: mobile ? 22 : 26, lineHeight: 1, filter: 'drop-shadow(1px 1px 0 #000)' }}>
        {emoji}
      </span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: mobile ? 8 : 9, color, textShadow: '1px 1px 0 #000' }}>
        {label}
      </span>
    </span>
  );
}

interface HUDProps {
  economy: EconomyState;
}

export function HUD({ economy }: HUDProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(() => isMobile);
  const [joyStars, setJoyStars] = useState(() => Math.round(economy.averageHappiness / 20));
  const [ratingStars, setRatingStars] = useState(() => Math.round(economy.parkRating / 20));
  const [moneyFlash, setMoneyFlash] = useState<'green' | 'red' | null>(null);
  const prevMoneyRef = useRef(economy.money);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setJoyStars(prev => {
      const next = Math.round(economy.averageHappiness / 20);
      return prev === next ? prev : next;
    });
  }, [economy.averageHappiness]);

  useEffect(() => {
    setRatingStars(prev => {
      const next = Math.round(economy.parkRating / 20);
      return prev === next ? prev : next;
    });
  }, [economy.parkRating]);

  useEffect(() => {
    const diff = economy.money - prevMoneyRef.current;
    if (diff > 0) {
      setMoneyFlash('green');
      setTimeout(() => setMoneyFlash(null), 500);
    } else if (diff < 0) {
      setMoneyFlash('red');
      setTimeout(() => setMoneyFlash(null), 500);
    }
    prevMoneyRef.current = economy.money;
  }, [economy.money]);

  if (!mounted) return null;

  const netPositive = economy.netProfit >= 0;
  const netIcon = netPositive ? <TrendingUp className="px-icon-sm" color="var(--px-green-hi)" /> : <TrendingDown className="px-icon-sm" color="var(--px-red)" />;
  const netValue = `${netPositive ? '+' : '-'}$${Math.abs(economy.netProfit).toLocaleString()}`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 40,
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div className="px-panel px-panel--hud px-hud-panel" style={{ padding: 0 }}>
        <div className="px-titlebar px-titlebar--hud px-hud-bar">
          <div className="px-titlebar__label px-hud-bar__label">
            <Landmark className="px-icon-sm" />
            <span className="px-hud-bar__title">Park Live</span>
          </div>

          <div className="px-hud-bar__actions">
            {collapsed && (
              <span className="px-hud-inline-money">
                <Coins className="px-icon-sm" color="var(--px-gold)" />
                ${economy.money.toLocaleString()}
              </span>
            )}
            <button
              className="px-btn px-btn--sm"
              aria-label={collapsed ? 'Expand HUD' : 'Collapse HUD'}
              onClick={() => setCollapsed(value => !value)}
            >
              {collapsed ? <ChevronDown /> : <ChevronUp />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="px-panel-body px-panel-body--sm px-hud-body px-hud-body--compact">
            <div className="px-hud-money-row">
              <div className="px-hud-money-row__main">
                <span className="px-label">Money</span>
                <span
                  className={
                    moneyFlash === 'green'
                      ? 'px-hud-money-row__amount px-flash-green'
                      : moneyFlash === 'red'
                        ? 'px-hud-money-row__amount px-flash-red'
                        : 'px-hud-money-row__amount'
                  }
                >
                  ${economy.money.toLocaleString()}
                </span>
              </div>
              <div className="px-hud-money-row__icon">
                <Coins className="px-icon-md" color="var(--px-gold)" />
              </div>
            </div>

            <div className="px-hud-inline-stats">
              <InlineStat
                icon={<Users className="px-icon-sm" color="var(--px-cyan)" />}
                label="Guests"
                value={economy.activeVisitors.toLocaleString()}
              />
              <InlineStat icon={netIcon} label="Balance" value={netValue} />
              <InlineStat
                icon={<TrendingUp className="px-icon-sm" color="var(--px-green-hi)" />}
                label="Income"
                value={`$${economy.dailyIncome.toLocaleString()}`}
              />
              <InlineStat
                icon={<TrendingDown className="px-icon-sm" color="var(--px-red)" />}
                label="Expenses"
                value={`$${economy.dailyExpenses.toLocaleString()}`}
              />
            </div>

            <div className="px-hud-ratings">
              <InlineRating
                icon={<HeartPulse className="px-icon-sm" color="var(--px-green-hi)" />}
                label="Guest Joy"
                stars={joyStars}
                mobile={isMobile}
                type="face"
              />
              <InlineRating
                icon={<Landmark className="px-icon-sm" color="var(--px-cyan)" />}
                label="Park Rating"
                stars={ratingStars}
                mobile={isMobile}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="px-hud-inline-stat">
      <div className="px-hud-inline-stat__label">
        {icon}
        <span className="px-label">{label}</span>
      </div>
      <span className="px-hud-inline-stat__value">{value}</span>
    </div>
  );
}

function InlineRating({
  icon,
  label,
  stars,
  mobile,
  type = 'stars',
}: {
  icon: React.ReactNode;
  label: string;
  stars: number;
  mobile: boolean;
  type?: 'stars' | 'face';
}) {
  return (
    <div className="px-hud-rating">
      <div className="px-hud-rating__label">
        {icon}
        <span className="px-label">{label}</span>
      </div>
      {type === 'face' ? <JoyFace stars={stars} mobile={mobile} /> : <Stars count={stars} mobile={mobile} />}
    </div>
  );
}
