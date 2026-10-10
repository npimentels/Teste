/**
 * Base walkable ground of the plateau: flat at `baseY`, with recessed basins (pools, canals)
 * and a polygonal outline. Outside the outline the ground drops away (cliff to the sea).
 */
export interface CircleBasin {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  floorY: number;
}

export interface RectBasin {
  kind: 'rect';
  x: number;
  z: number;
  hx: number;
  hz: number;
  floorY: number;
}

export type Basin = CircleBasin | RectBasin;

export class Terrain {
  readonly basins: Basin[] = [];
  /** Plateau outline in XZ (counter-clockwise or clockwise, any simple polygon). */
  outline: Array<[number, number]> = [];
  /** Extra walkable land masses at `baseY` (islands reached by other means, e.g. the metro). */
  readonly islands: Array<Array<[number, number]>> = [];

  constructor(
    public baseY = 0,
    public cliffY = -60,
  ) {}

  addCircleBasin(x: number, z: number, r: number, floorY: number): CircleBasin {
    const b: CircleBasin = { kind: 'circle', x, z, r, floorY };
    this.basins.push(b);
    return b;
  }

  addRectBasin(x: number, z: number, hx: number, hz: number, floorY: number): RectBasin {
    const b: RectBasin = { kind: 'rect', x, z, hx, hz, floorY };
    this.basins.push(b);
    return b;
  }

  heightAt(x: number, z: number): number {
    if (this.outline.length >= 3 && !this.insideAnyLand(x, z)) return this.cliffY;
    for (const b of this.basins) {
      if (b.kind === 'circle') {
        const dx = x - b.x;
        const dz = z - b.z;
        if (dx * dx + dz * dz < b.r * b.r) return b.floorY;
      } else if (Math.abs(x - b.x) < b.hx && Math.abs(z - b.z) < b.hz) {
        return b.floorY;
      }
    }
    return this.baseY;
  }

  insideAnyLand(x: number, z: number): boolean {
    if (this.insideOutline(x, z)) return true;
    for (const island of this.islands) if (Terrain.insidePolygon(island, x, z)) return true;
    return false;
  }

  insideOutline(x: number, z: number): boolean {
    return Terrain.insidePolygon(this.outline, x, z);
  }

  static insidePolygon(poly: Array<[number, number]>, x: number, z: number): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
}
