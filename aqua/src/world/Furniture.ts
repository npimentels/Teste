import * as THREE from 'three';
import type { WorldBuilder } from './Builders';
import { LAYOUT } from './WorldLayout';
import { roundRect } from '../core/AssetManager';

/**
 * Furniture & props library. Pieces are built from refined procedural shapes (lathes,
 * bevelled arcs, rounded boxes), batched by material, with simple colliders so they are part
 * of the walkable world. Reusable across zones (atrium lounge, market, home…).
 */

const TAU = Math.PI * 2;
const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

/** Releases the shared prop geometries (call when the world is disposed). */
export function disposeFurnitureCache(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}

/** Point on a circle around (cx, cz). */
const polar = (cx: number, cz: number, r: number, a: number): [number, number] => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

/**
 * Crescent sofa following an arc. `facing: 'in'` puts the backrest on the outer radius (sitters
 * look at the centre), `'out'` the opposite.
 */
export function crescentSofa(b: WorldBuilder, cx: number, cz: number, r: number, a0: number, a1: number, fabric: THREE.Material, facing: 'in' | 'out' = 'in'): void {
  const m = b.mats;
  const depth = 0.9;
  const r0 = r - depth / 2;
  const r1 = r + depth / 2;
  b.arcWall(m.whiteCeramic, cx, cz, r0, r1, a0, a1, 0.06, 0.3, { collide: 'tile', bevel: 0.1 });
  b.arcWall(m.chrome, cx, cz, r0 + 0.12, r1 - 0.12, a0 + 0.02, a1 - 0.02, 0, 0.07, { bevel: 0.02, cast: false });
  b.arcWall(fabric, cx, cz, r0 + 0.04, r1 - 0.04, a0 + 0.01, a1 - 0.01, 0.36, 0.13, { bevel: 0.06 });
  const back = facing === 'in' ? [r1 - 0.26, r1 - 0.02] : [r0 + 0.02, r0 + 0.26];
  b.arcWall(fabric, cx, cz, back[0], back[1], a0, a1, 0.36, 0.52, { bevel: 0.1 });
  b.collision.addArc(cx, cz, back[0], back[1], a0, a1, 0, 0.9, Math.max(2, Math.ceil((a1 - a0) * r)), 'tile');
  // rounded arm caps
  for (const a of [a0, a1]) {
    const [x, z] = polar(cx, cz, r, a);
    b.cylinder(fabric, x, 0.36, z, depth / 2 - 0.02, depth / 2 - 0.02, 0.22, { segments: 24 });
  }
}

/** Round coffee table: chrome stem, cobalt foot, glass top and a little lime vase. */
export function glassTable(b: WorldBuilder, x: number, z: number, r = 0.55, h = 0.42): void {
  const m = b.mats;
  b.cylinder(m.cobaltCeramic, x, 0, z, r * 0.55, r * 0.6, 0.05, { segments: 32 });
  b.cylinder(m.chrome, x, 0.05, z, 0.05, 0.05, h - 0.08, { segments: 12, cast: false });
  b.cylinder(m.glass, x, h - 0.03, z, r, r, 0.03, { segments: 40, cast: false, receive: false });
  b.torus(m.chrome, x, h - 0.015, z, r, 0.015, { rotX: Math.PI / 2, cast: false });
  const vase = cached('vase', () =>
    new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.07, 0.01), new THREE.Vector2(0.09, 0.08), new THREE.Vector2(0.05, 0.17), new THREE.Vector2(0.035, 0.22), new THREE.Vector2(0.04, 0.24)], 20),
  );
  b.place(vase, m.limeGlossy, x + r * 0.35, h, z - r * 0.2);
  b.collision.addCylinder({ x, z, r, minY: 0, maxY: Math.max(h, 0.6), surface: 'glass' });
}

/** 2000s egg chair: glossy shell open to the front, fabric inside, chrome swivel. */
export function eggChair(b: WorldBuilder, x: number, z: number, faceAngle: number, shell: THREE.Material, fabric: THREE.Material): void {
  const outer = cached('eggOuter', () => {
    const g = new THREE.SphereGeometry(0.62, 32, 22, Math.PI * 0.32, Math.PI * 1.36, 0.28, 2.0);
    g.scale(1, 1.18, 1);
    return g;
  });
  const inner = cached('eggInner', () => {
    const g = new THREE.SphereGeometry(0.58, 32, 22, Math.PI * 0.32, Math.PI * 1.36, 0.28, 2.0);
    g.scale(1, 1.18, 1);
    flipFaces(g);
    return g;
  });
  // the opening of the partial sphere is centred on local −X; rotate so it faces `faceAngle`
  const rotY = Math.atan2(Math.cos(faceAngle), -Math.sin(faceAngle));
  b.place(outer, shell, x, 0.82, z, { rotY });
  b.place(inner, fabric, x, 0.82, z, { rotY });
  b.cylinder(fabric, x, 0.32, z, 0.46, 0.5, 0.14, { segments: 28 });
  b.cylinder(b.mats.chrome, x, 0, z, 0.38, 0.42, 0.04, { segments: 28 });
  b.cylinder(b.mats.chrome, x, 0.04, z, 0.05, 0.05, 0.3, { segments: 12, cast: false });
  b.collision.addCylinder({ x, z, r: 0.6, minY: 0, maxY: 1.5, surface: 'tile' });
}

/** Reverses triangle winding and normals so the inside of a shell renders with FrontSide. */
export function flipFaces(g: THREE.BufferGeometry): void {
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  n.needsUpdate = true;
}

/** Round rug (thin disc with a concentric wave pattern). */
export function rug(b: WorldBuilder, x: number, z: number, r: number): void {
  b.cylinder(b.mats.rug, x, 0.03, z, r, r, 0.012, { segments: 48, cast: false });
}

/** Glossy lathe planter with a cobalt band; returns the soil height for planting. */
export function planterBowl(b: WorldBuilder, x: number, z: number, r: number, body: THREE.Material, band: THREE.Material, y0 = 0): number {
  const h = r * 0.95;
  const key = `bowl:${r.toFixed(2)}`;
  const geo = cached(key, () =>
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(r * 0.55, 0),
        new THREE.Vector2(r * 0.62, 0.04),
        new THREE.Vector2(r * 0.9, h * 0.45),
        new THREE.Vector2(r, h * 0.85),
        new THREE.Vector2(r * 0.98, h),
        new THREE.Vector2(r * 0.9, h * 0.97),
        new THREE.Vector2(0.001, h * 0.92),
      ],
      36,
    ),
  );
  const bandGeo = cached(`${key}:band`, () =>
    new THREE.LatheGeometry([new THREE.Vector2(r * 0.79, h * 0.3), new THREE.Vector2(r * 0.85, h * 0.36), new THREE.Vector2(r * 0.92, h * 0.55), new THREE.Vector2(r * 0.87, h * 0.6)], 36),
  );
  b.place(geo, body, x, y0, z);
  b.place(bandGeo, band, x, y0, z);
  b.cylinder(b.mats.soil, x, y0 + h * 0.88, z, r * 0.88, r * 0.88, 0.04, { segments: 24, cast: false });
  b.collision.addCylinder({ x, z, r, minY: y0, maxY: y0 + h, surface: 'stone' });
  return y0 + h * 0.9;
}

/** Hanging bubble lamp: frosted globe with a glowing core, chrome cap and cable. */
export function bubbleLamp(b: WorldBuilder, x: number, y: number, z: number, ceilingY: number, r: number, glow: THREE.Material): void {
  b.sphere(glow, x, y, z, r, { cast: false, receive: false });
  b.sphere(b.mats.chrome, x, y + r * 0.95, z, r * 0.22, { cast: false });
  b.cylinder(b.mats.chrome, x, y + r, z, 0.008, 0.008, Math.max(0.05, ceilingY - y - r), { segments: 6, cast: false });
}

/** Recycling station: three rounded bins (cobalt / lime / cyan) with white domed lids. */
export function recycleBins(b: WorldBuilder, x: number, z: number, rotY: number): void {
  const mats = [b.mats.cobaltCeramic, b.mats.limeGlossy, b.mats.glossyCyan];
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  mats.forEach((mat, i) => {
    const off = (i - 1) * 0.5;
    const bx = x + c * off;
    const bz = z - s * off;
    b.cylinder(mat, bx, 0, bz, 0.2, 0.18, 0.78, { segments: 24 });
    b.sphere(b.mats.whiteCeramic, bx, 0.78, bz, 0.205);
    b.torus(b.mats.chrome, bx, 0.78, bz, 0.2, 0.012, { rotX: Math.PI / 2, cast: false });
  });
  b.collision.addBox({ x, z, sx: 1.5, sz: 0.5, minY: 0, maxY: 0.95, rotY, surface: 'metal' });
}

/** Water dispenser with a cyan acrylic bottle. */
export function waterDispenser(b: WorldBuilder, x: number, z: number, rotY: number): void {
  const mt = b.mats;
  b.box(mt.whiteCeramic, x, 0, z, 0.38, 1.0, 0.34, { rotY, radius: 0.08 });
  b.box(mt.cobaltCeramic, x, 0.62, z, 0.3, 0.2, 0.36, { rotY, radius: 0.04 });
  b.cylinder(mt.cyanAcrylic, x, 1.0, z, 0.14, 0.15, 0.42, { segments: 24, cast: false, receive: false });
  b.sphere(mt.cyanAcrylic, x, 1.42, z, 0.14, { cast: false, receive: false });
  const fx = x + Math.sin(rotY) * 0.19;
  const fz = z + Math.cos(rotY) * 0.19;
  b.sphere(mt.chrome, fx, 0.72, fz, 0.035, { cast: false });
  b.box(mt.brushedMetal, fx, 0.42, fz, 0.22, 0.03, 0.08, { rotY, cast: false });
  b.collision.addBox({ x, z, sx: 0.4, sz: 0.36, minY: 0, maxY: 1.5, rotY, surface: 'metal' });
}

/**
 * Curved reception / information desk: cobalt body, white top, maple inner shelf and a flat
 * 2000s monitor with a glossy black bezel.
 */
export function receptionDesk(b: WorldBuilder, cx: number, cz: number, r: number, a0: number, a1: number, screen: THREE.Texture): void {
  const mt = b.mats;
  b.arcWall(mt.cobaltCeramic, cx, cz, r, r + 0.55, a0, a1, 0, 1.0, { collide: 'tile', bevel: 0.08 });
  b.arcWall(mt.whiteCeramic, cx, cz, r - 0.08, r + 0.66, a0 - 0.01, a1 + 0.01, 1.0, 0.06, { bevel: 0.03 });
  b.arcWall(mt.maple, cx, cz, r + 0.56, r + 0.9, a0 + 0.02, a1 - 0.02, 0.72, 0.04, { bevel: 0.01, cast: false });
  b.arcWall(mt.cyanAcrylic, cx, cz, r - 0.02, r + 0.02, a0 + 0.03, a1 - 0.03, 0.12, 0.05, { bevel: 0, cast: false, receive: false });
  const mid = (a0 + a1) / 2;
  const [mx, mz] = polar(cx, cz, r + 0.35, mid);
  const back = Math.atan2(Math.cos(mid), Math.sin(mid)); // the clerk side (outer radius)
  b.box(mt.glossBlack, mx, 1.12, mz, 0.62, 0.42, 0.04, { rotY: back, radius: 0.015 });
  b.cylinder(mt.brushedMetal, mx, 1.06, mz, 0.11, 0.13, 0.08, { segments: 16, cast: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }));
  plane.position.set(mx + Math.cos(mid) * 0.025, 1.33, mz + Math.sin(mid) * 0.025);
  plane.rotation.y = back; // screen faces the clerk; visitors see the glossy back
  b.root.add(plane);
}

/**
 * Information totem with a live-looking map of the complex and a "you are here" marker.
 * Faces `faceAngle` (radians, 0 = +Z).
 */
export function infoTotem(b: WorldBuilder, x: number, z: number, faceAngle: number, hereLabel: string): void {
  const mt = b.mats;
  b.box(mt.whiteCeramic, x, 0, z, 0.72, 2.05, 0.26, { rotY: faceAngle, radius: 0.12 });
  b.box(mt.cobaltCeramic, x, 0, z, 0.78, 0.18, 0.32, { rotY: faceAngle, radius: 0.06 });
  b.box(mt.cyanAcrylic, x, 2.0, z, 0.6, 0.06, 0.2, { rotY: faceAngle, radius: 0.02, cast: false, receive: false });
  const tex = mapTexture(b, x, z, hereLabel);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  for (const side of [0, Math.PI]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.0), mat);
    const a = faceAngle + side;
    p.position.set(x + Math.sin(a) * 0.135, 1.25, z + Math.cos(a) * 0.135);
    p.rotation.y = a;
    b.root.add(p);
  }
  b.collision.addBox({ x, z, sx: 0.78, sz: 0.34, minY: 0, maxY: 2.1, rotY: faceAngle, surface: 'tile' });
}

function mapTexture(b: WorldBuilder, hx: number, hz: number, label: string): THREE.Texture {
  const { ctx, texture } = b.assets.dynamicCanvas(384, 640, 'map');
  const g = ctx.createLinearGradient(0, 0, 0, 640);
  g.addColorStop(0, '#eaf8fd');
  g.addColorStop(1, '#bfe9f6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 384, 640);
  ctx.fillStyle = '#1747b5';
  ctx.fillRect(0, 0, 384, 74);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, 384, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 34px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Mapa AQUA', 22, 40);
  // world → map (north up). x ∈ [-40, 66], z ∈ [-90, 30]
  const sx = (x: number) => 22 + ((x + 40) / 106) * 340;
  const sz = (z: number) => 96 + ((z + 90) / 120) * 520;
  ctx.fillStyle = '#7fd08a';
  ctx.beginPath();
  LAYOUT.outline.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(sx(x), sz(z)) : ctx.lineTo(sx(x), sz(z))));
  ctx.closePath();
  ctx.fill();
  const zone = (label: string, color: string, x: number, z: number, w: number, h: number, round = false) => {
    ctx.fillStyle = color;
    if (round) {
      ctx.beginPath();
      ctx.ellipse(sx(x), sz(z), (w / 106) * 340, (h / 120) * 520, 0, 0, TAU);
      ctx.fill();
    } else {
      roundRect(ctx, sx(x - w / 2), sz(z - h / 2), (w / 106) * 340, (h / 120) * 520, 8);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, sx(x), sz(z));
    ctx.textAlign = 'left';
  };
  zone('Terraço', '#087dae', 0, -75, 48, 18);
  zone('Jardins', '#3fae66', 0, -41, 50, 44);
  zone('Átrio', '#1747b5', 0, 0, 34, 34, true);
  zone('Galeria', '#28c5df', 33, 0, 36, 19);
  // you are here
  ctx.fillStyle = '#9be22d';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(sx(hx), sz(hz), 11, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0b4f6c';
  ctx.font = '600 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`● ${label}`, 22, 612);
  texture.needsUpdate = true;
  return texture;
}

/** Floating water lily pads with small flowers (cheap organic detail on still water). */
export function lilyPads(b: WorldBuilder, cx: number, cz: number, rMin: number, rMax: number, y: number, count: number, seed = 1): void {
  const pad = cached('lilyPad', () => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1, 0.25, TAU - 0.05, false);
    shape.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(shape, 24);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU;
    const r = rMin + rnd() * (rMax - rMin);
    const size = 0.18 + rnd() * 0.22;
    const px = cx + Math.cos(a) * r;
    const pz = cz + Math.sin(a) * r;
    const g = pad.clone().scale(size, 1, size);
    b.place(g, b.mats.glossyGreen, px, y, pz, { rotY: rnd() * TAU, cast: false });
    g.dispose();
    if (rnd() < 0.45) b.sphere(rnd() < 0.5 ? b.mats.whiteCeramic : b.mats.limeGlossy, px + 0.04, y + 0.04, pz, 0.05, { cast: false });
  }
}

/** Teardrop pendant lamp (glass drop with a glowing core) on a fine cable. */
export function teardropLamp(b: WorldBuilder, x: number, y: number, z: number, ceilingY: number, glow: THREE.Material, size = 0.32): void {
  const key = `drop:${size.toFixed(2)}`;
  const geo = cached(key, () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      // round bottom, pointed top
      const a = t * Math.PI;
      const r = Math.sin(a) * size * (1 - 0.55 * t * t);
      const yy = -Math.cos(a) * size * 1.25 + t * t * size * 0.9;
      pts.push(new THREE.Vector2(Math.max(0.001, r), yy));
    }
    return new THREE.LatheGeometry(pts, 24);
  });
  b.place(geo, glow, x, y, z, { cast: false, receive: false });
  b.cylinder(b.mats.chrome, x, y + size * 2.0, z, 0.006, 0.006, Math.max(0.05, ceilingY - y - size * 2.0), { segments: 6, cast: false });
}

/**
 * Straight cushioned bench (white glossy base, fabric seat). Returns seat surface points
 * (one every ~0.65 m) so callers can register them with the seat system.
 */
export function bench(b: WorldBuilder, x: number, z: number, facingX: number, facingZ: number, length: number, fabric: THREE.Material, back = true, y0 = 0): Array<{ x: number; y: number; z: number }> {
  const along = { x: -facingZ, z: facingX };
  const rotY = Math.atan2(-along.z, along.x);
  b.box(b.mats.whiteCeramic, x, y0, z, length, 0.4, 0.58, { rotY, radius: 0.12 });
  b.box(fabric, x, y0 + 0.4, z, length - 0.06, 0.07, 0.54, { rotY, radius: 0.035 });
  if (back) {
    const bx = x - facingX * 0.27;
    const bz = z - facingZ * 0.27;
    b.box(fabric, bx, y0 + 0.47, bz, length - 0.06, 0.48, 0.1, { rotY, radius: 0.045 });
  }
  b.collision.addBox({ x, z, sx: length, sz: 0.6, minY: y0, maxY: y0 + (back ? 0.95 : 0.6), rotY, surface: 'tile' });
  const n = Math.max(1, Math.floor(length / 0.65));
  const out: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    out.push({ x: x + along.x * t * length + facingX * 0.05, y: y0 + 0.47, z: z + along.z * t * length + facingZ * 0.05 });
  }
  return out;
}
