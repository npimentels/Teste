import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { yawFacing } from '../systems/Seats';
import { LAYOUT } from './WorldLayout';
import { FountainEmitter, WaterStream } from '../environment/ParticleSystem';
import { WATER_LOOKS } from '../environment/WaterSystem';
import { LightGroup } from '../environment/LightingSystem';
import { ControlPanel } from '../systems/Interactables';
import type { Updatable } from '../core/types';

/**
 * Destination — Terraço do Horizonte. An elevated deck reached by two glass-railed ramps, with
 * an infinity pool whose edge dissolves into the sea, a front cascade, loungers, a glass
 * pavilion and switchable pool lighting.
 */
export class HorizonTerrace implements Updatable {
  private readonly lights: LightGroup;

  constructor(ctx: WorldContext) {
    const { builder: b, mats: m, collision, veg } = ctx;
    const T = LAYOUT.terrace;
    const Y = T.y;
    const pool = { x0: -15, x1: 15, z0: -82, z1: -72, floor: 3.6 };

    // ---- Deck blocks (visual + collision) -----------------------------------------------
    const block = (x0: number, z0: number, x1: number, z1: number, top: number) => {
      b.box(m.whiteMatte, (x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, top, z1 - z0, { collide: 'tile', radius: 0.05 });
    };
    block(T.x0, pool.z1, T.x1, T.z1, Y); // south
    block(T.x0, T.z0, pool.x0, pool.z1, Y); // west
    block(pool.x1, T.z0, T.x1, pool.z1, Y); // east
    block(pool.x0, pool.z0 - 2.5, pool.x1, pool.z0, 3.95); // north edge / catch trough (grated)
    block(pool.x0, pool.z0, pool.x1, pool.z1, pool.floor); // pool floor
    // deck finish
    const deckTile = (x0: number, z0: number, x1: number, z1: number) => b.box(m.floorTile, (x0 + x1) / 2, Y - 0.02, (z0 + z1) / 2, x1 - x0, 0.04, z1 - z0, { cast: false });
    deckTile(T.x0, pool.z1, T.x1, T.z1);
    deckTile(T.x0, T.z0, pool.x0, pool.z1);
    deckTile(pool.x1, T.z0, T.x1, pool.z1);
    // front façade details
    for (const y of [1.3, 2.6]) b.box(m.chrome, 0, y, T.z1 + 0.02, T.x1 - T.x0 + 0.1, 0.08, 0.06, { cast: false });
    b.box(m.glossyCyan, 0, Y - 0.25, T.z1 + 0.03, T.x1 - T.x0 + 0.1, 0.12, 0.06, { cast: false });
    for (const sx of [-1, 1]) b.box(m.chrome, sx * (T.x1 + 0.03), 1.3, (T.z0 + T.z1) / 2, 0.06, 0.08, T.z1 - T.z0, { cast: false });

    // ---- Infinity pool ------------------------------------------------------------------
    const lightStrength = { value: 0.65 };
    const tile = m.poolTileAt(Y, lightStrength, 'terrace');
    b.box(tile, 0, pool.floor - 0.02, (pool.z0 + pool.z1) / 2, pool.x1 - pool.x0, 0.04, pool.z1 - pool.z0, { cast: false });
    b.box(tile, 0, pool.floor, pool.z1 - 0.04, pool.x1 - pool.x0, Y - pool.floor, 0.08, { cast: false });
    b.box(tile, pool.x0 + 0.04, pool.floor, (pool.z0 + pool.z1) / 2, 0.08, Y - pool.floor, pool.z1 - pool.z0, { cast: false });
    b.box(tile, pool.x1 - 0.04, pool.floor, (pool.z0 + pool.z1) / 2, 0.08, Y - pool.floor, pool.z1 - pool.z0, { cast: false });
    b.box(tile, 0, pool.floor, pool.z0 + 0.04, pool.x1 - pool.x0, 3.97 - pool.floor, 0.08, { cast: false });
    ctx.water.add({
      name: 'infinityPool',
      shape: { kind: 'rect', x: 0, z: (pool.z0 - 0.25 + pool.z1) / 2, hx: (pool.x1 - pool.x0) / 2, hz: (pool.z1 - pool.z0 + 0.25) / 2 },
      surfaceY: Y,
      look: WATER_LOOKS.infinity,
      segments: 64,
      flow: new THREE.Vector2(0, -0.08),
    });
    // overflow sheet into the grated trough
    const spill = WaterStream.ribbon(
      [new THREE.Vector3(0, Y + 0.005, pool.z0 - 0.22), new THREE.Vector3(0, Y - 0.08, pool.z0 - 0.34), new THREE.Vector3(0, Y - 0.4, pool.z0 - 0.48), new THREE.Vector3(0, Y - 0.7, pool.z0 - 0.55)],
      new THREE.Vector3((pool.x1 - pool.x0) / 2, 0, 0),
      { speed: 1.4, opacity: 0.55, streaks: 60 },
    );
    b.root.add(spill.mesh);
    ctx.addUpdatable(spill);
    b.box(m.rubber, 0, Y - 0.9, pool.z0 - 0.8, pool.x1 - pool.x0, 0.85, 1.1, { cast: false });
    for (let x = pool.x0 + 0.3; x < pool.x1; x += 0.3) b.box(m.chrome, x, Y - 0.06, pool.z0 - 0.8, 0.04, 0.04, 1.05, { cast: false, receive: false });
    ctx.audio.addWaterSource('stream', { x: 0, y: Y - 0.3, z: pool.z0 - 0.6 }, 0.5, true);

    // ---- Railings -------------------------------------------------------------------------
    const ry = Y;
    b.glassRailing([[-23.8, -84.3], [23.8, -84.3]], ry, 1.1);
    b.glassRailing([[-23.8, -84.3], [-23.8, -62.95], [-21, -62.95]], ry, 1.1);
    b.glassRailing([[23.8, -84.3], [23.8, -62.95], [21, -62.95]], ry, 1.1);
    b.glassRailing([[-21, T.z1 - 0.15], [21, T.z1 - 0.15]], ry, 1.1);

    // ---- Ramps ------------------------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const xBottom = sx * 5;
      const xTop = sx * 21;
      const z0 = -65.9;
      const z1 = -62.9;
      const shape = new THREE.Shape([new THREE.Vector2(xBottom, 0), new THREE.Vector2(xTop, 0), new THREE.Vector2(xTop, Y)]);
      const wedge = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
      b.place(wedge, m.whiteMatte, 0, 0, z0);
      wedge.dispose();
      // ramp surface finish (sloped tile strip)
      const len = Math.hypot(xTop - xBottom, Y);
      const surf = new THREE.BoxGeometry(len, 0.04, z1 - z0);
      b.place(surf, m.floorTile, (xBottom + xTop) / 2, Y / 2 + 0.02, (z0 + z1) / 2, { rotZ: sx * Math.atan2(Y, Math.abs(xTop - xBottom)), cast: false });
      surf.dispose();
      collision.addRamp({ x: (xBottom + xTop) / 2, z: (z0 + z1) / 2, sx: z1 - z0, sz: Math.abs(xTop - xBottom), rotY: sx < 0 ? -Math.PI / 2 : Math.PI / 2, minY: 0, y0: 0, y1: Y });
      // landing
      b.box(m.whiteMatte, sx * 22.5, 0, (T.z1 + z1) / 2, 3, Y, z1 - T.z1, { collide: 'tile', radius: 0.04 });
      b.box(m.floorTile, sx * 22.5, Y - 0.02, (T.z1 + z1) / 2, 3, 0.04, z1 - T.z1, { cast: false });
      this.slopedRailing(ctx, xBottom, xTop, z1 - 0.05, Y);
    }

    // ---- Front cascade into a basin ----------------------------------------------------
    const bz0 = -65.9;
    const bz1 = -63;
    for (const [x, z, w, d] of [
      [0, bz1 + 0.18, 7.4, 0.36],
      [-3.7 + 0.18, (bz0 + bz1) / 2, 0.36, bz1 - bz0],
      [3.7 - 0.18, (bz0 + bz1) / 2, 0.36, bz1 - bz0],
    ] as Array<[number, number, number, number]>) {
      b.box(m.whiteCeramic, x, 0, z, w, 0.45, d, { collide: 'stone', radius: 0.06 });
    }
    b.box(m.poolTileAt(0.32, { value: 0.5 }, 'gardenPools'), 0, -0.05, (bz0 + bz1) / 2, 7, 0.08, bz1 - bz0, { cast: false });
    ctx.water.add({ name: 'cascadeBasin', shape: { kind: 'rect', x: 0, z: (bz0 + bz1) / 2, hx: 3.32, hz: (bz1 - bz0) / 2 }, surfaceY: 0.32, look: WATER_LOOKS.pool, segments: 16 });
    b.box(m.chrome, 0, 3.55, T.z1 + 0.08, 6.4, 0.12, 0.25, { cast: false });
    const cascade = WaterStream.ribbon(
      [new THREE.Vector3(0, 3.62, T.z1 + 0.18), new THREE.Vector3(0, 3.3, T.z1 + 0.32), new THREE.Vector3(0, 1.8, T.z1 + 0.55), new THREE.Vector3(0, 0.32, T.z1 + 0.62)],
      new THREE.Vector3(2.9, 0, 0),
      { speed: 2.8, opacity: 0.7, streaks: 30 },
    );
    b.root.add(cascade.mesh);
    ctx.addUpdatable(cascade);
    const foamJets = [];
    for (let i = 0; i < 12; i++) foamJets.push({ origin: new THREE.Vector3(-2.7 + (i / 11) * 5.4, 0.33, T.z1 + 0.7), velocity: new THREE.Vector3(0, 1.5, 0.6), spread: 1.1, count: 26 });
    const foam = new FountainEmitter(foamJets, { floorY: 0.3, life: 0.7, size: 0.08, seed: 77 });
    b.root.add(foam.points);
    ctx.addUpdatable(foam);
    ctx.addQuality(foam);
    ctx.audio.addWaterSource('waterfall', { x: 0, y: 1.2, z: T.z1 + 0.8 }, 0.8, true);

    // ---- Amenities -----------------------------------------------------------------------
    for (const x of [-10.5, -7, 7, 10.5]) {
      b.box(m.whiteCeramic, x, Y, -69.6, 0.75, 0.3, 2.0, { collide: 'tile', radius: 0.12 });
      b.box(m.cushion, x, Y + 0.3, -69.4, 0.68, 0.08, 1.4, { radius: 0.04, cast: false });
      b.box(m.whiteCeramic, x, Y + 0.25, -68.45, 0.75, 0.75, 0.12, { rotX: 0.55, radius: 0.05 });
      ctx.addSeat({ id: `terrace-lounger-${x}`, x, y: Y + 0.38, z: -69.7, yaw: yawFacing(0, -1) });
    }
    for (const x of [-8.75, 8.75]) {
      b.cylinder(m.chrome, x, Y, -69.0, 0.04, 0.04, 2.7, { collide: 'metal', segments: 10 });
      b.cylinder(m.whiteCeramic, x, Y + 2.45, -69.0, 0.05, 1.7, 0.35, { segments: 32 });
      b.cylinder(m.glossyCyan, x, Y + 2.42, -69.0, 1.66, 1.66, 0.03, { segments: 32, cast: false });
      b.cylinder(m.whiteCeramic, x, Y, -69.0, 0.35, 0.4, 0.12, { segments: 24 });
    }
    // glass pavilion
    const pv = { x0: 16.5, x1: 22.5, z0: -81, z1: -74 };
    for (const [x, z] of [
      [pv.x0, pv.z0],
      [pv.x1, pv.z0],
      [pv.x0, pv.z1],
      [pv.x1, pv.z1],
    ] as Array<[number, number]>) {
      b.cylinder(m.chrome, x, Y, z, 0.08, 0.08, 3.0, { collide: 'metal', segments: 12 });
    }
    b.box(m.whiteCeramic, (pv.x0 + pv.x1) / 2, Y + 3.0, (pv.z0 + pv.z1) / 2, pv.x1 - pv.x0 + 0.6, 0.18, pv.z1 - pv.z0 + 0.6, { radius: 0.08 });
    b.box(m.glass, (pv.x0 + pv.x1) / 2, Y + 3.18, (pv.z0 + pv.z1) / 2, pv.x1 - pv.x0 - 0.6, 0.05, pv.z1 - pv.z0 - 0.6, { cast: false, receive: false });
    b.arcWall(m.whiteCeramic, (pv.x0 + pv.x1) / 2, -81.2, 3.2, 3.8, 0.95, 2.2, Y, 0.45, { collide: 'stone', bevel: 0.07 });
    b.arcWall(m.cushion, (pv.x0 + pv.x1) / 2, -81.2, 3.25, 3.75, 0.97, 2.18, Y + 0.45, 0.08, { bevel: 0.03 });
    for (const a of [1.2, 1.575, 1.95]) {
      ctx.addSeat({ id: `terrace-pavilion-${a}`, x: (pv.x0 + pv.x1) / 2 + Math.cos(a) * 3.5, y: Y + 0.53, z: -81.2 + Math.sin(a) * 3.5, yaw: yawFacing(-Math.cos(a), -Math.sin(a)) });
    }
    b.cylinder(m.glossyGreen, (pv.x0 + pv.x1) / 2, Y, -79.4, 0.5, 0.35, 0.45, { collide: 'stone', segments: 28 });
    // planters with palms
    for (const [x, z] of [
      [-20.5, -72],
      [-20.5, -80.5],
      [21.2, -70],
    ] as Array<[number, number]>) {
      b.box(m.whiteCeramic, x, Y, z, 2.2, 0.6, 2.2, { collide: 'stone', radius: 0.12 });
      b.box(m.soil, x, Y + 0.55, z, 1.9, 0.06, 1.9, { cast: false });
      veg.palm(x, Y + 0.58, z, 0.85);
      veg.fern(x + 0.6, Y + 0.58, z + 0.5, 0.8);
      veg.fern(x - 0.6, Y + 0.58, z - 0.5, 0.7);
    }
    // binoculars facing the horizon
    b.cylinder(m.chrome, -18.5, Y, -83.4, 0.06, 0.12, 1.1, { collide: 'metal', segments: 12 });
    b.box(m.glossyBlue, -18.5, Y + 1.1, -83.4, 0.5, 0.22, 0.32, { radius: 0.08 });
    for (const dx of [-0.13, 0.13]) b.cylinder(m.chrome, -18.5 + dx, Y + 1.21, -83.62, 0.06, 0.06, 0.18, { rotX: Math.PI / 2, segments: 12, cast: false });

    // ---- Pool lighting ----------------------------------------------------------------------
    this.lights = new LightGroup('terrace', true);
    const glow = m.emissiveCyan.clone();
    glow.name = 'terraceGlow';
    this.lights.addEmissive(glow, 0.04);
    this.lights.addUniform(lightStrength, 0.65, 0.3);
    for (let x = pool.x0 + 2.5; x < pool.x1; x += 5) {
      b.cylinder(glow, x, 3.72, pool.z1 - 0.07, 0.16, 0.16, 0.03, { rotX: Math.PI / 2, cast: false, segments: 20 });
    }
    const lantern = m.emissiveWarm.clone();
    lantern.name = 'terraceLantern';
    this.lights.addEmissive(lantern, 0.05);
    for (const [x, z] of [
      [-23.2, -83.6], [23.2, -83.6], [-23.2, -74], [23.2, -74], [-15.5, -66.8], [15.5, -66.8],
    ] as Array<[number, number]>) {
      b.cylinder(m.chrome, x, Y, z, 0.05, 0.07, 1.0, { segments: 10, cast: false });
      b.sphere(lantern, x, Y + 1.12, z, 0.15, { cast: false });
    }
    for (const x of [-7, 7]) {
      const l = new THREE.PointLight(0x7ff0ff, 12, 11, 2);
      l.position.set(x, Y - 0.15, -77);
      b.root.add(l);
      this.lights.addLight(l);
    }
    ctx.addUpdatable(this.lights);
    const panel = new ControlPanel(
      {
        id: 'terrace-lights',
        title: 'Luzes da Piscina',
        icon: 'light',
        x: -14.2,
        y: Y,
        z: -70.4,
        rotY: 0,
        initial: true,
        promptOn: 'Apagar as luzes da piscina',
        promptOff: 'Acender as luzes da piscina',
        stateOn: 'ACESAS',
        stateOff: 'APAGADAS',
        onChange: (on) => this.lights.setActive(on),
      },
      b,
    );
    ctx.addInteractable(panel);
    ctx.addUpdatable(panel);

    // floating orbs
    ctx.addBall('terrace-orb-cyan', 'a boia ciano', m.glossyCyan, -5, Y + 0.05, -76.5, 0.3);
    ctx.addBall('terrace-orb-green', 'a boia verde', m.glossyGreen, 6, Y + 0.05, -78, 0.3);

    b.flush('terrace');
  }

  /** Glass balustrade following a ramp from (xBottom, 0) to (xTop, rise). */
  private slopedRailing(ctx: WorldContext, xBottom: number, xTop: number, z: number, rise: number): void {
    const { builder: b, mats: m, collision } = ctx;
    const h = 1.05;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([xBottom, 0.05, z, xTop, rise + 0.05, z, xTop, rise + h - 0.05, z, xBottom, h - 0.05, z], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    b.place(geo, m.glass, 0, 0, 0, { cast: false, receive: false });
    geo.dispose();
    const len = Math.hypot(xTop - xBottom, rise);
    const rail = new THREE.CylinderGeometry(0.035, 0.035, len, 10).rotateZ(Math.PI / 2);
    b.place(rail, m.chrome, (xBottom + xTop) / 2, rise / 2 + h, z, { rotZ: Math.atan2(rise, xTop - xBottom), cast: false });
    rail.dispose();
    const posts = 5;
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const x = xBottom + (xTop - xBottom) * t;
      b.cylinder(m.chrome, x, rise * t, z, 0.03, 0.03, h, { segments: 8, cast: false });
    }
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const xa = xBottom + ((xTop - xBottom) * i) / segs;
      const xb = xBottom + ((xTop - xBottom) * (i + 1)) / segs;
      collision.addSegment(xa, z, xb, z, 0.12, 0, (rise * (i + 1)) / segs + h + 0.05, 'glass');
    }
  }

  update(): void {}
}
