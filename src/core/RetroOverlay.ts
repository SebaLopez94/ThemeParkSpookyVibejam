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

        // Signed distance to a rounded rectangle centred at origin.
        // halfSize = half extents, radius = corner radius.
        float roundedRectSDF(vec2 p, vec2 halfSize, float radius) {
          vec2 d = abs(p) - halfSize + radius;
          return length(max(d, 0.0)) - radius;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / uResolution;
          vec2 p  = uv - 0.5; // centred, -0.5..0.5

          // --- CRT bezel ---
          // Screen area leaves a border of ~4% on each side with rounded corners.
          float bezelW  = 0.018;
          float bezelH  = 0.022;
          float corner  = 0.022;
          float sdf     = roundedRectSDF(p, vec2(0.5 - bezelW, 0.5 - bezelH), corner);

          // Fully black outside the screen opening
          float bezel   = smoothstep(-0.001, 0.006, sdf);

          // Subtle inner shadow along the screen edge (sells the depth of the bezel)
          float innerGlow = smoothstep(0.0, 0.03, -sdf) * 0.22;

          // --- Effects inside the screen ---
          // Remap uv relative to the screen interior so vignette starts at the bezel edge
          vec2 screenUv = (uv - vec2(bezelW, bezelH)) / vec2(1.0 - bezelW * 2.0, 1.0 - bezelH * 2.0);

          // Scanlines: one dark band every 3 px
          float scan     = step(0.66, mod(gl_FragCoord.y, 3.0) / 3.0);
          float scanAlpha = (1.0 - scan) * 0.028;

          // Vignette from screen edges
          vec2 sv       = (screenUv - 0.5) * 2.0;
          float vig     = smoothstep(0.45, 1.25, length(sv * vec2(0.88, 1.0)));
          float vigAlpha = vig * 0.16;

          // Film grain
          float noise    = rand(uv + vec2(fract(uTime * 7.3), fract(uTime * 13.1)));
          float grainAlpha = noise * noise * 0.035;

          float screenAlpha = clamp(scanAlpha + vigAlpha + grainAlpha + innerGlow, 0.0, 0.6);

          // Blend: bezel area → solid black; screen area → subtle effects
          float finalAlpha = mix(screenAlpha, 1.0, bezel);
          gl_FragColor = vec4(0.0, 0.0, 0.0, finalAlpha);
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
