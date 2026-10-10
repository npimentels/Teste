import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addPatch, windPatch } from './ShaderPatches';
import type { CollisionWorld } from '../physics/Collision';
import type { QualityAware, QualityProfile } from '../core/types';
import { createRng, randRange } from '../core/math';

/**
 * Procedural tropical vegetation (no external models): palms, ferns, monstera-like plants,
 * manicured bushes, grass tufts and flowers. Every species is drawn with InstancedMesh and a
 * wind-sway vertex patch.
 */

class GeoBuilder {
  pos: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  vertex(p: THREE.Vector3, c: THREE.Color): number {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    return this.pos.length / 3 - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const UP = new THREE.Vector3(0, 1, 0);

interface FrondParams {
  length: number;
  elevation: number;
  droop: number;
  leafLen: number;
  leafWidth: number;
  spacing: number;
  baseColor: THREE.Color;
  tipColor: THREE.Color;
}

/** Arching frond with paired leaflets (palm leaves, ferns). */
function addFrond(b: GeoBuilder, origin: THREE.Vector3, azimuth: number, p: FrondParams, rng: () => number): void {
  const dir = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
  const spine = (s: number, out: THREE.Vector3) =>
    out
      .copy(origin)
      .addScaledVector(dir, Math.cos(p.elevation) * s * p.length)
      .addScaledVector(UP, Math.sin(p.elevation) * s * p.length - p.droop * s * s * p.length);
  const a = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const tmpCol = new THREE.Color();
  // rachis (thin ribbon)
  const steps = 10;
  let prevL = -1;
  let prevR = -1;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    spine(s, a);
    spine(Math.min(1, s + 0.01), c);
    tangent.subVectors(c, a).normalize();
    side.crossVectors(tangent, UP).normalize();
    const w = 0.025 * (1 - s * 0.7) * p.leafLen * 2;
    tmpCol.copy(p.baseColor).lerp(p.tipColor, s * 0.6).multiplyScalar(0.8);
    const l = b.vertex(a.clone().addScaledVector(side, -w), tmpCol);
    const r = b.vertex(a.clone().addScaledVector(side, w), tmpCol);
    if (prevL >= 0) {
      b.tri(prevL, prevR, l);
      b.tri(prevR, r, l);
    }
    prevL = l;
    prevR = r;
  }
  // leaflets
  for (let s = 0.08; s < 0.98; s += p.spacing) {
    spine(s, a);
    spine(s + 0.01, c);
    tangent.subVectors(c, a).normalize();
    side.crossVectors(tangent, UP).normalize();
    const len = p.leafLen * (0.35 + Math.sin(Math.PI * Math.min(1, s * 1.1)) * 0.8) * (0.85 + rng() * 0.3);
    tmpCol.copy(p.baseColor).lerp(p.tipColor, s + rng() * 0.15);
    const tipCol = tmpCol.clone().lerp(p.tipColor, 0.4);
    for (const sign of [-1, 1]) {
      const sideDir = side.clone().multiplyScalar(sign);
      const tip = a
        .clone()
        .addScaledVector(sideDir, len * 0.85)
        .addScaledVector(tangent, len * 0.45)
        .addScaledVector(UP, -len * (0.25 + s * 0.35));
      const base0 = a.clone().addScaledVector(tangent, -p.leafWidth);
      const base1 = a.clone().addScaledVector(tangent, p.leafWidth);
      const mid = a
        .clone()
        .addScaledVector(sideDir, len * 0.45)
        .addScaledVector(tangent, len * 0.22 + p.leafWidth * 0.8)
        .addScaledVector(UP, -len * 0.06);
      const i0 = b.vertex(base0, tmpCol);
      const i1 = b.vertex(base1, tmpCol);
      const i2 = b.vertex(mid, tipCol);
      const i3 = b.vertex(tip, tipCol);
      b.tri(i0, i1, i2);
      b.tri(i0, i2, i3);
    }
  }
}

function palmGeometry(seed: number, height: number, lean: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  // Trunk: curved, tapered, ringed.
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.15, height * 0.55, 0), new THREE.Vector3(lean, height, 0));
  const rings = Math.round(height * 3.5);
  const radial = 7;
  const p = new THREE.Vector3();
  const light = new THREE.Color(0xc9b49a);
  const dark = new THREE.Color(0x8a7560);
  const tmp = new THREE.Color();
  let prev: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    curve.getPoint(t, p);
    const band = (i % 2) * 0.5 + 0.5;
    const r = THREE.MathUtils.lerp(0.24, 0.13, t) * (0.94 + band * 0.08);
    tmp.copy(dark).lerp(light, band * 0.8 + t * 0.2);
    const ring: number[] = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      ring.push(b.vertex(new THREE.Vector3(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r), tmp));
    }
    if (prev.length) {
      for (let k = 0; k < radial; k++) {
        const k2 = (k + 1) % radial;
        b.tri(prev[k], ring[k], prev[k2]);
        b.tri(prev[k2], ring[k], ring[k2]);
      }
    }
    prev = ring;
  }
  const top = curve.getPoint(1);
  // Crown
  const fronds = 9 + Math.floor(rng() * 4);
  for (let i = 0; i < fronds; i++) {
    const az = (i / fronds) * Math.PI * 2 + rng() * 0.4;
    addFrond(b, top, az, {
      length: randRange(rng, 2.4, 3.3),
      elevation: randRange(rng, 0.25, 0.75),
      droop: randRange(rng, 0.65, 1.05),
      leafLen: 0.62,
      leafWidth: 0.06,
      spacing: 0.06,
      baseColor: new THREE.Color(0x2f8a45),
      tipColor: new THREE.Color(0x8fdc6a),
    }, rng);
  }
  // A few young upright leaves in the centre
  for (let i = 0; i < 3; i++) {
    addFrond(b, top, rng() * Math.PI * 2, {
      length: 1.4,
      elevation: 1.15,
      droop: 0.3,
      leafLen: 0.4,
      leafWidth: 0.04,
      spacing: 0.06,
      baseColor: new THREE.Color(0x4aa356),
      tipColor: new THREE.Color(0xb4ec7c),
    }, rng);
  }
  const g = b.build();
  // Coconuts
  const nuts: THREE.BufferGeometry[] = [g];
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.IcosahedronGeometry(0.11, 1);
    const a = (i / 3) * Math.PI * 2;
    nut.translate(top.x + Math.cos(a) * 0.17, top.y - 0.18, top.z + Math.sin(a) * 0.17);
    const c = new THREE.Color(0x6f8f3a);
    const cols = new Float32Array(nut.attributes.position.count * 3);
    for (let k = 0; k < cols.length; k += 3) cols.set([c.r, c.g, c.b], k);
    nut.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    nut.deleteAttribute('uv');
    nuts.push(nut);
  }
  const merged = mergeGeometries(nuts.map((x) => (x.index ? x.toNonIndexed() : x)), false)!;
  merged.computeVertexNormals();
  return merged;
}

function fernGeometry(seed: number, size: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const n = 11 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    addFrond(b, new THREE.Vector3(0, 0.05, 0), (i / n) * Math.PI * 2 + rng() * 0.5, {
      length: size * randRange(rng, 0.8, 1.15),
      elevation: randRange(rng, 0.7, 1.15),
      droop: randRange(rng, 0.8, 1.2),
      leafLen: size * 0.2,
      leafWidth: 0.025,
      spacing: 0.07,
      baseColor: new THREE.Color(0x2c7d3d),
      tipColor: new THREE.Color(0x9ee070),
    }, rng);
  }
  return b.build();
}

function monsteraGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const leaves = 6 + Math.floor(rng() * 3);
  const stemCol = new THREE.Color(0x5a9a45);
  for (let i = 0; i < leaves; i++) {
    const az = (i / leaves) * Math.PI * 2 + rng() * 0.6;
    const h = randRange(rng, 0.55, 1.15);
    const out = randRange(rng, 0.25, 0.55);
    const base = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(Math.cos(az) * out, h, Math.sin(az) * out);
    // petiole
    const side = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az)).multiplyScalar(0.015);
    const s0 = b.vertex(base.clone().sub(side), stemCol);
    const s1 = b.vertex(base.clone().add(side), stemCol);
    const s2 = b.vertex(end.clone().sub(side), stemCol);
    const s3 = b.vertex(end.clone().add(side), stemCol);
    b.tri(s0, s1, s2);
    b.tri(s1, s3, s2);
    // leaf blade: heart shape with slits, built as a fan around the midrib
    const len = randRange(rng, 0.45, 0.7);
    const wid = len * 0.8;
    const fwd = new THREE.Vector3(Math.cos(az), -0.35, Math.sin(az)).normalize();
    const lateral = new THREE.Vector3(-Math.sin(az), 0, Math.cos(az));
    const normalUp = new THREE.Vector3().crossVectors(lateral, fwd).normalize();
    const centre = end.clone().addScaledVector(fwd, len * 0.5);
    const c = b.vertex(centre, new THREE.Color(0x3f9a4a));
    const ring: number[] = [];
    const steps = 28;
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * Math.PI * 2;
      // heart-ish outline in local (u along fwd, v along lateral)
      let u = Math.cos(t) * len * 0.5;
      let v = Math.sin(t) * wid * 0.5 * (1 - 0.25 * Math.cos(t));
      const slit = k % 4 === 2 && Math.abs(Math.sin(t)) > 0.3 ? 0.55 : 1;
      u *= slit;
      v *= slit;
      const cup = (u * u + v * v) * 0.6;
      const p = centre.clone().addScaledVector(fwd, u).addScaledVector(lateral, v).addScaledVector(normalUp, -cup);
      const col = new THREE.Color(0x2f8a43).lerp(new THREE.Color(0x6cc860), 0.3 + rng() * 0.3);
      ring.push(b.vertex(p, col));
    }
    for (let k = 0; k < steps; k++) b.tri(c, ring[k], ring[k + 1]);
  }
  return b.build();
}

function bushGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const blobs = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < blobs; i++) {
    const r = randRange(rng, 0.35, 0.6);
    const g = new THREE.IcosahedronGeometry(r, 2);
    const pos = g.attributes.position;
    const a = i === 0 ? 0 : rng() * Math.PI * 2;
    const d = i === 0 ? 0 : randRange(rng, 0.3, 0.55);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const cy = r * 0.8 + (i === 0 ? 0.25 : rng() * 0.2);
    const cols = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    const col = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      const n = 1 + (Math.sin(v.x * 9 + seed) * Math.sin(v.y * 11) * Math.sin(v.z * 8)) * 0.12;
      v.multiplyScalar(n);
      pos.setXYZ(k, v.x + cx, v.y + cy, v.z + cz);
      col.setHex(0x2e8a45).lerp(new THREE.Color(0x86d56a), THREE.MathUtils.clamp((v.y / r) * 0.5 + 0.5, 0, 1) * 0.8);
      cols.set([col.r, col.g, col.b], k * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return merged;
}

function grassTuftGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 0.12;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = randRange(rng, 0.22, 0.42);
    const bend = randRange(rng, 0.05, 0.14);
    const dir = rng() * Math.PI * 2;
    const w = 0.018;
    const side = new THREE.Vector3(Math.cos(dir + Math.PI / 2), 0, Math.sin(dir + Math.PI / 2));
    const lean = new THREE.Vector3(Math.cos(dir), 0, Math.sin(dir));
    const base = new THREE.Color(0x3a8f3c);
    const tip = new THREE.Color(0xa8e27a);
    let prevA = -1;
    let prevB = -1;
    for (let s = 0; s <= 2; s++) {
      const t = s / 2;
      const p = new THREE.Vector3(x, t * h, z).addScaledVector(lean, bend * t * t);
      const ww = w * (1 - t);
      const col = base.clone().lerp(tip, t);
      const ia = b.vertex(p.clone().addScaledVector(side, -ww), col);
      const ib = b.vertex(p.clone().addScaledVector(side, ww), col);
      if (prevA >= 0) {
        b.tri(prevA, prevB, ia);
        b.tri(prevB, ib, ia);
      }
      prevA = ia;
      prevB = ib;
    }
  }
  return b.build();
}

/** Ornamental banana: soft pseudostem and large arching paddle leaves with torn slits. */
function bananaGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const stemH = randRange(rng, 1.1, 1.6);
  const radial = 7;
  let prev: number[] = [];
  const stemCol = new THREE.Color(0x6f9a3c);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const r = THREE.MathUtils.lerp(0.13, 0.08, t);
    const c = stemCol.clone().lerp(new THREE.Color(0x9cc65a), t * 0.6);
    const ring: number[] = [];
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      ring.push(b.vertex(new THREE.Vector3(Math.cos(a) * r, t * stemH, Math.sin(a) * r), c));
    }
    if (prev.length) {
      for (let k = 0; k < radial; k++) {
        const k2 = (k + 1) % radial;
        b.tri(prev[k], ring[k], prev[k2]);
        b.tri(prev[k2], ring[k], ring[k2]);
      }
    }
    prev = ring;
  }
  const leaves = 6 + Math.floor(rng() * 3);
  for (let l = 0; l < leaves; l++) {
    const az = (l / leaves) * Math.PI * 2 + rng() * 0.5;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const len = randRange(rng, 1.3, 1.9);
    const wid = randRange(rng, 0.32, 0.45);
    const lift = randRange(rng, 0.7, 1.2);
    const droop = randRange(rng, 0.9, 1.4);
    const base = new THREE.Vector3(0, stemH - 0.05 + rng() * 0.25, 0);
    const seg = 10;
    let prevRow: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const along = t * len;
      const y = base.y + Math.sin(t * Math.PI * 0.5) * lift * 0.6 - t * t * droop * 0.9 + 0.35;
      const mid = base.clone().addScaledVector(dir, 0.25 + along).setY(y);
      const w = wid * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (t < 0.08 ? 0.2 : 1);
      const vcol = new THREE.Color(0x2f8a3e).lerp(new THREE.Color(0x8ed45e), 0.25 + t * 0.4 + rng() * 0.1);
      const edge = vcol.clone().lerp(new THREE.Color(0xc6ec7a), 0.25);
      const tear = i > 2 && i < seg - 1 && rng() < 0.3 ? 0.35 : 1; // torn slits
      const left = b.vertex(mid.clone().addScaledVector(side, -w * tear).add(new THREE.Vector3(0, -w * 0.25, 0)), edge);
      const m = b.vertex(mid, vcol.clone().multiplyScalar(0.85));
      const right = b.vertex(mid.clone().addScaledVector(side, w).add(new THREE.Vector3(0, -w * 0.25, 0)), edge);
      if (prevRow.length) {
        b.tri(prevRow[0], left, prevRow[1]);
        b.tri(prevRow[1], left, m);
        b.tri(prevRow[1], m, prevRow[2]);
        b.tri(prevRow[2], m, right);
      }
      prevRow = [left, m, right];
    }
  }
  return b.build();
}

/** Snake plant: upright sword leaves, dark green with lime margins and pale banding. */
function sansevieriaGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const blades = 10 + Math.floor(rng() * 5);
  for (let i = 0; i < blades; i++) {
    const a = rng() * Math.PI * 2;
    const r0 = rng() * 0.12;
    const h = randRange(rng, 0.55, 1.15);
    const lean = randRange(rng, 0.03, 0.18);
    const w = randRange(rng, 0.05, 0.08);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const twist = rng() * 0.6;
    let prev: number[] = [];
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const p = new THREE.Vector3(Math.cos(a) * r0, t * h, Math.sin(a) * r0).addScaledVector(dir, lean * t * t);
      const ww = w * (t > 0.8 ? (1 - t) * 5 : 1);
      const sd = side.clone().applyAxisAngle(UP, twist * t);
      const band = Math.sin(t * 28 + i) > 0.6 ? 0.25 : 0;
      const core = new THREE.Color(0x1f5a32).lerp(new THREE.Color(0x8fb98a), band);
      const edge = new THREE.Color(0xb9e04a);
      const l = b.vertex(p.clone().addScaledVector(sd, -ww), edge);
      const c = b.vertex(p.clone().addScaledVector(dir, 0.012), core);
      const r = b.vertex(p.clone().addScaledVector(sd, ww), edge);
      if (prev.length) {
        b.tri(prev[0], l, prev[1]);
        b.tri(prev[1], l, c);
        b.tri(prev[1], c, prev[2]);
        b.tri(prev[2], c, r);
      }
      prev = [l, c, r];
    }
  }
  return b.build();
}

/** Trailing vine (pothos-like): strands hanging down from the origin with heart leaves. */
function vineGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const b = new GeoBuilder();
  const strands = 6 + Math.floor(rng() * 4);
  const stemCol = new THREE.Color(0x4f8f3a);
  for (let s = 0; s < strands; s++) {
    const a = rng() * Math.PI * 2;
    const len = randRange(rng, 0.7, 1.8);
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const count = Math.floor(len / 0.11);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const p = out.clone().multiplyScalar(0.05 + t * 0.12 + Math.sin(t * 7 + s) * 0.03).setY(-t * len);
      const leafSize = randRange(rng, 0.05, 0.085);
      const la = a + (i % 2 ? 1.2 : -1.2) + rng() * 0.4;
      const ld = new THREE.Vector3(Math.cos(la), -0.35, Math.sin(la)).normalize();
      const ls = new THREE.Vector3(-ld.z, 0, ld.x).normalize();
      const c = new THREE.Color(0x3f9a46).lerp(new THREE.Color(0xa8dc6a), rng() * 0.6);
      const p0 = b.vertex(p, stemCol);
      const p1 = b.vertex(p.clone().addScaledVector(ld, leafSize).addScaledVector(ls, leafSize * 0.7), c);
      const p2 = b.vertex(p.clone().addScaledVector(ld, leafSize * 2.1), c);
      const p3 = b.vertex(p.clone().addScaledVector(ld, leafSize).addScaledVector(ls, -leafSize * 0.7), c);
      b.tri(p0, p1, p2);
      b.tri(p0, p2, p3);
    }
  }
  return b.build();
}

function flowerGeometry(): { stem: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.32, 4).translate(0, 0.16, 0);
  const head = new THREE.IcosahedronGeometry(0.05, 0).scale(1, 0.55, 1).translate(0, 0.33, 0);
  return { stem, head };
}

interface Placement {
  x: number;
  y: number;
  z: number;
  s: number;
  r: number;
  color?: THREE.Color;
}

interface Species {
  name: string;
  variants: THREE.BufferGeometry[];
  material: THREE.Material;
  placements: Placement[][];
  cast: boolean;
  /** Fraction of instances kept on low quality (1 = always all). */
  scalable: boolean;
  meshes: THREE.InstancedMesh[];
  extra?: { geometry: THREE.BufferGeometry; material: THREE.Material; colored: boolean };
}

export class Vegetation implements QualityAware {
  readonly group = new THREE.Group();
  private readonly species = new Map<string, Species>();
  private readonly rng = createRng(1234);
  private readonly materials: THREE.Material[] = [];

  constructor(private readonly collision: CollisionWorld | null) {
    this.group.name = 'Vegetation';
    const foliage = (wind: number, freq: number) => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 });
      addPatch(m, windPatch(wind, freq));
      this.materials.push(m);
      return m;
    };
    this.register('palm', [palmGeometry(1, 6.5, 0.9), palmGeometry(2, 7.5, -0.6), palmGeometry(3, 5.2, 0.4)], foliage(0.0035, 0.9), true, false);
    this.register('fern', [fernGeometry(4, 0.9), fernGeometry(5, 1.2)], foliage(0.06, 1.4), false, false);
    this.register('monstera', [monsteraGeometry(6), monsteraGeometry(7)], foliage(0.05, 1.1), true, false);
    const bushMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    addPatch(bushMat, windPatch(0.012, 1.0));
    this.materials.push(bushMat);
    this.register('bush', [bushGeometry(8), bushGeometry(9), bushGeometry(10)], bushMat, true, false);
    this.register('grass', [grassTuftGeometry(11), grassTuftGeometry(12)], foliage(1.6, 1.8), false, true);
    const { stem, head } = flowerGeometry();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f9a46, roughness: 0.7 });
    addPatch(stemMat, windPatch(1.2, 1.6));
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0x222222 });
    addPatch(headMat, windPatch(1.2, 1.6));
    this.materials.push(stemMat, headMat);
    this.register('flower', [stem], stemMat, false, true, { geometry: head, material: headMat, colored: true });
    this.register('banana', [bananaGeometry(21), bananaGeometry(22), bananaGeometry(23)], foliage(0.035, 0.8), true, false);
    this.register('sansevieria', [sansevieriaGeometry(24), sansevieriaGeometry(25)], foliage(0.02, 1.0), false, false);
    const vineMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });
    addPatch(vineMat, windPatch(0.05, 0.9, 'wind', true));
    this.materials.push(vineMat);
    this.register('vine', [vineGeometry(26), vineGeometry(27), vineGeometry(28)], vineMat, false, false);
  }

  /** Ornamental banana (tall paddle leaves). */
  banana(x: number, y: number, z: number, scale = 1): void {
    this.add('banana', x, y, z, scale * randRange(this.rng, 0.85, 1.15));
    this.collision?.addCylinder({ x, z, r: 0.18 * scale, minY: y, maxY: y + 1.4 * scale, surface: 'wood' });
  }

  /** Snake plant (upright sword leaves with lime edges). */
  sansevieria(x: number, y: number, z: number, scale = 1): void {
    this.add('sansevieria', x, y, z, scale * randRange(this.rng, 0.85, 1.2));
  }

  /** Trailing vine hanging down from (x, y, z) — planter edges, ceilings, balconies. */
  vine(x: number, y: number, z: number, scale = 1): void {
    this.add('vine', x, y, z, scale * randRange(this.rng, 0.8, 1.2));
  }

  private register(name: string, variants: THREE.BufferGeometry[], material: THREE.Material, cast: boolean, scalable: boolean, extra?: Species['extra']): void {
    this.species.set(name, { name, variants, material, placements: variants.map(() => []), cast, scalable, meshes: [], extra });
  }

  private add(name: string, x: number, y: number, z: number, s: number, color?: THREE.Color): void {
    const sp = this.species.get(name)!;
    const v = Math.floor(this.rng() * sp.variants.length);
    sp.placements[v].push({ x, y, z, s, r: this.rng() * Math.PI * 2, color });
  }

  /** Splits placements into spatial chunks (for culling) when the species is dense. */
  private chunks(list: Placement[], chunked: boolean): Placement[][] {
    if (!chunked) return [list];
    const size = 28;
    const map = new Map<string, Placement[]>();
    for (const p of list) {
      const k = `${Math.floor(p.x / size)}:${Math.floor(p.z / size)}`;
      let arr = map.get(k);
      if (!arr) map.set(k, (arr = []));
      arr.push(p);
    }
    return [...map.values()];
  }

  palm(x: number, y: number, z: number, scale = 1): void {
    this.add('palm', x, y, z, scale * randRange(this.rng, 0.85, 1.1));
    this.collision?.addCylinder({ x, z, r: 0.24 * scale, minY: y, maxY: y + 5, surface: 'wood' });
  }

  fern(x: number, y: number, z: number, scale = 1): void {
    this.add('fern', x, y, z, scale * randRange(this.rng, 0.8, 1.2));
  }

  monstera(x: number, y: number, z: number, scale = 1): void {
    this.add('monstera', x, y, z, scale * randRange(this.rng, 0.85, 1.2));
  }

  bush(x: number, y: number, z: number, scale = 1, collide = true): void {
    this.add('bush', x, y, z, scale * randRange(this.rng, 0.8, 1.15));
    if (collide) this.collision?.addCylinder({ x, z, r: 0.55 * scale, minY: y, maxY: y + 1.1 * scale, surface: 'grass' });
  }

  /** Scatter grass tufts in a rectangle, skipping points rejected by `accept`. */
  grass(x0: number, z0: number, x1: number, z1: number, count: number, y = 0, accept?: (x: number, z: number) => boolean): void {
    for (let i = 0; i < count; i++) {
      const x = randRange(this.rng, x0, x1);
      const z = randRange(this.rng, z0, z1);
      if (accept && !accept(x, z)) continue;
      this.add('grass', x, y, z, randRange(this.rng, 0.8, 1.4));
    }
  }

  flowers(x0: number, z0: number, x1: number, z1: number, count: number, y = 0, accept?: (x: number, z: number) => boolean): void {
    const palette = [0xffffff, 0xffb7d5, 0xffe066, 0xa8d8ff, 0xf7a1ff];
    for (let i = 0; i < count; i++) {
      const x = randRange(this.rng, x0, x1);
      const z = randRange(this.rng, z0, z1);
      if (accept && !accept(x, z)) continue;
      this.add('flower', x, y, z, randRange(this.rng, 0.8, 1.3), new THREE.Color(palette[Math.floor(this.rng() * palette.length)]));
    }
  }

  /** Creates the instanced meshes. Call once after all placements. */
  build(): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const sp of this.species.values()) {
      sp.variants.forEach((geometry, vi) => {
        for (const list of this.chunks(sp.placements[vi], sp.scalable)) this.buildList(sp, geometry, list, m, q, p, s);
      });
    }
  }

  private buildList(sp: Species, geometry: THREE.BufferGeometry, list: Placement[], m: THREE.Matrix4, q: THREE.Quaternion, p: THREE.Vector3, s: THREE.Vector3): void {
    if (!list.length) return;
    // shuffle so reduced counts thin out evenly
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const tint = new THREE.Color();
    const make = (geo: THREE.BufferGeometry, mat: THREE.Material, colored: boolean) => {
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      mesh.name = `veg:${sp.name}`;
      list.forEach((pl, i) => {
        q.setFromAxisAngle(UP, pl.r);
        p.set(pl.x, pl.y, pl.z);
        s.setScalar(pl.s);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        if (colored && pl.color) mesh.setColorAt(i, pl.color);
        else if (!colored) {
          // mild per-plant variation: some a bit yellower / bluer / darker, never off-palette
          const h1 = this.hash(pl.x, pl.z);
          const h2 = this.hash(pl.z, pl.x);
          mesh.setColorAt(i, tint.setRGB(0.86 + 0.18 * h1, 0.9 + 0.12 * h2, 0.8 + 0.16 * (1 - h1)));
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = sp.cast;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      sp.meshes.push(mesh);
    };
    make(geometry, sp.material, false);
    if (sp.extra) make(sp.extra.geometry, sp.extra.material, sp.extra.colored);
  }

  /** Stable pseudo-random value in [0, 1) from a position (per-instance colour variation). */
  private hash(a: number, b: number): number {
    const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return h - Math.floor(h);
  }

  applyQuality(profile: QualityProfile): void {
    for (const sp of this.species.values()) {
      if (!sp.scalable) continue;
      for (const mesh of sp.meshes) {
        const total = mesh.instanceMatrix.count;
        mesh.count = Math.max(1, Math.floor(total * profile.vegetationDensity));
      }
    }
  }

  dispose(): void {
    for (const sp of this.species.values()) {
      for (const g of sp.variants) g.dispose();
      sp.extra?.geometry.dispose();
      for (const mesh of sp.meshes) mesh.dispose();
    }
    for (const mat of this.materials) mat.dispose();
    this.group.clear();
  }
}
