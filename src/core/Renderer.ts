import * as THREE from 'three';
import { PostProcessing } from './PostProcessing';

function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

export class GameRenderer {
  public renderer: THREE.WebGLRenderer;
  private postProcessing: PostProcessing | null = null;
  private startTime = performance.now();

  constructor(container: HTMLElement) {
    const mobile = isMobile();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: false
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // EffectComposer renders to a linear render target — disable automatic sRGB
    // conversion so values aren't gamma-corrected twice (or not at all).
    // The final shader pass applies gamma manually via pow(color, 1/2.2).
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    container.appendChild(this.renderer.domElement);
  }

  /** Call once after scene + camera are ready */
  public initPostProcessing(scene: THREE.Scene, camera: THREE.Camera): void {
    this.postProcessing = new PostProcessing(this.renderer, scene, camera);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.postProcessing) {
      const elapsed = (performance.now() - this.startTime) / 1000;
      this.postProcessing.render(elapsed);
    } else {
      this.renderer.render(scene, camera);
    }
  }

  public onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcessing?.onWindowResize();
  }

  public dispose(): void {
    this.postProcessing?.dispose();
    this.renderer.dispose();
  }
}
