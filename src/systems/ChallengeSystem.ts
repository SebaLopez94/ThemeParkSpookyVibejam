import { INITIAL_CHALLENGES } from '../data/progression';
import { ChallengeState, SimulationSnapshot } from '../types';

export class ChallengeSystem {
  private challenges: ChallengeState[] = this.createInitialChallenges();
  private streaks: Map<string, number> = new Map();
  private listeners: Set<(state: ChallengeState[]) => void> = new Set();

  /**
   * Cached deep-clone of all challenges — rebuilt only when internal state mutates.
   * Prevents 30+ object allocations per second when notify() fires every update tick.
   */
  private cachedState: ChallengeState[] | null = null;

  /** Pre-allocated buffer for newly-completed challenges returned from update(). */
  private readonly completedBuffer: ChallengeState[] = [];

  private invalidateSnapshot(): void { this.cachedState = null; }

  private createInitialChallenges(): ChallengeState[] {
    return INITIAL_CHALLENGES.map(challenge => ({
      ...challenge,
      progress: 0,
      completed: false,
      claimed: false
    }));
  }

  public getState(): ChallengeState[] {
    if (!this.cachedState) {
      this.cachedState = this.challenges.map(c => ({ ...c, reward: { ...c.reward } }));
    }
    return this.cachedState;
  }

  public restoreSaveData(state: ChallengeState[]): void {
    this.challenges = state.map(challenge => ({ ...challenge, reward: { ...challenge.reward } }));
    this.streaks.clear();
    this.invalidateSnapshot();
    this.notify();
  }

  public reset(): void {
    this.challenges = this.createInitialChallenges();
    this.streaks.clear();
    this.invalidateSnapshot();
    this.notify();
  }

  public update(deltaTime: number, snapshot: SimulationSnapshot): ChallengeState[] {
    // Reuse the pre-allocated buffer — avoids one array allocation per update tick.
    this.completedBuffer.length = 0;
    // Challenges will be mutated below; invalidate the snapshot cache up front.
    this.invalidateSnapshot();

    this.challenges.forEach(challenge => {
      if (challenge.claimed) return;

      switch (challenge.type) {
        case 'visitor_count':
          challenge.progress = Math.min(snapshot.totalVisitors, challenge.target);
          break;
        case 'active_visitors':
          challenge.progress = Math.min(snapshot.activeVisitors, challenge.target);
          break;
        case 'build_count':
          challenge.progress = Math.min(snapshot.serviceAndDecorationCount, challenge.target);
          break;
        case 'decoration_count':
          challenge.progress = Math.min(snapshot.decorationCount, challenge.target);
          break;
        case 'service_count':
          challenge.progress = Math.min(snapshot.serviceCount, challenge.target);
          break;
        case 'happiness_streak': {
          const current = snapshot.averageHappiness >= challenge.target
            ? (this.streaks.get(challenge.id) ?? 0) + deltaTime
            : 0;
          this.streaks.set(challenge.id, current);
          challenge.progress = Math.min(current, challenge.duration ?? 0);
          break;
        }
        case 'profit_streak': {
          const current = snapshot.netProfit > 0
            ? (this.streaks.get(challenge.id) ?? 0) + deltaTime
            : 0;
          this.streaks.set(challenge.id, current);
          challenge.progress = Math.min(current, challenge.duration ?? 0);
          break;
        }
        case 'ride_count':
          challenge.progress = Math.min(snapshot.rideCount, challenge.target);
          break;
        case 'shop_count':
          challenge.progress = Math.min(snapshot.shopCount, challenge.target);
          break;
        case 'rating_threshold':
          challenge.progress = Math.min(snapshot.parkRating, challenge.target);
          break;
      }

      const targetValue = challenge.duration ?? challenge.target;
      if (!challenge.completed && challenge.progress >= targetValue) {
        challenge.completed = true;
        this.completedBuffer.push({ ...challenge, reward: { ...challenge.reward } });
      }
    });

    this.notify();
    return this.completedBuffer;
  }

  public claimReward(id: string): ChallengeState | null {
    const challenge = this.challenges.find(item => item.id === id);
    if (!challenge || !challenge.completed || challenge.claimed) {
      return null;
    }

    challenge.claimed = true;
    this.invalidateSnapshot();
    this.notify();
    return { ...challenge, reward: { ...challenge.reward } };
  }

  public subscribe(callback: (state: ChallengeState[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getState());

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
