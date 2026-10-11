import * as THREE from 'three';
import type { WorldBuilder } from './Builders';
import type { Updatable } from '../core/types';
import { damp } from '../core/math';

/**
 * Architectural lighting kit. No lamp creates a dynamic light: glowing parts are emissive
 * materials (one material per switchable group, so every bulb of a group merges into a single
 * batched mesh) plus soft additive "light pools" painted on the surfaces they would light.
 * A `LampGroup` fades all of them together when toggled.
 */

let poolTexture: THREE.CanvasTexture | null = null;

function radialTexture(): THREE.CanvasTexture {
  if (poolTexture) return poolTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  poolTexture = new THREE.CanvasTexture(c);
  return poolTexture;
}

export function disposeLampCache(): void {
  poolTexture?.dispose();
  poolTexture = null;
}

/** White glowing material (frosted shade with a warm or cool emissive core). */
export function glowMaterial(name: string, color: THREE.ColorRepresentation = 0xfff1d6, intensity = 1.4): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    name,
    color: 0xffffff,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.35,
    transmission: 0,
    clearcoat: 0.6,
  });
}

export class LampGroup implements Updatable {
  on: boolean;
  private level: number;
  private readonly mats: Array<{ m: THREE.MeshStandardMaterial; base: number }> = [];
  private readonly pools: Array<{ m: THREE.MeshBasicMaterial; base: number }> = [];
  private readonly onChange: Array<(level: number) => void> = [];

  constructor(
    readonly name: string,
    initial = true,
  ) {
    this.on = initial;
    this.level = initial ? 1 : 0;
  }

  /** A glow material owned by this group (use it for every bulb of the group). */
  material(color: THREE.ColorRepresentation = 0xfff1d6, intensity = 1.4): THREE.MeshPhysicalMaterial {
    const m = glowMaterial(`lamp:${this.name}`, color, intensity);
    this.mats.push({ m, base: intensity });
    this.apply();
    return m;
  }

  addMaterial(m: THREE.MeshStandardMaterial): void {
    this.mats.push({ m, base: m.emissiveIntensity });
    this.apply();
  }

  /** Soft additive light pool on a surface (floor, wall, ceiling, table…). */
  pool(root: THREE.Object3D, x: number, y: number, z: number, radius: number, color: THREE.ColorRepresentation = 0xffe8c2, strength = 0.35, facing: 'up' | 'down' | number = 'up'): THREE.Mesh {
    const m = new THREE.MeshBasicMaterial({
      name: `pool:${this.name}`,
      map: radialTexture(),
      color: new THREE.Color(color),
      transparent: true,
      opacity: strength,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), m);
    if (facing === 'up') mesh.rotation.x = -Math.PI / 2;
    else if (facing === 'down') mesh.rotation.x = Math.PI / 2;
    else mesh.rotation.y = facing;
    mesh.position.set(x, y, z);
    mesh.renderOrder = 4;
    root.add(mesh);
    this.pools.push({ m, base: strength });
    this.apply();
    return mesh;
  }

  /** Extra reactions (e.g. a screen dimming) called with the current level 0…1. */
  react(fn: (level: number) => void): void {
    this.onChange.push(fn);
    fn(this.level);
  }

  toggle(): boolean {
    this.on = !this.on;
    return this.on;
  }

  set(on: boolean): void {
    this.on = on;
  }

  private apply(): void {
    const k = this.level;
    for (const { m, base } of this.mats) m.emissiveIntensity = base * (0.04 + 0.96 * k);
    for (const { m, base } of this.pools) {
      m.opacity = base * k;
      m.visible = k > 0.01;
    }
    for (const fn of this.onChange) fn(k);
  }

  update(dt: number): void {
    const target = this.on ? 1 : 0;
    if (this.level === target) return;
    this.level = damp(this.level, target, 5, dt);
    if (Math.abs(this.level - target) < 0.004) this.level = target;
    this.apply();
  }
}

// -----------------------------------------------------------------------------------------
// Fixtures (static geometry, batched by material)
// -----------------------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

export function disposeLampGeometry(): void {
  for (const g of geoCache.values()) g.dispose();
  geoCache.clear();
  disposeLampCache();
}

/** Floor lamp: cobalt foot, chrome stem, glowing egg shade. */
export function floorLamp(b: WorldBuilder, x: number, z: number, glow: THREE.Material, height = 1.55, y0 = 0): void {
  const m = b.mats;
  b.cylinder(m.cobaltCeramic, x, y0, z, 0.2, 0.24, 0.05, { segments: 24 });
  b.cylinder(m.chrome, x, y0 + 0.05, z, 0.018, 0.018, height - 0.2, { segments: 8, cast: false });
  const shade = cached('eggShade', () => new THREE.SphereGeometry(0.2, 20, 14).scale(1, 1.25, 1));
  b.place(shade, glow, x, y0 + height, z, { cast: false });
  b.collision.addCylinder({ x, z, r: 0.22, minY: y0, maxY: y0 + height + 0.2, surface: 'metal' });
}

/** Arc floor lamp leaning over a sofa: the shade hangs at (tx, tz). */
export function arcLamp(b: WorldBuilder, x: number, z: number, tx: number, tz: number, glow: THREE.Material, y0 = 0): void {
  const m = b.mats;
  b.cylinder(m.whiteCeramic, x, y0, z, 0.24, 0.28, 0.12, { segments: 24, collide: 'tile' });
  const top = 2.15;
  b.pipe([new THREE.Vector3(x, y0 + 0.12, z), new THREE.Vector3(x, y0 + top, z), new THREE.Vector3(tx, y0 + top, tz), new THREE.Vector3(tx, y0 + top - 0.22, tz)], 0.02, m.chrome, 0.7, { cast: false });
  const dome = cached('arcShade', () => new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI));
  b.place(dome, m.whiteCeramic, tx, y0 + top - 0.18, tz, { cast: false });
  b.sphere(glow, tx, y0 + top - 0.24, tz, 0.1, { cast: false });
}

/** Wall sconce: chrome plate with a glowing half-capsule facing `rotY` (0 = +Z). */
export function wallSconce(b: WorldBuilder, x: number, y: number, z: number, rotY: number, glow: THREE.Material): void {
  const m = b.mats;
  const plate = cached('sconcePlate', () => new THREE.CylinderGeometry(0.11, 0.11, 0.02, 20).rotateX(Math.PI / 2));
  const capsule = cached('sconceGlow', () => new THREE.CapsuleGeometry(0.07, 0.22, 6, 14).scale(1, 1, 0.55));
  const fx = Math.sin(rotY);
  const fz = Math.cos(rotY);
  b.place(plate, m.chrome, x + fx * 0.01, y, z + fz * 0.01, { rotY, cast: false });
  b.place(capsule, glow, x + fx * 0.05, y, z + fz * 0.05, { rotY, cast: false });
}

/** Mushroom table lamp sitting on a surface at height y. */
export function tableLamp(b: WorldBuilder, x: number, y: number, z: number, glow: THREE.Material, base: THREE.Material): void {
  const foot = cached('tableLampFoot', () =>
    new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.1, 0.02), new THREE.Vector2(0.03, 0.06), new THREE.Vector2(0.025, 0.24), new THREE.Vector2(0.001, 0.24)], 20),
  );
  const shade = cached('tableLampShade', () => new THREE.SphereGeometry(0.15, 22, 12, 0, Math.PI * 2, 0, Math.PI / 1.7).scale(1, 0.85, 1));
  b.place(foot, base, x, y, z, { cast: false });
  b.place(shade, glow, x, y + 0.2, z, { cast: false });
}

/** Thin glowing line (under counters, along steps, handrails, corridors). */
export function lightLine(b: WorldBuilder, x: number, y: number, z: number, length: number, rotY: number, mat: THREE.Material, thickness = 0.025): void {
  b.box(mat, x, y, z, length, thickness, thickness, { rotY, cast: false, receive: false });
}

/** Hanging glowing ring (halo pendant). */
export function ringPendant(b: WorldBuilder, x: number, y: number, z: number, r: number, ceilingY: number, glow: THREE.Material): void {
  b.torus(glow, x, y, z, r, 0.035, { rotX: Math.PI / 2, cast: false });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.cylinder(b.mats.chrome, x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.004, 0.004, ceilingY - y, { segments: 4, cast: false });
  }
}

/** Recessed ceiling downlight (emissive disc in a chrome ring). */
export function downlight(b: WorldBuilder, x: number, y: number, z: number, glow: THREE.Material, r = 0.12): void {
  b.cylinder(glow, x, y - 0.015, z, r, r, 0.015, { segments: 16, cast: false, receive: false });
  b.torus(b.mats.chrome, x, y - 0.01, z, r + 0.012, 0.01, { rotX: Math.PI / 2, cast: false });
}
