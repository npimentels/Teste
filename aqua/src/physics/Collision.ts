import { Terrain } from './Terrain';

/**
 * Lightweight kinematic collision world.
 *
 * Shapes are vertical prisms: oriented boxes (rotated about Y), vertical cylinders and
 * ramps (oriented boxes whose top is sloped along their local Z axis). That is enough for
 * architecture made of walls, columns, slabs and ramps, and lets us resolve a vertical
 * capsule / cylinder player cheaply and robustly without a full physics engine.
 *
 * Rotation convention matches Three.js `rotation.y = θ`:
 *   world = (lx·cosθ + lz·sinθ, −lx·sinθ + lz·cosθ)
 */
export type ColliderKind = 'box' | 'cyl' | 'ramp';
export type SurfaceType = 'tile' | 'grass' | 'metal' | 'glass' | 'wood' | 'stone';

export interface Collider {
  readonly id: number;
  kind: ColliderKind;
  x: number;
  z: number;
  /** Half size along local X (radius for cylinders). */
  hx: number;
  /** Half size along local Z (unused for cylinders). */
  hz: number;
  cos: number;
  sin: number;
  minY: number;
  maxY: number;
  /** Ramp top height at local z = −hz (y0) and z = +hz (y1). */
  y0: number;
  y1: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  surface: SurfaceType;
  /** Interactable id that owns this collider (ignored when ray-testing that interactable). */
  owner: string | null;
  enabled: boolean;
  stamp: number;
  /** Grid cells the collider is registered in (fast removal for moving colliders). */
  cells: number[];
}

export interface BoxOptions {
  x: number;
  z: number;
  sx: number;
  sz: number;
  minY: number;
  maxY: number;
  rotY?: number;
  surface?: SurfaceType;
  owner?: string | null;
}

export interface CylOptions {
  x: number;
  z: number;
  r: number;
  minY: number;
  maxY: number;
  surface?: SurfaceType;
  owner?: string | null;
}

export interface RampOptions {
  x: number;
  z: number;
  sx: number;
  sz: number;
  rotY?: number;
  /** Bottom of the solid. */
  minY: number;
  /** Top height at local −Z end. */
  y0: number;
  /** Top height at local +Z end. */
  y1: number;
  surface?: SurfaceType;
}

export interface Vec2Like {
  x: number;
  z: number;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

const CELL = 6;
const OFFSET = 2048;
const cellKey = (ix: number, iz: number) => (ix + OFFSET) * 4096 + (iz + OFFSET);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class CollisionWorld {
  readonly colliders: Collider[] = [];
  readonly terrain: Terrain;
  private grid = new Map<number, Collider[]>();
  private stampCounter = 0;
  private nextId = 1;

  constructor(terrain = new Terrain()) {
    this.terrain = terrain;
  }

  addBox(o: BoxOptions): Collider {
    const rot = o.rotY ?? 0;
    return this.insert({
      kind: 'box',
      x: o.x,
      z: o.z,
      hx: o.sx / 2,
      hz: o.sz / 2,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      minY: o.minY,
      maxY: o.maxY,
      y0: o.maxY,
      y1: o.maxY,
      surface: o.surface ?? 'tile',
      owner: o.owner ?? null,
    });
  }

  addCylinder(o: CylOptions): Collider {
    return this.insert({
      kind: 'cyl',
      x: o.x,
      z: o.z,
      hx: o.r,
      hz: o.r,
      cos: 1,
      sin: 0,
      minY: o.minY,
      maxY: o.maxY,
      y0: o.maxY,
      y1: o.maxY,
      surface: o.surface ?? 'stone',
      owner: o.owner ?? null,
    });
  }

  addRamp(o: RampOptions): Collider {
    const rot = o.rotY ?? 0;
    return this.insert({
      kind: 'ramp',
      x: o.x,
      z: o.z,
      hx: o.sx / 2,
      hz: o.sz / 2,
      cos: Math.cos(rot),
      sin: Math.sin(rot),
      minY: o.minY,
      maxY: Math.max(o.y0, o.y1),
      y0: o.y0,
      y1: o.y1,
      surface: o.surface ?? 'tile',
      owner: null,
    });
  }

  /** Adds a polyline of thin wall boxes (e.g. a railing or arc approximation). */
  addSegment(ax: number, az: number, bx: number, bz: number, thickness: number, minY: number, maxY: number, surface: SurfaceType = 'tile'): Collider {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    // Local X runs along the segment: rotY = atan2(-dz, dx).
    return this.addBox({
      x: (ax + bx) / 2,
      z: (az + bz) / 2,
      sx: len + thickness * 0.5,
      sz: thickness,
      minY,
      maxY,
      rotY: Math.atan2(-dz, dx),
      surface,
    });
  }

  /** Approximates an annulus sector with boxes. Angles are atan2(z, x) in radians. */
  addArc(cx: number, cz: number, rIn: number, rOut: number, a0: number, a1: number, minY: number, maxY: number, segments: number, surface: SurfaceType = 'tile'): Collider[] {
    const out: Collider[] = [];
    const rMid = (rIn + rOut) / 2;
    const thick = rOut - rIn;
    for (let i = 0; i < segments; i++) {
      const t0 = a0 + ((a1 - a0) * i) / segments;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / segments;
      out.push(
        this.addSegment(
          cx + Math.cos(t0) * rMid,
          cz + Math.sin(t0) * rMid,
          cx + Math.cos(t1) * rMid,
          cz + Math.sin(t1) * rMid,
          thick,
          minY,
          maxY,
          surface,
        ),
      );
    }
    return out;
  }

  /** Call after changing x/z/size/rotation of a collider so the broad phase stays valid. */
  refresh(c: Collider): void {
    this.removeFromGrid(c);
    this.computeBounds(c);
    this.addToGrid(c);
  }

  private insert(partial: Omit<Collider, 'id' | 'minX' | 'maxX' | 'minZ' | 'maxZ' | 'enabled' | 'stamp' | 'cells'>): Collider {
    const c: Collider = { ...partial, id: this.nextId++, minX: 0, maxX: 0, minZ: 0, maxZ: 0, enabled: true, stamp: 0, cells: [] };
    this.computeBounds(c);
    this.colliders.push(c);
    this.addToGrid(c);
    return c;
  }

  private computeBounds(c: Collider): void {
    if (c.kind === 'cyl') {
      c.minX = c.x - c.hx;
      c.maxX = c.x + c.hx;
      c.minZ = c.z - c.hx;
      c.maxZ = c.z + c.hx;
      return;
    }
    const ex = Math.abs(c.hx * c.cos) + Math.abs(c.hz * c.sin);
    const ez = Math.abs(c.hx * c.sin) + Math.abs(c.hz * c.cos);
    c.minX = c.x - ex;
    c.maxX = c.x + ex;
    c.minZ = c.z - ez;
    c.maxZ = c.z + ez;
  }

  private addToGrid(c: Collider): void {
    const x0 = Math.floor(c.minX / CELL);
    const x1 = Math.floor(c.maxX / CELL);
    const z0 = Math.floor(c.minZ / CELL);
    const z1 = Math.floor(c.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = cellKey(ix, iz);
        let list = this.grid.get(k);
        if (!list) {
          list = [];
          this.grid.set(k, list);
        }
        list.push(c);
        c.cells.push(k);
      }
    }
  }

  private removeFromGrid(c: Collider): void {
    for (const k of c.cells) {
      const list = this.grid.get(k);
      if (!list) continue;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
    }
    c.cells.length = 0;
  }

  /** Moves a collider to a new centre (keeps size / rotation) and updates the broad phase. */
  moveTo(c: Collider, x: number, z: number): void {
    if (c.x === x && c.z === z) return;
    c.x = x;
    c.z = z;
    this.refresh(c);
  }

  /** Visits each enabled collider whose AABB overlaps the query rectangle exactly once. */
  forEachNear(minX: number, maxX: number, minZ: number, maxZ: number, fn: (c: Collider) => void): void {
    const stamp = ++this.stampCounter;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(cellKey(ix, iz));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          if (c.stamp === stamp) continue;
          c.stamp = stamp;
          if (!c.enabled) continue;
          if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
          fn(c);
        }
      }
    }
  }

  static rampTop(c: Collider, lz: number): number {
    const t = clamp((lz + c.hz) / (2 * c.hz), 0, 1);
    return c.y0 + (c.y1 - c.y0) * t;
  }

  /**
   * Pushes a vertical cylinder (center `pos`, feet at `feetY`) out of every solid it overlaps.
   * Solids whose top is within `step` of the feet are ignored here: they are walkable steps
   * and the ground query lifts the player onto them instead.
   * Returns true if any correction was applied.
   */
  resolveCylinder(pos: Vec2Like, feetY: number, height: number, radius: number, step: number): boolean {
    let hit = false;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      this.forEachNear(pos.x - radius, pos.x + radius, pos.z - radius, pos.z + radius, (c) => {
        if (c.minY >= feetY + height || c.maxY <= feetY + step) return;
        if (c.kind === 'cyl') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const R = c.hx + radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= R * R) return;
          let d = Math.sqrt(d2);
          let nx = dx;
          let nz = dz;
          if (d < 1e-6) {
            nx = 1;
            nz = 0;
            d = 1;
          }
          const push = R - (d2 < 1e-12 ? 0 : d);
          pos.x += (nx / d) * push;
          pos.z += (nz / d) * push;
          moved = true;
          return;
        }
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const cx = clamp(lx, -c.hx, c.hx);
        const cz = clamp(lz, -c.hz, c.hz);
        const ox = lx - cx;
        const oz = lz - cz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= radius * radius) return;
        const top = c.kind === 'ramp' ? CollisionWorld.rampTop(c, cz) : c.maxY;
        if (top <= feetY + step) return;
        let nx: number;
        let nz: number;
        let push: number;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          nx = ox / d;
          nz = oz / d;
          push = radius - d;
        } else {
          const px = c.hx - Math.abs(lx);
          const pz = c.hz - Math.abs(lz);
          if (px < pz) {
            nx = lx >= 0 ? 1 : -1;
            nz = 0;
            push = px + radius;
          } else {
            nx = 0;
            nz = lz >= 0 ? 1 : -1;
            push = pz + radius;
          }
        }
        pos.x += (nx * c.cos + nz * c.sin) * push;
        pos.z += (-nx * c.sin + nz * c.cos) * push;
        moved = true;
      });
      if (!moved) break;
      hit = true;
    }
    return hit;
  }

  /**
   * Highest walkable surface under a cylinder footprint whose top is at most `feetY + step`.
   * `probe` is the footprint radius used for support (smaller than the body radius so the
   * player does not hover over edges).
   */
  groundHeight(x: number, z: number, feetY: number, probe: number, step: number): number {
    let best = this.terrain.heightAt(x, z);
    const limit = feetY + step + 1e-4;
    this.forEachNear(x - probe, x + probe, z - probe, z + probe, (c) => {
      let top: number;
      if (c.kind === 'cyl') {
        const dx = x - c.x;
        const dz = z - c.z;
        const R = c.hx + probe;
        if (dx * dx + dz * dz > R * R) return;
        top = c.maxY;
      } else {
        const dx = x - c.x;
        const dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const ox = lx - clamp(lx, -c.hx, c.hx);
        const oz = lz - clamp(lz, -c.hz, c.hz);
        if (ox * ox + oz * oz > probe * probe) return;
        top = c.kind === 'ramp' ? CollisionWorld.rampTop(c, clamp(lz, -c.hz, c.hz)) : c.maxY;
      }
      if (top <= limit && top > best) best = top;
    });
    return best;
  }

  /** Lowest underside above `fromY` overlapping the footprint (for head bumps). */
  ceilingHeight(x: number, z: number, fromY: number, radius: number): number {
    let best = Infinity;
    this.forEachNear(x - radius, x + radius, z - radius, z + radius, (c) => {
      if (c.minY <= fromY || c.minY >= best) return;
      if (c.kind === 'cyl') {
        const dx = x - c.x;
        const dz = z - c.z;
        const R = c.hx + radius;
        if (dx * dx + dz * dz > R * R) return;
      } else {
        const dx = x - c.x;
        const dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        const ox = lx - clamp(lx, -c.hx, c.hx);
        const oz = lz - clamp(lz, -c.hz, c.hz);
        if (ox * ox + oz * oz > radius * radius) return;
      }
      best = c.minY;
    });
    return best;
  }

  /**
   * Distance along a normalized ray to the first solid, or Infinity.
   * Colliders owned by `ignoreOwner` are skipped.
   */
  raycast(o: Vec3Like, d: Vec3Like, maxDist: number, ignoreOwner: string | null = null): number {
    const ex = o.x + d.x * maxDist;
    const ez = o.z + d.z * maxDist;
    let best = Infinity;
    this.forEachNear(Math.min(o.x, ex), Math.max(o.x, ex), Math.min(o.z, ez), Math.max(o.z, ez), (c) => {
      if (ignoreOwner !== null && c.owner === ignoreOwner) return;
      const t = c.kind === 'cyl' ? rayCylinder(o, d, c) : rayBox(o, d, c);
      if (t >= 0 && t <= maxDist && t < best) best = t;
    });
    return best;
  }

  /**
   * Pushes a sphere out of all solids and the terrain. Accumulates the (unnormalized) contact
   * normal into `normalOut`. Returns true if a contact happened.
   */
  resolveSphere(p: Vec3Like, r: number, normalOut: Vec3Like): boolean {
    normalOut.x = 0;
    normalOut.y = 0;
    normalOut.z = 0;
    let hit = this.resolveSphereTerrain(p, r, normalOut);
    this.forEachNear(p.x - r, p.x + r, p.z - r, p.z + r, (c) => {
      let qx: number;
      let qy: number;
      let qz: number;
      let top: number;
      if (c.kind === 'cyl') {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const k = d > c.hx ? c.hx / d : 1;
        qx = c.x + dx * k;
        qz = c.z + dz * k;
        top = c.maxY;
      } else {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const lx = clamp(dx * c.cos - dz * c.sin, -c.hx, c.hx);
        const lz = clamp(dx * c.sin + dz * c.cos, -c.hz, c.hz);
        qx = c.x + lx * c.cos + lz * c.sin;
        qz = c.z - lx * c.sin + lz * c.cos;
        top = c.kind === 'ramp' ? CollisionWorld.rampTop(c, lz) : c.maxY;
      }
      qy = clamp(p.y, c.minY, top);
      let nx = p.x - qx;
      let ny = p.y - qy;
      let nz = p.z - qz;
      const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 >= r * r) return;
      let push: number;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx /= d;
        ny /= d;
        nz /= d;
        push = r - d;
      } else {
        nx = 0;
        ny = 1;
        nz = 0;
        push = top - p.y + r;
      }
      p.x += nx * push;
      p.y += ny * push;
      p.z += nz * push;
      normalOut.x += nx;
      normalOut.y += ny;
      normalOut.z += nz;
      hit = true;
    });
    if (this.resolveSphereTerrain(p, r, normalOut)) hit = true;
    return hit;
  }

  private resolveSphereTerrain(p: Vec3Like, r: number, normalOut: Vec3Like): boolean {
    const g = this.terrain.heightAt(p.x, p.z);
    if (p.y - r < g && g > this.terrain.cliffY) {
      p.y = g + r;
      normalOut.y += 1;
      return true;
    }
    return false;
  }
}

/** Ray vs oriented box (ramps are approximated by their bounding box). */
function rayBox(o: Vec3Like, d: Vec3Like, c: Collider): number {
  const rx = o.x - c.x;
  const rz = o.z - c.z;
  const ox = rx * c.cos - rz * c.sin;
  const oz = rx * c.sin + rz * c.cos;
  const dx = d.x * c.cos - d.z * c.sin;
  const dz = d.x * c.sin + d.z * c.cos;
  let tmin = -Infinity;
  let tmax = Infinity;
  const slab = (origin: number, dir: number, lo: number, hi: number): boolean => {
    if (Math.abs(dir) < 1e-9) return origin >= lo && origin <= hi;
    let t1 = (lo - origin) / dir;
    let t2 = (hi - origin) / dir;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    return tmin <= tmax;
  };
  if (!slab(ox, dx, -c.hx, c.hx)) return -1;
  if (!slab(o.y, d.y, c.minY, c.maxY)) return -1;
  if (!slab(oz, dz, -c.hz, c.hz)) return -1;
  if (tmax < 0) return -1;
  return tmin < 0 ? 0 : tmin;
}

/** Ray vs capped vertical cylinder. */
function rayCylinder(o: Vec3Like, d: Vec3Like, c: Collider): number {
  const ox = o.x - c.x;
  const oz = o.z - c.z;
  const r = c.hx;
  const inside2d = ox * ox + oz * oz <= r * r;
  if (inside2d && o.y >= c.minY && o.y <= c.maxY) return 0;
  let best = Infinity;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-12) {
    const b = 2 * (ox * d.x + oz * d.z);
    const cc = ox * ox + oz * oz - r * r;
    const disc = b * b - 4 * a * cc;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const y = o.y + d.y * t;
        if (y >= c.minY && y <= c.maxY) best = t;
      }
    }
  }
  if (Math.abs(d.y) > 1e-9) {
    for (const capY of [c.maxY, c.minY]) {
      const t = (capY - o.y) / d.y;
      if (t >= 0 && t < best) {
        const x = ox + d.x * t;
        const z = oz + d.z * t;
        if (x * x + z * z <= r * r) best = t;
      }
    }
  }
  return best === Infinity ? -1 : best;
}
