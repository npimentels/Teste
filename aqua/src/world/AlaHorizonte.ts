import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { LAYOUT, registerPaving } from './WorldLayout';
import { bench, lilyPads, planterBowl } from './Furniture';
import { LampGroup, floorLamp } from './Lamps';
import { Lounge, hangingSign } from './Lounge';
import { Hotel } from './Hotel';
import { buildSpaRestroom } from './SpaRestroom';
import { Telescope } from '../systems/Telescope';
import { yawFacing } from '../systems/Seats';
import { WATER_LOOKS } from '../environment/WaterSystem';
import { FountainEmitter } from '../environment/ParticleSystem';
import { examine } from './Doors';
import type { Updatable } from '../core/types';
import { createRng, randRange } from '../core/math';
import { HORIZON_LANDMARKS } from './Horizon';
import { DigitalClock } from './MetroSignage';

const HZ = LAYOUT.horizonte;
const I = HZ.island;

/**
 * Ala Horizonte — the island south of the esplanade: footbridge, north plaza, Salão Maré
 * (with the spa restrooms), the skywalk, Hotel AQUA, the Jardim das Águas (west), the fountain
 * plaza and the Mirante Sul (south). Interiors live in their own groups, drawn only within a
 * reasonable distance; the exterior is always part of the skyline.
 */
export class AlaHorizonte implements Updatable {
  readonly lounge: Lounge;
  readonly hotel: Hotel;
  private readonly loungeInside = new THREE.Group();
  private readonly hotelInside = new THREE.Group();
  private readonly loungeCenter = new THREE.Vector3(-4, 3, 63);
  private readonly hotelCenter = new THREE.Vector3(1, 4, 92);
  private readonly clocks: DigitalClock[] = [];
  /** Same clock as the metro boards: starts 09:41, 10 game minutes per real minute. */
  private minutes = 9 * 60 + 41;
  private clockTimer = 0;

  constructor(private readonly ctx: WorldContext) {
    const b = ctx.builder;
    const shellRoot = b.root;
    this.loungeInside.name = 'LoungeInterior';
    this.hotelInside.name = 'HotelInterior';
    shellRoot.add(this.loungeInside, this.hotelInside);
    this.lounge = new Lounge(ctx, HORIZON_LANDMARKS);
    this.hotel = new Hotel(ctx, HORIZON_LANDMARKS);

    // ---- Exterior (always visible) ----------------------------------------------------------
    this.island(b);
    this.bridge(b);
    this.plaza(b);
    this.skywalk(b);
    this.waterGarden(b);
    this.southGarden(b);
    this.lounge.shell(b);
    this.hotel.shell(b);
    b.flush('horizonte');

    // ---- Interiors (distance culled) ---------------------------------------------------------
    b.root = this.loungeInside;
    this.clock(b, 4.6, 3.05, HZ.lounge.z0 + 0.19, 0, 'lounge');
    this.lounge.interior(b);
    buildSpaRestroom(ctx, b);
    b.flush('lounge');
    b.root = this.hotelInside;
    this.clock(b, HZ.hotel.x1 - 0.2, 3.7, 92, -Math.PI / 2, 'hotel');
    this.hotel.interior(b);
    b.flush('hotel');
    b.root = shellRoot;
  }

  private clock(b: WorldBuilder, x: number, y: number, z: number, rotY: number, key: string): void {
    const c = new DigitalClock(this.ctx.assets, `isle-${key}`);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.375), new THREE.MeshBasicMaterial({ map: c.texture, toneMapped: false }));
    p.position.set(x + Math.sin(rotY) * 0.04, y, z + Math.cos(rotY) * 0.04);
    p.rotation.y = rotY;
    b.root.add(p);
    b.box(b.mats.whiteCeramic, x, y - 0.24, z, 1.1, 0.48, 0.06, { rotY, radius: 0.04, cast: false });
    this.clocks.push(c);
  }

  update(dt: number): void {
    this.minutes += dt / 6;
    this.clockTimer -= dt;
    if (this.clockTimer <= 0) {
      this.clockTimer = 0.5;
      const hh = Math.floor(this.minutes / 60) % 24;
      const mm = Math.floor(this.minutes % 60);
      const text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      for (const c of this.clocks) c.draw(text);
    }
    const v = this.ctx.viewer;
    this.loungeInside.visible = v.distanceTo(this.loungeCenter) < 62;
    this.hotelInside.visible = v.distanceTo(this.hotelCenter) < 55;
  }

  // ---------------------------------------------------------------------------------------
  private island(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const outline = roundedRect(I.x0, I.z0, I.x1, I.z1, 8);
    ctx.collision.terrain.islands.push(outline);
    b.slab(m.lawn, outline, [], 0, 0.6, { cast: false });
    const cliff = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 33, steps: 5, bevelEnabled: false });
    cliff.rotateX(-Math.PI / 2);
    cliff.translate(0, -33.1, 0);
    // erode the cliff a little so it does not read as an extrusion
    const pos = cliff.attributes.position;
    const v = new THREE.Vector3();
    const cx = (I.x0 + I.x1) / 2;
    const cz = (I.z0 + I.z1) / 2;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y > -1.2) continue;
      const dx = v.x - cx;
      const dz = v.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      const n = Math.sin(v.x * 0.33 + v.y * 0.6) * Math.cos(v.z * 0.29 - v.y * 0.5);
      const k = Math.min(1, (-v.y - 1.2) / 6) * (1.2 + n * 1.4);
      pos.setXYZ(i, v.x + (dx / len) * k, v.y, v.z + (dz / len) * k);
    }
    cliff.computeVertexNormals();
    b.place(cliff, m.cliff, 0, 0, 0, { cast: false });
    cliff.dispose();
    // perimeter balustrade, open where the footbridge lands
    const inset = roundedRect(I.x0 + 0.7, I.z0 + 0.7, I.x1 - 0.7, I.z1 - 0.7, 7.3);
    const runs: Array<Array<[number, number]>> = [[]];
    for (let i = 0; i < inset.length; i++) {
      const a = inset[i];
      const c = inset[(i + 1) % inset.length];
      runs[runs.length - 1].push(a);
      const north = Math.abs(a[1] - c[1]) < 0.01 && Math.abs(a[1] - (I.z0 + 0.7)) < 0.05;
      if (!north) continue;
      const lo = Math.min(a[0], c[0]);
      const hi = Math.max(a[0], c[0]);
      const c0 = Math.max(lo, HZ.bridge.x0);
      const c1 = Math.min(hi, HZ.bridge.x1);
      if (c1 <= c0) continue;
      const desc = c[0] < a[0];
      runs[runs.length - 1].push([desc ? c1 : c0, a[1]]);
      runs.push([[desc ? c0 : c1, a[1]]]);
    }
    if (runs.length > 1) runs[0] = [...runs.pop()!, ...runs[0]];
    else runs[0].push(inset[0]);
    for (const run of runs) b.glassRailing(run, 0, 1.1);
    // lawn detail (kept off paths, buildings, ponds)
    const L = HZ.lounge;
    const H = HZ.hotel;
    const blocked = (x: number, z: number) =>
      (x > L.x0 - 1.5 && x < L.x1 + 1.5 && z > L.z0 - 6.5 && z < L.z1 + 4) ||
      (x > H.x0 - 1.5 && x < H.x1 + 1.5 && z > H.z0 - 8.5 && z < H.z1 + 1.2) ||
      (x > -56 && x < -28 && z > 56 && z < 66) ||
      Math.hypot(x - 2, z - 108) < 6.2 ||
      (Math.abs(x - 3.5) < 2.2 && z > 100 && z < 118) ||
      (x > -28 && x < -24.6 && z > 48 && z < 112);
    const accept = (x: number, z: number) => !blocked(x, z) && insidePoly(outline, x, z) && insidePoly(roundedRect(I.x0 + 1.4, I.z0 + 1.4, I.x1 - 1.4, I.z1 - 1.4, 6.6), x, z);
    ctx.veg.grass(I.x0, I.z0, I.x1, I.z1, 1300, 0, accept);
    ctx.veg.flowers(I.x0, I.z0, I.x1, I.z1, 280, 0, accept);
    const rng = createRng(515);
    let placed = 0;
    for (let i = 0; i < 80 && placed < 26; i++) {
      const x = randRange(rng, I.x0 + 3, I.x1 - 3);
      const z = randRange(rng, I.z0 + 3, I.z1 - 3);
      if (!accept(x, z) || (x > -26 && x < 20 && z < 104)) continue;
      ctx.veg.palm(x, 0, z, randRange(rng, 0.75, 1.1));
      if (rng() < 0.6) ctx.veg.bush(x + 1.2, 0, z - 0.5, 0.7);
      placed++;
    }
  }

  private bridge(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const B = HZ.bridge;
    const mid = (B.z0 + B.z1) / 2;
    const len = B.z1 - B.z0;
    // deck (walkable over the void) with a cobalt edge and a glowing centre line
    b.box(m.whiteCeramic, 0, -0.55, mid, B.x1 - B.x0 + 0.8, 0.55, len, { radius: 0.15 });
    b.collision.addBox({ x: 0, z: mid, sx: B.x1 - B.x0 + 0.6, sz: len, minY: -0.6, maxY: 0, surface: 'tile' });
    b.box(m.paving, 0, -0.04, mid, B.x1 - B.x0, 0.06, len, { cast: false });
    registerPaving(B.x0, B.z0, B.x1, B.z1);
    for (const e of [-1, 1]) {
      b.box(m.cobaltCeramic, e * (B.x1 + 0.38), -0.6, mid, 0.08, 0.5, len, { cast: false });
      b.box(m.emissiveCyan, e * (B.x1 + 0.42), -0.32, mid, 0.02, 0.04, len, { cast: false, receive: false });
      b.glassRailing([[e * (B.x1 - 0.1), B.z0 + 0.1], [e * (B.x1 - 0.1), B.z1]], 0, 1.1);
    }
    b.box(m.emissiveCyan, 0, -0.005, mid, 0.06, 0.012, len - 1, { cast: false, receive: false });
    // piers down to the sea (the plateau and island cliffs drop to the water at y −32)
    const pier = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(1.4, 0), new THREE.Vector2(0.9, 1.2), new THREE.Vector2(0.7, 26), new THREE.Vector2(1.1, 30), new THREE.Vector2(1.9, 31.4), new THREE.Vector2(0.001, 31.4)], 24);
    for (const z of [32.5, 38.5]) b.place(pier, m.whiteCeramic, 0, -32, z, { cast: false });
    pier.dispose();
    // arches with teardrop lamps, planters and two bench bays
    const lamps = new LampGroup('bridge', true);
    ctx.addUpdatable(lamps);
    const glow = lamps.material(0xfff3dc, 1.3);
    for (const z of [30.5, 36, 41.5]) {
      b.torus(m.whiteCeramic, 0, 0, z, B.x1 + 0.2, 0.08, { arc: Math.PI, cast: false });
      b.sphere(glow, 0, B.x1 - 0.35, z, 0.16, { cast: false });
      b.cylinder(m.chrome, 0, B.x1 - 0.2, z, 0.006, 0.006, 0.4, { segments: 4, cast: false });
    }
    for (const [z, e] of [
      [33.2, -1],
      [39.0, 1],
    ] as Array<[number, number]>) {
      for (const sp of bench(b, e * (B.x1 - 0.55), z, -e, 0, 2.0, e < 0 ? m.fabricCyan : m.fabricLime, true)) ctx.addSeat({ id: `bridge-bench-${z}-${sp.z.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(-e, 0) });
      const tz = z + (e < 0 ? 2.0 : -2.0);
      b.box(m.whiteCeramic, e * (B.x1 - 0.45), 0, tz, 0.7, 0.45, 1.3, { radius: 0.15, collide: 'stone' });
      b.box(m.soil, e * (B.x1 - 0.45), 0.42, tz, 0.55, 0.04, 1.15, { cast: false });
      ctx.veg.fern(e * (B.x1 - 0.45), 0.44, tz, 0.6);
    }
  }

  private plaza(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const L = HZ.lounge;
    b.box(m.paving, (L.x0 + L.x1) / 2 - 2, -0.04, (I.z0 + L.z0) / 2, L.x1 - L.x0 + 8, 0.06, L.z0 - I.z0 + 0.2, { cast: false });
    registerPaving(L.x0 - 6, I.z0, L.x1 + 2, L.z0);
    for (const x of [-14, -7, 7.5, 13]) {
      const top = planterBowl(b, x, 47.2, 0.65, m.whiteCeramic, m.cobaltCeramic);
      ctx.veg.palm(x, top, 47.2, 0.5);
    }
    for (const x of [-10.5, 10.2]) for (const sp of bench(b, x, 46.4, 0, -1, 2.6, m.fabricCobalt)) ctx.addSeat({ id: `isle-plaza-${x}-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, -1) });
    const glow = m.frostedGlass.clone();
    glow.name = 'isleLamps';
    glow.emissive = new THREE.Color(0xfff3dc);
    glow.emissiveIntensity = 1.1;
    for (const x of [-18, -3.4, 3.4, 16.5]) floorLamp(b, x, 48.6, glow, 2.6);
    examine(ctx, 'isle-totem', new THREE.Vector3(-5.2, 1.3, 47.6), new THREE.Vector3(0.5, 0.9, 0.3), 'Ler totem', '<b>Ala Horizonte</b><br>Salão Maré (descanso, aquários, toaletes) · Hotel AQUA (recepção, suítes, mirante) · Jardim das Águas (oeste) · Mirante Sul (sul). Volte pela passarela ao Átrio Azul.', 0, 2.4);
    b.box(m.whiteCeramic, -5.2, 0, 47.6, 0.9, 2.2, 0.26, { radius: 0.12, collide: 'tile' });
    b.box(m.cobaltCeramic, -5.2, 2.05, 47.6, 0.96, 0.24, 0.3, { radius: 0.08 });
    hangingSignPost(b, ctx, 0, 45.6);
  }

  private skywalk(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const S = HZ.skywalk;
    const mid = (S.z0 + S.z1) / 2;
    const len = S.z1 - S.z0;
    const w = S.x1 - S.x0;
    const cx = (S.x0 + S.x1) / 2;
    b.box(m.terrazzo, cx, -0.06, mid, w, 0.1, len, { cast: false });
    b.box(m.whiteCeramic, cx, 3.0, mid, w + 0.6, 0.3, len + 0.2, { radius: 0.1 });
    b.box(m.glass, cx, 3.0, mid, w - 1.2, 0.32, len - 1, { cast: false, receive: false });
    for (const x of [S.x0, S.x1]) {
      b.box(m.glass, x, 0.35, mid, 0.04, 2.65, len, { cast: false, receive: false });
      b.box(m.cobaltCeramic, x, 0, mid, 0.3, 0.35, len, { radius: 0.06 });
      b.collision.addBox({ x, z: mid, sx: 0.3, sz: len, minY: 0, maxY: 3.0, surface: 'glass' });
      for (let z = S.z0; z <= S.z1 + 0.01; z += len / 3) b.box(m.whiteCeramic, x, 0.35, z, 0.16, 2.65, 0.14, { radius: 0.04, cast: false });
      b.box(m.emissiveCyan, x + (x < cx ? 0.2 : -0.2), 0.02, mid, 0.04, 0.02, len, { cast: false, receive: false });
    }
    for (const z of [S.z0 + 2.2, S.z1 - 2.2]) {
      const top = planterBowl(b, S.x0 + 0.55, z, 0.32, m.whiteCeramic, m.limeGlossy);
      ctx.veg.fern(S.x0 + 0.55, top, z, 0.5);
    }
  }

  private waterGarden(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    // path along the lounge's west side, to its garden door and on to the hotel garden
    b.box(m.paving, -26.3, -0.04, 80, 3.4, 0.06, 64, { cast: false });
    registerPaving(-28, 48, -24.6, 112);
    // long reflecting canal with planted islands and a footbridge
    const c = { x0: -54, x1: -30, z0: 58, z1: 64 };
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    for (const [x, z, w, d] of [
      [cx, c.z0 - 0.15, c.x1 - c.x0 + 0.6, 0.3],
      [cx, c.z1 + 0.15, c.x1 - c.x0 + 0.6, 0.3],
      [c.x0 - 0.15, cz, 0.3, c.z1 - c.z0],
      [c.x1 + 0.15, cz, 0.3, c.z1 - c.z0],
    ] as Array<[number, number, number, number]>) b.box(m.whiteCeramic, x, 0, z, w, 0.4, d, { collide: 'stone', radius: 0.08 });
    b.box(m.poolTileAt(0.28, { value: 0.55 }, 'isleCanal', 'cobalt'), cx, -0.05, cz, c.x1 - c.x0, 0.08, c.z1 - c.z0, { cast: false });
    ctx.water.add({ name: 'isleCanal', shape: { kind: 'rect', x: cx, z: cz, hx: (c.x1 - c.x0) / 2, hz: (c.z1 - c.z0) / 2 }, surfaceY: 0.28, look: WATER_LOOKS.pool, segments: 48, flow: new THREE.Vector2(0.05, 0) });
    lilyPads(b, cx - 6, cz, 0.6, 2.6, 0.29, 12, 33);
    lilyPads(b, cx + 7, cz + 0.6, 0.5, 2.0, 0.29, 9, 34);
    for (const x of [cx - 1.5, cx + 3]) {
      b.cylinder(m.whiteCeramic, x, 0, cz, 0.9, 1.0, 0.45, { collide: 'stone', segments: 28 });
      b.cylinder(m.soil, x, 0.43, cz, 0.82, 0.82, 0.04, { cast: false, segments: 22 });
      ctx.veg.palm(x, 0.45, cz, 0.55);
    }
    // arched footbridge over the canal
    b.box(m.whiteCeramic, cx - 8, 0, cz, 2.2, 0.52, c.z1 - c.z0 + 1.6, { radius: 0.1, collide: 'tile' });
    b.glassRailing([[cx - 9.05, c.z0 - 0.7], [cx - 9.05, c.z1 + 0.7]], 0.52, 1.0);
    b.glassRailing([[cx - 6.95, c.z0 - 0.7], [cx - 6.95, c.z1 + 0.7]], 0.52, 1.0);
    // jets along the canal
    const jets: Array<{ origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number }> = [];
    for (let i = 0; i < 6; i++) {
      const x = c.x0 + 2 + i * 4;
      if (Math.abs(x - (cx - 8)) < 2) continue;
      jets.push({ origin: new THREE.Vector3(x, 0.3, c.z0 + 0.3), velocity: new THREE.Vector3(0.2, 2.2, 1.0), spread: 0.25, count: 22 });
      jets.push({ origin: new THREE.Vector3(x + 2, 0.3, c.z1 - 0.3), velocity: new THREE.Vector3(-0.2, 2.2, -1.0), spread: 0.25, count: 22 });
    }
    const f = new FountainEmitter(jets, { floorY: 0.26, life: 1.3, size: 0.07, seed: 71 });
    b.root.add(f.points);
    ctx.addUpdatable(f);
    ctx.addQuality(f);
    ctx.audio.addWaterSource('fountain', { x: cx, y: 0.8, z: cz }, 0.6, true);
    for (const [x, z, fz] of [
      [cx + 4, c.z0 - 1.6, -1],
      [cx - 2, c.z1 + 1.6, 1],
    ] as Array<[number, number, number]>) for (const sp of bench(b, x, z, 0, -fz, 3.0, m.fabricCyan)) ctx.addSeat({ id: `isle-canal-${x}-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, -fz) });
    // a pavilion with a telescope on the west edge looking at the Distrito Oeste
    const px = I.x0 + 4.5;
    const pz = 86;
    b.cylinder(m.whiteCeramic, px, 0, pz, 3.2, 3.2, 0.12, { segments: 40 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cylinder(m.chrome, px + Math.cos(a) * 2.9, 0.12, pz + Math.sin(a) * 2.9, 0.05, 0.05, 2.7, { collide: 'metal', segments: 10 });
    }
    const dome = new THREE.SphereGeometry(3.3, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2.4);
    dome.scale(1, 0.4, 1);
    b.place(dome, m.whiteCeramic, px, 2.8, pz);
    dome.dispose();
    b.torus(m.glossyCyan, px, 2.82, pz, 3.25, 0.05, { rotX: Math.PI / 2, cast: false });
    const scope = new Telescope(ctx, b, 'isle-telescope-w', px - 1.6, 0.12, pz, Math.PI / 2, HORIZON_LANDMARKS);
    ctx.addInteractable(scope);
    ctx.addModal(scope);
    for (const sp of bench(b, px + 1.2, pz, -1, 0, 2.4, m.fabricLime, true, 0.12)) ctx.addSeat({ id: `isle-pavilion-${sp.z.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(-1, 0) });
  }

  private southGarden(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    // path from the hotel's garden door to the fountain and the Mirante Sul
    b.box(m.paving, 3.5, -0.04, 109, 4.0, 0.06, 18, { cast: false });
    registerPaving(1.5, 100, 5.5, 118);
    // round fountain plaza
    const fc = { x: 2, z: 108 };
    b.ring(m.paving, fc.x, -0.02, fc.z, 0, 6, 0.06);
    b.cylinder(m.whiteCeramic, fc.x, 0, fc.z, 3.3, 3.4, 0.45, { segments: 48 });
    b.cylinder(m.poolTileAt(0.34, { value: 0.5 }, 'isleFountain', 'cobalt'), fc.x, 0.36, fc.z, 3.05, 3.05, 0.02, { segments: 48, cast: false });
    b.collision.addCylinder({ x: fc.x, z: fc.z, r: 3.35, minY: 0, maxY: 0.45, surface: 'stone' });
    ctx.water.add({ name: 'isleFountain', shape: { kind: 'circle', x: fc.x, z: fc.z, r: 3.0 }, surfaceY: 0.4, look: WATER_LOOKS.pool, segments: 40 });
    b.cylinder(m.whiteCeramic, fc.x, 0.4, fc.z, 0.5, 0.7, 0.7, { segments: 28 });
    b.cylinder(m.limeGlossy, fc.x, 1.1, fc.z, 1.1, 0.55, 0.14, { segments: 36 });
    const jets: Array<{ origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number }> = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      jets.push({ origin: new THREE.Vector3(fc.x + Math.cos(a) * 1.0, 1.25, fc.z + Math.sin(a) * 1.0), velocity: new THREE.Vector3(Math.cos(a) * 1.1, 1.9, Math.sin(a) * 1.1), spread: 0.5, count: 18 });
    }
    jets.push({ origin: new THREE.Vector3(fc.x, 1.25, fc.z), velocity: new THREE.Vector3(0, 3.6, 0), spread: 0.35, count: 40 });
    const f = new FountainEmitter(jets, { floorY: 0.38, life: 1.6, size: 0.08, seed: 91 });
    b.root.add(f.points);
    ctx.addUpdatable(f);
    ctx.addQuality(f);
    ctx.audio.addWaterSource('fountain', { x: fc.x, y: 1.4, z: fc.z }, 0.7, true);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const x = fc.x + Math.cos(a) * 5.0;
      const z = fc.z + Math.sin(a) * 5.0;
      for (const sp of bench(b, x, z, -Math.cos(a), -Math.sin(a), 2.2, k % 2 ? m.fabricCyan : m.fabricLime)) ctx.addSeat({ id: `isle-fountain-${k}-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(-Math.cos(a), -Math.sin(a)) });
    }
    // Mirante Sul: overlook deck at the island's tip with a telescope and benches
    const mz = I.z1 - 3.2;
    b.box(m.whiteCeramic, 3.5, 0, mz, 8, 0.12, 4.0, { radius: 0.08 });
    b.box(m.emissiveCyan, 3.5, 0.11, mz + 1.95, 7.8, 0.02, 0.03, { cast: false, receive: false });
    const scope = new Telescope(ctx, b, 'isle-telescope-s', 3.5, 0.12, I.z1 - 1.6, Math.PI, HORIZON_LANDMARKS);
    ctx.addInteractable(scope);
    ctx.addModal(scope);
    for (const x of [0.6, 6.4]) for (const sp of bench(b, x, mz - 0.6, 0, 1, 2.2, m.fabricCobalt, true, 0.12)) ctx.addSeat({ id: `isle-mirante-${x}-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });
    examine(ctx, 'isle-mirante', new THREE.Vector3(3.5, 1.0, mz - 1.9), new THREE.Vector3(0.6, 0.5, 0.15), 'Ler placa do Mirante Sul', '<b>Mirante Sul</b><br>Daqui se veem o Distrito Sul (passarelas brancas e torres-jardim), a Ilha das Estufas a sudeste e, nos dias claros, as torres distantes do anel metropolitano. Nada disso é acessível a pé — é o horizonte de AQUA.');
    b.box(m.cobaltCeramic, 3.5, 0, mz - 1.95, 1.0, 1.1, 0.08, { radius: 0.04 });
    for (const [x, z] of [
      [-6, 104],
      [12, 104],
      [-10, 112],
      [14, 113],
    ] as Array<[number, number]>) {
      const top = planterBowl(b, x, z, 0.8, m.whiteCeramic, m.limeGlossy);
      ctx.veg.banana(x, top, z, 0.6);
    }
  }
}

function hangingSignPost(b: WorldBuilder, ctx: WorldContext, x: number, z: number): void {
  // gateway arch over the bridge landing with the district's name
  const m = b.mats;
  for (const e of [-1, 1]) b.box(m.cobaltCeramic, x + e * 2.9, 0, z, 0.36, 3.5, 0.36, { radius: 0.15, collide: 'tile' });
  b.box(m.whiteCeramic, x, 3.3, z, 6.2, 0.36, 0.5, { radius: 0.15 });
  hangingSign(b, x, z, 'Ala Horizonte', '↓', '#1747b5', 0, ctx, 2.55, 3.3);
}

function roundedRect(x0: number, z0: number, x1: number, z1: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
    [x1 - r, z0 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cz, a0] of corners)
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  return pts;
}

function insidePoly(poly: Array<[number, number]>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
