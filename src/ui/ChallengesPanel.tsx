import { CSSProperties } from 'react';
import { Goal, Star, X } from 'lucide-react';
import { ChallengeState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ChallengesPanelProps {
  challenges: ChallengeState[];
  style?: CSSProperties;
  onClose?: () => void;
}

export function ChallengesPanel({ challenges, style, onClose }: ChallengesPanelProps) {
  const isMobile = useIsMobile();
  
  // Active challenges float to the top; claimed ones sink to the bottom
  const sorted = [...challenges].sort((a, b) => {
    if (a.claimed === b.claimed) return 0;
    return a.claimed ? 1 : -1;
  });

  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '48vh', overflow: 'auto', ...style }}>
      <div className="px-panel px-panel--challenges" style={{ padding: 0 }}>
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
            <button className="px-btn px-btn--sm" aria-label="Close panel" onClick={onClose}>
              <X />
            </button>
          </div>
        )}
        <div style={{ padding: isMobile ? '8px 12px 14px' : '10px 16px 18px', display: 'grid', gap: isMobile ? 8 : 10 }}>
          {sorted.map(challenge => {
            const goal = challenge.duration ?? challenge.target;
            const progress = Math.min(goal, challenge.progress);
            const percent = goal > 0 ? (progress / goal) * 100 : 0;
            const completed = challenge.claimed;

            return (
              <div
                key={challenge.id}
                className="px-card"
                style={{
                  cursor: 'default',
                  padding: isMobile ? '10px 10px 12px' : '14px 14px 16px',
                  ...(completed
                    ? {
                        background: 'linear-gradient(180deg, rgba(190,242,100,0.12) 0%, rgba(255,255,255,0.02) 100%), #24311a',
                        borderTopColor: 'var(--px-green)',
                        borderLeftColor: 'var(--px-green)',
                        boxShadow: '0 0 0 1px rgba(190,242,100,0.18), 3px 3px 0 #000'
                      }
                    : {})
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Goal className="px-icon-md" color={completed ? 'var(--px-green-hi)' : 'var(--px-orange)'} />
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 10 : 13, color: 'var(--px-text)', lineHeight: isMobile ? 1.5 : 1.9 }}>
                      {challenge.title}
                    </div>
                  </div>
                  {completed && <Star className="px-icon-md" color="var(--px-green-hi)" />}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 8 : 11, color: 'var(--px-muted)', lineHeight: isMobile ? 1.6 : 2, marginTop: isMobile ? 6 : 10 }}>
                  {challenge.description}
                </div>
                <div className="px-progress" style={{ marginTop: isMobile ? 10 : 14, height: isMobile ? 12 : 18 }}>
                  <div className={`px-progress__fill ${challenge.claimed ? 'px-progress__fill--success' : ''}`} style={{ width: `${percent}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: isMobile ? 8 : 12, fontFamily: "'Press Start 2P', monospace", fontSize: isMobile ? 8 : 11 }}>
                  <span style={{ color: 'var(--px-muted)' }}>
                    {Math.floor(progress)}/{goal}
                  </span>
                  <span style={{ color: completed ? 'var(--px-green-hi)' : 'var(--px-gold)' }}>
                    {completed ? 'COMPLETE' : `+$${challenge.reward.money}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
