import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import { yawFacing } from '../systems/Seats';
import { LAYOUT } from './WorldLayout';
import { BubbleEmitter } from '../environment/ParticleSystem';
import { LightGroup } from '../environment/LightingSystem';
import { AquaticAssets, FishSchool, underwaterMaterials } from '../environment/AquaticLife';
import type { TankVolume } from '../environment/ShaderPatches';
import { NOISE_GLSL, sharedTime } from '../environment/ShaderPatches';
import { ControlPanel } from '../systems/Interactables';
import type { SoundHandle } from '../systems/AudioManager';
import type { Updatable } from '../core/types';
import { createRng, randRange } from '../core/math';

const TAU = Math.PI * 2;

/**
 * Zone C — Galeria Aquática. A glass observation corridor between two large tanks, ending in a
 * round hall with a floor-to-ceiling column aquarium. Underwater absorption, caustics, light
 * shafts, bubbles and fish schools are all simulated in shaders (no physical refraction).
 */
export class AquariumGallery implements Updatable {
  private readonly schools: FishSchool[] = [];
  private readonly lights: LightGroup;
  private readonly curtains: BubbleEmitter[] = [];
  private readonly curtainSounds: SoundHandle[] = [];
  private readonly assets = new AquaticAssets();
  private readonly surfaces: THREE.ShaderMaterial[] = [];

  constructor(ctx: WorldContext) {
    const { builder: b, mats: m, collision } = ctx;
    const G = LAYOUT.gallery;
    const H = G.ceiling;
    const hw = G.halfW;
    const tankX0 = 20;
    const tankX1 = 42;
    const tankTop = 4.6;
    const tankBack = hw + G.tankDepth; // 9.0

    this.lights = new LightGroup('gallery', true);
    const strip = m.emissiveCyan.clone();
    strip.name = 'galleryStrip';
    this.lights.addEmissive(strip, 0.04);
    const causticStrength = { value: 0.6 };
    this.lights.addUniform(causticStrength, 0.6, 0.12);
    const causticFloor = m.causticFloor(causticStrength);

    // ---- Corridor shell ---------------------------------------------------------------------
    b.box(causticFloor, (G.x0 + G.x1 + 0.3) / 2, -0.27, 0, G.x1 + 0.3 - G.x0, 0.3, hw * 2, { cast: false });
    for (const sz of [-1, 1]) {
      // solid end sections
      b.box(m.wallPanels, (G.x0 + tankX0) / 2, 0, sz * (hw + 0.2), tankX0 - G.x0, H, 0.4, { collide: 'tile' });
      b.box(m.wallPanels, (tankX1 + G.x1 + 0.1) / 2, 0, sz * (hw + 0.2), G.x1 + 0.1 - tankX1, H, 0.4, { collide: 'tile' });
      // glass + frames
      b.box(m.glassTank, (tankX0 + tankX1) / 2, 0, sz * (hw + 0.05), tankX1 - tankX0, H, 0.04, { cast: false, receive: false });
      collision.addBox({ x: (tankX0 + tankX1) / 2, z: sz * (hw + 0.05), sx: tankX1 - tankX0, sz: 0.12, minY: 0, maxY: H, surface: 'glass' });
      for (let x = tankX0; x <= tankX1 + 0.01; x += (tankX1 - tankX0) / 4) b.box(m.chrome, x, 0, sz * (hw + 0.05), 0.12, H, 0.12, { cast: false });
      b.box(m.chrome, (tankX0 + tankX1) / 2, 0, sz * (hw + 0.05), tankX1 - tankX0, 0.14, 0.14, { cast: false });
      b.box(m.chrome, (tankX0 + tankX1) / 2, H - 0.12, sz * (hw + 0.05), tankX1 - tankX0, 0.12, 0.14, { cast: false });
      // floor light line along the glass
      b.box(strip, (G.x0 + G.x1) / 2, 0.03, sz * (hw - 0.12), G.x1 - G.x0 - 0.4, 0.02, 0.06, { cast: false });
    }
    b.box(m.whiteMatte, (G.x0 + 43) / 2, H, 0, 43 - G.x0, 0.3, hw * 2 + 0.8, { radius: 0.05 });
    b.box(strip, (G.x0 + G.x1) / 2, H - 0.03, 0, G.x1 - G.x0 - 1, 0.04, 0.3, { cast: false });
    for (let x = G.x0 + 2; x < G.x1; x += 3) b.box(m.whiteCeramic, x, H - 0.25, 0, 0.18, 0.25, hw * 2, { radius: 0.06, cast: false });
    // tank building shell
    for (const sz of [-1, 1]) {
      b.box(m.whiteCeramic, (tankX0 + tankX1) / 2, 0, sz * (tankBack + 0.25), tankX1 - tankX0 + 0.8, tankTop + 0.4, 0.5, { collide: 'tile', radius: 0.08 });
      for (const x of [tankX0 - 0.2, tankX1 + 0.2]) {
        b.box(m.whiteCeramic, x, 0, sz * (hw + tankBack + 0.5) / 2, 0.4, tankTop + 0.4, tankBack - hw + 0.5, { collide: 'tile', radius: 0.06 });
      }
    }
    b.box(m.whiteCeramic, (tankX0 + tankX1) / 2, tankTop + 0.35, 0, tankX1 - tankX0 + 1.0, 0.3, (tankBack + 0.5) * 2, { radius: 0.1 });
    b.box(m.chrome, (tankX0 + tankX1) / 2, tankTop + 0.65, 0, tankX1 - tankX0 + 1.1, 0.06, (tankBack + 0.5) * 2 + 0.1, { cast: false });

    // ---- Tanks -----------------------------------------------------------------------------
    const waterColor = new THREE.Color(0x1f9fc4);
    const density = { value: 0.11 };
    const rng = createRng(404);
    for (const sz of [-1, 1]) {
      const zNear = sz * (hw + 0.05);
      const zFar = sz * tankBack;
      const volume: TankVolume = {
        shape: 0,
        min: new THREE.Vector3(tankX0, 0, Math.min(zNear, zFar)),
        max: new THREE.Vector3(tankX1, tankTop, Math.max(zNear, zFar)),
        center: new THREE.Vector2(),
        radius: 0,
      };
      const light = { value: 1 };
      this.lights.addUniform(light, 1, 0.4);
      const mats = underwaterMaterials(volume, waterColor, density, light);
      const sandTex = ctx.assets.sand();
      sandTex.repeat.set(0.25, 0.25);
      const sand = mats.make({ map: sandTex, roughness: 0.95 });
      sand.userData.worldUV = true;
      const back = mats.make({ map: ctx.assets.tankBackdrop(), roughness: 0.9 });
      const zc = (zNear + zFar) / 2;
      const depth = Math.abs(zFar - zNear);
      b.box(sand, (tankX0 + tankX1) / 2, 0, zc, tankX1 - tankX0, 0.32, depth, { cast: false });
      // dunes
      for (let i = 0; i < 6; i++) b.sphere(sand, randRange(rng, tankX0 + 1, tankX1 - 1), -0.5, zc + randRange(rng, -1, 1.5) * sz, randRange(rng, 1.0, 1.6), { cast: false });
      const backPlane = new THREE.PlaneGeometry(tankX1 - tankX0, tankTop);
      b.place(backPlane, back, (tankX0 + tankX1) / 2, tankTop / 2, zFar - sz * 0.01, { rotY: sz > 0 ? Math.PI : 0, cast: false });
      for (const x of [tankX0 + 0.01, tankX1 - 0.01]) {
        const side = new THREE.PlaneGeometry(depth, tankTop);
        b.place(side, back, x, tankTop / 2, zc, { rotY: x < 30 ? Math.PI / 2 : -Math.PI / 2, cast: false });
      }
      // rocks, corals, kelp
      for (let i = 0; i < 9; i++) {
        const x = randRange(rng, tankX0 + 0.8, tankX1 - 0.8);
        const z = zc + randRange(rng, -0.35, 0.4) * depth * sz;
        b.place(this.assets.rocks[i % 3], mats.rock, x, 0.3, z, { rotY: rng() * TAU, cast: false });
      }
      for (let i = 0; i < 10; i++) {
        const x = randRange(rng, tankX0 + 0.6, tankX1 - 0.6);
        const z = zc + randRange(rng, -0.3, 0.45) * depth * sz;
        b.place(this.assets.corals[i % 4], mats.coral, x, 0.3, z, { rotY: rng() * TAU, cast: false });
      }
      const kelpCount = 26;
      const kelp = new THREE.InstancedMesh(this.assets.kelp[sz > 0 ? 0 : 1], mats.kelp, kelpCount);
      const km = new THREE.Matrix4();
      for (let i = 0; i < kelpCount; i++) {
        const x = randRange(rng, tankX0 + 0.5, tankX1 - 0.5);
        const z = zc + randRange(rng, 0.0, 0.48) * depth * sz;
        km.compose(new THREE.Vector3(x, 0.3, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * TAU), new THREE.Vector3(1, randRange(rng, 0.7, 1.25), 1));
        kelp.setMatrixAt(i, km);
      }
      kelp.computeBoundingSphere();
      b.root.add(kelp);
      // surface seen from below + light shafts
      this.addSurfaceFromBelow(b.root, (tankX0 + tankX1) / 2, tankTop - 0.05, zc, tankX1 - tankX0, depth);
      const shaftSpecs = [];
      for (let i = 0; i < 5; i++) {
        const x = tankX0 + 2 + i * 4.4 + randRange(rng, -0.8, 0.8);
        shaftSpecs.push({ x, y: 0.2, z: zc + sz * 0.6, height: tankTop - 0.3, rTop: 0.35, rBottom: 1.1, rot: new THREE.Euler(sz * 0.18, 0, Math.PI + 0.12) });
      }
      const shafts = b.lightCones(shaftSpecs, 0xbff6ff, 0.16);
      this.lights.addUniform(shafts.opacity, 0.16, 0.02);
      // fish
      const school = new FishSchool(volume, 6, () => mats.make({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }), this.assets.fish, 900 + sz);
      b.root.add(school.group);
      this.schools.push(school);
      // air stones (always on) + bubble curtain (switchable)
      const stones = new BubbleEmitter({
        min: new THREE.Vector3(tankX0, 0.35, volume.min.z),
        max: new THREE.Vector3(tankX1, tankTop - 0.1, volume.max.z),
        count: 160,
        columns: [new THREE.Vector2(24, zc + sz), new THREE.Vector2(33, zc + sz * 1.5), new THREE.Vector2(39, zc)],
        columnRadius: 0.12,
        speed: 0.8,
        size: 0.05,
        seed: 70 + sz,
      });
      b.root.add(stones.points);
      ctx.addQuality(stones);
      ctx.addUpdatable(stones);
      const curtainCols: THREE.Vector2[] = [];
      for (let x = tankX0 + 0.6; x < tankX1 - 0.4; x += 0.45) curtainCols.push(new THREE.Vector2(x, zNear + sz * 0.45));
      const curtain = new BubbleEmitter({
        min: new THREE.Vector3(tankX0, 0.3, volume.min.z),
        max: new THREE.Vector3(tankX1, tankTop - 0.1, volume.max.z),
        count: 900,
        columns: curtainCols,
        columnRadius: 0.08,
        speed: 1.1,
        size: 0.045,
        wobble: 0.05,
        seed: 80 + sz,
      });
      b.root.add(curtain.points);
      this.curtains.push(curtain);
      ctx.addQuality(curtain);
      ctx.addUpdatable(curtain);
      this.curtainSounds.push(ctx.audio.addWaterSource('bubbles', { x: 31, y: 1, z: zNear + sz * 0.6 }, 0.8, true));
    }

    // ---- Round hall ---------------------------------------------------------------------------
    const RM = G.room;
    const rIn = RM.r;
    const rOut = rIn + 0.5;
    const RH = 5.5;
    b.ring(causticFloor, RM.x, 0.036, RM.z, 0, rIn + 0.1, 0.3, { cast: false });
    const westHalf = (hw + 0.1) / rIn;
    const northHalf = 1.8 / rIn;
    for (const [a0, a1] of [
      [0.6, Math.PI - westHalf],
      [Math.PI + westHalf, (3 * Math.PI) / 2 - northHalf],
      [(3 * Math.PI) / 2 + northHalf, TAU - 0.6],
    ] as Array<[number, number]>) {
      b.arcWall(m.wallPanels, RM.x, RM.z, rIn, rOut, a0, a1, 0, RH, { collide: 'tile' });
    }
    b.arcWall(m.wallPanels, RM.x, RM.z, rIn, rOut, Math.PI - westHalf - 0.02, Math.PI + westHalf + 0.02, H, RH - H);
    b.arcWall(m.wallPanels, RM.x, RM.z, rIn, rOut, (3 * Math.PI) / 2 - northHalf - 0.02, (3 * Math.PI) / 2 + northHalf + 0.02, 3.4, RH - 3.4);
    // east panoramic glass
    b.arcWall(m.glass, RM.x, RM.z, rIn + 0.2, rIn + 0.26, -0.6, 0.6, 0, RH, { bevel: 0, cast: false, receive: false });
    collision.addArc(RM.x, RM.z, rIn + 0.1, rIn + 0.4, -0.6, 0.6, 0, RH, 6, 'glass');
    for (let i = 0; i <= 6; i++) {
      const a = -0.6 + (1.2 * i) / 6;
      b.box(m.chrome, RM.x + Math.cos(a) * (rIn + 0.23), 0, RM.z + Math.sin(a) * (rIn + 0.23), 0.1, RH, 0.14, { rotY: -a, cast: false });
    }
    // roof ring + glass dome
    b.ring(m.whiteCeramic, RM.x, RH + 0.3, RM.z, 3.2, rOut + 0.4, 0.3);
    b.torus(m.chrome, RM.x, RH + 0.3, RM.z, rOut + 0.4, 0.06, { rotX: Math.PI / 2, cast: false });
    const dome = new THREE.SphereGeometry(3.25, 40, 16, 0, TAU, 0, Math.PI / 2);
    b.place(dome, m.glass, RM.x, RH + 0.3, RM.z, { cast: false, receive: false });
    b.torus(strip, RM.x, RH - 0.1, RM.z, rIn - 0.15, 0.04, { rotX: Math.PI / 2, cast: false });

    // Column aquarium
    const colR = 2.2;
    b.cylinder(m.whiteCeramic, RM.x, 0, RM.z, colR + 0.3, colR + 0.4, 0.45, { collide: 'stone', segments: 48 });
    b.torus(m.chrome, RM.x, 0.45, RM.z, colR + 0.1, 0.05, { rotX: Math.PI / 2, cast: false });
    b.cylinder(m.whiteCeramic, RM.x, RH - 0.35, RM.z, colR + 0.35, colR + 0.25, 0.35, { segments: 48 });
    b.cylinder(m.glassTank, RM.x, 0.45, RM.z, colR, colR, RH - 0.8, { open: true, segments: 64, cast: false, receive: false });
    collision.addCylinder({ x: RM.x, z: RM.z, r: colR + 0.12, minY: 0, maxY: RH, surface: 'glass' });
    const colVolume: TankVolume = {
      shape: 1,
      min: new THREE.Vector3(RM.x - colR, 0.45, RM.z - colR),
      max: new THREE.Vector3(RM.x + colR, RH - 0.35, RM.z + colR),
      center: new THREE.Vector2(RM.x, RM.z),
      radius: colR,
    };
    const colLight = { value: 1 };
    this.lights.addUniform(colLight, 1, 0.45);
    const cm = underwaterMaterials(colVolume, waterColor, { value: 0.16 }, colLight);
    const sandTex2 = ctx.assets.sand();
    const colSand = cm.make({ map: sandTex2, roughness: 0.95 });
    colSand.userData.worldUV = true;
    b.cylinder(colSand, RM.x, 0.45, RM.z, colR - 0.02, colR - 0.02, 0.15, { segments: 48, cast: false });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      b.place(this.assets.corals[i], cm.coral, RM.x + Math.cos(a) * 1.3, 0.6, RM.z + Math.sin(a) * 1.3, { rotY: a, cast: false });
    }
    b.place(this.assets.rocks[1], cm.rock, RM.x, 0.6, RM.z, { cast: false });
    const colKelp = new THREE.InstancedMesh(this.assets.kelp[0], cm.kelp, 10);
    const km = new THREE.Matrix4();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const r = randRange(rng, 1.2, 1.8);
      km.compose(new THREE.Vector3(RM.x + Math.cos(a) * r, 0.6, RM.z + Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, randRange(rng, 0.9, 1.3), 1));
      colKelp.setMatrixAt(i, km);
    }
    colKelp.computeBoundingSphere();
    b.root.add(colKelp);
    const colSchool = new FishSchool(colVolume, 4, () => cm.make({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }), this.assets.fish, 1200);
    b.root.add(colSchool.group);
    this.schools.push(colSchool);
    const colBubbles = new BubbleEmitter({
      min: new THREE.Vector3(RM.x, 0.6, RM.z),
      max: new THREE.Vector3(RM.x, RH - 0.5, RM.z),
      count: 220,
      columns: [new THREE.Vector2(RM.x, RM.z)],
      columnRadius: 0.2,
      speed: 0.9,
      size: 0.06,
      seed: 99,
    });
    b.root.add(colBubbles.points);
    ctx.addQuality(colBubbles);
    ctx.addUpdatable(colBubbles);
    this.addSurfaceFromBelow(b.root, RM.x, RH - 0.4, RM.z, colR * 2, colR * 2, true);
    const colShaft = b.lightCone(RM.x, 0.5, RM.z, RH - 0.9, 0.6, 1.8, 0xbff6ff, 0.12, new THREE.Euler(0, 0, Math.PI));
    this.lights.addUniform(colShaft.opacity, 0.12, 0.02);

    // Benches facing the column
    for (const [a0, a1] of [
      [1.55, 2.1],
      [3.75, 4.25],
      [0.25, 0.55],
    ] as Array<[number, number]>) {
      b.arcWall(m.whiteCeramic, RM.x, RM.z, 4.3, 4.8, a0, a1, 0, 0.44, { collide: 'stone', bevel: 0.07 });
      b.arcWall(m.cushion, RM.x, RM.z, 4.35, 4.75, a0 + 0.01, a1 - 0.01, 0.44, 0.06, { bevel: 0.03 });
      const n = Math.max(1, Math.floor(((a1 - a0) * 4.55) / 0.7));
      for (let k = 0; k < n; k++) {
        const a = a0 + ((a1 - a0) * (k + 0.5)) / n;
        ctx.addSeat({ id: `gallery-bench-${a.toFixed(2)}`, x: RM.x + Math.cos(a) * 4.55, y: 0.5, z: RM.z + Math.sin(a) * 4.55, yaw: yawFacing(-Math.cos(a), -Math.sin(a)) });
      }
    }

    // ---- Lights --------------------------------------------------------------------------
    for (const x of [24, 31, 38]) {
      const l = new THREE.PointLight(0x6fe6ff, 9, 9, 2);
      l.position.set(x, 3.2, 0);
      b.root.add(l);
      this.lights.addLight(l);
    }
    const roomLight = new THREE.PointLight(0x8ff0ff, 14, 12, 2);
    roomLight.position.set(RM.x, 3.6, RM.z);
    b.root.add(roomLight);
    this.lights.addLight(roomLight);
    ctx.addUpdatable(this.lights);

    // ---- Panels ----------------------------------------------------------------------------
    const pAngle = 2.45;
    const lightPanel = new ControlPanel(
      {
        id: 'gallery-lights',
        title: 'Luzes da Galeria',
        icon: 'light',
        x: RM.x + Math.cos(pAngle) * 5.4,
        z: RM.z + Math.sin(pAngle) * 5.4,
        rotY: Math.atan2(-Math.cos(pAngle), -Math.sin(pAngle)),
        initial: true,
        promptOn: 'Apagar a iluminação turquesa',
        promptOff: 'Acender a iluminação turquesa',
        stateOn: 'ACESAS',
        stateOff: 'APAGADAS',
        onChange: (on) => this.lights.setActive(on),
      },
      b,
    );
    const bAngle = 0.95;
    const bubblePanel = new ControlPanel(
      {
        id: 'gallery-bubbles',
        title: 'Cortina de Bolhas',
        icon: 'bubbles',
        x: RM.x + Math.cos(bAngle) * 5.4,
        z: RM.z + Math.sin(bAngle) * 5.4,
        rotY: Math.atan2(-Math.cos(bAngle), -Math.sin(bAngle)),
        initial: true,
        promptOn: 'Desligar a cortina de bolhas dos tanques',
        promptOff: 'Ligar a cortina de bolhas dos tanques',
        onChange: (on) => {
          for (const c of this.curtains) c.setActive(on);
          for (const s of this.curtainSounds) s.setActive(on);
        },
      },
      b,
    );
    for (const p of [lightPanel, bubblePanel]) {
      ctx.addInteractable(p);
      ctx.addUpdatable(p);
    }

    // ---- Ambience & signage -----------------------------------------------------------------
    ctx.audio.addWaterSource('hum', { x: 31, y: 2, z: 0 }, 0.9, true);
    ctx.audio.addWaterSource('hum', { x: RM.x, y: 2, z: RM.z }, 0.8, true);
    ctx.audio.addWaterSource('bubbles', { x: RM.x, y: 1.5, z: RM.z }, 0.7, true);
    b.sign('Saída · Esplanada', '↑', RM.x + 2.4, RM.z - 5.6, 0);
    b.sign('Átrio Azul', '↑', 41.6, 1.6, Math.PI / 2, 2.4);

    b.flush('gallery');
  }

  private addSurfaceFromBelow(root: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, round = false): void {
    const material = new THREE.ShaderMaterial({
      name: 'SurfaceFromBelow',
      uniforms: { uTime: sharedTime },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld;
        ${NOISE_GLSL}
        void main() {
          float c = aquaCaustic(vWorld.xz * 0.8, uTime * 1.3);
          float n = aquaNoise(vWorld.xz * 1.5 + uTime * 0.3);
          vec3 col = mix(vec3(0.16, 0.62, 0.78), vec3(0.85, 0.98, 1.0), clamp(c * 0.8 + n * 0.25, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
    });
    this.surfaces.push(material);
    const geo = round ? new THREE.CircleGeometry(w / 2, 48) : new THREE.PlaneGeometry(w, d);
    const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    root.add(mesh);
  }

  update(dt: number, time: number): void {
    for (const s of this.schools) s.update(dt, time);
  }
}
