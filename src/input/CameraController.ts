import * as THREE from 'three';

const WORLD_BOUNDARY = 50;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private minDistance = 24;
  private maxDistance = 72;
  private currentDistance = 34; // Desktop starts with a tighter zoom-in
  private panSpeed = 0.34;
  private readonly zoomStep = 3.2;
  private readonly verticalRatio = 0.95;

  /**
   * Horizontal orbit angle in radians.
   * PI/4 = 45° NE — matches the original hardcoded camera position.
   * Two-finger twist gesture changes this via rotate().
   */
  private azimuth = Math.PI / 4;
  /** Lerp targets — actual values ease toward these each update(). */
  private targetDistance = 34;
  private targetAzimuth = Math.PI / 4;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    
    // On mobile screens, the narrow view port means the isometric angle pushes the gate off-center.
    // We adjust the target more to the left (-X) and closer to the gate (+Z) to center it better.
    const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile/i.test(navigator.userAgent);
    
    if (isMobile) {
      this.target = new THREE.Vector3(-5, 0, 16);
      this.currentDistance = 44; // Slightly further back for mobile to fit the entrance
      this.targetDistance = 44;
    } else {
      this.target = new THREE.Vector3(0, 0, 12);
    }
    
    this.updateCameraPosition();
  }

  public pan(delta: THREE.Vector2): void {
    const scale = this.panSpeed * (this.currentDistance / 54) * 0.1;
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);

    // Pan axes follow the current azimuth so dragging always moves the scene
    // in the expected direction regardless of how much the camera has been rotated.
    // right  = ( sin(az), 0, -cos(az))
    // forward= (-cos(az), 0, -sin(az))
    this.target.x += scale * (-delta.x * sinAz  + delta.y * (-cosAz));
    this.target.z += scale * ( delta.x * cosAz  + delta.y * (-sinAz));

    this.target.x = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.target.x));
    this.target.z = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, this.target.z));

    this.updateCameraPosition();
  }

  /**
   * Rotate the camera orbit by angleDelta radians around the look-at target.
   * Called by MouseController when a two-finger twist gesture is detected.
   * The change eases in via update() rather than snapping immediately.
   */
  public rotate(angleDelta: number): void {
    this.targetAzimuth += angleDelta;
  }

  public zoom(delta: number): void {
    this.targetDistance += delta * this.zoomStep;
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance));
  }

  /**
   * Smooth-step zoom and azimuth toward their targets.
   * Must be called once per frame from the game loop.
   */
  public update(dt: number): void {
    // exp-decay lerp — independent of frame rate, ~20 steps/sec response
    const k = 1 - Math.exp(-20 * dt);

    const distDelta = (this.targetDistance - this.currentDistance) * k;
    const azDelta   = (this.targetAzimuth  - this.azimuth)         * k;

    if (Math.abs(distDelta) > 0.0001 || Math.abs(azDelta) > 0.00001) {
      this.currentDistance += distDelta;
      this.azimuth         += azDelta;
      this.updateCameraPosition();
    }
  }

  private updateCameraPosition(): void {
    const elevation = Math.PI / 4.6;
    // Orbit radius in the horizontal plane. Multiply by sqrt(2) so that at the
    // default azimuth of PI/4 the X and Z offsets each equal horizontalDistance,
    // preserving the original camera position exactly.
    const orbitRadius = this.currentDistance * Math.cos(elevation) * Math.SQRT2;
    const verticalDistance = this.currentDistance * Math.sin(elevation) * this.verticalRatio;

    this.camera.position.set(
      this.target.x + orbitRadius * Math.cos(this.azimuth),
      verticalDistance,
      this.target.z + orbitRadius * Math.sin(this.azimuth)
    );

    this.camera.lookAt(this.target);
  }

  /**
   * Returns the internal target reference — read only.
   * Callers must not mutate the returned vector; use setTarget() for that.
   */
  public getTarget(): THREE.Vector3 {
    return this.target;
  }

  public setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.updateCameraPosition();
  }
}
