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
    if (this.outline.length >= 3 && !this.insideOutline(x, z)) return this.cliffY;
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

  insideOutline(x: number, z: number): boolean {
    const poly = this.outline;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }
}
