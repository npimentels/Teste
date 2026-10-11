import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import type { Updatable } from '../core/types';
import type { Landmark } from '../systems/Telescope';
import { createRng, randRange } from '../core/math';
import { LAYOUT } from './WorldLayout';

/**
 * The visual continuation of AQUA beyond the explorable map — an illusion of a vast city, not
 * a navigable world. Three layers:
 *  • mid (≈ 0.4–1.2 km): five districts on floating platforms with varied towers (tapered
 *    glass, stacked garden terraces, rounded slabs, spires, domes), curved elevated walkways
 *    with planters, canals, park lawns and a monorail loop with a moving train;
 *  • far (≈ 1.6–3.4 km): a ring of instanced tower silhouettes that dissolve into the haze;
 *  • sky: volumetric-looking cumulus banks near the horizon (opaque, soft-shaded geometry),
 *    on top of the procedural sky dome.
 * Plus the Line 2 viaduct continuing from Parque Flutuante towards Cidade das Águas.
 * Nothing here casts shadows; districts are flushed separately so frustum culling works.
 */

const SEA = -32;

interface DistrictSpec {
  name: string;
  x: number;
  z: number;
  r: number;
  towers: number;
  maxH: number;
  seed: number;
  walkways: number;
  monorail?: boolean;
  /** Named landmarks (for telescopes): [label, note]. */
  names: Array<[string, string]>;
}

const DISTRICTS: DistrictSpec[] = [
  {
    name: 'Cidade das Águas',
    x: 360,
    z: -760,
    r: 190,
    towers: 22,
    maxH: 290,
    seed: 909,
    walkways: 7,
    monorail: true,
    names: [
      ['Torre Aurora', 'Cidade das Águas · destino da Linha 2 (em obras)'],
      ['Torre Coral', 'Cidade das Águas · jardins em anéis'],
      ['Agulha do Farol', 'Cidade das Águas · 3,1 km'],
    ],
  },
  {
    name: 'Distrito Sul',
    x: 60,
    z: 620,
    r: 170,
    towers: 16,
    maxH: 190,
    seed: 314,
    walkways: 6,
    monorail: true,
    names: [
      ['Arcos do Sul', 'Distrito Sul · passarelas suspensas'],
      ['Torre Lume', 'Distrito Sul · 0,6 km'],
    ],
  },
  { name: 'Distrito Oeste', x: -640, z: 160, r: 150, towers: 14, maxH: 170, seed: 271, walkways: 5, names: [['Ponte das Nuvens', 'Distrito Oeste · 0,7 km'], ['Torre Maré Alta', 'Distrito Oeste · terraços-jardim']] },
  { name: 'Jardins do Norte', x: -330, z: -1000, r: 160, towers: 13, maxH: 200, seed: 161, walkways: 5, names: [['Domo do Norte', 'Jardins do Norte · estufa-cúpula'], ['Torre Brisa', 'Jardins do Norte · 1,1 km']] },
  { name: 'Ilha das Estufas', x: 560, z: 340, r: 120, towers: 9, maxH: 140, seed: 577, walkways: 3, names: [['Estufas Solares', 'Ilha das Estufas · cúpulas de cultivo']] },
];

/** Landmarks named by the telescopes (tower tops are placed deterministically below). */
export const HORIZON_LANDMARKS: Landmark[] = [];

const rngFor = (d: DistrictSpec) => createRng(d.seed);

/** Deterministic tower plan of a district (shared by the builder and the landmark list). */
function towerPlan(d: DistrictSpec): Array<{ x: number; z: number; h: number; r: number; type: number }> {
  const rng = rngFor(d);
  const out: Array<{ x: number; z: number; h: number; r: number; type: number }> = [];
  let tries = 0;
  while (out.length < d.towers && tries++ < 400) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * d.r * 0.85;
    const x = d.x + Math.cos(a) * rr;
    const z = d.z + Math.sin(a) * rr;
    const r = randRange(rng, 9, 22);
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r + 14)) continue;
    // taller near the centre, with variety
    const centrality = 1 - rr / d.r;
    const h = d.maxH * (0.3 + 0.7 * centrality * randRange(rng, 0.55, 1.0));
    out.push({ x, z, h, r, type: Math.floor(rng() * 5) });
  }
  out.sort((p, q) => q.h - p.h);
  return out;
}

for (const d of DISTRICTS) {
  const plan = towerPlan(d);
  d.names.forEach(([label, note], i) => {
    const t = plan[Math.min(i * 2, plan.length - 1)];
    HORIZON_LANDMARKS.push({ name: label, note, at: new THREE.Vector3(t.x, SEA + t.h * 0.75, t.z) });
  });
}
HORIZON_LANDMARKS.push({ name: 'Parque Flutuante', note: 'Linha 2 · estação terminal (acessível de metrô)', at: new THREE.Vector3(53, 2, -423) });
HORIZON_LANDMARKS.push({ name: 'Átrio Azul', note: 'O coração do complexo AQUA', at: new THREE.Vector3(0, 8, 0) });

export class Horizon implements Updatable {
  private readonly movers: Array<{ mesh: THREE.Object3D; curve: THREE.Curve<THREE.Vector3>; speed: number; t: number }> = [];
  private readonly boats: Array<{ mesh: THREE.Object3D; cx: number; cz: number; r: number; speed: number; a: number }> = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor(private readonly ctx: WorldContext) {
    const b = ctx.builder;
    const mats = this.cityMaterials();
    for (const d of DISTRICTS) {
      this.district(b, d, mats);
      b.flush(`district:${d.name}`);
    }
    this.farRing(b.root, mats);
    this.viaductExtension(b);
    b.flush('horizon:viaduct');
    this.clouds(b.root);
    this.boatsOnSea(b.root);
  }

  private cityMaterials() {
    const glass = new THREE.MeshPhysicalMaterial({ name: 'cityGlass', color: 0x86ccf2, metalness: 0.55, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 });
    const glassDeep = new THREE.MeshPhysicalMaterial({ name: 'cityGlassDeep', color: 0x3c86d8, metalness: 0.6, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.5 });
    const glassTeal = new THREE.MeshPhysicalMaterial({ name: 'cityGlassTeal', color: 0x5fd0d6, metalness: 0.5, roughness: 0.1, clearcoat: 1, envMapIntensity: 1.5 });
    const white = new THREE.MeshStandardMaterial({ name: 'cityWhite', color: 0xf3f8fb, roughness: 0.35 });
    const green = new THREE.MeshStandardMaterial({ name: 'cityGreen', color: 0x5dbb4f, roughness: 0.8 });
    const water = new THREE.MeshStandardMaterial({ name: 'cityWater', color: 0x3fb4e0, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2 });
    const cyan = new THREE.MeshStandardMaterial({ name: 'cityLights', color: 0xbff6ff, emissive: 0x28c5df, emissiveIntensity: 1.2 });
    const far = new THREE.MeshStandardMaterial({ name: 'cityFar', color: 0x9fcbe8, roughness: 0.3, metalness: 0.3, envMapIntensity: 1.0 });
    const farWhite = new THREE.MeshStandardMaterial({ name: 'cityFarWhite', color: 0xe2eef6, roughness: 0.5 });
    const all = { glass, glassDeep, glassTeal, white, green, water, cyan, far, farWhite };
    this.materials.push(...Object.values(all));
    return all;
  }

  // ---------------------------------------------------------------------------------------
  // Mid layer: districts
  // ---------------------------------------------------------------------------------------
  private district(b: WorldBuilder, d: DistrictSpec, M: ReturnType<Horizon['cityMaterials']>): void {
    const rng = createRng(d.seed + 1);
    const plan = towerPlan(d);
    const place = (g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rotY = 0) => {
      b.place(g, mat, x, y, z, { cast: false, receive: false, rotY });
      g.dispose();
    };
    // platforms: a few overlapping rounded discs (white rim, lawn top) with canals between
    const pads = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < pads; i++) {
      const a = (i / pads) * Math.PI * 2 + rng();
      const rr = i === 0 ? 0 : randRange(rng, 0.35, 0.7) * d.r;
      const px = d.x + Math.cos(a) * rr;
      const pz = d.z + Math.sin(a) * rr;
      const pr = i === 0 ? d.r * 0.55 : randRange(rng, 0.28, 0.42) * d.r;
      const h = randRange(rng, 3, 7);
      place(new THREE.CylinderGeometry(pr, pr * 1.04, h, 40), M.white, px, SEA + h / 2 - 1, pz);
      place(new THREE.CylinderGeometry(pr * 0.94, pr * 0.94, 0.6, 40), M.green, px, SEA + h - 0.7, pz);
      place(new THREE.TorusGeometry(pr * 0.99, 0.5, 6, 48).rotateX(Math.PI / 2), M.cyan, px, SEA + h - 0.8, pz);
      if (rng() < 0.6) place(new THREE.CylinderGeometry(pr * 0.35, pr * 0.35, 0.3, 32), M.water, px + pr * 0.3, SEA + h - 0.35, pz - pr * 0.2);
      // tree clumps (cheap: merged spheres)
      const trees: THREE.BufferGeometry[] = [];
      for (let k = 0; k < 10; k++) {
        const ta = rng() * Math.PI * 2;
        const tr = Math.sqrt(rng()) * pr * 0.85;
        const s = randRange(rng, 3, 6);
        trees.push(new THREE.IcosahedronGeometry(s, 1).translate(px + Math.cos(ta) * tr, SEA + h + s * 0.6, pz + Math.sin(ta) * tr));
      }
      const merged = mergeGeometries(trees, false)!;
      trees.forEach((t) => t.dispose());
      place(merged, M.green, 0, 0, 0);
    }
    // towers
    for (const [i, t] of plan.entries()) {
      const base = SEA + 4;
      const glass = [M.glass, M.glassDeep, M.glassTeal][i % 3];
      switch (t.type) {
        case 0: {
          // tapered glass tower with garden rings (the reference silhouette)
          const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0)];
          const bulge = randRange(rng, 0.1, 0.3);
          for (let k = 0; k <= 12; k++) {
            const s = k / 12;
            pts.push(new THREE.Vector2(t.r * (1 + Math.sin(s * Math.PI) * bulge) * (1 - s * 0.6), s * t.h));
          }
          pts.push(new THREE.Vector2(t.r * 0.12, t.h + t.r * 1.5), new THREE.Vector2(0.001, t.h + t.r * 1.7));
          place(new THREE.LatheGeometry(pts, 14), glass, t.x, base, t.z);
          const rings = 2 + Math.floor(rng() * 3);
          for (let k = 0; k < rings; k++) {
            const ry = base + t.h * (0.22 + k * 0.18);
            const rr = t.r * (1 + Math.sin((0.22 + k * 0.18) * Math.PI) * bulge) * (1 - (0.22 + k * 0.18) * 0.6) + 5;
            place(new THREE.CylinderGeometry(rr, rr, 2.2, 18), M.white, t.x, ry, t.z);
            place(new THREE.CylinderGeometry(rr - 0.6, rr - 0.6, 1.0, 18), M.green, t.x, ry + 1.5, t.z);
          }
          break;
        }
        case 1: {
          // core with stacked garden terraces (jardins suspensos)
          place(new THREE.CylinderGeometry(t.r * 0.45, t.r * 0.55, t.h, 20), M.white, t.x, base + t.h / 2, t.z);
          const n = 4 + Math.floor(t.h / 35);
          for (let k = 0; k < n; k++) {
            const y = base + ((k + 0.6) / n) * t.h;
            const rr = t.r * randRange(rng, 1.0, 1.5);
            const off = randRange(rng, -3, 3);
            place(new THREE.CylinderGeometry(rr, rr * 0.92, 2.4, 18), M.white, t.x + off, y, t.z - off);
            place(new THREE.CylinderGeometry(rr - 0.8, rr - 0.8, 1.2, 18), M.green, t.x + off, y + 1.6, t.z - off);
            place(new THREE.CylinderGeometry(rr * 0.55, rr * 0.55, 6, 14, 1, true), glass, t.x + off, y - 4, t.z - off);
          }
          break;
        }
        case 2: {
          // rounded slab tower (capsule plan)
          const shape = new THREE.Shape();
          const w = t.r * 1.6;
          const dd = t.r * 0.7;
          shape.absarc(-w / 2 + dd / 2, 0, dd / 2, Math.PI / 2, (Math.PI * 3) / 2, false);
          shape.absarc(w / 2 - dd / 2, 0, dd / 2, -Math.PI / 2, Math.PI / 2, false);
          const g = new THREE.ExtrudeGeometry(shape, { depth: t.h, bevelEnabled: false, curveSegments: 10 });
          g.rotateX(-Math.PI / 2);
          place(g, glass, t.x, base, t.z, rng() * Math.PI);
          place(new THREE.CylinderGeometry(t.r * 0.9, t.r * 0.9, 3, 24), M.white, t.x, base + t.h + 1.5, t.z);
          break;
        }
        case 3: {
          // slender spire with a disc crown and antenna
          place(new THREE.CylinderGeometry(t.r * 0.25, t.r * 0.6, t.h, 16), glass, t.x, base + t.h / 2, t.z);
          place(new THREE.CylinderGeometry(t.r * 1.2, t.r * 0.9, 4, 24), M.white, t.x, base + t.h * 0.82, t.z);
          place(new THREE.CylinderGeometry(0.6, 0.6, t.h * 0.25, 6), M.white, t.x, base + t.h + t.h * 0.12, t.z);
          break;
        }
        default: {
          // glass dome hall on a white drum
          const rr = t.r * 1.6;
          place(new THREE.CylinderGeometry(rr, rr, 8, 32), M.white, t.x, base + 4, t.z);
          place(new THREE.SphereGeometry(rr, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, t.x, base + 8, t.z);
          place(new THREE.TorusGeometry(rr, 0.8, 6, 40).rotateX(Math.PI / 2), M.cyan, t.x, base + 8, t.z);
          break;
        }
      }
    }
    // curved elevated walkways between towers, with railings lights and planters
    for (let k = 0; k < d.walkways && plan.length > 2; k++) {
      const a = plan[k % plan.length];
      const c = plan[(k * 3 + 2) % plan.length];
      if (a === c) continue;
      const y = SEA + randRange(rng, 18, 55);
      const mid = new THREE.Vector3((a.x + c.x) / 2 + randRange(rng, -40, 40), y + randRange(rng, -5, 8), (a.z + c.z) / 2 + randRange(rng, -40, 40));
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a.x, y, a.z), mid, new THREE.Vector3(c.x, y + randRange(rng, -6, 6), c.z)]);
      const len = curve.getLength();
      const segs = Math.max(8, Math.round(len / 8));
      place(new THREE.TubeGeometry(curve, segs, 2.4, 6, false).scale(1, 0.35, 1).translate(0, y * 0.65, 0), M.white, 0, 0, 0);
      place(new THREE.TubeGeometry(curve, segs, 0.35, 4, false).translate(0, 1.6, 0), M.cyan, 0, 0, 0);
      const p = new THREE.Vector3();
      for (let s = 1; s < 4; s++) {
        curve.getPoint(s / 4, p);
        place(new THREE.CylinderGeometry(0.9, 1.4, p.y - SEA, 10), M.white, p.x, SEA + (p.y - SEA) / 2, p.z);
        place(new THREE.IcosahedronGeometry(2.4, 1), M.green, p.x, p.y + 2.2, p.z);
      }
    }
    // monorail loop with a moving train
    if (d.monorail) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = d.r * (0.78 + Math.sin(a * 3 + d.seed) * 0.08);
        pts.push(new THREE.Vector3(d.x + Math.cos(a) * rr, SEA + 26 + Math.sin(a * 2) * 4, d.z + Math.sin(a) * rr));
      }
      const loop = new THREE.CatmullRomCurve3(pts, true);
      place(new THREE.TubeGeometry(loop, 120, 1.2, 6, true), M.white, 0, 0, 0);
      const p = new THREE.Vector3();
      for (let i = 0; i < 16; i++) {
        loop.getPoint(i / 16, p);
        place(new THREE.CylinderGeometry(0.8, 1.2, p.y - SEA, 8), M.white, p.x, SEA + (p.y - SEA) / 2, p.z);
      }
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.6, 26, 6, 12).rotateZ(Math.PI / 2), M.white);
      const band = new THREE.Mesh(new THREE.CapsuleGeometry(1.62, 26.2, 6, 12).rotateZ(Math.PI / 2).scale(1, 0.25, 1), M.glassDeep);
      band.position.y = 0.35;
      car.add(body, band);
      b.root.add(car);
      this.geometries.push(body.geometry, band.geometry);
      this.movers.push({ mesh: car, curve: loop, speed: 0.012 + (d.seed % 7) * 0.001, t: (d.seed % 10) / 10 });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Far layer: instanced silhouettes on a ring, fading into the haze
  // ---------------------------------------------------------------------------------------
  private farRing(root: THREE.Object3D, M: ReturnType<Horizon['cityMaterials']>): void {
    const rng = createRng(4040);
    const variants = [
      new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0.95, 0.5), new THREE.Vector2(0.55, 0.92), new THREE.Vector2(0.1, 1.05), new THREE.Vector2(0.001, 1.08)], 10),
      new THREE.CylinderGeometry(0.7, 1, 1, 10).translate(0, 0.5, 0),
      new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(1, 0), new THREE.Vector2(1.15, 0.35), new THREE.Vector2(0.7, 0.42), new THREE.Vector2(0.75, 0.8), new THREE.Vector2(0.3, 1.0), new THREE.Vector2(0.001, 1.0)], 10),
    ];
    this.geometries.push(...variants);
    const counts = [150, 110, 90];
    const meshes = variants.map((g, i) => {
      const mesh = new THREE.InstancedMesh(g, i === 1 ? M.farWhite : M.far, counts[i]);
      mesh.name = `skyline-far-${i}`;
      root.add(mesh);
      return mesh;
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    // clusters on the ring (gaps leave open sea in a few directions)
    const clusters: Array<[number, number]> = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + randRange(rng, -0.08, 0.08);
      if (Math.abs(Math.sin(a * 1.5 + 0.7)) < 0.18) continue;
      clusters.push([a, randRange(rng, 1700, 3300)]);
    }
    for (const [vi, mesh] of meshes.entries()) {
      for (let i = 0; i < counts[vi]; i++) {
        const [a, dist] = clusters[Math.floor(rng() * clusters.length)];
        const aa = a + randRange(rng, -0.09, 0.09);
        const dd = dist + randRange(rng, -180, 180);
        const h = randRange(rng, 60, 320) * (vi === 1 ? 0.6 : 1);
        const w = randRange(rng, 10, 26);
        p.set(13 + Math.cos(aa) * dd, SEA - 2, -30 + Math.sin(aa) * dd);
        s.set(w, h, w * randRange(rng, 0.8, 1.2));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  // ---------------------------------------------------------------------------------------
  // Line 2 viaduct beyond Parque Flutuante (out of reach; marked "em obras" at the terminus)
  // ---------------------------------------------------------------------------------------
  private viaductExtension(b: WorldBuilder): void {
    const m = b.mats;
    const M = LAYOUT.metro;
    const start = new THREE.Vector3(M.trackX, -3.4, M.island.z0 - 2);
    const curve = new THREE.CatmullRomCurve3([start, new THREE.Vector3(M.trackX, -3.4, -560), new THREE.Vector3(120, -2, -660), new THREE.Vector3(230, 4, -720), new THREE.Vector3(290, 10, -742)]);
    const len = curve.getLength();
    const segs = Math.round(len / 6);
    const deck = new THREE.TubeGeometry(curve, segs, 2.7, 4, false);
    deck.scale(1, 0.4, 1);
    // TubeGeometry is centred on the curve: flatten into a deck by squashing around y
    const pos = deck.attributes.position;
    const pts = curve.getSpacedPoints(segs);
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / 5);
      const c = pts[Math.min(ring, pts.length - 1)];
      pos.setY(i, c.y + (pos.getY(i) - c.y * 0.4));
    }
    deck.computeVertexNormals();
    b.place(deck, m.whiteCeramic, 0, 0, 0, { cast: false });
    deck.dispose();
    const rail = new THREE.TubeGeometry(curve, segs, 0.12, 4, false).translate(0, 1.1, 0);
    b.place(rail, m.glossyCyan, 0, 0, 0, { cast: false, receive: false });
    rail.dispose();
    const p = new THREE.Vector3();
    for (let i = 1; i < 14; i++) {
      curve.getPoint(i / 14, p);
      const h = p.y - SEA;
      b.cylinder(m.whiteCeramic, p.x, SEA, p.z, 1.0, 1.4, h - 0.8, { segments: 18, cast: false });
      b.cylinder(m.whiteCeramic, p.x, p.y - 1.4, p.z, 2.4, 1.0, 0.8, { segments: 18, cast: false });
    }
  }

  // ---------------------------------------------------------------------------------------
  // Cumulus banks: displaced icospheres, soft top-lit shading, haze towards the horizon
  // ---------------------------------------------------------------------------------------
  private clouds(root: THREE.Object3D): void {
    const rng = createRng(777);
    const parts: THREE.BufferGeometry[] = [];
    const banks = 15;
    for (let c = 0; c < banks; c++) {
      const a = (c / banks) * Math.PI * 2 + randRange(rng, -0.15, 0.15);
      const dist = randRange(rng, 1900, 3400);
      const cx = 13 + Math.cos(a) * dist;
      const cz = -30 + Math.sin(a) * dist;
      const base = randRange(rng, 160, 380);
      const size = randRange(rng, 90, 190);
      const puffs = 10 + Math.floor(rng() * 9);
      for (let i = 0; i < puffs; i++) {
        const r = size * randRange(rng, 0.35, 0.75) * (i === 0 ? 1.25 : 1);
        const g = new THREE.IcosahedronGeometry(1, 2);
        const pos = g.attributes.position;
        const ph = rng() * 10;
        for (let k = 0; k < pos.count; k++) {
          const x = pos.getX(k);
          const y = pos.getY(k);
          const z = pos.getZ(k);
          const n = 1 + Math.sin(x * 3.1 + ph) * Math.cos(z * 2.7 - ph) * 0.12 + Math.sin(y * 5 + ph) * 0.05;
          // flat-ish bottoms like real cumulus
          const yy = Math.max(y * n, -0.35);
          pos.setXYZ(k, x * n * r, yy * r * 0.8, z * n * r);
        }
        const ox = randRange(rng, -1.6, 1.6) * size;
        const oz = randRange(rng, -0.7, 0.7) * size;
        const oy = (i === 0 ? 0.25 : randRange(rng, 0, 0.6)) * size;
        g.translate(cx + ox * Math.cos(a + Math.PI / 2), base + oy, cz + ox * Math.sin(a + Math.PI / 2) + oz);
        g.deleteAttribute('uv');
        parts.push(g);
      }
    }
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    this.geometries.push(merged);
    const mat = new THREE.ShaderMaterial({
      name: 'CumulusClouds',
      uniforms: {
        uSun: { value: this.ctx.lighting.sunDir },
        uHorizon: { value: new THREE.Color(0xc4ecf8) },
        uFrom: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun; uniform vec3 uHorizon;
        varying vec3 vN; varying vec3 vW;
        void main() {
          vec3 n = normalize(vN);
          float sun = max(dot(n, normalize(uSun)), 0.0);
          float up = n.y * 0.5 + 0.5;
          vec3 shadow = vec3(0.70, 0.80, 0.92);
          vec3 lit = vec3(1.04, 1.03, 1.0);
          vec3 col = mix(shadow, lit, clamp(up * 0.75 + sun * 0.55, 0.0, 1.0));
          // silver lining towards the sun, haze with distance
          vec3 v = normalize(vW - cameraPosition);
          float rim = pow(1.0 - max(dot(n, -v), 0.0), 3.0);
          col += rim * 0.12;
          float dist = length(vW.xz - cameraPosition.xz);
          col = mix(col, uHorizon, smoothstep(1500.0, 4200.0, dist) * 0.55);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      fog: false,
    });
    this.materials.push(mat);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = 'CumulusBanks';
    root.add(mesh);
  }

  /** A few white boats circling slowly between the districts. */
  private boatsOnSea(root: THREE.Object3D): void {
    const m = this.ctx.mats;
    const rng = createRng(99);
    const hull = new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.6), new THREE.Vector2(1.6, -0.5), new THREE.Vector2(2.1, 0), new THREE.Vector2(2.0, 0.4), new THREE.Vector2(0.001, 0.4)], 16).scale(1, 1, 3.2);
    const cabin = new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 2);
    this.geometries.push(hull, cabin);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const h = new THREE.Mesh(hull, m.whiteCeramic);
      const c = new THREE.Mesh(cabin, i % 2 ? m.glossyCyan : m.cobaltCeramic);
      c.position.y = 0.4;
      g.add(h, c);
      root.add(g);
      const a = rng() * Math.PI * 2;
      const r = randRange(rng, 260, 900);
      this.boats.push({ mesh: g, cx: 13 + randRange(rng, -200, 200), cz: -30 + randRange(rng, -200, 200), r, speed: randRange(rng, 0.004, 0.009) * (rng() < 0.5 ? 1 : -1), a });
    }
  }

  update(dt: number, time: number): void {
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    for (const mv of this.movers) {
      mv.t = (mv.t + dt * mv.speed) % 1;
      mv.curve.getPointAt(mv.t, p);
      mv.curve.getTangentAt(mv.t, tg);
      mv.mesh.position.set(p.x, p.y + 2.2, p.z);
      mv.mesh.rotation.y = Math.atan2(-tg.z, tg.x);
    }
    for (const bt of this.boats) {
      bt.a += dt * bt.speed;
      const x = bt.cx + Math.cos(bt.a) * bt.r;
      const z = bt.cz + Math.sin(bt.a) * bt.r;
      // keep clear of the plateau and of the district platforms
      const keep = Math.hypot(x - 13, z + 30) < 220 || DISTRICTS.some((d) => Math.hypot(x - d.x, z - d.z) < d.r + 10);
      bt.mesh.visible = !keep;
      bt.mesh.position.set(x, SEA + 0.3 + Math.sin(time * 1.1 + bt.a * 7) * 0.15, z);
      bt.mesh.rotation.y = -bt.a + (bt.speed > 0 ? 0 : Math.PI);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
