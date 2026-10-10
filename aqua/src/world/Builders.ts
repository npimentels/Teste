import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CollisionWorld, SurfaceType } from '../physics/Collision';
import type { AssetManager } from '../core/AssetManager';
import { Materials } from './Materials';

interface BatchEntry {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  cast: boolean;
  receive: boolean;
}

/**
 * Collects static meshes and merges everything sharing a material into a single draw call.
 * Geometry is baked to world space; textured materials get world-projected UVs so tiles
 * keep a constant size regardless of the shape.
 */
export class StaticBatcher {
  private entries: BatchEntry[] = [];

  add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, material: THREE.Material, cast = true, receive = true): void {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (material.userData.worldUV === true) g = Materials.boxUV(g, 1);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    this.entries.push({ geometry: g, material, cast, receive });
  }

  addMesh(mesh: THREE.Mesh, cast = true, receive = true): void {
    mesh.updateMatrixWorld(true);
    this.add(mesh.geometry, mesh.matrixWorld, mesh.material as THREE.Material, cast, receive);
  }

  /** Merges and adds the result to `parent`. Returns the created meshes. */
  flush(parent: THREE.Object3D, name: string): THREE.Mesh[] {
    const groups = new Map<string, BatchEntry[]>();
    for (const e of this.entries) {
      const key = `${e.material.uuid}|${e.cast}|${e.receive}`;
      let list = groups.get(key);
      if (!list) groups.set(key, (list = []));
      list.push(e);
    }
    const out: THREE.Mesh[] = [];
    for (const list of groups.values()) {
      const merged = mergeGeometries(list.map((e) => e.geometry), false);
      for (const e of list) e.geometry.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, list[0].material);
      mesh.name = `${name}:${list[0].material.name}`;
      mesh.castShadow = list[0].cast;
      mesh.receiveShadow = list[0].receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      out.push(mesh);
    }
    this.entries = [];
    return out;
  }
}

export interface PlaceOptions {
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  /** Add a collider. `true` uses the default surface for the material. */
  collide?: boolean | SurfaceType;
  cast?: boolean;
  receive?: boolean;
  /** Keep as an individual mesh (for animation) instead of batching. */
  dynamic?: boolean;
  parent?: THREE.Object3D;
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3(1, 1, 1);

/**
 * High level helpers to compose architecture: every helper creates the visual geometry
 * (batched) and, when requested, the matching collision shape.
 */
export class WorldBuilder {
  readonly batcher: StaticBatcher;
  private readonly geometryCache = new Map<string, THREE.BufferGeometry>();

  constructor(
    readonly root: THREE.Group,
    readonly collision: CollisionWorld,
    readonly mats: Materials,
    readonly assets: AssetManager,
  ) {
    this.batcher = new StaticBatcher();
  }

  private cachedGeometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geometryCache.get(key);
    if (!g) {
      g = make();
      this.geometryCache.set(key, g);
    }
    return g;
  }

  /** Places geometry either into the static batch or as its own mesh. */
  place(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, o: PlaceOptions = {}): THREE.Mesh | null {
    tmpEuler.set(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0, 'YXZ');
    tmpQuat.setFromEuler(tmpEuler);
    tmpPos.set(x, y, z);
    if (o.dynamic) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(tmpPos);
      mesh.quaternion.copy(tmpQuat);
      mesh.castShadow = o.cast ?? true;
      mesh.receiveShadow = o.receive ?? true;
      (o.parent ?? this.root).add(mesh);
      return mesh;
    }
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    this.batcher.add(geometry, tmpMatrix, material, o.cast ?? true, o.receive ?? true);
    return null;
  }

  /** Box centred at (x, z) whose bottom sits at y0. Optional rounded edges. */
  box(material: THREE.Material, x: number, y0: number, z: number, sx: number, sy: number, sz: number, o: PlaceOptions & { radius?: number } = {}): THREE.Mesh | null {
    const r = Math.min(o.radius ?? 0, sx / 2 - 0.001, sy / 2 - 0.001, sz / 2 - 0.001);
    const key = `box:${sx.toFixed(3)}:${sy.toFixed(3)}:${sz.toFixed(3)}:${r.toFixed(3)}`;
    const geometry = this.cachedGeometry(key, () => (r > 0.005 ? new RoundedBoxGeometry(sx, sy, sz, 3, r) : new THREE.BoxGeometry(sx, sy, sz)));
    const mesh = this.place(geometry, material, x, y0 + sy / 2, z, o);
    if (o.collide) {
      this.collision.addBox({ x, z, sx, sz, minY: y0, maxY: y0 + sy, rotY: o.rotY ?? 0, surface: typeof o.collide === 'string' ? o.collide : 'tile' });
    }
    return mesh;
  }

  cylinder(material: THREE.Material, x: number, y0: number, z: number, rTop: number, rBottom: number, h: number, o: PlaceOptions & { segments?: number; open?: boolean } = {}): THREE.Mesh | null {
    const seg = o.segments ?? 24;
    const key = `cyl:${rTop.toFixed(3)}:${rBottom.toFixed(3)}:${h.toFixed(3)}:${seg}:${o.open ? 1 : 0}`;
    const geometry = this.cachedGeometry(key, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, o.open ?? false));
    const mesh = this.place(geometry, material, x, y0 + h / 2, z, o);
    if (o.collide) this.collision.addCylinder({ x, z, r: Math.max(rTop, rBottom), minY: y0, maxY: y0 + h, surface: typeof o.collide === 'string' ? o.collide : 'stone' });
    return mesh;
  }

  sphere(material: THREE.Material, x: number, y: number, z: number, r: number, o: PlaceOptions = {}): THREE.Mesh | null {
    const key = `sph:${r.toFixed(3)}`;
    const geometry = this.cachedGeometry(key, () => new THREE.SphereGeometry(r, 32, 20));
    return this.place(geometry, material, x, y, z, o);
  }

  torus(material: THREE.Material, x: number, y: number, z: number, r: number, tube: number, o: PlaceOptions & { arc?: number } = {}): THREE.Mesh | null {
    const arc = o.arc ?? Math.PI * 2;
    const key = `tor:${r.toFixed(3)}:${tube.toFixed(3)}:${arc.toFixed(3)}`;
    const geometry = this.cachedGeometry(key, () => new THREE.TorusGeometry(r, tube, 12, Math.max(24, Math.round(r * 24 * (arc / Math.PI / 2))), arc));
    return this.place(geometry, material, x, y, z, o);
  }

  /**
   * Curved wall: annulus sector between radii, from angle a0 to a1 (atan2(z, x) convention),
   * extruded from y0 to y0 + h with softly bevelled edges.
   */
  arcWall(material: THREE.Material, cx: number, cz: number, rIn: number, rOut: number, a0: number, a1: number, y0: number, h: number, o: PlaceOptions & { bevel?: number; collide?: boolean | SurfaceType } = {}): void {
    const shape = new THREE.Shape();
    const seg = Math.max(6, Math.ceil(Math.abs(a1 - a0) * rOut * 1.2));
    for (let i = 0; i <= seg; i++) {
      const a = a0 + ((a1 - a0) * i) / seg;
      const px = Math.cos(a) * rOut;
      const pz = Math.sin(a) * rOut;
      if (i === 0) shape.moveTo(px, -pz);
      else shape.lineTo(px, -pz);
    }
    for (let i = seg; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / seg;
      shape.lineTo(Math.cos(a) * rIn, -Math.sin(a) * rIn);
    }
    shape.closePath();
    const bevel = o.bevel ?? 0.06;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: h - bevel * 2,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bevel, 0);
    this.place(geometry, material, cx, y0, cz, { ...o, rotY: 0 });
    geometry.dispose();
    if (o.collide) {
      const segs = Math.max(2, Math.ceil((Math.abs(a1 - a0) * (rIn + rOut)) / 2 / 1.6));
      this.collision.addArc(cx, cz, rIn, rOut, a0, a1, y0, y0 + h, segs, typeof o.collide === 'string' ? o.collide : 'tile');
    }
  }

  /** Flat annulus (floor ring / roof ring) with thickness. */
  ring(material: THREE.Material, cx: number, y: number, cz: number, rIn: number, rOut: number, thickness: number, o: PlaceOptions & { a0?: number; a1?: number } = {}): void {
    const a0 = o.a0 ?? 0;
    const a1 = o.a1 ?? Math.PI * 2;
    const shape = new THREE.Shape();
    const seg = Math.max(24, Math.ceil(Math.abs(a1 - a0) * rOut * 1.5));
    const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-4;
    if (full) {
      shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
      if (rIn > 0) {
        const hole = new THREE.Path();
        hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    } else {
      for (let i = 0; i <= seg; i++) {
        const a = a0 + ((a1 - a0) * i) / seg;
        if (i === 0) shape.moveTo(Math.cos(a) * rOut, -Math.sin(a) * rOut);
        else shape.lineTo(Math.cos(a) * rOut, -Math.sin(a) * rOut);
      }
      for (let i = seg; i >= 0; i--) {
        const a = a0 + ((a1 - a0) * i) / seg;
        shape.lineTo(Math.cos(a) * rIn, -Math.sin(a) * rIn);
      }
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: seg });
    geometry.rotateX(-Math.PI / 2);
    this.place(geometry, material, cx, y - thickness, cz, o);
    geometry.dispose();
  }

  /** Arbitrary flat shape (XZ, using world z directly) extruded downward from `y`. */
  slab(material: THREE.Material, outline: Array<[number, number]>, holes: Array<Array<[number, number]>>, y: number, thickness: number, o: PlaceOptions = {}): void {
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 32 });
    geometry.rotateX(-Math.PI / 2);
    this.place(geometry, material, 0, y - thickness, 0, o);
    geometry.dispose();
  }

  /** Glass balustrade with chrome handrail along a polyline. */
  glassRailing(points: Array<[number, number]>, y0: number, height = 1.1, o: { closed?: boolean; posts?: boolean; collide?: boolean } = {}): void {
    const pts = o.closed ? [...points, points[0]] : points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const rot = Math.atan2(-dz, dx);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      this.box(this.mats.glass, mx, y0 + 0.06, mz, len, height - 0.12, 0.03, { rotY: rot, cast: false, receive: false });
      const rail = this.cachedGeometry(`rail:${len.toFixed(3)}`, () => new THREE.CylinderGeometry(0.035, 0.035, len, 10).rotateZ(Math.PI / 2));
      this.place(rail, this.mats.chrome, mx, y0 + height, mz, { rotY: rot, cast: false });
      if (o.posts !== false) this.cylinder(this.mats.chrome, ax, y0, az, 0.03, 0.03, height, { segments: 10, cast: false });
      if (o.collide !== false) this.collision.addSegment(ax, az, bx, bz, 0.12, y0, y0 + height + 0.05, 'glass');
    }
    if (o.posts !== false && !o.closed) {
      const [lx, lz] = pts[pts.length - 1];
      this.cylinder(this.mats.chrome, lx, y0, lz, 0.03, 0.03, height, { segments: 10, cast: false });
    }
  }

  /** Chrome pipe following a polyline with rounded elbows. Returns its curve. */
  pipe(points: THREE.Vector3[], radius: number, material: THREE.Material = this.mats.chrome, bend = 0.6, o: PlaceOptions = {}): THREE.Curve<THREE.Vector3> {
    const path = roundedPolyline(points, bend);
    const geometry = new THREE.TubeGeometry(path, Math.max(16, Math.ceil(path.getLength() * 3)), radius, 12, false);
    this.place(geometry, material, 0, 0, 0, o);
    geometry.dispose();
    // flanges at joints
    for (const p of [points[0], points[points.length - 1]]) this.sphere(material, p.x, p.y, p.z, radius * 1.25, { cast: false });
    return path;
  }

  /** Text sign on a slim post. */
  sign(text: string, arrow: '←' | '→' | '↑' | '', x: number, z: number, rotY: number, y = 2.2): void {
    const tex = this.assets.sign(text, arrow);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 });
    mat.name = `sign:${text}`;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat);
    board.position.set(x, y, z);
    board.rotation.y = rotY;
    this.root.add(board);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat);
    back.position.set(x, y, z);
    back.rotation.y = rotY + Math.PI;
    this.root.add(back);
    this.cylinder(this.mats.chrome, x, 0, z, 0.04, 0.04, y - 0.2, { segments: 10, collide: 'metal' });
  }

  /**
   * Soft additive light shaft / uplight cone. Returns the mesh and its opacity uniform so a
   * LightGroup can fade it.
   */
  lightCone(x: number, y: number, z: number, height: number, rTop: number, rBottom: number, color: THREE.ColorRepresentation, opacity = 0.18, rot?: THREE.Euler): { mesh: THREE.Mesh; opacity: THREE.IUniform<number> } {
    return this.lightCones([{ x, y, z, height, rTop, rBottom, rot }], color, opacity);
  }

  /** Several cones merged into one draw call sharing one opacity uniform. */
  lightCones(specs: Array<{ x: number; y: number; z: number; height: number; rTop: number; rBottom: number; rot?: THREE.Euler }>, color: THREE.ColorRepresentation, opacity = 0.18): { mesh: THREE.Mesh; opacity: THREE.IUniform<number> } {
    const parts = specs.map((s) => {
      const g = new THREE.CylinderGeometry(s.rTop, s.rBottom, s.height, 32, 1, true);
      const mtx = new THREE.Matrix4().compose(new THREE.Vector3(s.x, s.y + s.height / 2, s.z), new THREE.Quaternion().setFromEuler(s.rot ?? new THREE.Euler()), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(mtx);
      return g;
    });
    const geometry = mergeGeometries(parts, false)!;
    for (const g of parts) g.dispose();
    const uniform = { value: opacity };
    const material = new THREE.ShaderMaterial({
      name: 'LightCone',
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: uniform },
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          vH = uv.y;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vH;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          float facing = abs(dot(normalize(vN), normalize(vView)));
          float a = pow(facing, 1.5) * smoothstep(1.0, 0.0, vH) * smoothstep(0.0, 0.08, vH) * uOpacity;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 7;
    this.root.add(mesh);
    return { mesh, opacity: uniform };
  }

  flush(name: string): THREE.Mesh[] {
    return this.batcher.flush(this.root, name);
  }

  disposeCache(): void {
    for (const g of this.geometryCache.values()) g.dispose();
    this.geometryCache.clear();
  }
}

/** Polyline with quadratic-bezier rounded corners. */
export function roundedPolyline(points: THREE.Vector3[], bend: number): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  if (points.length < 3) {
    path.add(new THREE.LineCurve3(points[0].clone(), points[points.length - 1].clone()));
    return path;
  }
  let prev = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const inDir = new THREE.Vector3().subVectors(p, points[i - 1]);
    const outDir = new THREE.Vector3().subVectors(points[i + 1], p);
    const r = Math.min(bend, inDir.length() * 0.45, outDir.length() * 0.45);
    const a = p.clone().addScaledVector(inDir.normalize(), -r);
    const b = p.clone().addScaledVector(outDir.normalize(), r);
    if (prev.distanceTo(a) > 1e-4) path.add(new THREE.LineCurve3(prev, a));
    path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), b));
    prev = b;
  }
  path.add(new THREE.LineCurve3(prev, points[points.length - 1].clone()));
  return path;
}
