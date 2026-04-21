import * as THREE from 'three';
import { GRID_WIDTH, GRID_HEIGHT, GRID_SIZE } from '../utils/GridHelper';
import { sharedGLTFLoader, sharedTextureLoader } from './AssetLoader';
import { isMobile } from '../utils/platform';

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  public hemisphereLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;
  private surroundingClones: THREE.Object3D[] = [];
  private readonly baseAmbientIntensity: number;
  private readonly baseHemisphereIntensity: number;
  private readonly baseDirectionalIntensity: number;
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.LineBasicMaterial | null = null;
  private rainLines: THREE.LineSegments | null = null;
  private rainPositions: Float32Array | null = null;
  private rainSpeeds: Float32Array | null = null;
  private rainDrift: Float32Array | null = null;
  private rainCenter = new THREE.Vector3();
  private rainUpdateAccumulator = 0;
  private lightningLight: THREE.PointLight | null = null;
  private lightningGeometry: THREE.BufferGeometry | null = null;
  private lightningMaterial: THREE.LineBasicMaterial | null = null;
  private lightningBolt: THREE.LineSegments | null = null;
  private lightningTimer = 0;
  private lightningFlashTimer = 0;
  private lightningTriggered = false;


  constructor() {
    const mobile = isMobile();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x130b1d);
    this.scene.fog = new THREE.Fog(0x120b19, mobile ? 62 : 50, mobile ? 165 : 185);

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
    this.ambientLight = new THREE.AmbientLight(0x66738f, mobile ? 0.50 : 0.44);
    this.baseAmbientIntensity = this.ambientLight.intensity;
    this.scene.add(this.ambientLight);

    // Subtle sky/ground split keeps tops cool and undersides slightly earthy.
    this.hemisphereLight = new THREE.HemisphereLight(0x52658d, 0x1d120d, mobile ? 0.55 : 0.62);
    this.baseHemisphereIntensity = this.hemisphereLight.intensity;
    this.scene.add(this.hemisphereLight);

    // Cool moon key light for silhouettes and shadow shape.
    this.directionalLight = new THREE.DirectionalLight(0xbfd2ff, mobile ? 1.00 : 1.15);
    this.baseDirectionalIntensity = this.directionalLight.intensity;
    this.directionalLight.position.set(38, 92, 14);
    this.directionalLight.castShadow = true;
    // Tight frustum (±32 world units) centred on shadow target — 3× better texel density
    // than the old ±100. Target is updated each frame via updateShadowFrustum().
    this.directionalLight.shadow.camera.left = -32;
    this.directionalLight.shadow.camera.right = 32;
    this.directionalLight.shadow.camera.top = 32;
    this.directionalLight.shadow.camera.bottom = -32;
    this.directionalLight.shadow.mapSize.width = mobile ? 256 : 1024;
    this.directionalLight.shadow.mapSize.height = mobile ? 256 : 1024;
    this.directionalLight.shadow.bias = -0.00015;
    this.directionalLight.shadow.normalBias = 0.03;
    // Target must be in the scene for position updates to take effect.
    this.scene.add(this.directionalLight);
    this.scene.add(this.directionalLight.target);

    // Soft purple fill from the opposite side — reduces harsh unlit faces without
    // flattening the scene. No shadow casting: zero cost.
    this.fillLight = new THREE.DirectionalLight(0x4a2255, mobile ? 0.14 : 0.18);
    this.fillLight.position.set(-38, 30, -14);
    this.fillLight.castShadow = false;
    this.scene.add(this.fillLight);

    this.createGround();
    this.createForestFloor();
    this.createMountains();
    this.createGridLines();
    this.createEntranceGate();
    this.createPerimeterFence();
    this.createSurroundings();
    this.createMoon();
    this.createRain();
    this.createLightning();
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

      // Place OUTSIDE the grid — grid bottom edge is world Z=50, gate sits just beyond it
      model.position.z -= center.z;
      model.position.z += 27;

      model.position.y -= scaledBox.min.y;

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

      this.scene.add(model);
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

    const mat = new THREE.MeshStandardMaterial({ color: 0x0e0a06, roughness: 0.85, metalness: 0.3 });

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
    const postMesh = new THREE.InstancedMesh(postGeo, mat, postPositions.length);
    postMesh.castShadow = false;
    const dummy = new THREE.Object3D();
    postPositions.forEach(([x, z], i) => {
      dummy.position.set(x, postH / 2, z);
      dummy.updateMatrix();
      postMesh.setMatrixAt(i, dummy.matrix);
    });
    postMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(postMesh);

    // Spike tips on every post
    const spikeGeo = new THREE.ConeGeometry(postW * 0.9, spikeH, 4);
    const spikeMesh = new THREE.InstancedMesh(spikeGeo, mat, postPositions.length);
    spikeMesh.castShadow = false;
    postPositions.forEach(([x, z], i) => {
      dummy.position.set(x, postH + spikeH / 2, z);
      dummy.rotation.set(0, Math.PI / 4, 0);
      dummy.updateMatrix();
      spikeMesh.setMatrixAt(i, dummy.matrix);
    });
    spikeMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(spikeMesh);

    // --- Rails (thin horizontal bars per side) ---
    const addRailSpan = (x1: number, z1: number, x2: number, z2: number) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz); // rotation around Y
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const railGeo = new THREE.BoxGeometry(railD, railH, len);
      for (const yFrac of [0.28, 0.72]) {
        const rail = new THREE.Mesh(railGeo, mat);
        rail.position.set(cx, postH * yFrac, cz);
        rail.rotation.y = angle;
        rail.castShadow = false;
        this.scene.add(rail);
      }
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
  }

  private createSurroundings(): void {
    const mobile = isMobile();
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const fence = (GRID_WIDTH * GRID_SIZE) / 2 + 4; // 54

    const isValid = (x: number, z: number) =>
      (Math.abs(x) >= fence || Math.abs(z) >= fence) && // outside fence
      !(Math.abs(x) < 4 && z > fence);                  // only clear the path gap

    const placeClones = (path: string, count: number, maxDist: number, targetH: number, scaleVar: number, sink = 0) => {
      sharedGLTFLoader.load(path, (gltf) => {
        const tmpl = gltf.scene;
        const box  = new THREE.Box3().setFromObject(tmpl);
        const s    = targetH / Math.max(box.getSize(new THREE.Vector3()).y, 0.01);
        const gy   = -box.min.y * s;

        for (let i = 0; i < count; i++) {
          let x: number, z: number, tries = 0;
          do {
            // Bias positions toward the fence — sample in [fence, maxDist] per axis
            const sign = rng() > 0.5 ? 1 : -1;
            const axis = rng() > 0.5; // true = vary X, false = vary Z
            x = axis ? (fence + rng() * (maxDist - fence)) * sign : (rng() * 2 - 1) * maxDist;
            z = axis ? (rng() * 2 - 1) * maxDist : (fence + rng() * (maxDist - fence)) * sign;
          } while (!isValid(x, z) && ++tries < 200);

          const clone = tmpl.clone(true);
          const sv = 1 + (rng() - 0.5) * scaleVar;
          clone.scale.setScalar(s * sv);
          clone.position.set(x, gy * sv - sink, z);
          clone.rotation.y = rng() * Math.PI * 2;
          clone.traverse(c => {
            if (c instanceof THREE.Mesh) { c.castShadow = false; c.receiveShadow = false; }
          });
          this.surroundingClones.push(clone);
          this.scene.add(clone);
        }
      });
    };

    // Trees packed tight in a narrow band just outside the fence.
    // Mobile uses far fewer to keep draw calls and memory manageable.
    const treeCount = mobile ? 30 : 120;
    const pumpkinCount = mobile ? 6 : 20;
    placeClones('/models/tree.glb',    treeCount,    fence + 14, 6.0, 0.45, 0.04);
    placeClones('/models/tree2.glb',   treeCount,    fence + 14, 6.5, 0.45, 0.04);
    placeClones('/models/pumpkin.glb', pumpkinCount, fence + 10, 0.5, 0.4);
  }

  private createMountains(): void {
    let seed = 99;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // Two mountain materials — far peaks slightly lighter so they read against the sky
    const montainTex = sharedTextureLoader.load('/models/montain.png');
    montainTex.wrapS = THREE.RepeatWrapping;
    montainTex.wrapT = THREE.RepeatWrapping;
    montainTex.repeat.set(2, 2);

    const matNear = new THREE.MeshStandardMaterial({ map: montainTex, color: 0x4a3d55, roughness: 1.0, metalness: 0.0, flatShading: true });
    const matFar  = new THREE.MeshStandardMaterial({ map: montainTex, color: 0x6a5a78, roughness: 1.0, metalness: 0.0, flatShading: true });

    // Instanced cones — 1 draw call per layer
    const buildLayer = (
      count: number,
      minDist: number, maxDist: number,
      minH: number, maxH: number,
      minR: number, maxR: number,
      mat: THREE.MeshStandardMaterial
    ) => {
      const geo  = new THREE.CylinderGeometry(0.05, 1, 1, 6); // unit cylinder (truncated cone)
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = false;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rng() * 0.4;
        const dist  = minDist + rng() * (maxDist - minDist);
        const x     = Math.cos(angle) * dist;
        const z     = Math.sin(angle) * dist;
        const h     = minH + rng() * (maxH - minH);
        const r     = minR + rng() * (maxR - minR);

        dummy.position.set(x, h * 0.5 - 1, z);
        dummy.scale.set(r, h, r);
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.scene.add(inst);
    };

    // Close foothills — shorter, dense
    buildLayer(60,  55,  80,  8, 18, 10, 20, matNear);
    // Mid mountains — taller
    buildLayer(40,  75, 105, 18, 28, 14, 28, matFar);
    // Far peaks — tallest, visible above everything
    buildLayer(24, 100, 130, 25, 38, 16, 30, matFar);
  }

  private createForestFloor(): void {
    // Park interior terrain — sits above forest floor but below paths (y=0.05)
    const parkSize = GRID_WIDTH * GRID_SIZE;
    const parkGeo  = new THREE.PlaneGeometry(parkSize, parkSize, 1, 1);
    const terrainTexture = sharedTextureLoader.load('/models/terrain.png');
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    const parkMat = new THREE.ShaderMaterial({
      uniforms: {
        map:    { value: terrainTexture },
        repeat: { value: new THREE.Vector2(GRID_WIDTH / 4, GRID_HEIGHT / 4) },
        fade:   { value: 0.03 },
        moonTint: { value: new THREE.Color(0x58664f) },
        shadowTint: { value: new THREE.Color(0x33272a) },
        sickTint: { value: new THREE.Color(0x4b5532) },
        earthTint: { value: new THREE.Color(0x7b684e) },
        wetTint: { value: new THREE.Color(0x252b2d) }
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
          vec3 color = mix(terrain, terrain * moonTint, 0.48);
          color = mix(color, color * 0.78 + earthTint * 0.22, dryPatches * 0.22);
          color = mix(color, color * 0.62 + shadowTint * 0.38, mudBands * 0.5);
          color = mix(color, wetTint, wetPatches * 0.28);
          color = mix(color, sickTint, rotPatches * 0.14);
          color += detail * vec3(0.008, 0.006, 0.007);
          color += fineDetail * vec3(0.005, 0.0035, 0.004);
          color += coldMist * vec3(0.003, 0.004, 0.0045);
          color -= hoofMarks * vec3(0.032, 0.022, 0.015);

          float centerFalloff = distance(vUv, vec2(0.5));
          color *= 0.97;
          color *= 1.0 - smoothstep(0.2, 0.72, centerFalloff) * 0.14;
          color = clamp(color, vec3(0.0), vec3(1.0));

          float fx = smoothstep(0.0, fade, vUv.x) * smoothstep(1.0, 1.0 - fade, vUv.x);
          float fz = smoothstep(0.0, fade, vUv.y) * smoothstep(1.0, 1.0 - fade, vUv.y);
          gl_FragColor = vec4(color, fx * fz);
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
    outsideTex.wrapS = THREE.RepeatWrapping;
    outsideTex.wrapT = THREE.RepeatWrapping;
    outsideTex.repeat.set(30, 30);
    const mat  = new THREE.MeshStandardMaterial({
      map: outsideTex,
      color: 0x72543b,
      roughness: 1.0,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = false;
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
    this.scene.add(ground);
  }

  private createGridLines(): void {
    const gridHelper = new THREE.GridHelper(
      GRID_WIDTH * GRID_SIZE,
      GRID_WIDTH,
      0x9060cc,  // center lines — visible purple
      0x5a3090   // cell lines — medium purple
    );
    gridHelper.position.y = 0.03;
    (gridHelper.material as THREE.Material).opacity = 0.55;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);
  }

  private createMoon(): void {
    const moonGroup = new THREE.Group();
    const moonPos = new THREE.Vector3(-108, 28, -38);

    // Main moon body
    const moonGeo = new THREE.SphereGeometry(7, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ 
      color: 0xf3f6ff,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moon);

    // Three layers of halo for a very diffuse look
    const haloSizes = [11, 26, 54];
    const haloOpacities = [0.1, 0.045, 0.018];
    haloSizes.forEach((size, i) => {
      const geo = new THREE.SphereGeometry(size, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xc7dcff,
        transparent: true,
        opacity: haloOpacities[i],
        depthWrite: false
      });
      moonGroup.add(new THREE.Mesh(geo, mat));
    });

    // Extremely diffuse and subtle light source
    const moonLight = new THREE.PointLight(0xb9ccff, 0.14, 900);
    moonLight.position.set(0, 0, 0); 
    moonGroup.add(moonLight);

    moonGroup.position.copy(moonPos);
    this.scene.add(moonGroup);
  }

  private createRain(): void {
    const mobile = isMobile();
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
    const mobile = isMobile();
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

    const mobile = isMobile();
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

  public consumeLightningTrigger(): boolean {
    if (!this.lightningTriggered) return false;
    this.lightningTriggered = false;
    return true;
  }

  public updateWeather(deltaTime: number): void {
    const mobile = isMobile();
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

  public updateShadowFrustum(targetX: number, targetZ: number): void {
    this.directionalLight.target.position.set(targetX, 0, targetZ);
    this.directionalLight.target.updateMatrixWorld();
    this.directionalLight.shadow.camera.updateProjectionMatrix();
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    if (this.rainLines) this.scene.remove(this.rainLines);
    if (this.lightningBolt) this.scene.remove(this.lightningBolt);
    if (this.lightningLight) this.scene.remove(this.lightningLight);
    this.rainGeometry?.dispose();
    this.rainMaterial?.dispose();
    this.lightningGeometry?.dispose();
    this.lightningMaterial?.dispose();
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

    for (const clone of this.surroundingClones) {
      this.scene.remove(clone);
      clone.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) {
            c.material.forEach(m => m.dispose());
          } else {
            c.material.dispose();
          }
        }
      });
    }
    this.surroundingClones.length = 0;
  }
}
