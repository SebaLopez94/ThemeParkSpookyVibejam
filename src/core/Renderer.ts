import * as THREE from 'three';
import { isMobile } from '../utils/platform';

export class GameRenderer {
  public renderer: THREE.WebGLRenderer;
  private readonly mobile: boolean;

  constructor(container: HTMLElement) {
    const mobile = isMobile();
    this.mobile = mobile;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 0.85 : 1.5));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.sortObjects = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = mobile ? 1.82 : 1.92;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);
  }

  public initPostProcessing(): void {
    // Post-processing is intentionally disabled: keep the game render direct.
  }

  public invalidateShadowMap(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.mobile) {
      this.renderer.render(scene, camera);
      return;
    }

    // Keep rendering direct. The experimental height-fog material patch can
    // collide with generated Three.js uniforms on some model materials.
    this.renderer.render(scene, camera);
  }

  public onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
