import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { BathroomFixtures, pillPath } from './BathroomKit';
import { SlidingDoor, examine } from './Doors';
import { LampGroup, downlight } from './Lamps';
import { teardropLamp, planterBowl } from './Furniture';
import { LAYOUT } from './WorldLayout';

/**
 * Toaletes do Salão Maré — the restroom of reference image 1: deep cobalt glossy walls, tall
 * oval mirrors in chrome rims, teardrop pendants, wide glass vessel sinks on a clear acrylic
 * vanity lit cyan from below, folded towels on acrylic shelves, a lime pill-shaped base, a
 * pill niche with glass shelves and glass bottles, a big round window to the sea and garden,
 * a skylight ring, plants. Three stalls with frosted doors, dryer, paper towels, bins, hooks,
 * ventilation and signage.
 */
export function buildSpaRestroom(ctx: WorldContext, b: WorldBuilder): void {
  const R = LAYOUT.horizonte.spa;
  const m = b.mats;
  const H = R.h;
  const cx = (R.x0 + R.x1) / 2;
  const cz = (R.z0 + R.z1) / 2;
  const fx = new BathroomFixtures(ctx, 'spa', new THREE.Vector3(cx, 1.5, cz), 16);
  const inside = () => {
    const v = ctx.viewer;
    return v.x > R.x0 && v.x < R.x1 && v.z > R.z0 && v.z < R.z1 && v.y < H + 0.5;
  };
  const doorZ0 = 57.6;
  const doorZ1 = 58.9;

  // ---- Shell: walls (the north one is the lounge's), floor, ceiling with skylight ring --------
  const floor = new THREE.MeshPhysicalMaterial({ name: 'spaFloor', color: 0xf3f8fc, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
  b.box(floor, cx, -0.07, cz, R.x1 - R.x0, 0.1, R.z1 - R.z0, { cast: false });
  b.box(m.cobaltMosaic, cx, 0.025, cz, R.x1 - R.x0 - 1.2, 0.012, R.z1 - R.z0 - 1.2, { cast: false });
  b.box(floor, cx, 0.03, cz, R.x1 - R.x0 - 1.5, 0.012, R.z1 - R.z0 - 1.5, { cast: false });
  // west wall with the entrance, south wall (outside: white, inside: cobalt glossy)
  for (const [a, c] of [
    [R.z0, doorZ0],
    [doorZ1, R.z1 + 0.15],
  ]) {
    b.box(m.whiteCeramic, R.x0 - 0.075, 0, (a + c) / 2, 0.15, H, c - a, { collide: 'tile' });
    b.box(m.cobaltCeramic, R.x0 + 0.01, 0, (a + c) / 2, 0.02, H, c - a, { cast: false });
  }
  b.box(m.whiteCeramic, R.x0 - 0.075, 2.5, (doorZ0 + doorZ1) / 2, 0.15, H - 2.5, doorZ1 - doorZ0);
  b.box(m.whiteCeramic, cx, 0, R.z1 + 0.075, R.x1 - R.x0 + 0.15, H, 0.15, { collide: 'tile' });
  b.box(m.cobaltCeramic, cx, 0, R.z1 - 0.01, R.x1 - R.x0, H, 0.02, { cast: false });
  b.box(m.cobaltCeramic, cx, 0, R.z0 + 0.16, R.x1 - R.x0, H, 0.02, { cast: false }); // lounge north wall, inside face
  // east wall with the big round window (real opening)
  const portZ = R.z0 + 3.4;
  const portY = 1.62;
  const portR = 1.05;
  const east = new THREE.Shape([new THREE.Vector2(-R.z1 - 0.15, 0), new THREE.Vector2(-R.z0, 0), new THREE.Vector2(-R.z0, H), new THREE.Vector2(-R.z1 - 0.15, H)]);
  const hole = new THREE.Path();
  hole.absarc(-portZ, portY, portR, 0, Math.PI * 2, true);
  east.holes.push(hole);
  for (const [mat, x, d] of [
    [m.whiteCeramic, R.x1 - 0.1, 0.25],
    [m.cobaltCeramic, R.x1 - 0.12, 0.02],
  ] as Array<[THREE.Material, number, number]>) {
    const g = new THREE.ExtrudeGeometry(east, { depth: d, bevelEnabled: false, curveSegments: 40 });
    g.rotateY(Math.PI / 2);
    b.place(g, mat, x, 0, 0, { cast: mat === m.whiteCeramic });
    g.dispose();
  }
  b.collision.addBox({ x: R.x1, z: cz, sx: 0.25, sz: R.z1 - R.z0, minY: 0, maxY: H, surface: 'tile' });
  b.torus(m.whiteCeramic, R.x1 - 0.12, portY, portZ, portR + 0.06, 0.09, { rotY: Math.PI / 2 });
  b.torus(m.chrome, R.x1 - 0.18, portY, portZ, portR + 0.02, 0.025, { rotY: Math.PI / 2, cast: false });
  b.cylinder(m.glass, R.x1 + 0.02, portY, portZ, portR, portR, 0.02, { rotZ: Math.PI / 2, segments: 48, cast: false, receive: false });
  // window sill garden
  b.box(m.whiteCeramic, R.x1 - 0.32, portY - portR - 0.08, portZ, 0.42, 0.08, 1.5, { radius: 0.03, cast: false });
  for (const dz of [-0.5, 0.45]) {
    b.cylinder(m.limeGlossy, R.x1 - 0.32, portY - portR, portZ + dz, 0.09, 0.07, 0.16, { segments: 16, cast: false });
    ctx.veg.fern(R.x1 - 0.32, portY - portR + 0.15, portZ + dz, 0.22);
  }
  // ceiling: white, glowing skylight ring, vent
  b.box(m.whiteCeramic, cx, H, cz, R.x1 - R.x0 + 0.3, 0.25, R.z1 - R.z0 + 0.3, { radius: 0.06 });
  const sky = new THREE.MeshBasicMaterial({ name: 'spaSkylight', color: 0xcdeeff, toneMapped: false });
  b.cylinder(sky, cx, H - 0.04, R.z0 + 3.2, 1.0, 1.0, 0.02, { segments: 48, cast: false, receive: false });
  b.torus(m.whiteCeramic, cx, H - 0.06, R.z0 + 3.2, 1.08, 0.1, { rotX: Math.PI / 2 });
  b.torus(m.emissiveCyan, cx, H - 0.12, R.z0 + 3.2, 1.2, 0.025, { rotX: Math.PI / 2, cast: false });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(m.chrome, cx + Math.cos(a) * 0.5, H - 0.045, R.z0 + 3.2 + Math.sin(a) * 0.5, 1.0, 0.01, 0.02, { rotY: -a, cast: false });
  }
  fx.vent(b, R.x0 + 1.2, H, R.z1 - 0.9);
  const lights = new LampGroup('spa', true);
  ctx.addUpdatable(lights);
  const warm = lights.material(0xfff2dc, 1.5);
  for (const [x, z] of [
    [R.x0 + 1.2, R.z0 + 6.3],
    [R.x1 - 1.4, R.z0 + 6.3],
  ] as Array<[number, number]>) downlight(b, x, H, z, warm, 0.1);

  // ---- Vanity (north wall): lime pill base, clear acrylic counter lit cyan, vessel sinks -----
  const vz = R.z0 + 0.55;
  const v0 = R.x0 + 0.5;
  const v1 = R.x1 - 1.9;
  const vx = (v0 + v1) / 2;
  const acrylic = new THREE.MeshPhysicalMaterial({ name: 'acrylic', color: 0xdff6ff, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.38, clearcoat: 1, envMapIntensity: 1.3 });
  // lime + white pill plinth
  const plinth = new THREE.CapsuleGeometry(0.2, v1 - v0 - 0.4, 6, 20).rotateZ(Math.PI / 2).scale(1, 1, 1.25);
  b.place(plinth, m.limeGlossy, vx, 0.2, vz, { cast: false });
  plinth.dispose();
  b.box(m.whiteCeramic, vx, 0.05, vz - 0.02, v1 - v0 - 0.6, 0.32, 0.52, { radius: 0.15 });
  // acrylic shelf frames with folded towels
  b.box(acrylic, vx, 0.42, vz, v1 - v0, 0.03, 0.6, { cast: false, receive: false });
  b.box(acrylic, vx, 0.86, vz, v1 - v0 + 0.06, 0.04, 0.66, { cast: false, receive: false });
  for (const x of [v0 + 0.02, v1 - 0.02, vx]) b.box(acrylic, x, 0.42, vz, 0.03, 0.44, 0.6, { cast: false, receive: false });
  b.box(m.emissiveCyan, vx, 0.84, vz + 0.31, v1 - v0, 0.02, 0.02, { cast: false, receive: false });
  b.box(m.emissiveCyan, vx, 0.445, vz + 0.28, v1 - v0 - 0.1, 0.012, 0.02, { cast: false, receive: false });
  const towel = new THREE.MeshPhysicalMaterial({ name: 'towel', color: 0xf8fbff, roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(0xd4eeff) });
  for (let k = 0; k < 3; k++) {
    const tx = v0 + 0.45 + k * ((v1 - v0 - 0.9) / 2);
    for (let s = 0; s < 3; s++) b.box(towel, tx, 0.455 + s * 0.085, vz + 0.02, 0.5, 0.08, 0.36, { radius: 0.035, cast: false });
  }
  b.collision.addBox({ x: vx, z: vz, sx: v1 - v0 + 0.1, sz: 0.7, minY: 0, maxY: 0.9, surface: 'glass' });
  const sinks = [0, 1, 2].map((i) => v0 + ((v1 - v0) * (i + 0.5)) / 3);
  const soapBody = new THREE.MeshPhysicalMaterial({ name: 'soapBottle', color: 0xd9f5b0, roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0.85 });
  for (const [i, sx] of sinks.entries()) {
    const f = fx.sink(b, sx, vz + 0.06, 0.88, 0, i, 0.28);
    fx.soap(b, sx + 0.42, 0.88, vz - 0.12, i, soapBody, f);
  }
  // ---- Oval mirrors: cobalt panel with three tall ovals in chrome rims, one reflector ------------
  const mY = 1.95;
  const mW = 0.62;
  const mH = 1.25;
  const panel = new THREE.Shape([new THREE.Vector2(v0 - 0.1, 1.15), new THREE.Vector2(v1 + 0.1, 1.15), new THREE.Vector2(v1 + 0.1, 2.75), new THREE.Vector2(v0 - 0.1, 2.75)]);
  for (const sx of sinks) panel.holes.push(pillPath(new THREE.Path(), sx, mY, mW, mH, true));
  const pg = new THREE.ExtrudeGeometry(panel, { depth: 0.03, bevelEnabled: false, curveSegments: 40 });
  b.place(pg, m.cobaltCeramic, 0, 0, R.z0 + 0.19, { cast: false });
  pg.dispose();
  for (const sx of sinks) {
    const rim = new THREE.TorusGeometry(1, 0.018, 8, 64).scale(mW / 2 + 0.01, mH / 2 + 0.01, 1);
    b.place(rim, m.chrome, sx, mY, R.z0 + 0.225, { cast: false });
    rim.dispose();
    const rim2 = new THREE.TorusGeometry(1, 0.03, 8, 64).scale(mW / 2 + 0.05, mH / 2 + 0.05, 1);
    b.place(rim2, m.whiteCeramic, sx, mY, R.z0 + 0.215, { cast: false });
    rim2.dispose();
  }
  fx.mirror(b, new THREE.PlaneGeometry(v1 - v0, 1.5), vx, mY, R.z0 + 0.185, 0, b.root, inside);
  examine(ctx, 'spa-mirror', new THREE.Vector3(sinks[1], mY, R.z0 + 0.3), new THREE.Vector3(1.6, 0.6, 0.1), 'Olhar o espelho', '<b>Espelho oval</b><br>O reflexo é calculado em tempo real enquanto você está aqui dentro (qualidade Alta). Fora daqui, um metal polido reflete o céu.', 0, 2.2);
  // teardrop pendants between the mirrors
  const drop = lights.material(0xfff4e0, 1.6);
  for (const x of [sinks[0] - 0.5, (sinks[0] + sinks[1]) / 2, (sinks[1] + sinks[2]) / 2, sinks[2] + 0.5]) teardropLamp(b, x, 2.05, vz + 0.3, H, drop, 0.13);
  lights.pool(b.root, vx, 0.905, vz + 0.05, 1.4, 0xfff0d8, 0.25);

  // ---- Pill niche with glass shelves and glowing glass bottles (north wall, east end) ---------
  const nx = R.x1 - 1.05;
  const nShape = pillPath(new THREE.Shape(), nx, 1.75, 0.8, 1.9);
  const nGeo = new THREE.ExtrudeGeometry(nShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 24 });
  const glowBack = new THREE.MeshBasicMaterial({ name: 'nicheGlow', color: 0x9feeff, toneMapped: false });
  b.place(nGeo, glowBack, 0, 0, R.z0 + 0.18, { cast: false });
  nGeo.dispose();
  const ring = pillPath(new THREE.Shape(), nx, 1.75, 0.94, 2.04);
  ring.holes.push(pillPath(new THREE.Path(), nx, 1.75, 0.8, 1.9));
  const rGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.08, bevelEnabled: false, curveSegments: 24 });
  b.place(rGeo, m.whiteCeramic, 0, 0, R.z0 + 0.18, { cast: false });
  rGeo.dispose();
  const bottleGlass = new THREE.MeshPhysicalMaterial({ name: 'bottleGlass', color: 0x8fe7f2, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 1.6 });
  for (const [k, y] of [1.12, 1.62, 2.12].entries()) {
    b.box(acrylic, nx, y, R.z0 + 0.32, 0.72, 0.02, 0.26, { cast: false, receive: false });
    for (let j = 0; j < 3; j++) {
      const bx = nx - 0.22 + j * 0.22;
      const h = 0.12 + ((j + k) % 3) * 0.05;
      const g = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.05, 0), new THREE.Vector2(0.06, h * 0.5), new THREE.Vector2(0.03, h * 0.85), new THREE.Vector2(0.015, h), new THREE.Vector2(0.001, h)], 16);
      b.place(g, bottleGlass, bx, y + 0.02, R.z0 + 0.32, { cast: false, receive: false });
      g.dispose();
    }
  }
  examine(ctx, 'spa-niche', new THREE.Vector3(nx, 1.7, R.z0 + 0.35), new THREE.Vector3(0.45, 0.95, 0.2), 'Examinar frascos', '<b>Nicho de vidro</b><br>Óleos de banho de alga marinha, sais minerais e água de colônia "Brisa do Platô". Os frascos são reutilizáveis — devolva no balcão do hotel.', 0, 2.4);
  const top = planterBowl(b, R.x1 - 0.7, R.z0 + 5.3, 0.34, m.whiteCeramic, m.limeGlossy);
  ctx.veg.fern(R.x1 - 0.7, top, R.z0 + 5.3, 0.55);

  // ---- Stalls along the south wall; dryer, paper towels, bins by the door ----------------------
  fx.stalls(b, R.x1 - 3 * 1.6 - 0.15, R.z1, -1, 3, 1.6, 1.75, 0, 0);
  fx.dryer(b, R.x0 + 0.02, 1.25, R.z0 + 3.0, Math.PI / 2, 0);
  fx.dryer(b, R.x0 + 0.02, 1.25, R.z0 + 4.2, Math.PI / 2, 1);
  fx.paper(b, R.x0 + 0.02, 1.15, R.z0 + 1.6, Math.PI / 2, 0);
  for (const [z, mat] of [
    [R.z0 + 5.3, m.limeGlossy],
    [R.z0 + 5.85, m.glossyCyan],
  ] as Array<[number, THREE.Material]>) {
    b.cylinder(m.chrome, R.x0 + 0.3, 0, z, 0.2, 0.18, 0.6, { collide: 'metal', segments: 24 });
    b.cylinder(mat, R.x0 + 0.3, 0.6, z, 0.205, 0.205, 0.05, { segments: 24, cast: false });
  }
  // coat hooks by the door
  for (let k = 0; k < 3; k++) b.torus(m.chrome, R.x0 + 0.04, 1.65, doorZ0 - 0.4 - k * 0.3, 0.035, 0.008, { rotY: Math.PI / 2, arc: Math.PI, cast: false });

  // ---- Door and sign -------------------------------------------------------------------------------
  new SlidingDoor(ctx, b, { id: 'spa-door', x: R.x0 - 0.075, z: (doorZ0 + doorZ1) / 2, width: doorZ1 - doorZ0, height: 2.45, axis: 'z', style: 'frosted', sensor: 2.2 });
  // the block's roof is a planted terrace seen from the lounge (hanging vines over the edge)
  b.box(m.whiteCeramic, cx, H + 0.25, cz, R.x1 - R.x0 + 0.4, 0.35, R.z1 - R.z0 + 0.4, { radius: 0.12 });
  b.box(m.soil, cx, H + 0.6, cz, R.x1 - R.x0 - 0.6, 0.04, R.z1 - R.z0 - 0.6, { cast: false });
  for (let i = 0; i < 9; i++) {
    const x = R.x0 + 0.3 + i * ((R.x1 - R.x0 - 0.6) / 8);
    ctx.veg.vine(x, H + 0.55, R.z1 + 0.2, 0.9 + (i % 3) * 0.25);
    if (i % 2 === 0) ctx.veg.fern(x, H + 0.62, R.z1 - 0.8, 0.6);
  }
  for (let i = 0; i < 5; i++) ctx.veg.vine(R.x0 - 0.2, H + 0.55, R.z0 + 1 + i * 2, 0.8 + (i % 2) * 0.4);
  ctx.veg.banana(cx - 1.5, H + 0.62, cz - 1, 0.7);
  ctx.veg.banana(cx + 2, H + 0.62, cz + 1.5, 0.6);
}
