import * as THREE from 'three';
import { GridPosition, WorldPosition } from '../types';
import { GridHelper } from '../utils/GridHelper';

export class MouseController {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private groundPlane: THREE.Plane;

  private isRightDragging = false;
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2();
  private _currentPos: THREE.Vector2 = new THREE.Vector2();
  private _delta: THREE.Vector2 = new THREE.Vector2();
  private _intersection: THREE.Vector3 = new THREE.Vector3();

  private isLeftDragging = false;
  private lastDragGridPosition: GridPosition | null = null;

  // Touch state
  private touchStartPos: THREE.Vector2 = new THREE.Vector2();
  private touchStartTime = 0;
  private lastTouchPos: THREE.Vector2 = new THREE.Vector2();
  private lastPinchDistance = 0;
  private lastPinchCenter: THREE.Vector2 = new THREE.Vector2();

  /** When true, single-finger drag in build mode moves the placement preview. */
  public touchRotateMode = false;

  public onCameraMove: ((delta: THREE.Vector2) => void) | null = null;
  public onCameraZoom: ((delta: number) => void) | null = null;
  public onGridHover: ((position: GridPosition | null) => void) | null = null;
  public onGridClick: ((position: GridPosition) => void) | null = null;
  public onGridDrag: ((position: GridPosition) => void) | null = null;
  public onBuildTouchRelease: ((position: GridPosition) => void) | null = null;
  public onRightClick: (() => boolean) | null = null;
  /** When set, scroll rotates the placement preview instead of zooming the camera. */
  public onBuildRotate: ((direction: number) => void) | null = null;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('mousedown', this.onMouseDown);
    this.domElement.addEventListener('mouseup', this.onMouseUp);
    this.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });
  }

  private updateMouseCoords(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private updateMouseCoordsFromTouch(touch: Touch): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.updateMouseCoords(event);

    if (this.isRightDragging && event.buttons === 2) {
      this._currentPos.set(event.clientX, event.clientY);
      this._delta.subVectors(this._currentPos, this.lastMousePosition);
      this.onCameraMove?.(this._delta);
      this.lastMousePosition.copy(this._currentPos);
      return;
    }

    const worldPos = this.getWorldPosition();
    if (!worldPos) {
      this.onGridHover?.(null);
      return;
    }

    const gridPos = GridHelper.worldToGrid(worldPos);

    if (this.isLeftDragging) {
      if (!this.lastDragGridPosition || !GridHelper.gridPositionEquals(this.lastDragGridPosition, gridPos)) {
        this.lastDragGridPosition = gridPos;
        this.onGridDrag?.(gridPos);
      }
    }

    this.onGridHover?.(gridPos);
  };

  private onMouseDown = (event: MouseEvent): void => {
    this.updateMouseCoords(event);

    if (event.button === 2) {
      const consumed = this.onRightClick?.() ?? false;
      if (!consumed) {
        this.isRightDragging = true;
        this.lastMousePosition.set(event.clientX, event.clientY);
      }
      return;
    }

    if (event.button === 0) {
      this.isLeftDragging = true;
      const worldPos = this.getWorldPosition();
      if (!worldPos) {
        this.lastDragGridPosition = null;
        return;
      }

      const gridPos = GridHelper.worldToGrid(worldPos);
      this.lastDragGridPosition = gridPos;
      this.onGridDrag?.(gridPos);
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) {
      this.isRightDragging = false;
      return;
    }

    if (event.button === 0) {
      this.isLeftDragging = false;
      this.lastDragGridPosition = null;
      const worldPos = this.getWorldPosition();
      if (worldPos) {
        this.onGridClick?.(GridHelper.worldToGrid(worldPos));
      }
    }
  };

  private onMouseWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.onBuildRotate) {
      this.onBuildRotate(Math.sign(event.deltaY));
    } else {
      this.onCameraZoom?.(Math.sign(event.deltaY));
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  // ── Touch handlers ───────────────────────────────────────────────────────

  private onTouchStart = (event: TouchEvent): void => {
    event.preventDefault();

    if (event.touches.length === 1) {
      const t = event.touches[0];
      this.touchStartPos.set(t.clientX, t.clientY);
      this.lastTouchPos.set(t.clientX, t.clientY);
      this.touchStartTime = Date.now();
      this.updateMouseCoordsFromTouch(t);

      if (this.onBuildRotate !== null) {
        if (this.touchRotateMode) {
          // Building placement — hold+drag will rotate
          this.updateMouseCoordsFromTouch(event.touches[0]);
          const worldPos = this.getWorldPosition();
          if (worldPos) this.onGridHover?.(GridHelper.worldToGrid(worldPos));
        } else {
          // Path draw mode — start drawing
          const worldPos = this.getWorldPosition();
          if (worldPos) {
            const gridPos = GridHelper.worldToGrid(worldPos);
            this.lastDragGridPosition = gridPos;
            this.isLeftDragging = true;
            this.onGridDrag?.(gridPos);
            this.onGridHover?.(gridPos);
          }
        }
      }
    } else if (event.touches.length === 2) {
      this.isLeftDragging = false;
      this.lastDragGridPosition = null;
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
      const cx = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const cy = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      this.lastPinchCenter.set(cx, cy);
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    event.preventDefault();

    if (event.touches.length === 1) {
      const t = event.touches[0];
      this._currentPos.set(t.clientX, t.clientY);
      this._delta.subVectors(this._currentPos, this.lastTouchPos);
      this.lastTouchPos.copy(this._currentPos);
      this.updateMouseCoordsFromTouch(t);

      if (this.onBuildRotate !== null && this.touchRotateMode) {
        // Building rotate mode — horizontal swipe rotates the preview
        // Still update hover position so the preview follows the finger
        const worldPos = this.getWorldPosition();
        if (worldPos) this.onGridHover?.(GridHelper.worldToGrid(worldPos));
      } else if (this.onBuildRotate !== null) {
        // Path draw mode — draw path / update hover preview
        const worldPos = this.getWorldPosition();
        if (worldPos) {
          const gridPos = GridHelper.worldToGrid(worldPos);
          this.onGridHover?.(gridPos);
          if (!this.lastDragGridPosition || !GridHelper.gridPositionEquals(this.lastDragGridPosition, gridPos)) {
            this.lastDragGridPosition = gridPos;
            this.onGridDrag?.(gridPos);
          }
        }
      } else {
        // Normal mode — pan camera (touch needs higher multiplier than mouse)
        this._delta.multiplyScalar(2.8);
        this.onCameraMove?.(this._delta);
      }
    } else if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Pinch zoom
      const pinchDelta = this.lastPinchDistance - dist;
      if (Math.abs(pinchDelta) > 8) {
        this.onCameraZoom?.(Math.sign(pinchDelta));
        this.lastPinchDistance = dist;
      }

      // Two-finger pan
      const cx = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const cy = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      this._delta.set(cx - this.lastPinchCenter.x, cy - this.lastPinchCenter.y);
      if (this._delta.length() > 0.5) {
        this.onCameraMove?.(this._delta);
      }
      this.lastPinchCenter.set(cx, cy);
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    event.preventDefault();
    this.isLeftDragging = false;

    if (event.changedTouches.length === 1 && event.touches.length === 0) {
      const t = event.changedTouches[0];
      const dx = t.clientX - this.touchStartPos.x;
      const dy = t.clientY - this.touchStartPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - this.touchStartTime;

      if (this.onBuildRotate !== null && this.touchRotateMode) {
        this.updateMouseCoordsFromTouch(t);
        const worldPos = this.getWorldPosition();
        if (worldPos) {
          const gridPos = GridHelper.worldToGrid(worldPos);
          this.onGridHover?.(gridPos);
          this.onBuildTouchRelease?.(gridPos);
        }

        this.lastDragGridPosition = null;
        return;
      }

      // Tap = small movement + quick lift
      if (dist < 14 && elapsed < 400) {
        this.updateMouseCoordsFromTouch(t);
        const worldPos = this.getWorldPosition();
        if (worldPos) {
          this.onGridClick?.(GridHelper.worldToGrid(worldPos));
        }
      }

      this.lastDragGridPosition = null;
      this.onGridHover?.(null);
    }
  };

  // ────────────────────────────────────────────────────────────────────────

  private getWorldPosition(): WorldPosition | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this._intersection);
    if (!hit) return null;
    return { x: this._intersection.x, y: this._intersection.y, z: this._intersection.z };
  }

  public dispose(): void {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.domElement.removeEventListener('touchstart', this.onTouchStart);
    this.domElement.removeEventListener('touchmove', this.onTouchMove);
    this.domElement.removeEventListener('touchend', this.onTouchEnd);
  }
}
