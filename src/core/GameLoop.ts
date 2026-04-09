export class GameLoop {
  private running: boolean = false;
  private lastTime: number = 0;
  private updateCallback: (deltaTime: number) => void;
  private renderCallback: () => void;
  private animationFrameId: number | null = null;

  constructor(
    updateCallback: (deltaTime: number) => void,
    renderCallback: () => void
  ) {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
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

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.updateCallback(Math.min(deltaTime, 0.1));
    this.renderCallback();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
