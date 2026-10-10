import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { yawFacing } from '../systems/Seats';
import { LAYOUT } from './WorldLayout';
import { FountainEmitter, WaterStream } from '../environment/ParticleSystem';
import { WATER_LOOKS, type WaterBody, type WaterSystem } from '../environment/WaterSystem';
import { LightGroup } from '../environment/LightingSystem';
import { ControlPanel } from '../systems/Interactables';
import type { Updatable } from '../core/types';
import { crescentRibs, floorInlay, lightCove, organicColumn, portal, wainscot } from './ArchKit';
import { bubbleLamp, crescentSofa, eggChair, glassTable, infoTotem, lilyPads, planterBowl, receptionDesk, recycleBins, rug, waterDispenser } from './Furniture';
import { roundRect } from '../core/AssetManager';

const TAU = Math.PI * 2;
const polar = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

/**
 * Zone A — Átrio Azul. Circular hall under a glass oculus: polished terrazzo with cobalt
 * inlays, fluted walls with a cobalt mosaic wainscot and light cove, organic lotus columns,
 * cobalt portals with integrated wayfinding, a cobalt-mosaic reflecting pool with fountain and
 * lily pads, a floating glass sphere, tropical planters and lived-in furniture (lounge,
 * reception, map totems, water dispenser, recycling, bubble lamps).
 */
export class Atrium implements Updatable {
  private readonly heroSphere: THREE.Group;
  private readonly orbiters: THREE.Object3D[] = [];
  private readonly fountainParts: Array<FountainEmitter | WaterStream> = [];
  private readonly fountain: FountainEmitter;
  private readonly lights: LightGroup;
  private readonly pool: WaterBody;
  private readonly floorMaterials: THREE.MeshStandardMaterial[];
  private readonly reflectionHide: THREE.Object3D[] = [];
  private fountainOn = true;

  constructor(ctx: WorldContext) {
    const { builder: b, mats: m, collision, veg } = ctx;
    const A = LAYOUT.atrium;
    const rOut = A.rIn + A.wallT;

    // Atrium-specific clones so a local reflection probe can be attached to them later.
    const floor = m.terrazzo.clone();
    floor.name = 'atriumTerrazzo';
    const wet = m.wetStone.clone();
    wet.name = 'atriumWetStone';
    this.floorMaterials = [floor, wet];

    this.lights = new LightGroup('atrium', true);
    const accent = m.emissiveCyan.clone();
    accent.name = 'atriumAccent';
    const cove = m.emissiveCyan.clone();
    cove.name = 'atriumCove';
    cove.color.set(0xe8fdff);
    cove.emissive.set(0x9ff2ff);
    cove.emissiveIntensity = 2.6;
    const lampGlow = m.frostedGlass.clone();
    lampGlow.name = 'atriumLamps';
    this.lights.addEmissive(accent, 0.03).addEmissive(cove, 0.05).addEmissive(lampGlow, 0.05);

    // ---- Floor: terrazzo, wet stone around the pool, inlays --------------------------------
    const wetR = A.rimR + 1.5;
    b.ring(floor, 0, 0.03, 0, wetR, A.rIn + 0.05, 0.3);
    b.ring(wet, 0, 0.03, 0, A.rimR - 0.05, wetR, 0.3);
    floorInlay(b, m.cobaltMosaic, 0, 0, wetR, wetR + 0.28);
    floorInlay(b, m.cobaltCeramic, 0, 0, 11.86, 11.98);
    floorInlay(b, m.chrome, 0, 0, 15.25, 15.29);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16;
      const [x, z] = polar((wetR + 0.28 + 11.86) / 2, a);
      b.box(m.cobaltCeramic, x, 0.03, z, 11.86 - wetR - 0.36, 0.006, 0.035, { rotY: -a, cast: false });
    }
    b.box(floor, 0, -0.27, -(A.rIn + 0.35), 6.2, 0.3, 1.2);
    b.box(floor, 0, -0.27, A.rIn + 0.35, 6.2, 0.3, 1.2);
    b.box(floor, A.rIn + 0.35, -0.27, 0, 1.2, 0.3, 5.4);

    // ---- Walls: fluted panels, cobalt mosaic wainscot, light cove, glass curtain ------------
    const halfN = 3 / A.rIn;
    const halfE = 2.6 / A.rIn;
    const glassA0 = 2.55;
    const glassA1 = 3.73;
    const solids: Array<[number, number]> = [
      [halfE, Math.PI / 2 - halfN],
      [Math.PI / 2 + halfN, glassA0],
      [glassA1, (3 * Math.PI) / 2 - halfN],
      [(3 * Math.PI) / 2 + halfN, TAU - halfE],
    ];
    for (const [a0, a1] of solids) {
      b.arcWall(m.flutedWall, 0, 0, A.rIn, rOut, a0, a1, 0, A.wallH, { collide: 'tile' });
      wainscot(b, 0, 0, A.rIn, a0 + 0.012, a1 - 0.012);
      lightCove(b, 0, 0, A.rIn, a0 + 0.035, a1 - 0.035, 4.15, cove);
      b.arcWall(m.chrome, 0, 0, A.rIn - 0.03, A.rIn + 0.01, a0, a1, 7.35, 0.04, { bevel: 0.01, cast: false });
      // exterior: cobalt plinth and a glossy cyan frieze under the cornice
      b.arcWall(m.cobaltCeramic, 0, 0, rOut - 0.01, rOut + 0.08, a0 + 0.03, a1 - 0.03, 0, 0.7, { bevel: 0.03, cast: false });
      b.arcWall(m.glossyCyan, 0, 0, rOut - 0.01, rOut + 0.05, a0 + 0.03, a1 - 0.03, 7.7, 0.18, { bevel: 0.02, cast: false });
    }
    // lintels and cobalt portals with integrated signs
    const portals: Array<[number, number, string, string]> = [
      [-Math.PI / 2, 3, 'Jardins Hidráulicos', '#3fae66'],
      [Math.PI / 2, 3, 'Esplanada', '#9be22d'],
      [0, 2.6, 'Galeria Aquática', '#28c5df'],
    ];
    for (const [c, half, text, color] of portals) {
      const h = half / A.rIn;
      b.arcWall(m.flutedWall, 0, 0, A.rIn, rOut, c - h - 0.02, c + h + 0.02, 4.6, A.wallH - 4.6);
      portal(b, 0, 0, A.rIn, A.wallT, c, half, 4.0, { text, color }, m.cyanAcrylic);
    }
    // glass curtain wall: cobalt sill, chrome mullions and transoms
    b.arcWall(m.glass, 0, 0, A.rIn + 0.25, A.rIn + 0.32, glassA0, glassA1, 0, A.wallH, { bevel: 0, cast: false, receive: false });
    collision.addArc(0, 0, A.rIn - 0.15, A.rIn + 0.4, glassA0, glassA1, 0, A.wallH, 12, 'glass');
    b.arcWall(m.cobaltCeramic, 0, 0, A.rIn - 0.15, A.rIn + 0.45, glassA0, glassA1, 0, 0.45, { bevel: 0.05 });
    const mullions = 9;
    for (let i = 0; i <= mullions; i++) {
      const a = glassA0 + ((glassA1 - glassA0) * i) / mullions;
      const [x, z] = polar(A.rIn + 0.28, a);
      b.box(m.brushedMetal, x, 0.45, z, 0.1, A.wallH - 0.45, 0.18, { rotY: -a, radius: 0.04 });
    }
    for (const y of [2.9, 5.8]) b.arcWall(m.brushedMetal, 0, 0, A.rIn + 0.2, A.rIn + 0.38, glassA0, glassA1, y, 0.08, { bevel: 0.02, cast: false });
    b.torus(m.chrome, 0, A.wallH + 0.02, 0, rOut + 0.6, 0.08, { rotX: Math.PI / 2, cast: false });

    // ---- Roof: organic crescent ribs, tinted glass ring, cobalt oculus rim --------------------
    const roofGlass = m.glass.clone();
    roofGlass.name = 'atriumRoofGlass';
    roofGlass.color.set(0xb8ecf7);
    roofGlass.opacity = 0.3;
    b.ring(m.whiteCeramic, 0, A.wallH + 0.55, 0, 11, rOut + 0.6, 0.55);
    b.ring(roofGlass, 0, A.wallH + 0.35, 0, 7, 11, 0.06, { cast: false, receive: false });
    crescentRibs(b, 0, 0, 7.1, A.rIn, A.wallH, 16, 1.25, 0.24);
    b.torus(m.whiteCeramic, 0, A.wallH + 0.3, 0, 7, 0.32, { rotX: Math.PI / 2 });
    b.torus(m.cobaltCeramic, 0, A.wallH - 0.02, 0, 7.05, 0.16, { rotX: Math.PI / 2 });
    b.torus(m.chrome, 0, A.wallH + 0.3, 0, 6.68, 0.06, { rotX: Math.PI / 2, cast: false });

    // ---- Lotus columns with uplights ------------------------------------------------------
    const coneSpecs: Array<{ x: number; y: number; z: number; height: number; rTop: number; rBottom: number }> = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * TAU) / 8;
      const [x, z] = polar(11, a);
      organicColumn(b, x, z, A.wallH, { bandY: 1.15, capital: 1.0, shaft: 0.32 });
      b.cylinder(accent, x, 0.032, z, 0.78, 0.78, 0.008, { cast: false, segments: 32 });
      coneSpecs.push({ x, y: 0.05, z, height: 6.2, rTop: 1.05, rBottom: 0.5 });
    }
    const cones = b.lightCones(coneSpecs, 0x8ff3ff, 0.12);
    this.lights.addUniform(cones.opacity, 0.12, 0);

    // ---- Reflecting pool ---------------------------------------------------------------
    collision.terrain.addCircleBasin(0, 0, A.poolR, A.poolFloor);
    const causticStrength = { value: 0.55 };
    const tile = m.poolTileAt(A.waterY, causticStrength, 'atrium', 'cobalt');
    tile.side = THREE.DoubleSide;
    b.ring(tile, 0, A.poolFloor, 0, 0, A.poolR, 0.2);
    b.cylinder(tile, 0, A.poolFloor - 0.01, 0, A.poolR, A.poolR, 0.47, { open: true, segments: 72, cast: false });
    b.ring(m.whiteCeramic, 0, 0.3, 0, A.poolR, A.rimR, 0.32);
    b.cylinder(m.cobaltMosaic, 0, 0, 0, A.rimR + 0.015, A.rimR + 0.015, 0.27, { open: true, segments: 96, cast: false });
    b.torus(m.whiteCeramic, 0, 0.3, 0, A.rimR - 0.02, 0.06, { rotX: Math.PI / 2, cast: false });
    b.torus(m.chrome, 0, 0.29, 0, A.poolR + 0.02, 0.04, { rotX: Math.PI / 2, cast: false });
    b.torus(accent, 0, 0.035, 0, A.rimR + 0.12, 0.03, { rotX: Math.PI / 2, cast: false });
    collision.addArc(0, 0, A.poolR, A.rimR, 0, TAU, A.poolFloor, 0.3, 28, 'stone');
    this.pool = ctx.water.add({ name: 'atriumPool', shape: { kind: 'circle', x: 0, z: 0, r: A.poolR }, surfaceY: A.waterY, look: WATER_LOOKS.pool, segments: 40 });
    lilyPads(b, 0, 0, 2.3, 5.5, A.waterY + 0.008, 16, 7);

    // Fountain: cobalt lathe pedestal and jets
    const pedestal = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(0.98, 0),
        new THREE.Vector2(0.92, 0.12),
        new THREE.Vector2(0.62, 0.3),
        new THREE.Vector2(0.55, 0.45),
        new THREE.Vector2(0.78, 0.6),
        new THREE.Vector2(0.74, 0.66),
        new THREE.Vector2(0.001, 0.6),
      ],
      48,
    );
    b.place(pedestal, m.cobaltCeramic, 0, A.poolFloor, 0);
    pedestal.dispose();
    collision.addCylinder({ x: 0, z: 0, r: 0.95, minY: A.poolFloor, maxY: 0.47, surface: 'stone' });
    b.torus(m.chrome, 0, A.poolFloor + 0.62, 0, 0.75, 0.04, { rotX: Math.PI / 2, cast: false });
    b.sphere(m.chrome, 0, 0.47, 0, 0.16, { cast: false });
    const jets: Array<{ origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number }> = [];
    jets.push({ origin: new THREE.Vector3(0, 0.55, 0), velocity: new THREE.Vector3(0, 6.6, 0), spread: 0.55, count: 700 });
    const ring = 8;
    const arcPaths: THREE.Vector3[][] = [];
    const sources: Array<{ x: number; z: number; strength: number; speed?: number }> = [{ x: 0, z: 0, strength: 1, speed: 11 }];
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * TAU + Math.PI / ring;
      const r0 = 4.6;
      const origin = new THREE.Vector3(Math.cos(a) * r0, A.waterY + 0.03, Math.sin(a) * r0);
      const inward = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a));
      const vy = 4.2;
      const flight = (2 * vy) / 9.8;
      const vh = 3.3 / flight;
      const velocity = inward.clone().multiplyScalar(vh).setY(vy);
      jets.push({ origin, velocity, spread: 0.18, count: 90 });
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 10; k++) {
        const t = (k / 10) * flight;
        pts.push(origin.clone().addScaledVector(velocity, t).setY(origin.y + vy * t - 4.9 * t * t));
      }
      arcPaths.push(pts);
      b.sphere(m.chrome, origin.x, A.waterY - 0.02, origin.z, 0.09, { cast: false });
      const land = pts[pts.length - 1];
      sources.push({ x: land.x, z: land.z, strength: 0.55, speed: 9 + i * 0.4 });
      for (let s = 0; s < 3; s++) {
        const ang = (s / 3) * TAU + i;
        jets.push({ origin: land.clone().setY(A.waterY + 0.02), velocity: new THREE.Vector3(Math.cos(ang) * 0.5, 1.5, Math.sin(ang) * 0.5), spread: 0.9, count: 14 });
      }
    }
    this.pool.setSources(sources);
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * TAU;
      jets.push({ origin: new THREE.Vector3(Math.cos(ang) * 0.9, A.waterY + 0.02, Math.sin(ang) * 0.9), velocity: new THREE.Vector3(Math.cos(ang) * 0.7, 1.6, Math.sin(ang) * 0.7), spread: 0.8, count: 24 });
    }
    const arcs = WaterStream.tubes(arcPaths, 0.03, { speed: 2.4, opacity: 0.7, travelTime: 0.45 });
    b.root.add(arcs.mesh);
    this.fountainParts.push(arcs);
    this.fountain = new FountainEmitter(jets, { floorY: A.waterY - 0.02, life: 1.45, size: 0.085, seed: 21 });
    b.root.add(this.fountain.points);
    this.fountainParts.push(this.fountain);
    const column = WaterStream.tube([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 2.6, 0)], 0.055, { speed: -3, opacity: 0.55, travelTime: 0.3 });
    b.root.add(column.mesh);
    this.fountainParts.push(column);
    this.reflectionHide.push(arcs.mesh, this.fountain.points, column.mesh);
    for (const p of this.fountainParts) ctx.addUpdatable(p);
    ctx.addQuality(this.fountain);
    const fountainSound = ctx.audio.addWaterSource('fountain', { x: 0, y: 1.2, z: 0 }, 0.9, true);

    // ---- Floating hero sphere -----------------------------------------------------------
    this.heroSphere = new THREE.Group();
    this.heroSphere.position.set(0, 4.9, 0);
    const heroMat = new THREE.MeshPhysicalMaterial({
      name: 'heroGlass',
      color: 0xd6f8ff,
      roughness: 0.04,
      metalness: 0,
      transmission: 1,
      thickness: 1.2,
      ior: 1.35,
      attenuationColor: new THREE.Color(0x5fc8ee),
      attenuationDistance: 2.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      iridescence: 0.35,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 1,
    });
    ctx.addHeroGlass(heroMat);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.45, 64, 40), heroMat);
    shell.castShadow = false;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 4), accent);
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.05, 14, 120), m.cobaltCeramic);
    ringMesh.rotation.x = Math.PI / 2.4;
    this.heroSphere.add(shell, core, ringMesh);
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), [m.glossyCyan, m.limeGlossy, m.whiteCeramic][i]);
      orb.userData.phase = (i / 3) * TAU;
      orb.userData.radius = 2.05;
      this.heroSphere.add(orb);
      this.orbiters.push(orb);
    }
    this.heroSphere.userData.ring = ringMesh;
    b.root.add(this.heroSphere);

    // ---- Tropical planters (each one composed differently) -------------------------------------
    [45, 135, 225, 315].forEach((deg, idx) => {
      const a = THREE.MathUtils.degToRad(deg);
      const span = 0.24;
      b.arcWall(m.whiteCeramic, 0, 0, 13.3, 15.6, a - span, a + span, 0, 0.62, { collide: 'stone', bevel: 0.08 });
      b.arcWall(m.cobaltMosaic, 0, 0, 13.24, 13.3, a - span + 0.02, a + span - 0.02, 0.05, 0.45, { bevel: 0.01, cast: false });
      b.ring(m.soil, 0, 0.6, 0, 13.45, 15.45, 0.05, { a0: a - span + 0.01, a1: a + span - 0.01 });
      const at = (r: number, off: number): [number, number] => polar(r, a + off);
      const [px, pz] = at(14.6, idx % 2 ? 0.07 : -0.07);
      veg.palm(px, 0.58, pz, idx === 1 ? 1.05 : 0.92);
      const [bx, bz] = at(14.9, idx % 2 ? -0.13 : 0.13);
      veg.banana(bx, 0.58, bz, 0.9 + (idx % 3) * 0.1);
      const [mx, mz] = at(14.1, idx % 2 ? 0.16 : -0.16);
      veg.monstera(mx, 0.58, mz, 1.0);
      const [sx, sz] = at(13.75, idx % 2 ? -0.04 : 0.05);
      veg.sansevieria(sx, 0.58, sz, 0.9);
      for (const off of [-0.2, -0.06, 0.1, 0.21]) {
        const [vx, vz] = at(13.42, off);
        veg.vine(vx, 0.6, vz, 0.3 + Math.abs(off) * 0.5);
      }
      const [fx, fz] = at(15.2, 0.19 * (idx % 2 ? 1 : -1));
      veg.fern(fx, 0.58, fz, 0.95);
    });
    // glossy bowl planters softening the pool surroundings
    [0.3, 2.394, 3.44, 5.54].forEach((a, i) => {
      const [x, z] = polar(9.0, a);
      const top = planterBowl(b, x, z, 0.62, m.whiteCeramic, m.cobaltCeramic);
      if (i % 2) veg.sansevieria(x, top, z, 0.95);
      else veg.fern(x, top, z, 0.9);
      veg.vine(x + Math.cos(a) * 0.5, top, z + Math.sin(a) * 0.5, 0.35);
    });

    // ---- Lounge facing the glass view ---------------------------------------------------------
    crescentSofa(b, 0, 0, 12.4, 2.95, 3.33, m.fabricCobalt, 'out');
    for (const a of [3.0, 3.14, 3.28]) {
      const [sx, sz] = polar(12.55, a);
      ctx.addSeat({ id: `atrium-sofa-${a}`, x: sx, y: 0.49, z: sz, yaw: yawFacing(Math.cos(a), Math.sin(a)) });
    }
    const [rx, rz] = polar(13.6, Math.PI);
    rug(b, rx, rz, 1.6);
    glassTable(b, rx, rz, 0.55, 0.42);
    for (const a of [2.9, 3.38]) {
      const [cx, cz] = polar(14.3, a);
      eggChair(b, cx, cz, Math.atan2(rx - cx, rz - cz), m.whiteCeramic, m.fabricCyan);
      ctx.addSeat({ id: `atrium-egg-${a}`, x: cx, y: 0.46, z: cz, yaw: yawFacing(rx - cx, rz - cz) });
    }
    // ---- Reception & information -----------------------------------------------------------
    receptionDesk(b, 0, 0, 12.3, 0.98, 1.3, welcomeScreen(ctx));
    for (const [r, a, label] of [
      [12.6, 1.86, 'Você está no Átrio Azul'],
      [12.6, 5.0, 'Você está no Átrio Azul'],
    ] as Array<[number, number, string]>) {
      const [x, z] = polar(r, a);
      infoTotem(b, x, z, Math.atan2(-Math.cos(a), -Math.sin(a)), label);
    }
    // ---- Services: water and recycling ------------------------------------------------------
    {
      const [x, z] = polar(15.35, 4.28);
      waterDispenser(b, x, z, Math.atan2(-Math.cos(4.28), -Math.sin(4.28)));
      const [bx, bz] = polar(15.4, 4.4);
      recycleBins(b, bx, bz, -4.4 - Math.PI / 2);
    }
    // ---- Benches near the east portal ------------------------------------------------------------
    for (const [a0, a1, fabric] of [
      [-0.5, -0.2, m.fabricCyan],
      [0.2, 0.5, m.fabricLime],
    ] as Array<[number, number, THREE.Material]>) {
      b.arcWall(m.whiteCeramic, 0, 0, 9.6, 10.2, a0, a1, 0, 0.44, { collide: 'stone', bevel: 0.08 });
      b.arcWall(fabric, 0, 0, 9.65, 10.15, a0 + 0.005, a1 - 0.005, 0.44, 0.07, { bevel: 0.03 });
    }

    // ---- Bubble lamps -----------------------------------------------------------------------
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + 0.12;
      const [x, z] = polar(13.7, a);
      bubbleLamp(b, x, 5.4 + (i % 3) * 0.45, z, A.wallH, 0.32, lampGlow);
    }
    [
      [13.2, 3.05, 3.4],
      [13.9, 3.2, 3.0],
      [13.4, 3.28, 3.7],
      [14.2, 2.98, 3.9],
      [12.9, 1.14, 3.3],
    ].forEach(([r, a, y]) => {
      const [x, z] = polar(r, a);
      bubbleLamp(b, x, y, z, A.wallH, 0.2 + (y % 0.1), lampGlow);
    });

    // ---- Accent lights --------------------------------------------------------------------
    const poolLight = new THREE.PointLight(0x7fefff, 14, 13, 2);
    poolLight.position.set(0, 0.6, 0);
    const sphereLight = new THREE.PointLight(0xa8f4ff, 10, 10, 2);
    sphereLight.position.set(0, 4.9, 0);
    b.root.add(poolLight, sphereLight);
    this.lights.addLight(poolLight).addLight(sphereLight);
    this.lights.addUniform(causticStrength, 0.55, 0.3);
    ctx.addUpdatable(this.lights);

    // ---- Control panels -------------------------------------------------------------------
    const fountainPanel = new ControlPanel(
      {
        id: 'atrium-fountain',
        title: 'Fonte do Átrio',
        icon: 'fountain',
        x: -2.4,
        z: 8.7,
        rotY: 0,
        initial: true,
        promptOn: 'Desligar a fonte do átrio',
        promptOff: 'Ligar a fonte do átrio',
        onChange: (on) => {
          this.setFountain(on);
          fountainSound.setActive(on);
        },
      },
      b,
    );
    const lightPanel = new ControlPanel(
      {
        id: 'atrium-lights',
        title: 'Luzes do Átrio',
        icon: 'light',
        x: 2.4,
        z: 8.7,
        rotY: 0,
        initial: true,
        promptOn: 'Apagar a iluminação de destaque',
        promptOff: 'Acender a iluminação de destaque',
        stateOn: 'ACESAS',
        stateOff: 'APAGADAS',
        onChange: (on) => this.lights.setActive(on),
      },
      b,
    );
    for (const p of [fountainPanel, lightPanel]) {
      ctx.addInteractable(p);
      ctx.addUpdatable(p);
    }

    // ---- Carriable orbs on a display dish ------------------------------------------------
    b.cylinder(m.cobaltCeramic, -6.2, 0, 10.4, 0.62, 0.38, 0.5, { collide: 'stone', segments: 32 });
    b.torus(m.chrome, -6.2, 0.53, 10.4, 0.6, 0.04, { rotX: Math.PI / 2, cast: false });
    collision.addArc(-6.2, 10.4, 0.58, 0.66, 0, TAU, 0, 0.58, 14, 'metal');
    ctx.addBall('atrium-orb-cyan', 'a esfera ciano', m.glossyCyan, -6.45, 0.73, 10.4, 0.22);
    ctx.addBall('atrium-orb-green', 'a esfera verde', m.glossyGreen, -5.95, 0.73, 10.4, 0.22);
    ctx.addBall('atrium-orb-white', 'a esfera branca', m.whiteCeramic, 1.4, 0.22, 11.2, 0.22);

    b.flush('atrium');
  }

  /**
   * Bakes the atrium's local reflection probe once the whole world exists: the pool reflects
   * the real columns, walls and sphere, and the polished floors reflect the hall.
   */
  bakeReflections(renderer: THREE.WebGLRenderer, scene: THREE.Scene, water: WaterSystem): { dispose(): void } {
    const probe = water.bakeProbe(renderer, scene, new THREE.Vector3(0, 1.3, 0), 15.8, [this.pool], this.reflectionHide);
    for (const mat of this.floorMaterials) {
      mat.envMap = probe.env;
      mat.needsUpdate = true;
    }
    this.floorMaterials[0].envMapIntensity = 0.7;
    this.floorMaterials[1].envMapIntensity = 1.2;
    return probe;
  }

  private setFountain(on: boolean): void {
    this.fountainOn = on;
    for (const p of this.fountainParts) p.setActive(on);
  }

  get fountainActive(): boolean {
    return this.fountainOn;
  }

  update(dt: number, time: number): void {
    const s = this.heroSphere;
    s.position.y = 4.9 + Math.sin(time * 0.6) * 0.15;
    s.rotation.y += dt * 0.12;
    const ring = s.userData.ring as THREE.Mesh;
    ring.rotation.z += dt * 0.25;
    for (const o of this.orbiters) {
      const a = time * 0.45 + (o.userData.phase as number);
      const r = o.userData.radius as number;
      o.position.set(Math.cos(a) * r, Math.sin(a * 2) * 0.35, Math.sin(a) * r);
    }
    this.pool.sourceGain = this.fountain.intensity;
  }
}

/** Reception monitor: an early-2000s "Aero" welcome screen. */
function welcomeScreen(ctx: WorldContext): THREE.Texture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(512, 330, 'welcome');
  const g = c.createLinearGradient(0, 0, 0, 330);
  g.addColorStop(0, '#2a6fd6');
  g.addColorStop(0.55, '#28c5df');
  g.addColorStop(1, '#a8f0c0');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 330);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    c.arc(40 + i * 57, 270 - (i % 3) * 40, 14 + (i % 4) * 9, 0, TAU);
    c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(c, 40, 60, 432, 150, 24);
  c.fill();
  c.fillStyle = '#1747b5';
  c.font = '600 46px "Segoe UI", Arial, sans-serif';
  c.textAlign = 'center';
  c.fillText('Bem-vindo ao AQUA', 256, 128);
  c.fillStyle = '#087dae';
  c.font = '400 24px "Segoe UI", Arial, sans-serif';
  c.fillText('Água · Luz · Natureza · Amanhã', 256, 175);
  texture.needsUpdate = true;
  return texture;
}
