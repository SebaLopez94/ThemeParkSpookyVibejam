import { CSSProperties } from 'react';
import { Goal, Star, X } from 'lucide-react';
import { ChallengeState } from '../types';

interface ChallengesPanelProps {
  challenges: ChallengeState[];
  style?: CSSProperties;
  onClose?: () => void;
}

export function ChallengesPanel({ challenges, style, onClose }: ChallengesPanelProps) {
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
            <button className="px-btn" style={{ padding: '4px 8px', minHeight: 0 }} onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        )}
        <div style={{ padding: '10px 16px 18px', display: 'grid', gap: 10 }}>
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
                  padding: '14px 14px 16px',
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
                    <Goal size={18} color={completed ? 'var(--px-green-hi)' : 'var(--px-orange)'} />
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 13, color: 'var(--px-text)', lineHeight: 1.9 }}>
                      {challenge.title}
                    </div>
                  </div>
                  {completed && <Star size={18} color="var(--px-green-hi)" />}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: 'var(--px-muted)', lineHeight: 2, marginTop: 10 }}>
                  {challenge.description}
                </div>
                <div className="px-progress" style={{ marginTop: 14, height: 18 }}>
                  <div className={`px-progress__fill ${challenge.claimed ? 'px-progress__fill--success' : ''}`} style={{ width: `${percent}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: "'Press Start 2P', monospace", fontSize: 11 }}>
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
