import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ─── 90s Horror Arcade CRT Shader ────────────────────────────────────────────
//
//  Effects (in order of application):
//   1. Barrel warp         — CRT screen curvature, black corners
//   2. Chromatic aberration— subtle 1px RGB fringe at edges
//   3. VHS scan jitter     — analog horizontal tracking noise
//   4. Phosphor bloom      — soft glow bleeding from bright areas
//   5. Scanlines           — ADDITIVE phosphor glow rows (don't darken)
//   6. Three-band color grade
//        shadows  → push phosphor green
//        midtones → push purple/magenta (spooky arcade)
//        highlights → stay clean/bright
//   7. Screen flicker      — barely visible CRT brightness pulse
//   8. Soft vignette       — edges only, center stays at 1.0
//   9. Film grain          — barely perceptible
//  10. Gamma correction    — manual sRGB because renderer.outputColorSpace = Linear
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

    // Barrel distortion — CRT screen curvature
    vec2 barrelWarp(vec2 uv, float k) {
      vec2 d = uv - 0.5;
      return uv + d * dot(d, d) * k;
    }

    void main() {

      // ── 1. Barrel warp ────────────────────────────────────────────────
      vec2 uv = barrelWarp(vUv, 0.025);  // very subtle — just enough to feel CRT
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // ── 2. Chromatic aberration ───────────────────────────────────────
      vec2 edge = (uv - 0.5);
      float ca = 0.0014;
      float r = texture2D(tDiffuse, uv + edge * ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - edge * ca).b;
      vec3 color = vec3(r, g, b);

      // ── 3. (VHS jitter removed — caused too much distortion) ─────────

      // ── 4. Phosphor bloom ─────────────────────────────────────────────
      // Sample 4 neighbours; only add glow where pixels are bright enough
      vec2 px     = vec2(1.8) / resolution;
      vec3 bloom  = (
        texture2D(tDiffuse, uv + vec2( px.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(-px.x, 0.0)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0,  px.y)).rgb +
        texture2D(tDiffuse, uv + vec2(0.0, -px.y)).rgb
      ) * 0.25;
      float bloomMask = smoothstep(0.52, 0.82, dot(bloom, vec3(0.333)));
      color += bloom * bloomMask * 0.10;

      // ── 5. Scanlines (additive phosphor glow) ────────────────────────
      float scanRow  = mod(uv.y * resolution.y, 2.0);
      float scanGlow = smoothstep(0.0, 1.0, scanRow) * (1.0 - smoothstep(1.0, 2.0, scanRow));
      // Tint: neutral blue-white (no green cast)
      color += vec3(0.005, 0.004, 0.008) * scanGlow * 1.4;

      // ── 6. Three-band colour grade ────────────────────────────────────
      float luma      = dot(color, vec3(0.299, 0.587, 0.114));
      float shadow    = 1.0 - smoothstep(0.0, 0.30, luma);   // dark regions
      float highlight = smoothstep(0.70, 1.0,  luma);         // bright regions
      float midtone   = clamp(1.0 - shadow - highlight, 0.0, 1.0);

      // Shadows: barely visible warm-grey, zero green
      color += vec3(-0.002, 0.001, -0.001) * shadow;

      // Midtones: subtle purple/magenta tint — spooky without being overwhelming
      color += vec3(0.012, -0.006, 0.016) * midtone;

      // Highlights: slight blue-white lift for that CRT over-bright look
      color += vec3(0.004, 0.004, 0.012) * highlight;

      // Slight desaturation to unify the palette (doesn't darken)
      float luma2 = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(color, vec3(luma2), 0.06);

      // Contrast snap — slight S-curve via multiply+offset
      color = color * 1.05 + 0.012;

      // ── 7. Screen flicker ─────────────────────────────────────────────
      // Very high-frequency sine so only the overall envelope is visible,
      // not individual flicker frames — mimics CRT power supply hum.
      float flicker = 1.0 + sin(time * 97.3) * 0.005 + sin(time * 43.1) * 0.003;
      color *= flicker;

      // ── 8. Soft vignette ──────────────────────────────────────────────
      vec2  vig      = uv * 2.0 - 1.0;
      float vignette = 1.0 - dot(vig * 0.36, vig * 0.36);
      vignette = clamp(pow(vignette, 0.60), 0.87, 1.0);
      color *= vignette;

      // ── 9. Film grain ─────────────────────────────────────────────────
      color += (rand(uv + fract(time * 0.13)) * 0.018) - 0.009;

      // ── 10. Gamma correction (linear → sRGB) ─────────────────────────
      // Applied manually because renderer.outputColorSpace = LinearSRGBColorSpace
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
