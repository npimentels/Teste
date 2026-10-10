import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/physics/Collision';
import { Terrain } from '../src/physics/Terrain';

describe('CollisionWorld', () => {
  it('pushes a cylinder out of an axis-aligned wall', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: 0, sx: 2, sz: 0.4, minY: 0, maxY: 3 });
    const p = { x: 0, z: 0.3 };
    expect(w.resolveCylinder(p, 0, 1.8, 0.32, 0.5)).toBe(true);
    expect(p.z).toBeCloseTo(0.2 + 0.32, 5);
  });

  it('respects rotation of oriented boxes', () => {
    const w = new CollisionWorld();
    // 45° rotated thin wall through the origin
    w.addBox({ x: 0, z: 0, sx: 6, sz: 0.2, minY: 0, maxY: 3, rotY: Math.PI / 4 });
    const p = { x: 0.1, z: 0.1 };
    w.resolveCylinder(p, 0, 1.8, 0.3, 0.5);
    // local X axis of the wall is (cos45, -sin45): distance to that line must be >= 0.1 + 0.3
    const dist = Math.abs(p.x * Math.SQRT1_2 + p.z * Math.SQRT1_2);
    expect(dist).toBeGreaterThanOrEqual(0.4 - 1e-6);
  });

  it('ignores obstacles low enough to step on and reports them as ground', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: 0, sx: 2, sz: 2, minY: 0, maxY: 0.3 });
    const p = { x: 0.5, z: 0.5 };
    expect(w.resolveCylinder(p, 0, 1.8, 0.32, 0.5)).toBe(false);
    expect(w.groundHeight(0.5, 0.5, 0, 0.2, 0.5)).toBeCloseTo(0.3);
  });

  it('does not tunnel through walls when resolving in small sub-steps', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: 0, sx: 10, sz: 0.2, minY: 0, maxY: 3 });
    const p = { x: 0, z: 2 };
    for (let i = 0; i < 100; i++) {
      p.z -= 0.12; // 0.12 m per sub-step < radius * 0.45
      w.resolveCylinder(p, 0, 1.8, 0.32, 0.5);
    }
    expect(p.z).toBeGreaterThan(0.1);
  });

  it('pushes out of cylinders', () => {
    const w = new CollisionWorld();
    w.addCylinder({ x: 0, z: 0, r: 0.5, minY: 0, maxY: 5 });
    const p = { x: 0.6, z: 0 };
    w.resolveCylinder(p, 0, 1.8, 0.3, 0.5);
    expect(p.x).toBeCloseTo(0.8, 5);
  });

  it('computes ramp heights for the ground query', () => {
    const w = new CollisionWorld();
    w.addRamp({ x: 0, z: 0, sx: 2, sz: 10, minY: 0, y0: 0, y1: 4 });
    expect(w.groundHeight(0, 0, 1.8, 0.2, 0.5)).toBeCloseTo(2, 5);
    expect(w.groundHeight(0, 5, 3.8, 0.2, 0.5)).toBeCloseTo(4, 5);
  });

  it('raycasts boxes and cylinders, honouring ignoreOwner', () => {
    const w = new CollisionWorld();
    w.addBox({ x: 0, z: -5, sx: 4, sz: 1, minY: 0, maxY: 3, owner: 'panel' });
    w.addCylinder({ x: 0, z: -10, r: 1, minY: 0, maxY: 3 });
    const o = { x: 0, y: 1.5, z: 0 };
    const d = { x: 0, y: 0, z: -1 };
    expect(w.raycast(o, d, 20)).toBeCloseTo(4.5, 5);
    expect(w.raycast(o, d, 20, 'panel')).toBeCloseTo(9, 5);
    expect(w.raycast(o, d, 3)).toBe(Infinity);
  });

  it('keeps spheres above terrain and out of solids', () => {
    const w = new CollisionWorld(new Terrain(0));
    w.addBox({ x: 2, z: 0, sx: 1, sz: 4, minY: 0, maxY: 2 });
    const p = { x: 1.4, y: -0.1, z: 0 };
    const n = { x: 0, y: 0, z: 0 };
    w.resolveSphere(p, 0.25, n);
    expect(p.y).toBeGreaterThanOrEqual(0.25 - 1e-6);
    expect(p.x).toBeLessThanOrEqual(1.5 - 0.25 + 1e-6);
  });
});

describe('Terrain', () => {
  it('returns basin floors and falls off outside the outline', () => {
    const t = new Terrain(0, -50);
    t.outline = [
      [-10, -10],
      [10, -10],
      [10, 10],
      [-10, 10],
    ];
    t.addCircleBasin(0, 0, 2, -0.4);
    t.addRectBasin(5, 5, 1, 1, -0.3);
    expect(t.heightAt(0, 0)).toBe(-0.4);
    expect(t.heightAt(5.5, 5.5)).toBe(-0.3);
    expect(t.heightAt(8, -8)).toBe(0);
    expect(t.heightAt(20, 0)).toBe(-50);
  });
});
