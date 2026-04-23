import * as THREE from 'three';
import { isMobile } from '../utils/platform';

const BACKGROUND_FOG_LAYER = 1;

type HeightFogShaderHandle = {
  uniforms: Record<string, { value: unknown }>;
};

const HEIGHT_FOG_NOISE = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = C.x * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbmBase(vec3 p, int octaves) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    value += amp * snoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

float fbm01(vec3 p, int octaves) {
  return clamp(fbmBase(p, octaves) * 0.5 + 0.5, 0.0, 1.0);
}
`;

export class GameRenderer {
  public renderer: THREE.WebGLRenderer;
  private readonly mobile: boolean;
  private readonly fogPatchedMaterials = new WeakSet<THREE.Material>();
  private readonly heightFogMaterials = new Set<THREE.Material>();
  private fogTime = 0;
  private fogPatchFrame = 0;

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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1 : 1.5));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.sortObjects = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.72;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);
  }

  private patchHeightFogMaterial(material: THREE.Material): void {
    this.heightFogMaterials.add(material);
    if (this.fogPatchedMaterials.has(material)) return;
    if (material instanceof THREE.ShaderMaterial || material instanceof THREE.RawShaderMaterial) return;

    const originalOnBeforeCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      shader.uniforms.uFogRadius = { value: this.mobile ? 205 : 285 };
      shader.uniforms.uFogColor = { value: new THREE.Color(0xe3eaf2) };
      shader.uniforms.uFogTop = { value: 6.2 };
      shader.uniforms.uFogDepth = { value: 5.0 };
      shader.uniforms.uFogOpacity = { value: this.mobile ? 0.16 : 0.25 };
      shader.uniforms.uFogExponent = { value: 1.2 };
      shader.uniforms.uNoiseScale = { value: this.mobile ? 0.24 : 0.40 };
      shader.uniforms.uNoiseStrength = { value: 0.12 };
      shader.uniforms.uNoiseOctaves = { value: this.mobile ? 4 : 5 };
      shader.uniforms.uWindDir = { value: new THREE.Vector2(0.0, 1.0) };
      shader.uniforms.uWindSpeed = { value: this.mobile ? 0.26 : 0.34 };
      shader.uniforms.uVerticalBillow = { value: 0.08 };
      shader.uniforms.uTime = { value: 0 };

      shader.vertexShader = `varying vec3 vWorldPos;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        #else
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        #endif`
      );

      shader.fragmentShader = `
        varying vec3 vWorldPos;
        uniform float uFogRadius;
        uniform vec3 uFogColor;
        uniform float uFogTop;
        uniform float uFogDepth;
        uniform float uFogOpacity;
        uniform float uFogExponent;
        uniform float uNoiseScale;
        uniform float uNoiseStrength;
        uniform int uNoiseOctaves;
        uniform vec2 uWindDir;
        uniform float uWindSpeed;
        uniform float uVerticalBillow;
        uniform float uTime;
        ${HEIGHT_FOG_NOISE}
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `#include <fog_fragment>
        if (vWorldPos.y < uFogTop) {
          vec2 camXZ = cameraPosition.xz;
          vec2 posXZ = vWorldPos.xz;
          float distXZ = distance(camXZ, posXZ);
          if (uFogRadius > 0.0 && distXZ <= uFogRadius) {
            float normalized = clamp((uFogTop - vWorldPos.y) / max(0.0001, uFogDepth), 0.0, 1.0);
            float heightAtten = pow(normalized, uFogExponent);
            if (heightAtten > 0.0) {
              vec3 sampleA = vWorldPos * uNoiseScale;
              vec3 windOffset = vec3(uWindDir.x, 0.0, uWindDir.y) * uWindSpeed * uTime * uNoiseScale;
              windOffset.y += sin(uTime * 0.07 + sampleA.x * 0.45 + sampleA.z * 0.5) * uVerticalBillow;
              sampleA += windOffset;

              vec3 sampleB = vWorldPos * (uNoiseScale * 0.82);
              sampleB += vec3(-uWindDir.y, 0.0, uWindDir.x) * uWindSpeed * 0.6 * uTime * uNoiseScale;
              sampleB.y += sin(uTime * 0.09 + sampleB.x * 0.55 + sampleB.z * 0.62) * (uVerticalBillow * 0.8);

              float noiseMix = mix(fbm01(sampleA, uNoiseOctaves), fbm01(sampleB, uNoiseOctaves), 0.42);
              float effectiveStrength = uNoiseStrength * 0.1;
              float noiseMod = mix(1.0 - effectiveStrength, 1.0 + effectiveStrength, noiseMix);
              float radiusFactor = 1.0 - smoothstep(uFogRadius * 0.7, uFogRadius, distXZ);
              float distanceBoost = mix(0.9, 1.08, smoothstep(uFogRadius * 0.22, uFogRadius * 0.84, distXZ));
              float groundBoost = mix(0.88, 1.04, pow(normalized, 1.0));
              float fogFactor = clamp(heightAtten * noiseMod * uFogOpacity * radiusFactor * distanceBoost * groundBoost, 0.0, 1.0);
              vec3 fogTint = mix(uFogColor * 0.96, uFogColor, smoothstep(0.2, 0.8, noiseMix));
              gl_FragColor.rgb = mix(gl_FragColor.rgb, fogTint, fogFactor);
            }
          }
        }`
      );

      const userData = material.userData as { heightFogShader?: HeightFogShaderHandle };
      userData.heightFogShader = { uniforms: shader.uniforms as Record<string, { value: unknown }> };

      originalOnBeforeCompile?.(shader, renderer);
    };

    material.customProgramCacheKey = () => 'ground-height-fog-v1';
    material.needsUpdate = true;
    this.fogPatchedMaterials.add(material);
  }

  private patchSceneHeightFog(scene: THREE.Scene): void {
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh || object instanceof THREE.InstancedMesh)) return;
      if (!object.layers.isEnabled(BACKGROUND_FOG_LAYER)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (material) this.patchHeightFogMaterial(material);
      });
    });
  }

  private updateHeightFog(): void {
    this.heightFogMaterials.forEach(material => {
      const handle = (material.userData as { heightFogShader?: HeightFogShaderHandle }).heightFogShader;
      if (!handle) return;
      if (handle.uniforms.uTime) handle.uniforms.uTime.value = this.fogTime;
    });
  }

  public initPostProcessing(_scene: THREE.Scene, _camera: THREE.Camera): void {
    // Post-processing is intentionally disabled: keep the game render direct.
  }

  public invalidateShadowMap(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    // Background fog geometry changes rarely, so rescan infrequently and keep
    // a cached material set for the cheap per-frame uniform updates.
    if (this.fogPatchFrame++ % 120 === 0) {
      this.patchSceneHeightFog(scene);
    }
    this.fogTime += this.mobile ? 0.007 : 0.011;
    this.updateHeightFog();
    this.renderer.render(scene, camera);
  }

  public onWindowResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose(): void {
    this.renderer.dispose();
  }
}
