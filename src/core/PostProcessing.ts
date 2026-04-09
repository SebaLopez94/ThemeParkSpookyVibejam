import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const RetroShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
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
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5);
      vec2 dir = uv - center;

      float strength = 0.0009;
      float r = texture2D(tDiffuse, uv + dir * strength).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * strength).b;
      vec3 color = vec3(r, g, b);

      float scan = sin(uv.y * resolution.y * 3.14159265) * 0.5 + 0.5;
      scan = pow(scan, 1.5);
      color *= 0.95 + scan * 0.05;

      float grain = rand(uv + fract(time * 0.07)) * 0.028 - 0.014;
      color += grain;

      vec2 vig = uv * 2.0 - 1.0;
      float vignette = 1.0 - dot(vig * 0.42, vig * 0.42);
      vignette = clamp(pow(vignette, 0.8), 0.82, 1.0);
      color *= vignette;

      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(color, vec3(luma), 0.08);
      color.g += 0.01;
      color = clamp(color * 1.08 + 0.045, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
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
