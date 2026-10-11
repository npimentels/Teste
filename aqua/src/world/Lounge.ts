import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { LAYOUT } from './WorldLayout';
import { waveFloorTexture } from './MetroSignage';
import { crescentSofa, eggChair, lilyPads, planterBowl, recycleBins, teardropLamp, waterDispenser, bench, bubbleLamp } from './Furniture';
import { bookshelf, pouf, roundTable, sofa, tableDecor, tubChair, rugRect, artPanel, fabric } from './Interiors';
import { LampGroup, arcLamp, downlight, floorLamp, ringPendant, tableLamp, lightLine } from './Lamps';
import { Aquarium } from './Aquarium';
import { SlidingDoor, examine } from './Doors';
import { Telescope, type Landmark } from '../systems/Telescope';
import { VendingMachine } from '../systems/VendingMachine';
import { UseSpot } from '../systems/Interactables';
import { yawFacing } from '../systems/Seats';
import { WATER_LOOKS } from '../environment/WaterSystem';
import { FountainEmitter, WaterStream } from '../environment/ParticleSystem';
import { roundRect } from '../core/AssetManager';

const L = LAYOUT.horizonte.lounge;
const SKY = LAYOUT.horizonte.skywalk;
const FONT = '"Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';

/**
 * Salão Maré — the main rest hall. Zones: sofa lounge (north-west), indoor pool garden with a
 * fountain (west), window seats along the panoramic glass with a telescope, the landmark
 * column aquarium ringed by curved sofas (centre), the panoramic aquarium wall with observation
 * sofas (south), wall-niche aquarium with a bench, services (east pier), a reading corner and
 * the hidden seahorse nook (east). The spa restrooms sit in the north-east block.
 *
 * `shell` builds what is seen from outside (walls, glass, roof); `interior` everything inside.
 */
export class Lounge {
  readonly lampGroups: LampGroup[] = [];

  constructor(
    private readonly ctx: WorldContext,
    private readonly landmarks: Landmark[],
  ) {}

  shell(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const H = L.h;
    const cx = (L.x0 + L.x1) / 2;
    const cz = (L.z0 + L.z1) / 2;
    // floor: the station's wave terrazzo (white, cobalt and lime waves)
    const tex = waveFloorTexture(ctx.assets);
    tex.repeat.set(1 / 16, 1 / 16);
    const floor = new THREE.MeshPhysicalMaterial({ name: 'loungeFloor', map: tex, roughness: 0.14, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    floor.userData.worldUV = true;
    const pool = { x0: -20, x1: -12, z0: 64, z1: 71 };
    const rect = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    b.slab(floor, rect(L.x0, L.z0, L.x1, L.z1), [rect(pool.x0, pool.z0, pool.x1, pool.z1)], 0.03, 0.1, { cast: false });

    // ---- North wall: glass (west), niche pier, entrance, service pier; spa block (east) ------
    const glassRun = (x0: number, z0: number, x1: number, z1: number, gaps: Array<[number, number]> = []) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      const rot = Math.atan2(-uz, ux);
      let t = 0;
      const pieces: Array<[number, number]> = [];
      for (const [g0, g1] of gaps) {
        if (g0 > t) pieces.push([t, g0]);
        t = g1;
      }
      if (t < len) pieces.push([t, len]);
      for (const [a, c] of pieces) {
        const mx = x0 + ux * ((a + c) / 2);
        const mz = z0 + uz * ((a + c) / 2);
        b.box(m.glass, mx, 0.42, mz, c - a, H - 0.42, 0.04, { rotY: rot, cast: false, receive: false });
        b.box(m.cobaltCeramic, mx, 0, mz, c - a, 0.42, 0.34, { rotY: rot, radius: 0.08 });
        b.collision.addSegment(x0 + ux * a, z0 + uz * a, x0 + ux * c, z0 + uz * c, 0.3, 0, H, 'glass');
        const n = Math.max(1, Math.round((c - a) / 2.2));
        for (let i = 0; i <= n; i++) {
          const d = a + ((c - a) * i) / n;
          b.box(m.whiteCeramic, x0 + ux * d, 0.42, z0 + uz * d, 0.12, H - 0.42, 0.2, { rotY: rot, radius: 0.04, cast: false });
        }
        b.box(m.whiteCeramic, mx, 2.9, mz, c - a, 0.08, 0.14, { rotY: rot, cast: false });
      }
    };
    glassRun(L.x0, L.z0, -8, L.z0);
    // niche pier (thick, holds a wall aquarium) and service pier
    // (built around the niche opening x −6.05…−3.45, y 1.0…2.2 where the wall aquarium sits)
    const pz = L.z0 - 0.17;
    b.box(m.whiteCeramic, -7.025, 0, pz, 1.95, H, 0.66, { radius: 0.06 });
    b.box(m.whiteCeramic, -2.475, 0, pz, 1.95, H, 0.66, { radius: 0.06 });
    b.box(m.whiteCeramic, -4.75, 0, pz, 2.6, 1.0, 0.66);
    b.box(m.whiteCeramic, -4.75, 2.2, pz, 2.6, H - 2.2, 0.66);
    b.box(m.whiteCeramic, -4.75, 1.0, L.z0 - 0.47, 2.6, 1.2, 0.06, { cast: false });
    b.collision.addBox({ x: -4.75, z: pz, sx: 6.5, sz: 0.66, minY: 0, maxY: H, surface: 'tile' });
    b.box(m.whiteCeramic, 4.75, 0, L.z0, 6.5, H, 0.3, { collide: 'tile' });
    b.box(m.whiteCeramic, (8 + L.x1) / 2, 0, L.z0, L.x1 - 8 + 0.3, H, 0.3, { collide: 'tile' });
    // entrance: glass transom over the automatic door, cobalt portal frame
    b.box(m.glass, 0, 2.7, L.z0, 3.0, H - 2.7, 0.04, { cast: false, receive: false });
    for (const x of [-1.6, 1.6]) b.box(m.cobaltCeramic, x, 0, L.z0, 0.34, 2.9, 0.5, { radius: 0.12, collide: 'tile' });
    b.box(m.cobaltCeramic, 0, 2.7, L.z0, 3.6, 0.34, 0.5, { radius: 0.1 });
    b.box(m.cyanAcrylic, 0, 3.06, L.z0 - 0.28, 3.4, 0.08, 0.06, { cast: false });
    new SlidingDoor(ctx, b, { id: 'lounge-door-n', x: 0, z: L.z0, width: 2.9, height: 2.7, axis: 'x', style: 'glass', sensor: 2.8 });
    // ---- West wall: panoramic glass with a garden door near the south end ----------------------
    glassRun(L.x0, L.z1, L.x0, L.z0, [[0.9, 2.9]]);
    b.box(m.glass, L.x0, 2.7, L.z1 - 1.9, 0.04, H - 2.7, 2.0, { cast: false, receive: false });
    b.box(m.cobaltCeramic, L.x0, 2.7, L.z1 - 1.9, 0.5, 0.3, 2.4, { radius: 0.1 });
    new SlidingDoor(ctx, b, { id: 'lounge-door-w', x: L.x0, z: L.z1 - 1.9, width: 1.95, height: 2.7, axis: 'z', style: 'glass', sensor: 2.4 });
    // ---- South wall: panoramic aquarium window (the tank sits outside), skywalk door -------------
    const tank = { x0: -17, x1: 7 };
    b.box(m.whiteCeramic, (L.x0 + tank.x0) / 2, 0, L.z1, tank.x0 - L.x0, H, 0.3, { collide: 'tile' });
    b.box(m.whiteCeramic, (tank.x0 + tank.x1) / 2, 4.35, L.z1, tank.x1 - tank.x0, H - 4.35, 0.3);
    b.box(m.cobaltCeramic, (tank.x0 + tank.x1) / 2, 0, L.z1 - 0.05, tank.x1 - tank.x0, 0.58, 0.4, { radius: 0.08 });
    b.box(m.whiteCeramic, (tank.x1 + SKY.x0) / 2, 0, L.z1, SKY.x0 - tank.x1, H, 0.3, { collide: 'tile' });
    b.box(m.whiteCeramic, (SKY.x1 + L.x1) / 2, 0, L.z1, L.x1 - SKY.x1 + 0.15, H, 0.3, { collide: 'tile' });
    b.box(m.whiteCeramic, (SKY.x0 + SKY.x1) / 2, 2.8, L.z1, SKY.x1 - SKY.x0, H - 2.8, 0.3);
    new SlidingDoor(ctx, b, { id: 'lounge-door-s', x: (SKY.x0 + SKY.x1) / 2, z: L.z1, width: SKY.x1 - SKY.x0 - 0.2, height: 2.8, axis: 'x', style: 'glass', sensor: 2.6 });
    // tank housing outside: back wall, ends and roof (the tank itself sits inside, z 76.15…78.75)
    const tx = (tank.x0 + tank.x1) / 2;
    b.box(m.whiteCeramic, tx, 0, L.z1 + 2.95, tank.x1 - tank.x0 + 0.6, 4.6, 0.4, { collide: 'tile', radius: 0.12 });
    for (const x of [tank.x0 - 0.15, tank.x1 + 0.15]) b.box(m.whiteCeramic, x, 0, L.z1 + 1.5, 0.3, 4.6, 3.1, { collide: 'tile' });
    b.box(m.whiteCeramic, tx, 4.2, L.z1 + 1.5, tank.x1 - tank.x0 + 0.6, 0.4, 3.2, { radius: 0.1 });
    b.box(m.cobaltCeramic, tx, 0, L.z1 + 1.45, tank.x1 - tank.x0, 0.6, 2.6, { collide: 'tile' });
    b.box(m.glossyCyan, tx, 4.3, L.z1 + 3.12, tank.x1 - tank.x0 + 0.6, 0.08, 0.04, { cast: false });
    // ---- East wall: glass (the spa block covers z 50…60) -------------------------------------------
    glassRun(L.x1, 60.2, L.x1, L.z1);
    // ---- Roof with skylights and vines; fascia --------------------------------------------------------
    const skylights: Array<[number, number, number]> = [
      [-15, 56, 1.6],
      [-2, 63.5, 2.2],
      [-16, 68, 1.4],
      [10, 68, 1.5],
    ];
    const circle = (x: number, z: number, r: number): Array<[number, number]> =>
      Array.from({ length: 32 }, (_, i) => [x + Math.cos((i / 32) * Math.PI * 2) * r, z + Math.sin((i / 32) * Math.PI * 2) * r] as [number, number]);
    b.slab(m.whiteCeramic, rect(L.x0 - 0.6, L.z0 - 0.6, L.x1 + 0.6, L.z1 + 0.6), skylights.map(([x, z, r]) => circle(x, z, r)), H + 0.45, 0.45);
    for (const [x, z, r] of skylights) {
      b.cylinder(m.glass, x, H + 0.42, z, r, r, 0.03, { segments: 40, cast: false, receive: false });
      b.torus(m.cobaltCeramic, x, H, z, r + 0.05, 0.12, { rotX: Math.PI / 2 });
      b.torus(m.chrome, x, H + 0.45, z, r + 0.05, 0.05, { rotX: Math.PI / 2, cast: false });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + x;
        ctx.veg.vine(x + Math.cos(a) * (r + 0.2), H, z + Math.sin(a) * (r + 0.2), 1.0 + (i % 3) * 0.4);
      }
    }
    b.box(m.cobaltCeramic, cx, H + 0.45, L.z0 - 0.62, L.x1 - L.x0 + 1.2, 0.3, 0.06, { cast: false });
    b.box(m.glossyCyan, cx, H + 0.6, L.z1 + 0.62, L.x1 - L.x0 + 1.2, 0.08, 0.04, { cast: false });
    b.box(m.limeGlossy, L.x0 - 0.62, H + 0.6, cz, 0.04, 0.08, L.z1 - L.z0 + 1.2, { cast: false });
    // name over the entrance (outside)
    const name = loungeSign(ctx);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshBasicMaterial({ map: name, transparent: true, toneMapped: false }));
    plate.position.set(0, 4.3, L.z0 - 0.42);
    plate.rotation.y = Math.PI;
    b.root.add(plate);
    void cx;
  }

  interior(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const H = L.h;

    // ---- Lamp groups --------------------------------------------------------------------------
    const sofaLamps = new LampGroup('lounge-sofas', true);
    const windowLamps = new LampGroup('lounge-window', true);
    const aquaLamps = new LampGroup('lounge-aquarium', true);
    const ceiling = new LampGroup('lounge-ceiling', true);
    this.lampGroups.push(sofaLamps, windowLamps, aquaLamps, ceiling);
    for (const g of this.lampGroups) ctx.addUpdatable(g);
    const warm = ceiling.material(0xfff2dc, 1.4);
    for (let x = -21; x < 15; x += 4.5) for (const z of [53, 60, 72.5]) if (!(x > 7 && z < 61)) downlight(b, x, H, z, warm, 0.13);
    // indirect cyan cove along the walls
    b.box(m.emissiveCyan, (L.x0 + 8) / 2, H - 0.25, L.z0 + 0.2, 8 - L.x0, 0.03, 0.03, { cast: false, receive: false });
    b.box(m.emissiveCyan, (L.x0 + L.x1) / 2, H - 0.25, L.z1 - 0.2, L.x1 - L.x0, 0.03, 0.03, { cast: false, receive: false });

    // ---- 1. Sofa lounge (north-west) ---------------------------------------------------------------
    const sc = { x: -15, z: 56.2 };
    const r = 2.7;
    rugRect(b, sc.x, sc.z, 6.6, 5.4, 0, m.rug);
    crescentSofa(b, sc.x, sc.z, r, -Math.PI + 0.55, -0.55, m.fabricCobalt, 'in');
    crescentSofa(b, sc.x, sc.z, r, 0.55, Math.PI - 0.55, m.fabricCyan, 'in');
    for (const [a0, a1] of [
      [-Math.PI + 0.55, -0.55],
      [0.55, Math.PI - 0.55],
    ]) {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        ctx.addSeat({ id: `lounge-sofa-${a.toFixed(2)}`, x: sc.x + Math.cos(a) * (r - 0.1), y: 0.49, z: sc.z + Math.sin(a) * (r - 0.1), yaw: yawFacing(-Math.cos(a), -Math.sin(a)) });
      }
    }
    roundTable(b, sc.x, sc.z, 0.75, 0.42, m.glass);
    tableDecor(b, sc.x, 0.42, sc.z, 3);
    const sofaGlow = sofaLamps.material(0xfff1d6, 1.6);
    arcLamp(b, sc.x - 3.6, sc.z - 2.2, sc.x - 1.9, sc.z - 1.6, sofaGlow);
    arcLamp(b, sc.x + 3.6, sc.z + 2.2, sc.x + 1.9, sc.z + 1.6, sofaGlow);
    for (const [x, z] of [
      [sc.x - 3.3, sc.z + 0.2],
      [sc.x + 3.3, sc.z - 0.2],
    ] as Array<[number, number]>) {
      const top = roundTable(b, x, z, 0.3, 0.55, m.whiteCeramic);
      tableLamp(b, x, top, z, sofaGlow, m.cobaltCeramic);
      sofaLamps.pool(b.root, x, top + 0.005, z, 0.5, 0xffe8c2, 0.3);
    }
    sofaLamps.pool(b.root, sc.x - 1.9, 0.05, sc.z - 1.6, 1.4, 0xffe8c2, 0.25);
    sofaLamps.pool(b.root, sc.x + 1.9, 0.05, sc.z + 1.6, 1.4, 0xffe8c2, 0.25);
    this.lampSwitch(b, 'lounge-switch-sofas', -9.2, 52.1, Math.PI, sofaLamps, 'luminárias do lounge');
    // magazine rack / bookshelf
    bookshelf(b, -10.6, 51.0, 0, 1.6, 1.15, 41);
    examine(ctx, 'lounge-books', new THREE.Vector3(-10.6, 0.7, 51.2), new THREE.Vector3(0.8, 0.6, 0.2), 'Folhear revistas', '<b>Revistas do Salão</b><br><i>Maré Viva</i> nº 12 — "Recifes urbanos: como os aquários do complexo ajudam a pesquisa marinha"; <i>Amanhã Hoje</i> — "Cidade das Águas: a linha 2 chega em breve"; <i>Jardins Suspensos</i> — guia de plantas que gostam de vapor.', 0, 2.2);
    for (const [x, z] of [
      [-22.4, 51.3],
      [-8.8, 61.4],
    ] as Array<[number, number]>) {
      const top = planterBowl(b, x, z, 0.55, m.whiteCeramic, m.cobaltCeramic);
      ctx.veg.monstera(x, top, z, 0.8);
    }

    // ---- 2. Pool garden with a fountain (west) -------------------------------------------------------
    const pool = { x0: -20, x1: -12, z0: 64, z1: 71 };
    const px = (pool.x0 + pool.x1) / 2;
    const pz = (pool.z0 + pool.z1) / 2;
    for (const [x, z, w, d] of [
      [px, pool.z0 - 0.15, pool.x1 - pool.x0 + 0.6, 0.3],
      [px, pool.z1 + 0.15, pool.x1 - pool.x0 + 0.6, 0.3],
      [pool.x0 - 0.15, pz, 0.3, pool.z1 - pool.z0],
      [pool.x1 + 0.15, pz, 0.3, pool.z1 - pool.z0],
    ] as Array<[number, number, number, number]>) b.box(m.whiteCeramic, x, 0, z, w, 0.42, d, { collide: 'stone', radius: 0.08 });
    b.box(m.poolTileAt(0.3, { value: 0.5 }, 'loungePool', 'cobalt'), px, -0.05, pz, pool.x1 - pool.x0, 0.08, pool.z1 - pool.z0, { cast: false });
    ctx.water.add({ name: 'loungePool', shape: { kind: 'rect', x: px, z: pz, hx: (pool.x1 - pool.x0) / 2, hz: (pool.z1 - pool.z0) / 2 }, surfaceY: 0.3, look: WATER_LOOKS.pool, segments: 32 });
    for (const [x, z, s] of [
      [pool.x0 + 1.4, pool.z0 + 1.3, 0.9],
      [pool.x1 - 1.6, pool.z1 - 1.3, 0.7],
    ] as Array<[number, number, number]>) {
      b.cylinder(m.whiteCeramic, x, 0, z, 0.9 * s, 1.0 * s, 0.5, { collide: 'stone', segments: 32 });
      b.cylinder(m.soil, x, 0.48, z, 0.82 * s, 0.82 * s, 0.04, { cast: false, segments: 24 });
      ctx.veg.palm(x, 0.5, z, 0.42 * s);
      ctx.veg.fern(x + 0.3, 0.5, z - 0.2, 0.55);
    }
    lilyPads(b, px + 0.6, pz + 0.4, 0.6, 2.4, 0.31, 10, 17);
    // fountain bowl with a jet ring
    b.cylinder(m.whiteCeramic, px, 0, pz, 0.35, 0.5, 0.55, { collide: 'stone', segments: 28 });
    b.cylinder(m.glossyCyan, px, 0.55, pz, 0.62, 0.4, 0.12, { segments: 32 });
    const jets: Array<{ origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number }> = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      jets.push({ origin: new THREE.Vector3(px + Math.cos(a) * 0.45, 0.68, pz + Math.sin(a) * 0.45), velocity: new THREE.Vector3(Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55), spread: 0.6, count: 18 });
    }
    jets.push({ origin: new THREE.Vector3(px, 0.7, pz), velocity: new THREE.Vector3(0, 2.6, 0), spread: 0.4, count: 30 });
    const fountain = new FountainEmitter(jets, { floorY: 0.28, life: 1.4, size: 0.07, seed: 61 });
    b.root.add(fountain.points);
    ctx.addUpdatable(fountain);
    ctx.addQuality(fountain);
    const column = WaterStream.tube([new THREE.Vector3(px, 0.68, pz), new THREE.Vector3(px, 1.3, pz), new THREE.Vector3(px, 1.9, pz)], 0.035, { speed: -3, opacity: 0.55, travelTime: 0.3 });
    b.root.add(column.mesh);
    ctx.addUpdatable(column);
    ctx.audio.addWaterSource('fountain', { x: px, y: 1, z: pz }, 0.55, true);
    for (const sp of bench(b, px, pool.z0 - 1.6, 0, 1, 3.2, m.fabricLime)) ctx.addSeat({ id: `lounge-poolbench-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });

    // ---- 3. Window seats + telescope (west glass) -------------------------------------------------------
    const winGlow = windowLamps.material(0xfff4e2, 1.5);
    for (const [i, z] of [62.6, 66.0, 69.4].entries()) {
      eggChair(b, L.x0 + 1.35, z, -Math.PI / 2, i === 1 ? m.limeGlossy : m.whiteCeramic, m.fabricCyan);
      ctx.addSeat({ id: `lounge-window-${i}`, x: L.x0 + 1.3, y: 0.46, z, yaw: yawFacing(-1, 0) });
      if (i < 2) {
        const top = roundTable(b, L.x0 + 1.15, z + 1.7, 0.28, 0.5, m.glass);
        tableDecor(b, L.x0 + 1.15, top, z + 1.7, 20 + i);
      }
    }
    floorLamp(b, L.x0 + 0.9, 60.6, winGlow);
    floorLamp(b, L.x0 + 0.9, 72.2, winGlow);
    windowLamps.pool(b.root, L.x0 + 0.9, 0.05, 60.6, 1.2, 0xffe8c2, 0.28);
    windowLamps.pool(b.root, L.x0 + 0.9, 0.05, 72.2, 1.2, 0xffe8c2, 0.28);
    this.lampSwitch(b, 'lounge-switch-window', L.x0 + 0.3, 58.9, Math.PI / 2, windowLamps, 'luminárias da janela');
    const scope = new Telescope(ctx, b, 'lounge-telescope', L.x0 + 1.0, 0, 52.7, Math.PI / 2, this.landmarks);
    ctx.addInteractable(scope);
    ctx.addModal(scope);

    // ---- 4. Landmark column aquarium with curved sofas ----------------------------------------------------
    const ac = { x: -2, z: 63.5 };
    new Aquarium(ctx, b, {
      id: 'lounge-column',
      kind: 'cylinder',
      x: ac.x,
      z: ac.z,
      y0: 0.5,
      r: 1.7,
      height: 5.0,
      fishPerSpecies: 5,
      kelp: 12,
      corals: 6,
      bubbles: 220,
      lod: 40,
      waterColor: 0x23a8cf,
      info: { title: 'Grande Coluna Maré', html: '9 m³ de água do mar filtrada. Moram aqui cirurgiões-patela azuis, peixes-palhaço, tetras-neon, borboletas-amarelas e peixes-anjo. A coluna é iluminada pela claraboia: ao meio-dia, a luz desenha cáusticas no piso.' },
    });
    for (let k = 0; k < 4; k++) {
      const c = Math.PI / 4 + (k * Math.PI) / 2;
      const a0 = c - 0.55;
      const a1 = c + 0.55;
      crescentSofa(b, ac.x, ac.z, 4.0, a0, a1, k % 2 ? m.fabricCyan : m.fabricCobalt, 'in');
      for (let i = 0; i < 3; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / 3;
        ctx.addSeat({ id: `lounge-ring-${k}-${i}`, x: ac.x + Math.cos(a) * 3.9, y: 0.49, z: ac.z + Math.sin(a) * 3.9, yaw: yawFacing(-Math.cos(a), -Math.sin(a)) });
      }
    }
    const ringGlow = aquaLamps.material(0xd8f6ff, 1.6);
    ringPendant(b, ac.x, 4.6, ac.z, 3.2, H, ringGlow);
    aquaLamps.pool(b.root, ac.x, 0.05, ac.z, 4.6, 0xbff4ff, 0.18);

    // ---- 5. Panoramic aquarium wall (south) + observation sofas ------------------------------------------
    new Aquarium(ctx, b, {
      id: 'lounge-wall',
      kind: 'box',
      x: -5,
      z: L.z1 + 1.45,
      y0: 0.6,
      w: 24,
      d: 2.6,
      height: 3.6,
      backdrop: ['+z', '+x', '-x'],
      crown: false,
      fishPerSpecies: 9,
      kelp: 40,
      corals: 14,
      rocks: 10,
      bubbles: 300,
      lod: 45,
      collide: false,
      info: { title: 'Parede Recife', html: 'Um recife de 24 m reproduz a encosta submersa do platô: algas-gigantes, corais-cérebro e rochas vivas. Os cardumes atravessam de ponta a ponta em cerca de um minuto — sente-se e acompanhe um deles.' },
    });
    b.box(m.emissiveCyan, -5, 0.6, L.z1 - 0.26, 24, 0.02, 0.02, { cast: false, receive: false });
    for (const [i, x] of [-11.5, -5, 1.5].entries()) {
      for (const sp of sofa(b, x, 72.3, 0, 3.2, m.whiteCeramic, i === 1 ? m.fabricLime : m.fabricCobalt)) ctx.addSeat({ id: `lounge-obs-${i}-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });
    }
    for (const x of [-8.25, -1.75]) {
      const p = pouf(b, x, 73.0, 0.32, m.fabricCyan);
      ctx.addSeat({ id: `lounge-pouf-${x}`, x: p.x, y: p.y, z: p.z, yaw: yawFacing(0, 1) });
    }

    // ---- 6. Niche aquarium in the north pier, with a bench ---------------------------------------------
    new Aquarium(ctx, b, {
      id: 'lounge-niche',
      kind: 'box',
      x: -4.75,
      z: L.z0 - 0.17,
      y0: 1.0,
      w: 2.6,
      d: 0.5,
      height: 1.2,
      backdrop: ['-z', '+x', '-x'],
      crown: false,
      fishPerSpecies: 3,
      species: [1, 2],
      fishScale: 0.45,
      kelp: 6,
      bubbles: 50,
      collide: false,
      info: { title: 'Nicho dos Neons', html: 'Tetras-neon e peixes-palhaço juvenis num aquário de parede. O vidro tem 19 mm e o filtro fica escondido no pilar.' },
    });
    b.box(m.cobaltCeramic, -4.75, 0.85, L.z0 + 0.17, 2.9, 0.15, 0.06, { radius: 0.03 });
    b.box(m.cobaltCeramic, -4.75, 2.2, L.z0 + 0.17, 2.9, 0.12, 0.06, { radius: 0.03 });
    for (const sp of bench(b, -4.75, L.z0 + 1.6, 0, -1, 2.6, m.fabricCobalt)) ctx.addSeat({ id: `lounge-nichebench-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, -1) });

    // ---- 7. Services pier (north-east): info panel, water, recycling, vending ------------------------
    const info = infoBoard(ctx);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: info, toneMapped: false }));
    panel.position.set(4.6, 1.85, L.z0 + 0.17);
    b.root.add(panel);
    b.box(m.whiteCeramic, 4.6, 1.0, L.z0 + 0.14, 2.6, 1.7, 0.04, { radius: 0.05, cast: false });
    examine(ctx, 'lounge-info', new THREE.Vector3(4.6, 1.85, L.z0 + 0.25), new THREE.Vector3(1.2, 0.75, 0.1), 'Ler painel informativo', '<b>Ala Horizonte</b><br>Salão Maré: aquários, lago e janelas para o oeste. Toaletes à direita. Hotel AQUA pela passarela ao sul (recepção, quartos no 1º andar e mirante na cobertura). Jardim das Águas pela porta oeste.', 0, 2.6);
    waterDispenser(b, 2.4, L.z0 + 0.6, 0);
    recycleBins(b, 6.9, L.z0 + 0.5, 0);
    const vm = new VendingMachine(ctx, 'lounge-vending', 7.4, 53.2, -Math.PI / 2);
    ctx.addInteractable(vm);
    ctx.addModal(vm);
    ctx.addUpdatable(vm);
    // restroom sign
    hangingSign(b, 6.4, 57.0, 'Toaletes', '→', '#1d6fe0', -Math.PI / 2, ctx);

    // ---- 8. Reading corner (east glass) ---------------------------------------------------------------
    bookshelf(b, L.x1 - 0.3, 63.6, -Math.PI / 2, 2.4, 1.9, 77);
    for (const [i, z] of [62.6, 64.6].entries()) {
      const f = -Math.PI / 2 + (i ? -0.3 : 0.3);
      const s = tubChair(b, L.x1 - 1.8, z, f, m.whiteCeramic, fabric('lagoon'));
      ctx.addSeat({ id: `lounge-read-${i}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(Math.sin(f), Math.cos(f)) });
    }
    const readGlow = sofaLamps.material(0xfff1d6, 1.6);
    teardropLamp(b, L.x1 - 2.6, 2.6, 63.6, H, readGlow, 0.24);
    sofaLamps.pool(b.root, L.x1 - 2.4, 0.05, 63.6, 1.3, 0xffe8c2, 0.25);
    roundTable(b, L.x1 - 2.6, 63.6, 0.3, 0.5, m.glass);
    artPanel(b, L.x1 - 0.12, 2.5, 67.4, -Math.PI / 2, 1.6, 1.0, 5);

    // ---- 9. Hidden seahorse nook (south-east, behind the planters) -----------------------------------
    const nk = { x: 14.2, z: 72.0 };
    b.arcWall(m.whiteCeramic, nk.x, nk.z, 2.0, 2.35, Math.PI * 0.55, Math.PI * 1.45, 0, 1.15, { collide: 'tile', bevel: 0.08 });
    b.arcWall(m.soil, nk.x, nk.z, 2.03, 2.32, Math.PI * 0.56, Math.PI * 1.44, 1.15, 0.04, { bevel: 0 });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.6 + (i / 5) * Math.PI * 0.8;
      if (i % 2) ctx.veg.banana(nk.x + Math.cos(a) * 2.18, 1.19, nk.z + Math.sin(a) * 2.18, 0.55);
      else ctx.veg.fern(nk.x + Math.cos(a) * 2.18, 1.19, nk.z + Math.sin(a) * 2.18, 0.7);
    }
    b.cylinder(m.cobaltCeramic, nk.x + 0.9, 0, nk.z, 0.42, 0.5, 0.8, { segments: 28 });
    new Aquarium(ctx, b, {
      id: 'lounge-seahorses',
      kind: 'cylinder',
      x: nk.x + 0.9,
      z: nk.z,
      y0: 0.85,
      r: 0.38,
      height: 1.0,
      cabinet: false,
      fishPerSpecies: 2,
      species: [3, 2],
      fishScale: 0.3,
      kelp: 5,
      bubbles: 30,
      waterColor: 0x2bb0c8,
      info: { title: 'Recanto dos Cavalos-Marinhos', html: 'Você achou o recanto escondido! Aqui vivem cavalos-marinhos-de-vidro (<i>Hippocampus vitreus</i>, espécie fictícia do AQUA), que se agarram às algas com a cauda, e dois peixes-borboleta. Fique um pouco: eles nadam devagar.' },
    });
    const s = tubChair(b, nk.x - 0.7, nk.z, Math.PI / 2, m.limeGlossy, fabric('pearl'));
    ctx.addSeat({ id: 'lounge-nook', x: s.x, y: s.y, z: s.z, yaw: yawFacing(1, 0) });
    const nookGlow = aquaLamps.material(0xbff4ff, 1.8);
    bubbleLamp(b, nk.x + 0.1, 2.3, nk.z, H, 0.22, nookGlow);

    // ---- 10. Skywalk signage + plants near the south door -----------------------------------------
    hangingSign(b, (SKY.x0 + SKY.x1) / 2, L.z1 - 1.4, 'Hotel AQUA', '↓', '#1747b5', 0, ctx);
    for (const x of [SKY.x0 - 0.8, SKY.x1 + 0.7]) {
      const top = planterBowl(b, x, L.z1 - 0.8, 0.4, m.whiteCeramic, m.limeGlossy);
      ctx.veg.sansevieria(x, top, L.z1 - 0.8, 0.7);
    }
    lightLine(b, 0, 0.04, L.z0 + 0.9, 3.2, 0, m.emissiveCyan);
  }

  /** Wall switch (a glossy plate with a cyan dot) that toggles a lamp group. */
  private lampSwitch(b: WorldBuilder, id: string, x: number, z: number, rotY: number, group: LampGroup, what: string, y = 1.2): void {
    const m = b.mats;
    b.box(m.whiteCeramic, x, y - 0.1, z, 0.12, 0.2, 0.03, { rotY, radius: 0.015, cast: false });
    b.sphere(m.emissiveCyan, x + Math.sin(rotY) * 0.02, y, z + Math.cos(rotY) * 0.02, 0.022, { cast: false });
    this.ctx.addInteractable(
      new UseSpot(id, new THREE.Vector3(x, y, z), new THREE.Vector3(0.1, 0.14, 0.1), rotY, () => (group.on ? `Apagar ${what}` : `Acender ${what}`), () => {
        group.toggle();
        this.ctx.audio.play('switch', { position: { x, y, z } });
      }, 2.2),
    );
  }
}

function loungeSign(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(1024, 256, 'loungeSign');
  c.clearRect(0, 0, 1024, 256);
  c.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(c, 8, 8, 1008, 240, 120);
  c.fill();
  c.strokeStyle = '#1747b5';
  c.lineWidth = 10;
  roundRect(c, 8, 8, 1008, 240, 120);
  c.stroke();
  const g = c.createRadialGradient(140, 110, 10, 140, 128, 70);
  g.addColorStop(0, '#9be22d');
  g.addColorStop(1, '#1d6fe0');
  c.fillStyle = g;
  c.beginPath();
  c.arc(140, 128, 70, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1747b5';
  c.font = `800 100px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText('Salão Maré', 240, 112);
  c.fillStyle = '#2a3a5c';
  c.font = `600 40px ${FONT}`;
  c.fillText('descanso · aquários · horizonte', 246, 192);
  texture.needsUpdate = true;
  return texture;
}

function infoBoard(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(768, 480, 'loungeInfo');
  const g = c.createLinearGradient(0, 0, 0, 480);
  g.addColorStop(0, '#1d6fe0');
  g.addColorStop(1, '#0d3a8f');
  c.fillStyle = g;
  c.fillRect(0, 0, 768, 480);
  c.fillStyle = '#ffffff';
  c.font = `800 46px ${FONT}`;
  c.fillText('Ala Horizonte', 34, 70);
  c.font = `600 22px ${FONT}`;
  c.fillStyle = '#b8ffd0';
  c.fillText('Você está no Salão Maré', 36, 108);
  // simple map
  const box = (x: number, y: number, w: number, h: number, col: string, label: string) => {
    c.fillStyle = col;
    roundRect(c, x, y, w, h, 14);
    c.fill();
    c.fillStyle = '#06173f';
    c.font = `700 20px ${FONT}`;
    c.fillText(label, x + 12, y + h / 2 + 7);
  };
  box(60, 150, 330, 120, '#e8f7ff', 'Salão Maré (aqui)');
  box(330, 160, 60, 50, '#9be22d', 'WC');
  box(60, 300, 330, 120, '#cfe9f7', 'Hotel AQUA ↓');
  box(420, 150, 300, 270, '#7ad14a', 'Jardim · Mirante Sul');
  c.fillStyle = '#ffffff';
  c.font = `600 20px ${FONT}`;
  c.fillText('↑ Passarela para o Átrio Azul', 60, 140);
  texture.needsUpdate = true;
  return texture;
}

/** Double-sided hanging sign in the lounge style (white pill, coloured rim, arrow). */
export function hangingSign(b: WorldBuilder, x: number, z: number, title: string, arrow: string, color: string, rotY: number, ctx: WorldContext, y = 2.9, ceilingY = 6.2): void {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(768, 192, `hsign-${title}-${x.toFixed(1)}`);
  c.clearRect(0, 0, 768, 192);
  c.fillStyle = color;
  roundRect(c, 6, 6, 756, 180, 90);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(c, 20, 14, 728, 70, 60);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = `800 78px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText(title, 60, 100);
  c.beginPath();
  c.arc(680, 96, 58, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.font = `800 74px ${FONT}`;
  c.textAlign = 'center';
  c.fillText(arrow, 680, 100);
  texture.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  for (const side of [0, Math.PI]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), mat);
    p.position.set(x + Math.sin(rotY + side) * 0.02, y, z + Math.cos(rotY + side) * 0.02);
    p.rotation.y = rotY + side;
    p.renderOrder = 8;
    b.root.add(p);
  }
  for (const e of [-0.7, 0.7]) b.cylinder(b.mats.chrome, x + Math.cos(rotY) * e, y + 0.25, z - Math.sin(rotY) * e, 0.008, 0.008, ceilingY - y - 0.25, { segments: 5, cast: false });
}
