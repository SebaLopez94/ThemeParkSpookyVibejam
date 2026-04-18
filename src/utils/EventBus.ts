type Listener<T> = (payload: T) => void;

/** Strongly-typed publish/subscribe event bus. */
export class EventBus<Events extends object> {
  private readonly channels = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    if (!this.channels.has(event)) {
      this.channels.set(event, new Set());
    }
    this.channels.get(event)!.add(listener as Listener<unknown>);
    return () => this.off(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): void {
    this.channels.get(event)?.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.channels.get(event)?.forEach(listener => listener(payload));
  }

  clear(): void {
    this.channels.clear();
  }
}
