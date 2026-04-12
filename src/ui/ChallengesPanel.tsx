import { CSSProperties } from 'react';
import { Coins, Crown, Sparkles, TimerReset, Trophy, X } from 'lucide-react';
import { ChallengeState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ChallengesPanelProps {
  challenges: ChallengeState[];
  style?: CSSProperties;
  onClose?: () => void;
}

function getChallengeLabel(challenge: ChallengeState): string {
  switch (challenge.type) {
    case 'visitor_count':
      return 'VISITORS';
    case 'build_count':
      return 'LAYOUT';
    case 'happiness_streak':
      return 'HAPPINESS';
    case 'profit_streak':
      return 'PROFIT';
    case 'ride_count':
      return 'RIDES';
    case 'shop_count':
      return 'SHOPS';
    case 'rating_threshold':
      return 'RATING';
    default:
      return 'GOAL';
  }
}

function getProgressText(challenge: ChallengeState): string {
  const goal = challenge.duration ?? challenge.target;
  const progress = Math.min(goal, challenge.progress);

  if (challenge.duration) {
    return `${Math.floor(progress)}s / ${goal}s`;
  }

  return `${Math.floor(progress)} / ${goal}`;
}

export function ChallengesPanel({ challenges, style, onClose }: ChallengesPanelProps) {
  const isMobile = useIsMobile();

  const active = challenges.filter(challenge => !challenge.claimed);
  const completed = challenges.filter(challenge => challenge.claimed);
  const finishedCount = completed.length;
  const totalCount = challenges.length;
  const totalRewardMoney = challenges.reduce((sum, challenge) => sum + challenge.reward.money, 0);

  return (
    <div className="px-scroll-hidden" style={{ width: '100%', maxHeight: '48vh', overflow: 'auto', ...style }}>
      <div className="px-panel px-panel--challenges" style={{ padding: 0 }}>
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
            <button className="px-btn px-btn--sm" aria-label="Close challenges panel" onClick={onClose}>
              <X />
            </button>
          </div>
        )}

        <div style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', gap: isMobile ? 10 : 12 }}>
          <div
            className="px-stat"
            style={{
              background: 'linear-gradient(180deg, rgba(49,13,21,0.96) 0%, rgba(20,7,10,0.96) 100%)',
              border: '2px solid rgba(251,191,36,0.16)',
              padding: isMobile ? '10px' : '12px 14px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                  COMPLETED
                </div>
                <div className="px-stat__value" style={{ fontSize: isMobile ? 12 : 14, color: 'var(--px-green-hi)' }}>
                  {finishedCount}/{totalCount}
                </div>
              </div>
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                  ACTIVE GOALS
                </div>
                <div className="px-stat__value" style={{ fontSize: isMobile ? 12 : 14, color: 'var(--px-orange)' }}>
                  {active.length}
                </div>
              </div>
              <div>
                <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                  TOTAL BONUS
                </div>
                <div className="px-stat__value" style={{ fontSize: isMobile ? 12 : 14, color: 'var(--px-gold)' }}>
                  ${totalRewardMoney}
                </div>
              </div>
            </div>
          </div>

          {active.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                ACTIVE OBJECTIVES
              </div>
              {active.map(challenge => {
                const goal = challenge.duration ?? challenge.target;
                const progress = Math.min(goal, challenge.progress);
                const percent = goal > 0 ? (progress / goal) * 100 : 0;
                const justCompleted = challenge.completed && !challenge.claimed;

                return (
                  <div
                    key={challenge.id}
                    className="px-card"
                    style={{
                      cursor: 'default',
                      padding: isMobile ? '10px' : '12px',
                      background: justCompleted
                        ? 'linear-gradient(180deg, rgba(190,242,100,0.12) 0%, rgba(26,49,19,0.96) 100%)'
                        : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(28,8,12,0.98) 100%)',
                      borderTopColor: justCompleted ? 'var(--px-green)' : undefined,
                      borderLeftColor: justCompleted ? 'var(--px-green)' : undefined
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px', color: justCompleted ? 'var(--px-green-hi)' : 'var(--px-orange)' }}>
                            {getChallengeLabel(challenge)}
                          </div>
                          {justCompleted && (
                            <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px', color: 'var(--px-green-hi)' }}>
                              <Sparkles className="px-icon-sm" />
                              READY
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: isMobile ? 9 : 11,
                            color: 'var(--px-text)',
                            lineHeight: 1.7
                          }}
                        >
                          {challenge.title}
                        </div>
                        <div className="px-body" style={{ marginTop: 6 }}>
                          {challenge.description}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 6, flexShrink: 0, justifyItems: 'end' }}>
                        <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px', color: 'var(--px-gold)' }}>
                          <Coins className="px-icon-sm" />
                          +${challenge.reward.money}
                        </div>
                        {challenge.reward.rating > 0 && (
                          <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px', color: 'var(--px-light)' }}>
                            <Crown className="px-icon-sm" />
                            +{challenge.reward.rating}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
                      <div className="px-body" style={{ color: justCompleted ? 'var(--px-green-hi)' : 'var(--px-muted)' }}>
                        {getProgressText(challenge)}
                      </div>
                      {challenge.duration && (
                        <div className="px-chip" style={{ padding: isMobile ? '5px 8px' : '6px 9px' }}>
                          <TimerReset className="px-icon-sm" />
                          STREAK
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        height: isMobile ? 10 : 12,
                        background: '#12060b',
                        border: '2px solid rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: `${percent}%`,
                          background: justCompleted
                            ? 'linear-gradient(90deg, #65a30d 0%, #d9f99d 100%)'
                            : 'linear-gradient(90deg, #fb7185 0%, #fbbf24 100%)',
                          boxShadow: justCompleted
                            ? '0 0 8px rgba(190,242,100,0.35)'
                            : '0 0 8px rgba(251,191,36,0.28)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {completed.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                COMPLETED
              </div>
              {completed.map(challenge => (
                <div
                  key={challenge.id}
                  className="px-card"
                  style={{
                    cursor: 'default',
                    padding: isMobile ? '10px' : '12px',
                    background: 'linear-gradient(180deg, rgba(190,242,100,0.1) 0%, rgba(20,33,15,0.96) 100%)',
                    borderTopColor: 'var(--px-green)',
                    borderLeftColor: 'var(--px-green)',
                    opacity: 0.9
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: isMobile ? 9 : 10,
                          color: 'var(--px-text)',
                          lineHeight: 1.7
                        }}
                      >
                        {challenge.title}
                      </div>
                      <div className="px-body" style={{ marginTop: 4 }}>
                        Reward claimed
                      </div>
                    </div>
                    <Trophy className="px-icon-md" color="var(--px-green-hi)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
