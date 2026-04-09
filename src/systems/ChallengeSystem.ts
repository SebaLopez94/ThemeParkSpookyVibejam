import { INITIAL_CHALLENGES } from '../data/progression';
import { ChallengeState, SimulationSnapshot } from '../types';

export class ChallengeSystem {
  private challenges: ChallengeState[] = INITIAL_CHALLENGES.map(challenge => ({
    ...challenge,
    progress: 0,
    completed: false,
    claimed: false
  }));
  private streaks: Map<string, number> = new Map();
  private listeners: Set<(state: ChallengeState[]) => void> = new Set();

  public getState(): ChallengeState[] {
    return this.challenges.map(challenge => ({ ...challenge, reward: { ...challenge.reward } }));
  }

  public update(deltaTime: number, snapshot: SimulationSnapshot): ChallengeState[] {
    const completedNow: ChallengeState[] = [];

    this.challenges.forEach(challenge => {
      if (challenge.claimed) return;

      switch (challenge.type) {
        case 'visitor_count':
          challenge.progress = Math.min(snapshot.totalVisitors, challenge.target);
          break;
        case 'build_count':
          challenge.progress = Math.min(snapshot.serviceAndDecorationCount, challenge.target);
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
      }

      const targetValue = challenge.duration ?? challenge.target;
      if (!challenge.completed && challenge.progress >= targetValue) {
        challenge.completed = true;
        completedNow.push({ ...challenge, reward: { ...challenge.reward } });
      }
    });

    this.notify();
    return completedNow;
  }

  public claimReward(id: string): ChallengeState | null {
    const challenge = this.challenges.find(item => item.id === id);
    if (!challenge || !challenge.completed || challenge.claimed) {
      return null;
    }

    challenge.claimed = true;
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
