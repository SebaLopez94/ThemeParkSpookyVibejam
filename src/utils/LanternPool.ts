import * as THREE from 'three';
import { isMobile } from './platform';

// ─── Lantern Light Pool ────────────────────────────────────────────────────────
//
//  Problem: THREE.js recompiles all shaders whenever the number of lights in the
//  scene changes. Placing a Lantern decoration used to add a new PointLight each
//  time, causing a visible stutter.
//
//  Solution: pre-allocate a fixed pool of PointLights at scene start (intensity 0,
//  parked far below the world). When a lantern is placed, we reposition one and
//  turn its intensity on. When demolished, we park it again. Light count stays
//  constant → no recompiles, no lag.
//
// ─────────────────────────────────────────────────────────────────────────────

const POOL_SIZE   = 20;   // max simultaneous lanterns
const GLOW_COLOR  = 0xffd38a;
const GLOW_DIST   = 13.2; // GRID_SIZE(2) × 6.6
const GLOW_DECAY  = 1.6;
const GLOW_INTENS = 6.8;
const PARKED_Y    = -500; // far below scene — invisible while idle

class LanternLightPool {
  private available: THREE.PointLight[] = [];
  private inUse    = new Set<THREE.PointLight>();
  private scene: THREE.Scene | null = null;

  /** Call once right after the THREE.Scene is created. No-op on mobile. */
  public init(scene: THREE.Scene): void {
    if (isMobile()) return;
    this.scene = scene;

    for (let i = 0; i < POOL_SIZE; i++) {
      const light = new THREE.PointLight(GLOW_COLOR, 0, GLOW_DIST, GLOW_DECAY);
      light.castShadow = false;
      light.position.set(0, PARKED_Y, 0);
      scene.add(light);
      this.available.push(light);
    }
  }

  /**
   * Claim a pooled light and position it at the given world coords.
   * Returns null if the pool is exhausted or on mobile.
   */
  public claim(x: number, y: number, z: number): THREE.PointLight | null {
    if (this.available.length === 0) return null;
    const light = this.available.pop()!;
    light.position.set(x, y, z);
    light.intensity = GLOW_INTENS;
    this.inUse.add(light);
    return light;
  }

  /** Return a light to the pool (parks it below the world). */
  public release(light: THREE.PointLight): void {
    if (!this.inUse.has(light)) return;
    light.intensity = 0;
    light.position.set(0, PARKED_Y, 0);
    this.inUse.delete(light);
    this.available.push(light);
  }

  public dispose(): void {
    if (!this.scene) return;
    [...this.available, ...this.inUse].forEach(l => this.scene!.remove(l));
    this.available.length = 0;
    this.inUse.clear();
    this.scene = null;
  }
}

export const lanternPool = new LanternLightPool();
