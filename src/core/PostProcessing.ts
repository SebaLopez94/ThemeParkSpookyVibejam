import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ─── Old CRT Television Shader ───────────────────────────────────────────────
//
//  Effects (in order):
//   1. Barrel warp         — visible screen curvature + black rounded corners
//   2. Chromatic aberration— clear RGB fringe toward screen edges
//   3. Phosphor horizontal smear — CRT beam trail
//   4. Scanlines           — dark gaps between rows (multiplicative, clearly visible)
//   5. Interlace flicker   — odd/even field alternation (60hz feel)
//   6. Phosphor glow       — soft bloom from bright areas
//   7. Color grade         — warm amber-green phosphor cast (aged CRT)
//   8. Horizontal hold jitter — rare horizontal wobble line
//   9. Screen flicker      — power-supply brightness hum + slow roll
//  10. Vignette            — strong darkening at corners
//  11. Static noise        — visible analog TV grain
//  12. Gamma correction    — manual sRGB
//
// ─────────────────────────────────────────────────────────────────────────────
const RetroShader = {
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },
    time:       { value: 0 },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float     time;
    uniform vec2      resolution;
    varying vec2      vUv;

    #define PI 3.14159265

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec2 barrelWarp(vec2 uv, float k) {
      vec2 d = uv - 0.5;
      return uv + d * dot(d, d) * k;
    }

    void main() {

      // ── 1. Barrel warp ────────────────────────────────────────────────
      vec2 uv = barrelWarp(vUv, 0.065);
      // Smooth rounded corners mask
      vec2 cornerMask = smoothstep(0.0, 0.02, uv) * smoothstep(1.0, 0.98, uv);
      float inScreen = cornerMask.x * cornerMask.y;
      if (inScreen < 0.01) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // ── 2. Chromatic aberration ───────────────────────────────────────
      vec2 edge = (uv - 0.5);
      float ca  = 0.0032;
      float r   = texture2D(tDiffuse, uv + edge * ca).r;
      float g   = texture2D(tDiffuse, uv + edge * ca * 0.3).g;
      float b   = texture2D(tDiffuse, uv - edge * ca).b;
      vec3 color = vec3(r, g, b);

      // ── 3. Phosphor horizontal smear ─────────────────────────────────
      vec2 px    = vec2(1.0) / resolution;
      vec3 smear = texture2D(tDiffuse, uv + vec2(px.x * 1.5, 0.0)).rgb * 0.25
                 + texture2D(tDiffuse, uv + vec2(px.x * 3.0, 0.0)).rgb * 0.10;
      color += smear * 0.11;

      float lineY = uv.y * resolution.y;

      // ── 6. Phosphor glow ─────────────────────────────────────────────
      vec2 bpx   = vec2(2.2) / resolution;
      vec3 bloom = (
        texture2D(tDiffuse, uv + vec2( bpx.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(-bpx.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0,  bpx.y)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0, -bpx.y)).rgb
      ) * 0.25;
      float bloomMask = smoothstep(0.45, 0.80, dot(bloom, vec3(0.333)));
      color += bloom * bloomMask * 0.12;

      // ── 7. Colour grade — aged CRT phosphor ──────────────────────────
      float luma      = dot(color, vec3(0.299, 0.587, 0.114));
      float shadow    = 1.0 - smoothstep(0.0, 0.35, luma);
      float highlight = smoothstep(0.65, 1.0, luma);
      float midtone   = clamp(1.0 - shadow - highlight, 0.0, 1.0);

      color += vec3(-0.002,  0.000,  0.006) * shadow;
      color += vec3( 0.004, -0.001,  0.008) * midtone;
      color += vec3( 0.010,  0.006,  0.010) * highlight;

      // Keep the CRT feel while preserving more scene colour separation.
      float luma2 = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(color, vec3(luma2), 0.18);
      color = mix(color, color * vec3(0.92, 0.97, 1.05), 0.28);
      color *= 1.03;

      // ── 9. Screen flicker ─────────────────────────────────────────────
      float flicker = 1.0
        + sin(time * 2.1)  * 0.01
        + sin(time * 5.3)  * 0.004;
      color *= flicker;

      // ── 10. Vignette ─────────────────────────────────────────────────
      vec2  vig      = uv * 2.0 - 1.0;
      float vignette = 1.0 - dot(vig * 0.50, vig * 0.50);
      vignette = clamp(pow(vignette, 0.68), 0.76, 1.0);
      color *= vignette;
      color *= inScreen;

      // ── 11. Static noise ─────────────────────────────────────────────
      float noise = rand(uv + fract(time * 0.29)) * 0.03 - 0.015;
      color += noise;

      // ── 12. Gamma correction (linear → sRGB) ─────────────────────────
      color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
};

export class PostProcessing {
  private composer: EffectComposer;
  private retroPass: ShaderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.retroPass = new ShaderPass(RetroShader);
    this.retroPass.renderToScreen = true;
    this.composer.addPass(this.retroPass);
  }

  public render(time: number): void {
    this.retroPass.uniforms.time.value = time;
    this.composer.render();
  }

  public onWindowResize(): void {
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.retroPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.composer.dispose();
  }
}
