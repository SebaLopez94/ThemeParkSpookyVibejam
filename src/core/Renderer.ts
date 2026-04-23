import * as THREE from 'three';
import { isMobile } from '../utils/platform';

export class GameRenderer {
  public renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    const mobile = isMobile();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
    // Shadows disabled on mobile — the extra render pass (shadow depth map) costs
    // ~30-40% of frame time.  The game is still fully playable without shadows.
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Disable automatic shadow-map re-render every frame.
    // Game.ts throttles it to every 2 frames and forces an immediate update
    // whenever buildings change — halves shadow pass cost at negligible visual cost.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true; // render on first frame
    this.renderer.sortObjects = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.72;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);
  }

  /** Call once after scene + camera are ready */
  public initPostProcessing(_scene: THREE.Scene, _camera: THREE.Camera): void {
    // Post-processing is intentionally disabled: keep the game render direct.
  }

  /**
   * Marks the shadow map for re-render on the next renderer.render() call.
   * Call after any scene change that affects shadow casters (building placed/removed).
   */
  public invalidateShadowMap(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  public onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
