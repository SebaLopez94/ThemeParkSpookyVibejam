import { INITIAL_UNLOCKED_BUILDINGS } from '../data/buildings';
import { RESEARCH_NODES } from '../data/progression';
import { PlaceableBuildingKind, ResearchNode, ResearchState } from '../types';

export class ResearchSystem {
  private nodes: ResearchNode[] = RESEARCH_NODES;
  private state: ResearchState = this.createInitialState();
  private listeners: Set<(state: ResearchState) => void> = new Set();

  /**
   * Cached snapshot of the research state — rebuilt only when state mutates.
   * During active research, notify() fires every second (remainingTime changes);
   * the cache ensures we only spread the arrays once per tick, not once per listener.
   */
  private cachedState: ResearchState | null = null;

  /**
   * One-time deep-clone of RESEARCH_NODES.
   * getNodes() used to re-spread every node on every call — nodes are static
   * (they never change at runtime), so one clone is enough for the whole session.
   */
  private cachedNodes: ResearchNode[] | null = null;

  private invalidateState(): void { this.cachedState = null; }

  private createInitialState(): ResearchState {
    return {
      unlocked: [...INITIAL_UNLOCKED_BUILDINGS],
      completed: [],
      activeResearchId: null,
      remainingTime: 0
    };
  }

  public getState(): ResearchState {
    if (!this.cachedState) {
      this.cachedState = {
        unlocked: [...this.state.unlocked],
        completed: [...this.state.completed],
        activeResearchId: this.state.activeResearchId,
        remainingTime: this.state.remainingTime
      };
    }
    return this.cachedState;
  }

  public restoreSaveData(state: ResearchState): void {
    this.state = {
      unlocked: [...state.unlocked],
      completed: [...state.completed],
      activeResearchId: state.activeResearchId,
      remainingTime: state.remainingTime
    };
    this.invalidateState();
    this.notify();
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.invalidateState();
    this.notify();
  }

  /**
   * Returns a deep-cloned snapshot of all research nodes.
   * RESEARCH_NODES is static — the clone is built once and reused for the
   * entire session, eliminating repeated spread allocations on every call.
   */
  public getNodes(): ResearchNode[] {
    if (!this.cachedNodes) {
      this.cachedNodes = this.nodes.map(node => ({
        ...node,
        unlocks: [...node.unlocks],
        dependencies: [...node.dependencies],
        dependenciesAny: node.dependenciesAny ? [...node.dependenciesAny] : undefined
      }));
    }
    return this.cachedNodes;
  }

  public isUnlocked(kind: PlaceableBuildingKind): boolean {
    return this.state.unlocked.includes(kind);
  }

  public canStartResearch(id: string): boolean {
    const node = this.nodes.find(item => item.id === id);
    if (!node || this.state.activeResearchId || this.state.completed.includes(id)) {
      return false;
    }

    const requiredDone = node.dependencies.every(dep => this.state.completed.includes(dep));
    const anyRequiredDone = !node.dependenciesAny?.length || node.dependenciesAny.some(dep => this.state.completed.includes(dep));
    return requiredDone && anyRequiredDone;
  }

  public startResearch(id: string): ResearchNode | null {
    if (!this.canStartResearch(id)) return null;

    const node = this.nodes.find(item => item.id === id)!;
    this.state.activeResearchId = id;
    this.state.remainingTime = node.duration;
    this.invalidateState();
    this.notify();
    return node;
  }

  public update(deltaTime: number): PlaceableBuildingKind[] {
    if (!this.state.activeResearchId) return [];

    this.state.remainingTime = Math.max(0, this.state.remainingTime - deltaTime);
    this.invalidateState(); // remainingTime changed
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
