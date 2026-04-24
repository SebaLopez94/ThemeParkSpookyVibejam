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
import { isMobile } from './utils/platform';
import { EventBus } from './utils/EventBus';
import { loadBuildingGLTF, gameLoadingManager, sharedAudioLoader } from './core/AssetLoader';
import { lanternPool } from './utils/LanternPool';
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
  SaveGameData,
  SavedBuildingsData,
  SavedDecorationEntry,
  SavedEconomyData,
  SavedPathEntry,
  SavedRideEntry,
  SavedServiceEntry,
  SavedShopEntry,
  SelectedBuildingInfo,
  ServiceType,
  ShopType
} from './types';

interface AudioTrack {
  audio: THREE.Audio;
  baseVolume: number;
  loop: boolean;
}

export interface GameEvents {
  economyUpdate: EconomyState;
  buildingSelected: SelectedBuildingInfo | null;
  buildCancel: void;
  buildingPlaced: void;
  rotationChange: number;
  researchUpdate: ResearchState;
  challengesUpdate: ChallengeState[];
  challengeCompleted: ChallengeState;
  assetsProgress: number;
  /** Fires once when all queued startup assets complete. */
  assetsLoaded: void;
}

export class Game {
  private static readonly SAVE_VERSION = 1;
  private static readonly DEFAULT_ENTRANCE_PATH_COUNT = 14;
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
  private readonly audioListener: THREE.AudioListener;
  private readonly loopTracks: AudioTrack[] = [];
  private readonly windTrack: { audio: THREE.Audio; baseVolume: number; nextTime: number };
  private readonly ambience1Track: { audio: THREE.Audio; baseVolume: number; nextTime: number };
  private readonly ambience2Track: { audio: THREE.Audio; baseVolume: number; nextTime: number };
  private readonly thunderTrack: { audio: THREE.Audio; baseVolume: number; nextTime: number };
  private readonly challengeTrack: { audio: THREE.Audio; baseVolume: number };
  private readonly buildTrack: { audio: THREE.Audio; baseVolume: number };
  private isMuted = false;
  private readonly audioResumeEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'touchstart', 'touchend', 'pointerdown'];
  private readonly audioResumeHandler = (): void => {
    void this.ensureAudioRunning();
  };

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
    [RideType.PIRATE_SHIP]:      '/models/pirate_ship.glb',
    [RideType.KRAKEN_RIDE]:      '/models/kraken.glb',
    [RideType.INFERNAL_TOWER]:   '/models/infernal_tower.glb',
    [ShopType.FOOD_STALL]:       '/models/food.glb',
    [ShopType.DRINK_STAND]:      '/models/drinks.glb',
    [ShopType.GIFT_SHOP]:        '/models/gift.glb',
    [ServiceType.RESTROOM]:      '/models/wc.glb',
    [DecorationType.SKELETON_DECORATION]: '/models/skeleton_decoration.glb',
    [DecorationType.FRANKENSTEIN_DECORATION]: '/models/frankenstein_decoration.glb',
    [DecorationType.LANTERN]: '/models/lantern.glb',
    [DecorationType.TRASH_CUBE]: '/models/trash_cube.glb',
  };

  private static readonly PREVIEW_TARGET_SIZES: Partial<Record<string, number>> = {
    [DecorationType.SPOOKY_TREE]: GRID_SIZE * 1.35,
    [DecorationType.STONE]: GRID_SIZE * 0.9,
    [DecorationType.PUMPKIN]: GRID_SIZE * 0.7,
    [DecorationType.SKELETON_DECORATION]: GRID_SIZE * 0.95,
    [DecorationType.FRANKENSTEIN_DECORATION]: GRID_SIZE * 1.0,
    [DecorationType.LANTERN]: GRID_SIZE * 1.0,
    [DecorationType.TRASH_CUBE]: GRID_SIZE * 0.82,
  };

  private hoveredGridPosition: GridPosition | null = null;
  private selectedBuilding: BuildingDefinition | null = null;
  private movingBuilding: SelectedBuildingInfo | null = null;
  private buildRotation = 0;
  private ratingUpdateTimer = 0;
  private maintenanceUpdateTimer = 0;
  private challengeRewardTimer = 0;
  private readonly challengeRewardQueue: string[] = [];
  private readonly RATING_UPDATE_INTERVAL = 1;
  private readonly MAINTENANCE_UPDATE_INTERVAL = 20;
  private readonly CHALLENGE_REWARD_SPACING = 4.25;
  /**
   * Shadow map throttle — re-render shadow map every N frames instead of every frame.
   * The shadow camera still follows the player camera each frame (updateShadowFrustum),
   * so 1-frame-old shadows are indistinguishable at 60fps.
   * Building changes call renderer.invalidateShadowMap() for an immediate update.
   */
  private shadowFrameCounter = 0;
  private static readonly SHADOW_EVERY_N_FRAMES = 2;

  /** Reused every frame — avoids allocating a new object literal on every update tick. */
  private readonly simulationEntities = {
    rides: [] as ReturnType<BuildingSystem['getRides']>,
    shops: [] as ReturnType<BuildingSystem['getShops']>,
    services: [] as ReturnType<BuildingSystem['getServices']>,
    decorations: [] as ReturnType<BuildingSystem['getDecorations']>,
    getLocalDecorationBonus: (_pos: GridPosition) => 0,
    getLocalHygieneBonus: (_pos: GridPosition) => 0,
    isOpen: false,
    ticketPrice: 0,
    parkRating: 0,
  };

  // Selection highlight (shown when BuildingPanel is open)
  private selectionHighlight: THREE.Group | null = null;
  private selectionHighlightFill: THREE.Mesh | null = null;
  private selectionHighlightTime = 0;
  private readonly selectionFillMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide
  });
  private readonly selectionEdgeMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });

  public readonly events = new EventBus<GameEvents>();

  /** True once the first assetsLoaded has fired, to suppress repeated fires. */
  private assetsReadyFired = false;

  private resizeHandler = (): void => {
    this.scene.onWindowResize();
    this.renderer.onWindowResize();
  };

  constructor(container: HTMLElement) {
    this.scene = new GameScene();
    // Init lantern pool immediately after scene so all 20 PointLights are added
    // before the first render — shader compiles once at startup, never again.
    lanternPool.init(this.scene.scene);
    this.renderer = new GameRenderer(container);
    // Cap mobile to ~30 fps — halves simulation + render work without affecting
    // gameplay (all motion uses deltaTime).  Desktop runs uncapped.
    this.gameLoop = new GameLoop(
      deltaTime => this.update(deltaTime),
      () => this.render(),
      isMobile() ? 1000 / 30 : 0
    );

    this.pathfindingSystem = new PathfindingSystem();
    this.buildingSystem = new BuildingSystem(this.scene.scene, this.pathfindingSystem);
    this.economySystem = new EconomySystem();
    this.visitorSystem = new VisitorSystem(this.scene.scene, this.pathfindingSystem);
    this.researchSystem = new ResearchSystem();
    this.challengeSystem = new ChallengeSystem();

    this.visitorSystem.onVisitorSpawn = () => this.economySystem.addVisitor();
    this.visitorSystem.onVisitorRestoreSpawn = () => this.economySystem.addRestoredVisitor();
    this.visitorSystem.onVisitorLeave = () => this.economySystem.removeVisitor();
    this.visitorSystem.onVisitorSpend = amount => this.economySystem.addMoney(amount);

    // Wire up stable function references for simulationEntities — set once, reused every frame.
    this.simulationEntities.getLocalDecorationBonus = pos => this.buildingSystem.getLocalDecorationBonus(pos);
    this.simulationEntities.getLocalHygieneBonus = pos => this.buildingSystem.getLocalHygieneBonus(pos);

    this.mouseController = new MouseController(this.scene.camera, this.renderer.renderer.domElement);
    this.cameraController = new CameraController(this.scene.camera);

    this.audioListener = new THREE.AudioListener();
    this.scene.camera.add(this.audioListener);

    const makeAudio = () => new THREE.Audio(this.audioListener);
    this.loopTracks = [
      { audio: makeAudio(), baseVolume: 0.12, loop: true },  // background music
      { audio: makeAudio(), baseVolume: 0.04, loop: true },  // night ambience
      { audio: makeAudio(), baseVolume: 0.06, loop: true }, // rain ambience
    ];
    this.windTrack    = { audio: makeAudio(), baseVolume: 0.06, nextTime: Math.random() * 15 + 10 };
    this.ambience1Track = { audio: makeAudio(), baseVolume: 0.09, nextTime: Math.random() * 10 + 12 };
    this.ambience2Track = { audio: makeAudio(), baseVolume: 0.08, nextTime: Math.random() * 14 + 20 };
    this.thunderTrack = { audio: makeAudio(), baseVolume: 0.085, nextTime: Math.random() * 16 + 18 };
    this.challengeTrack = { audio: makeAudio(), baseVolume: 0.14 };
    this.buildTrack = { audio: makeAudio(), baseVolume: 0.16 };
    this.loadAudio();

    this.setupMouseControls();
    this.setupWindowResize();
    this.setupAudioResume();
    this.initializeEntrance();

    this.economySystem.subscribe(state => this.events.emit('economyUpdate', state));
    this.researchSystem.subscribe(state => this.events.emit('researchUpdate', state));
    this.challengeSystem.subscribe(state => this.events.emit('challengesUpdate', state));

    gameLoadingManager.onStart = () => {
      this.events.emit('assetsProgress', 0);
    };
    gameLoadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      const progress = itemsTotal > 0 ? Math.min(1, itemsLoaded / itemsTotal) : 0;
      this.events.emit('assetsProgress', progress);
    };

    // Fire assetsLoaded once when all queued startup assets drain.
    // Subsequent fires (e.g. late visitor loads) are suppressed via the flag.
    gameLoadingManager.onLoad = () => {
      if (this.assetsReadyFired) return;
      this.assetsReadyFired = true;
      this.events.emit('assetsProgress', 1);
      this.events.emit('assetsLoaded', undefined as void);
    };

  }

  private initializeEntrance(): void {
    // Extend the path further into the park instead of just the edge
    for (let z = 18; z <= 24; z++) {
      this.buildingSystem.placePath({ x: 12, z });
      this.buildingSystem.placePath({ x: 13, z });
    }
    this.visitorSystem.setEntrancePosition({ x: 12, z: 24 });
    this.renderer.invalidateShadowMap();
  }

  private loadAudio(): void {
    const filePaths = ['/audio/main_song.mp3', '/audio/night.mp3', '/audio/rain.mp3'];

    filePaths.forEach((path, i) => {
      const track = this.loopTracks[i];
      sharedAudioLoader.load(path, buffer => {
        track.audio.setBuffer(buffer);
        track.audio.setLoop(true);
        track.audio.setVolume(this.isMuted ? 0 : track.baseVolume);
        if (this.audioListener.context.state === 'running') {
          track.audio.play();
        }
      });
    });

    const loadOneShot = (path: string, track: { audio: THREE.Audio; baseVolume: number }) => {
      sharedAudioLoader.load(path, buffer => {
        track.audio.setBuffer(buffer);
        track.audio.setLoop(false);
        track.audio.setVolume(this.isMuted ? 0 : track.baseVolume);
      });
    };

    loadOneShot('/audio/wind.mp3', this.windTrack);
    loadOneShot('/audio/ambience1.mp3', this.ambience1Track);
    loadOneShot('/audio/ambience2.mp3', this.ambience2Track);
    loadOneShot('/audio/thunder.mp3', this.thunderTrack);
    loadOneShot('/audio/challenges.mp3', this.challengeTrack);
    loadOneShot('/audio/build.mp3', this.buildTrack);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;

    for (const track of this.loopTracks) {
      track.audio.setVolume(muted ? 0 : track.baseVolume);
    }
    for (const oneShot of [this.windTrack, this.ambience1Track, this.ambience2Track, this.thunderTrack]) {
      oneShot.audio.setVolume(muted ? 0 : oneShot.baseVolume);
    }
    for (const oneShot of [this.challengeTrack, this.buildTrack]) {
      oneShot.audio.setVolume(muted ? 0 : oneShot.baseVolume);
    }

    if (!muted) void this.ensureAudioRunning();
  }

  private async ensureAudioRunning(): Promise<void> {
    const ctx = this.audioListener.context;
    if (ctx.state !== 'running') {
      try { await ctx.resume(); } catch { return; }
    }

    if (this.isMuted) return;

    const tryStart = (audio: THREE.Audio): void => {
      if (!audio.buffer || audio.isPlaying) return;
      try { audio.play(); } catch { /* mobile may reject before next gesture */ }
    };

    for (const track of this.loopTracks) tryStart(track.audio);

    const allLoopReady = this.loopTracks.every(t => !t.audio.buffer || t.audio.isPlaying);
    if (allLoopReady) this.teardownAudioResume();
  }

  private tickOneShotAudio(
    track: { audio: THREE.Audio; nextTime: number },
    deltaTime: number,
    [minInterval, spread]: [number, number]
  ): void {
    if (!track.audio.buffer || this.isMuted) return;
    track.nextTime -= deltaTime;
    if (track.nextTime <= 0) {
      if (!track.audio.isPlaying && this.audioListener.context.state === 'running') {
        track.audio.play();
      }
      track.nextTime = minInterval + Math.random() * spread;
    }
  }

  private playInstantOneShot(track: { audio: THREE.Audio }): void {
    if (this.isMuted || !track.audio.buffer || this.audioListener.context.state !== 'running') return;
    if (track.audio.isPlaying) {
      track.audio.stop();
    }
    track.audio.play();
  }

  private setupAudioResume(): void {
    this.audioResumeEvents.forEach(ev => {
      window.addEventListener(ev, this.audioResumeHandler, { capture: true });
      this.renderer.renderer.domElement.addEventListener(ev, this.audioResumeHandler, { capture: true });
    });
  }

  private teardownAudioResume(): void {
    this.audioResumeEvents.forEach(ev => {
      window.removeEventListener(ev, this.audioResumeHandler, { capture: true });
      this.renderer.renderer.domElement.removeEventListener(ev, this.audioResumeHandler, { capture: true });
    });
  }

  private setupMouseControls(): void {
    this.mouseController.onCameraMove = delta => this.cameraController.pan(delta);
    this.mouseController.onCameraZoom = delta => this.cameraController.zoom(delta);
    this.mouseController.onRightClick = () => {
      if (!this.selectedBuilding) return false;
      this.cancelBuildMode();
      this.events.emit('buildCancel', undefined as void);
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
    this.mouseController.onBuildTouchRelease = position => this.handleMobileBuildTouchRelease(position);
  }

  private keyHandler = (event: KeyboardEvent): void => {
    if ((event.key === 'r' || event.key === 'R') && this.selectedBuilding) {
      this.rotateBuild(1);
    }
  };

  private rotateBuild(direction: number): void {
    this.buildRotation = (this.buildRotation + direction * Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    this.events.emit('rotationChange', Math.round(this.buildRotation * 180 / Math.PI));
    this.updatePreview();
  }

  /** Rotate the active placement preview by 90° clockwise. Safe to call from UI. */
  public rotateBuilding(): void {
    if (this.selectedBuilding) this.rotateBuild(1);
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
    if (!result) {
      this.deselectBuilding();
      this.events.emit('buildingSelected', null);
      return;
    }

    if ('ride' in result) {
      const { id, rideType, price, cost, position: buildingPosition } = result.ride.data;
      const display = BUILDING_DISPLAY[rideType];
      const size = RIDE_SIZES[rideType];
      this.showSelectionHighlight(buildingPosition, size.width, size.height);
      this.events.emit('buildingSelected', {
        id,
        buildingType: BuildingType.RIDE,
        subType: rideType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost,
        rotationY: result.ride.mesh.rotation.y
      });
      return;
    }

    if ('shop' in result) {
      const { id, shopType, price, cost, position: buildingPosition } = result.shop.data;
      const display = BUILDING_DISPLAY[shopType];
      this.showSelectionHighlight(buildingPosition, 1, 1);
      this.events.emit('buildingSelected', {
        id,
        buildingType: BuildingType.SHOP,
        subType: shopType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost,
        rotationY: result.shop.mesh.rotation.y
      });
      return;
    }

    if ('service' in result) {
      const { id, serviceType, price, cost, position: buildingPosition } = result.service.data;
      const display = BUILDING_DISPLAY[serviceType];
      this.showSelectionHighlight(buildingPosition, 1, 1);
      this.events.emit('buildingSelected', {
        id,
        buildingType: BuildingType.SERVICE,
        subType: serviceType,
        name: display.name,
        icon: display.icon,
        position: buildingPosition,
        currentPrice: price,
        buildCost: cost,
        rotationY: result.service.mesh.rotation.y
      });
      return;
    }

    const { id, decorationType, cost, position: buildingPosition } = result.decoration.data;
    const display = BUILDING_DISPLAY[decorationType];
    this.showSelectionHighlight(buildingPosition, 1, 1);
    this.events.emit('buildingSelected', {
      id,
      buildingType: BuildingType.DECORATION,
      subType: decorationType,
      name: display.name,
      icon: display.icon,
      position: buildingPosition,
      currentPrice: null,
      buildCost: cost,
      rotationY: result.decoration.mesh.rotation.y
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
      this.renderer.invalidateShadowMap();
      const placedType = this.selectedBuilding.type;
      this.playInstantOneShot(this.buildTrack);
      if (this.movingBuilding) {
        this.movingBuilding = null;
        if (placedType !== BuildingType.PATH) {
          this.events.emit('buildingPlaced', undefined as void);
        }
        return;
      }
      this.economySystem.spendMoney(this.selectedBuilding.cost);
      if (placedType !== BuildingType.PATH) {
        this.events.emit('buildingPlaced', undefined as void);
      }
    }
  }

  private canPlaceSelectedBuildingAt(position: GridPosition): boolean {
    if (!this.selectedBuilding || this.selectedBuilding.type === BuildingType.DELETE) return false;

    return this.buildingSystem.canPlaceBuilding(
      position,
      this.selectedBuilding.type,
      this.selectedBuilding.subType as PlaceableBuildingKind | undefined
    ) && this.economySystem.canAfford(this.selectedBuilding.cost);
  }

  private handleMobileBuildTouchRelease(position: GridPosition): void {
    if (!this.selectedBuilding || this.selectedBuilding.type === BuildingType.PATH) return;

    this.hoveredGridPosition = position;
    this.updatePreview();
    if (!this.canPlaceSelectedBuildingAt(position)) return;

    this.placeBuilding(position);
    this.updatePreview();
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
    let cost = 0;
    if (result) {
      if ('ride' in result) cost = result.ride.data.cost;
      if ('shop' in result) cost = result.shop.data.cost;
      if ('service' in result) cost = result.service.data.cost;
      if ('decoration' in result) cost = result.decoration.data.cost;
    }

    if (!this.buildingSystem.removeBuilding(position)) return;

    this.renderer.invalidateShadowMap();
    const refund = cost <= 0 ? 0 : Math.floor(cost * 0.5);
    if (refund > 0) {
      this.economySystem.addMoney(refund);
      this.showFloatingText(`+$${refund}`, position, '#22c55e');
    }
    this.hideSelectionHighlight();
    this.events.emit('buildingSelected', null);
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
    this.movingBuilding = info;
    this.hideSelectionHighlight();
    this.events.emit('buildingSelected', null);
    this.selectBuilding({
      type: info.buildingType,
      subType: info.subType,
      name: info.name,
      description: '',
      cost: 0,
      icon: info.icon
    });
    this.buildRotation = info.rotationY;
    this.events.emit('rotationChange', Math.round(this.buildRotation * 180 / Math.PI));
    this.updatePreview();
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

  public exportSaveData(): SaveGameData {
    return {
      version: Game.SAVE_VERSION,
      savedAt: new Date().toISOString(),
      economy: this.economySystem.exportSaveData(),
      research: this.researchSystem.getState(),
      challenges: this.challengeSystem.getState(),
      buildings: this.buildingSystem.exportSaveData()
    };
  }

  public hasUserBuiltContent(): boolean {
    const counts = this.buildingSystem.getBuildingCounts();
    return counts[BuildingType.RIDE] > 0
      || counts[BuildingType.SHOP] > 0
      || counts[BuildingType.SERVICE] > 0
      || counts[BuildingType.DECORATION] > 0
      || counts[BuildingType.PATH] > Game.DEFAULT_ENTRANCE_PATH_COUNT;
  }

  public importSaveData(raw: unknown): void {
    const save = this.validateSaveData(raw);

    this.cancelBuildMode();
    this.selectedBuilding = null;
    this.hoveredGridPosition = null;
    this.movingBuilding = null;
    this.hideSelectionHighlight();
    this.events.emit('buildCancel', undefined as void);
    this.events.emit('buildingSelected', null);

    this.ratingUpdateTimer = 0;
    this.maintenanceUpdateTimer = 0;
    this.challengeRewardTimer = 0;
    this.challengeRewardQueue.length = 0;

    this.visitorSystem.clear();
    this.buildingSystem.clear();
    this.researchSystem.reset();
    this.challengeSystem.reset();
    this.economySystem.reset();

    this.restoreBuildings(save.buildings);
    this.researchSystem.restoreSaveData(save.research);
    this.challengeSystem.restoreSaveData(save.challenges);
    this.economySystem.restoreSaveData(save.economy);
    this.visitorSystem.scheduleRestoreVisitors(save.economy.activeVisitors);

    const maintenance = this.buildingSystem.getMaintenanceChargePerInterval();
    this.economySystem.setMaintenancePerMinute(maintenance * (60 / this.MAINTENANCE_UPDATE_INTERVAL));
    this.economySystem.notify();
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

    // loadBuildingGLTF shares geometry/textures from the session cache —
    // no extra VRAM per preview. Ghost materials are replaced below anyway.
    loadBuildingGLTF(path, (model) => {
      // Discard if a new preview was created while loading
      if (this.previewGroup !== token || !this.previewGroup) return;

      // Scale to fit footprint
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const previewTargetSize = subType ? Game.PREVIEW_TARGET_SIZES[subType] : undefined;
      const maxDim = previewTargetSize ? Math.max(size.x, size.y, size.z) : Math.max(size.x, size.z);
      const targetSize = previewTargetSize ?? Math.max(footprintW, footprintH) * GRID_SIZE * 0.88;
      const scale = maxDim > 0.01 ? targetSize / maxDim : 1;
      model.scale.setScalar(scale);

      // Ground-align + centre on XZ
      const scaled = new THREE.Box3().setFromObject(model);
      const center = scaled.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      if (path === '/models/house.glb') {
        model.position.y -= scaled.min.y;
        model.position.y += 0.02;
        model.scale.setScalar(scale * 0.72);
      } else {
        model.position.y -= scaled.min.y;
      }

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

    // Footprint slab + edge geometry are created fresh per preview — safe to dispose.
    this.previewFloorMesh?.geometry.dispose();
    this.previewEdges?.geometry.dispose();

    // Ghost model geometry comes from the loadBuildingGLTF cache — shared, must NOT dispose.
    // Ghost model materials are fresh MeshBasicMaterial instances per preview — safe to dispose.
    this.previewModelMeshes.forEach(mesh => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        (mesh.material as THREE.Material).dispose();
      }
    });

    this.previewGroup = null;
    this.previewFloorMesh = null;
    this.previewEdges = null;
    this.previewModelMeshes = [];
  }

  private showSelectionHighlight(position: GridPosition, width: number, height: number): void {
    this.hideSelectionHighlight();

    // GridHelper.gridToWorld returns center of the single cell at 'position'
    const cellCenter = GridHelper.gridToWorld(position);
    const wx = cellCenter.x + (width  - 1) * GRID_SIZE / 2;
    const wz = cellCenter.z + (height - 1) * GRID_SIZE / 2;
    const w  = width  * GRID_SIZE - 0.12;
    const h  = height * GRID_SIZE - 0.12;

    const fillGeo = new THREE.PlaneGeometry(w, h);
    this.selectionHighlightFill = new THREE.Mesh(fillGeo, this.selectionFillMat);
    this.selectionHighlightFill.rotation.x = -Math.PI / 2;

    const edgeGeo = new THREE.BufferGeometry();
    const hw = w / 2; const hh = h / 2;
    const verts = new Float32Array([
      -hw, 0, -hh,   hw, 0, -hh,
       hw, 0, -hh,   hw, 0,  hh,
       hw, 0,  hh,  -hw, 0,  hh,
      -hw, 0,  hh,  -hw, 0, -hh,
    ]);
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const edges = new THREE.LineSegments(edgeGeo, this.selectionEdgeMat);

    this.selectionHighlight = new THREE.Group();
    this.selectionHighlight.add(this.selectionHighlightFill, edges);
    this.selectionHighlight.position.set(wx, 0.06, wz);
    this.scene.scene.add(this.selectionHighlight);
    this.selectionHighlightTime = 0;
  }

  private hideSelectionHighlight(): void {
    if (!this.selectionHighlight) return;
    this.scene.scene.remove(this.selectionHighlight);
    this.selectionHighlight.children.forEach(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
      }
    });
    this.selectionHighlight = null;
    this.selectionHighlightFill = null;
  }

  public deselectBuilding(): void {
    this.hideSelectionHighlight();
  }

  public selectBuilding(definition: BuildingDefinition): void {
    if (
      this.movingBuilding &&
      !(
        definition.cost === 0 &&
        definition.type === this.movingBuilding.buildingType &&
        definition.subType === this.movingBuilding.subType
      )
    ) {
      this.restoreMovedBuilding();
    }
    this.selectedBuilding = definition;
    this.buildRotation = 0;
    this.events.emit('rotationChange', 0);
    this.mouseController.onBuildRotate = dir => this.rotateBuild(dir);
    this.mouseController.touchRotateMode =
      definition.type !== BuildingType.PATH && definition.type !== BuildingType.DELETE;
    this.createPreviewMesh();
    this.updatePreview();
  }

  public cancelBuildMode(): void {
    if (this.movingBuilding) {
      this.restoreMovedBuilding();
    }
    this.selectedBuilding = null;
    this.mouseController.onBuildRotate = null;
    this.mouseController.touchRotateMode = false;
    this.disposePreview();
  }

  private restoreMovedBuilding(): void {
    const info = this.movingBuilding;
    if (!info) return;

    let restored: { mesh: THREE.Object3D } | null = null;

    switch (info.buildingType) {
      case BuildingType.RIDE:
        restored = this.buildingSystem.placeRide(info.position, info.subType as RideType);
        break;
      case BuildingType.SHOP:
        restored = this.buildingSystem.placeShop(info.position, info.subType as ShopType);
        break;
      case BuildingType.SERVICE:
        restored = this.buildingSystem.placeService(info.position, info.subType as ServiceType);
        break;
      case BuildingType.DECORATION:
        restored = this.buildingSystem.placeDecoration(info.position, info.subType as DecorationType);
        break;
      default:
        restored = null;
        break;
    }

    if (restored) {
      restored.mesh.rotation.y = info.rotationY;
      if (info.currentPrice !== null) {
        this.buildingSystem.updateBuildingPrice(info.position, info.currentPrice);
      }
      this.renderer.invalidateShadowMap();
    }

    this.movingBuilding = null;
  }

  public canAfford(cost: number): boolean {
    return this.economySystem.canAfford(cost);
  }

  private restoreBuildings(buildings: SavedBuildingsData): void {
    buildings.paths.forEach(entry => {
      const placed = this.buildingSystem.placePath(entry.position);
      if (!placed) throw new Error(`Failed to restore path at ${entry.position.x},${entry.position.z}.`);
    });

    buildings.rides.forEach(entry => {
      const placed = this.buildingSystem.placeRide(entry.position, entry.subType);
      if (!placed) throw new Error(`Failed to restore ride at ${entry.position.x},${entry.position.z}.`);
      this.buildingSystem.updateBuildingPrice(entry.position, entry.price);
    });

    buildings.shops.forEach(entry => {
      const placed = this.buildingSystem.placeShop(entry.position, entry.subType);
      if (!placed) throw new Error(`Failed to restore shop at ${entry.position.x},${entry.position.z}.`);
      this.buildingSystem.updateBuildingPrice(entry.position, entry.price);
    });

    buildings.services.forEach(entry => {
      const placed = this.buildingSystem.placeService(entry.position, entry.subType);
      if (!placed) throw new Error(`Failed to restore service at ${entry.position.x},${entry.position.z}.`);
    });

    buildings.decorations.forEach(entry => {
      const placed = this.buildingSystem.placeDecoration(entry.position, entry.subType);
      if (!placed) throw new Error(`Failed to restore decoration at ${entry.position.x},${entry.position.z}.`);
    });

    this.renderer.invalidateShadowMap();
  }

  private validateSaveData(raw: unknown): SaveGameData {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Save file is invalid.');
    }

    const save = raw as Partial<SaveGameData>;
    if (save.version !== Game.SAVE_VERSION) {
      throw new Error('Unsupported save version.');
    }
    if (typeof save.savedAt !== 'string' || !save.savedAt) {
      throw new Error('Save file is missing a valid timestamp.');
    }
    if (!save.economy || !save.research || !save.challenges || !save.buildings) {
      throw new Error('Save file is incomplete.');
    }

    const economy = this.validateEconomySave(save.economy);
    const research = this.validateResearchSave(save.research);
    const challenges = this.validateChallengesSave(save.challenges);
    const buildings = this.validateBuildingsSave(save.buildings);

    return {
      version: Game.SAVE_VERSION,
      savedAt: save.savedAt,
      economy,
      research,
      challenges,
      buildings
    };
  }

  private validateEconomySave(raw: unknown): SavedEconomyData {
    const value = raw as Partial<SavedEconomyData>;
    const requiredNumbers: Array<keyof SavedEconomyData> = [
      'money',
      'ticketPrice',
      'totalVisitors',
      'activeVisitors',
      'dailyIncome',
      'dailyExpenses',
      'netProfit'
    ];

    requiredNumbers.forEach(key => {
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key] as number)) {
        throw new Error('Save economy data is invalid.');
      }
    });
    if (typeof value.isOpen !== 'boolean') {
      throw new Error('Save economy data is invalid.');
    }

    return {
      money: value.money!,
      ticketPrice: value.ticketPrice!,
      totalVisitors: value.totalVisitors!,
      activeVisitors: value.activeVisitors!,
      dailyIncome: value.dailyIncome!,
      dailyExpenses: value.dailyExpenses!,
      netProfit: value.netProfit!,
      isOpen: value.isOpen!
    };
  }

  private validateResearchSave(raw: unknown): ResearchState {
    const value = raw as Partial<ResearchState>;
    if (!Array.isArray(value.unlocked) || !Array.isArray(value.completed)) {
      throw new Error('Save research data is invalid.');
    }
    if (!(typeof value.activeResearchId === 'string' || value.activeResearchId === null)) {
      throw new Error('Save research data is invalid.');
    }
    if (typeof value.remainingTime !== 'number' || !Number.isFinite(value.remainingTime)) {
      throw new Error('Save research data is invalid.');
    }

    const knownKinds = new Set<PlaceableBuildingKind>([
      ...Object.values(RideType),
      ...Object.values(ShopType),
      ...Object.values(ServiceType),
      ...Object.values(DecorationType)
    ]);
    const knownResearchIds = new Set(this.researchSystem.getNodes().map(node => node.id));

    value.unlocked.forEach(kind => {
      if (!knownKinds.has(kind as PlaceableBuildingKind)) {
        throw new Error('Save research data contains unknown unlocks.');
      }
    });
    value.completed.forEach(id => {
      if (!knownResearchIds.has(id)) {
        throw new Error('Save research data contains unknown research nodes.');
      }
    });
    if (value.activeResearchId !== null && !knownResearchIds.has(value.activeResearchId)) {
      throw new Error('Save research data contains an unknown active research node.');
    }

    return {
      unlocked: [...value.unlocked] as PlaceableBuildingKind[],
      completed: [...value.completed],
      activeResearchId: value.activeResearchId,
      remainingTime: Math.max(0, value.remainingTime)
    };
  }

  private validateChallengesSave(raw: unknown): ChallengeState[] {
    if (!Array.isArray(raw)) {
      throw new Error('Save challenge data is invalid.');
    }

    const templateById = new Map(this.challengeSystem.getState().map(challenge => [challenge.id, challenge]));
    return raw.map((entry): ChallengeState => {
      const challenge = entry as Partial<ChallengeState>;
      const template = challenge.id ? templateById.get(challenge.id) : undefined;
      if (!template) {
        throw new Error('Save challenge data contains unknown challenges.');
      }
      if (
        typeof challenge.progress !== 'number' ||
        !Number.isFinite(challenge.progress) ||
        typeof challenge.completed !== 'boolean' ||
        typeof challenge.claimed !== 'boolean'
      ) {
        throw new Error('Save challenge data is invalid.');
      }

      return {
        ...template,
        progress: challenge.progress,
        completed: challenge.completed,
        claimed: challenge.claimed
      };
    });
  }

  private validateBuildingsSave(raw: unknown): SavedBuildingsData {
    const value = raw as Partial<SavedBuildingsData>;
    if (
      !Array.isArray(value.paths) ||
      !Array.isArray(value.rides) ||
      !Array.isArray(value.shops) ||
      !Array.isArray(value.services) ||
      !Array.isArray(value.decorations)
    ) {
      throw new Error('Save buildings data is invalid.');
    }

    const pathSet = new Set<number>();
    const occupied = new Set<number>();

    const paths = value.paths.map(entry => this.validatePathEntry(entry, pathSet));
    const rides = value.rides.map(entry => this.validateRideEntry(entry, occupied, pathSet));
    const shops = value.shops.map(entry => this.validateShopEntry(entry, occupied, pathSet));
    const services = value.services.map(entry => this.validateServiceEntry(entry, occupied, pathSet));
    const decorations = value.decorations.map(entry => this.validateDecorationEntry(entry, occupied, pathSet));

    return { paths, rides, shops, services, decorations };
  }

  private validatePosition(raw: unknown, label: string): GridPosition {
    const position = raw as Partial<GridPosition>;
    if (
      typeof position?.x !== 'number' ||
      typeof position?.z !== 'number' ||
      !Number.isInteger(position.x) ||
      !Number.isInteger(position.z)
    ) {
      throw new Error(`${label} has an invalid position.`);
    }
    const validated = { x: position.x, z: position.z };
    if (!GridHelper.isValidGridPosition(validated)) {
      throw new Error(`${label} is outside the map.`);
    }
    return validated;
  }

  private validatePathEntry(raw: unknown, pathSet: Set<number>): SavedPathEntry {
    const entry = raw as Partial<SavedPathEntry>;
    const position = this.validatePosition(entry.position, 'Path');
    const key = GridHelper.getGridKey(position);
    if (pathSet.has(key)) throw new Error('Save contains duplicate paths.');
    pathSet.add(key);
    return { position };
  }

  private validateRideEntry(raw: unknown, occupied: Set<number>, pathSet: Set<number>): SavedRideEntry {
    const entry = raw as Partial<SavedRideEntry>;
    if (!Object.values(RideType).includes(entry.subType as RideType)) {
      throw new Error('Save contains an unknown ride.');
    }
    if (typeof entry.price !== 'number' || !Number.isFinite(entry.price)) {
      throw new Error('Save ride price is invalid.');
    }
    const position = this.validatePosition(entry.position, 'Ride');
    const cells: GridPosition[] = [];
    const size = RIDE_SIZES[entry.subType as RideType];
    for (let dx = 0; dx < size.width; dx++) {
      for (let dz = 0; dz < size.height; dz++) {
        const cell = { x: position.x + dx, z: position.z + dz };
        if (!GridHelper.isValidGridPosition(cell)) {
          throw new Error('Save contains a ride outside the map.');
        }
        const key = GridHelper.getGridKey(cell);
        if (occupied.has(key) || pathSet.has(key)) {
          throw new Error('Save contains overlapping buildings.');
        }
        occupied.add(key);
        cells.push(cell);
      }
    }
    const hasPathAccess = cells.some(cell =>
      GridHelper.getAdjacentPositions(cell).some(neighbor => pathSet.has(GridHelper.getGridKey(neighbor)))
    );
    if (!hasPathAccess) throw new Error('Save contains a ride without path access.');

    return { position, subType: entry.subType as RideType, price: Math.round(entry.price) };
  }

  private validateShopEntry(raw: unknown, occupied: Set<number>, pathSet: Set<number>): SavedShopEntry {
    const entry = raw as Partial<SavedShopEntry>;
    if (!Object.values(ShopType).includes(entry.subType as ShopType)) {
      throw new Error('Save contains an unknown shop.');
    }
    if (typeof entry.price !== 'number' || !Number.isFinite(entry.price)) {
      throw new Error('Save shop price is invalid.');
    }
    const position = this.validateSingleCellBuilding(entry.position, occupied, pathSet, 'Shop');
    this.assertPathAdjacent(position, pathSet, 'Shop');
    return { position, subType: entry.subType as ShopType, price: Math.round(entry.price) };
  }

  private validateServiceEntry(raw: unknown, occupied: Set<number>, pathSet: Set<number>): SavedServiceEntry {
    const entry = raw as Partial<SavedServiceEntry>;
    if (!Object.values(ServiceType).includes(entry.subType as ServiceType)) {
      throw new Error('Save contains an unknown service.');
    }
    const position = this.validateSingleCellBuilding(entry.position, occupied, pathSet, 'Service');
    this.assertPathAdjacent(position, pathSet, 'Service');
    return { position, subType: entry.subType as ServiceType };
  }

  private validateDecorationEntry(raw: unknown, occupied: Set<number>, pathSet: Set<number>): SavedDecorationEntry {
    const entry = raw as Partial<SavedDecorationEntry>;
    if (!Object.values(DecorationType).includes(entry.subType as DecorationType)) {
      throw new Error('Save contains an unknown decoration.');
    }
    const position = this.validateSingleCellBuilding(entry.position, occupied, pathSet, 'Decoration');
    return { position, subType: entry.subType as DecorationType };
  }

  private validateSingleCellBuilding(raw: unknown, occupied: Set<number>, pathSet: Set<number>, label: string): GridPosition {
    const position = this.validatePosition(raw, label);
    const key = GridHelper.getGridKey(position);
    if (occupied.has(key) || pathSet.has(key)) {
      throw new Error('Save contains overlapping buildings.');
    }
    occupied.add(key);
    return position;
  }

  private assertPathAdjacent(position: GridPosition, pathSet: Set<number>, label: string): void {
    const hasAdjacentPath = GridHelper
      .getAdjacentPositions(position)
      .some(neighbor => pathSet.has(GridHelper.getGridKey(neighbor)));
    if (!hasAdjacentPath) {
      throw new Error(`Save contains a ${label.toLowerCase()} without path access.`);
    }
  }

  private update(deltaTime: number): void {
    // Pulse the selection highlight
    if (this.selectionHighlight && this.selectionHighlightFill) {
      this.selectionHighlightTime += deltaTime;
      const pulse = 0.12 + Math.sin(this.selectionHighlightTime * 3.5) * 0.10;
      this.selectionFillMat.opacity = pulse;
    }

    const camTarget = this.cameraController.getTarget();
    this.scene.updateShadowFrustum(camTarget.x, camTarget.z);
    this.scene.updateRetroOverlay(deltaTime);

    this.scene.updateWeather(deltaTime);
    this.buildingSystem.update(deltaTime);
    // Use direct getters — no per-frame object spread (getState() copies the whole state).
    const sim = this.simulationEntities;
    sim.rides       = this.buildingSystem.getRides();
    sim.shops       = this.buildingSystem.getShops();
    sim.services    = this.buildingSystem.getServices();
    sim.decorations = this.buildingSystem.getDecorations();
    sim.isOpen      = this.economySystem.isOpen;
    sim.ticketPrice = this.economySystem.ticketPrice;
    sim.parkRating  = this.economySystem.parkRating;
    this.visitorSystem.update(deltaTime, sim);

    const unlocked = this.researchSystem.update(deltaTime);
    if (unlocked.length > 0) {
      this.showFloatingText('Research complete!', { x: 24, z: 47 }, '#facc15');
    }

    this.tickOneShotAudio(this.windTrack, deltaTime, [30, 30]);
    this.tickOneShotAudio(this.ambience1Track, deltaTime, [22, 18]);
    this.tickOneShotAudio(this.ambience2Track, deltaTime, [28, 22]);
    if (this.scene.consumeLightningTrigger()) {
      this.playInstantOneShot(this.thunderTrack);
    }

    this.processChallengeRewardQueue(deltaTime);

    const maintenance = this.buildingSystem.getMaintenanceChargePerInterval();
    this.economySystem.setMaintenancePerMinute(maintenance * (60 / this.MAINTENANCE_UPDATE_INTERVAL));

    this.maintenanceUpdateTimer += deltaTime;
    if (this.maintenanceUpdateTimer >= this.MAINTENANCE_UPDATE_INTERVAL) {
      this.maintenanceUpdateTimer = 0;

      if (maintenance > 0) this.economySystem.chargeMaintenance(maintenance);
    }

    this.ratingUpdateTimer += deltaTime;
    if (this.ratingUpdateTimer >= this.RATING_UPDATE_INTERVAL) {
      this.ratingUpdateTimer = 0;
      const counts = this.buildingSystem.getBuildingCounts();
      this.economySystem.updateParkRating(
        this.visitorSystem.getAverageHappiness(),
        this.buildingSystem.getFacilityScore(),
        this.buildingSystem.getDecorationAppeal(),
        this.visitorSystem.getVisitorCount(),
        counts[BuildingType.RIDE],
        counts[BuildingType.SHOP],
        counts[BuildingType.SERVICE]
      );
      const updatedEconState = this.economySystem.getState();
      const completed = this.challengeSystem.update(this.RATING_UPDATE_INTERVAL, {
        totalVisitors: updatedEconState.totalVisitors,
        activeVisitors: updatedEconState.activeVisitors,
        averageHappiness: this.visitorSystem.getAverageHappiness(),
        netProfit: updatedEconState.netProfit,
        parkRating: updatedEconState.parkRating,
        buildingCounts: counts,
        serviceAndDecorationCount: counts[BuildingType.SERVICE] + counts[BuildingType.DECORATION],
        rideCount: counts[BuildingType.RIDE],
        shopCount: counts[BuildingType.SHOP],
        serviceCount: counts[BuildingType.SERVICE],
        decorationCount: counts[BuildingType.DECORATION]
      });

      this.economySystem.notify();

      completed.forEach(challenge => this.queueChallengeReward(challenge.id));
    }

    // Shadow map throttle: re-render every N frames instead of every frame.
    // Visitor movement doesn't cast shadows so there's nothing dynamic to track.
    // Building changes call invalidateShadowMap() directly for an immediate update.
    this.shadowFrameCounter++;
    if (this.shadowFrameCounter >= Game.SHADOW_EVERY_N_FRAMES) {
      this.shadowFrameCounter = 0;
      this.renderer.invalidateShadowMap();
    }
  }

  private queueChallengeReward(id: string): void {
    if (this.challengeRewardQueue.includes(id)) return;
    this.challengeRewardQueue.push(id);
  }

  private processChallengeRewardQueue(deltaTime: number): void {
    if (this.challengeRewardTimer > 0) {
      this.challengeRewardTimer = Math.max(0, this.challengeRewardTimer - deltaTime);
      return;
    }

    const nextId = this.challengeRewardQueue.shift();
    if (!nextId) return;

    const claimed = this.challengeSystem.claimReward(nextId);
    if (!claimed) return;

    if (claimed.reward.money > 0) {
      this.economySystem.addMoney(claimed.reward.money);
    }
    if (claimed.reward.rating > 0) {
      const state = this.economySystem.getState();
      const counts = this.buildingSystem.getBuildingCounts();
      this.economySystem.updateParkRating(
        Math.min(100, state.averageHappiness + claimed.reward.rating),
        this.buildingSystem.getFacilityScore(),
        this.buildingSystem.getDecorationAppeal() + claimed.reward.rating,
        this.visitorSystem.getVisitorCount(),
        counts[BuildingType.RIDE],
        counts[BuildingType.SHOP],
        counts[BuildingType.SERVICE]
      );
    }
    this.showFloatingText(`Challenge +$${claimed.reward.money}`, { x: 24, z: 46 }, '#bef264');
    this.playInstantOneShot(this.challengeTrack);
    this.events.emit('challengeCompleted', claimed);
    this.challengeRewardTimer = this.CHALLENGE_REWARD_SPACING;
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
    gameLoadingManager.onStart = () => {};
    gameLoadingManager.onProgress = () => {};
    gameLoadingManager.onLoad = () => {};
    lanternPool.dispose();
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keyHandler);
    this.teardownAudioResume();
    this.mouseController.dispose();
    this.disposePreview();
    this.previewGreenMat.dispose();
    this.previewRedMat.dispose();
    this.previewEdgeGreenMat.dispose();
    this.previewEdgeRedMat.dispose();
    this.selectionFillMat.dispose();
    this.selectionEdgeMat.dispose();
    this.hideSelectionHighlight();
    this.buildingSystem.clear();
    this.visitorSystem.clear();
    this.scene.dispose();
    this.renderer.dispose();
    for (const track of this.loopTracks) {
      if (track.audio.isPlaying) track.audio.stop();
    }
    for (const oneShot of [this.windTrack, this.ambience1Track, this.ambience2Track, this.thunderTrack, this.challengeTrack, this.buildTrack]) {
      if (oneShot.audio.isPlaying) oneShot.audio.stop();
    }
    this.events.clear();
    this.scene.camera.remove(this.audioListener);
  }
}
