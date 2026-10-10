import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { LAYOUT } from './WorldLayout';
import { FountainEmitter, WaterStream } from '../environment/ParticleSystem';
import { WATER_LOOKS } from '../environment/WaterSystem';
import { LightGroup } from '../environment/LightingSystem';
import { ControlPanel } from '../systems/Interactables';
import type { Updatable } from '../core/types';

const TAU = Math.PI * 2;

/**
 * Zone A — Átrio Azul. Circular white hall with a glass oculus roof, shallow reflecting pool,
 * fountain, floating glass sphere, tropical planters, control panels and carriable orbs.
 */
export class Atrium implements Updatable {
  private readonly heroSphere: THREE.Group;
  private readonly orbiters: THREE.Object3D[] = [];
  private readonly fountainParts: Array<FountainEmitter | WaterStream> = [];
  private readonly lights: LightGroup;
  private fountainOn = true;

  constructor(ctx: WorldContext) {
    const { builder: b, mats: m, collision } = ctx;
    const A = LAYOUT.atrium;
    const rOut = A.rIn + A.wallT;

    // ---- Floor ---------------------------------------------------------------------------
    b.ring(m.floorTile, 0, 0.03, 0, A.rimR + 0.9, A.rIn + 0.05, 0.3);
    b.ring(m.wetTile, 0, 0.03, 0, A.rimR - 0.05, A.rimR + 0.9, 0.3);
    // thresholds in the three openings
    b.box(m.floorTile, 0, -0.27, -(A.rIn + 0.35), 6.2, 0.3, 1.2);
    b.box(m.floorTile, 0, -0.27, A.rIn + 0.35, 6.2, 0.3, 1.2);
    b.box(m.floorTile, A.rIn + 0.35, -0.27, 0, 1.2, 0.3, 5.4);

    // ---- Curved walls with three portals + glass curtain on the west side ---------------
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
    for (const [a0, a1] of solids) b.arcWall(m.wallPanels, 0, 0, A.rIn, rOut, a0, a1, 0, A.wallH, { collide: 'tile' });
    // lintels over the portals
    for (const [c, h] of [
      [-Math.PI / 2, halfN],
      [Math.PI / 2, halfN],
      [0, halfE],
    ] as Array<[number, number]>) {
      b.arcWall(m.wallPanels, 0, 0, A.rIn, rOut, c - h - 0.02, c + h + 0.02, 4.4, A.wallH - 4.4);
      b.arcWall(m.chrome, 0, 0, A.rIn - 0.05, rOut + 0.05, c - h, c + h, 4.3, 0.12, { bevel: 0.02, cast: false });
    }
    // glass curtain wall with chrome mullions
    b.arcWall(m.glass, 0, 0, A.rIn + 0.25, A.rIn + 0.32, glassA0, glassA1, 0, A.wallH, { bevel: 0, cast: false, receive: false });
    collision.addArc(0, 0, A.rIn + 0.15, A.rIn + 0.4, glassA0, glassA1, 0, A.wallH, 12, 'glass');
    const mullions = 9;
    for (let i = 0; i <= mullions; i++) {
      const a = glassA0 + ((glassA1 - glassA0) * i) / mullions;
      const r = A.rIn + 0.28;
      b.box(m.chrome, Math.cos(a) * r, 0, Math.sin(a) * r, 0.12, A.wallH, 0.16, { rotY: -a, cast: true });
    }
    for (const y of [0, 2.9, 5.8]) b.arcWall(m.chrome, 0, 0, A.rIn + 0.2, A.rIn + 0.38, glassA0, glassA1, y, 0.1, { bevel: 0.02, cast: false });
    // chrome cornice ring
    b.torus(m.chrome, 0, A.wallH + 0.02, 0, rOut + 0.6, 0.08, { rotX: Math.PI / 2, cast: false });

    // ---- Roof: white ring + glass ring + open oculus -----------------------------------
    b.ring(m.whiteCeramic, 0, A.wallH + 0.55, 0, 11, rOut + 0.6, 0.55);
    b.ring(m.glass, 0, A.wallH + 0.35, 0, 7, 11, 0.06, { cast: false, receive: false });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      b.box(m.whiteCeramic, Math.cos(a) * 9, A.wallH + 0.15, Math.sin(a) * 9, 4.2, 0.28, 0.22, { rotY: -a, radius: 0.08 });
    }
    b.torus(m.whiteCeramic, 0, A.wallH + 0.3, 0, 7, 0.32, { rotX: Math.PI / 2 });
    b.torus(m.chrome, 0, A.wallH + 0.3, 0, 6.68, 0.06, { rotX: Math.PI / 2, cast: false });

    // ---- Columns ---------------------------------------------------------------------------
    this.lights = new LightGroup('atrium', true);
    const accent = m.emissiveCyan.clone();
    accent.name = 'atriumAccent';
    this.lights.addEmissive(accent, 0.03);
    const coneSpecs: Array<{ x: number; y: number; z: number; height: number; rTop: number; rBottom: number }> = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * TAU) / 8;
      const x = Math.cos(a) * 11;
      const z = Math.sin(a) * 11;
      b.cylinder(m.whiteCeramic, x, 0, z, 0.32, 0.36, A.wallH, { collide: 'stone', segments: 28 });
      b.torus(m.chrome, x, 0.35, z, 0.38, 0.05, { rotX: Math.PI / 2, cast: false });
      b.torus(m.chrome, x, A.wallH - 0.4, z, 0.36, 0.05, { rotX: Math.PI / 2, cast: false });
      b.cylinder(accent, x, 0.02, z, 0.5, 0.5, 0.03, { cast: false, segments: 28 });
      coneSpecs.push({ x, y: 0.05, z, height: 6.5, rTop: 1.0, rBottom: 0.42 });
    }
    const cones = b.lightCones(coneSpecs, 0x7ff0ff, 0.14);
    this.lights.addUniform(cones.opacity, 0.14, 0);

    // ---- Central pool -----------------------------------------------------------------
    collision.terrain.addCircleBasin(0, 0, A.poolR, A.poolFloor);
    const causticStrength = { value: 0.55 };
    const tile = m.poolTileAt(A.waterY, causticStrength, 'atrium');
    tile.side = THREE.DoubleSide;
    b.ring(tile, 0, A.poolFloor, 0, 0, A.poolR, 0.2);
    b.cylinder(tile, 0, A.poolFloor - 0.01, 0, A.poolR, A.poolR, 0.47, { open: true, segments: 72, cast: false });
    b.ring(m.whiteCeramic, 0, 0.3, 0, A.poolR, A.rimR, 0.32);
    b.torus(m.whiteCeramic, 0, 0.3, 0, A.rimR - 0.02, 0.06, { rotX: Math.PI / 2, cast: false });
    b.torus(m.chrome, 0, 0.29, 0, A.poolR + 0.02, 0.04, { rotX: Math.PI / 2, cast: false });
    b.torus(accent, 0, 0.035, 0, A.rimR + 0.18, 0.035, { rotX: Math.PI / 2, cast: false });
    collision.addArc(0, 0, A.poolR, A.rimR, 0, TAU, A.poolFloor, 0.3, 28, 'stone');
    ctx.water.add({ name: 'atriumPool', shape: { kind: 'circle', x: 0, z: 0, r: A.poolR }, surfaceY: A.waterY, look: WATER_LOOKS.pool, segments: 36 });

    // Fountain pedestal and jets
    b.cylinder(m.whiteCeramic, 0, A.poolFloor, 0, 0.75, 0.95, 0.62, { collide: 'stone', segments: 40 });
    b.torus(m.chrome, 0, 0.47, 0, 0.72, 0.05, { rotX: Math.PI / 2, cast: false });
    b.sphere(m.chrome, 0, 0.47, 0, 0.16, { cast: false });
    const jets: Array<{ origin: THREE.Vector3; velocity: THREE.Vector3; spread: number; count: number }> = [];
    jets.push({ origin: new THREE.Vector3(0, 0.55, 0), velocity: new THREE.Vector3(0, 6.6, 0), spread: 0.55, count: 700 });
    const ring = 8;
    const arcPaths: THREE.Vector3[][] = [];
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
      // landing splashes
      const land = pts[pts.length - 1];
      for (let s = 0; s < 3; s++) {
        const ang = Math.random() * TAU;
        jets.push({ origin: land.clone().setY(A.waterY + 0.02), velocity: new THREE.Vector3(Math.cos(ang) * 0.5, 1.5, Math.sin(ang) * 0.5), spread: 0.9, count: 14 });
      }
    }
    for (let s = 0; s < 10; s++) {
      const ang = (s / 10) * TAU;
      jets.push({ origin: new THREE.Vector3(Math.cos(ang) * 0.9, A.waterY + 0.02, Math.sin(ang) * 0.9), velocity: new THREE.Vector3(Math.cos(ang) * 0.7, 1.6, Math.sin(ang) * 0.7), spread: 0.8, count: 24 });
    }
    const arcs = WaterStream.tubes(arcPaths, 0.03, { speed: 2.4, opacity: 0.7, travelTime: 0.45 });
    b.root.add(arcs.mesh);
    this.fountainParts.push(arcs);
    const fountain = new FountainEmitter(jets, { floorY: A.waterY - 0.02, life: 1.45, size: 0.085, seed: 21 });
    b.root.add(fountain.points);
    this.fountainParts.push(fountain);
    const column = WaterStream.tube([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 2.6, 0)], 0.055, { speed: -3, opacity: 0.55, travelTime: 0.3 });
    b.root.add(column.mesh);
    this.fountainParts.push(column);
    for (const p of this.fountainParts) ctx.addUpdatable(p);
    ctx.addQuality(fountain);
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
      attenuationColor: new THREE.Color(0x7fe3f2),
      attenuationDistance: 3,
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
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.035, 12, 120), m.chrome);
    ringMesh.rotation.x = Math.PI / 2.4;
    this.heroSphere.add(shell, core, ringMesh);
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), [m.glossyCyan, m.glossyGreen, m.whiteCeramic][i]);
      orb.userData.phase = (i / 3) * TAU;
      orb.userData.radius = 2.05;
      this.heroSphere.add(orb);
      this.orbiters.push(orb);
    }
    this.heroSphere.userData.ring = ringMesh;
    b.root.add(this.heroSphere);

    // ---- Planters with tropical plants ------------------------------------------------
    for (const deg of [45, 135, 225, 315]) {
      const a = THREE.MathUtils.degToRad(deg);
      const span = 0.24;
      b.arcWall(m.whiteCeramic, 0, 0, 13.3, 15.6, a - span, a + span, 0, 0.62, { collide: 'stone', bevel: 0.08 });
      b.ring(m.soil, 0, 0.6, 0, 13.45, 15.45, 0.05, { a0: a - span + 0.01, a1: a + span - 0.01 });
      const cx = Math.cos(a) * 14.45;
      const cz = Math.sin(a) * 14.45;
      ctx.veg.palm(cx, 0.58, cz, 0.95);
      for (const off of [-0.17, 0.17]) {
        const pa = a + off;
        ctx.veg.monstera(Math.cos(pa) * 14.3, 0.58, Math.sin(pa) * 14.3, 1.1);
        ctx.veg.fern(Math.cos(pa + off * 0.4) * 15.0, 0.58, Math.sin(pa + off * 0.4) * 15.0, 0.9);
      }
      ctx.veg.fern(Math.cos(a) * 13.8, 0.58, Math.sin(a) * 13.8, 0.8);
    }
    // ferns softening the pool rim
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      if (Math.abs(Math.sin(a)) > 0.9) continue;
      b.cylinder(m.whiteCeramic, Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6, 0.55, 0.45, 0.5, { collide: 'stone', segments: 28 });
      ctx.veg.fern(Math.cos(a) * 8.6, 0.48, Math.sin(a) * 8.6, 0.85);
    }

    // ---- Curved benches ----------------------------------------------------------------
    for (const [a0, a1] of [
      [3.05, 3.35],
      [-0.5, -0.2],
      [0.2, 0.5],
    ] as Array<[number, number]>) {
      b.arcWall(m.whiteCeramic, 0, 0, 9.6, 10.2, a0, a1, 0, 0.44, { collide: 'stone', bevel: 0.08 });
      b.arcWall(m.cushion, 0, 0, 9.65, 10.15, a0 + 0.005, a1 - 0.005, 0.44, 0.06, { bevel: 0.03 });
    }

    // ---- Accent light ------------------------------------------------------------------
    const poolLight = new THREE.PointLight(0x7fefff, 14, 13, 2);
    poolLight.position.set(0, 0.6, 0);
    const sphereLight = new THREE.PointLight(0xa8f4ff, 10, 10, 2);
    sphereLight.position.set(0, 4.9, 0);
    b.root.add(poolLight, sphereLight);
    this.lights.addLight(poolLight).addLight(sphereLight);
    this.lights.addUniform(causticStrength, 0.55, 0.3);
    ctx.addUpdatable(this.lights);

    // ---- Control panels ------------------------------------------------------------------
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
    b.cylinder(m.whiteCeramic, -6.2, 0, 10.4, 0.62, 0.38, 0.5, { collide: 'stone', segments: 32 });
    b.torus(m.chrome, -6.2, 0.53, 10.4, 0.6, 0.04, { rotX: Math.PI / 2, cast: false });
    collision.addArc(-6.2, 10.4, 0.58, 0.66, 0, TAU, 0, 0.58, 14, 'metal');
    ctx.addBall('atrium-orb-cyan', 'a esfera ciano', m.glossyCyan, -6.45, 0.73, 10.4, 0.22);
    ctx.addBall('atrium-orb-green', 'a esfera verde', m.glossyGreen, -5.95, 0.73, 10.4, 0.22);
    ctx.addBall('atrium-orb-white', 'a esfera branca', m.whiteCeramic, 3.6, 0.22, 11.8, 0.22);

    // ---- Signage -----------------------------------------------------------------------
    b.sign('Jardins Hidráulicos', '↑', 3.9, -14.4, 0);
    b.sign('Galeria Aquática', '↑', 14.1, 3.9, -Math.PI / 2);
    b.sign('Esplanada', '↑', -3.9, 14.4, Math.PI);

    b.flush('atrium');
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
  }
}
