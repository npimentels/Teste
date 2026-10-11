import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext } from './WorldContext';
import { LAYOUT, registerPaving, registerPavingRing } from './WorldLayout';
import { WATER_LOOKS } from '../environment/WaterSystem';
import { createRng, randRange } from '../core/math';
import type { Updatable } from '../core/types';

const SEA_Y = -32;

/**
 * The plateau the complex stands on: lawn, cliff, perimeter balustrade, the open sea and the
 * distant islands with their eco-towers and wind turbines (the "horizon" of the terrace).
 */
export class Surroundings implements Updatable {
  private readonly rotors: THREE.Object3D[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly materials: THREE.Material[] = [];

  constructor(private readonly ctx: WorldContext) {
    const K = LAYOUT.market;
    const inMarket = (x: number, z: number, pad: number) => x > K.x0 - pad && x < K.x1 + pad && z > K.z0 - pad && z < K.z1 + pad;
    const { builder: b, mats: m, collision } = ctx;
    collision.terrain.outline = LAYOUT.outline.map(([x, z]) => [x, z] as [number, number]);

    // ---- Lawn with holes where sunken basins are --------------------------------------
    const A = LAYOUT.atrium;
    const circle = (cx: number, cz: number, r: number, n = 48): Array<[number, number]> =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as [number, number];
      });
    const C = LAYOUT.gardens.canal;
    const canalHole: Array<[number, number]> = [
      [C.x0, C.z0],
      [C.x1, C.z0],
      [C.x1, C.z1],
      [C.x0, C.z1],
    ];
    b.slab(m.lawn, LAYOUT.outline as Array<[number, number]>, [circle(0, 0, A.poolR), canalHole], 0, 0.6, { cast: false });

    // ---- Cliff ------------------------------------------------------------------------
    this.buildCliff();

    // ---- Perimeter balustrade -----------------------------------------------------------
    // (open along the Aqua Metro station, whose platform screen doors take over the edge)
    const inset = insetPolygon(LAYOUT.outline as Array<[number, number]>, 0.7);
    const S = LAYOUT.metro.station;
    const BR = LAYOUT.horizonte.bridge;
    // openings: the metro station (east edge) and the footbridge to Ala Horizonte (south edge)
    const cuts: Array<{ axis: 'x' | 'z'; at: number; from: number; to: number }> = [
      { axis: 'x', at: 63.3, from: S.z0 - 0.3, to: S.z1 + 0.3 },
      { axis: 'z', at: 27.3, from: BR.x0, to: BR.x1 },
    ];
    const runs: Array<Array<[number, number]>> = [[]];
    for (let i = 0; i < inset.length; i++) {
      const a = inset[i];
      const c = inset[(i + 1) % inset.length];
      runs[runs.length - 1].push(a);
      for (const cut of cuts) {
        // segment parallel to the cut axis, on the cut line?
        const k = cut.axis === 'x' ? 0 : 1; // coordinate that is constant along the segment
        const along = 1 - k;
        if (Math.abs(a[k] - c[k]) > 0.01 || Math.abs(a[k] - cut.at) > 0.5) continue;
        const lo = Math.min(a[along], c[along]);
        const hi = Math.max(a[along], c[along]);
        const c0 = Math.max(lo, cut.from);
        const c1 = Math.min(hi, cut.to);
        if (c1 <= c0) continue;
        const desc = c[along] < a[along];
        const p0: [number, number] = [0, 0];
        const p1: [number, number] = [0, 0];
        p0[k] = a[k];
        p1[k] = a[k];
        p0[along] = desc ? c1 : c0;
        p1[along] = desc ? c0 : c1;
        runs[runs.length - 1].push(p0);
        runs.push([p1]);
      }
    }
    // close the loop: the last run continues into the first
    if (runs.length > 1) runs[0] = [...runs.pop()!, ...runs[0]];
    else runs[0].push(inset[0]);
    for (const run of runs) b.glassRailing(run, 0, 1.1);

    // ---- South plaza in front of the atrium -------------------------------------------
    b.ring(m.paving, 0, 0.02, 0, A.rIn + A.wallT, A.rIn + 5.5, 0.1, { a0: 0.35, a1: Math.PI - 0.35 });
    registerPavingRing(0, 0, A.rIn + A.wallT, A.rIn + 5.5);
    // approach to the footbridge (Ala Horizonte)
    b.box(m.paving, 0, -0.08, 24.6, 5.2, 0.1, 6.0, { cast: false });
    registerPaving(-2.6, 21.5, 2.6, 27.6);
    // Sculptural glossy spheres on the lawn
    for (const [x, z, r, mat] of [
      [-14, 22, 1.2, m.glossyGreen],
      [-11.5, 23.5, 0.7, m.glossyCyan],
    ] as Array<[number, number, number, THREE.Material]>) {
      b.sphere(mat, x, r * 0.92, z, r);
      collision.addCylinder({ x, z, r: r * 0.95, minY: 0, maxY: r * 1.8, surface: 'stone' });
    }
    // Palms & bushes around the outside of the atrium
    const rng = createRng(77);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.17;
      if (Math.abs(Math.sin(a) + 1) < 0.25) continue; // keep the north side (gardens) open
      if (Math.abs(a % (Math.PI * 2)) < 0.25) continue; // east tunnel
      const r = randRange(rng, 22.5, 25);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (x > 14 && Math.abs(z) < 11) continue;
      if (inMarket(x, z, 2.5)) continue;
      if (Math.abs(x) < 5 && z > 0) continue; // footbridge approach
      ctx.veg.palm(x, 0, z, randRange(rng, 0.9, 1.15));
      ctx.veg.bush(x + 1.4, 0, z + 0.6, 0.8);
      ctx.veg.fern(x - 1.1, 0, z - 0.7, 1);
    }
    // Lawn grass & flowers around the south / east lawns (kept off paving & buildings)
    const accept = (x: number, z: number) => {
      const r = Math.hypot(x, z);
      if (r < A.rIn + 5.8) return false;
      if (x > 15 && Math.abs(z) < 10.5 && x < 58) return false;
      if (Math.hypot(x - LAYOUT.gallery.room.x, z) < 8.5) return false;
      if (inMarket(x, z, 1.2)) return false;
      if (Math.abs(x) < 3.4 && z > 18) return false; // footbridge approach
      if (x > S.x0 - 1.5 && z > S.z0 - 1 && z < S.z1 + 5.5) return false; // station + entrance plaza
      return collision.terrain.insideOutline(x, z) && Math.abs(insetDistance(x, z)) > 1.2;
    };
    ctx.veg.grass(-36, -16, 62, 26, 2000, 0, accept);
    ctx.veg.flowers(-36, -16, 62, 26, 320, 0, accept);

    // ---- Sea & islands -----------------------------------------------------------------
    ctx.water.add({
      name: 'ocean',
      shape: { kind: 'circle', x: 13, z: -30, r: 6000 },
      surfaceY: SEA_Y,
      look: WATER_LOOKS.ocean,
      segments: 64,
      queryable: false,
      renderOrder: 0,
    });
    this.buildIslands();

    b.flush('surroundings');
  }

  private buildCliff(): void {
    const outline = LAYOUT.outline as Array<[number, number]>;
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const depth = -SEA_Y + 3;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 7, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, -depth - 0.08, 0);
    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();
    const cx = 13;
    const cz = -30;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y > -1.2) continue;
      const dx = v.x - cx;
      const dz = v.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      const n = Math.sin(v.x * 0.31 + v.y * 0.7) * Math.cos(v.z * 0.27 - v.y * 0.4) + Math.sin(v.y * 1.3 + v.x * 0.11) * 0.5;
      const k = Math.min(1, (-v.y - 1.2) / 6) * (1.4 + n * 1.6);
      v.x += (dx / len) * k;
      v.z += (dz / len) * k;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.ctx.mats.cliff);
    mesh.receiveShadow = true;
    mesh.name = 'Cliff';
    this.ctx.builder.root.add(mesh);
    this.meshes.push(mesh);
  }

  private buildIslands(): void {
    const root = this.ctx.builder.root;
    const islandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
    const white = this.ctx.mats.whiteCeramic;
    const glass = this.ctx.mats.glossyCyan;
    this.materials.push(islandMat);
    const islands: Array<[number, number, number, number, number]> = [
      // x, z, radius, height, seed
      [-190, -540, 120, 55, 1],
      [280, -720, 170, 80, 2],
      [-560, -880, 210, 95, 3],
      [70, -1150, 260, 70, 4],
      [520, -230, 140, 50, 5],
      [-470, -140, 120, 60, 6],
      [-260, 520, 180, 70, 7],
      [420, 560, 150, 65, 8],
    ];
    const islandGeos: THREE.BufferGeometry[] = [];
    const b = this.ctx.builder;
    const sand = new THREE.Color(0xf0e2bf);
    const green = new THREE.Color(0x4fae5c);
    const deep = new THREE.Color(0x2f8a47);
    for (const [x, z, r, h, seed] of islands) {
      const rng = createRng(seed * 31);
      const g = new THREE.IcosahedronGeometry(1, 4);
      const pos = g.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const v = new THREE.Vector3();
      const c = new THREE.Color();
      const ph = rng() * 10;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = 1 + Math.sin(v.x * 3 + ph) * Math.cos(v.z * 2.6 - ph) * 0.18 + Math.sin(v.x * 7 + v.z * 5) * 0.05;
        const y = Math.max(v.y, -0.2) * h * n;
        pos.setXYZ(i, v.x * r * n, y, v.z * r * n);
        const t = y / h;
        if (t < 0.06) c.copy(sand);
        else c.copy(green).lerp(deep, Math.min(1, t * 1.4 + rng() * 0.15));
        cols.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      g.deleteAttribute('uv');
      g.translate(x, SEA_Y - 2, z);
      islandGeos.push(g);
      // Eco-towers
      const towers = 2 + Math.floor(rng() * 3);
      for (let t = 0; t < towers; t++) {
        const tx = x + randRange(rng, -0.35, 0.35) * r;
        const tz = z + randRange(rng, -0.35, 0.35) * r;
        const th = randRange(rng, 40, 120);
        const base = SEA_Y + h * 0.6;
        const towerGeo = new THREE.CylinderGeometry(randRange(rng, 3, 6), randRange(rng, 6, 10), th, 24);
        b.place(towerGeo, white, tx, base + th / 2, tz, { cast: false });
        const domeGeo = new THREE.SphereGeometry(randRange(rng, 7, 12), 24, 16);
        b.place(domeGeo, rng() < 0.5 ? glass : white, tx, base + th, tz, { cast: false });
        const ringGeo = new THREE.TorusGeometry(randRange(rng, 10, 16), 0.9, 8, 48);
        b.place(ringGeo, this.ctx.mats.chrome, tx, base + th * randRange(rng, 0.55, 0.85), tz, { rotX: Math.PI / 2, cast: false });
        for (const gg of [towerGeo, domeGeo, ringGeo]) gg.dispose();
      }
      if (seed === 2 || seed === 5 || seed === 6) this.buildTurbines(x, z, r, SEA_Y + h * 0.4, rng);
    }
    const merged = mergeGeometries(islandGeos, false)!;
    for (const g of islandGeos) g.dispose();
    merged.computeBoundingSphere();
    const islandsMesh = new THREE.Mesh(merged, islandMat);
    islandsMesh.name = 'Islands';
    root.add(islandsMesh);
    this.meshes.push(islandsMesh);
  }

  private buildTurbines(x: number, z: number, r: number, y: number, rng: () => number): void {
    const root = this.ctx.builder.root;
    const white = this.ctx.mats.whiteMatte;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng();
      const tx = x + Math.cos(a) * r * 0.55;
      const tz = z + Math.sin(a) * r * 0.55;
      const h = 70;
      const towerGeo = new THREE.CylinderGeometry(1.2, 2.4, h, 12);
      this.ctx.builder.place(towerGeo, white, tx, y + h / 2, tz, { cast: false });
      towerGeo.dispose();
      const hub = new THREE.Mesh(this.bladeGeometry(), white);
      hub.position.set(tx, y + h, tz + 2.5);
      const nacelleGeo = new THREE.CapsuleGeometry(1.8, 5, 4, 12);
      this.ctx.builder.place(nacelleGeo, white, tx, y + h, tz - 0.5, { rotX: Math.PI / 2, cast: false });
      nacelleGeo.dispose();
      hub.userData.speed = 0.5 + rng() * 0.3;
      hub.rotation.z = rng() * Math.PI;
      root.add(hub);
      this.rotors.push(hub);
    }
  }

  private blades: THREE.BufferGeometry | null = null;

  /** Three-blade rotor shared by every turbine. */
  private bladeGeometry(): THREE.BufferGeometry {
    if (!this.blades) {
      const parts = [0, 1, 2].map((k) => new THREE.BoxGeometry(1.4, 30, 0.4).translate(0, 15, 0).rotateZ((k / 3) * Math.PI * 2));
      this.blades = mergeGeometries(parts, false)!;
      parts.forEach((p) => p.dispose());
    }
    return this.blades;
  }

  update(dt: number): void {
    for (const r of this.rotors) r.rotation.z += dt * (r.userData.speed as number);
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    this.blades?.dispose();
    for (const mat of this.materials) mat.dispose();
  }
}

/** Polygon inset by `d` (works for convex-ish outlines; good enough for the balustrade). */
function insetPolygon(poly: Array<[number, number]>, d: number): Array<[number, number]> {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  return poly.map(([x, z]) => {
    const dx = cx - x;
    const dz = cz - z;
    const len = Math.hypot(dx, dz) || 1;
    return [x + (dx / len) * d * 1.3, z + (dz / len) * d * 1.3] as [number, number];
  });
}

/** Rough distance to the outline (used to keep plants off the balustrade). */
function insetDistance(x: number, z: number): number {
  const poly = LAYOUT.outline;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];
    const abx = bx - ax;
    const abz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)));
    best = Math.min(best, Math.hypot(x - (ax + abx * t), z - (az + abz * t)));
  }
  return best;
}
