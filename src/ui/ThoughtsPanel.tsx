import { MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FeedMessage, VisitorMoodKind } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ThoughtsPanelProps {
  feed: FeedMessage[];
  onClose: () => void;
  style?: React.CSSProperties;
}

// ── Per-kind visual style ────────────────────────────────────────────────────
// Groups: red = problem, amber = physical need, green = positive, violet = system
interface KindStyle { border: string; bg: string }
const KIND_STYLES: Partial<Record<VisitorMoodKind | 'park_event', KindStyle>> = {
  sick:       { border: 'rgba(239,68,68,0.55)',   bg: 'rgba(239,68,68,0.14)'  },
  sad:        { border: 'rgba(239,68,68,0.44)',   bg: 'rgba(239,68,68,0.10)'  },
  price:      { border: 'rgba(239,68,68,0.44)',   bg: 'rgba(239,68,68,0.10)'  },
  hunger:     { border: 'rgba(251,146,60,0.55)',  bg: 'rgba(251,146,60,0.13)' },
  thirst:     { border: 'rgba(251,146,60,0.48)',  bg: 'rgba(251,146,60,0.11)' },
  bored:      { border: 'rgba(148,163,184,0.38)', bg: 'rgba(148,163,184,0.10)'},
  crowded:    { border: 'rgba(148,163,184,0.34)', bg: 'rgba(148,163,184,0.08)'},
  broke:      { border: 'rgba(148,163,184,0.34)', bg: 'rgba(148,163,184,0.08)'},
  happy:      { border: 'rgba(74,222,128,0.50)',  bg: 'rgba(74,222,128,0.12)' },
  excited:    { border: 'rgba(74,222,128,0.55)',  bg: 'rgba(74,222,128,0.14)' },
  shopping:   { border: 'rgba(74,222,128,0.44)',  bg: 'rgba(74,222,128,0.10)' },
  park_event: { border: 'rgba(167,139,250,0.55)', bg: 'rgba(167,139,250,0.13)'},
};
const DEFAULT_KIND_STYLE: KindStyle = {
  border: 'rgba(148,163,184,0.13)',
  bg: 'rgba(71,85,105,0.10)',
};
function kindStyle(kind: string): KindStyle {
  return KIND_STYLES[kind as VisitorMoodKind | 'park_event'] ?? DEFAULT_KIND_STYLE;
}


export function ThoughtsPanel({ feed, onClose, style }: ThoughtsPanelProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className="px-panel px-overlay-panel px-panel--thoughts"
      style={{ width: '100%', minHeight: isMobile ? undefined : 290, maxHeight: isMobile ? '56vh' : 'calc(100vh - 32px)', padding: 0, ...style }}
    >
      {/* Header */}
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <MessageSquare size={13} color="var(--px-muted)" />
          <span className="px-label" style={{ color: 'var(--px-muted)' }}>Guest Feed</span>
        </div>
        <button className="px-btn px-btn--sm" aria-label="Close panel" onClick={onClose} style={isMobile ? { padding: '4px 8px', minHeight: 32 } : undefined}>
          <X />
        </button>
      </div>

      {/* Feed list */}
      <div
        className="px-overlay-panel__body px-scroll-hidden"
        style={{
          padding: isMobile ? '10px 12px 14px' : '14px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 10,
          overflowY: 'auto',
        }}
      >
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 14, opacity: 0.35 }}>👻</span>
            <span style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              color: 'rgba(148,163,184,0.45)',
              lineHeight: 2,
            }}>
              No thoughts yet.<br />Wait for visitors.
            </span>
          </div>
        ) : (
          <motion.div layout className="px-thought-feed-list" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
          <AnimatePresence initial={false} mode="popLayout">
            {feed.map((msg, index) => {
              // Newest entry = full opacity; each step down dims slightly
              const ageOpacity = Math.max(0.35, 1 - index * 0.082);
              return (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, y: -18, scale: 0.98, filter: 'brightness(1.35)' }}
                  animate={{ opacity: ageOpacity, y: 0, scale: 1, filter: 'brightness(1)' }}
                  exit={{ opacity: 0, x: 18, scale: 0.97, filter: 'brightness(0.85)', transition: { duration: 0.18, ease: 'easeInOut' } }}
                  transition={{
                    layout: { type: 'spring', stiffness: 420, damping: 34, mass: 0.75 },
                    opacity: { duration: 0.2 },
                    y: { type: 'spring', stiffness: 460, damping: 28, mass: 0.7 },
                    scale: { duration: 0.2 },
                    filter: { duration: 0.28 },
                  }}
                >
                  <ThoughtCard msg={msg} isMobile={isMobile} fresh={index === 0} />
                </motion.div>
              );
            })}
          </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Individual card ──────────────────────────────────────────────────────────
function ThoughtCard({ msg, isMobile, fresh }: { msg: FeedMessage; isMobile: boolean; fresh: boolean }) {
  const { border, bg } = kindStyle(msg.kind);
  const isParkEvent = msg.kind === 'park_event';

  return (
    <div className={fresh ? 'px-thought-card px-thought-card--fresh' : 'px-thought-card'} style={{
      display: 'flex',
      gap: 10,
      padding: isMobile ? '9px 10px' : '10px 12px',
      background: `linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 55%), ${bg}`,
      border: `1px solid ${border}`,
      borderRadius: 8,
      alignItems: 'center',
    }}>

      {/* Left: visitor face OR park-event icon */}
      {isParkEvent ? (
        <span style={{
          flexShrink: 0,
          fontSize: isMobile ? 24 : 28,
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))',
        }}>
          {msg.emoji}
        </span>
      ) : (
        <div style={{ flexShrink: 0 }}>
          {msg.faceImage ? (
            <img
              src={msg.faceImage}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{
                width: isMobile ? 34 : 38,
                height: isMobile ? 34 : 38,
                objectFit: 'contain',
                filter: 'drop-shadow(1px 1px 0 #000)',
                display: 'block',
              }}
            />
          ) : (
            <span style={{ fontSize: isMobile ? 22 : 26 }}>{msg.emoji}</span>
          )}
        </div>
      )}

      {/* Thought text */}
      <p className="px-body" style={{
        flex: 1,
        margin: 0,
        fontSize: isMobile ? 10 : 11,
        lineHeight: 1.55,
        color: isParkEvent ? 'rgba(221,214,254,0.92)' : 'rgba(226,232,240,0.85)',
        minWidth: 0,
      }}>
        {msg.text}
      </p>

      {/* Right side: count badge OR thought emoji */}
      {(msg.count ?? 1) > 1 ? (
        <span style={{
          flexShrink: 0,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: isMobile ? 7 : 8,
          color: 'rgba(255,255,255,0.55)',
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${border}`,
          borderRadius: 5,
          padding: '3px 5px',
          lineHeight: 1,
          alignSelf: 'center',
        }}>
          x{msg.count}
        </span>
      ) : !isParkEvent ? (
        <span style={{
          flexShrink: 0,
          fontSize: isMobile ? 16 : 18,
          alignSelf: 'center',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
        }}>
          {msg.emoji}
        </span>
      ) : null}
    </div>
  );
}
