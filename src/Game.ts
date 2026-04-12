import * as THREE from 'three';
import { GameLoop } from './core/GameLoop';
import { GameRenderer } from './core/Renderer';
import { GameScene } from './core/Scene';
import { CameraController } from './input/CameraController';
import { MouseController } from './input/MouseController';
import { ChallengeSystem } from './systems/ChallengeSystem';
import { BuildingSystem } from './systems/BuildingSystem';
import { EconomySystem } from './systems/EconomySystem';
import { PathfindingSystem } from './systems/PathfindingSystem';
import { ResearchSystem } from './systems/ResearchSystem';
import { VisitorSystem } from './systems/VisitorSystem';
import { GridHelper, GRID_SIZE } from './utils/GridHelper';
import { sharedGLTFLoader } from './core/AssetLoader';
import {
  BUILDING_DISPLAY,
  BuildingDefinition,
  BuildingType,
  ChallengeState,
  DecorationType,
  EconomyState,
  GridPosition,
  PlaceableBuildingKind,
  ResearchNode,
  ResearchState,
  RideType,
  RIDE_SIZES,
  SelectedBuildingInfo,
  ServiceType,
  ShopType
} from './types';

export class Game {
  private scene: GameScene;
  private renderer: GameRenderer;
  private gameLoop: GameLoop;
  private buildingSystem: BuildingSystem;
  private economySystem: EconomySystem;
  private pathfindingSystem: PathfindingSystem;
  private visitorSystem: VisitorSystem;
  private researchSystem: ResearchSystem;
  private challengeSystem: ChallengeSystem;
  private mouseController: MouseController;
  private cameraController: CameraController;
  private audioListener: THREE.AudioListener;
  private backgroundMusic: THREE.Audio;
  private windAudio: THREE.Audio;
  private nightAudio: THREE.Audio;
  private nextWindTime = 0;
  private isMuted = false;

  // Preview group holds both the footprint indicator and the GLB ghost model
  private previewGroup: THREE.Group | null = null;
  private previewFloorMesh: THREE.Mesh | null = null;
  private previewEdges: THREE.LineSegments | null = null;
  private previewModelMeshes: THREE.Mesh[] = [];
  // Persistent materials — created once, never disposed between placements
  private readonly previewGreenMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88, transparent: true, opacity: 0.28,
    emissive: 0x00ff88, emissiveIntensity: 0.15, depthWrite: false
  });
  private readonly previewRedMat = new THREE.MeshStandardMaterial({
    color: 0xff3355, transparent: true, opacity: 0.28,
    emissive: 0xff3355, emissiveIntensity: 0.15, depthWrite: false
  });
  private readonly previewEdgeGreenMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
  private readonly previewEdgeRedMat  = new THREE.LineBasicMaterial({ color: 0xff3355 });
  private previewWidth = 1;
  private previewHeight = 1;

  private static readonly MODEL_PATHS: Partial<Record<string, string>> = {
    [RideType.CAROUSEL]:         '/models/carusel.glb',
    [RideType.FERRIS_WHEEL]:     '/models/noria.glb',
    [RideType.ROLLER_COASTER]:   '/models/rusa.glb',
    [RideType.HAUNTED_HOUSE]:    '/models/house.glb',
    [ShopType.FOOD_STALL]:       '/models/food.glb',
    [ShopType.DRINK_STAND]:      '/models/drinks.glb',
    [ShopType.GIFT_SHOP]:        '/models/gift.glb',
    [ServiceType.RESTROOM]:      '/models/wc.glb',
  };

  private hoveredGridPosition: GridPosition | null = null;
  private selectedBuilding: BuildingDefinition | null = null;
  private buildRotation = 0;
  private ratingUpdateTimer = 0;
  private readonly RATING_UPDATE_INTERVAL = 1;

  public onEconomyUpdate: ((state: EconomyState) => void) | null = null;
  public onBuildingSelected: ((info: SelectedBuildingInfo | null) => void) | null = null;
  public onBuildCancel: (() => void) | null = null;
  public onRotationChange: ((deg: number) => void) | null = null;
  public onResearchUpdate: ((state: ResearchState) => void) | null = null;
  public onChallengesUpdate: ((state: ChallengeState[]) => void) | null = null;
  public onChallengeCompleted: ((challenge: ChallengeState) => void) | null = null;

  private resizeHandler = (): void => {
    this.scene.onWindowResize();
    this.renderer.onWindowResize();
  };

  constructor(container: HTMLElement) {
    this.scene = new GameScene();
    this.renderer = new GameRenderer(container);
    this.gameLoop = new GameLoop(deltaTime => this.update(deltaTime), () => this.render());

    this.pathfindingSystem = new PathfindingSystem();
    this.buildingSystem = new BuildingSystem(this.scene.scene, this.pathfindingSystem);
    this.economySystem = new EconomySystem();
    this.visitorSystem = new VisitorSystem(this.scene.scene, this.pathfindingSystem);
    this.researchSystem = new ResearchSystem();
    this.challengeSystem = new ChallengeSystem();

    this.visitorSystem.onVisitorSpawn = () => this.economySystem.addVisitor();
    this.visitorSystem.onVisitorLeave = () => this.economySystem.removeVisitor();
    this.visitorSystem.onVisitorSpend = amount => this.economySystem.addMoney(amount);

    this.mouseController = new MouseController(this.scene.camera, this.renderer.renderer.domElement);
    this.cameraController = new CameraController(this.scene.camera);

    this.audioListener = new THREE.AudioListener();
    this.scene.camera.add(this.audioListener);
    this.backgroundMusic = new THREE.Audio(this.audioListener);
    this.windAudio = new THREE.Audio(this.audioListener);
    this.nightAudio = new THREE.Audio(this.audioListener);
    this.loadAudio();

    this.renderer.initPostProcessing(this.scene.scene, this.scene.camera);
    this.setupMouseControls();
    this.setupWindowResize();
    this.setupAudioResume();
    this.initializeEntrance();

    this.economySystem.subscribe(state => this.onEconomyUpdate?.(state));
    this.researchSystem.subscribe(state => this.onResearchUpdate?.(state));
    this.challengeSystem.subscribe(state => this.onChallengesUpdate?.(state));
  }

  private initializeEntrance(): void {
    // Only pre-place 2 rows of path at the grid bottom edge — rest of the grid is freely buildable
    for (let z = 23; z <= 24; z++) {
      this.buildingSystem.placePath({ x: 12, z });
      this.buildingSystem.placePath({ x: 13, z });
    }
    this.visitorSystem.setEntrancePosition({ x: 12, z: 24 });
  }

  private loadAudio(): void {
    const audioLoader = new THREE.AudioLoader();

    const tryPlay = (audio: THREE.Audio, volume: number, loop: boolean) => {
      audio.setLoop(loop);
      audio.setVolume(this.isMuted ? 0 : volume);
      if (this.audioListener.context.state === 'running') {
        audio.play();
      }
      // If context is still suspended the setupAudioResume handler will start it on first interaction
    };

    audioLoader.load('/audio/main_song.mp3', (buffer) => {
      this.backgroundMusic.setBuffer(buffer);
      tryPlay(this.backgroundMusic, 0.12, true);
    });

    audioLoader.load('/audio/wind.mp3', (buffer) => {
      this.windAudio.setBuffer(buffer);
      this.windAudio.setVolume(this.isMuted ? 0 : 0.06);
      this.nextWindTime = Math.random() * 15 + 10;
    });

    audioLoader.load('/audio/night.mp3', (buffer) => {
      this.nightAudio.setBuffer(buffer);
      tryPlay(this.nightAudio, 0.04, true);
    });
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.backgroundMusic) {
      this.backgroundMusic.setVolume(muted ? 0 : 0.12);
    }
    if (this.windAudio) {
      this.windAudio.setVolume(muted ? 0 : 0.06);
    }
    if (this.nightAudio) {
      this.nightAudio.setVolume(muted ? 0 : 0.04);
    }
  }

  private setupAudioResume(): void {
    const resumeAudio = () => {
      const ctx = this.audioListener.context;
      const startAudio = () => {
        if (this.backgroundMusic.buffer && !this.backgroundMusic.isPlaying) {
          this.backgroundMusic.play();
        }
        if (this.nightAudio.buffer && !this.nightAudio.isPlaying) {
          this.nightAudio.play();
        }
        // Keep listeners alive until both are actually playing (buffers may not be loaded yet)
        const bgReady = !this.backgroundMusic.buffer || this.backgroundMusic.isPlaying;
        const nightReady = !this.nightAudio.buffer || this.nightAudio.isPlaying;
        if (bgReady && nightReady) {
          window.removeEventListener('click', resumeAudio);
          window.removeEventListener('keydown', resumeAudio);
          window.removeEventListener('touchstart', resumeAudio);
        }
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(startAudio);
      } else {
        startAudio();
      }
    };

    window.addEventListener('click', resumeAudio);
    window.addEventListener('keydown', resumeAudio);
    window.addEventListener('touchstart', resumeAudio);
  }

  private setupMouseControls(): void {
    this.mouseController.onCameraMove = delta => this.cameraController.pan(delta);
    this.mouseController.onCameraZoom = delta => this.cameraController.zoom(delta);
    this.mouseController.onRightClick = () => {
      if (!this.selectedBuilding) return false;
      this.cancelBuildMode();
      this.onBuildCancel?.();
      return true;
    };
    this.mouseController.onGridHover = position => {
      this.hoveredGridPosition = position;
      this.updatePreview();
    };
    this.mouseController.onGridClick = position => this.handleGridClick(position);
    this.mouseController.onGridDrag = position => {
      if (this.selectedBuilding?.type === BuildingType.PATH) {
        this.handleGridClick(position);
      }
    };
  }

  private keyHandler = (event: KeyboardEvent): void => {
    if ((event.key === 'r' || event.key === 'R') && this.selectedBuilding) {
      this.rotateBuild(1);
    }
  };

  private rotateBuild(direction: number): void {
    this.buildRotation = (this.buildRotation + direction * Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    this.onRotationChange?.(Math.round(this.buildRotation * 180 / Math.PI));
    this.updatePreview();
  }

  private setupWindowResize(): void {
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('keydown', this.keyHandler);
  }

  private handleGridClick(position: GridPosition): void {
    if (this.selectedBuilding) {
      if (this.selectedBuilding.type === BuildingType.DELETE) {
        this.deleteBuilding(position);
      } else {
        this.placeBuilding(position);
      }
      return;
    }

    const result = this.buildingSystem.getBuildingAtCell(position);
    if (!result) return;

    if ('ride' in result) {
      const { id, rideType, price, cost, position: buildingPosition } = result.ride.data;
      const display = BUILDING_DISPLAY[rideType];
      this.onBuildingSelected?.({
        id,
        buildingType: BuildingType.RIDE,
        subType: rideType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost
      });
      return;
    }

    if ('shop' in result) {
      const { id, shopType, price, cost, position: buildingPosition } = result.shop.data;
      const display = BUILDING_DISPLAY[shopType];
      this.onBuildingSelected?.({
        id,
        buildingType: BuildingType.SHOP,
        subType: shopType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost
      });
      return;
    }

    if ('service' in result) {
      const { id, serviceType, price, cost, position: buildingPosition } = result.service.data;
      const display = BUILDING_DISPLAY[serviceType];
      this.onBuildingSelected?.({
        id,
        buildingType: BuildingType.SERVICE,
        subType: serviceType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost
      });
      return;
    }

    const { id, decorationType, cost, position: buildingPosition } = result.decoration.data;
    const display = BUILDING_DISPLAY[decorationType];
    this.onBuildingSelected?.({
      id,
      buildingType: BuildingType.DECORATION,
      subType: decorationType,
      name: display.name,
      icon: display.icon,
      position: buildingPosition,
      currentPrice: null,
      buildCost: cost
    });
  }

  private placeBuilding(position: GridPosition): void {
    if (!this.selectedBuilding) return;

    const canPlace = this.buildingSystem.canPlaceBuilding(
      position,
      this.selectedBuilding.type,
      this.selectedBuilding.subType as PlaceableBuildingKind | undefined
    );

    if (!canPlace || !this.economySystem.canAfford(this.selectedBuilding.cost)) return;

    let success = false;

    switch (this.selectedBuilding.type) {
      case BuildingType.PATH:
        success = this.buildingSystem.placePath(position) !== null;
        break;
      case BuildingType.RIDE:
        success = this.placeTypedBuilding(this.selectedBuilding.subType as RideType, type => this.buildingSystem.placeRide(position, type));
        break;
      case BuildingType.SHOP:
        success = this.placeTypedBuilding(this.selectedBuilding.subType as ShopType, type => this.buildingSystem.placeShop(position, type));
        break;
      case BuildingType.SERVICE:
        success = this.placeTypedBuilding(this.selectedBuilding.subType as ServiceType, type => this.buildingSystem.placeService(position, type));
        break;
      case BuildingType.DECORATION:
        success = this.placeTypedBuilding(this.selectedBuilding.subType as DecorationType, type => this.buildingSystem.placeDecoration(position, type));
        break;
    }

    if (success) {
      this.economySystem.spendMoney(this.selectedBuilding.cost);
    }
  }

  private placeTypedBuilding<T extends PlaceableBuildingKind>(
    type: T,
    place: (kind: T) => { mesh: THREE.Object3D } | null
  ): boolean {
    const placed = place(type);
    if (!placed) return false;
    placed.mesh.rotation.y = this.buildRotation;
    return true;
  }

  public deleteBuilding(position: GridPosition): void {
    const result = this.buildingSystem.getBuildingAtCell(position);
    let cost = 1;
    if (result) {
      if ('ride' in result) cost = result.ride.data.cost;
      if ('shop' in result) cost = result.shop.data.cost;
      if ('service' in result) cost = result.service.data.cost;
      if ('decoration' in result) cost = result.decoration.data.cost;
    }

    if (!this.buildingSystem.removeBuilding(position)) return;

    const refund = cost <= 1 ? 1 : Math.floor(cost * 0.5);
    this.economySystem.addMoney(refund);
    this.onBuildingSelected?.(null);
    this.showFloatingText(`+$${refund}`, position, '#22c55e');
  }

  private showFloatingText(text: string, gridPos: GridPosition, color: string): void {
    const worldPos = GridHelper.gridToWorld(gridPos);
    const vector = new THREE.Vector3(worldPos.x, 2, worldPos.z);
    vector.project(this.scene.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    const element = document.createElement('div');
    element.textContent = text;
    element.style.position = 'absolute';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.color = color;
    element.style.fontWeight = 'bold';
    element.style.fontSize = '24px';
    element.style.textShadow = '0 2px 4px rgba(0,0,0,0.5), 0 0 2px rgba(0,0,0,1)';
    element.style.pointerEvents = 'none';
    element.style.transform = 'translate(-50%, -50%)';
    element.style.transition = 'all 1.5s ease-out';
    element.style.zIndex = '1000';

    this.renderer.renderer.domElement.parentElement?.appendChild(element);
    void element.offsetWidth;
    element.style.top = `${y - 60}px`;
    element.style.opacity = '0';

    setTimeout(() => element.remove(), 1500);
  }

  public startMoveBuilding(info: SelectedBuildingInfo): void {
    this.buildingSystem.removeBuilding(info.position);
    this.economySystem.addMoney(info.buildCost);
    this.onBuildingSelected?.(null);
    this.selectBuilding({
      type: info.buildingType,
      subType: info.subType,
      name: info.name,
      description: '',
      cost: info.buildCost,
      icon: info.icon
    });
  }

  public updateBuildingPrice(position: GridPosition, newPrice: number): void {
    this.buildingSystem.updateBuildingPrice(position, newPrice);
  }

  public setTicketPrice(price: number): void {
    this.economySystem.setTicketPrice(price);
  }

  public setParkOpen(isOpen: boolean): void {
    this.economySystem.setParkOpen(isOpen);
  }

  public getResearchNodes(): ResearchNode[] {
    return this.researchSystem.getNodes();
  }

  public canStartResearch(id: string): boolean {
    return this.researchSystem.canStartResearch(id);
  }

  public startResearch(id: string): boolean {
    const node = this.researchSystem.getNodes().find(item => item.id === id);
    if (!node || !this.researchSystem.canStartResearch(id) || !this.economySystem.canAfford(node.cost)) {
      return false;
    }

    if (!this.economySystem.spendMoney(node.cost)) return false;
    this.researchSystem.startResearch(id);
    return true;
  }

  private getBuildingFootprint(definition: BuildingDefinition): { width: number; height: number } {
    if (definition.type === BuildingType.RIDE && definition.subType) {
      return RIDE_SIZES[definition.subType as RideType];
    }
    return { width: 1, height: 1 };
  }

  private createPreviewMesh(): void {
    this.disposePreview();
    if (!this.selectedBuilding) return;

    const { width, height } = this.getBuildingFootprint(this.selectedBuilding);
    this.previewWidth = width;
    this.previewHeight = height;

    this.previewGroup = new THREE.Group();
    this.previewGroup.visible = false;

    // Thin footprint slab (floor indicator)
    const footprintGeo = new THREE.BoxGeometry(width * GRID_SIZE - 0.15, 0.08, height * GRID_SIZE - 0.15);
    this.previewFloorMesh = new THREE.Mesh(footprintGeo, this.previewGreenMat);
    this.previewFloorMesh.position.y = 0.04;
    this.previewGroup.add(this.previewFloorMesh);

    const edgeGeo = new THREE.EdgesGeometry(footprintGeo);
    this.previewEdges = new THREE.LineSegments(edgeGeo, this.previewEdgeGreenMat);
    this.previewFloorMesh.add(this.previewEdges);

    this.scene.scene.add(this.previewGroup);

    // Load ghost model asynchronously (if available for this building type)
    this.loadPreviewModel(width, height);
  }

  private loadPreviewModel(footprintW: number, footprintH: number): void {
    const subType = this.selectedBuilding?.subType as string | undefined;
    const path = subType ? Game.MODEL_PATHS[subType] : undefined;
    if (!path) return;

    const token = this.previewGroup; // capture to detect stale loads

    sharedGLTFLoader.load(path, (gltf) => {
      // Discard if a new preview was created while loading
      if (this.previewGroup !== token || !this.previewGroup) return;

      const model = gltf.scene;

      // Scale to fit footprint
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.z);
      const targetSize = Math.max(footprintW, footprintH) * GRID_SIZE * 0.88;
      const scale = maxDim > 0.01 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      // Ground-align + centre on XZ
      const scaled = new THREE.Box3().setFromObject(model);
      const center = scaled.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaled.min.y;

      // Ghost tinted material — semi-transparent, coloured by validity
      this.previewModelMeshes = [];
      model.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.material = new THREE.MeshBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        });
        child.frustumCulled = false;
        this.previewModelMeshes.push(child);
      });

      this.previewGroup!.add(model);
    });
  }

  private updatePreview(): void {
    if (!this.previewGroup) return;
    if (!this.selectedBuilding || !this.hoveredGridPosition) {
      this.previewGroup.visible = false;
      return;
    }

    let isValid = false;
    if (this.selectedBuilding.type !== BuildingType.DELETE) {
      isValid = this.buildingSystem.canPlaceBuilding(
        this.hoveredGridPosition,
        this.selectedBuilding.type,
        this.selectedBuilding.subType as PlaceableBuildingKind | undefined
      ) && this.economySystem.canAfford(this.selectedBuilding.cost);
    }

    // Update footprint slab + edges
    if (this.previewFloorMesh) {
      this.previewFloorMesh.material = isValid ? this.previewGreenMat! : this.previewRedMat!;
    }
    if (this.previewEdges) {
      this.previewEdges.material = isValid ? this.previewEdgeGreenMat! : this.previewEdgeRedMat!;
    }

    // Update ghost model tint
    const tint = isValid ? 0x00ff88 : 0xff3355;
    this.previewModelMeshes.forEach(mesh => {
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(tint);
    });

    const worldPos = GridHelper.gridToWorld(this.hoveredGridPosition);
    this.previewGroup.position.set(
      worldPos.x + (this.previewWidth - 1) * GRID_SIZE / 2,
      0,
      worldPos.z + (this.previewHeight - 1) * GRID_SIZE / 2
    );
    this.previewGroup.rotation.y = this.buildRotation;
    this.previewGroup.visible = true;
  }

  private disposePreview(): void {
    if (!this.previewGroup) return;
    this.scene.scene.remove(this.previewGroup);
    this.previewGroup.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        // Only dispose ghost model materials (not the persistent preview mats)
        const isPreviewMat = (m: THREE.Material) =>
          m === this.previewGreenMat || m === this.previewRedMat ||
          m === this.previewEdgeGreenMat || m === this.previewEdgeRedMat;
        if (Array.isArray(child.material)) {
          child.material.forEach(m => { if (!isPreviewMat(m)) m.dispose(); });
        } else {
          if (!isPreviewMat(child.material as THREE.Material))
            (child.material as THREE.Material).dispose();
        }
      }
    });
    this.previewGroup = null;
    this.previewFloorMesh = null;
    this.previewEdges = null;
    this.previewModelMeshes = [];
  }

  public selectBuilding(definition: BuildingDefinition): void {
    this.selectedBuilding = definition;
    this.buildRotation = 0;
    this.onRotationChange?.(0);
    this.mouseController.onBuildRotate = dir => this.rotateBuild(dir);
    this.createPreviewMesh();
    this.updatePreview();
  }

  public cancelBuildMode(): void {
    this.selectedBuilding = null;
    this.mouseController.onBuildRotate = null;
    this.disposePreview();
  }

  public canAfford(cost: number): boolean {
    return this.economySystem.canAfford(cost);
  }

  private update(deltaTime: number): void {
    this.buildingSystem.update(deltaTime);
    this.visitorSystem.update(deltaTime, {
      rides: this.buildingSystem.getRides(),
      shops: this.buildingSystem.getShops(),
      services: this.buildingSystem.getServices(),
      decorations: this.buildingSystem.getDecorations(),
      getLocalDecorationBonus: position => this.buildingSystem.getLocalDecorationBonus(position),
      isOpen: this.economySystem.getState().isOpen
    });

    const unlocked = this.researchSystem.update(deltaTime);
    if (unlocked.length > 0) {
      this.showFloatingText('Research complete!', { x: 24, z: 47 }, '#facc15');
    }

    // Occasional Wind logic
    if (this.windAudio.buffer && !this.isMuted) {
      this.nextWindTime -= deltaTime;
      if (this.nextWindTime <= 0) {
        if (!this.windAudio.isPlaying) {
          this.windAudio.play();
        }
        this.nextWindTime = Math.random() * 30 + 30; // Next wind in 30-60s
      }
    }

    this.ratingUpdateTimer += deltaTime;
    if (this.ratingUpdateTimer >= this.RATING_UPDATE_INTERVAL) {
      this.ratingUpdateTimer = 0;
      this.economySystem.updateParkRating(
        this.visitorSystem.getAverageHappiness(),
        this.buildingSystem.getFacilityScore(),
        this.buildingSystem.getDecorationAppeal()
      );

      // Recurring maintenance costs per second
      const counts = this.buildingSystem.getBuildingCounts();
      const maintenance =
        counts[BuildingType.RIDE]    * 2 +
        counts[BuildingType.SHOP]    * 1 +
        counts[BuildingType.SERVICE] * 1;
      if (maintenance > 0) this.economySystem.chargeMaintenance(maintenance);
      const completed = this.challengeSystem.update(this.RATING_UPDATE_INTERVAL, {
        totalVisitors: this.economySystem.getState().totalVisitors,
        averageHappiness: this.visitorSystem.getAverageHappiness(),
        netProfit: this.economySystem.getState().netProfit,
        parkRating: this.economySystem.getState().parkRating,
        buildingCounts: counts,
        serviceAndDecorationCount: counts[BuildingType.SERVICE] + counts[BuildingType.DECORATION],
        rideCount: counts[BuildingType.RIDE],
        shopCount: counts[BuildingType.SHOP]
      });

      completed.forEach(challenge => {
        const claimed = this.challengeSystem.claimReward(challenge.id);
        if (!claimed) return;
        if (claimed.reward.money > 0) {
          this.economySystem.addMoney(claimed.reward.money);
        }
        if (claimed.reward.rating > 0) {
          const state = this.economySystem.getState();
          this.economySystem.updateParkRating(
            Math.min(100, state.averageHappiness + claimed.reward.rating),
            this.buildingSystem.getFacilityScore(),
            this.buildingSystem.getDecorationAppeal() + claimed.reward.rating
          );
        }
        this.showFloatingText(`Challenge +$${claimed.reward.money}`, { x: 24, z: 46 }, '#bef264');
        this.onChallengeCompleted?.(claimed);
      });
    }
  }

  private render(): void {
    this.renderer.render(this.scene.scene, this.scene.camera);
  }

  public start(): void {
    this.gameLoop.start();
  }

  public stop(): void {
    this.gameLoop.stop();
  }

  public dispose(): void {
    this.gameLoop.stop();
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keyHandler);
    this.mouseController.dispose();
    this.disposePreview();
    this.previewGreenMat.dispose();
    this.previewRedMat.dispose();
    this.previewEdgeGreenMat.dispose();
    this.previewEdgeRedMat.dispose();
    this.buildingSystem.clear();
    this.visitorSystem.clear();
    this.scene.dispose();
    this.renderer.dispose();
    if (this.backgroundMusic.isPlaying) this.backgroundMusic.stop();
    this.scene.camera.remove(this.audioListener);
  }
}
