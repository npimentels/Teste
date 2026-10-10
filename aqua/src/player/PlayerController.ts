import * as THREE from 'three';
import type { CollisionWorld } from '../physics/Collision';
import type { Input } from '../core/Input';

/** The subset of input the controller reads (lets tests drive it without a browser). */
export type ControlInput = Pick<Input, 'isDown' | 'wasPressed' | 'consumeMouse'>;
import { clamp, damp } from '../core/math';

export type FootSurface = 'tile' | 'grass' | 'metal' | 'water';

export interface PlayerEnvironment {
  collision: CollisionWorld;
  /** Water surface height at (x, z) or null when there is no water. */
  waterSurfaceAt(x: number, z: number): number | null;
  /** Floor material under the player, for footstep sounds. */
  surfaceAt(x: number, z: number, y: number): FootSurface;
}

export interface PlayerEvents {
  onFootstep?(surface: FootSurface, x: number, y: number, z: number, running: boolean): void;
  onLand?(impactSpeed: number, surface: FootSurface): void;
  onJump?(): void;
}

export interface PlayerTuning {
  walkSpeed: number;
  runSpeed: number;
  jumpSpeed: number;
  gravity: number;
  radius: number;
  height: number;
  eyeHeight: number;
  stepHeight: number;
}

export const DEFAULT_TUNING: PlayerTuning = {
  walkSpeed: 4.2,
  runSpeed: 7.4,
  jumpSpeed: 5.6,
  gravity: 16,
  radius: 0.32,
  height: 1.8,
  eyeHeight: 1.68,
  stepHeight: 0.5,
};

const MAX_PITCH = THREE.MathUtils.degToRad(88);

/**
 * First-person kinematic controller: a vertical cylinder (capsule-like) body with gravity,
 * step-up, ground snapping, wading and smoothed camera.
 */
export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  inWater = false;
  readonly tuning: PlayerTuning;

  sensitivity = 1;
  invertY = false;
  headBob = 0.5;
  baseFov = 75;

  private spawn = new THREE.Vector3();
  private spawnYaw = 0;
  private stepSmooth = 0;
  private bobPhase = 0;
  private bobAmount = 0;
  private stepDistance = 0;
  private airTime = 0;
  private fovKick = 0;
  private readonly mouse = { x: 0, y: 0 };

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly env: PlayerEnvironment,
    private readonly events: PlayerEvents = {},
    tuning: Partial<PlayerTuning> = {},
  ) {
    this.tuning = { ...DEFAULT_TUNING, ...tuning };
  }

  setSpawn(x: number, y: number, z: number, yaw: number): void {
    this.spawn.set(x, y, z);
    this.spawnYaw = yaw;
  }

  respawn(): void {
    this.teleport(this.spawn.x, this.spawn.y, this.spawn.z, this.spawnYaw, 0);
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw, pitch = this.pitch): void {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = clamp(pitch, -MAX_PITCH, MAX_PITCH);
    this.stepSmooth = 0;
    this.grounded = false;
    this.airTime = 0;
    this.syncCamera(0);
  }

  /** Eye position (for interaction rays and audio listener). */
  get eyeY(): number {
    return this.position.y + this.tuning.eyeHeight - this.stepSmooth;
  }

  update(dt: number, input: ControlInput): void {
    const t = this.tuning;

    // --- Look -----------------------------------------------------------------------------
    input.consumeMouse(this.mouse);
    const k = 0.0021 * this.sensitivity;
    this.yaw -= this.mouse.x * k;
    this.pitch -= this.mouse.y * k * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -MAX_PITCH, MAX_PITCH);

    // --- Wish direction -----------------------------------------------------------------
    const f = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const s = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let wx = -sinY * f + cosY * s;
    let wz = -cosY * f - sinY * s;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) {
      wx /= wl;
      wz /= wl;
    }
    const running = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && f > 0;
    const water = this.env.waterSurfaceAt(this.position.x, this.position.z);
    this.inWater = water !== null && this.position.y < water - 0.03;
    const speed = (running ? t.runSpeed : t.walkSpeed) * (this.inWater ? 0.6 : 1);

    const accel = this.grounded ? (wl > 0 ? 11 : 13) : 2.2;
    this.velocity.x = damp(this.velocity.x, wx * speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, wz * speed, accel, dt);

    // --- Jump & gravity -------------------------------------------------------------------
    if (this.grounded) this.airTime = 0;
    else this.airTime += dt;
    if (input.wasPressed('Space') && (this.grounded || this.airTime < 0.1) && this.velocity.y <= 0.1) {
      this.velocity.y = t.jumpSpeed * (this.inWater ? 0.85 : 1);
      this.grounded = false;
      this.airTime = 1;
      this.events.onJump?.();
    }
    this.velocity.y -= t.gravity * dt;
    if (this.velocity.y < -40) this.velocity.y = -40;

    // --- Integrate with sub-steps (no tunnelling through thin walls) --------------------
    const startY = this.position.y;
    const wasGrounded = this.grounded;
    const horizontal = Math.hypot(this.velocity.x, this.velocity.z) * dt;
    const steps = clamp(Math.ceil((horizontal + Math.abs(this.velocity.y) * dt) / (t.radius * 0.45)), 1, 12);
    const h = dt / steps;
    let landed = false;
    let impact = 0;
    const pos = this.position;
    const startX = pos.x;
    const startZ = pos.z;
    for (let i = 0; i < steps; i++) {
      pos.x += this.velocity.x * h;
      pos.z += this.velocity.z * h;
      this.env.collision.resolveCylinder(pos, pos.y, t.height, t.radius, t.stepHeight);

      pos.y += this.velocity.y * h;
      if (this.velocity.y > 0) {
        const ceil = this.env.collision.ceilingHeight(pos.x, pos.z, pos.y + t.stepHeight, t.radius * 0.8);
        if (pos.y + t.height > ceil) {
          pos.y = ceil - t.height;
          this.velocity.y = 0;
        }
      }
      const ground = this.env.collision.groundHeight(pos.x, pos.z, pos.y, t.radius * 0.55, t.stepHeight);
      if (pos.y <= ground) {
        if (!this.grounded && this.velocity.y < -3) {
          landed = true;
          impact = -this.velocity.y;
        }
        pos.y = ground;
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.grounded = true;
      } else if (this.grounded && this.velocity.y <= 0 && pos.y - ground < 0.42) {
        // Stay glued to ramps / small steps when walking down.
        pos.y = ground;
        this.velocity.y = 0;
      } else {
        this.grounded = false;
      }
    }

    // Safety net: never stay below the world.
    if (pos.y < -25) {
      this.respawn();
      return;
    }

    // Smooth vertical pops from step-up / step-down so the camera never snaps.
    if (wasGrounded && this.grounded) {
      const dy = pos.y - startY;
      if (Math.abs(dy) > 0.02) this.stepSmooth += dy;
    }
    this.stepSmooth = clamp(damp(this.stepSmooth, 0, 12, dt), -0.6, 0.6);

    // --- Footsteps & bob -----------------------------------------------------------------
    const moved = Math.hypot(pos.x - startX, pos.z - startZ);
    const planarSpeed = moved / Math.max(dt, 1e-5);
    if (this.grounded && planarSpeed > 0.4) {
      this.stepDistance += moved;
      const stride = running ? 1.05 : 0.8;
      if (this.stepDistance >= stride) {
        this.stepDistance -= stride;
        const surface = this.inWater ? 'water' : this.env.surfaceAt(pos.x, pos.z, pos.y);
        this.events.onFootstep?.(surface, pos.x, pos.y, pos.z, running);
      }
      this.bobPhase += moved * (Math.PI / (running ? 1.05 : 0.8));
      this.bobAmount = damp(this.bobAmount, Math.min(planarSpeed / t.runSpeed, 1), 8, dt);
    } else {
      this.bobAmount = damp(this.bobAmount, 0, 6, dt);
    }
    if (landed) {
      const surface = this.inWater ? 'water' : this.env.surfaceAt(pos.x, pos.z, pos.y);
      this.events.onLand?.(impact, surface);
      this.stepSmooth -= Math.min(impact * 0.012, 0.12) * this.headBob;
    }

    this.fovKick = damp(this.fovKick, running && planarSpeed > t.walkSpeed ? 1 : 0, 4, dt);
    this.syncCamera(dt);
  }

  syncCamera(_dt: number): void {
    const bob = this.headBob * this.bobAmount;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.045 * bob;
    const bobX = Math.cos(this.bobPhase) * 0.025 * bob;
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    this.camera.position.set(
      this.position.x + cosY * bobX,
      this.position.y + this.tuning.eyeHeight - this.stepSmooth + bobY,
      this.position.z - sinY * bobX,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const fov = this.baseFov + this.fovKick * 3 * Math.min(1, this.headBob * 2);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
