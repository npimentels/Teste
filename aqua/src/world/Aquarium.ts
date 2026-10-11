import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import type { TankVolume } from '../environment/ShaderPatches';
import { NOISE_GLSL, sharedTime } from '../environment/ShaderPatches';
import { AquaticAssets, FishSchool, underwaterMaterials } from '../environment/AquaticLife';
import { BubbleEmitter } from '../environment/ParticleSystem';
import { UseSpot } from '../systems/Interactables';
import type { Updatable } from '../core/types';
import { createRng, randRange } from '../core/math';

/**
 * Reusable aquarium: box tanks (wall-embedded, panoramic, tabletop, niches) and cylinder
 * columns. Static parts (frame, sand, rocks, corals) are batched; everything that moves (fish,
 * kelp, bubbles, the caustic surface) lives in one group that is only drawn and updated while
 * the viewer is near — far tanks cost a few static draw calls and no CPU.
 */

export interface AquariumSpec {
  id: string;
  kind: 'box' | 'cylinder';
  /** Centre of the tank footprint. */
  x: number;
  z: number;
  /** Bottom of the water (top of the cabinet / floor). */
  y0: number;
  height: number;
  /** Box: size along X and Z. */
  w?: number;
  d?: number;
  /** Cylinder radius. */
  r?: number;
  /** Which box faces are glass ('front' faces +z/−z… only those get no backdrop). */
  backdrop?: Array<'+x' | '-x' | '+z' | '-z'>;
  frame?: THREE.Material;
  /** Cabinet below the tank (freestanding tanks). */
  cabinet?: boolean;
  /** Lid / crown above the water. */
  crown?: boolean;
  fishPerSpecies?: number;
  species?: number[];
  fishScale?: number;
  kelp?: number;
  corals?: number;
  rocks?: number;
  bubbles?: number;
  waterColor?: THREE.ColorRepresentation;
  /** Information card shown when observing. */
  info?: { title: string; html: string };
  /** Distance under which the living parts are drawn / animated. */
  lod?: number;
  seed?: number;
  collide?: boolean;
}

let shared: AquaticAssets | null = null;
function assets(): AquaticAssets {
  return (shared ??= new AquaticAssets());
}

export function disposeAquariumAssets(): void {
  shared?.dispose();
  shared = null;
}

const surfaceMaterial = (() => {
  let m: THREE.ShaderMaterial | null = null;
  return () =>
    (m ??= new THREE.ShaderMaterial({
      name: 'TankSurface',
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
          float c = aquaCaustic(vWorld.xz * 1.6, uTime * 1.3);
          float n = aquaNoise(vWorld.xz * 2.5 + uTime * 0.3);
          vec3 col = mix(vec3(0.16, 0.62, 0.78), vec3(0.85, 0.98, 1.0), clamp(c * 0.8 + n * 0.25, 0.0, 1.0));
          gl_FragColor = vec4(col, 0.92);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
      transparent: true,
    }));
})();

export class Aquarium implements Updatable {
  readonly group = new THREE.Group();
  readonly volume: TankVolume;
  private readonly school: FishSchool | null;
  private readonly emitters: BubbleEmitter[] = [];
  private readonly center: THREE.Vector3;
  private live = false;
  private readonly lod: number;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    readonly spec: AquariumSpec,
  ) {
    const m = b.mats;
    const rng = createRng(spec.seed ?? spec.id.length * 97 + Math.round(spec.x * 13 + spec.z * 7));
    const A = assets();
    const H = spec.height;
    const y0 = spec.y0;
    const cyl = spec.kind === 'cylinder';
    const r = spec.r ?? 1;
    const w = spec.w ?? 2;
    const d = spec.d ?? 1;
    this.lod = spec.lod ?? 28;
    this.center = new THREE.Vector3(spec.x, y0 + H / 2, spec.z);
    this.volume = cyl
      ? { shape: 1, min: new THREE.Vector3(spec.x - r, y0, spec.z - r), max: new THREE.Vector3(spec.x + r, y0 + H, spec.z + r), center: new THREE.Vector2(spec.x, spec.z), radius: r }
      : { shape: 0, min: new THREE.Vector3(spec.x - w / 2, y0, spec.z - d / 2), max: new THREE.Vector3(spec.x + w / 2, y0 + H, spec.z + d / 2), center: new THREE.Vector2(), radius: 0 };
    const waterColor = new THREE.Color(spec.waterColor ?? 0x1f9fc4);
    const light = { value: 1 };
    const mats = underwaterMaterials(this.volume, waterColor, { value: cyl ? 0.16 : 0.13 }, light);
    const frame = spec.frame ?? m.whiteCeramic;

    // ---- Shell: cabinet, crown, glass, backdrop -----------------------------------------
    if (cyl) {
      if (spec.cabinet !== false) b.cylinder(frame, spec.x, y0 - 0.45, spec.z, r + 0.18, r + 0.26, 0.45, { segments: 48 });
      b.torus(m.chrome, spec.x, y0, spec.z, r + 0.06, 0.035, { rotX: Math.PI / 2, cast: false });
      if (spec.crown !== false) {
        b.cylinder(frame, spec.x, y0 + H, spec.z, r + 0.2, r + 0.14, 0.3, { segments: 48 });
        b.torus(m.emissiveCyan, spec.x, y0 + H + 0.02, spec.z, r + 0.16, 0.02, { rotX: Math.PI / 2, cast: false });
      }
      b.cylinder(m.glassTank, spec.x, y0, spec.z, r, r, H, { open: true, segments: 64, cast: false, receive: false });
      if (spec.collide !== false) b.collision.addCylinder({ x: spec.x, z: spec.z, r: r + 0.2, minY: y0 - 0.5, maxY: y0 + H + 0.3, surface: 'glass' });
    } else {
      if (spec.cabinet) {
        b.box(frame, spec.x, y0 - 0.75, spec.z, w + 0.12, 0.75, d + 0.12, { radius: 0.05 });
        b.box(m.emissiveCyan, spec.x, y0 - 0.04, spec.z, w + 0.13, 0.025, d + 0.13, { cast: false, receive: false });
      }
      if (spec.crown !== false) {
        b.box(frame, spec.x, y0 + H, spec.z, w + 0.14, 0.16, d + 0.14, { radius: 0.04 });
        b.box(m.emissiveCyan, spec.x, y0 + H - 0.02, spec.z, w + 0.02, 0.02, d + 0.02, { cast: false, receive: false });
      }
      // glass box (faces with a backdrop are painted instead)
      const back = new Set(spec.backdrop ?? []);
      const backMat = mats.make({ map: this.ctx.assets.tankBackdrop(), roughness: 0.9 });
      const faces: Array<['+x' | '-x' | '+z' | '-z', number, number, number, number]> = [
        ['+z', spec.x, spec.z + d / 2, w, 0],
        ['-z', spec.x, spec.z - d / 2, w, Math.PI],
        ['+x', spec.x + w / 2, spec.z, d, Math.PI / 2],
        ['-x', spec.x - w / 2, spec.z, d, -Math.PI / 2],
      ];
      for (const [face, fx, fz, len, rot] of faces) {
        if (back.has(face)) {
          const p = new THREE.PlaneGeometry(len, H);
          b.place(p, backMat, fx, y0 + H / 2, fz, { rotY: rot + Math.PI, cast: false });
          p.dispose();
        } else {
          b.box(m.glassTank, fx, y0, fz, face[1] === 'x' ? 0.02 : len, H, face[1] === 'x' ? len : 0.02, { cast: false, receive: false });
        }
      }
      // chrome corner posts
      for (const [ex, ez] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) b.box(m.chrome, spec.x + (ex * w) / 2, y0, spec.z + (ez * d) / 2, 0.035, H, 0.035, { cast: false });
      if (spec.collide !== false) b.collision.addBox({ x: spec.x, z: spec.z, sx: w + 0.14, sz: d + 0.14, minY: spec.cabinet ? y0 - 0.75 : y0, maxY: y0 + H + 0.16, surface: 'glass' });
    }

    // ---- Interior: sand, rocks, corals -------------------------------------------------------
    const sandTex = this.ctx.assets.sand();
    const sand = mats.make({ map: sandTex, roughness: 0.95 });
    sand.userData.worldUV = true;
    if (cyl) b.cylinder(sand, spec.x, y0, spec.z, r - 0.02, r - 0.02, 0.12, { segments: 40, cast: false });
    else b.box(sand, spec.x, y0, spec.z, w - 0.03, 0.12, d - 0.03, { cast: false });
    const inner = (pad: number): [number, number] => {
      if (cyl) {
        const a = rng() * Math.PI * 2;
        const rr = Math.sqrt(rng()) * Math.max(0.05, r - pad);
        return [spec.x + Math.cos(a) * rr, spec.z + Math.sin(a) * rr];
      }
      return [spec.x + randRange(rng, -1, 1) * Math.max(0.02, w / 2 - pad), spec.z + randRange(rng, -1, 1) * Math.max(0.02, d / 2 - pad)];
    };
    const small = Math.min(cyl ? r * 2 : Math.min(w, d), H) < 1.2;
    const decoScale = small ? 0.45 : 1;
    for (let i = 0; i < (spec.rocks ?? (small ? 2 : 4)); i++) {
      const [x, z] = inner(0.35 * decoScale);
      const g = A.rocks[i % 3].clone().scale(decoScale, decoScale, decoScale);
      b.place(g, mats.rock, x, y0 + 0.1, z, { rotY: rng() * 6.28, cast: false });
      g.dispose();
    }
    for (let i = 0; i < (spec.corals ?? (small ? 2 : 5)); i++) {
      const [x, z] = inner(0.3 * decoScale);
      const g = A.corals[i % 4].clone().scale(decoScale, decoScale, decoScale);
      b.place(g, mats.coral, x, y0 + 0.1, z, { rotY: rng() * 6.28, cast: false });
      g.dispose();
    }

    // ---- Living parts (LOD group) ------------------------------------------------------------
    const kelpCount = spec.kelp ?? (small ? 4 : 12);
    if (kelpCount > 0) {
      const kelp = new THREE.InstancedMesh(A.kelp[rng() < 0.5 ? 0 : 1], mats.kelp, kelpCount);
      const km = new THREE.Matrix4();
      const kq = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < kelpCount; i++) {
        const [x, z] = inner(0.2);
        const sy = Math.min(randRange(rng, 0.6, 1.2), (H - 0.3) / 2.6);
        km.compose(new THREE.Vector3(x, y0 + 0.1, z), kq.setFromAxisAngle(up, rng() * 6.28), new THREE.Vector3(decoScale, sy, decoScale));
        kelp.setMatrixAt(i, km);
      }
      kelp.computeBoundingSphere();
      this.group.add(kelp);
    }
    const species = spec.species ?? [0, 1, 2, 3, 4];
    const per = spec.fishPerSpecies ?? (small ? 2 : 4);
    if (per > 0) {
      this.school = new FishSchool(this.volume, per, () => mats.make({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }), species.map((i) => A.fish[i]), (spec.seed ?? 7) + 300, spec.fishScale ?? (small ? 0.45 : 1));
      this.group.add(this.school.group);
    } else this.school = null;
    const bubbles = spec.bubbles ?? (small ? 40 : 120);
    if (bubbles > 0) {
      const [bx, bz] = cyl ? [spec.x, spec.z] : [spec.x + w * 0.3, spec.z];
      const e = new BubbleEmitter({
        min: new THREE.Vector3(this.volume.min.x + 0.05, y0 + 0.15, this.volume.min.z + 0.05),
        max: new THREE.Vector3(this.volume.max.x - 0.05, y0 + H - 0.08, this.volume.max.z - 0.05),
        count: bubbles,
        columns: [new THREE.Vector2(bx, bz)],
        columnRadius: small ? 0.04 : 0.12,
        speed: 0.8,
        size: small ? 0.03 : 0.05,
        seed: (spec.seed ?? 3) + 11,
      });
      this.group.add(e.points);
      this.emitters.push(e);
      ctx.addQuality(e);
    }
    const surf = new THREE.Mesh(cyl ? new THREE.CircleGeometry(r - 0.01, 40) : new THREE.PlaneGeometry(w - 0.02, d - 0.02), surfaceMaterial());
    surf.rotation.x = Math.PI / 2;
    surf.position.set(spec.x, y0 + H - 0.06, spec.z);
    this.group.add(surf);
    // faint blue water body so the tank reads as full of water from any side
    const tint = new THREE.Mesh(
      cyl ? new THREE.CylinderGeometry(r - 0.015, r - 0.015, H - 0.07, 40, 1, true) : new THREE.BoxGeometry(w - 0.02, H - 0.07, d - 0.02),
      new THREE.MeshBasicMaterial({ color: waterColor, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false }),
    );
    tint.position.set(spec.x, y0 + (H - 0.07) / 2, spec.z);
    tint.renderOrder = 2;
    b.root.add(tint);
    b.root.add(this.group);
    this.group.visible = false;

    if (spec.info) {
      const info = spec.info;
      // the aim box must reach past the tank's own glass collider (r + 0.2 / ±0.07), or the glass would block it
      const half = cyl ? new THREE.Vector3(r + 0.26, H / 2, r + 0.26) : new THREE.Vector3(w / 2 + 0.1, H / 2, d / 2 + 0.1);
      ctx.addInteractable(new UseSpot(`aquarium-${spec.id}`, this.center, half, 0, () => 'Observar aquário', () => ctx.showCard(`<b>${info.title}</b><br>${info.html}`, 9), 3.4));
    }
    ctx.addUpdatable(this);
  }

  update(dt: number, time: number): void {
    const v = this.ctx.viewer;
    const near = v.distanceTo(this.center) < this.lod;
    if (near !== this.live) {
      this.live = near;
      this.group.visible = near;
    }
    if (!near) return;
    this.school?.update(dt, time);
    for (const e of this.emitters) e.update(dt);
  }
}
