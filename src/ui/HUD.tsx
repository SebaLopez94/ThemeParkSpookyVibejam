import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Laugh,
  Radio,
  Star,
  TrendingDown,
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

function happinessToFaceIndex(h: number): number {
  if (h < 20) return 0; // FURIOUS
  if (h < 38) return 1; // SAD
  if (h < 52) return 2; // NEUTRAL
  if (h < 66) return 3; // HAPPY
  if (h < 80) return 4; // GREAT
  return 5;             // AMAZING
}

const JOY_FACES: Array<{ image: string; label: string; color: string }> = [
  { image: 'FURIOUS', label: 'FURIOUS', color: '#ef4444' },
  { image: 'SAD', label: 'SAD', color: '#93c5fd' },
  { image: 'NEUTRAL', label: 'NEUTRAL', color: '#94a3b8' },
  { image: 'HAPPY', label: 'HAPPY', color: '#86efac' },
  { image: 'GREAT', label: 'GREAT', color: '#4ade80' },
  { image: 'AMAZING', label: 'AMAZING', color: '#fbbf24' },
];

function JoyFace({ stars, mobile }: { stars: number; mobile: boolean }) {
  const idx = Math.max(0, Math.min(5, stars));
  const { image, label, color } = JOY_FACES[idx];
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: mobile ? 4 : 6 }}>
      <img
        src={`/ui/${image}.webp`}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: mobile ? 28 : 32,
          height: mobile ? 28 : 32,
          objectFit: 'contain',
          imageRendering: 'auto',
          filter: `drop-shadow(1px 1px 0 #000) drop-shadow(0 0 7px ${color}66)`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: mobile ? 8 : 9, color, textShadow: '1px 1px 0 #000' }}>
        {label}
      </span>
    </span>
  );
}
interface HUDProps {
  economy: EconomyState;
  hideMoney?: boolean;
}

export function HUD({ economy, hideMoney }: HUDProps) {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(() => isMobile);
  const [joyStars, setJoyStars] = useState(() => happinessToFaceIndex(economy.averageHappiness));
  const [ratingStars, setRatingStars] = useState(() => Math.round(economy.parkRating / 20));
  const [moneyFlash, setMoneyFlash] = useState<'green' | 'red' | null>(null);
  const prevMoneyRef = useRef(economy.money);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setJoyStars(prev => {
      const next = happinessToFaceIndex(economy.averageHappiness);
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

  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
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
            <Radio className="px-icon-sm" />
            {!hideMoney && collapsed && (
              <span className="px-hud-inline-money">
                <Coins className="px-icon-sm" color="var(--px-gold)" />
                ${economy.money.toLocaleString()}
              </span>
            )}
          </div>

          <div className="px-hud-bar__actions">
            <span className={`px-hud-status ${economy.isOpen ? 'px-hud-status--open' : 'px-hud-status--closed'}`}>
              {economy.isOpen ? 'OPEN' : 'CLOSED'}
            </span>
            <button
              className="px-btn px-btn--sm"
              aria-label={collapsed ? 'Expand HUD' : 'Collapse HUD'}
              onClick={() => setCollapsed(value => !value)}
            >
              {collapsed ? <ChevronDown /> : <ChevronUp />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-panel-body px-panel-body--sm px-hud-body px-hud-body--compact">
                <div className="px-hud-money-row">
                  <div className="px-hud-money-row__main">
                    <span className="px-label">Cash Vault</span>
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
                    label="Inside"
                    value={economy.activeVisitors.toLocaleString()}
                  />
                  <InlineStat
                    icon={<TrendingDown className="px-icon-sm" color="var(--px-red)" />}
                    label="Burn / Min"
                    value={`$${economy.maintenancePerMinute.toLocaleString()}`}
                  />
                </div>

                <div className="px-hud-ratings">
                  <InlineRating
                    icon={<Laugh className="px-icon-sm" color="var(--px-green-hi)" />}
                    label="Guest Joy"
                    stars={joyStars}
                    mobile={isMobile}
                    type="face"
                  />
                  <InlineRating
                    icon={<Star className="px-icon-sm" color="var(--px-gold)" />}
                    label="Park Rating"
                    stars={ratingStars}
                    mobile={isMobile}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
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

