import { CSSProperties } from 'react';
import { CheckCircle2, Coins, Crown, Gem, Skull, Sparkles, TimerReset, Trophy, X } from 'lucide-react';
import { ChallengeTier, ChallengeState } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface ChallengesPanelProps {
  challenges: ChallengeState[];
  style?: CSSProperties;
  onClose?: () => void;
}

const TIER_META: Record<ChallengeTier, { roman: string; title: string }> = {
  1: { roman: 'I', title: 'Open the Gates' },
  2: { roman: 'II', title: 'Build a Real Park' },
  3: { roman: 'III', title: 'Grow the Business' },
  4: { roman: 'IV', title: 'Run at Scale' },
  5: { roman: 'V', title: 'Master the Park' },
};

function getChallengeLabel(challenge: ChallengeState): string {
  switch (challenge.type) {
    case 'visitor_count':   return 'Visitors';
    case 'active_visitors': return 'Crowd';
    case 'build_count':     return 'Build';
    case 'decoration_count':return 'Decor';
    case 'service_count':   return 'Service';
    case 'happiness_streak':return 'Joy';
    case 'profit_streak':   return 'Profit';
    case 'ride_count':      return 'Rides';
    case 'shop_count':      return 'Shops';
    case 'rating_threshold':return 'Rating';
    default:                return 'Goal';
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

function getChallengePercent(challenge: ChallengeState): number {
  const goal = challenge.duration ?? challenge.target;
  return goal > 0 ? Math.min(100, (Math.min(goal, challenge.progress) / goal) * 100) : 0;
}

function getStatus(challenge: ChallengeState): 'claimed' | 'ready' | 'active' {
  if (challenge.claimed) return 'claimed';
  if (challenge.completed) return 'ready';
  return 'active';
}

export function ChallengesPanel({ challenges, style, onClose }: ChallengesPanelProps) {
  const isMobile = useIsMobile();
  const claimed = challenges.filter(challenge => challenge.claimed);
  const ready = challenges.filter(challenge => challenge.completed && !challenge.claimed);
  const totalRewardMoney = challenges.reduce((sum, challenge) => sum + challenge.reward.money, 0);
  const completionPercent = challenges.length > 0 ? (claimed.length / challenges.length) * 100 : 0;

  const tiers = ([1, 2, 3, 4, 5] as ChallengeTier[]).map(tier => {
    const tierChallenges = challenges
      .filter(challenge => challenge.tier === tier)
      .sort((a, b) => {
        const statusRank = { ready: 0, active: 1, claimed: 2 };
        return statusRank[getStatus(a)] - statusRank[getStatus(b)];
      });
    const tierClaimed = tierChallenges.filter(challenge => challenge.claimed).length;
    const tierReady = tierChallenges.filter(challenge => challenge.completed && !challenge.claimed).length;

    return {
      tier,
      ...TIER_META[tier],
      challenges: tierChallenges,
      claimed: tierClaimed,
      ready: tierReady,
      total: tierChallenges.length,
    };
  });

  return (
    <div
      className="px-panel px-panel--challenges px-overlay-panel px-challenge-board"
      style={{ width: '100%', maxHeight: isMobile ? '64vh' : '58vh', padding: 0, ...style }}
    >
      <div className="px-challenge-board__header">
        <div className="px-challenge-board__mark">
          <Skull />
        </div>
        <div className="px-challenge-board__intro">
          <span className="px-challenge-board__eyebrow">Nightmare Contracts</span>
          <strong>Park Milestones</strong>
          <span>Clear tiers to grow from cursed fairground to full horror empire.</span>
        </div>
        {onClose && (
          <button className="px-btn px-btn--sm px-challenge-board__close" aria-label="Close challenges panel" onClick={onClose}>
            <X />
          </button>
        )}
      </div>

      <div className="px-challenge-summary">
        <div className="px-challenge-summary__main">
          <span>{claimed.length}/{challenges.length} cleared</span>
          <div className="px-challenge-summary__bar" aria-hidden="true">
            <span style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
        <div className="px-challenge-summary__stat">
          <Sparkles />
          {ready.length} ready
        </div>
        <div className="px-challenge-summary__stat">
          <Coins />
          ${totalRewardMoney}
        </div>
      </div>

      <div className="px-challenge-board__body px-scroll-hidden">
        {tiers.map(group => {
          const tierPercent = group.total > 0 ? (group.claimed / group.total) * 100 : 0;
          const tierState = group.ready > 0 ? 'ready' : group.claimed === group.total ? 'claimed' : 'active';

          return (
            <section key={group.tier} className={`px-challenge-tier px-challenge-tier--${tierState}`}>
              <div className="px-challenge-tier__rail">
                <span>{group.roman}</span>
              </div>

              <div className="px-challenge-tier__content">
                <div className="px-challenge-tier__head">
                  <div>
                    <span className="px-challenge-tier__label">Tier {group.tier}</span>
                    <h3>{group.title}</h3>
                  </div>
                  <div className="px-challenge-tier__progress">
                    <strong>{group.claimed}/{group.total}</strong>
                    <span style={{ width: `${tierPercent}%` }} />
                  </div>
                </div>

                <div className="px-challenge-list">
                  {group.challenges.map(challenge => {
                    const status = getStatus(challenge);
                    const percent = getChallengePercent(challenge);

                    return (
                      <article key={challenge.id} className={`px-challenge-card px-challenge-card--${status}`}>
                        <div className="px-challenge-card__status">
                          {status === 'claimed' ? <CheckCircle2 /> : status === 'ready' ? <Gem /> : <Trophy />}
                          <span>{status === 'claimed' ? 'Claimed' : status === 'ready' ? 'Ready' : getChallengeLabel(challenge)}</span>
                        </div>

                        <div className="px-challenge-card__copy">
                          <h4>{challenge.title}</h4>
                          <p>{challenge.description}</p>
                        </div>

                        <div className="px-challenge-card__reward">
                          <span><Coins /> +${challenge.reward.money}</span>
                          {challenge.reward.rating > 0 && <span><Crown /> +{challenge.reward.rating}</span>}
                        </div>

                        <div className="px-challenge-card__footer">
                          <span>{getProgressText(challenge)}</span>
                          {challenge.duration && <span><TimerReset /> Streak</span>}
                          {status === 'active' && percent >= 75 && <span><Sparkles /> Close</span>}
                        </div>

                        <div className="px-challenge-card__bar" aria-hidden="true">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
