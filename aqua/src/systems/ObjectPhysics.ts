import * as THREE from 'three';
import type { CollisionWorld } from '../physics/Collision';
import type { WaterSystem } from '../environment/WaterSystem';
import type { Interactable } from './Interactables';
import { raySphere } from './Interactables';
import type { Updatable } from '../core/types';

export interface BallEvents {
  onImpact?(ball: PhysicsBall, speed: number): void;
  onSplash?(ball: PhysicsBall, speed: number, surfaceY: number): void;
  onPickup?(ball: PhysicsBall): void;
  onDrop?(ball: PhysicsBall, thrown: boolean): void;
}

/** A glossy sphere the player can pick up, carry, drop and throw. Floats on water. */
export class PhysicsBall implements Interactable {
  readonly kind = 'carry' as const;
  readonly reach = 3.0;
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();
  readonly spawn = new THREE.Vector3();
  carried = false;
  sleeping = true;
  restTime = 0;
  wasInWater = false;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly mesh: THREE.Mesh,
    readonly radius: number,
    private readonly system: ObjectPhysics,
  ) {
    this.position = mesh.position;
    this.spawn.copy(mesh.position);
  }

  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (this.carried) return -1;
    return raySphere(origin, dir, this.position, this.radius * 1.35);
  }

  prompt(): string {
    return `Pegar ${this.label}`;
  }

  interact(): void {
    this.system.pickUp(this);
  }

  wake(): void {
    this.sleeping = false;
    this.restTime = 0;
  }
}

const GRAVITY = 9.8;
const tmpN = { x: 0, y: 0, z: 0 };
const tmpV = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();

/**
 * Simple rigid-sphere simulation for carriable objects: gravity, bounce, rolling friction,
 * buoyancy & current in water, sphere–sphere contacts and gentle pushes from the player.
 * Collisions reuse the same collision world as the player, so held objects cannot be pushed
 * through walls.
 */
export class ObjectPhysics implements Updatable {
  readonly balls: PhysicsBall[] = [];
  carried: PhysicsBall | null = null;
  private holdDistance = 1.5;

  constructor(
    private readonly collision: CollisionWorld,
    private readonly water: WaterSystem,
    private readonly events: BallEvents = {},
  ) {}

  addBall(id: string, label: string, mesh: THREE.Mesh, radius: number): PhysicsBall {
    const b = new PhysicsBall(id, label, mesh, radius, this);
    this.balls.push(b);
    return b;
  }

  pickUp(ball: PhysicsBall): void {
    if (this.carried) this.drop(false);
    this.carried = ball;
    ball.carried = true;
    ball.wake();
    this.events.onPickup?.(ball);
  }

  drop(thrown: boolean, camera?: THREE.Camera): void {
    const b = this.carried;
    if (!b) return;
    this.carried = null;
    b.carried = false;
    b.wake();
    if (thrown && camera) {
      camera.getWorldDirection(tmpV);
      b.velocity.copy(tmpV).multiplyScalar(7.5);
      b.velocity.y += 1.5;
    } else {
      b.velocity.multiplyScalar(0.4);
    }
    this.events.onDrop?.(b, thrown);
  }

  /** Puts every object back where it started (used when restarting the exploration). */
  reset(): void {
    this.carried = null;
    for (const b of this.balls) {
      b.carried = false;
      b.position.copy(b.spawn);
      b.velocity.set(0, 0, 0);
      b.wake();
    }
  }

  /** Player info is optional (menu mode has no player interaction). */
  updateWithPlayer(dt: number, camera: THREE.Camera | null, player: { position: THREE.Vector3; velocity: THREE.Vector3; radius: number; height: number } | null): void {
    if (this.carried && camera) this.updateCarried(dt, camera, this.carried);
    for (const b of this.balls) {
      if (b.carried) continue;
      if (player) this.pushByPlayer(b, player);
      if (b.sleeping) continue;
      this.integrate(b, dt);
    }
    this.resolveBallPairs();
  }

  update(dt: number): void {
    this.updateWithPlayer(dt, null, null);
  }

  private updateCarried(dt: number, camera: THREE.Camera, b: PhysicsBall): void {
    const eye = camera.position;
    camera.getWorldDirection(tmpV);
    const wall = this.collision.raycast(eye, tmpV, this.holdDistance + b.radius);
    const dist = Math.max(0.7, Math.min(this.holdDistance, wall - b.radius - 0.05));
    tmpTarget.copy(eye).addScaledVector(tmpV, dist);
    tmpTarget.y -= 0.12;
    // Critically damped spring towards the hold point.
    const k = 16;
    b.velocity.subVectors(tmpTarget, b.position).multiplyScalar(k);
    const max = 14;
    if (b.velocity.length() > max) b.velocity.setLength(max);
    this.moveAndCollide(b, dt, false);
    // If something blocks the object for too long, let go.
    if (b.position.distanceTo(tmpTarget) > 1.6) this.drop(false);
    // gentle spin while carried
    b.mesh.rotation.y += dt * 0.8;
  }

  private integrate(b: PhysicsBall, dt: number): void {
    const v = b.velocity;
    v.y -= GRAVITY * dt;
    // Water: buoyancy, drag and current.
    const body = this.water.bodyAt(b.position.x, b.position.z);
    let submerged = 0;
    if (body) {
      const s = body.surfaceY;
      submerged = Math.min(1, Math.max(0, (s - (b.position.y - b.radius)) / (2 * b.radius)));
      if (submerged > 0) {
        v.y += GRAVITY * 2.3 * submerged * dt;
        const drag = Math.exp(-2.2 * submerged * dt);
        v.multiplyScalar(drag);
        v.x += (body.flow.x - v.x) * Math.min(1, 1.4 * submerged * dt);
        v.z += (body.flow.y - v.z) * Math.min(1, 1.4 * submerged * dt);
        if (!b.wasInWater && v.y < -1.2) this.events.onSplash?.(b, -v.y, s);
      }
    }
    b.wasInWater = submerged > 0;
    const grounded = this.moveAndCollide(b, dt, true);
    if (grounded && submerged === 0) {
      const f = Math.exp(-0.9 * dt);
      v.x *= f;
      v.z *= f;
    }
    // Rolling visual.
    const speed = Math.hypot(v.x, v.z);
    if (speed > 1e-3) {
      tmpAxis.set(v.z, 0, -v.x).normalize();
      b.mesh.rotateOnWorldAxis(tmpAxis, (speed * dt) / b.radius);
    }
    // Sleep when at rest (but never while floating with a current).
    const resting = v.lengthSq() < 0.003 && (grounded || submerged > 0) && (!body || body.flow.lengthSq() < 0.01);
    b.restTime = resting ? b.restTime + dt : 0;
    if (b.restTime > 0.8) {
      b.sleeping = true;
      v.set(0, 0, 0);
    }
    if (b.position.y < -20) {
      b.position.copy(b.spawn);
      v.set(0, 0, 0);
    }
  }

  /** Sub-stepped integration with sphere collision. Returns true if supported from below. */
  private moveAndCollide(b: PhysicsBall, dt: number, bounce: boolean): boolean {
    const v = b.velocity;
    const steps = Math.min(8, Math.max(1, Math.ceil((v.length() * dt) / (b.radius * 0.5))));
    const h = dt / steps;
    let grounded = false;
    for (let i = 0; i < steps; i++) {
      b.position.addScaledVector(v, h);
      if (this.collision.resolveSphere(b.position, b.radius, tmpN)) {
        const len = Math.hypot(tmpN.x, tmpN.y, tmpN.z) || 1;
        const nx = tmpN.x / len;
        const ny = tmpN.y / len;
        const nz = tmpN.z / len;
        if (ny > 0.6) grounded = true;
        const vn = v.x * nx + v.y * ny + v.z * nz;
        if (vn < 0) {
          if (bounce && -vn > 1.4) this.events.onImpact?.(b, -vn);
          const restitution = bounce && -vn > 0.8 ? 0.45 : 0;
          v.x -= (1 + restitution) * vn * nx;
          v.y -= (1 + restitution) * vn * ny;
          v.z -= (1 + restitution) * vn * nz;
        }
      }
    }
    return grounded;
  }

  private pushByPlayer(b: PhysicsBall, p: { position: THREE.Vector3; velocity: THREE.Vector3; radius: number; height: number }): void {
    if (b.position.y + b.radius < p.position.y || b.position.y - b.radius > p.position.y + p.height) return;
    const dx = b.position.x - p.position.x;
    const dz = b.position.z - p.position.z;
    const R = b.radius + p.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R || d2 < 1e-8) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const nz = dz / d;
    b.position.x += nx * (R - d);
    b.position.z += nz * (R - d);
    const pv = p.velocity.x * nx + p.velocity.z * nz;
    const bv = b.velocity.x * nx + b.velocity.z * nz;
    if (pv > bv) {
      const kick = (pv - bv) * 1.3;
      b.velocity.x += nx * kick;
      b.velocity.z += nz * kick;
      b.velocity.y += Math.min(1.2, kick * 0.15);
    }
    b.wake();
  }

  private resolveBallPairs(): void {
    const n = this.balls.length;
    for (let i = 0; i < n; i++) {
      const a = this.balls[i];
      for (let j = i + 1; j < n; j++) {
        const c = this.balls[j];
        if (a.sleeping && c.sleeping) continue;
        tmpV.subVectors(c.position, a.position);
        const R = a.radius + c.radius;
        const d2 = tmpV.lengthSq();
        if (d2 >= R * R || d2 < 1e-10) continue;
        const d = Math.sqrt(d2);
        tmpV.divideScalar(d);
        const pen = R - d;
        if (!a.carried) a.position.addScaledVector(tmpV, -pen * (c.carried ? 1 : 0.5));
        if (!c.carried) c.position.addScaledVector(tmpV, pen * (a.carried ? 1 : 0.5));
        const rel = (c.velocity.x - a.velocity.x) * tmpV.x + (c.velocity.y - a.velocity.y) * tmpV.y + (c.velocity.z - a.velocity.z) * tmpV.z;
        if (rel < 0) {
          const imp = -rel * 0.9;
          if (!a.carried) a.velocity.addScaledVector(tmpV, -imp * 0.5);
          if (!c.carried) c.velocity.addScaledVector(tmpV, imp * 0.5);
        }
        a.wake();
        c.wake();
      }
    }
  }
}

