import * as THREE from 'three';

/**
 * Fullscreen retro overlay — scanlines, vignette and film grain.
 * Rendered as a screen-space quad on top of the 3D scene.
 * All effects are intentionally very subtle.
 */
export class RetroOverlay {
  private readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private elapsedTime = 0;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      vertexShader: /* glsl */`
        void main() {
          // NDC passthrough — ignores camera transforms
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec2  uResolution;

        float rand(vec2 co) {
          return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution;

          // Scanlines: one dark band every 3 px
          float scan     = step(0.66, mod(gl_FragCoord.y, 3.0) / 3.0);
          float scanAlpha = (1.0 - scan) * 0.018;

          // Vignette from screen edges
          vec2 sv       = (uv - 0.5) * 2.0;
          float vig     = smoothstep(0.86, 1.45, length(sv * vec2(0.88, 1.0)));
          float vigAlpha = vig * 0.045;

          // Film grain
          float noise    = rand(uv + vec2(fract(uTime * 7.3), fract(uTime * 13.1)));
          float grainAlpha = noise * noise * 0.022;

          float screenAlpha = clamp(scanAlpha + vigAlpha + grainAlpha, 0.0, 0.18);

          // Blend: bezel area → solid black; screen area → subtle effects
          gl_FragColor = vec4(0.0, 0.0, 0.0, screenAlpha);
        }
      `,
      transparent: true,
      depthTest:   false,
      depthWrite:  false,
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder    = 999;
    this.mesh.frustumCulled  = false;
    scene.add(this.mesh);
  }

  public update(deltaTime: number): void {
    this.elapsedTime += deltaTime;
    this.material.uniforms.uTime.value = this.elapsedTime;
  }

  public onWindowResize(): void {
    this.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
