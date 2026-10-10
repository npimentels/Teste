import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { LAYOUT, registerPaving, registerPavingRing } from './WorldLayout';
import { FountainEmitter, WaterStream } from '../environment/ParticleSystem';
import { WATER_LOOKS, type WaterBody } from '../environment/WaterSystem';
import { ControlPanel } from '../systems/Interactables';
import type { SoundHandle } from '../systems/AudioManager';
import type { Collider } from '../physics/Collision';
import type { Updatable } from '../core/types';
import { damp } from '../core/math';

const TAU = Math.PI * 2;

type Jet = { origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number };

/**
 * Zone B — Jardins Hidráulicos. A long canal fed by a raised reservoir through a sluice gate
 * (valve wheel), a glass pipeline whose flow is visible, three fountains on a shared control
 * panel, a white pergola and abundant tropical planting.
 */
export class HydraulicGardens implements Updatable {
  private readonly fountainParts: Array<FountainEmitter | WaterStream> = [];
  private readonly fountainSounds: SoundHandle[] = [];
  private readonly sluiceParts: Array<FountainEmitter | WaterStream> = [];
  private readonly sluiceSounds: SoundHandle[] = [];
  private readonly gate: THREE.Group;
  private readonly gateCollider: Collider;
  private gateY = 0;
  private gateTarget = 0;
  private readonly canal: WaterBody;
  private readonly reservoir: WaterBody;
  private readonly flowGlow: THREE.MeshStandardMaterial;
  private sluiceOpen = false;
  private fountainsOn = true;

  constructor(ctx: WorldContext) {
    const { builder: b, mats: m, collision, veg } = ctx;
    const C = LAYOUT.gardens.canal;
    const canalCx = (C.x0 + C.x1) / 2;
    const canalHx = (C.x1 - C.x0) / 2;
    const canalCz = (C.z0 + C.z1) / 2;

    // ---- Paving ---------------------------------------------------------------------------
    const pave = (x0: number, z0: number, x1: number, z1: number) => {
      b.box(m.paving, (x0 + x1) / 2, -0.08, (z0 + z1) / 2, Math.abs(x1 - x0), 0.1, Math.abs(z1 - z0), { cast: false });
      registerPaving(x0, z0, x1, z1);
    };
    pave(-3, -16.9, 3, -36.4);
    pave(-3, -41.6, 3, -44.75);
    pave(-3, -59.25, 3, -62.9);
    pave(-22, -34.4, -3, -36.4);
    pave(3, -34.4, 22, -36.4);
    pave(-22, -41.6, -3, -43.6);
    pave(3, -41.6, 22, -43.6);
    b.ring(m.paving, 0, 0.02, -52, 4.45, 7.2, 0.1, { cast: false });
    registerPavingRing(0, -52, 4.45, 7.2);
    for (const sx of [-1, 1]) {
      const cx = sx * 13;
      const sq = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      b.slab(m.paving, sq(cx - 3.6, -31.6, cx + 3.6, -24.4), [sq(cx - 2.86, -30.86, cx + 2.86, -25.14)], 0.02, 0.1, { cast: false });
      registerPaving(cx - 3.6, -31.6, cx + 3.6, -24.4);
      pave(sx > 0 ? 3 : -9.4, -27.2, sx > 0 ? 9.4 : -3, -28.8);
    }
    // canal coping
    b.box(m.whiteCeramic, canalCx, -0.04, C.z1 + 0.3, canalHx * 2 + 0.8, 0.1, 0.6, { radius: 0.03, cast: false });
    b.box(m.whiteCeramic, canalCx, -0.04, C.z0 - 0.3, canalHx * 2 + 0.8, 0.1, 0.6, { radius: 0.03, cast: false });

    // ---- Canal ---------------------------------------------------------------------------
    collision.terrain.addRectBasin(canalCx, canalCz, canalHx, 2, C.floor);
    const canalTile = m.poolTileAt(0.02, { value: 0.5 }, 'canal');
    b.box(canalTile, canalCx, C.floor - 0.2, canalCz, canalHx * 2, 0.2, 4, { cast: false });
    const wall = (x: number, z: number, sx: number, sz: number) => {
      b.box(canalTile, x, C.floor, z, sx, -C.floor, sz, { cast: false });
      collision.addBox({ x, z, sx, sz, minY: C.floor, maxY: 0, surface: 'stone' });
    };
    wall(canalCx, C.z1 + 0.05, canalHx * 2 + 0.2, 0.1);
    wall(canalCx, C.z0 - 0.05, canalHx * 2 + 0.2, 0.1);
    wall(C.x1 + 0.05, canalCz, 0.1, 4);
    this.canal = ctx.water.add({
      name: 'canal',
      shape: { kind: 'rect', x: canalCx, z: canalCz, hx: canalHx, hz: 2 },
      surfaceY: C.water,
      look: WATER_LOOKS.canal,
      segments: 96,
      flow: new THREE.Vector2(0.04, 0),
    });
    this.canal.targetFlow.set(0.04, 0);

    // Bridges
    for (const [bx, w] of [
      [0, 6],
      [-14, 3],
    ] as Array<[number, number]>) {
      b.box(m.whiteCeramic, bx, -0.07, canalCz, w, 0.25, 5.2, { collide: 'tile', radius: 0.06 });
      b.box(m.chrome, bx, -0.12, canalCz, w - 0.4, 0.05, 5.0, { cast: false });
      b.glassRailing([[bx - w / 2 + 0.05, C.z1 + 0.4], [bx - w / 2 + 0.05, C.z0 - 0.4]], 0.18, 1.0);
      b.glassRailing([[bx + w / 2 - 0.05, C.z1 + 0.4], [bx + w / 2 - 0.05, C.z0 - 0.4]], 0.18, 1.0);
    }
    registerPaving(-15.5, C.z0 - 0.6, -12.5, C.z1 + 0.6);
    registerPaving(-3, C.z0 - 0.6, 3, C.z1 + 0.6);

    // ---- Reservoir and sluice gate ---------------------------------------------------------
    const R = { x0: -31.8, x1: -25.5, z0: -43.3, z1: -34.7, h: 1.3 };
    const rcx = (R.x0 + R.x1) / 2;
    const rcz = (R.z0 + R.z1) / 2;
    const rw = (x: number, z: number, sx: number, sz: number, h = R.h) => b.box(m.whiteCeramic, x, 0, z, sx, h, sz, { collide: 'stone', radius: 0.08 });
    rw(rcx, R.z0 + 0.2, R.x1 - R.x0, 0.4);
    rw(rcx, R.z1 - 0.2, R.x1 - R.x0, 0.4);
    rw(R.x0 + 0.2, rcz, 0.4, R.z1 - R.z0);
    rw(R.x1 - 0.2, (R.z0 + C.z0 + 0.4) / 2, 0.4, C.z0 + 0.4 - R.z0);
    rw(R.x1 - 0.2, (R.z1 + C.z1 - 0.4) / 2, 0.4, R.z1 - (C.z1 - 0.4));
    rw(R.x1 - 0.2, canalCz, 0.4, 3.2, 1.0); // weir crest under the gate
    b.box(m.chrome, rcx, R.h - 0.02, R.z0 + 0.2, R.x1 - R.x0 + 0.05, 0.05, 0.45, { cast: false });
    b.box(m.chrome, rcx, R.h - 0.02, R.z1 - 0.2, R.x1 - R.x0 + 0.05, 0.05, 0.45, { cast: false });
    b.box(m.poolTileAt(1.1, { value: 0.4 }, 'reservoir'), rcx, 0, rcz, R.x1 - R.x0 - 0.8, 0.32, R.z1 - R.z0 - 0.8, { cast: false });
    this.reservoir = ctx.water.add({
      name: 'reservoir',
      shape: { kind: 'rect', x: rcx, z: rcz, hx: (R.x1 - R.x0) / 2 - 0.4, hz: (R.z1 - R.z0) / 2 - 0.4 },
      surfaceY: 1.12,
      look: WATER_LOOKS.canal,
      segments: 24,
    });
    // gate frame
    for (const z of [C.z0 + 0.3, C.z1 - 0.3]) b.box(m.chrome, R.x1 - 0.2, 0, z, 0.3, 3.1, 0.3, { collide: 'metal', radius: 0.04 });
    b.box(m.chrome, R.x1 - 0.2, 3.0, canalCz, 0.34, 0.3, 4.4, { radius: 0.06 });
    b.box(m.rubber, R.x1 - 0.2, 2.2, canalCz, 0.12, 0.8, 0.12, { cast: false });
    this.gate = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 3.3), m.whiteCeramic);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 3.32), m.glossyCyan);
    stripe.position.y = 0.12;
    slab.castShadow = true;
    this.gate.add(slab, stripe);
    this.gate.position.set(R.x1 - 0.2, 1.28, canalCz);
    b.root.add(this.gate);
    this.gateCollider = collision.addBox({ x: R.x1 - 0.2, z: canalCz, sx: 0.2, sz: 3.3, minY: 0.98, maxY: 1.58, surface: 'metal' });
    // falling sheet + foam when open
    const sheetPts = [
      new THREE.Vector3(R.x1 - 0.1, 1.06, canalCz),
      new THREE.Vector3(R.x1 + 0.15, 1.0, canalCz),
      new THREE.Vector3(R.x1 + 0.5, 0.62, canalCz),
      new THREE.Vector3(R.x1 + 0.78, 0.15, canalCz),
      new THREE.Vector3(R.x1 + 0.95, C.water + 0.04, canalCz),
    ];
    const sheet = WaterStream.ribbon(sheetPts, new THREE.Vector3(0, 0, 1.55), { speed: 2.6, opacity: 0.8, travelTime: 0.5, streaks: 9 });
    b.root.add(sheet.mesh);
    sheet.setActive(false, true);
    const foamJets: Jet[] = [];
    for (let i = 0; i < 16; i++) {
      const z = C.z0 + 0.6 + (i / 15) * (C.z1 - C.z0 - 1.2);
      foamJets.push({ origin: new THREE.Vector3(R.x1 + 1.0, C.water + 0.03, z), velocity: new THREE.Vector3(0.9, 1.6, 0), spread: 1.1, count: 30 });
    }
    const foam = new FountainEmitter(foamJets, { floorY: C.water - 0.05, life: 0.7, size: 0.08, seed: 41 });
    foam.intensity = 0;
    foam.setActive(false);
    b.root.add(foam.points);
    this.sluiceParts.push(sheet, foam);
    ctx.addQuality(foam);
    this.sluiceSounds.push(ctx.audio.addWaterSource('waterfall', { x: R.x1 + 0.8, y: 0.4, z: canalCz }, 1.1, false));
    for (const x of [-10, 6, 20]) this.sluiceSounds.push(ctx.audio.addWaterSource('stream', { x, y: 0, z: canalCz }, 0.55, false));

    const sluicePanel = new ControlPanel(
      {
        id: 'gardens-sluice',
        title: 'Comporta do Canal',
        icon: 'valve',
        x: -21.4,
        z: -34.9,
        rotY: 0,
        initial: false,
        wheel: true,
        promptOn: 'Fechar a comporta (girar válvula)',
        promptOff: 'Abrir a comporta (girar válvula)',
        stateOn: 'ABERTA',
        stateOff: 'FECHADA',
        onChange: (on) => this.setSluice(on),
      },
      b,
    );
    ctx.addInteractable(sluicePanel);
    ctx.addUpdatable(sluicePanel);

    // ---- Pipeline with visible flow --------------------------------------------------------
    const PY = 3.4;
    const PZ = -33.2;
    b.pipe([new THREE.Vector3(-28.6, 0.9, R.z1 - 0.05), new THREE.Vector3(-28.6, PY, R.z1 - 0.05), new THREE.Vector3(-28.6, PY, PZ), new THREE.Vector3(-27.2, PY, PZ)], 0.17);
    const runStart = new THREE.Vector3(-27.2, PY, PZ);
    const runEnd = new THREE.Vector3(13, PY, PZ);
    const runLen = runEnd.x - runStart.x;
    const glassTube = new THREE.CylinderGeometry(0.19, 0.19, runLen, 16, 1, true).rotateZ(Math.PI / 2);
    b.place(glassTube, m.glass, (runStart.x + runEnd.x) / 2, PY, PZ, { cast: false, receive: false });
    for (let x = runStart.x; x <= runEnd.x + 0.01; x += 3.6) b.torus(m.chrome, x, PY, PZ, 0.2, 0.045, { rotY: Math.PI / 2, cast: false });
    const flow = WaterStream.tube([runStart.clone(), new THREE.Vector3((runStart.x + runEnd.x) / 2, PY, PZ), runEnd.clone()], 0.12, { speed: 4, opacity: 0.85, travelTime: 2.4, color: 0x7fe6f5, streaks: 4 });
    b.root.add(flow.mesh);
    this.fountainParts.push(flow);
    // glowing flow indicator ring on each support
    this.flowGlow = m.emissiveCyan.clone();
    this.flowGlow.name = 'pipeGlow';
    for (const x of [-22, -6, 6]) {
      b.cylinder(m.whiteCeramic, x, 0, PZ, 0.12, 0.16, PY - 0.15, { collide: 'metal', segments: 16 });
      b.box(m.chrome, x, PY - 0.3, PZ, 0.5, 0.12, 0.5, { cast: false });
      b.cylinder(this.flowGlow, x, 1.3, PZ, 0.17, 0.17, 0.12, { cast: false, segments: 20 });
    }
    // drops into the square pools + spouts
    for (const sx of [-1, 1]) {
      const x = sx * 13;
      b.pipe([new THREE.Vector3(x, PY, PZ), new THREE.Vector3(x, PY, -31.1), new THREE.Vector3(x, 0.75, -31.1), new THREE.Vector3(x, 0.75, -30.7)], 0.14);
      b.sphere(m.chrome, x, PY, PZ, 0.22, { cast: false });
      const spout = WaterStream.tube([new THREE.Vector3(x, 0.72, -30.6), new THREE.Vector3(x, 0.66, -30.25), new THREE.Vector3(x, 0.33, -29.75)], 0.07, { speed: 3, opacity: 0.8, travelTime: 0.3 });
      b.root.add(spout.mesh);
      this.fountainParts.push(spout);
    }

    // ---- Square fountain pools ------------------------------------------------------------
    const sqTile = m.poolTileAt(0.32, { value: 0.5 }, 'gardenPools');
    for (const sx of [-1, 1]) {
      const cx = sx * 13;
      const cz = -28;
      const hw = 2.5;
      const t = 0.36;
      for (const [x, z, w, d] of [
        [cx, cz - hw - t / 2, hw * 2 + t * 2, t],
        [cx, cz + hw + t / 2, hw * 2 + t * 2, t],
        [cx - hw - t / 2, cz, t, hw * 2],
        [cx + hw + t / 2, cz, t, hw * 2],
      ] as Array<[number, number, number, number]>) {
        b.box(m.whiteCeramic, x, 0, z, w, 0.45, d, { collide: 'stone', radius: 0.07 });
      }
      b.box(sqTile, cx, -0.05, cz, hw * 2, 0.08, hw * 2, { cast: false });
      ctx.water.add({ name: `squarePool${sx}`, shape: { kind: 'rect', x: cx, z: cz, hx: hw, hz: hw }, surfaceY: 0.32, look: WATER_LOOKS.pool, segments: 24 });
      // sculpture + jets
      b.cylinder(m.chrome, cx, 0, cz, 0.22, 0.3, 0.55, { collide: 'metal', segments: 20 });
      b.sphere(m.glossyGreen, cx, 0.98, cz, 0.45);
      collision.addCylinder({ x: cx, z: cz, r: 0.45, minY: 0, maxY: 1.43, surface: 'stone' });
      const jets: Jet[] = [{ origin: new THREE.Vector3(cx, 1.45, cz), velocity: new THREE.Vector3(0, 4.6, 0), spread: 0.6, count: 260 }];
      const arcPaths: THREE.Vector3[][] = [];
      for (const [dx, dz] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const origin = new THREE.Vector3(cx + dx * 2.0, 0.34, cz + dz * 2.0);
        const vy = 3.6;
        const flight = (2 * vy) / 9.8;
        const dist = 2.0 * Math.SQRT2 - 0.6;
        const dir = new THREE.Vector3(-dx, 0, -dz).normalize();
        const velocity = dir.clone().multiplyScalar(dist / flight).setY(vy);
        jets.push({ origin, velocity, spread: 0.15, count: 70 });
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k <= 10; k++) {
          const tt = (k / 10) * flight;
          pts.push(origin.clone().addScaledVector(velocity, tt).setY(origin.y + vy * tt - 4.9 * tt * tt));
        }
        arcPaths.push(pts);
        b.sphere(m.chrome, origin.x, 0.3, origin.z, 0.08, { cast: false });
      }
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * TAU;
        jets.push({ origin: new THREE.Vector3(cx + Math.cos(a) * 0.5, 0.34, cz + Math.sin(a) * 0.5), velocity: new THREE.Vector3(Math.cos(a) * 0.6, 1.4, Math.sin(a) * 0.6), spread: 0.8, count: 16 });
      }
      const arcs = WaterStream.tubes(arcPaths, 0.028, { speed: 2.4, opacity: 0.7, travelTime: 0.4 });
      b.root.add(arcs.mesh);
      this.fountainParts.push(arcs);
      const f = new FountainEmitter(jets, { floorY: 0.3, life: 1.3, size: 0.08, seed: 50 + sx });
      b.root.add(f.points);
      this.fountainParts.push(f);
      ctx.addQuality(f);
      this.fountainSounds.push(ctx.audio.addWaterSource('fountain', { x: cx, y: 1, z: cz }, 0.75, true));
      // planting around
      veg.monstera(cx - sx * 3.9, 0, -24.0, 1.1);
      veg.fern(cx + sx * 3.9, 0, -24.0, 1.1);
      veg.fern(cx - sx * 3.9, 0, -32.0, 1);
    }

    // ---- Round pool with tiered fountain ----------------------------------------------------
    const rpz = -52;
    const rpTile = m.poolTileAt(0.32, { value: 0.5 }, 'gardenPools');
    b.ring(m.whiteCeramic, 0, 0.45, rpz, 4, 4.5, 0.45);
    b.torus(m.whiteCeramic, 0, 0.45, rpz, 4.25, 0.25, { rotX: Math.PI / 2, cast: false });
    collision.addArc(0, rpz, 4, 4.5, 0, TAU, 0, 0.45, 24, 'stone');
    b.ring(rpTile, 0, 0.03, rpz, 0, 4, 0.06, { cast: false });
    ctx.water.add({ name: 'roundPool', shape: { kind: 'circle', x: 0, z: rpz, r: 4 }, surfaceY: 0.32, look: WATER_LOOKS.pool, segments: 28 });
    b.cylinder(m.whiteCeramic, 0, 0, rpz, 0.5, 0.65, 0.45, { collide: 'stone', segments: 32 });
    b.cylinder(m.whiteCeramic, 0, 0.45, rpz, 0.16, 0.22, 1.0, { segments: 20 });
    b.cylinder(m.whiteCeramic, 0, 1.45, rpz, 0.1, 0.14, 0.85, { segments: 20 });
    const bowl = (r: number, h: number) =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.05, 0),
          new THREE.Vector2(r * 0.4, 0.02),
          new THREE.Vector2(r * 0.85, h * 0.45),
          new THREE.Vector2(r, h),
          new THREE.Vector2(r * 0.96, h * 1.05),
          new THREE.Vector2(r * 0.85, h * 0.75),
          new THREE.Vector2(0.05, h * 0.55),
        ],
        48,
      );
    const bowl1 = bowl(1.45, 0.32);
    const bowl2 = bowl(0.8, 0.22);
    b.place(bowl1, m.whiteCeramic, 0, 1.38, rpz);
    b.place(bowl2, m.whiteCeramic, 0, 2.25, rpz);
    collision.addCylinder({ x: 0, z: rpz, r: 1.45, minY: 1.3, maxY: 1.75, surface: 'stone' });
    collision.addCylinder({ x: 0, z: rpz, r: 0.3, minY: 0, maxY: 2.6, surface: 'stone' });
    ctx.water.add({ name: 'bowl1', shape: { kind: 'circle', x: 0, z: rpz, r: 1.32 }, surfaceY: 1.66, look: WATER_LOOKS.pool, segments: 12, queryable: false });
    ctx.water.add({ name: 'bowl2', shape: { kind: 'circle', x: 0, z: rpz, r: 0.7 }, surfaceY: 2.46, look: WATER_LOOKS.pool, segments: 8, queryable: false });
    b.sphere(m.glossyCyan, 0, 2.62, rpz, 0.16);
    const c1 = WaterStream.curtain(new THREE.Vector3(0, 0, rpz), 1.43, 1.62, 1.69, 0.33, { speed: -2.4, opacity: 0.55, travelTime: 0.45, streaks: 40 });
    const c2 = WaterStream.curtain(new THREE.Vector3(0, 0, rpz), 0.79, 0.95, 2.48, 1.68, { speed: -2.4, opacity: 0.55, travelTime: 0.3, streaks: 24 });
    b.root.add(c1.mesh, c2.mesh);
    this.fountainParts.push(c1, c2);
    const topJets: Jet[] = [{ origin: new THREE.Vector3(0, 2.75, rpz), velocity: new THREE.Vector3(0, 3.4, 0), spread: 0.9, count: 280 }];
    for (let s = 0; s < 14; s++) {
      const a = (s / 14) * TAU;
      topJets.push({ origin: new THREE.Vector3(Math.cos(a) * 1.62, 0.34, rpz + Math.sin(a) * 1.62), velocity: new THREE.Vector3(Math.cos(a) * 0.5, 1.3, Math.sin(a) * 0.5), spread: 0.7, count: 14 });
    }
    const tf = new FountainEmitter(topJets, { floorY: 0.3, life: 1.2, size: 0.08, seed: 61 });
    b.root.add(tf.points);
    this.fountainParts.push(tf);
    ctx.addQuality(tf);
    this.fountainSounds.push(ctx.audio.addWaterSource('fountain', { x: 0, y: 1.4, z: rpz }, 0.9, true));

    const fountainPanel = new ControlPanel(
      {
        id: 'gardens-fountains',
        title: 'Fontes do Jardim',
        icon: 'fountain',
        x: 4.4,
        z: -45.4,
        rotY: 0,
        initial: true,
        promptOn: 'Desligar as fontes e a tubulação',
        promptOff: 'Ligar as fontes e a tubulação',
        onChange: (on) => this.setFountains(on),
      },
      b,
    );
    ctx.addInteractable(fountainPanel);
    ctx.addUpdatable(fountainPanel);
    for (const p of this.fountainParts) ctx.addUpdatable(p);
    for (const p of this.sluiceParts) ctx.addUpdatable(p);

    // ---- Pergola --------------------------------------------------------------------------
    for (let z = -20.5; z >= -32.6; z -= 3) {
      b.torus(m.whiteCeramic, 0, 0, z, 3.4, 0.12, { arc: Math.PI });
      for (const sx of [-1, 1]) {
        collision.addCylinder({ x: sx * 3.4, z, r: 0.16, minY: 0, maxY: 2.8, surface: 'stone' });
        b.cylinder(m.chrome, sx * 3.4, 0, z, 0.2, 0.22, 0.12, { cast: false, segments: 16 });
        veg.fern(sx * 3.9, 0, z + 0.4, 0.75);
      }
    }
    for (const sx of [-0.7, 0, 0.7]) {
      const len = 12.2;
      const rod = new THREE.CylinderGeometry(0.035, 0.035, len, 8).rotateX(Math.PI / 2);
      const a = Math.acos(sx);
      b.place(rod, m.chrome, Math.cos(a) * 3.4, Math.sin(a) * 3.4, -26.5, { cast: false });
    }

    // ---- Lamp posts ------------------------------------------------------------------------
    for (const [x, z] of [
      [3.7, -35.8],
      [-3.7, -42.4],
      [3.7, -47],
      [-3.7, -47],
      [5.6, -57],
      [-5.6, -57],
    ] as Array<[number, number]>) {
      b.cylinder(m.chrome, x, 0, z, 0.05, 0.07, 2.9, { collide: 'metal', segments: 12 });
      b.sphere(m.emissiveWarm, x, 3.05, z, 0.2, { cast: false });
      b.torus(m.chrome, x, 2.9, z, 0.12, 0.03, { rotX: Math.PI / 2, cast: false });
    }

    // ---- Planting --------------------------------------------------------------------------
    const palms: Array<[number, number]> = [
      [-6.2, -22.5], [6.2, -22.5], [-6.5, -32], [6.5, -32], [-19.5, -23], [19.5, -23], [-20, -31], [20, -31],
      [-8.5, -45.5], [8.5, -45.5], [-20, -45.5], [20, -45.5], [-10.5, -50], [10.5, -50], [-11, -56], [11, -56],
      [-17, -59.5], [17, -59.5], [-6.4, -61.4], [6.4, -61.4], [-26, -27], [26, -37], [-27, -52], [26, -52],
    ];
    for (const [x, z] of palms) veg.palm(x, 0, z, 1);
    const bushes: Array<[number, number]> = [
      [-9, -21], [9, -21], [-24, -21], [24, -21], [-25.5, -31], [25.5, -31], [-14, -46.5], [14, -46.5],
      [-22, -48], [22, -48], [-15, -54], [15, -54], [-21, -60], [21, -60], [-8.5, -58], [8.5, -58],
    ];
    for (const [x, z] of bushes) veg.bush(x, 0, z, 1);
    for (let x = -21; x <= 21; x += 3) {
      if (Math.abs(x) < 4) continue;
      veg.fern(x + 0.6, 0, -33.6, 0.85);
      veg.fern(x - 0.4, 0, -44.4, 0.85);
    }
    for (const [x, z] of [
      [-7, -52], [7, -52], [-4.8, -57.6], [4.8, -57.6], [-4.8, -46.4], [4.8, -46.6], [-23, -36], [-23.2, -42.6],
    ] as Array<[number, number]>) {
      veg.monstera(x, 0, z, 1.1);
    }
    const accept = (x: number, z: number): boolean => {
      if (Math.abs(x) < 3.4 || z < -62.6) return false;
      if (z < C.z1 + 1 && z > C.z0 - 3) return false;
      if (z < -33.9 && z > -36.9) return false;
      if (Math.abs(Math.abs(x) - 13) < 3.8 && z < -24 && z > -32) return false;
      if (Math.hypot(x, z + 52) < 7.5) return false;
      if (x < -25 && z < -33 && z > -45) return false;
      if (Math.abs(z - PZ) < 0.6) return false;
      return true;
    };
    veg.grass(-30, -64, 30, -18, 2800, 0, accept);
    veg.flowers(-30, -64, 30, -18, 460, 0, accept);

    // ---- Garden orbs & signage ------------------------------------------------------------
    ctx.addBall('garden-orb-blue', 'a esfera azul', m.glossyBlue, -8, 0.22, -35.4, 0.24);
    ctx.addBall('garden-orb-green', 'a esfera verde-água', m.glossyGreen, 6.2, 0.24, -52, 0.24);
    ctx.addBall('garden-orb-white', 'a esfera branca', m.whiteCeramic, 13, 0.6, -26.5, 0.24);
    b.sign('Terraço do Horizonte', '↑', 3.9, -43.2, 0);
    b.sign('Átrio Azul', '↑', -3.9, -36.0, Math.PI);

    b.flush('gardens');
  }

  private setSluice(open: boolean): void {
    this.sluiceOpen = open;
    this.gateTarget = open ? 1 : 0;
    for (const p of this.sluiceParts) p.setActive(open);
    for (const s of this.sluiceSounds) s.setActive(open);
    this.canal.targetFlow.set(open ? 0.65 : 0.04, 0);
    this.canal.targetLevel = open ? 0.1 : 0;
    this.reservoir.targetLevel = open ? -0.12 : 0;
  }

  private setFountains(on: boolean): void {
    this.fountainsOn = on;
    for (const p of this.fountainParts) p.setActive(on);
    for (const s of this.fountainSounds) s.setActive(on);
  }

  get state(): { sluiceOpen: boolean; fountainsOn: boolean } {
    return { sluiceOpen: this.sluiceOpen, fountainsOn: this.fountainsOn };
  }

  update(dt: number, time: number): void {
    // gate rises before the water starts, closes after
    this.gateY = damp(this.gateY, this.gateTarget, 1.6, dt);
    this.gate.position.y = 1.28 + this.gateY * 1.35;
    this.gateCollider.minY = 0.98 + this.gateY * 1.35;
    this.gateCollider.maxY = 1.58 + this.gateY * 1.35;
    this.flowGlow.emissiveIntensity = this.fountainsOn ? 1.6 + Math.sin(time * 4) * 0.6 : 0.05;
  }
}
