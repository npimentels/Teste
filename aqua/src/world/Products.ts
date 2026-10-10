import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AssetManager } from '../core/AssetManager';
import { roundRect } from '../core/AssetManager';

/**
 * Fictional grocery products (bottles, cans, cartons, jars, boxes, cups, fruit) drawn with
 * instancing: one draw call per shape for the bodies and one for the printed labels. Labels
 * come from a canvas atlas of invented brands; each instance picks its cell through an
 * instanced attribute, so thousands of products cost a handful of draw calls.
 */

export type ProductShape = 'bottle' | 'tallBottle' | 'can' | 'carton' | 'jar' | 'box' | 'cup' | 'fruit';

export interface Brand {
  name: string;
  sub: string;
  color: string;
  /** Body tint used for the instance colour. */
  body: number;
}

/** Atlas cells (4 × 2). All names are invented for the game. */
export const BRANDS: Brand[] = [
  { name: 'AQUA', sub: 'água mineral', color: '#1d6fe0', body: 0xbfe6ff },
  { name: 'Bolha', sub: 'água com gás', color: '#11a7c9', body: 0x9fe8f2 },
  { name: 'Lima', sub: 'chá verde', color: '#5fae12', body: 0xc6f07a },
  { name: 'Maré', sub: 'isotônico', color: '#1747b5', body: 0x4f8cf0 },
  { name: 'Sol', sub: 'suco de laranja', color: '#f08a12', body: 0xffb347 },
  { name: 'Nuvem', sub: 'iogurte natural', color: '#7d8fd8', body: 0xf4f7ff },
  { name: 'Coral', sub: 'geleia de frutas', color: '#e0525e', body: 0xff8a8a },
  { name: 'Brisa', sub: 'cereal integral', color: '#e8b221', body: 0xffe08a },
];

const FONT = '"Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';

let atlasCache: THREE.CanvasTexture | null = null;

/** 1024 × 512 atlas, 4 × 2 cells. The top 12 % of each cell is solid brand colour (caps / lids). */
export function labelAtlas(assets: AssetManager): THREE.CanvasTexture {
  if (atlasCache) return atlasCache;
  const { ctx, texture } = assets.dynamicCanvas(1024, 512, 'productAtlas');
  for (const [i, b] of BRANDS.entries()) {
    const x = (i % 4) * 256;
    const y = (1 - Math.floor(i / 4)) * 256; // row 0 at the bottom (uv v = 0)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 256, 256);
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y, 256, 32); // cap strip (top of the cell = uv v → 1)
    // glossy wave band
    const g = ctx.createLinearGradient(0, y + 60, 0, y + 200);
    g.addColorStop(0, b.color);
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y + 150);
    ctx.bezierCurveTo(x + 80, y + 120, x + 170, y + 190, x + 256, y + 150);
    ctx.lineTo(x + 256, y + 256);
    ctx.lineTo(x, y + 256);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText(b.name, x + 128, y + 82);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = '#2a3a5c';
    ctx.fillText(b.sub, x + 128, y + 122);
    // water drop / bubble emblem
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + 128, y + 205, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(x + 128, y + 205, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, x + 2, y + 2, 252, 252, 6);
    ctx.stroke();
  }
  texture.needsUpdate = true;
  atlasCache = texture;
  return texture;
}

export function resetProductCache(): void {
  atlasCache = null;
  for (const g of geoCache.values()) {
    g.body.dispose();
    g.label?.dispose();
  }
  geoCache.clear();
}

interface ShapeGeo {
  body: THREE.BufferGeometry;
  label: THREE.BufferGeometry | null;
  /** Half extents for physics / spacing. */
  height: number;
  radius: number;
}

const geoCache = new Map<ProductShape, ShapeGeo>();

const lathe = (pts: Array<[number, number]>, seg = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/** Open cylinder band with uv u around, v from y0 (0) to y1 (0.88, below the cap strip). */
function band(r: number, y0: number, y1: number, seg = 12): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, true);
  g.translate(0, (y0 + y1) / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.86);
  return g;
}

/** Cap / lid geometry mapped to the brand-colour strip of the cell. */
function capUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.95);
  return g;
}

function frontPlane(w: number, h: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 0.86);
  g.translate(0, y, z);
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const clean = parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(q.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') q.deleteAttribute(name);
    return q;
  });
  const m = mergeGeometries(clean, false)!;
  parts.forEach((p) => p.dispose());
  return m;
}

export function productGeometry(shape: ProductShape): ShapeGeo {
  let g = geoCache.get(shape);
  if (g) return g;
  switch (shape) {
    case 'bottle':
      g = {
        body: lathe([
          [0.001, 0],
          [0.031, 0],
          [0.035, 0.012],
          [0.035, 0.16],
          [0.03, 0.19],
          [0.015, 0.222],
          [0.014, 0.236],
          [0.001, 0.236],
        ]),
        label: merge([band(0.0362, 0.045, 0.145), capUV(new THREE.CylinderGeometry(0.016, 0.016, 0.026, 10).translate(0, 0.247, 0))]),
        height: 0.26,
        radius: 0.035,
      };
      break;
    case 'tallBottle':
      g = {
        body: lathe([
          [0.001, 0],
          [0.042, 0],
          [0.046, 0.015],
          [0.046, 0.2],
          [0.04, 0.24],
          [0.02, 0.28],
          [0.019, 0.3],
          [0.001, 0.3],
        ]),
        label: merge([band(0.0472, 0.06, 0.19), capUV(new THREE.CylinderGeometry(0.021, 0.021, 0.03, 10).translate(0, 0.315, 0))]),
        height: 0.33,
        radius: 0.046,
      };
      break;
    case 'can':
      g = {
        body: lathe([
          [0.001, 0],
          [0.026, 0],
          [0.033, 0.01],
          [0.033, 0.108],
          [0.027, 0.12],
          [0.001, 0.12],
        ]),
        label: band(0.0336, 0.012, 0.106),
        height: 0.12,
        radius: 0.033,
      };
      break;
    case 'carton': {
      const roof = new THREE.CylinderGeometry(0.05, 0.05, 0.07, 3, 1);
      roof.rotateZ(Math.PI / 2);
      roof.scale(1, 0.55, 0.7);
      roof.translate(0, 0.2 + 0.012, 0);
      g = {
        body: merge([new THREE.BoxGeometry(0.07, 0.2, 0.07).translate(0, 0.1, 0), roof]),
        label: frontPlane(0.066, 0.15, 0.1, 0.0356),
        height: 0.24,
        radius: 0.04,
      };
      break;
    }
    case 'jar':
      g = {
        body: lathe([
          [0.001, 0],
          [0.04, 0],
          [0.045, 0.012],
          [0.045, 0.085],
          [0.038, 0.1],
          [0.001, 0.1],
        ]),
        label: merge([band(0.0462, 0.022, 0.078), capUV(new THREE.CylinderGeometry(0.041, 0.041, 0.022, 14).translate(0, 0.108, 0))]),
        height: 0.12,
        radius: 0.045,
      };
      break;
    case 'box':
      g = {
        body: new THREE.BoxGeometry(0.15, 0.22, 0.05).translate(0, 0.11, 0),
        label: frontPlane(0.14, 0.2, 0.11, 0.0256),
        height: 0.22,
        radius: 0.075,
      };
      break;
    case 'cup':
      g = {
        body: lathe([
          [0.001, 0],
          [0.027, 0],
          [0.035, 0.07],
          [0.037, 0.072],
          [0.001, 0.072],
        ]),
        label: band(0.0335, 0.012, 0.062),
        height: 0.075,
        radius: 0.037,
      };
      break;
    case 'fruit':
    default:
      g = { body: new THREE.SphereGeometry(0.04, 10, 8).translate(0, 0.038, 0), label: null, height: 0.08, radius: 0.04 };
      break;
  }
  geoCache.set(shape, g);
  return g;
}

/** Shader patch: each instance reads its atlas cell from the `aCell` attribute. */
function atlasMaterial(atlas: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ name: 'productLabel', map: atlas, roughness: 0.35, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = vMapUv * vec2(0.25, 0.5) + vec2(mod(aCell, 4.0) * 0.25, floor(aCell / 4.0) * 0.5);\n#endif');
  };
  m.customProgramCacheKey = () => 'productLabelAtlas';
  return m;
}

const BODY_LOOK: Record<ProductShape, { metalness: number; roughness: number; opacity: number; clearcoat: number }> = {
  bottle: { metalness: 0, roughness: 0.08, opacity: 0.72, clearcoat: 1 },
  tallBottle: { metalness: 0, roughness: 0.1, opacity: 0.85, clearcoat: 1 },
  can: { metalness: 0.85, roughness: 0.25, opacity: 1, clearcoat: 0.6 },
  carton: { metalness: 0, roughness: 0.55, opacity: 1, clearcoat: 0 },
  jar: { metalness: 0, roughness: 0.06, opacity: 0.8, clearcoat: 1 },
  box: { metalness: 0, roughness: 0.6, opacity: 1, clearcoat: 0 },
  cup: { metalness: 0, roughness: 0.4, opacity: 1, clearcoat: 0.3 },
  fruit: { metalness: 0, roughness: 0.32, opacity: 1, clearcoat: 0.8 },
};

/** Materials for a single (non-instanced) product, e.g. a dispensed vending bottle. */
export function singleProductMaterials(assets: AssetManager, shape: ProductShape, brand: number): THREE.Material[] {
  const look = BODY_LOOK[shape];
  const body = new THREE.MeshPhysicalMaterial({
    name: `product:${shape}:${brand}`,
    color: BRANDS[brand].body,
    metalness: look.metalness,
    roughness: look.roughness,
    clearcoat: look.clearcoat,
    transparent: look.opacity < 1,
    opacity: look.opacity,
  });
  const map = labelAtlas(assets).clone();
  map.needsUpdate = true;
  map.repeat.set(0.25, 0.5);
  map.offset.set((brand % 4) * 0.25, Math.floor(brand / 4) * 0.5);
  const label = new THREE.MeshStandardMaterial({ name: `productLabel:${brand}`, map, roughness: 0.35 });
  return [body, label];
}

/** Single product mesh (body + label as two geometry groups), base at y = −height/2. */
export function singleProductMesh(assets: AssetManager, shape: ProductShape, brand: number): THREE.Mesh {
  const g = productGeometry(shape);
  const parts = [g.body.clone()];
  if (g.label) parts.push(g.label.clone());
  const clean = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(clean, true)!;
  merged.translate(0, -g.height / 2, 0);
  return new THREE.Mesh(merged, singleProductMaterials(assets, shape, brand));
}

interface Placement {
  m: THREE.Matrix4;
  color: THREE.Color;
  cell: number;
}

/**
 * Collects product placements then builds two instanced meshes per shape (bodies + labels).
 */
export class ProductBatch {
  private readonly items = new Map<ProductShape, Placement[]>();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpE = new THREE.Euler();
  private readonly tmpS = new THREE.Vector3();
  private readonly tmpP = new THREE.Vector3();
  count = 0;

  add(shape: ProductShape, x: number, y: number, z: number, rotY: number, brand: number, scale = 1, tint?: number): void {
    let list = this.items.get(shape);
    if (!list) this.items.set(shape, (list = []));
    this.tmpE.set(0, rotY, 0);
    this.tmpQ.setFromEuler(this.tmpE);
    this.tmpS.setScalar(scale);
    this.tmpP.set(x, y, z);
    const m = new THREE.Matrix4().compose(this.tmpP, this.tmpQ, this.tmpS);
    list.push({ m, color: new THREE.Color(tint ?? BRANDS[brand % BRANDS.length].body), cell: brand % BRANDS.length });
    this.count++;
  }

  build(parent: THREE.Object3D, assets: AssetManager, name: string): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    const labelMat = atlasMaterial(labelAtlas(assets));
    for (const [shape, list] of this.items) {
      const g = productGeometry(shape);
      const look = BODY_LOOK[shape];
      const bodyMat = new THREE.MeshPhysicalMaterial({
        name: `${name}:${shape}`,
        color: 0xffffff,
        metalness: look.metalness,
        roughness: look.roughness,
        clearcoat: look.clearcoat,
        transparent: look.opacity < 1,
        opacity: look.opacity,
        depthWrite: look.opacity >= 1,
      });
      const body = new THREE.InstancedMesh(g.body, bodyMat, list.length);
      body.name = `${name}:${shape}`;
      for (const [i, p] of list.entries()) {
        body.setMatrixAt(i, p.m);
        body.setColorAt(i, p.color);
      }
      body.instanceMatrix.needsUpdate = true;
      body.castShadow = false;
      body.receiveShadow = true;
      body.computeBoundingSphere();
      parent.add(body);
      out.push(body);
      if (g.label) {
        const geo = g.label.clone();
        const cells = new Float32Array(list.length);
        list.forEach((p, i) => (cells[i] = p.cell));
        geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
        const label = new THREE.InstancedMesh(geo, labelMat, list.length);
        label.name = `${name}:${shape}:labels`;
        for (const [i, p] of list.entries()) label.setMatrixAt(i, p.m);
        label.instanceMatrix.needsUpdate = true;
        label.receiveShadow = true;
        label.computeBoundingSphere();
        parent.add(label);
        out.push(label);
      }
    }
    this.items.clear();
    return out;
  }
}
