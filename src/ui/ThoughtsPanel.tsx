import { MessageSquare, X } from 'lucide-react';
import { FeedMessage } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ThoughtsPanelProps {
  feed: FeedMessage[];
  onClose: () => void;
  style?: React.CSSProperties;
}

export function ThoughtsPanel({ feed, onClose, style }: ThoughtsPanelProps) {
  const isMobile = useIsMobile();

  return (
    <div
      className="px-panel px-overlay-panel px-panel--thoughts"
      style={{ width: '100%', maxHeight: isMobile ? '56vh' : 'calc(100vh - 32px)', padding: 0, ...style }}
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
          feed.map((msg, index) => {
            // Older entries fade out gradually — newest is full opacity, 8th is ~35%
            const ageOpacity = Math.max(0.35, 1 - index * 0.082);
            return (
              <ThoughtCard key={msg.id} msg={msg} opacity={ageOpacity} isMobile={isMobile} />
            );
          })
        )}
      </div>
    </div>
  );
}

function ThoughtCard({
  msg,
  opacity,
  isMobile,
}: {
  msg: FeedMessage;
  opacity: number;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: isMobile ? '9px 10px' : '10px 12px',
        background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 55%), rgba(71,85,105,0.1)',
        border: '1px solid rgba(148,163,184,0.13)',
        borderRadius: 8,
        alignItems: 'center',
        opacity,
      }}
    >
      {/* Visitor face */}
      <div style={{
        flexShrink: 0,
        width: isMobile ? 36 : 40,
        height: isMobile ? 36 : 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {msg.faceImage ? (
          <img
            src={msg.faceImage}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(1px 1px 0 #000)',
            }}
          />
        ) : (
          <span style={{ fontSize: isMobile ? 22 : 26 }}>{msg.emoji}</span>
        )}
      </div>

      {/* Thought text */}
      <p className="px-body" style={{
        flex: 1,
        margin: 0,
        fontSize: isMobile ? 10 : 11,
        lineHeight: 1.55,
        color: 'rgba(226,232,240,0.85)',
        minWidth: 0,
      }}>
        {msg.text}
      </p>

      {/* Thought emoji pill */}
      <span style={{
        flexShrink: 0,
        fontSize: isMobile ? 16 : 18,
        alignSelf: 'center',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
      }}>
        {msg.emoji}
      </span>
    </div>
  );
}
