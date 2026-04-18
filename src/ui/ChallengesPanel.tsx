import { CSSProperties } from 'react';
import { Coins, Crown, Sparkles, TimerReset, Trophy, X } from 'lucide-react';
import { ChallengeTier, ChallengeState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ChallengesPanelProps {
  challenges: ChallengeState[];
  style?: CSSProperties;
  onClose?: () => void;
}

const TIER_LABELS: Record<ChallengeTier, string> = {
  1: 'I · The Gates Open',
  2: 'II · The Haunting Begins',
  3: 'III · A Real Nightmare',
  4: 'IV · Empire of Fear',
  5: 'V · Legend of the Damned',
};

function getChallengeLabel(challenge: ChallengeState): string {
  switch (challenge.type) {
    case 'visitor_count':   return 'VISITORS';
    case 'active_visitors': return 'CROWD';
    case 'build_count':     return 'LAYOUT';
    case 'decoration_count':return 'DECOR';
    case 'service_count':   return 'SERVICE';
    case 'happiness_streak':return 'HAPPINESS';
    case 'profit_streak':   return 'PROFIT';
    case 'ride_count':      return 'RIDES';
    case 'shop_count':      return 'SHOPS';
    case 'rating_threshold':return 'RATING';
    default:                return 'GOAL';
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

  // Group active challenges by tier for a clearer progression arc
  const activeTiers = ([1, 2, 3, 4, 5] as ChallengeTier[]).map(tier => ({
    tier,
    label: TIER_LABELS[tier],
    challenges: active.filter(c => c.tier === tier)
  })).filter(group => group.challenges.length > 0);

  return (
    <div className="px-panel px-panel--challenges px-overlay-panel" style={{ width: '100%', maxHeight: isMobile ? '56vh' : '48vh', padding: 0, ...style }}>
      <div className="px-overlay-panel__top">
        <div className="px-overlay-panel__meta">
          <span className="px-label" style={{ color: 'var(--px-orange)' }}>Goals</span>
          <span className="px-overlay-panel__count">{finishedCount}/{totalCount}</span>
        </div>
        {onClose && (
          <button className="px-btn px-btn--sm" aria-label="Close challenges panel" onClick={onClose} style={isMobile ? { padding: '4px 8px', minHeight: 32 } : undefined}>
            <X />
          </button>
        )}
      </div>

      <div className="px-overlay-panel__body px-scroll-hidden" style={{ padding: isMobile ? '10px 12px 14px' : '14px 16px 18px', display: 'grid', gap: isMobile ? 10 : 12 }}>
          <div
            className="px-stat px-soft-block"
            style={{
              background: 'linear-gradient(180deg, rgba(49,13,21,0.96) 0%, rgba(20,7,10,0.96) 100%)',
              padding: isMobile ? '10px' : '12px 14px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
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

          {activeTiers.map(group => (
            <div key={group.tier} className="px-soft-section">
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9, color: group.challenges.some(c => c.completed && !c.claimed) ? 'var(--px-green-hi)' : 'var(--px-orange)' }}>
                TIER {group.label}
              </div>
              {group.challenges.map(challenge => {
                const goal = challenge.duration ?? challenge.target;
                const progress = Math.min(goal, challenge.progress);
                const percent = goal > 0 ? (progress / goal) * 100 : 0;
                const justCompleted = challenge.completed && !challenge.claimed;

                return (
                  <div
                    key={challenge.id}
                    className={`px-soft-card ${justCompleted ? 'px-soft-card--success' : ''}`}
                    style={{
                      cursor: 'default',
                      padding: isMobile ? '10px' : '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                          <div className="px-soft-chip" style={{ color: justCompleted ? 'var(--px-green-hi)' : 'var(--px-orange)' }}>
                            {getChallengeLabel(challenge)}
                          </div>
                          {justCompleted && (
                            <div className="px-soft-chip" style={{ color: 'var(--px-green-hi)' }}>
                              <Sparkles className="px-icon-sm" />
                              READY
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Press Start 2P', monospace",
                            fontSize: isMobile ? 8 : 11,
                            color: 'var(--px-text)',
                            lineHeight: isMobile ? 1.55 : 1.7
                          }}
                        >
                          {challenge.title}
                        </div>
                        <div className="px-body" style={{ marginTop: 5, fontSize: isMobile ? 11 : undefined, lineHeight: isMobile ? 1.45 : undefined }}>
                          {challenge.description}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gap: 6, flexShrink: 0, justifyItems: 'end' }}>
                        <div className="px-soft-chip" style={{ color: 'var(--px-gold)' }}>
                          <Coins className="px-icon-sm" />
                          +${challenge.reward.money}
                        </div>
                        {challenge.reward.rating > 0 && (
                          <div className="px-soft-chip" style={{ color: 'var(--px-light)' }}>
                            <Crown className="px-icon-sm" />
                            +{challenge.reward.rating}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: isMobile ? 10 : 12 }}>
                      <div className="px-body" style={{ color: justCompleted ? 'var(--px-green-hi)' : 'var(--px-muted)', fontSize: isMobile ? 11 : undefined }}>
                        {getProgressText(challenge)}
                      </div>
                      {challenge.duration && (
                        <div className="px-soft-chip">
                          <TimerReset className="px-icon-sm" />
                          STREAK
                        </div>
                      )}
                    </div>

                    <div className="px-soft-progress">
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
          ))}

          {completed.length > 0 && (
            <div className="px-soft-section">
              <div className="px-label" style={{ fontSize: isMobile ? 8 : 9 }}>
                COMPLETED
              </div>
              {completed.map(challenge => (
                <div
                  key={challenge.id}
                  className="px-soft-card px-soft-card--success"
                  style={{
                    cursor: 'default',
                    padding: isMobile ? '10px' : '12px',
                    opacity: 0.9
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Press Start 2P', monospace",
                          fontSize: isMobile ? 8 : 10,
                          color: 'var(--px-text)',
                          lineHeight: isMobile ? 1.55 : 1.7
                        }}
                      >
                        {challenge.title}
                      </div>
                      <div className="px-body" style={{ marginTop: 3, fontSize: isMobile ? 11 : undefined }}>
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
  );
}
