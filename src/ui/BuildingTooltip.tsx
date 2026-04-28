import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SelectedBuildingInfo, BuildingType } from '../types';

const BAR_COLOR: Partial<Record<string, string>> = {
  FUN:     'rgba(167,139,250,0.85)',
  HUNGER:  'rgba(251,191,36,0.85)',
  THIRST:  'rgba(56,189,248,0.85)',
  HYGIENE: 'rgba(74,222,128,0.85)',
  APPEAL:  'rgba(251,146,60,0.85)',
};

interface BuildingTooltipProps {
  info: SelectedBuildingInfo | null;
  mouseX: number;
  mouseY: number;
}

const TYPE_COLOR: Record<BuildingType, string> = {
  [BuildingType.RIDE]:       'rgba(167,139,250,0.7)',
  [BuildingType.SHOP]:       'rgba(251,191,36,0.7)',
  [BuildingType.SERVICE]:    'rgba(74,222,128,0.7)',
  [BuildingType.DECORATION]: 'rgba(148,163,184,0.6)',
  [BuildingType.PATH]:       'rgba(148,163,184,0.4)',
  [BuildingType.DELETE]:     'rgba(239,68,68,0.6)',
};
const TYPE_BG: Record<BuildingType, string> = {
  [BuildingType.RIDE]:       'rgba(167,139,250,0.08)',
  [BuildingType.SHOP]:       'rgba(251,191,36,0.07)',
  [BuildingType.SERVICE]:    'rgba(74,222,128,0.07)',
  [BuildingType.DECORATION]: 'rgba(148,163,184,0.06)',
  [BuildingType.PATH]:       'rgba(148,163,184,0.04)',
  [BuildingType.DELETE]:     'rgba(239,68,68,0.07)',
};

const HOVER_DELAY_MS = 260;
const OFFSET_X = 16;
const OFFSET_Y = -8;
const TOOLTIP_W = 200;

export function BuildingTooltip({ info, mouseX, mouseY }: BuildingTooltipProps) {
  // Delay showing the tooltip so fast mouse passes don't trigger it
  const [visibleInfo, setVisibleInfo] = useState<SelectedBuildingInfo | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (info === null) {
      // Hide immediately when hover leaves
      setVisibleInfo(null);
    } else {
      timerRef.current = setTimeout(() => setVisibleInfo(info), HOVER_DELAY_MS);
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [info]);

  // Keep tooltip inside viewport horizontally
  const left = mouseX + OFFSET_X + TOOLTIP_W > window.innerWidth
    ? mouseX - TOOLTIP_W - OFFSET_X
    : mouseX + OFFSET_X;
  const top = mouseY + OFFSET_Y;

  return (
    <AnimatePresence>
      {visibleInfo && (
        <motion.div
          key={visibleInfo.id}
          initial={{ opacity: 0, scale: 0.95, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left,
            top,
            zIndex: 200,
            pointerEvents: 'none',
            width: TOOLTIP_W,
          }}
        >
          <div style={{
            background: `linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%), ${TYPE_BG[visibleInfo.buildingType]}`,
            border: `1px solid ${TYPE_COLOR[visibleInfo.buildingType]}`,
            borderRadius: 10,
            padding: '9px 11px',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: `0 0 12px ${TYPE_COLOR[visibleInfo.buildingType].replace('0.7', '0.18')}, 0 8px 24px rgba(0,0,0,0.5)`,
          }}>
            {/* Header — name + type tag */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 8,
                color: 'rgba(226,232,240,0.92)',
                lineHeight: 1.4,
                letterSpacing: 0.3,
                flex: 1,
              }}>
                {visibleInfo.name}
              </span>
              {visibleInfo.buildingType !== BuildingType.PATH && visibleInfo.buildingType !== BuildingType.DELETE && (
                <span style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  color: TYPE_COLOR[visibleInfo.buildingType].replace('0.7', '0.9'),
                  background: TYPE_COLOR[visibleInfo.buildingType].replace('0.7', '0.12'),
                  border: `1px solid ${TYPE_COLOR[visibleInfo.buildingType].replace('0.7', '0.25')}`,
                  borderRadius: 4,
                  padding: '2px 4px',
                  flexShrink: 0,
                  lineHeight: 1,
                  alignSelf: 'center',
                }}>
                  {visibleInfo.buildingType.toUpperCase()}
                </span>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: `linear-gradient(90deg, ${TYPE_COLOR[visibleInfo.buildingType].replace('0.7','0.35')}, transparent)`, marginBottom: 7 }} />

            {/* Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {/* Stat bars (effect) */}
              {visibleInfo.statBars?.map(bar => (
                <DotBar
                  key={bar.label}
                  label={bar.label}
                  filled={bar.filled}
                  color={BAR_COLOR[bar.label] ?? TYPE_COLOR[visibleInfo.buildingType].replace('0.7', '0.85')}
                />
              ))}
              {visibleInfo.maintenancePerMinute > 0 && (
                <Row label="Upkeep" value={`$${visibleInfo.maintenancePerMinute}/min`} color="rgba(251,113,133,0.85)" />
              )}
              {visibleInfo.currentPrice != null && visibleInfo.currentPrice > 0 && (
                <Row label="Price" value={`$${visibleInfo.currentPrice}`} color="rgba(251,191,36,0.85)" />
              )}
              {visibleInfo.activeRiders != null && visibleInfo.capacity != null && (
                <Row
                  label="Riding"
                  value={`${visibleInfo.activeRiders} / ${visibleInfo.capacity}`}
                  color={visibleInfo.activeRiders === 0 ? 'rgba(148,163,184,0.5)' : 'rgba(167,139,250,0.85)'}
                />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(148,163,184,0.55)', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color, textAlign: 'right', lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  );
}

function DotBar({ label, filled, color }: { label: string; filled: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: 'rgba(148,163,184,0.55)' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 13,
              height: 5,
              borderRadius: 2,
              background: i < filled ? color : 'rgba(148,163,184,0.15)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
