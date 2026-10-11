import * as THREE from 'three';
import type { WorldBuilder } from './Builders';
import type { AssetManager } from '../core/AssetManager';
import { roundRect } from '../core/AssetManager';
import { createRng, randRange } from '../core/math';

/**
 * Interior furniture kit (lounge, hotel): tub chairs, sofas, beds, nightstands, wardrobes,
 * desks, bookshelves, tables, poufs and generated art panels. Everything is batched by
 * material, collides where it should, and seating pieces return seat points for the shared
 * sit / lie system. Facing angles use atan2(dx, dz) (0 = facing +Z).
 */

export interface SeatPoint {
  x: number;
  y: number;
  z: number;
}

const cache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

export function disposeInteriorCache(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
}

/** Shared soft bedding / upholstery materials. */
export function fabric(name: 'linen' | 'pearl' | 'mist' | 'lagoon' | 'coral'): THREE.MeshPhysicalMaterial {
  let m = matCache.get(name) as THREE.MeshPhysicalMaterial | undefined;
  if (!m) {
    const colors = { linen: 0xf7fbff, pearl: 0xeef4fb, mist: 0xcfe9f7, lagoon: 0x3fb6d8, coral: 0xb9e86a };
    m = new THREE.MeshPhysicalMaterial({ name: `fabric:${name}`, color: colors[name], roughness: 0.92, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xdff3ff) });
    matCache.set(name, m);
  }
  return m;
}

const fwd = (face: number): [number, number] => [Math.sin(face), Math.cos(face)];
/** Builder rotY that turns local +Z towards `face`. */
const rotFor = (face: number): number => face;

/** Rounded tub armchair (glossy shell, fabric cushion). Returns the seat point. */
export function tubChair(b: WorldBuilder, x: number, z: number, face: number, shell: THREE.Material, cushion: THREE.Material, y0 = 0): SeatPoint {
  const outer = cached('tubOuter', () =>
    new THREE.LatheGeometry(
      [new THREE.Vector2(0.34, 0), new THREE.Vector2(0.42, 0.05), new THREE.Vector2(0.46, 0.35), new THREE.Vector2(0.44, 0.72), new THREE.Vector2(0.38, 0.76), new THREE.Vector2(0.37, 0.7)],
      40,
      Math.PI * 0.28,
      Math.PI * 1.44,
    ),
  );
  // the lathe gap (phi ≈ 0) is the opening, on local +Z → turned towards `face`
  b.place(outer, shell, x, y0, z, { rotY: rotFor(face) });
  b.cylinder(cushion, x, y0 + 0.28, z, 0.38, 0.4, 0.16, { segments: 28 });
  b.cylinder(b.mats.chrome, x, y0, z, 0.3, 0.32, 0.03, { segments: 24, cast: false });
  b.collision.addCylinder({ x, z, r: 0.45, minY: y0, maxY: y0 + 0.78, surface: 'tile' });
  const [fx, fz] = fwd(face);
  return { x: x + fx * 0.05, y: y0 + 0.44, z: z + fz * 0.05 };
}

/** Straight sofa with rounded arms; returns one seat point per cushion. */
export function sofa(b: WorldBuilder, x: number, z: number, face: number, length: number, frame: THREE.Material, cushion: THREE.Material, y0 = 0): SeatPoint[] {
  const [fx, fz] = fwd(face);
  const rot = rotFor(face);
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  b.box(frame, x, y0 + 0.06, z, length, 0.32, 0.9, { rotY: rot, radius: 0.12 });
  b.box(frame, x - fx * 0.36, y0 + 0.06, z - fz * 0.36, length, 0.82, 0.22, { rotY: rot, radius: 0.1 });
  b.box(b.mats.emissiveCyan, x, y0 + 0.02, z, length - 0.2, 0.02, 0.7, { rotY: rot, cast: false, receive: false }); // under-sofa glow
  const n = Math.max(1, Math.round((length - 0.5) / 0.75));
  const seats: SeatPoint[] = [];
  const inner = length - 0.5;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const cx = x + ax * t * inner + fx * 0.06;
    const cz = z + az * t * inner + fz * 0.06;
    b.box(cushion, cx, y0 + 0.38, cz, inner / n - 0.03, 0.14, 0.68, { rotY: rot, radius: 0.06 });
    b.box(cushion, cx - fx * 0.3, y0 + 0.52, cz - fz * 0.3, inner / n - 0.05, 0.42, 0.16, { rotY: rot, radius: 0.07 });
    seats.push({ x: cx + fx * 0.04, y: y0 + 0.52, z: cz + fz * 0.04 });
  }
  for (const e of [-1, 1]) {
    const px = x + ax * e * (length / 2 - 0.12);
    const pz = z + az * e * (length / 2 - 0.12);
    const arm = cached('sofaArm', () => new THREE.CapsuleGeometry(0.13, 0.62, 6, 14).rotateX(Math.PI / 2));
    b.place(arm, frame, px, y0 + 0.55, pz, { rotY: rot });
  }
  b.collision.addBox({ x, z, sx: length, sz: 0.92, rotY: rot, minY: y0, maxY: y0 + 0.88, surface: 'tile' });
  return seats;
}

export interface BedOptions {
  y0?: number;
  width?: number;
  length?: number;
  duvet: THREE.Material;
  accent: THREE.Material;
  headboard: THREE.Material;
  frame?: THREE.Material;
}

/**
 * Bed with a padded headboard, mattress, duvet, folded throw and pillows. `face` is the
 * direction from the headboard towards the foot. Returns where to sit (side edge) and where to
 * lie (pillow).
 */
export function bed(b: WorldBuilder, x: number, z: number, face: number, o: BedOptions): { sit: SeatPoint[]; lie: SeatPoint; sideX: number; sideZ: number } {
  const y0 = o.y0 ?? 0;
  const w = o.width ?? 1.8;
  const len = o.length ?? 2.1;
  const m = b.mats;
  const rot = rotFor(face);
  const [fx, fz] = fwd(face);
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  const linen = fabric('linen');
  b.box(o.frame ?? m.whiteCeramic, x, y0 + 0.08, z, w + 0.1, 0.24, len + 0.06, { rotY: rot, radius: 0.08 });
  b.box(m.emissiveCyan, x, y0 + 0.03, z, w - 0.1, 0.02, len - 0.1, { rotY: rot, cast: false, receive: false });
  b.box(linen, x, y0 + 0.3, z, w, 0.22, len, { rotY: rot, radius: 0.08 });
  // duvet covering the lower 70 %, with a folded edge
  const dc = len * 0.15;
  b.box(o.duvet, x + fx * dc, y0 + 0.47, z + fz * dc, w + 0.06, 0.09, len * 0.7, { rotY: rot, radius: 0.04 });
  b.box(linen, x - fx * (len * 0.2 - 0.04), y0 + 0.5, z - fz * (len * 0.2 - 0.04), w + 0.04, 0.05, 0.2, { rotY: rot, radius: 0.02 });
  b.box(o.accent, x + fx * (len * 0.36), y0 + 0.555, z + fz * (len * 0.36), w + 0.08, 0.03, 0.42, { rotY: rot, radius: 0.012 });
  // pillows
  const pillow = cached('pillow', () => new THREE.CapsuleGeometry(0.11, 0.42, 6, 14).rotateZ(Math.PI / 2).scale(1, 0.8, 1.5));
  const hx = x - fx * (len / 2 - 0.3);
  const hz = z - fz * (len / 2 - 0.3);
  for (const e of [-1, 1]) b.place(pillow, linen, hx + ax * e * w * 0.24, y0 + 0.55, hz + az * e * w * 0.24, { rotY: rot });
  b.place(pillow, o.accent, hx + fx * 0.22, y0 + 0.56, hz + fz * 0.22, { rotY: rot });
  // padded headboard
  const bx = x - fx * (len / 2 + 0.07);
  const bz = z - fz * (len / 2 + 0.07);
  b.box(o.headboard, bx, y0, bz, w + 0.5, 1.25, 0.14, { rotY: rot, radius: 0.07 });
  b.box(o.accent, bx + fx * 0.075, y0 + 0.85, bz + fz * 0.075, w + 0.3, 0.05, 0.02, { rotY: rot, cast: false });
  b.collision.addBox({ x, z, sx: w + 0.1, sz: len + 0.1, rotY: rot, minY: y0, maxY: y0 + 0.56, surface: 'tile' });
  b.collision.addBox({ x: bx, z: bz, sx: w + 0.5, sz: 0.16, rotY: rot, minY: y0, maxY: y0 + 1.25, surface: 'tile' });
  const sideX = x + ax * (w / 2 - 0.12);
  const sideZ = z + az * (w / 2 - 0.12);
  return {
    sit: [
      { x: sideX + fx * 0.2, y: y0 + 0.5, z: sideZ + fz * 0.2 },
      { x: x - ax * (w / 2 - 0.12) + fx * 0.2, y: y0 + 0.5, z: z - az * (w / 2 - 0.12) + fz * 0.2 },
    ],
    lie: { x: hx + fx * 0.12, y: y0 + 0.55, z: hz + fz * 0.12 },
    sideX,
    sideZ,
  };
}

/** Round bed on a glowing plinth with a curved headboard arc behind (towards −face). */
export function roundBed(b: WorldBuilder, x: number, z: number, face: number, r: number, o: BedOptions): { sit: SeatPoint[]; lie: SeatPoint } {
  const y0 = o.y0 ?? 0;
  const m = b.mats;
  const linen = fabric('linen');
  const [fx, fz] = fwd(face);
  b.cylinder(o.frame ?? m.whiteCeramic, x, y0 + 0.06, z, r + 0.08, r + 0.02, 0.26, { segments: 48 });
  b.torus(m.emissiveCyan, x, y0 + 0.05, z, r - 0.05, 0.02, { rotX: Math.PI / 2, cast: false });
  b.cylinder(linen, x, y0 + 0.3, z, r, r, 0.22, { segments: 48 });
  b.cylinder(o.duvet, x + fx * 0.25, y0 + 0.5, z + fz * 0.25, r - 0.18, r - 0.12, 0.07, { segments: 40 });
  const pillow = cached('pillow', () => new THREE.CapsuleGeometry(0.11, 0.42, 6, 14).rotateZ(Math.PI / 2).scale(1, 0.8, 1.5));
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  const hx = x - fx * (r - 0.35);
  const hz = z - fz * (r - 0.35);
  for (const e of [-1, 1]) b.place(pillow, linen, hx + ax * e * 0.36, y0 + 0.55, hz + az * e * 0.36, { rotY: face });
  b.place(pillow, o.accent, hx + fx * 0.22, y0 + 0.56, hz + fz * 0.22, { rotY: face });
  b.collision.addCylinder({ x, z, r: r + 0.08, minY: y0, maxY: y0 + 0.56, surface: 'tile' });
  return {
    sit: [{ x: x + fx * (r - 0.2), y: y0 + 0.5, z: z + fz * (r - 0.2) }],
    lie: { x: hx + fx * 0.12, y: y0 + 0.55, z: hz + fz * 0.12 },
  };
}

/** Floating nightstand with a drawer line, chrome pull and an under-glow. Returns the top height. */
export function nightstand(b: WorldBuilder, x: number, z: number, face: number, body: THREE.Material, y0 = 0): number {
  const m = b.mats;
  const rot = rotFor(face);
  const [fx, fz] = fwd(face);
  b.box(body, x, y0 + 0.12, z, 0.48, 0.42, 0.4, { rotY: rot, radius: 0.08 });
  b.box(m.glossBlack, x + fx * 0.2, y0 + 0.33, z + fz * 0.2, 0.36, 0.01, 0.01, { rotY: rot, cast: false });
  b.box(m.chrome, x + fx * 0.205, y0 + 0.26, z + fz * 0.205, 0.12, 0.02, 0.015, { rotY: rot, cast: false });
  b.box(m.emissiveCyan, x, y0 + 0.1, z, 0.38, 0.015, 0.3, { rotY: rot, cast: false, receive: false });
  b.collision.addBox({ x, z, sx: 0.5, sz: 0.42, rotY: rot, minY: y0, maxY: y0 + 0.55, surface: 'tile' });
  return y0 + 0.54;
}

/** Tall rounded wardrobe with two doors. */
export function wardrobe(b: WorldBuilder, x: number, z: number, face: number, w: number, y0 = 0, body?: THREE.Material): void {
  const m = b.mats;
  const rot = rotFor(face);
  const [fx, fz] = fwd(face);
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  b.box(body ?? m.whiteCeramic, x, y0, z, w, 2.3, 0.6, { rotY: rot, radius: 0.1 });
  b.box(m.glossBlack, x + fx * 0.301, y0 + 0.1, z + fz * 0.301, 0.012, 2.05, 0.012, { rotY: rot, cast: false });
  for (const e of [-1, 1]) b.box(m.chrome, x + fx * 0.31 + ax * e * 0.08, y0 + 1.05, z + fz * 0.31 + az * e * 0.08, 0.02, 0.5, 0.025, { rotY: rot, cast: false });
  b.box(m.cyanAcrylic, x + fx * 0.302, y0 + 2.05, z + fz * 0.302, w - 0.2, 0.04, 0.01, { rotY: rot, cast: false });
  b.collision.addBox({ x, z, sx: w, sz: 0.62, rotY: rot, minY: y0, maxY: y0 + 2.3, surface: 'tile' });
}

/** Desk with a rounded top on chrome legs, plus a tub chair. Returns the chair seat. */
export function desk(b: WorldBuilder, x: number, z: number, face: number, w: number, chairShell: THREE.Material, chairCushion: THREE.Material, y0 = 0): SeatPoint {
  const m = b.mats;
  const rot = rotFor(face);
  const [fx, fz] = fwd(face);
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  b.box(m.whiteCeramic, x, y0 + 0.72, z, w, 0.05, 0.62, { rotY: rot, radius: 0.025 });
  b.box(m.cyanAcrylic, x, y0 + 0.7, z, w - 0.1, 0.02, 0.56, { rotY: rot, cast: false });
  for (const e of [-1, 1]) b.box(m.chrome, x + ax * e * (w / 2 - 0.06), y0, z + az * e * (w / 2 - 0.06), 0.04, 0.72, 0.5, { rotY: rot, cast: false });
  b.collision.addBox({ x, z, sx: w, sz: 0.62, rotY: rot, minY: y0, maxY: y0 + 0.77, surface: 'tile' });
  // `face` points from the desk to the user: the chair sits there, facing the desk
  return tubChair(b, x + fx * 0.85, z + fz * 0.85, face + Math.PI, chairShell, chairCushion, y0);
}

/** Open bookshelf with books, glass objects and a plant gap. */
export function bookshelf(b: WorldBuilder, x: number, z: number, face: number, w: number, h: number, seed: number, y0 = 0): void {
  const m = b.mats;
  const rot = rotFor(face);
  const [fx, fz] = fwd(face);
  const ax = Math.cos(face);
  const az = -Math.sin(face);
  b.box(m.whiteCeramic, x - fx * 0.15, y0, z - fz * 0.15, w, h, 0.04, { rotY: rot, cast: false });
  for (const e of [-1, 1]) b.box(m.whiteCeramic, x + ax * e * (w / 2 - 0.02), y0, z + az * e * (w / 2 - 0.02), 0.04, h, 0.34, { rotY: rot, cast: false });
  const shelves = Math.max(2, Math.floor(h / 0.38));
  const bookMats = [m.cobaltCeramic, m.limeGlossy, m.glossyCyan, m.whiteCeramic, m.glossyBlue];
  const rng = createRng(seed);
  for (let s = 0; s <= shelves; s++) {
    const y = y0 + (s * h) / shelves;
    b.box(m.whiteCeramic, x, y - 0.02, z, w, 0.03, 0.34, { rotY: rot, cast: false });
    if (s === shelves) continue;
    let t = -w / 2 + 0.06;
    while (t < w / 2 - 0.1) {
      const r = rng();
      if (r < 0.12) {
        // glass vase
        b.sphere(m.glass, x + ax * (t + 0.07), y + 0.08, z + az * (t + 0.07), 0.07, { cast: false });
        t += 0.18;
        continue;
      }
      const bw = randRange(rng, 0.025, 0.05);
      const bh = randRange(rng, 0.2, 0.3);
      b.box(bookMats[Math.floor(rng() * bookMats.length)], x + ax * (t + bw / 2), y, z + az * (t + bw / 2), bw, bh, 0.22, { rotY: rot, cast: false });
      t += bw + 0.004;
      if (rng() < 0.08) t += 0.14;
    }
  }
  b.collision.addBox({ x, z, sx: w, sz: 0.36, rotY: rot, minY: y0, maxY: y0 + h, surface: 'tile' });
}

/** Round table: chrome stem, glossy top (glass or white). */
export function roundTable(b: WorldBuilder, x: number, z: number, r: number, h: number, top: THREE.Material, y0 = 0): number {
  const m = b.mats;
  b.cylinder(m.cobaltCeramic, x, y0, z, r * 0.45, r * 0.5, 0.04, { segments: 28 });
  b.cylinder(m.chrome, x, y0 + 0.04, z, 0.04, 0.04, h - 0.07, { segments: 10, cast: false });
  b.cylinder(top, x, y0 + h - 0.03, z, r, r, 0.03, { segments: 36, cast: false });
  b.torus(m.chrome, x, y0 + h - 0.015, z, r, 0.012, { rotX: Math.PI / 2, cast: false });
  b.collision.addCylinder({ x, z, r: r * 0.9, minY: y0, maxY: y0 + Math.max(h, 0.6), surface: 'glass' });
  return y0 + h;
}

/** Soft pouf; returns the seat point. */
export function pouf(b: WorldBuilder, x: number, z: number, r: number, mat: THREE.Material, y0 = 0): SeatPoint {
  const g = cached(`pouf:${r.toFixed(2)}`, () => new THREE.SphereGeometry(r, 28, 16).scale(1, 0.55, 1));
  b.place(g, mat, x, y0 + r * 0.5, z);
  b.collision.addCylinder({ x, z, r, minY: y0, maxY: y0 + r, surface: 'tile' });
  return { x, y: y0 + r * 1.02, z };
}

/** Rectangular rug (soft border, flat). */
export function rugRect(b: WorldBuilder, x: number, z: number, w: number, d: number, rotY: number, mat: THREE.Material, y0 = 0): void {
  b.box(mat, x, y0 + 0.022, z, w, 0.012, d, { rotY, radius: 0.005, cast: false });
}

/** Small decor on a surface: stacked magazines, a glass bottle, a little plant cup. */
export function tableDecor(b: WorldBuilder, x: number, y: number, z: number, seed: number): void {
  const m = b.mats;
  const rng = createRng(seed);
  const mags = [m.cobaltCeramic, m.whiteCeramic, m.limeGlossy];
  for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) b.box(mags[i % 3], x + randRange(rng, -0.03, 0.03), y + i * 0.012, z, 0.22, 0.01, 0.29, { rotY: randRange(rng, -0.3, 0.3), cast: false });
  b.sphere(m.glass, x + 0.22, y + 0.06, z - 0.08, 0.06, { cast: false });
  b.cylinder(m.limeGlossy, x - 0.2, y, z + 0.1, 0.045, 0.035, 0.08, { segments: 14, cast: false });
}

// -----------------------------------------------------------------------------------------
// Art panels: generated Frutiger landscapes (sky, hills, bubbles, water) in glossy frames
// -----------------------------------------------------------------------------------------

export function artTexture(assets: AssetManager, seed: number, w = 512, h = 320): THREE.CanvasTexture {
  const { ctx: c, texture } = assets.dynamicCanvas(w, h, `art-${seed}`);
  const rng = createRng(seed * 977 + 13);
  const sky = c.createLinearGradient(0, 0, 0, h);
  const top = ['#1d6fe0', '#2a8ff0', '#3aa0f5', '#1747b5'][seed % 4];
  sky.addColorStop(0, top);
  sky.addColorStop(0.65, '#bfe9ff');
  sky.addColorStop(1, '#e8fbff');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  // clouds
  for (let i = 0; i < 5; i++) {
    const cx = rng() * w;
    const cy = h * randRange(rng, 0.12, 0.42);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(cx + (k - 2) * w * 0.03, cy - Math.sin(k) * 8, w * randRange(rng, 0.03, 0.06), 0, Math.PI * 2);
      c.fill();
    }
  }
  // hills
  const hills = ['#7ad14a', '#4fae5c', '#9be22d'];
  for (let i = 0; i < 3; i++) {
    c.fillStyle = hills[i];
    c.beginPath();
    const base = h * (0.62 + i * 0.09);
    c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) c.lineTo(x, base - Math.sin(x / w * Math.PI * randRange(rng, 1, 2) + i + seed) * h * 0.08);
    c.lineTo(w, h);
    c.fill();
  }
  // water band + bubbles
  if (seed % 2 === 0) {
    const g = c.createLinearGradient(0, h * 0.82, 0, h);
    g.addColorStop(0, '#28c5df');
    g.addColorStop(1, '#1747b5');
    c.fillStyle = g;
    c.fillRect(0, h * 0.84, w, h * 0.16);
  }
  for (let i = 0; i < 9; i++) {
    const r = randRange(rng, 6, 26);
    const x = rng() * w;
    const y = rng() * h * 0.8;
    const bg = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    bg.addColorStop(0, 'rgba(255,255,255,0.9)');
    bg.addColorStop(0.6, 'rgba(190,240,255,0.25)');
    bg.addColorStop(1, 'rgba(255,255,255,0.55)');
    c.fillStyle = bg;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = 'rgba(255,255,255,0.6)';
  c.lineWidth = 6;
  roundRect(c, 3, 3, w - 6, h - 6, 14);
  c.stroke();
  texture.needsUpdate = true;
  return texture;
}

/** Framed art panel on a wall; (x, y, z) is the centre, `rotY` the facing (0 = +Z). */
export function artPanel(b: WorldBuilder, x: number, y: number, z: number, rotY: number, w: number, h: number, seed: number): void {
  const fx = Math.sin(rotY);
  const fz = Math.cos(rotY);
  b.box(b.mats.whiteCeramic, x, y - h / 2 - 0.05, z, w + 0.1, h + 0.1, 0.04, { rotY, radius: 0.03, cast: false });
  const tex = artTexture(b.assets, seed);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  mat.color.setScalar(0.92);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.set(x + fx * 0.025, y, z + fz * 0.025);
  p.rotation.y = rotY;
  b.root.add(p);
}
