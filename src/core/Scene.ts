import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GRID_WIDTH, GRID_HEIGHT, GRID_SIZE } from '../utils/GridHelper';

const gltfLoader = new GLTFLoader();

function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

export class GameScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x150b24);
    if (!isMobile()) {
      this.scene.fog = new THREE.Fog(0x150b24, 80, 250);
    }

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(40, 50, 40);
    this.camera.lookAt(0, 0, 0);

    // Neutral but dim ambient light to keep object textures looking natural
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    this.scene.add(this.ambientLight);

    // Cool pale moonlight to cast shadows without washing out textures
    this.directionalLight = new THREE.DirectionalLight(0xddeeff, 0.7); 
    this.directionalLight.position.set(20, 100, 40); // Slightly more vertical to prevent overly stretched shadows
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.left = -100;
    this.directionalLight.shadow.camera.right = 100;
    this.directionalLight.shadow.camera.top = 100;
    this.directionalLight.shadow.camera.bottom = -100;
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.bias = -0.0001;
    this.scene.add(this.directionalLight);

    this.createGround();
    this.createGridLines();
    this.createEntranceGate();
  }

  private createEntranceGate(): void {
    gltfLoader.load('/models/entrance.glb', (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = 8; // Width to span across the double path
      const scale = maxDim > 0 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());

      model.position.x -= center.x;
      model.position.x += -1; // Align exactly between the 2 path lanes (-2 and 0)
      
      model.position.z -= center.z;
      model.position.z += 48; // Exactly matches worldZ for gridZ=49

      model.position.y -= scaledBox.min.y;
      model.position.y += 0.1; // Lift above the path mesh to prevent clipping

      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(model);
    });
  }

  private createGround(): void {
    const playableSize = Math.max(GRID_WIDTH, GRID_HEIGHT) * GRID_SIZE;
    const infiniteMultiplier = 20;
    const groundSize = playableSize * infiniteMultiplier;
    
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
    
    const textureLoader = new THREE.TextureLoader();
    const terrainTexture = textureLoader.load('/models/terrain.png');
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set((GRID_WIDTH / 2) * infiniteMultiplier, (GRID_HEIGHT / 2) * infiniteMultiplier);

    const groundMaterial = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createGridLines(): void {
    const gridHelper = new THREE.GridHelper(
      GRID_WIDTH * GRID_SIZE,
      GRID_WIDTH,
      0x2a1040,  // center lines — dark purple
      0x1a0830   // cell lines  — barely visible
    );
    gridHelper.position.y = 0.01; // just above ground to avoid z-fighting
    (gridHelper.material as THREE.Material).opacity = 0.35;
    (gridHelper.material as THREE.Material).transparent = true;
    this.scene.add(gridHelper);
  }

  public onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
