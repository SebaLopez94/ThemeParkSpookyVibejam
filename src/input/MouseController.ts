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

  private isLeftDragging = false;
  private lastDragGridPosition: GridPosition | null = null;

  public onCameraMove: ((delta: THREE.Vector2) => void) | null = null;
  public onCameraZoom: ((delta: number) => void) | null = null;
  public onGridHover: ((position: GridPosition | null) => void) | null = null;
  public onGridClick: ((position: GridPosition) => void) | null = null;
  public onGridDrag: ((position: GridPosition) => void) | null = null;
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
  }

  private updateMouseCoords(event: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.updateMouseCoords(event);

    if (this.isRightDragging && event.buttons === 2) {
      const currentPos = new THREE.Vector2(event.clientX, event.clientY);
      const delta = new THREE.Vector2().subVectors(currentPos, this.lastMousePosition);
      this.onCameraMove?.(delta);
      this.lastMousePosition.copy(currentPos);
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

  private getWorldPosition(): WorldPosition | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
    if (!hit) return null;
    return { x: intersection.x, y: intersection.y, z: intersection.z };
  }

  public dispose(): void {
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }
}
