export class GameLoop {
  private running: boolean = false;
  private lastTime: number = 0;
  private updateCallback: (deltaTime: number) => void;
  private renderCallback: () => void;
  private animationFrameId: number | null = null;
  /**
   * Minimum milliseconds between frames.
   * 0 = uncapped (desktop).  ~33 ms = 30 fps cap (mobile) — halves CPU/GPU work
   * without affecting gameplay since deltaTime stays frame-rate independent.
   */
  private readonly minFrameTime: number;

  constructor(
    updateCallback: (deltaTime: number) => void,
    renderCallback: () => void,
    minFrameTime = 0
  ) {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.minFrameTime = minFrameTime;
  }

  public start(): void {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  public stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.running) return;
    this.animationFrameId = requestAnimationFrame(this.loop);

    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    // Skip this tick if we haven't reached the minimum frame interval.
    // requestAnimationFrame still fires so the tab stays alive and input is responsive.
    if (elapsed < this.minFrameTime) return;

    const deltaTime = elapsed / 1000;
    this.lastTime = currentTime;

    this.updateCallback(Math.min(deltaTime, 0.1));
    this.renderCallback();
  };
}
