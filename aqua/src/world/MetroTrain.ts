import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { WorldBuilder } from './Builders';
import type { Collider, CollisionWorld } from '../physics/Collision';
import { yawFacing } from '../systems/Seats';
import { roundRect } from '../core/AssetManager';

/**
 * Aqua Metro trainset (3 cars, cab at both ends). Built procedurally in train-local space:
 * X across the car (−X = platform side), Y up (floor top at 0.05), Z along the track.
 * The whole group translates along Z; its colliders move with it and the interior is walkable.
 */
export const CAR_LENGTH = 13.2;
export const GANGWAY = 0.8;
export const CAR_PITCH = CAR_LENGTH + GANGWAY;
export const CAR_HALF_WIDTH = 1.5;
/** Door centres (train-local Z) on the platform side. */
export const DOOR_OFFSETS: number[] = [];
for (const car of [-1, 0, 1]) for (const d of [-3.2, 3.2]) DOOR_OFFSETS.push(car * CAR_PITCH + d);
export const TRAIN_HALF_LENGTH = CAR_PITCH + CAR_LENGTH / 2 + 2.2;

interface LocalCollider {
  c: Collider;
  lx: number;
  lz: number;
  door?: boolean;
}

export class MetroTrain {
  readonly group = new THREE.Group();
  /** Track centreline X. */
  readonly x: number;
  private readonly colliders: LocalCollider[] = [];
  private readonly leaves: Array<{ mesh: THREE.Object3D; closedZ: number; dir: number }> = [];
  private readonly screen: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private doorOpen = -1;
  private lastZ = Number.NaN;
  readonly interiorLight: THREE.MeshStandardMaterial;
  readonly mats: {
    paint: THREE.MeshPhysicalMaterial;
    glass: THREE.MeshPhysicalMaterial;
    floor: THREE.MeshStandardMaterial;
    light: THREE.MeshStandardMaterial;
    runLight: THREE.MeshStandardMaterial;
  };

  constructor(
    ctx: WorldContext,
    x: number,
    z: number,
    private readonly collision: CollisionWorld,
    addSeat: (lx: number, ly: number, lz: number, yaw: number) => void,
  ) {
    this.x = x;
    this.group.name = 'MetroTrain';
    this.group.position.set(x, 0, z);
    const m = ctx.mats;
    const paint = new THREE.MeshPhysicalMaterial({
      name: 'trainPaint',
      color: 0xf2f6fa,
      metalness: 0.25,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      iridescence: 0.18,
      iridescenceIOR: 1.25,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      name: 'trainGlass',
      color: 0x16455e,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1,
      envMapIntensity: 1.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.MeshStandardMaterial({ name: 'trainFloor', color: 0x6f8fa6, roughness: 0.75 });
    const light = new THREE.MeshStandardMaterial({ name: 'trainLight', color: 0xffffff, emissive: 0xeefcff, emissiveIntensity: 2.4 });
    const runLight = new THREE.MeshStandardMaterial({ name: 'trainRunLight', color: 0xbff6ff, emissive: 0x28c5df, emissiveIntensity: 2.2 });
    this.mats = { paint, glass, floor, light, runLight };
    this.interiorLight = light;
    const interiorWhite = new THREE.MeshStandardMaterial({ name: 'trainInterior', color: 0xf3f8fb, roughness: 0.5 });

    // Geometry is built in local space with its own builder and merged per material.
    const b = new WorldBuilder(this.group, collision, m, ctx.assets);
    this.screen = ctx.assets.dynamicCanvas(512, 128, 'trainScreen');
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false });
    const roofGeo = roofShell(CAR_LENGTH);

    for (const car of [-1, 0, 1]) {
      const zc = car * CAR_PITCH;
      const L = CAR_LENGTH;
      const cab = car === 0 ? 0 : car; // nose direction for end cars
      // floor & roof
      b.box(floor, 0, -0.3, zc, 2.94, 0.35, L, { cast: false });
      b.place(roofGeo, paint, 0, 0, zc);
      b.box(interiorWhite, 0, 2.28, zc, 2.86, 0.05, L - 0.1, { cast: false });
      b.box(light, 0, 2.25, zc, 0.32, 0.03, L - 1.2, { cast: false, receive: false });
      for (const s of [-1, 1]) b.box(light, s * 0.98, 2.2, zc, 0.06, 0.03, L - 1.2, { cast: false, receive: false });
      this.addCollider(0, -0.6, zc, 3.0, 0.65, L, false);
      this.addCollider(0, 2.3, zc, 3.0, 0.8, L, false);

      const segs: Array<[number, number]> = [
        [zc - L / 2, zc - 3.9],
        [zc - 2.5, zc + 2.5],
        [zc + 3.9, zc + L / 2],
      ];
      for (const s of [-1, 1]) {
        for (const [z0, z1] of segs) {
          const len = z1 - z0;
          const mid = (z0 + z1) / 2;
          b.box(paint, s * 1.47, -0.95, mid, 0.12, 1.95, len, { radius: 0.04 });
          b.box(m.cobaltCeramic, s * 1.53, 0.16, mid, 0.03, 0.38, len, { cast: false });
          b.box(runLight, s * 1.535, 0.6, mid, 0.02, 0.04, len, { cast: false, receive: false });
          b.box(m.cobaltCeramic, s * 1.53, -0.82, mid, 0.03, 0.12, len, { cast: false });
          b.box(glass, s * 1.47, 1.0, mid, 0.03, 1.3, len, { cast: false, receive: false });
          const pillars = Math.max(2, Math.round(len / 1.7) + 1);
          for (let i = 0; i < pillars; i++) {
            const pz = z0 + (len * i) / (pillars - 1);
            b.box(paint, s * 1.47, 1.0, pz, 0.13, 1.32, 0.12, { radius: 0.03, cast: false });
          }
          b.box(paint, s * 1.47, 2.3, mid, 0.13, 0.08, len, { cast: false });
          this.addCollider(s * 1.47, -1, mid, 0.2, 4, len, false);
          // interior: longitudinal seats facing the aisle (skip the cab end)
          const inCab = cab !== 0 && Math.sign(mid - zc) === cab && Math.abs(mid - zc) > 3;
          const sz0 = inCab ? (cab > 0 ? z0 + 0.3 : z0 + 1.9) : z0 + 0.3;
          const sz1 = inCab ? (cab > 0 ? z1 - 1.9 : z1 - 0.3) : z1 - 0.3;
          if (sz1 - sz0 > 0.9) {
            const smid = (sz0 + sz1) / 2;
            const slen = sz1 - sz0;
            b.box(interiorWhite, s * 1.14, 0.05, smid, 0.56, 0.4, slen, { radius: 0.06, cast: false });
            b.box(m.fabricCyan, s * 1.12, 0.45, smid, 0.54, 0.09, slen - 0.04, { radius: 0.04, cast: false });
            b.box(m.fabricCobalt, s * 1.36, 0.52, smid, 0.1, 0.55, slen - 0.04, { radius: 0.04, cast: false });
            this.addCollider(s * 1.15, 0.05, smid, 0.72, 0.9, slen, false);
            const n = Math.max(1, Math.floor(slen / 0.62));
            for (let i = 0; i < n; i++) {
              const lz = sz0 + (slen * (i + 0.5)) / n;
              addSeat(s * 1.1, 0.5, lz, yawFacing(-s, 0));
            }
          }
        }
        // doors: frame, header, skirt; platform side leaves animate, far side stays closed
        for (const d of [-3.2, 3.2]) {
          const dz = zc + d;
          for (const e of [-1, 1]) b.box(m.cobaltCeramic, s * 1.49, -0.95, dz + e * 0.74, 0.16, 3.25, 0.14, { radius: 0.04 });
          b.box(m.cobaltCeramic, s * 1.49, 2.05, dz, 0.16, 0.3, 1.5, { radius: 0.04 });
          b.box(paint, s * 1.47, -0.95, dz, 0.12, 0.98, 1.4, { cast: false });
          b.cylinder(m.chrome, s * 0.95, 0.05, dz - 0.85, 0.025, 0.025, 2.2, { segments: 10, cast: false });
          b.cylinder(m.chrome, s * 0.95, 0.05, dz + 0.85, 0.025, 0.025, 2.2, { segments: 10, cast: false });
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), screenMat);
          scr.position.set(s * 1.37, 2.08, dz);
          scr.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
          this.group.add(scr);
          if (s < 0) {
            for (const e of [-1, 1]) {
              const leaf = doorLeaf(paint, glass, m.cobaltCeramic, e);
              const closedZ = dz + e * 0.35;
              leaf.position.set(s * 1.53, 0.05, closedZ);
              this.group.add(leaf);
              this.leaves.push({ mesh: leaf, closedZ, dir: e });
            }
            this.addCollider(s * 1.47, -1, dz, 0.24, 4, 1.42, true);
          } else {
            b.box(paint, s * 1.49, 0.05, dz, 0.06, 2.0, 1.38, { cast: false });
            b.box(glass, s * 1.52, 1.0, dz, 0.02, 0.9, 1.0, { cast: false, receive: false });
            this.addCollider(s * 1.47, -1, dz, 0.2, 4, 1.42, false);
          }
        }
      }
      // overhead grab rails
      for (const s of [-1, 1]) {
        const rail = new THREE.CylinderGeometry(0.018, 0.018, L - 1, 8).rotateX(Math.PI / 2);
        b.place(rail, m.chrome, s * 0.7, 2.0, zc, { cast: false });
        rail.dispose();
      }
      // bogies
      for (const bz of [-4.4, 4.4]) {
        b.box(m.rubber, 0, -1.0, zc + bz, 2.3, 0.32, 2.6, { cast: false });
        for (const wx of [-0.72, 0.72]) {
          for (const wz of [-0.9, 0.9]) b.cylinder(m.brushedMetal, wx, -1.05, zc + bz + wz, 0.38, 0.38, 0.14, { rotZ: Math.PI / 2, segments: 20, cast: false });
        }
      }
      // cab: partition, nose, windscreen, lights
      if (cab !== 0) {
        const endZ = zc + cab * (L / 2);
        const partZ = zc + cab * (L / 2 - 1.6);
        b.box(interiorWhite, 0, 0.05, partZ, 2.9, 2.25, 0.1, { cast: false });
        b.box(glass, 0, 1.0, partZ - cab * 0.06, 1.2, 0.8, 0.03, { cast: false, receive: false });
        this.addCollider(0, 0, partZ, 3.0, 2.4, 0.2, false);
        const nose = new THREE.SphereGeometry(1, 40, 24, cab > 0 ? 0 : Math.PI, Math.PI, 0, Math.PI);
        nose.scale(1.52, 1.98, 2.25);
        b.place(nose, paint, 0, 1.03, endZ);
        nose.dispose();
        const shield = new THREE.SphereGeometry(1.012, 32, 16, (cab > 0 ? 0 : Math.PI) + 0.62, Math.PI - 1.24, 0.42, 0.78);
        shield.scale(1.52, 1.98, 2.25);
        b.place(shield, m.glossBlack, 0, 1.03, endZ, { cast: false });
        const chin = new THREE.SphereGeometry(1.008, 40, 6, cab > 0 ? 0 : Math.PI, Math.PI, 1.48, 0.22);
        chin.scale(1.52, 1.98, 2.25);
        b.place(chin, m.cobaltCeramic, 0, 1.03, endZ, { cast: false });
        chin.dispose();
        shield.dispose();
        for (const hx of [-0.8, 0.8]) b.sphere(runLight, hx, 0.42, endZ + cab * 1.62, 0.11, { cast: false });
        this.addCollider(0, -1, endZ + cab * 1.0, 3.0, 4, 2.0, false);
      } else {
        // gangways towards neighbours
        for (const g of [-1, 1]) {
          const gz = zc + g * (L / 2 + GANGWAY / 2);
          b.box(floor, 0, -0.3, gz, 1.2, 0.35, GANGWAY + 0.1, { cast: false });
          for (const s of [-1, 1]) {
            b.box(m.rubber, s * 1.0, -0.5, gz, 0.9, 2.95, GANGWAY, { radius: 0.12 });
            this.addCollider(s * 1.05, -1, gz, 1.0, 4, GANGWAY + 0.2, false);
          }
          b.box(m.rubber, 0, 2.15, gz, 1.2, 0.5, GANGWAY, { radius: 0.08, cast: false });
          this.addCollider(0, -0.6, gz, 1.2, 0.65, GANGWAY + 0.2, false);
        }
      }
      // livery wordmark near the doors
      const logo = ctx.assets.sign('AQUA Metro', '', '#28c5df');
      const logoMat = new THREE.MeshBasicMaterial({ map: logo, transparent: true, toneMapped: false });
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), logoMat);
        p.position.set(s * 1.545, -0.35, zc);
        p.rotation.y = s < 0 ? -Math.PI / 2 : Math.PI / 2;
        this.group.add(p);
      }
    }
    roofGeo.dispose();
    b.flush('train');
    b.disposeCache();
    this.setNextStop('Parque Flutuante');
    ctx.builder.root.add(this.group);
    this.setPosition(z);
    this.setDoors(1);
  }

  private addCollider(lx: number, minY: number, lz: number, sx: number, sy: number, sz: number, door: boolean): void {
    const c = this.collision.addBox({ x: this.x + lx, z: lz + this.group.position.z, sx, sz, minY, maxY: minY + sy, surface: 'metal' });
    this.colliders.push({ c, lx, lz, door });
  }

  /** Moves the whole trainset (and its colliders). Returns the Z delta. */
  setPosition(z: number): number {
    const dz = Number.isNaN(this.lastZ) ? 0 : z - this.lastZ;
    if (dz === 0 && !Number.isNaN(this.lastZ)) return 0;
    this.lastZ = z;
    this.group.position.z = z;
    this.group.updateMatrixWorld(true);
    for (const lc of this.colliders) this.collision.moveTo(lc.c, this.x + lc.lx, z + lc.lz);
    return dz;
  }

  get z(): number {
    return this.group.position.z;
  }

  /** 0 = closed, 1 = open (platform side). */
  setDoors(t: number): void {
    if (Math.abs(t - this.doorOpen) < 1e-4) return;
    this.doorOpen = t;
    const k = t * t * (3 - 2 * t);
    for (const l of this.leaves) l.mesh.position.z = l.closedZ + l.dir * 0.68 * k;
    for (const lc of this.colliders) if (lc.door) lc.c.enabled = t < 0.85;
  }

  /** True when a point is inside the passenger compartment. */
  contains(x: number, y: number, z: number): boolean {
    return Math.abs(x - this.x) < CAR_HALF_WIDTH && y > -0.6 && y < 3 && Math.abs(z - this.z) < CAR_PITCH + CAR_LENGTH / 2;
  }

  setNextStop(name: string): void {
    const { ctx, texture } = this.screen;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#0d2f86');
    g.addColorStop(1, '#0b2459');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#28c5df';
    roundRect(ctx, 14, 18, 72, 92, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 54px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('2', 50, 66);
    ctx.textAlign = 'left';
    ctx.font = '400 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#9fe6f2';
    ctx.fillText('Próxima estação · Next', 104, 40);
    ctx.font = '600 40px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 104, 84);
    ctx.fillStyle = '#9be22d';
    ctx.beginPath();
    ctx.arc(486, 64, 9, 0, Math.PI * 2);
    ctx.fill();
    texture.needsUpdate = true;
  }
}

/** Roof: elliptical shell from the window head up to the crown, extruded along the car. */
function roofShell(length: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = 1.53;
  const y0 = 2.32;
  const crown = 0.72;
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    const x = Math.cos(a) * w;
    const y = y0 + Math.sin(a) * crown;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const a = Math.PI - (i / steps) * Math.PI;
    shape.lineTo(Math.cos(a) * (w - 0.08), y0 + Math.sin(a) * (crown - 0.08));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -length / 2);
  return g;
}

const leafGeo = {
  lower: new THREE.BoxGeometry(0.05, 0.85, 0.7),
  top: new THREE.BoxGeometry(0.05, 0.14, 0.7),
  side: new THREE.BoxGeometry(0.05, 1.05, 0.11),
  win: new THREE.BoxGeometry(0.03, 1.05, 0.48),
  edge: new THREE.BoxGeometry(0.06, 2.02, 0.05),
};

/** Sliding door leaf: painted frame around a tall glass light, cobalt meeting edge. */
function doorLeaf(paint: THREE.Material, glass: THREE.Material, edge: THREE.Material, side: number): THREE.Group {
  const g = new THREE.Group();
  const lower = new THREE.Mesh(leafGeo.lower, paint);
  lower.position.y = 0.425;
  const top = new THREE.Mesh(leafGeo.top, paint);
  top.position.y = 1.95;
  const s1 = new THREE.Mesh(leafGeo.side, paint);
  s1.position.set(0, 1.375, 0.295);
  const s2 = new THREE.Mesh(leafGeo.side, paint);
  s2.position.set(0, 1.375, -0.295);
  const win = new THREE.Mesh(leafGeo.win, glass);
  win.position.y = 1.375;
  const strip = new THREE.Mesh(leafGeo.edge, edge);
  strip.position.set(0, 1.01, -side * 0.33);
  g.add(lower, top, s1, s2, win, strip);
  return g;
}
