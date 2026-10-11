import * as THREE from 'three';
import type { WorldContext } from '../world/WorldContext';
import type { WorldBuilder } from '../world/Builders';
import type { Collider } from '../physics/Collision';
import type { PlayerController } from '../player/PlayerController';
import { UseSpot } from './Interactables';
import { smoothstep } from '../core/math';

/**
 * Glass capsule elevator in a round glass shaft. The cabin floor and walls are real colliders
 * that move vertically; a player inside is carried with the cabin (movement locked while it
 * travels). Landing doors at every stop only open when the cabin is there, so the shaft can
 * never be entered without the cabin.
 *
 * Stops are numbered from the bottom. Buttons: "Subir"/"Descer" inside, "Chamar" outside.
 */

export interface ElevatorStop {
  y: number;
  name: string;
}

export interface ElevatorSpec {
  id: string;
  x: number;
  z: number;
  /** Cabin radius. */
  r: number;
  stops: ElevatorStop[];
  /** Angle (atan2(z, x) convention) of the door, e.g. −π/2 = faces −Z. */
  face: number;
  /** Top of the glass shaft. */
  top: number;
}

type Phase = 'open' | 'closing' | 'moving' | 'opening';

const CAB_H = 2.45;
const DOOR_HALF = 0.62; // metres, half of the door width

export class Elevator {
  private phase: Phase = 'open';
  private y: number;
  private from = 0;
  private stopIndex = 0;
  private target = 0;
  private t = 0;
  private duration = 1;
  private doors = 1;
  private readonly cabin = new THREE.Group();
  private readonly floorCol: Collider;
  private readonly wallCols: Array<{ c: Collider }> = [];
  private readonly landing: Array<{ leaves: THREE.Object3D[]; col: Collider; y: number }> = [];
  private readonly spots: Array<{ spot: UseSpot; dy: number }> = [];
  private player: PlayerController | null = null;
  private readonly fx: number;
  private readonly fz: number;
  private readonly lamp: THREE.MeshStandardMaterial;
  private queue: number | null = null;
  private idle = 0;
  locksPlayer = false;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    private readonly spec: ElevatorSpec,
  ) {
    const m = b.mats;
    const { x, z, r } = spec;
    this.y = spec.stops[0].y;
    this.fx = Math.cos(spec.face);
    this.fz = Math.sin(spec.face);
    const shaftR = r + 0.3;
    const doorAng = DOOR_HALF / shaftR + 0.04;
    // three.js cylinder theta: point = (sin θ, cos θ); our angle φ: (cos φ, sin φ) → θ = π/2 − φ
    const theta = Math.PI / 2 - spec.face;
    const bottom = spec.stops[0].y;
    const H = spec.top - bottom;

    // ---- Shaft (static): glass tube with a vertical slot on the door side ----------------------
    const tube = new THREE.CylinderGeometry(shaftR, shaftR, H, 48, 1, true, theta + doorAng, Math.PI * 2 - doorAng * 2);
    b.place(tube, m.glass, x, bottom + H / 2, z, { cast: false, receive: false });
    tube.dispose();
    for (let i = 0; i < 8; i++) {
      const a = spec.face + doorAng + ((Math.PI * 2 - doorAng * 2) * i) / 7;
      b.cylinder(m.chrome, x + Math.cos(a) * shaftR, bottom, z + Math.sin(a) * shaftR, 0.035, 0.035, H, { segments: 8, cast: false });
    }
    for (const y of [bottom, spec.top]) b.torus(m.whiteCeramic, x, y, z, shaftR, 0.09, { rotX: Math.PI / 2, cast: false });
    b.cylinder(m.whiteCeramic, x, spec.top, z, shaftR + 0.12, shaftR + 0.12, 0.14, { segments: 48 });
    b.torus(m.emissiveCyan, x, spec.top - 0.02, z, shaftR + 0.05, 0.02, { rotX: Math.PI / 2, cast: false });
    // shaft colliders: arcs around everything but the door slot
    b.collision.addArc(x, z, shaftR - 0.05, shaftR + 0.12, spec.face + doorAng, spec.face + Math.PI * 2 - doorAng, bottom, spec.top, 14, 'glass');
    // door side between landings: solid glass panels
    const doorX = x + this.fx * shaftR;
    const doorZ = z + this.fz * shaftR;
    const tanRot = Math.atan2(this.fx, this.fz); // box along the tangent
    for (let i = 0; i < spec.stops.length; i++) {
      const y0 = spec.stops[i].y + CAB_H;
      const y1 = i + 1 < spec.stops.length ? spec.stops[i + 1].y : spec.top;
      if (y1 - y0 < 0.05) continue;
      b.box(m.glass, doorX, y0, doorZ, DOOR_HALF * 2 + 0.1, y1 - y0, 0.03, { rotY: tanRot, cast: false, receive: false });
      b.collision.addBox({ x: doorX, z: doorZ, sx: DOOR_HALF * 2 + 0.2, sz: 0.14, rotY: tanRot, minY: y0, maxY: y1, surface: 'glass' });
    }

    // ---- Landing doors (one pair per stop) ------------------------------------------------------
    const tx = -this.fz; // tangent
    const tz = this.fx;
    for (const [i, stop] of spec.stops.entries()) {
      const leaves: THREE.Object3D[] = [];
      for (const e of [-1, 1]) {
        const g = new THREE.Group();
        const pane = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF, CAB_H - 0.1, 0.03), m.glass);
        pane.position.y = (CAB_H - 0.1) / 2;
        const band = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF, 0.07, 0.035), m.cobaltCeramic);
        band.position.y = 1.05;
        g.add(pane, band);
        g.rotation.y = tanRot;
        g.userData.e = e;
        g.position.set(doorX + this.fx * 0.06 + (tx * e * DOOR_HALF) / 2, stop.y, doorZ + this.fz * 0.06 + (tz * e * DOOR_HALF) / 2);
        b.root.add(g);
        leaves.push(g);
      }
      const col = b.collision.addBox({ x: doorX + this.fx * 0.06, z: doorZ + this.fz * 0.06, sx: DOOR_HALF * 2 + 0.1, sz: 0.12, rotY: tanRot, minY: stop.y, maxY: stop.y + CAB_H, surface: 'glass' });
      this.landing.push({ leaves, col, y: stop.y });
      // header with the floor name and the call button
      b.box(m.cobaltCeramic, doorX + this.fx * 0.08, stop.y + CAB_H, doorZ + this.fz * 0.08, DOOR_HALF * 2 + 0.3, 0.16, 0.08, { rotY: tanRot, radius: 0.03, cast: false });
      const bx = doorX + this.fx * 0.12 + tx * (DOOR_HALF + 0.3);
      const bz = doorZ + this.fz * 0.12 + tz * (DOOR_HALF + 0.3);
      b.box(m.whiteCeramic, bx, stop.y + 1.0, bz, 0.16, 0.3, 0.04, { rotY: tanRot, radius: 0.02, cast: false });
      b.sphere(m.emissiveCyan, bx + this.fx * 0.025, stop.y + 1.15, bz + this.fz * 0.025, 0.028, { cast: false });
      const idx = i;
      ctx.addInteractable(
        new UseSpot(
          `${spec.id}-call-${i}`,
          new THREE.Vector3(bx, stop.y + 1.12, bz),
          new THREE.Vector3(0.12, 0.2, 0.12),
          tanRot,
          () => (this.stopIndex === idx && this.phase === 'open' ? `Elevador aqui · ${stop.name}` : 'Chamar elevador'),
          () => this.request(idx),
          2.0,
        ),
      );
    }

    // ---- Cabin (moves) -----------------------------------------------------------------------------
    const cab = this.cabin;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 40), m.whiteCeramic);
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.018, 6, 48), m.emissiveCyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, CAB_H, 40, 1, true, theta + DOOR_HALF / r + 0.06, Math.PI * 2 - (DOOR_HALF / r + 0.06) * 2), m.glass);
    wall.position.y = CAB_H / 2;
    const roof = new THREE.Mesh(new THREE.SphereGeometry(r + 0.05, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.whiteCeramic);
    roof.scale.y = 0.35;
    roof.position.y = CAB_H;
    this.lamp = new THREE.MeshStandardMaterial({ name: 'elevatorLamp', color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1.6 });
    const light = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 32), this.lamp);
    light.rotation.x = Math.PI / 2;
    light.position.y = CAB_H - 0.01;
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r - 0.08, 0.02, 6, 40, Math.PI * 1.3), m.chrome);
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = spec.face + Math.PI - Math.PI * 0.65;
    rail.position.y = 0.95;
    // control panel opposite the door
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.04), m.cobaltCeramic);
    panel.position.set(-this.fx * (r - 0.06), 1.15, -this.fz * (r - 0.06));
    panel.rotation.y = tanRot;
    const up = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), m.emissiveCyan);
    up.position.set(-this.fx * (r - 0.09), 1.24, -this.fz * (r - 0.09));
    const down = up.clone();
    down.position.y = 1.06;
    cab.add(floor, ring, wall, roof, light, rail, panel, up, down);
    cab.position.set(x, this.y, z);
    b.root.add(cab);
    this.floorCol = b.collision.addCylinder({ x, z, r: r + 0.02, minY: this.y - 0.3, maxY: this.y, surface: 'metal' });
    // cabin wall colliders (segments around everything but the opening)
    const n = 10;
    const a0 = spec.face + DOOR_HALF / r + 0.06;
    const a1 = spec.face + Math.PI * 2 - DOOR_HALF / r - 0.06;
    for (let i = 0; i < n; i++) {
      const aa = a0 + ((a1 - a0) * i) / n;
      const ab = a0 + ((a1 - a0) * (i + 1)) / n;
      const c = b.collision.addSegment(x + Math.cos(aa) * r, z + Math.sin(aa) * r, x + Math.cos(ab) * r, z + Math.sin(ab) * r, 0.06, this.y, this.y + CAB_H, 'glass');
      this.wallCols.push({ c });
    }
    const px = x - this.fx * (r - 0.12);
    const pz = z - this.fz * (r - 0.12);
    const upSpot = new UseSpot(`${spec.id}-up`, new THREE.Vector3(px, this.y + 1.24, pz), new THREE.Vector3(0.12, 0.08, 0.12), tanRot, () => `Subir · ${this.nextName(1)}`, () => this.move(1), 2.0, () => this.canMove(1) && this.playerInside());
    const downSpot = new UseSpot(`${spec.id}-down`, new THREE.Vector3(px, this.y + 1.06, pz), new THREE.Vector3(0.12, 0.08, 0.12), tanRot, () => `Descer · ${this.nextName(-1)}`, () => this.move(-1), 2.0, () => this.canMove(-1) && this.playerInside());
    ctx.addInteractable(upSpot);
    ctx.addInteractable(downSpot);
    this.spots.push({ spot: upSpot, dy: 1.24 }, { spot: downSpot, dy: 1.06 });
    this.syncDoors();
  }

  bindPlayer(player: PlayerController): void {
    this.player = player;
  }

  get state(): { phase: Phase; y: number; stop: number; doors: number } {
    return { phase: this.phase, y: +this.y.toFixed(3), stop: this.stopIndex, doors: +this.doors.toFixed(2) };
  }

  private nextName(dir: number): string {
    const i = this.stopIndex + dir;
    return this.spec.stops[i]?.name ?? '';
  }

  private canMove(dir: number): boolean {
    const i = this.stopIndex + dir;
    return this.phase === 'open' && i >= 0 && i < this.spec.stops.length;
  }

  playerInside(): boolean {
    const p = this.player?.position;
    if (!p) return false;
    return Math.hypot(p.x - this.spec.x, p.z - this.spec.z) < this.spec.r - 0.12 && p.y > this.y - 0.4 && p.y < this.y + 1.2;
  }

  private inDoorway(): boolean {
    const p = this.player?.position;
    if (!p) return false;
    const dx = p.x - this.spec.x;
    const dz = p.z - this.spec.z;
    const radial = dx * this.fx + dz * this.fz;
    const lateral = Math.abs(-dx * this.fz + dz * this.fx);
    return radial > this.spec.r - 0.45 && radial < this.spec.r + 0.75 && lateral < DOOR_HALF + 0.1 && Math.abs(p.y - this.y) < 1.2;
  }

  /** Sends the cabin one stop up (+1) or down (−1). */
  move(dir: number): void {
    if (!this.canMove(dir)) return;
    this.request(this.stopIndex + dir);
  }

  request(i: number): void {
    if (i < 0 || i >= this.spec.stops.length) return;
    if (i === this.stopIndex && (this.phase === 'open' || this.phase === 'opening')) {
      this.phase = 'opening';
      return;
    }
    if (this.phase !== 'open') {
      this.queue = i;
      return;
    }
    this.target = i;
    this.phase = 'closing';
    this.ctx.audio.play('doorClose', { position: { x: this.spec.x, y: this.y + 1.5, z: this.spec.z }, volume: 0.6 });
  }

  /** Runs before the player update: moves the cabin and carries the player. */
  step(dt: number, carry: boolean): void {
    const inside = carry && this.playerInside();
    switch (this.phase) {
      case 'closing': {
        if (this.inDoorway()) {
          this.phase = 'opening';
          break;
        }
        this.doors = Math.max(0, this.doors - dt / 0.9);
        if (this.doors === 0) {
          this.phase = 'moving';
          this.from = this.y;
          this.t = 0;
          this.duration = Math.max(1.6, Math.abs(this.spec.stops[this.target].y - this.y) / 1.5);
          this.ctx.audio.play('elevatorMove', { position: { x: this.spec.x, y: this.y + 1.5, z: this.spec.z }, volume: 0.7 });
        }
        break;
      }
      case 'moving': {
        this.t += dt;
        const k = smoothstep(0, 1, this.t / this.duration);
        const ny = this.from + (this.spec.stops[this.target].y - this.from) * k;
        const dy = ny - this.y;
        this.y = ny;
        if (inside && dy !== 0) this.player!.carry(0, dy, 0);
        if (this.t >= this.duration) {
          this.stopIndex = this.target;
          this.phase = 'opening';
          this.ctx.audio.play('elevatorDing', { position: { x: this.spec.x, y: this.y + 2, z: this.spec.z } });
        }
        break;
      }
      case 'opening': {
        this.doors = Math.min(1, this.doors + dt / 0.9);
        if (this.doors === 1) {
          this.phase = 'open';
          this.idle = 0;
          if (this.queue !== null) {
            const q = this.queue;
            this.queue = null;
            this.request(q);
          }
        }
        break;
      }
      case 'open':
        this.idle += dt;
        break;
    }
    this.locksPlayer = inside && this.phase === 'moving';
    this.syncCabin();
    this.syncDoors();
  }

  private syncCabin(): void {
    this.cabin.position.y = this.y;
    this.floorCol.minY = this.y - 0.3;
    this.floorCol.maxY = this.y;
    for (const { c } of this.wallCols) {
      c.minY = this.y + 0.05;
      c.maxY = this.y + CAB_H;
    }
    // the cabin is closed by the landing doors while moving: block its opening too
    for (const s of this.spots) s.spot.position.y = this.y + s.dy;
    this.lamp.emissiveIntensity = this.phase === 'moving' ? 2.0 : 1.6;
  }

  private syncDoors(): void {
    const k = smoothstep(0, 1, this.doors);
    for (const [i, l] of this.landing.entries()) {
      const open = i === this.stopIndex && this.phase !== 'moving' ? k : 0;
      for (const g of l.leaves) {
        const e = g.userData.e as number;
        const slide = (e * DOOR_HALF) / 2 + e * DOOR_HALF * 0.95 * open;
        g.position.x = this.spec.x + this.fx * (this.spec.r + 0.36) - this.fz * slide;
        g.position.z = this.spec.z + this.fz * (this.spec.r + 0.36) + this.fx * slide;
      }
      l.col.enabled = open < 0.8;
    }
  }
}
