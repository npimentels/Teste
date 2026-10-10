import * as THREE from 'three';
import type { WorldBuilder } from './Builders';

/**
 * Reusable curved architecture components. Every piece is procedural, batched by material
 * through the WorldBuilder, and parameterised so repeated use does not look copy-pasted
 * (heights, band positions and proportions vary with the arguments / a seed).
 */

const TAU = Math.PI * 2;
const columnCache = new Map<string, { body: THREE.LatheGeometry; band: THREE.LatheGeometry }>();

export interface ColumnOptions {
  /** Height of the cobalt band centre above the floor. */
  bandY?: number;
  /** Radius of the flared "lotus" capital where it meets the ceiling. */
  capital?: number;
  shaft?: number;
  collide?: boolean;
}

/**
 * Organic column: flared foot, slender shaft with gentle entasis, cobalt ceramic band at hand
 * height and a lotus capital that opens into the ceiling.
 */
export function organicColumn(b: WorldBuilder, x: number, z: number, h: number, o: ColumnOptions = {}): void {
  const shaft = o.shaft ?? 0.34;
  const cap = o.capital ?? 0.95;
  const bandY = o.bandY ?? 1.15;
  const key = `${h.toFixed(2)}:${shaft}:${cap}:${bandY}`;
  let geo = columnCache.get(key);
  if (!geo) {
    const pts: THREE.Vector2[] = [];
    const foot: Array<[number, number]> = [
      [0.001, 0],
      [shaft + 0.3, 0],
      [shaft + 0.3, 0.05],
      [shaft + 0.2, 0.12],
      [shaft + 0.08, 0.32],
      [shaft + 0.02, 0.62],
    ];
    for (const [r, y] of foot) pts.push(new THREE.Vector2(r, y));
    const shaftTop = h - 1.7;
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const y = 0.62 + (shaftTop - 0.62) * t;
      const entasis = Math.sin(t * Math.PI) * 0.025;
      pts.push(new THREE.Vector2(shaft + entasis, y));
    }
    // lotus capital: smooth flare (ease-in) up to the ceiling
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      const y = shaftTop + (h - shaftTop) * t;
      const r = shaft + (cap - shaft) * Math.pow(t, 2.4);
      pts.push(new THREE.Vector2(r, y));
    }
    pts.push(new THREE.Vector2(0.001, h));
    const body = new THREE.LatheGeometry(pts, 36);
    const band = new THREE.LatheGeometry(
      [
        new THREE.Vector2(shaft + 0.025, bandY - 0.22),
        new THREE.Vector2(shaft + 0.06, bandY - 0.18),
        new THREE.Vector2(shaft + 0.065, bandY + 0.18),
        new THREE.Vector2(shaft + 0.025, bandY + 0.22),
      ],
      36,
    );
    geo = { body, band };
    columnCache.set(key, geo);
  }
  b.place(geo.body, b.mats.whiteCeramic, x, 0, z);
  b.place(geo.band, b.mats.cobaltCeramic, x, 0, z);
  b.torus(b.mats.chrome, x, bandY - 0.24, z, shaft + 0.03, 0.022, { rotX: Math.PI / 2, cast: false });
  b.torus(b.mats.chrome, x, bandY + 0.24, z, shaft + 0.03, 0.022, { rotX: Math.PI / 2, cast: false });
  if (o.collide !== false) b.collision.addCylinder({ x, z, r: shaft + 0.12, minY: 0, maxY: h, surface: 'stone' });
}

/** Low cobalt glass-mosaic band (wainscot) with a chrome cap, following a circular wall. */
export function wainscot(b: WorldBuilder, cx: number, cz: number, r: number, a0: number, a1: number, height = 1.05): void {
  b.arcWall(b.mats.cobaltMosaic, cx, cz, r - 0.05, r + 0.01, a0, a1, 0, height, { bevel: 0.015, cast: false });
  b.arcWall(b.mats.chrome, cx, cz, r - 0.075, r + 0.01, a0, a1, height, 0.05, { bevel: 0.015, cast: false });
}

/**
 * Light cove: a soft white ledge that hides an emissive strip, washing the wall above with
 * light. Returns nothing; the emissive material can be registered in a LightGroup.
 */
export function lightCove(b: WorldBuilder, cx: number, cz: number, r: number, a0: number, a1: number, y: number, emissive: THREE.Material): void {
  b.arcWall(b.mats.whiteCeramic, cx, cz, r - 0.32, r + 0.01, a0, a1, y, 0.1, { bevel: 0.04, cast: false });
  b.arcWall(emissive, cx, cz, r - 0.12, r - 0.06, a0, a1, y + 0.1, 0.03, { bevel: 0, cast: false });
}

/**
 * Portal for an opening in a circular wall (angle `a`, half width in metres): rounded cobalt
 * jambs, a head band with an integrated wayfinding sign and a cyan acrylic light fin.
 */
export function portal(
  b: WorldBuilder,
  cx: number,
  cz: number,
  rWall: number,
  thickness: number,
  a: number,
  halfWidth: number,
  headY: number,
  sign: { text: string; color?: string } | null,
  fin: THREE.Material,
): void {
  const tx = -Math.sin(a);
  const tz = Math.cos(a);
  const rx = Math.cos(a);
  const rz = Math.sin(a);
  const rMid = rWall + thickness / 2;
  const rotY = Math.atan2(-tz, tx); // local X along the tangent
  for (const side of [-1, 1]) {
    const off = side * (halfWidth + 0.18);
    const x = cx + rx * rMid + tx * off;
    const z = cz + rz * rMid + tz * off;
    b.box(b.mats.cobaltCeramic, x, 0, z, 0.42, headY, thickness + 0.36, { rotY, radius: 0.12, collide: 'tile' });
    b.box(b.mats.chrome, x, headY - 0.02, z, 0.46, 0.06, thickness + 0.4, { rotY, radius: 0.02, cast: false });
  }
  const hx = cx + rx * rMid;
  const hz = cz + rz * rMid;
  b.box(b.mats.cobaltCeramic, hx, headY, hz, halfWidth * 2 + 0.84, 0.62, thickness + 0.36, { rotY, radius: 0.14 });
  b.box(fin, hx, headY - 0.06, hz, halfWidth * 2 + 0.2, 0.06, thickness + 0.5, { rotY, radius: 0.03, cast: false, receive: false });
  if (sign) {
    const tex = b.assets.sign(sign.text, '', sign.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    mat.name = `portalSign:${sign.text}`;
    const w = Math.min(halfWidth * 2 - 0.2, 3.6);
    const plane = new THREE.PlaneGeometry(w, w / 4);
    // facing the centre of the room (inside face)
    const inX = cx + rx * (rWall - 0.2);
    const inZ = cz + rz * (rWall - 0.2);
    const facing = Math.atan2(-rx, -rz);
    const mesh = new THREE.Mesh(plane, mat);
    mesh.position.set(inX, headY + 0.31, inZ);
    mesh.rotation.y = facing;
    mesh.renderOrder = 8;
    b.root.add(mesh);
  }
}

/**
 * Organic roof rib: a crescent fin (deep at the wall, slender towards the oculus) extruded
 * across its width. Placed radially around a centre.
 */
export function crescentRibs(b: WorldBuilder, cx: number, cz: number, rInner: number, rOuter: number, ySoffit: number, count: number, depthOuter = 0.9, width = 0.2): void {
  const shape = new THREE.Shape();
  const span = rOuter - rInner;
  shape.moveTo(0, 0);
  shape.lineTo(span, 0);
  shape.quadraticCurveTo(span * 0.65, -depthOuter * 0.2, span, -depthOuter);
  shape.quadraticCurveTo(span * 0.45, -depthOuter * 0.85, 0, -0.12);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 12 });
  geo.translate(rInner, 0, -width / 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    b.place(geo, b.mats.whiteCeramic, cx, ySoffit, cz, { rotY: -a });
  }
  geo.dispose();
}

/** Thin coloured ring inlaid in the floor (slightly above it to avoid z-fighting). */
export function floorInlay(b: WorldBuilder, material: THREE.Material, cx: number, cz: number, r0: number, r1: number, y = 0.034): void {
  b.ring(material, cx, y, cz, r0, r1, 0.004, { cast: false });
}

const treeCache = new Map<string, THREE.LatheGeometry>();

/**
 * "Tree" column from the station reference: a slender white trunk that opens smoothly into a
 * wide round canopy at the ceiling, with a chrome rim and an optional cobalt collar.
 */
export function treeColumn(b: WorldBuilder, x: number, z: number, h: number, canopy = 2.6, trunk = 0.36, y0 = 0): void {
  const key = `${h}:${canopy}:${trunk}`;
  let g = treeCache.get(key);
  if (!g) {
    const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, 0), new THREE.Vector2(trunk + 0.28, 0), new THREE.Vector2(trunk + 0.12, 0.25), new THREE.Vector2(trunk, 0.7)];
    const flareStart = h * 0.45;
    pts.push(new THREE.Vector2(trunk * 0.96, flareStart));
    for (let i = 1; i <= 16; i++) {
      const t = i / 16;
      const y = flareStart + (h - 0.18 - flareStart) * Math.sin((t * Math.PI) / 2);
      const r = trunk * 0.96 + (canopy - trunk) * Math.pow(t, 2.2);
      pts.push(new THREE.Vector2(r, y));
    }
    pts.push(new THREE.Vector2(canopy, h), new THREE.Vector2(0.001, h));
    g = new THREE.LatheGeometry(pts, 48);
    treeCache.set(key, g);
  }
  b.place(g, b.mats.whiteCeramic, x, y0, z);
  b.torus(b.mats.chrome, x, y0 + h - 0.06, z, canopy - 0.02, 0.035, { rotX: Math.PI / 2, cast: false });
  b.torus(b.mats.cobaltCeramic, x, y0 + 1.25, z, trunk + 0.02, 0.05, { rotX: Math.PI / 2, cast: false });
  b.collision.addCylinder({ x, z, r: trunk + 0.12, minY: y0, maxY: y0 + h, surface: 'stone' });
}

/**
 * Straight stair between two levels: real steps for the eye, a smooth ramp for the controller,
 * glass + chrome balustrades on the open sides. `dirX/dirZ` is the climbing direction.
 */
export function straightStair(
  b: WorldBuilder,
  o: { x0: number; z0: number; dirX: number; dirZ: number; width: number; rise: number; run: number; y0?: number; rails?: Array<-1 | 1> },
): void {
  const y0 = o.y0 ?? 0;
  const steps = Math.max(2, Math.round(o.rise / 0.18));
  const stepRise = o.rise / steps;
  const stepRun = o.run / steps;
  const sideX = -o.dirZ;
  const sideZ = o.dirX;
  const rotY = Math.atan2(-sideZ, sideX); // local X across the stair
  for (let i = 0; i < steps; i++) {
    const d = (i + 0.5) * stepRun;
    const cx = o.x0 + o.dirX * d;
    const cz = o.z0 + o.dirZ * d;
    const top = y0 + (i + 1) * stepRise;
    b.box(b.mats.whiteCeramic, cx, y0, cz, o.width, top - y0, stepRun + 0.01, { rotY, cast: false });
    b.box(b.mats.cobaltCeramic, cx + o.dirX * (stepRun / 2 - 0.03), top - 0.012, cz + o.dirZ * (stepRun / 2 - 0.03), o.width - 0.06, 0.014, 0.05, { rotY, cast: false, receive: false });
  }
  // controller ramp (same footprint)
  const midX = o.x0 + (o.dirX * o.run) / 2;
  const midZ = o.z0 + (o.dirZ * o.run) / 2;
  b.collision.addRamp({ x: midX, z: midZ, sx: o.width, sz: o.run, rotY: Math.atan2(o.dirX, o.dirZ), minY: y0, y0, y1: y0 + o.rise });
  for (const side of o.rails ?? [-1, 1]) {
    const off = (side * o.width) / 2;
    const ax = o.x0 + sideX * off;
    const az = o.z0 + sideZ * off;
    const bx = ax + o.dirX * o.run;
    const bz = az + o.dirZ * o.run;
    slopedBalustrade(b, ax, y0, az, bx, y0 + o.rise, bz);
  }
}

/** Glass balustrade with chrome handrail following a slope from A to B (with collision). */
export function slopedBalustrade(b: WorldBuilder, ax: number, ay: number, az: number, bx: number, by: number, bz: number, h = 1.0): void {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay + 0.06, az, bx, by + 0.06, bz, bx, by + h - 0.06, bz, ax, ay + h - 0.06, az], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  b.place(geo, b.mats.glass, 0, 0, 0, { cast: false, receive: false });
  geo.dispose();
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const rail = new THREE.CylinderGeometry(0.035, 0.035, len, 10);
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az).normalize();
  rail.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  b.place(rail, b.mats.chrome, (ax + bx) / 2, (ay + by) / 2 + h, (az + bz) / 2, { cast: false });
  rail.dispose();
  const posts = Math.max(2, Math.ceil(len / 1.6));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    b.cylinder(b.mats.chrome, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, 0.03, 0.03, h, { segments: 8, cast: false });
  }
  const segs = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.2));
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const top = Math.max(ay + (by - ay) * t0, ay + (by - ay) * t1) + h + 0.05;
    b.collision.addSegment(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, 0.12, Math.min(ay, by) - 0.5, top, 'glass');
  }
}
