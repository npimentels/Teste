import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import type { Collider } from '../physics/Collision';
import type { Updatable } from '../core/types';
import { UseSpot } from '../systems/Interactables';
import { damp } from '../core/math';

/**
 * Doors, curtains and "examine" spots shared by every interior. Each door owns its colliders
 * (closed and open positions), refuses to close onto the player and can be locked with a
 * message (e.g. an occupied hotel room).
 */

export type DoorStyle = 'room' | 'frosted' | 'glass';

export interface HingedDoorSpec {
  id: string;
  /** Hinge position. */
  x: number;
  z: number;
  y0?: number;
  width: number;
  height?: number;
  /** Direction (yaw, 0 = +X) the closed leaf extends from the hinge. */
  along: number;
  /** +1 swings counter-clockwise (seen from above), −1 clockwise. */
  swing: number;
  style?: DoorStyle;
  /** Returns a message when the door cannot be opened (locked), or null. */
  locked?: () => string | null;
  /** Closes by itself after this many seconds (0 = stays open). */
  autoClose?: number;
  /** Text shown in the prompt, e.g. "porta do quarto 101". */
  name?: string;
  /** Decorates the leaf (number plates, handles…). Local frame: leaf along +X from the hinge. */
  decorate?: (leaf: THREE.Group, w: number, h: number) => void;
}

function leafMaterials(b: WorldBuilder, style: DoorStyle): { panel: THREE.Material; trim: THREE.Material } {
  const m = b.mats;
  if (style === 'room') return { panel: m.whiteCeramic, trim: m.cobaltCeramic };
  if (style === 'frosted') return { panel: m.frostedGlass, trim: m.chrome };
  return { panel: m.glass, trim: m.chrome };
}

export class HingedDoor implements Updatable {
  open = false;
  private angle = 0;
  private timer = 0;
  private readonly pivot = new THREE.Group();
  private readonly closedCol: Collider;
  private readonly openCol: Collider;
  readonly hinge: THREE.Vector3;
  private readonly w: number;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    private readonly spec: HingedDoorSpec,
  ) {
    const y0 = spec.y0 ?? 0;
    const h = spec.height ?? 2.2;
    const w = spec.width;
    this.w = w;
    this.hinge = new THREE.Vector3(spec.x, y0, spec.z);
    const { panel, trim } = leafMaterials(b, spec.style ?? 'room');
    const leaf = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.02, 0.05), panel);
    slab.position.set(w / 2, h / 2, 0);
    slab.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, 0.08, 0.056), trim);
    stripe.position.set(w / 2, h * 0.45, 0);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.11), b.mats.chrome);
    handle.position.set(w - 0.12, h * 0.48, 0);
    leaf.add(slab, stripe, handle);
    spec.decorate?.(leaf, w, h);
    this.pivot.add(leaf);
    this.pivot.position.copy(this.hinge);
    this.pivot.rotation.y = spec.along;
    b.root.add(this.pivot);
    // colliders: along the closed leaf, and along the fully open leaf
    const seg = (a: number) => {
      const ex = spec.x + Math.cos(a) * w;
      const ez = spec.z - Math.sin(a) * w;
      return b.collision.addSegment(spec.x + Math.cos(a) * 0.08, spec.z - Math.sin(a) * 0.08, ex, ez, 0.08, y0, y0 + h, 'tile');
    };
    this.closedCol = seg(spec.along);
    this.openCol = seg(spec.along + spec.swing * 1.6);
    this.openCol.enabled = false;
    const mid = new THREE.Vector3(spec.x + (Math.cos(spec.along) * w) / 2, y0 + h * 0.5, spec.z - (Math.sin(spec.along) * w) / 2);
    const name = spec.name ?? 'porta';
    ctx.addInteractable(
      new UseSpot(spec.id, mid, new THREE.Vector3(w / 2, h / 2, 0.14), spec.along, () => (this.open ? `Fechar ${name}` : `Abrir ${name}`), () => this.toggle(), 2.4, () => Math.abs(this.angle - this.target) < 0.6),
    );
    ctx.addUpdatable(this);
  }

  private get target(): number {
    return this.open ? 1 : 0;
  }

  toggle(): void {
    if (!this.open) {
      const msg = this.spec.locked?.() ?? null;
      if (msg) {
        this.ctx.audio.play('error', { position: this.hinge });
        this.ctx.showCard(msg, 4);
        return;
      }
    } else {
      // never close onto the player
      const v = this.ctx.viewer;
      if (Math.hypot(v.x - this.hinge.x, v.z - this.hinge.z) < this.w + 0.25 && this.inSwing(v)) {
        this.ctx.audio.play('error', { position: this.hinge });
        return;
      }
    }
    this.open = !this.open;
    this.timer = this.open ? (this.spec.autoClose ?? 0) : 0;
    this.ctx.audio.play('stallDoor', { position: this.hinge });
  }

  /** Is the point within the sector swept by the leaf? */
  private inSwing(p: THREE.Vector3): boolean {
    const a = Math.atan2(-(p.z - this.hinge.z), p.x - this.hinge.x);
    let d = (a - this.spec.along) * this.spec.swing;
    while (d < -Math.PI) d += Math.PI * 2;
    while (d > Math.PI) d -= Math.PI * 2;
    return d > -0.25 && d < 1.85;
  }

  update(dt: number): void {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0 && this.open) {
        const v = this.ctx.viewer;
        if (Math.hypot(v.x - this.hinge.x, v.z - this.hinge.z) < this.w + 0.6) this.timer = 2;
        else this.toggle();
      }
    }
    const t = this.target;
    if (this.angle === t) return;
    this.angle = damp(this.angle, t, 6, dt);
    if (Math.abs(this.angle - t) < 0.002) this.angle = t;
    this.pivot.rotation.y = this.spec.along + this.spec.swing * 1.6 * this.angle;
    this.closedCol.enabled = this.angle < 0.15;
    this.openCol.enabled = this.angle > 0.85;
  }
}

export interface SlidingDoorSpec {
  id: string;
  /** Centre of the opening. */
  x: number;
  z: number;
  y0?: number;
  width: number;
  height?: number;
  /** Axis the wall runs along. */
  axis: 'x' | 'z';
  style?: DoorStyle;
  /** Opens automatically when the viewer is within this distance (0 = never). */
  sensor?: number;
  /** Extra condition (e.g. a booked room). */
  allowed?: () => boolean;
}

/** Automatic sliding double door (glass or frosted). */
export class SlidingDoor implements Updatable {
  private open = 0;
  private readonly leaves: Array<{ g: THREE.Object3D; closed: number; dir: number }> = [];
  private readonly collider: Collider;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    private readonly spec: SlidingDoorSpec,
  ) {
    const y0 = spec.y0 ?? 0;
    const h = spec.height ?? 2.4;
    const half = spec.width / 2;
    const { panel, trim } = leafMaterials(b, spec.style ?? 'glass');
    for (const e of [-1, 1]) {
      const g = new THREE.Group();
      const along = spec.axis === 'x';
      const pane = new THREE.Mesh(new THREE.BoxGeometry(along ? half : 0.04, h, along ? 0.04 : half), panel);
      pane.position.y = h / 2;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(along ? half : 0.05, 0.09, along ? 0.05 : half), b.mats.cobaltCeramic);
      bar.position.y = h * 0.45;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.04 : 0.06, h, along ? 0.06 : 0.04), trim);
      edge.position.set(along ? (-e * half) / 2 : 0, h / 2, along ? 0 : (-e * half) / 2);
      g.add(pane, bar, edge);
      const closed = (along ? spec.x : spec.z) + (e * half) / 2;
      g.position.set(along ? closed : spec.x, y0, along ? spec.z : closed);
      b.root.add(g);
      this.leaves.push({ g, closed, dir: e });
    }
    this.collider = b.collision.addBox({ x: spec.x, z: spec.z, sx: spec.axis === 'x' ? spec.width : 0.12, sz: spec.axis === 'x' ? 0.12 : spec.width, minY: y0, maxY: y0 + h, surface: 'glass' });
    ctx.addUpdatable(this);
  }

  update(dt: number): void {
    const v = this.ctx.viewer;
    const y0 = this.spec.y0 ?? 0;
    const near = Math.hypot(v.x - this.spec.x, v.z - this.spec.z) < (this.spec.sensor ?? 2.4) && Math.abs(v.y - (y0 + 1.6)) < 1.6;
    const want = near && (this.spec.allowed?.() ?? true) ? 1 : 0;
    if (this.open === want) return;
    this.open = damp(this.open, want, want ? 6 : 3, dt);
    if (Math.abs(this.open - want) < 0.002) this.open = want;
    const travel = this.spec.width / 2 - 0.04;
    for (const l of this.leaves) {
      const p = l.closed + l.dir * travel * this.open;
      if (this.spec.axis === 'x') l.g.position.x = p;
      else l.g.position.z = p;
    }
    this.collider.enabled = this.open < 0.7;
  }
}

export interface CurtainSpec {
  id: string;
  /** Window line from (x0, z0) to (x1, z1); curtains hang on the room side (`side` normal). */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Unit normal pointing into the room. */
  nx: number;
  nz: number;
  y0: number;
  height: number;
  color?: THREE.ColorRepresentation;
  open?: boolean;
}

/** Pleated sheer curtains (two panels) that gather to the sides. */
export class Curtains implements Updatable {
  open: boolean;
  private k: number;
  private readonly panels: THREE.Mesh[] = [];
  private readonly len: number;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    private readonly spec: CurtainSpec,
  ) {
    this.open = spec.open ?? true;
    this.k = this.open ? 1 : 0;
    const len = Math.hypot(spec.x1 - spec.x0, spec.z1 - spec.z0);
    this.len = len;
    const ux = (spec.x1 - spec.x0) / len;
    const uz = (spec.z1 - spec.z0) / len;
    const rot = Math.atan2(-uz, ux);
    const mat = new THREE.MeshPhysicalMaterial({ name: 'curtain', color: spec.color ?? 0xf4fbff, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xcfeaff), transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const half = len / 2;
    for (const e of [0, 1]) {
      const geo = new THREE.PlaneGeometry(half, spec.height, 48, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin((x / half) * Math.PI * 14) * 0.035);
      }
      geo.computeVertexNormals();
      // pivot at the outer edge so scaling gathers the panel towards the side
      geo.translate(e === 0 ? half / 2 : -half / 2, spec.height / 2, 0);
      const mesh = new THREE.Mesh(geo, mat);
      const ax = e === 0 ? spec.x0 : spec.x1;
      const az = e === 0 ? spec.z0 : spec.z1;
      mesh.position.set(ax + spec.nx * 0.12, spec.y0, az + spec.nz * 0.12);
      mesh.rotation.y = rot;
      b.root.add(mesh);
      this.panels.push(mesh);
    }
    // track
    b.box(b.mats.chrome, (spec.x0 + spec.x1) / 2 + spec.nx * 0.12, spec.y0 + spec.height, (spec.z0 + spec.z1) / 2 + spec.nz * 0.12, len, 0.03, 0.04, { rotY: rot, cast: false });
    this.apply();
    const mid = new THREE.Vector3((spec.x0 + spec.x1) / 2 + spec.nx * 0.2, spec.y0 + 1.2, (spec.z0 + spec.z1) / 2 + spec.nz * 0.2);
    ctx.addInteractable(new UseSpot(spec.id, mid, new THREE.Vector3(half, 1.0, 0.25), rot, () => (this.open ? 'Fechar cortinas' : 'Abrir cortinas'), () => this.toggle(), 2.8));
    ctx.addUpdatable(this);
  }

  toggle(): void {
    this.open = !this.open;
    this.ctx.audio.play('stand', { position: { x: (this.spec.x0 + this.spec.x1) / 2, y: 1.5, z: (this.spec.z0 + this.spec.z1) / 2 }, volume: 0.6 });
  }

  private apply(): void {
    const s = 1 - this.k * 0.84;
    for (const p of this.panels) p.scale.x = s;
  }

  update(dt: number): void {
    const t = this.open ? 1 : 0;
    if (this.k === t) return;
    this.k = damp(this.k, t, 3.5, dt);
    if (Math.abs(this.k - t) < 0.002) this.k = t;
    this.apply();
  }

  get length(): number {
    return this.len;
  }
}

/** "Examinar …" spot that shows an information card. */
export function examine(ctx: WorldContext, id: string, center: THREE.Vector3, half: THREE.Vector3, label: string, html: string, rotY = 0, reach = 2.4): void {
  ctx.addInteractable(new UseSpot(id, center, half, rotY, () => label, () => ctx.showCard(html, 7), reach));
}
