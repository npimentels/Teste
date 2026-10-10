import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addPatch, swimPatch, underwaterPatch, windPatch, type TankVolume } from './ShaderPatches';
import type { Updatable } from '../core/types';
import { createRng, randRange } from '../core/math';

/** Procedural tropical fish, kelp, corals and rocks for the aquariums (no external models). */

interface FishSpecies {
  name: string;
  length: number;
  height: number;
  body: number;
  belly: number;
  fin: number;
  stripes?: number;
  stripeX?: number[];
}

export const FISH_SPECIES: FishSpecies[] = [
  { name: 'tang', length: 0.42, height: 0.6, body: 0x1f6fd9, belly: 0x5ab0ff, fin: 0xffd23f },
  { name: 'clown', length: 0.3, height: 0.55, body: 0xff8a1f, belly: 0xffb15c, fin: 0xff8a1f, stripes: 0xffffff, stripeX: [0.22, -0.05] },
  { name: 'neon', length: 0.22, height: 0.38, body: 0x22c7d6, belly: 0xff5a7a, fin: 0xbff6ff },
  { name: 'yellow', length: 0.36, height: 0.75, body: 0xffd84a, belly: 0xfff0a0, fin: 0xffe27a },
  { name: 'angel', length: 0.4, height: 0.9, body: 0xe8f4ff, belly: 0xffffff, fin: 0xd8ecff, stripes: 0x203040, stripeX: [0.15, -0.12] },
];

function fishGeometry(sp: FishSpecies): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.5, 18, 12);
  const pos = body.attributes.position;
  const cols: number[] = [];
  const cBody = new THREE.Color(sp.body);
  const cBelly = new THREE.Color(sp.belly);
  const cStripe = sp.stripes !== undefined ? new THREE.Color(sp.stripes) : null;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i) * sp.height;
    let z = pos.getZ(i) * 0.32;
    // taper to the tail (−X) and blunt the nose (+X)
    const taper = x < 0 ? 1 + x * 1.3 : 1 - x * 0.35;
    y *= taper;
    z *= taper;
    x *= 1;
    pos.setXYZ(i, x, y, z);
    c.copy(cBelly).lerp(cBody, THREE.MathUtils.clamp(0.5 + y * 2.4, 0, 1));
    if (cStripe && sp.stripeX) for (const sx of sp.stripeX) if (Math.abs(x - sx) < 0.045) c.copy(cStripe);
    // eye
    if (x > 0.3 && x < 0.38 && y > 0.02 && y < 0.1 && Math.abs(z) > 0.05) c.setHex(0x101820);
    cols.push(c.r, c.g, c.b);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  body.deleteAttribute('uv');
  const fin = new THREE.Color(sp.fin);
  const fins = new THREE.BufferGeometry();
  const fp = [
    // tail
    -0.42, 0, 0, -0.78, 0.3 * sp.height, 0, -0.66, 0, 0,
    -0.42, 0, 0, -0.66, 0, 0, -0.78, -0.3 * sp.height, 0,
    // dorsal
    0.12, 0.24 * sp.height, 0, -0.08, 0.5 * sp.height, 0, -0.25, 0.22 * sp.height, 0,
    // ventral
    0.05, -0.22 * sp.height, 0, -0.1, -0.4 * sp.height, 0, -0.2, -0.2 * sp.height, 0,
  ];
  fins.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const fc: number[] = [];
  for (let i = 0; i < fp.length / 3; i++) fc.push(fin.r, fin.g, fin.b);
  fins.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
  fins.computeVertexNormals();
  const merged = mergeGeometries([body.toNonIndexed(), fins], false)!;
  merged.computeVertexNormals();
  merged.scale(sp.length / 0.9 * 1.0, sp.length / 0.9, sp.length / 0.9);
  return merged;
}

function kelpGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const blades = 3;
  for (let b = 0; b < blades; b++) {
    const h = randRange(rng, 2.2, 3.6);
    const ox = randRange(rng, -0.15, 0.15);
    const oz = randRange(rng, -0.15, 0.15);
    const seg = 12;
    const base = pos.length / 3;
    const ph = rng() * 6;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const y = t * h;
      const wobble = Math.sin(t * 9 + ph) * 0.08;
      const w = 0.09 * (1 - t * 0.6) + 0.03;
      const cA = new THREE.Color(0x3d8f3a).lerp(new THREE.Color(0x9ad35a), t);
      pos.push(ox - w + wobble, y, oz, ox + w + wobble, y, oz);
      col.push(cA.r, cA.g, cA.b, cA.r, cA.g, cA.b);
      if (i < seg) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A coral cluster: tapered branches with rounded tips, vertex coloured. */
export function coralGeometry(seed: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const palette = [0xff9ec7, 0xff8a65, 0xb98cff, 0xffd36e, 0x7fe0c8, 0xff6f91];
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color(palette[Math.floor(rng() * palette.length)]);
  const branches = 6 + Math.floor(rng() * 6);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < branches; i++) {
    const len = randRange(rng, 0.25, 0.7);
    const dir = new THREE.Vector3(randRange(rng, -0.6, 0.6), 1, randRange(rng, -0.6, 0.6)).normalize();
    const cyl = new THREE.CylinderGeometry(0.025, 0.06, len, 6).translate(0, len / 2, 0);
    cyl.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    const tip = new THREE.SphereGeometry(0.05, 8, 6).translate(dir.x * len, dir.y * len, dir.z * len);
    for (const g of [cyl, tip]) {
      g.deleteAttribute('uv');
      const cols = new Float32Array(g.attributes.position.count * 3);
      const tint = color.clone().offsetHSL(randRange(rng, -0.03, 0.03), 0, randRange(rng, -0.05, 0.08));
      for (let k = 0; k < cols.length; k += 3) cols.set([tint.r, tint.g, tint.b], k);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      parts.push(g.toNonIndexed());
    }
  }
  const brain = new THREE.IcosahedronGeometry(0.22, 2);
  brain.deleteAttribute('uv');
  const bp = brain.attributes.position;
  const bc = new Float32Array(bp.count * 3);
  const b2 = new THREE.Color(palette[Math.floor(rng() * palette.length)]);
  for (let k = 0; k < bp.count; k++) {
    const y = bp.getY(k);
    bp.setY(k, Math.max(y, -0.05) * 0.7);
    bp.setX(k, bp.getX(k) + 0.25);
    bc.set([b2.r, b2.g, b2.b], k * 3);
  }
  brain.setAttribute('color', new THREE.BufferAttribute(bc, 3));
  parts.push(brain);
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return merged;
}

export function rockGeometry(seed: number, size: number): THREE.BufferGeometry {
  const rng = createRng(seed);
  const g = new THREE.IcosahedronGeometry(size, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.75 + rng() * 0.45;
    v.multiplyScalar(n);
    v.y = Math.max(v.y * 0.7, -size * 0.2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

interface FishState {
  species: number;
  index: number;
  cx: number;
  cy: number;
  cz: number;
  ax: number;
  ay: number;
  az: number;
  speed: number;
  phase: number;
}

/**
 * One aquarium's fish school. Fish follow smooth closed paths (figure-eights in box tanks,
 * orbits in cylinders) and always face their direction of travel.
 */
export class FishSchool implements Updatable {
  readonly group = new THREE.Group();
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly fish: FishState[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(
    private readonly volume: TankVolume,
    perSpecies: number,
    materialFor: (vertexColors: boolean) => THREE.MeshStandardMaterial,
    geometries: THREE.BufferGeometry[],
    seed: number,
  ) {
    const rng = createRng(seed);
    const mat = materialFor(true);
    addPatch(mat, swimPatch());
    geometries.forEach((geo, si) => {
      const mesh = new THREE.InstancedMesh(geo, mat, perSpecies);
      mesh.frustumCulled = false;
      mesh.name = `fish:${FISH_SPECIES[si].name}`;
      this.meshes.push(mesh);
      this.group.add(mesh);
      for (let i = 0; i < perSpecies; i++) {
        const margin = 0.6;
        let st: FishState;
        if (volume.shape === 1) {
          st = {
            species: si,
            index: i,
            cx: volume.center.x,
            cy: randRange(rng, volume.min.y + margin, volume.max.y - margin),
            cz: volume.center.y,
            ax: randRange(rng, 0.7, volume.radius - 0.45),
            ay: randRange(rng, 0.1, 0.4),
            az: 0,
            speed: randRange(rng, 0.25, 0.5) * (rng() < 0.5 ? -1 : 1),
            phase: rng() * Math.PI * 2,
          };
        } else {
          const sx = (volume.max.x - volume.min.x) / 2;
          const sz = (volume.max.z - volume.min.z) / 2;
          st = {
            species: si,
            index: i,
            cx: (volume.min.x + volume.max.x) / 2 + randRange(rng, -sx * 0.3, sx * 0.3),
            cy: randRange(rng, volume.min.y + 0.8, volume.max.y - 0.6),
            cz: (volume.min.z + volume.max.z) / 2 + randRange(rng, -sz * 0.2, sz * 0.2),
            ax: randRange(rng, sx * 0.35, sx * 0.62),
            ay: randRange(rng, 0.1, 0.5),
            az: randRange(rng, sz * 0.3, sz * 0.55),
            speed: randRange(rng, 0.05, 0.11) * (rng() < 0.5 ? -1 : 1),
            phase: rng() * Math.PI * 2,
          };
        }
        this.fish.push(st);
      }
    });
    this.update(0, 0);
  }

  update(_dt: number, time: number): void {
    const cyl = this.volume.shape === 1;
    for (const f of this.fish) {
      const a = time * f.speed + f.phase;
      let x: number;
      let z: number;
      let dx: number;
      let dz: number;
      if (cyl) {
        x = f.cx + Math.cos(a) * f.ax;
        z = f.cz + Math.sin(a) * f.ax;
        dx = -Math.sin(a) * f.speed;
        dz = Math.cos(a) * f.speed;
      } else {
        x = f.cx + Math.sin(a) * f.ax;
        z = f.cz + Math.sin(a * 2) * f.az * 0.5;
        dx = Math.cos(a) * f.ax * f.speed;
        dz = Math.cos(a * 2) * f.az * f.speed;
      }
      const y = f.cy + Math.sin(a * 1.7 + f.phase) * f.ay;
      const dy = Math.cos(a * 1.7 + f.phase) * f.ay * f.speed * 1.7;
      const yaw = Math.atan2(-dz, dx);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 0.6;
      this.e.set(0, yaw, pitch, 'YZX');
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      this.m.compose(this.p, this.q, this.s);
      this.meshes[f.species].setMatrixAt(f.index, this.m);
    }
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Builds shared geometries once. */
export class AquaticAssets {
  readonly fish = FISH_SPECIES.map(fishGeometry);
  readonly kelp = [kelpGeometry(1), kelpGeometry(2)];
  readonly corals = [coralGeometry(3), coralGeometry(4), coralGeometry(5), coralGeometry(6)];
  readonly rocks = [rockGeometry(7, 0.5), rockGeometry(8, 0.8), rockGeometry(9, 0.35)];

  dispose(): void {
    for (const g of [...this.fish, ...this.kelp, ...this.corals, ...this.rocks]) g.dispose();
  }
}

/** Creates a per-tank material set with the underwater absorption patch. */
export function underwaterMaterials(volume: TankVolume, waterColor: THREE.Color, density: THREE.IUniform<number>, light: THREE.IUniform<number>) {
  const patch = () => underwaterPatch(volume, waterColor, density, light);
  const make = (params: THREE.MeshStandardMaterialParameters, extra?: (m: THREE.MeshStandardMaterial) => void) => {
    const m = new THREE.MeshStandardMaterial(params);
    extra?.(m);
    addPatch(m, patch());
    return m;
  };
  return {
    make,
    kelp: make({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }, (m) => addPatch(m, windPatch(0.05, 0.7, 'kelpSway'))),
    coral: make({ vertexColors: true, roughness: 0.7 }),
    rock: make({ color: 0xd9d4c4, roughness: 0.9, flatShading: true }),
  };
}
