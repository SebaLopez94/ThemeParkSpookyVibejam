import { INITIAL_UNLOCKED_BUILDINGS } from '../data/buildings';
import { RESEARCH_NODES } from '../data/progression';
import { PlaceableBuildingKind, ResearchNode, ResearchState } from '../types';

export class ResearchSystem {
  private nodes: ResearchNode[] = RESEARCH_NODES;
  private state: ResearchState = {
    unlocked: [...INITIAL_UNLOCKED_BUILDINGS],
    completed: [],
    activeResearchId: null,
    remainingTime: 0
  };
  private listeners: Set<(state: ResearchState) => void> = new Set();

  public getState(): ResearchState {
    return {
      unlocked: [...this.state.unlocked],
      completed: [...this.state.completed],
      activeResearchId: this.state.activeResearchId,
      remainingTime: this.state.remainingTime
    };
  }

  public getNodes(): ResearchNode[] {
    return this.nodes.map(node => ({ ...node, unlocks: [...node.unlocks], dependencies: [...node.dependencies] }));
  }

  public isUnlocked(kind: PlaceableBuildingKind): boolean {
    return this.state.unlocked.includes(kind);
  }

  public canStartResearch(id: string): boolean {
    const node = this.nodes.find(item => item.id === id);
    if (!node || this.state.activeResearchId || this.state.completed.includes(id)) {
      return false;
    }

    return node.dependencies.every(dep => this.state.completed.includes(dep));
  }

  public startResearch(id: string): ResearchNode | null {
    if (!this.canStartResearch(id)) return null;

    const node = this.nodes.find(item => item.id === id)!;
    this.state.activeResearchId = id;
    this.state.remainingTime = node.duration;
    this.notify();
    return node;
  }

  public update(deltaTime: number): PlaceableBuildingKind[] {
    if (!this.state.activeResearchId) return [];

    this.state.remainingTime = Math.max(0, this.state.remainingTime - deltaTime);
    if (this.state.remainingTime > 0) {
      this.notify();
      return [];
    }

    const node = this.nodes.find(item => item.id === this.state.activeResearchId);
    if (!node) {
      this.state.activeResearchId = null;
      this.notify();
      return [];
    }

    this.state.activeResearchId = null;
    this.state.completed.push(node.id);

    const newUnlocks = node.unlocks.filter(kind => !this.state.unlocked.includes(kind));
    this.state.unlocked.push(...newUnlocks);
    this.notify();
    return newUnlocks;
  }

  public subscribe(callback: (state: ResearchState) => void): () => void {
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
