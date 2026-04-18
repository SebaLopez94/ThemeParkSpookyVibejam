import * as THREE from 'three';
import { GRID_WIDTH, GRID_HEIGHT, GRID_SIZE } from '../utils/GridHelper';
import { sharedGLTFLoader } from './AssetLoader';
import { isMobile } from '../utils/platform';

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  public hemisphereLight: THREE.HemisphereLight;
  private textureLoader = new THREE.TextureLoader();
  private surroundingClones: THREE.Object3D[] = [];


  constructor() {
    const mobile = isMobile();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x130b1d);
    if (!mobile) {
      this.scene.fog = new THREE.Fog(0x130b1d, 70, 210);
    }

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(40, 50, 40);
    this.camera.lookAt(0, 0, 0);

    // Dark global fill so the park stays readable without flattening all shadows.
    this.ambientLight = new THREE.AmbientLight(0x7c88a8, mobile ? 0.34 : 0.3);
    this.scene.add(this.ambientLight);

    // Subtle sky/ground split keeps tops cool and undersides slightly earthy.
    this.hemisphereLight = new THREE.HemisphereLight(0x5d6f96, 0x241712, mobile ? 0.42 : 0.48);
    this.scene.add(this.hemisphereLight);

    // Cool moon key light for silhouettes and shadow shape.
    this.directionalLight = new THREE.DirectionalLight(0xc6d7ff, mobile ? 0.82 : 0.95);
    this.directionalLight.position.set(32, 88, 18);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.bias = -0.00015;
    this.directionalLight.shadow.normalBias = 0.03;
    this.scene.add(this.directionalLight);

    this.createGround();
    this.createForestFloor();
    this.createMountains();
    this.createGridLines();
    this.createEntranceGate();
    this.createPerimeterFence();
    this.createSurroundings();
    this.createMoon();
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
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
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
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    const fence = (GRID_WIDTH * GRID_SIZE) / 2 + 4; // 54

    const isValid = (x: number, z: number) =>
      (Math.abs(x) >= fence || Math.abs(z) >= fence) && // outside fence
      !(Math.abs(x) < 4 && z > fence);                  // only clear the path gap

    const placeClones = (path: string, count: number, maxDist: number, targetH: number, scaleVar: number) => {
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
          clone.position.set(x, gy * sv, z);
          clone.rotation.y = rng() * Math.PI * 2;
          clone.traverse(c => {
            if (c instanceof THREE.Mesh) { c.castShadow = false; c.receiveShadow = false; }
          });
          this.surroundingClones.push(clone);
          this.scene.add(clone);
        }
      });
    };

    // Trees packed tight in a narrow band just outside the fence
    placeClones('/models/tree.glb',    120, fence + 14, 6.0, 0.45);
    placeClones('/models/tree2.glb',   120, fence + 14, 6.5, 0.45);
    placeClones('/models/pumpkin.glb',  20, fence + 10, 0.5, 0.4);
  }

  private createMountains(): void {
    let seed = 99;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // Two mountain materials — far peaks slightly lighter so they read against the sky
    const montainTex = this.textureLoader.load('/models/montain.png');
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
    const terrainTexture = this.textureLoader.load('/models/terrain.png');
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    const parkMat = new THREE.ShaderMaterial({
      uniforms: {
        map:    { value: terrainTexture },
        repeat: { value: new THREE.Vector2(GRID_WIDTH / 4, GRID_HEIGHT / 4) },
        fade:   { value: 0.03 },
        moonTint: { value: new THREE.Color(0x3a4d43) },
        shadowTint: { value: new THREE.Color(0x1a1021) },
        sickTint: { value: new THREE.Color(0x4d5a2a) }
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
          vec2 warpedUv = tiledUv + vec2(
            noise(vUv * 7.0) * 0.16 - 0.08,
            noise(vUv.yx * 7.0 + 13.4) * 0.16 - 0.08
          );
          vec3 base = texture2D(map, warpedUv).rgb;
          vec3 detail = texture2D(map, tiledUv * 1.9 + vec2(4.7, 2.3)).rgb;

          float mudBands = smoothstep(0.35, 0.9, noise(vUv * 10.0 + 8.0));
          float rotPatches = smoothstep(0.48, 0.82, noise(vUv * 18.0 + detail.rg * 3.0));
          float coldMist = smoothstep(0.2, 0.85, noise(vUv * 5.0 + vec2(2.0, 9.0)));

          vec3 color = mix(base, base * moonTint, 0.42);
          color = mix(color, color * 0.72 + shadowTint * 0.28, mudBands * 0.55);
          color = mix(color, sickTint, rotPatches * 0.22);
          color += detail * vec3(0.05, 0.035, 0.06);
          color += coldMist * vec3(0.015, 0.02, 0.03);

          float centerFalloff = distance(vUv, vec2(0.5));
          color *= 1.0 - smoothstep(0.22, 0.72, centerFalloff) * 0.18;

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
    const outsideTex = this.textureLoader.load('/models/terrain-outside.png');
    outsideTex.wrapS = THREE.RepeatWrapping;
    outsideTex.wrapT = THREE.RepeatWrapping;
    outsideTex.repeat.set(30, 30);
    const mat  = new THREE.MeshStandardMaterial({
      map: outsideTex,
      color: 0xb7a898,
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
    const moonLight = new THREE.PointLight(0xc8d8ff, 0.18, 900);
    moonLight.position.set(0, 0, 0); 
    moonGroup.add(moonLight);

    moonGroup.position.copy(moonPos);
    this.scene.add(moonGroup);
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
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
