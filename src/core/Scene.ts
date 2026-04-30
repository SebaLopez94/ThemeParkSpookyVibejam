import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRID_WIDTH, GRID_HEIGHT, GRID_SIZE } from '../utils/GridHelper';
import { sharedGLTFLoader, sharedTextureLoader } from './AssetLoader';
import { isMobile } from '../utils/platform';
import { RetroOverlay } from './RetroOverlay';

const BACKGROUND_FOG_LAYER = 1;

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  public hemisphereLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;
  private groundBounceLight: THREE.DirectionalLight;
  /** null on mobile — saves a fullscreen shader pass every frame. */
  private retroOverlay: RetroOverlay | null;
  /** Stores InstancedMesh objects (one per GLTF submesh per model type). */
  private surroundingClones: THREE.Object3D[] = [];
  private readonly baseAmbientIntensity: number;
  private readonly baseHemisphereIntensity: number;
  private readonly baseDirectionalIntensity: number;
  /** Cached once at construction — avoids re-running the UA regex every frame. */
  private readonly mobile: boolean;
  /** Reusable scratch matrix for instanced transform composition. */
  private readonly _tempMatrix = new THREE.Matrix4();
  /** Reusable scratch objects for GLTF bounding-box computation. */
  private readonly _box3 = new THREE.Box3();
  private readonly _vec3 = new THREE.Vector3();
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.LineBasicMaterial | null = null;
  private rainLines: THREE.LineSegments | null = null;
  private rainPositions: Float32Array | null = null;
  private rainSpeeds: Float32Array | null = null;
  private rainDrift: Float32Array | null = null;
  private rainCenter = new THREE.Vector3();
  private rainUpdateAccumulator = 0;
  private exteriorMistGroup: THREE.Group | null = null;
  private exteriorMistMaterials: THREE.SpriteMaterial[] = [];
  private exteriorGroundFogMaterials: THREE.MeshBasicMaterial[] = [];
  private lightningLight: THREE.PointLight | null = null;
  private lightningGeometry: THREE.BufferGeometry | null = null;
  private lightningMaterial: THREE.LineBasicMaterial | null = null;
  private lightningBolt: THREE.LineSegments | null = null;
  private lightningTimer = 0;
  private lightningFlashTimer = 0;
  private lightningTriggered = false;
  private deferredTimers: ReturnType<typeof window.setTimeout>[] = [];
  private exteriorMistTexture: THREE.CanvasTexture | null = null;
  private lastShadowTargetX = Number.NaN;
  private lastShadowTargetZ = Number.NaN;


  constructor() {
    this.mobile = isMobile();
    const mobile = this.mobile;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141022);
    this.scene.fog = new THREE.Fog(0x14111f, mobile ? 46 : 36, mobile ? 136 : 150);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(40, 50, 40);
    this.camera.lookAt(0, 0, 0);

    // Dark global fill so the park stays readable without flattening all shadows.
    // Intensities boosted ~30% to compensate for ACESFilmicToneMapping mid-range compression.
    this.ambientLight = new THREE.AmbientLight(0x73809f, mobile ? 0.68 : 0.58);
    this.baseAmbientIntensity = this.ambientLight.intensity;
    this.scene.add(this.ambientLight);

    // Subtle sky/ground split keeps tops cool and undersides slightly earthy.
    this.hemisphereLight = new THREE.HemisphereLight(0x6f86b9, 0x271923, mobile ? 0.82 : 0.92);
    this.baseHemisphereIntensity = this.hemisphereLight.intensity;
    this.scene.add(this.hemisphereLight);

    // Cool moon key light for silhouettes and shadow shape.
    this.directionalLight = new THREE.DirectionalLight(0xd6e4ff, mobile ? 1.12 : 1.38);
    this.baseDirectionalIntensity = this.directionalLight.intensity;
    this.directionalLight.position.set(-52, 96, -28);
    this.directionalLight.castShadow = !mobile;
    // Tight frustum (±32 world units) centred on shadow target — 3× better texel density
    // than the old ±100. Target is updated each frame via updateShadowFrustum().
    this.directionalLight.shadow.camera.left = -58;
    this.directionalLight.shadow.camera.right = 58;
    this.directionalLight.shadow.camera.top = 58;
    this.directionalLight.shadow.camera.bottom = -58;
    this.directionalLight.shadow.mapSize.width = mobile ? 256 : 2048;
    this.directionalLight.shadow.mapSize.height = mobile ? 256 : 2048;
    this.directionalLight.shadow.bias = -0.00008;
    this.directionalLight.shadow.normalBias = 0.045;
    // Target must be in the scene for position updates to take effect.
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    // Soft purple fill from the opposite side — reduces harsh unlit faces without
    // flattening the scene. No shadow casting: zero cost.
    this.fillLight = new THREE.DirectionalLight(0x8a4c9f, mobile ? 0.26 : 0.36);
    this.fillLight.position.set(-42, 34, -22);
    this.fillLight.castShadow = false;
    this.scene.add(this.fillLight);

    this.groundBounceLight = new THREE.DirectionalLight(0xff9f5c, mobile ? 0.08 : 0.12);
    this.groundBounceLight.position.set(14, 10, 28);
    this.groundBounceLight.castShadow = false;
    this.scene.add(this.groundBounceLight);

    this.createGround();
    this.createForestFloor();
    this.createMountains();
    this.createEntrancePathExtension();
    this.createGridLines();
    this.deferWork(() => this.createEntranceGate(), 250);
    this.createPerimeterFence();
    this.deferWork(() => this.createSurroundings(), mobile ? 3200 : 1800);
    this.createExteriorMist();
    this.createMoon();
    this.createRain();
    this.createLightning();

    // Skip on mobile — eliminates a fullscreen shader pass (scanlines + grain)
    // that's purely cosmetic and adds measurable GPU time on low-end devices.
    this.retroOverlay = mobile ? null : new RetroOverlay(this.scene);
  }

  private deferWork(callback: () => void, delayMs: number): void {
    const timer = window.setTimeout(() => {
      this.deferredTimers = this.deferredTimers.filter(entry => entry !== timer);
      callback();
    }, delayMs);
    this.deferredTimers.push(timer);
  }

  private enableBackgroundFogLayer(object: THREE.Object3D): void {
    object.layers.enable(BACKGROUND_FOG_LAYER);
    object.traverse(child => child.layers.enable(BACKGROUND_FOG_LAYER));
  }

  private createFencePatinaTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const base = ctx.createLinearGradient(0, 0, size, size);
    base.addColorStop(0, '#17100d');
    base.addColorStop(0.48, '#070606');
    base.addColorStop(1, '#261611');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 850; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const alpha = 0.035 + Math.random() * 0.08;
      const warm = Math.random() > 0.78;
      ctx.fillStyle = warm
        ? `rgba(145, 68, 31, ${alpha})`
        : `rgba(230, 219, 178, ${alpha * 0.42})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
    }

    ctx.globalAlpha = 0.28;
    for (let y = 0; y < size; y += 9) {
      ctx.fillStyle = y % 18 === 0 ? '#2f1a12' : '#050404';
      ctx.fillRect(0, y, size, 1);
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  private createEntrancePathExtension(): void {
    const texture = sharedTextureLoader.load('/models/path.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    const pathWidth = GRID_SIZE * 2.05;
    const pathLength = GRID_SIZE * 11.2;
    const startZ = (GRID_HEIGHT * GRID_SIZE) / 2 - 0.28;
    const centerZ = startZ + pathLength / 2;
    const centerX = GRID_SIZE / 2;

    const pathGeo = new THREE.PlaneGeometry(pathWidth, pathLength, 1, 8);
    const uv = pathGeo.attributes.uv as THREE.BufferAttribute;
    const pos = pathGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const worldX = centerX + pos.getX(i);
      const worldZ = centerZ + pos.getY(i);
      uv.setXY(i, worldX / GRID_SIZE, worldZ / GRID_SIZE);
    }
    uv.needsUpdate = true;

    const pathMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.04,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(centerX, 0.092, centerZ);
    path.receiveShadow = true;
    path.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(path);

    const featherGeo = new THREE.PlaneGeometry(pathWidth + 0.9, pathLength + 0.7, 1, 1);
    const featherMat = new THREE.MeshBasicMaterial({
      color: 0x0c0910,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const feather = new THREE.Mesh(featherGeo, featherMat);
    feather.rotation.x = -Math.PI / 2;
    feather.position.set(centerX, 0.071, centerZ + 0.08);
    feather.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(feather);
  }

  private createEntranceGate(): void {
    sharedGLTFLoader.load('/models/entrance.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = 8; // Width to span across the double path
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());

      // Center on the double-wide entrance path (grid x=12+13 → world X=0)
      model.position.x -= center.x;
      model.position.x += 0.8;

      // Place OUTSIDE the grid — grid bottom edge is world Z=50, gate sits just beyond it
      model.position.z -= center.z;
      model.position.z += 26.2;

      model.position.y -= scaledBox.min.y + 0.08;

      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (!(mat instanceof THREE.MeshStandardMaterial)) return;
          mat.color.multiplyScalar(1.3);
          mat.emissive.setRGB(1, 1, 1);
          if (mat.map) mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.06;
          mat.needsUpdate = true;
        });
      });

      this.enableBackgroundFogLayer(model);
      this.scene.add(model);

      // Warm torch glow — one light per pillar of the entrance arch
      const leftLight  = new THREE.PointLight(0xff7020, 6.0, 28);
      leftLight.position.set(-3.15, 4.92, 26.2);
      leftLight.castShadow = false;
      leftLight.layers.enable(BACKGROUND_FOG_LAYER);
      this.scene.add(leftLight);

      const rightLight = new THREE.PointLight(0xff7020, 6.0, 28);
      rightLight.position.set(3.85, 4.92, 26.2);
      rightLight.castShadow = false;
      rightLight.layers.enable(BACKGROUND_FOG_LAYER);
      this.scene.add(rightLight);
    });
  }

  private createPerimeterFence(): void {
    const halfW = (GRID_WIDTH * GRID_SIZE) / 2;  // 50
    const halfH = (GRID_HEIGHT * GRID_SIZE) / 2; // 50
    const spacing = 2;
    const postH = 2.8;
    const spikeH = 0.5;
    const postW = 0.14;
    const railH = 0.09;
    const railD = 0.09;

    const fenceTexture = this.createFencePatinaTexture();
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x1a120f,
      map: fenceTexture,
      bumpMap: fenceTexture,
      bumpScale: 0.035,
      roughness: 0.74,
      metalness: 0.52,
      envMapIntensity: 0.18,
      vertexColors: true,
    });
    const railMat = postMat.clone();
    railMat.vertexColors = false;
    railMat.color.setHex(0x130d0b);

    // --- Posts (InstancedMesh) ---
    const postPositions: [number, number][] = []; // [worldX, worldZ]
    const entranceHalfW = 2.2; // gap in bottom fence for the entrance path

    // Bottom edge — gap at entrance (X = -entranceHalfW .. +entranceHalfW)
    for (let x = -halfW; x <= halfW; x += spacing) {
      if (x > -entranceHalfW && x < entranceHalfW) continue;
      postPositions.push([x, halfH]);
    }
    // Top edge
    for (let x = -halfW; x <= halfW; x += spacing) {
      postPositions.push([x, -halfH]);
    }
    // Left edge (skip corners already in top/bottom)
    for (let z = -halfH + spacing; z < halfH; z += spacing) {
      postPositions.push([-halfW, z]);
    }
    // Right edge
    for (let z = -halfH + spacing; z < halfH; z += spacing) {
      postPositions.push([halfW, z]);
    }

    // Post shafts
    const postGeo = new THREE.BoxGeometry(postW, postH, postW);
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, postPositions.length);
    postMesh.castShadow = false;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    postPositions.forEach(([x, z], i) => {
      dummy.position.set(x, postH / 2, z);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
      const shade = 0.72 + ((i * 17) % 11) / 50;
      color.setRGB(0.11 * shade, 0.075 * shade, 0.055 * shade);
      postMesh.setColorAt(i, color);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    if (postMesh.instanceColor) postMesh.instanceColor.needsUpdate = true;
    postMesh.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(postMesh);

    // Spike tips on every post
    const spikeGeo = new THREE.ConeGeometry(postW * 0.9, spikeH, 4);
    const spikeMesh = new THREE.InstancedMesh(spikeGeo, postMat, postPositions.length);
    spikeMesh.castShadow = false;
    postPositions.forEach(([x, z], i) => {
      dummy.position.set(x, postH + spikeH / 2, z);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.updateMatrix();
      spikeMesh.setMatrixAt(i, dummy.matrix);
      const shade = 0.68 + ((i * 13) % 9) / 48;
      color.setRGB(0.12 * shade, 0.074 * shade, 0.048 * shade);
      spikeMesh.setColorAt(i, color);
    });
    spikeMesh.instanceMatrix.needsUpdate = true;
    if (spikeMesh.instanceColor) spikeMesh.instanceColor.needsUpdate = true;
    spikeMesh.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(spikeMesh);

    // --- Rails (thin horizontal bars per side) ---
    // Collect all span geometries in world space and merge into one Mesh = 1 draw call.
    const railGeoAccum: THREE.BufferGeometry[] = [];
    const railDummy = new THREE.Object3D();

    const addRailSpan = (x1: number, z1: number, x2: number, z2: number) => {
      const dx  = x2 - x1;
      const dz  = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const unitGeo = new THREE.BoxGeometry(railD, railH, len);
      for (const yFrac of [0.28, 0.72]) {
        railDummy.position.set(cx, postH * yFrac, cz);
        railDummy.rotation.set(0, angle, 0);
        railDummy.scale.set(1, 1, 1);
        railDummy.updateMatrix();
        const worldGeo = unitGeo.clone();
        worldGeo.applyMatrix4(railDummy.matrix);
        railGeoAccum.push(worldGeo);
      }
      unitGeo.dispose(); // raw geometry disposed; world copies survive in the array
    };

    // Bottom left of entrance gap
    addRailSpan(-halfW, halfH, -entranceHalfW, halfH);
    // Bottom right of entrance gap
    addRailSpan(entranceHalfW, halfH, halfW, halfH);
    // Top
    addRailSpan(-halfW, -halfH, halfW, -halfH);
    // Left
    addRailSpan(-halfW, -halfH, -halfW, halfH);
    // Right
    addRailSpan(halfW, -halfH, halfW, halfH);

    // Merge all 10 rail geometries → 1 draw call
    const mergedRails = mergeGeometries(railGeoAccum, false);
    railGeoAccum.forEach(g => g.dispose()); // free the per-span clones
    const railMesh = new THREE.Mesh(mergedRails, railMat);
    railMesh.castShadow = false;
    railMesh.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(railMesh);
  }

  private createSurroundings(): void {
    const mobile = this.mobile;
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const fence = (GRID_WIDTH * GRID_SIZE) / 2 + 4; // 54

    const isValid = (x: number, z: number) =>
      (Math.abs(x) >= fence || Math.abs(z) >= fence) && // outside fence
      !(Math.abs(x) < 4 && z > fence);                  // only clear the path gap

    /**
     * Replaces N individual clones with InstancedMesh objects — one per GLTF submesh.
     * Reduces surroundings from O(count × submeshes) draw calls to O(submeshes) — typically 2-4.
     * RNG call order is identical to the old placeClones so positions are unchanged.
     */
    const placeInstanced = (
      path: string, count: number, maxDist: number, targetH: number, scaleVar: number, sink = 0
    ) => {
      // Pre-generate all instance data synchronously using the seeded RNG
      // so the call order is deterministic regardless of async GLTF load timing.
      type InstanceData = { x: number; z: number; sv: number; rotY: number };
      const instances: InstanceData[] = [];
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0, tries = 0;
        do {
          const sign = rng() > 0.5 ? 1 : -1;
          const axis = rng() > 0.5;
          x = axis ? (fence + rng() * (maxDist - fence)) * sign : (rng() * 2 - 1) * maxDist;
          z = axis ? (rng() * 2 - 1) * maxDist : (fence + rng() * (maxDist - fence)) * sign;
        } while (!isValid(x, z) && ++tries < 200);
        const sv  = 1 + (rng() - 0.5) * scaleVar;
        const rotY = rng() * Math.PI * 2;
        instances.push({ x, z, sv, rotY });
      }

      sharedGLTFLoader.load(path, (gltf) => {
        const tmpl = gltf.scene;
        this._box3.setFromObject(tmpl);
        const baseScale = targetH / Math.max(this._box3.getSize(this._vec3).y, 0.01);
        const groundY   = -this._box3.min.y * baseScale;

        // Compute world matrices for all nodes in the template (at scale 1, at origin).
        tmpl.updateMatrixWorld(true);

        const dummy = new THREE.Object3D();

        // One InstancedMesh per submesh — preserves multi-material models.
        tmpl.traverse(child => {
          if (!(child instanceof THREE.Mesh)) return;
          child.updateWorldMatrix(true, false);

          const instMesh = new THREE.InstancedMesh(child.geometry, child.material, instances.length);
          instMesh.castShadow    = false;
          instMesh.receiveShadow = false;
          instMesh.frustumCulled = true;

          instances.forEach(({ x, z, sv, rotY }, idx) => {
            dummy.position.set(x, groundY * sv - sink, z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.setScalar(baseScale * sv);
            dummy.updateMatrix();
            // Compose: instance world transform × mesh's local transform within template.
            this._tempMatrix.multiplyMatrices(dummy.matrix, child.matrixWorld);
            instMesh.setMatrixAt(idx, this._tempMatrix);
          });

          instMesh.instanceMatrix.needsUpdate = true;
          instMesh.layers.enable(BACKGROUND_FOG_LAYER);
          this.surroundingClones.push(instMesh);
          this.scene.add(instMesh);
        });
      });
    };

    // Trees packed tight in a narrow band just outside the fence.
    // Mobile uses far fewer to keep draw calls and memory manageable.
    const treeCount = mobile ? 30 : 120;
    const pumpkinCount = mobile ? 6 : 20;
    placeInstanced('/models/tree.glb',    treeCount,    fence + 14, 6.0, 0.45, 0.04);
    placeInstanced('/models/tree2.glb',   treeCount,    fence + 14, 6.5, 0.45, 0.04);
    placeInstanced('/models/pumpkin.glb', pumpkinCount, fence + 10, 0.5, 0.4);
  }

  private createMountains(): void {
    let seed = 99;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // Two mountain materials — far peaks slightly lighter so they read against the sky
    const montainTex = sharedTextureLoader.load('/models/montain.png');
    montainTex.colorSpace = THREE.SRGBColorSpace;
    montainTex.wrapS = THREE.RepeatWrapping;
    montainTex.wrapT = THREE.RepeatWrapping;
    montainTex.repeat.set(2, 2);

    // Patch mountain materials: fade alpha based on local-space Y so the base
    // dissolves into the ground instead of cutting against it with a hard edge.
    // Uses position.y (0 = base, ~1 = peak) passed as a varying — avoids any
    // dependency on vUv naming or depthWrite order issues.
    const patchMountainBaseFade = (mat: THREE.MeshStandardMaterial): void => {
      mat.transparent = true;
      const originalKey = mat.customProgramCacheKey.bind(mat);
      mat.customProgramCacheKey = () => `${originalKey()}|mountain-base-fade`;
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = `varying float vMountainY;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vMountainY = position.y;`
        );
        shader.fragmentShader = `varying float vMountainY;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          `vec4 diffuseColor = vec4( diffuse, opacity * smoothstep(0.0, 0.36, vMountainY) );`
        );
      };
    };

    const matNear = new THREE.MeshStandardMaterial({
      map: montainTex,
      color: 0x4a3d55,
      roughness: 1.0,
      metalness: 0.0,
    });
    const matFar = new THREE.MeshStandardMaterial({
      map: montainTex,
      color: 0x6a5a78,
      roughness: 1.0,
      metalness: 0.0,
    });
    patchMountainBaseFade(matNear);
    patchMountainBaseFade(matFar);

    // Instanced cones — 1 draw call per layer
    const createMountainGeometry = (variantSeed: number): THREE.BufferGeometry => {
      let localSeed = variantSeed;
      const localRng = () => {
        localSeed = (localSeed * 16807) % 2147483647;
        return (localSeed - 1) / 2147483646;
      };

      const segments = 14;
      const rings = [
        { y: 0.00, radius: 1.00, wobble: 0.12 },
        { y: 0.18, radius: 0.96, wobble: 0.11 },
        { y: 0.40, radius: 0.76, wobble: 0.12 },
        { y: 0.62, radius: 0.55, wobble: 0.10 },
        { y: 0.80, radius: 0.36, wobble: 0.08 },
        { y: 0.93, radius: 0.22, wobble: 0.05 },
      ];
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      const angleOffsets = Array.from({ length: segments }, (_, i) => {
        const t = i / segments;
        const broad = Math.sin(t * Math.PI * 2 + variantSeed * 0.017) * 0.08;
        return 0.92 + localRng() * 0.18 + broad;
      });
      const summitOffset = new THREE.Vector2((localRng() - 0.5) * 0.12, (localRng() - 0.5) * 0.12);

      rings.forEach((ring, ringIndex) => {
        const ringT = ringIndex / (rings.length - 1);
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          const roughness = 1 + (localRng() - 0.5) * ring.wobble;
          const radius = ring.radius * angleOffsets[i] * roughness;
          const shoulder = Math.sin(angle * 2.0 + variantSeed * 0.01) * 0.025 * (1 - ringT);
          const x = Math.cos(angle) * radius + summitOffset.x * ringT;
          const y = ring.y + shoulder + (localRng() - 0.5) * 0.012 * (1 - ringT);
          const z = Math.sin(angle) * radius + summitOffset.y * ringT;
          positions.push(x, y, z);
          uvs.push(i / segments, ringT * 0.9);
        }
      });

      for (let ring = 0; ring < rings.length - 1; ring++) {
        const current = ring * segments;
        const next = (ring + 1) * segments;
        for (let i = 0; i < segments; i++) {
          const a = current + i;
          const b = current + ((i + 1) % segments);
          const c = next + i;
          const d = next + ((i + 1) % segments);
          indices.push(a, c, b, b, c, d);
        }
      }

      const topRing = (rings.length - 1) * segments;
      let topY = 0;
      for (let i = 0; i < segments; i++) {
        topY += positions[(topRing + i) * 3 + 1];
      }
      topY /= segments;

      const capCenterIndex = positions.length / 3;
      positions.push(summitOffset.x, topY - 0.006, summitOffset.y);
      uvs.push(0.5, 0.86);
      for (let i = 0; i < segments; i++) {
        indices.push(topRing + i, capCenterIndex, topRing + ((i + 1) % segments));
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    const mountainVariants = [
      createMountainGeometry(701),
      createMountainGeometry(907),
      createMountainGeometry(1301),
    ];

    const buildLayer = (
      count: number,
      minDist: number, maxDist: number,
      minH: number, maxH: number,
      minR: number, maxR: number,
      mat: THREE.MeshStandardMaterial
    ) => {
      const perVariant = mountainVariants.map(() => [] as THREE.Matrix4[]);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.65;
        const dist = minDist + rng() * (maxDist - minDist);
        let x = Math.cos(angle) * dist;
        let z = Math.sin(angle) * dist;
        const frontZ = z;
        if (frontZ > 50) {
          x *= 0.97;
          z = Math.max(64, frontZ - 4);
        }
        const entranceViewScale = frontZ > 48 && Math.abs(x) < 24 ? 0.42 : 1;
        const h = (minH + rng() * (maxH - minH)) * entranceViewScale;
        const r = (minR + rng() * (maxR - minR)) * (entranceViewScale < 1 ? 0.62 : 1);
        const stretchX = 0.82 + rng() * 0.42;
        const stretchZ = 0.82 + rng() * 0.42;
        const leanX = (rng() - 0.5) * 0.025;
        const leanZ = (rng() - 0.5) * 0.025;

        dummy.position.set(x, -1, z);
        dummy.scale.set(r * stretchX, h, r * stretchZ);
        dummy.rotation.set(leanX, rng() * Math.PI * 2, leanZ);
        dummy.updateMatrix();
        perVariant[i % mountainVariants.length].push(dummy.matrix.clone());
      }

      mountainVariants.forEach((geo, variantIndex) => {
        const matrices = perVariant[variantIndex];
        if (matrices.length === 0) return;

        const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
        inst.castShadow = false;
        inst.receiveShadow = false;
        inst.frustumCulled = true;
        matrices.forEach((matrix, idx) => inst.setMatrixAt(idx, matrix));
        inst.instanceMatrix.needsUpdate = true;
        inst.layers.enable(BACKGROUND_FOG_LAYER);
        this.scene.add(inst);
      });
    };

    // Close foothills — shorter, dense
    buildLayer(60,  55,  80,  8, 18, 10, 20, matNear);
    // Mid mountains — taller
    buildLayer(40,  75, 105, 18, 28, 14, 28, matFar);
    // Far peaks — tallest, visible above everything
    buildLayer(24, 100, 130, 25, 38, 16, 30, matFar);
  }

  private createExteriorMist(): void {
    const makeMistTexture = (): THREE.CanvasTexture => {
      const cached = this.exteriorMistTexture;
      if (cached) return cached;

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const fallback = new THREE.CanvasTexture(canvas);
        this.exteriorMistTexture = fallback;
        return fallback;
      }

      const gradient = ctx.createRadialGradient(128, 156, 12, 128, 156, 112);
      gradient.addColorStop(0, 'rgba(196,202,224,0.74)');
      gradient.addColorStop(0.28, 'rgba(120,118,148,0.54)');
      gradient.addColorStop(0.58, 'rgba(48,42,68,0.34)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);

      const haze = ctx.createLinearGradient(0, 0, 0, 256);
      haze.addColorStop(0, 'rgba(0,0,0,0)');
      haze.addColorStop(0.48, 'rgba(166,172,202,0.12)');
      haze.addColorStop(0.8, 'rgba(10,8,18,0.24)');
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, 256, 256);
      ctx.globalCompositeOperation = 'source-over';

      for (let i = 0; i < 900; i++) {
        const x = Math.random() * 256;
        const y = 82 + Math.random() * 112;
        const a = Math.random() * 0.035;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.exteriorMistTexture = texture;
      return texture;
    };

    const mistTexture = makeMistTexture();
    const group = new THREE.Group();
    const layers = this.mobile
      ? [
          { scale: [94, 28], opacity: 0.34, y: 7.5 },
          { scale: [128, 38], opacity: 0.24, y: 10.5 },
        ]
      : [
          { scale: [108, 34], opacity: 0.42, y: 8.5 },
          { scale: [148, 44], opacity: 0.28, y: 11.5 },
          { scale: [182, 52], opacity: 0.18, y: 15.5 },
        ];

    const ringPositions = [
      { x: 0, z: -88, ry: 0 },
      { x: 0, z: 88, ry: Math.PI },
      { x: -88, z: 0, ry: Math.PI / 2 },
      { x: 88, z: 0, ry: -Math.PI / 2 },
      { x: -68, z: -68, ry: Math.PI / 4 },
      { x: 68, z: -68, ry: -Math.PI / 4 },
      { x: -68, z: 68, ry: Math.PI * 0.75 },
      { x: 68, z: 68, ry: -Math.PI * 0.75 },
    ];

    ringPositions.forEach((entry, index) => {
      layers.forEach((layer, layerIndex) => {
        const material = new THREE.SpriteMaterial({
          map: mistTexture,
          color: layerIndex === 0 ? 0x7e839e : layerIndex === 1 ? 0x5f5a7a : 0x39334f,
          transparent: true,
          opacity: layer.opacity * (index < 4 ? 1 : 0.92),
          depthWrite: false,
          depthTest: true,
          fog: true,
        });
        material.userData.baseOpacity = material.opacity;
        this.exteriorMistMaterials.push(material);
        const sprite = new THREE.Sprite(material);
        sprite.position.set(entry.x, layer.y, entry.z);
        sprite.scale.set(layer.scale[0], layer.scale[1], 1);
        sprite.renderOrder = 1;
        sprite.layers.enable(BACKGROUND_FOG_LAYER);
        group.add(sprite);
      });
    });

    const groundBanks = this.mobile
      ? [
          { scale: [78, 12], opacity: 0.26, y: 3.2 },
          { scale: [112, 16], opacity: 0.16, y: 4.6 },
        ]
      : [
          { scale: [92, 14], opacity: 0.32, y: 3.0 },
          { scale: [132, 18], opacity: 0.22, y: 4.4 },
          { scale: [164, 22], opacity: 0.12, y: 6.0 },
        ];

    ringPositions.forEach((entry, index) => {
      groundBanks.forEach((bank, bankIndex) => {
        const material = new THREE.SpriteMaterial({
          map: mistTexture,
          color: bankIndex === 0 ? 0x62677f : bankIndex === 1 ? 0x48435f : 0x312b45,
          transparent: true,
          opacity: bank.opacity * (index < 4 ? 1 : 0.82),
          depthWrite: false,
          depthTest: true,
          fog: true,
        });
        material.userData.baseOpacity = material.opacity;
        this.exteriorMistMaterials.push(material);
        const sprite = new THREE.Sprite(material);
        sprite.position.set(entry.x * 0.68, bank.y, entry.z * 0.68);
        sprite.scale.set(bank.scale[0], bank.scale[1], 1);
        sprite.renderOrder = 3;
        sprite.layers.enable(BACKGROUND_FOG_LAYER);
        group.add(sprite);
      });
    });

    const makeGroundFogMaterial = (color: number, opacity: number): THREE.MeshBasicMaterial => {
      const material = new THREE.MeshBasicMaterial({
        map: mistTexture,
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        fog: true,
      });
      this.exteriorGroundFogMaterials.push(material);
      return material;
    };

    const addGroundFogPlane = (
      width: number,
      depth: number,
      x: number,
      z: number,
      color: number,
      opacity: number
    ): void => {
      const geometry = new THREE.PlaneGeometry(width, depth, 1, 1);
      const material = makeGroundFogMaterial(color, opacity);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.16, z);
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      mesh.layers.enable(BACKGROUND_FOG_LAYER);
      group.add(mesh);
    };

    const nearOpacity = this.mobile ? 0.34 : 0.42;
    const farOpacity = this.mobile ? 0.22 : 0.30;
    addGroundFogPlane(112, 24, 0, -55, 0x8e94ad, nearOpacity);
    addGroundFogPlane(112, 24, 0, 55, 0x8e94ad, nearOpacity);
    addGroundFogPlane(24, 112, -55, 0, 0x7f789d, nearOpacity * 0.9);
    addGroundFogPlane(24, 112, 55, 0, 0x7f789d, nearOpacity * 0.9);
    addGroundFogPlane(148, 34, 0, -70, 0x514a68, farOpacity);
    addGroundFogPlane(148, 34, 0, 70, 0x514a68, farOpacity);
    addGroundFogPlane(34, 148, -70, 0, 0x4b4562, farOpacity);
    addGroundFogPlane(34, 148, 70, 0, 0x4b4562, farOpacity);

    this.enableBackgroundFogLayer(group);
    this.exteriorMistGroup = group;
    this.scene.add(group);
  }

  private createForestFloor(): void {
    // Park interior terrain — sits above forest floor but below paths (y=0.05)
    const parkSize = GRID_WIDTH * GRID_SIZE;
    const parkGeo  = new THREE.PlaneGeometry(parkSize, parkSize, 1, 1);
    const terrainTexture = sharedTextureLoader.load('/models/terrain.png');
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;

    terrainTexture.colorSpace = THREE.SRGBColorSpace;
    const parkMat = new THREE.ShaderMaterial({
        uniforms: {
          map:    { value: terrainTexture },
          repeat: { value: new THREE.Vector2(GRID_WIDTH / 4, GRID_HEIGHT / 4) },
          fade:   { value: 0.13 },
          moonTint: { value: new THREE.Color(0x657664) },
          shadowTint: { value: new THREE.Color(0x3d3038) },
          sickTint: { value: new THREE.Color(0x59633d) },
          earthTint: { value: new THREE.Color(0x8b7658) },
          wetTint: { value: new THREE.Color(0x303a3d) }
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          uniform sampler2D map;
          uniform vec2      repeat;
          uniform float     fade;
          uniform vec3      moonTint;
          uniform vec3      shadowTint;
          uniform vec3      sickTint;
          uniform vec3      earthTint;
          uniform vec3      wetTint;
          varying vec2      vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }

          void main() {
            vec2 tiledUv = vUv * repeat;
            vec2 macroUv = vUv * (repeat * 0.48);
            vec2 warpedUv = tiledUv + vec2(
              noise(vUv * 7.0) * 0.16 - 0.08,
              noise(vUv.yx * 7.0 + 13.4) * 0.16 - 0.08
            );
            vec2 warpedUvAlt = tiledUv * 0.73 + vec2(
              noise(vUv * 4.0 + 17.0) * 0.22 - 0.11,
              noise(vUv.yx * 4.4 + 3.7) * 0.22 - 0.11
            );
            vec3 base = texture2D(map, warpedUv).rgb;
            vec3 altBase = texture2D(map, warpedUvAlt + vec2(8.2, 5.4)).rgb;
            vec3 detail = texture2D(map, tiledUv * 1.9 + vec2(4.7, 2.3)).rgb;
            vec3 fineDetail = texture2D(map, tiledUv * 3.4 + vec2(11.6, 7.8)).rgb;

            float macroBreakup = noise(macroUv + vec2(5.0, 11.0));
            float mudBands = smoothstep(0.38, 0.9, noise(vUv * 10.0 + 8.0));
            float rotPatches = smoothstep(0.48, 0.82, noise(vUv * 18.0 + detail.rg * 3.0));
            float coldMist = smoothstep(0.2, 0.85, noise(vUv * 5.0 + vec2(2.0, 9.0)));
            float wetPatches = smoothstep(0.46, 0.86, noise(vUv * 8.0 + vec2(19.0, 4.0)));
            float dryPatches = smoothstep(0.4, 0.8, noise(vUv * 6.0 + vec2(1.0, 15.0)));
            float hoofMarks = smoothstep(0.58, 0.9, noise(vUv * 26.0 + fineDetail.rg * 4.0));

            vec3 terrain = mix(base, altBase, smoothstep(0.3, 0.72, macroBreakup) * 0.45);
            vec3 color = mix(terrain, terrain * moonTint, 0.24);
            color = mix(color, color * 0.78 + earthTint * 0.22, dryPatches * 0.22);
            color = mix(color, color * 0.62 + shadowTint * 0.38, mudBands * 0.5);
            color = mix(color, wetTint, wetPatches * 0.28);
            color = mix(color, sickTint, rotPatches * 0.14);
            color += detail * vec3(0.008, 0.006, 0.007);
            color += fineDetail * vec3(0.005, 0.0035, 0.004);
            color += coldMist * vec3(0.003, 0.004, 0.0045);
            color -= hoofMarks * vec3(0.032, 0.022, 0.015);

            float centerFalloff = distance(vUv, vec2(0.5));
            color *= 1.72;
            color *= 1.0 - smoothstep(0.2, 0.72, centerFalloff) * 0.09;
            color = max(color, vec3(0.0));

            float edgeX = min(vUv.x, 1.0 - vUv.x);
            float edgeZ = min(vUv.y, 1.0 - vUv.y);
            float edge = min(edgeX, edgeZ);
            float feather = smoothstep(0.0, fade, edge);
            float mistStain = 1.0 - feather;
            color = mix(color, vec3(0.42, 0.45, 0.54), mistStain * 0.16);
            color *= 1.0 - mistStain * 0.08;
            gl_FragColor = vec4(color, feather);
          }
        `,
        transparent: true,
        depthWrite: false
      });
    const parkFloor = new THREE.Mesh(parkGeo, parkMat);
    parkFloor.rotation.x = -Math.PI / 2;
    parkFloor.position.y = 0.02;
    parkFloor.receiveShadow = true;
    this.scene.add(parkFloor);

    // Forest floor — covers everything outside the park
    const size = 600;
    const geo  = new THREE.PlaneGeometry(size, size);
    const outsideTex = sharedTextureLoader.load('/models/terrain-outside.png');
    outsideTex.colorSpace = THREE.SRGBColorSpace;
    outsideTex.wrapS = THREE.RepeatWrapping;
    outsideTex.wrapT = THREE.RepeatWrapping;
    outsideTex.repeat.set(30, 30);
    const mat  = new THREE.MeshStandardMaterial({
      map: outsideTex,
      color: 0xb08a65,
      roughness: 1.0,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = false;
    mesh.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(mesh);

  }

  private createGround(): void {
    // Infinite dark base — catches fog at the horizon
    const geo = new THREE.PlaneGeometry(4000, 4000);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0f0914, roughness: 1.0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = false;
    ground.layers.enable(BACKGROUND_FOG_LAYER);
    this.scene.add(ground);
  }

  private createGridLines(): void {
    const gridHelper = new THREE.GridHelper(
      GRID_WIDTH * GRID_SIZE,
      GRID_WIDTH,
      0x4c3852,  // center lines — barely visible violet-gray
      0x322836   // cell lines — subtle shadow tint
    );
    gridHelper.position.y = 0.03;
    (gridHelper.material as THREE.Material).opacity = 0.12;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);
  }

  private createMoon(): void {
    const moonGroup = new THREE.Group();
    const moonPos = new THREE.Vector3(-76, 33, -52);

    const moonTexture = sharedTextureLoader.load('/texture/moon1.png');
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    const moonReliefTexture = sharedTextureLoader.load('/texture/moon2.png');
    moonReliefTexture.colorSpace = THREE.NoColorSpace;

    // Main moon body
    const moonGeo = new THREE.SphereGeometry(9.5, this.mobile ? 40 : 60, this.mobile ? 32 : 60);
    const moonMat = new THREE.MeshPhongMaterial({
      map: moonTexture,
      displacementMap: moonReliefTexture,
      displacementScale: 0.08,
      bumpMap: moonReliefTexture,
      bumpScale: 0.045,
      color: 0xffffff,
      emissive: 0x54607f,
      emissiveIntensity: 0.52,
      shininess: 0,
      reflectivity: 0,
      fog: false,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moon);

    const makeMoonGlowTexture = (): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const glowCtx = canvas.getContext('2d');
      if (glowCtx) {
        const glow = glowCtx.createRadialGradient(238, 224, 8, 256, 256, 250);
        glow.addColorStop(0, 'rgba(236,244,255,0.34)');
        glow.addColorStop(0.14, 'rgba(194,215,255,0.20)');
        glow.addColorStop(0.42, 'rgba(136,158,220,0.075)');
        glow.addColorStop(0.72, 'rgba(78,86,140,0.026)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        glowCtx.fillStyle = glow;
        glowCtx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 140; i++) {
          const x = 256 + (Math.random() - 0.5) * 360;
          const y = 256 + (Math.random() - 0.5) * 300;
          const r = 18 + Math.random() * 76;
          const a = Math.random() * 0.018;
          const smudge = glowCtx.createRadialGradient(x, y, 1, x, y, r);
          smudge.addColorStop(0, `rgba(210,222,255,${a})`);
          smudge.addColorStop(1, 'rgba(0,0,0,0)');
          glowCtx.fillStyle = smudge;
          glowCtx.beginPath();
          glowCtx.arc(x, y, r, 0, Math.PI * 2);
          glowCtx.fill();
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };

    const glowTexture = makeMoonGlowTexture();
    const glowLayers = [
      { scale: [38, 27], opacity: 0.24, color: 0xdce8ff, z: -0.2 },
      { scale: [92, 58], opacity: 0.13, color: 0xb9cbff, z: -0.4 },
      { scale: [156, 90], opacity: 0.05, color: 0x8fa2de, z: -0.6 },
    ];
    glowLayers.forEach(layer => {
      const material = new THREE.SpriteMaterial({
        map: glowTexture,
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        depthTest: false,
        fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(0, 0, layer.z);
      sprite.scale.set(layer.scale[0], layer.scale[1], 1);
      sprite.renderOrder = -3;
      moonGroup.add(sprite);
    });

    // Very subtle local glow; the main moonlight is the directional light.
    const moonSurfaceLight = new THREE.DirectionalLight(0xffffff, 0.92);
    moonSurfaceLight.position.set(-10, 6, 10);
    moonGroup.add(moonSurfaceLight);

    const moonLight = new THREE.PointLight(0xc5d7ff, 0.04, 680);
    moonLight.position.set(0, 0, 0);
    moonGroup.add(moonLight);

    moonGroup.position.copy(moonPos);
    this.scene.add(moonGroup);
  }

  private createRain(): void {
    const mobile = this.mobile;
    const dropCount = mobile ? 90 : 520;
    const areaRadius = mobile ? 46 : 72;
    const topY = mobile ? 34 : 42;
    const bottomY = 1.2;
    const streakLength = mobile ? 0.9 : 1.35;
    const positions = new Float32Array(dropCount * 6);
    const speeds = new Float32Array(dropCount);
    const drift = new Float32Array(dropCount);

    this.rainCenter.set(this.camera.position.x, 0, this.camera.position.z);

    for (let i = 0; i < dropCount; i++) {
      const baseIndex = i * 6;
      const x = this.rainCenter.x + (Math.random() - 0.5) * areaRadius * 2;
      const y = bottomY + Math.random() * (topY - bottomY);
      const z = this.rainCenter.z + (Math.random() - 0.5) * areaRadius * 2;
      positions[baseIndex] = x;
      positions[baseIndex + 1] = y;
      positions[baseIndex + 2] = z;
      positions[baseIndex + 3] = x + 0.03;
      positions[baseIndex + 4] = y - streakLength;
      positions[baseIndex + 5] = z + 0.08;
      speeds[i] = mobile ? 15 + Math.random() * 7 : 18 + Math.random() * 9;
      drift[i] = 0.12 + Math.random() * 0.1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x5d6b82,
      transparent: true,
      opacity: mobile ? 0.18 : 0.22,
      depthWrite: false
    });

    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;

    this.rainGeometry = geometry;
    this.rainMaterial = material;
    this.rainLines = lines;
    this.rainPositions = positions;
    this.rainSpeeds = speeds;
    this.rainDrift = drift;
    this.scene.add(lines);
  }

  private createLightning(): void {
    const mobile = this.mobile;
    this.lightningTimer = 4 + Math.random() * 6;

    const light = new THREE.PointLight(0xdde9ff, mobile ? 0 : 0, 220);
    light.position.set(0, 28, 0);
    this.lightningLight = light;
    this.scene.add(light);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xeaf2ff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    const bolt = new THREE.LineSegments(geometry, material);
    bolt.frustumCulled = false;
    bolt.visible = false;

    this.lightningGeometry = geometry;
    this.lightningMaterial = material;
    this.lightningBolt = bolt;
    this.scene.add(bolt);
  }

  private triggerLightning(): void {
    if (!this.lightningLight || !this.lightningGeometry || !this.lightningMaterial || !this.lightningBolt) return;

    const mobile = this.mobile;
    const startX = this.camera.position.x + (Math.random() - 0.5) * 90;
    const startZ = this.camera.position.z - 30 - Math.random() * 80;
    const topY = 34 + Math.random() * 10;
    const bottomY = 4 + Math.random() * 8;

    const segments: number[] = [];
    let x = startX;
    let y = topY;
    let z = startZ;
    const branchCount = 6 + Math.floor(Math.random() * 4);

    for (let i = 0; i < branchCount; i++) {
      const nextX = x + (Math.random() - 0.5) * 5.5;
      const nextY = i === branchCount - 1 ? bottomY : y - (3.8 + Math.random() * 3.4);
      const nextZ = z + (Math.random() - 0.5) * 4.5;
      segments.push(x, y, z, nextX, nextY, nextZ);
      x = nextX;
      y = nextY;
      z = nextZ;
    }

    this.lightningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    this.lightningGeometry.computeBoundingSphere();

    this.lightningBolt.visible = true;
    this.lightningMaterial.opacity = mobile ? 0.55 : 0.72;
    this.lightningLight.position.set(startX, topY - 4, startZ);
    this.lightningLight.intensity = mobile ? 1.8 : 2.6;
    this.lightningFlashTimer = 0.18 + Math.random() * 0.12;
    this.lightningTimer = 6 + Math.random() * 10;
    this.lightningTriggered = true;
  }

  public forceLightning(): void {
    this.triggerLightning();
  }

  public consumeLightningTrigger(): boolean {
    if (!this.lightningTriggered) return false;
    this.lightningTriggered = false;
    return true;
  }

  public updateWeather(deltaTime: number): void {
    const mobile = this.mobile;
    if (this.exteriorMistGroup) {
      const now = performance.now();
      const sway = Math.sin(now * 0.00012) * 1.4;
      this.exteriorMistGroup.position.x = sway;
      this.exteriorMistGroup.position.z = Math.cos(now * 0.0001) * 1.0;
      this.exteriorMistMaterials.forEach((material, index) => {
        const baseOpacity = typeof material.userData.baseOpacity === 'number' ? material.userData.baseOpacity : material.opacity;
        material.opacity = THREE.MathUtils.clamp(
          baseOpacity * (0.96 + Math.sin(now * 0.00022 + index * 0.71) * 0.08),
          0.08,
          0.42
        );
      });
    }

    if (this.rainGeometry && this.rainPositions && this.rainSpeeds && this.rainDrift) {
      const areaRadius = mobile ? 46 : 72;
      const topY = mobile ? 34 : 42;
      const bottomY = 1.2;
      const streakLength = mobile ? 0.9 : 1.35;
      const rainStep = mobile ? 1 / 12 : 1 / 36;

      this.rainUpdateAccumulator += deltaTime;
      if (this.rainUpdateAccumulator >= rainStep) {
        const stepDelta = this.rainUpdateAccumulator;
        this.rainUpdateAccumulator = 0;

        this.rainCenter.x = this.camera.position.x;
        this.rainCenter.z = this.camera.position.z;

        for (let i = 0; i < this.rainSpeeds.length; i++) {
          const baseIndex = i * 6;
          let x = this.rainPositions[baseIndex];
          let y = this.rainPositions[baseIndex + 1];
          let z = this.rainPositions[baseIndex + 2];

          y -= this.rainSpeeds[i] * stepDelta;
          x += this.rainDrift[i] * stepDelta;
          z += this.rainDrift[i] * 0.35 * stepDelta;

          const outOfBounds =
            y < bottomY ||
            Math.abs(x - this.rainCenter.x) > areaRadius ||
            Math.abs(z - this.rainCenter.z) > areaRadius;

          if (outOfBounds) {
            x = this.rainCenter.x + (Math.random() - 0.5) * areaRadius * 2;
            y = topY + Math.random() * 8;
            z = this.rainCenter.z + (Math.random() - 0.5) * areaRadius * 2;
          }

          this.rainPositions[baseIndex] = x;
          this.rainPositions[baseIndex + 1] = y;
          this.rainPositions[baseIndex + 2] = z;
          this.rainPositions[baseIndex + 3] = x + 0.03;
          this.rainPositions[baseIndex + 4] = y - streakLength;
          this.rainPositions[baseIndex + 5] = z + 0.08;
        }

        const positionAttr = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute;
        positionAttr.needsUpdate = true;
      }
    }

    this.lightningTimer -= deltaTime;
    if (this.lightningTimer <= 0 && this.lightningFlashTimer <= 0) {
      this.triggerLightning();
    }

    if (this.lightningFlashTimer > 0 && this.lightningLight && this.lightningMaterial && this.lightningBolt) {
      this.lightningFlashTimer -= deltaTime;
      const t = Math.max(0, this.lightningFlashTimer);
      const flash = Math.min(1, t / 0.12);
      const flicker = 0.55 + Math.random() * 0.45;
      this.lightningLight.intensity = (mobile ? 1.8 : 2.6) * flash * flicker;
      this.ambientLight.intensity = this.baseAmbientIntensity + (mobile ? 0.07 : 0.11) * flash;
      this.hemisphereLight.intensity = this.baseHemisphereIntensity + (mobile ? 0.08 : 0.14) * flash;
      this.directionalLight.intensity = this.baseDirectionalIntensity + (mobile ? 0.18 : 0.28) * flash;
      this.lightningMaterial.opacity = (mobile ? 0.5 : 0.68) * flash;
      this.lightningBolt.visible = this.lightningMaterial.opacity > 0.03;

      if (this.lightningFlashTimer <= 0) {
        this.lightningLight.intensity = 0;
        this.ambientLight.intensity = this.baseAmbientIntensity;
        this.hemisphereLight.intensity = this.baseHemisphereIntensity;
        this.directionalLight.intensity = this.baseDirectionalIntensity;
        this.lightningMaterial.opacity = 0;
        this.lightningBolt.visible = false;
      }
    }
  }

  public updateRetroOverlay(deltaTime: number): void {
    this.retroOverlay?.update(deltaTime);
  }

  public updateShadowFrustum(targetX: number, targetZ: number): boolean {
    // No-op on mobile — shadows are disabled, nothing to update.
    if (this.mobile) return false;
    if (
      Math.abs(targetX - this.lastShadowTargetX) < 0.01 &&
      Math.abs(targetZ - this.lastShadowTargetZ) < 0.01
    ) {
      return false;
    }
    this.lastShadowTargetX = targetX;
    this.lastShadowTargetZ = targetZ;
    this.directionalLight.target.position.set(targetX, 0, targetZ);
    this.directionalLight.target.updateMatrixWorld();
    this.directionalLight.shadow.camera.updateProjectionMatrix();
    return true;
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.retroOverlay?.onWindowResize();
  }

  public dispose(): void {
    this.deferredTimers.forEach(timer => window.clearTimeout(timer));
    this.deferredTimers.length = 0;
    this.retroOverlay?.dispose();
    if (this.rainLines) this.scene.remove(this.rainLines);
    if (this.lightningBolt) this.scene.remove(this.lightningBolt);
    if (this.lightningLight) this.scene.remove(this.lightningLight);
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();
    this.lightningGeometry?.dispose();
    this.lightningMaterial?.dispose();
    this.exteriorMistTexture?.dispose();
    if (this.exteriorMistGroup) {
      this.exteriorMistGroup.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      this.scene.remove(this.exteriorMistGroup);
    }
    this.exteriorMistMaterials.forEach(material => material.dispose());
    this.exteriorGroundFogMaterials.forEach(material => material.dispose());
    this.rainGeometry = null;
    this.rainMaterial = null;
    this.rainLines = null;
    this.rainPositions = null;
    this.rainSpeeds = null;
    this.rainDrift = null;
    this.lightningGeometry = null;
    this.lightningMaterial = null;
    this.lightningBolt = null;
    this.lightningLight = null;
    this.exteriorMistTexture = null;
    this.exteriorMistGroup = null;
    this.exteriorMistMaterials = [];
    this.exteriorGroundFogMaterials = [];

    for (const obj of this.surroundingClones) {
      this.scene.remove(obj);
      // surroundingClones now holds InstancedMesh objects directly (not containers),
      // so we dispose geometry/material on the object itself, not via traverse.
      if (obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    }
    this.surroundingClones.length = 0;
  }
}
