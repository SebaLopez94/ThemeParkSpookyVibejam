import * as THREE from 'three';

const PAN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const PAN_FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const WORLD_BOUNDARY = 50;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private minDistance = 24;
  private maxDistance = 72;
  private currentDistance = 54;
  private panSpeed = 0.34;
  private readonly zoomStep = 3.2;
  private readonly verticalRatio = 0.78;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.updateCameraPosition();
  }

  public pan(delta: THREE.Vector2): void {
    const scale = this.panSpeed * (this.currentDistance / 54) * 0.1;

    this.target.addScaledVector(PAN_RIGHT, -delta.x * scale);
    this.target.addScaledVector(PAN_FORWARD, delta.y * scale);

    this.target.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.target.x));
    this.target.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.target.z));

    this.updateCameraPosition();
  }

  public zoom(delta: number): void {
    this.currentDistance += delta * this.zoomStep;
    this.currentDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.currentDistance));
    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const angle = Math.PI / 4.6;
    const horizontalDistance = this.currentDistance * Math.cos(angle);
    const verticalDistance = this.currentDistance * Math.sin(angle) * this.verticalRatio;

    this.camera.position.set(
      this.target.x + horizontalDistance,
      verticalDistance,
      this.target.z + horizontalDistance
    );

    this.camera.lookAt(this.target);
  }

  public getTarget(): THREE.Vector3 {
    return this.target.clone();
  }

  public setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.updateCameraPosition();
  }
}
