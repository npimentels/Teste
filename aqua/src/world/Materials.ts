import * as THREE from 'three';
import type { AssetManager } from '../core/AssetManager';
import { addPatch, causticsPatch } from '../environment/ShaderPatches';

/** Shared material library — one instance per surface type keeps draw calls & programs low. */
export class Materials {
  readonly whiteCeramic: THREE.MeshPhysicalMaterial;
  readonly whiteMatte: THREE.MeshStandardMaterial;
  readonly wallPanels: THREE.MeshStandardMaterial;
  readonly floorTile: THREE.MeshStandardMaterial;
  readonly wetTile: THREE.MeshStandardMaterial;
  readonly paving: THREE.MeshStandardMaterial;
  readonly lightGrey: THREE.MeshStandardMaterial;
  readonly glossyCyan: THREE.MeshPhysicalMaterial;
  readonly glossyGreen: THREE.MeshPhysicalMaterial;
  readonly glossyBlue: THREE.MeshPhysicalMaterial;
  readonly glass: THREE.MeshPhysicalMaterial;
  readonly glassTank: THREE.MeshPhysicalMaterial;
  readonly chrome: THREE.MeshStandardMaterial;
  readonly rubber: THREE.MeshStandardMaterial;
  readonly lawn: THREE.MeshStandardMaterial;
  readonly soil: THREE.MeshStandardMaterial;
  readonly poolTile: THREE.MeshStandardMaterial;
  readonly cliff: THREE.MeshStandardMaterial;
  readonly emissiveCyan: THREE.MeshStandardMaterial;
  readonly emissiveWarm: THREE.MeshStandardMaterial;
  readonly cushion: THREE.MeshStandardMaterial;
  private readonly poolTiles = new Map<string, THREE.MeshStandardMaterial>();
  private readonly mosaic: THREE.Texture;

  constructor(assets: AssetManager) {
    const floorTex = assets.floorTiles();
    floorTex.repeat.set(0.2, 0.2);

    this.whiteCeramic = new THREE.MeshPhysicalMaterial({
      name: 'whiteCeramic',
      color: 0xf6fafc,
      roughness: 0.32,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    });
    this.whiteMatte = new THREE.MeshStandardMaterial({ name: 'whiteMatte', color: 0xeef4f7, roughness: 0.62 });
    const wallTex = assets.wallPanels();
    wallTex.repeat.set(0.4, 0.4);
    this.wallPanels = new THREE.MeshStandardMaterial({ name: 'wallPanels', color: 0xffffff, map: wallTex, roughness: 0.5 });
    this.floorTile = new THREE.MeshStandardMaterial({ name: 'floorTile', map: floorTex, roughness: 0.24, metalness: 0, envMapIntensity: 0.9 });
    this.wetTile = new THREE.MeshStandardMaterial({ name: 'wetTile', map: floorTex, color: 0xd6eef4, roughness: 0.06, envMapIntensity: 1.4 });
    const pav = assets.paving();
    pav.repeat.set(0.18, 0.18);
    this.paving = new THREE.MeshStandardMaterial({ name: 'paving', map: pav, roughness: 0.55 });
    this.lightGrey = new THREE.MeshStandardMaterial({ name: 'lightGrey', color: 0xc9d6dd, roughness: 0.45, metalness: 0.1 });
    const glossy = (name: string, color: number) =>
      new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0 });
    this.glossyCyan = glossy('glossyCyan', 0x28c5df);
    this.glossyGreen = glossy('glossyGreen', 0x64c98b);
    this.glossyBlue = glossy('glossyBlue', 0x087dae);
    this.glass = new THREE.MeshPhysicalMaterial({
      name: 'glass',
      color: 0xd8f4ff,
      roughness: 0.04,
      metalness: 0,
      transparent: true,
      opacity: 0.2,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glassTank = new THREE.MeshPhysicalMaterial({
      name: 'glassTank',
      color: 0xcff6ff,
      roughness: 0.03,
      transparent: true,
      opacity: 0.12,
      envMapIntensity: 1.2,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.chrome = new THREE.MeshStandardMaterial({ name: 'chrome', color: 0xf2f6f8, metalness: 1, roughness: 0.1, envMapIntensity: 1.3 });
    this.rubber = new THREE.MeshStandardMaterial({ name: 'rubber', color: 0x56636c, roughness: 0.88 });
    const grassTex = assets.grass();
    grassTex.repeat.set(0.12, 0.12);
    this.lawn = new THREE.MeshStandardMaterial({ name: 'lawn', map: grassTex, color: 0xd2f0c8, roughness: 0.92 });
    this.soil = new THREE.MeshStandardMaterial({ name: 'soil', color: 0x6d5a45, roughness: 1 });
    this.mosaic = assets.poolMosaic();
    this.mosaic.repeat.set(0.5, 0.5);
    this.poolTile = this.poolTileAt(0.2);
    this.cliff = new THREE.MeshStandardMaterial({ name: 'cliff', color: 0xe8dcc4, roughness: 0.95, flatShading: true });
    this.emissiveCyan = new THREE.MeshStandardMaterial({ name: 'emissiveCyan', color: 0xcffaff, emissive: 0x28c5df, emissiveIntensity: 2.2, roughness: 0.3 });
    this.emissiveWarm = new THREE.MeshStandardMaterial({ name: 'emissiveWarm', color: 0xfff8e8, emissive: 0xfff1d0, emissiveIntensity: 1.6, roughness: 0.3 });
    this.cushion = new THREE.MeshStandardMaterial({ name: 'cushion', color: 0xbfeaf2, roughness: 0.8 });
    for (const m of [this.floorTile, this.wetTile, this.paving, this.lawn, this.wallPanels]) m.userData.worldUV = true;
  }

  /**
   * Mosaic pool tile with animated caustics below `waterLevel`. One material per water level;
   * `strength` can be driven by light groups (e.g. pool lights).
   */
  poolTileAt(waterLevel: number, strength: THREE.IUniform<number> = { value: 0.55 }, key = ''): THREE.MeshStandardMaterial {
    const k = `${waterLevel.toFixed(2)}:${key}`;
    let m = this.poolTiles.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ name: `poolTile${k}`, map: this.mosaic, roughness: 0.2 });
      m.userData.worldUV = true;
      addPatch(m, causticsPatch({ value: waterLevel }, strength));
      this.poolTiles.set(k, m);
    }
    return m;
  }

  /** Floor tile variant with underwater caustic light projected on it (aquarium corridors). */
  causticFloor(strength: THREE.IUniform<number>): THREE.MeshStandardMaterial {
    const m = this.floorTile.clone();
    m.name = 'causticFloor';
    m.userData.worldUV = true;
    addPatch(m, causticsPatch({ value: 100 }, strength, new THREE.Color(0x7fe9ff), 0.55));
    return m;
  }

  /** World-space UVs make tiling independent from mesh size (applied before batching). */
  static planarUV(geometry: THREE.BufferGeometry, axis: 'y' | 'x' | 'z' = 'y', scale = 1): THREE.BufferGeometry {
    const pos = geometry.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (axis === 'y') {
        uv[i * 2] = x * scale;
        uv[i * 2 + 1] = z * scale;
      } else if (axis === 'x') {
        uv[i * 2] = z * scale;
        uv[i * 2 + 1] = y * scale;
      } else {
        uv[i * 2] = x * scale;
        uv[i * 2 + 1] = y * scale;
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
  }

  /** Box-projected world UVs: picks the dominant normal axis per vertex. */
  static boxUV(geometry: THREE.BufferGeometry, scale = 1): THREE.BufferGeometry {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(nor.getX(i));
      const ay = Math.abs(nor.getY(i));
      const az = Math.abs(nor.getZ(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (ay >= ax && ay >= az) {
        uv[i * 2] = x * scale;
        uv[i * 2 + 1] = z * scale;
      } else if (ax >= az) {
        uv[i * 2] = z * scale;
        uv[i * 2 + 1] = y * scale;
      } else {
        uv[i * 2] = x * scale;
        uv[i * 2 + 1] = y * scale;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }

  dispose(): void {
    for (const value of Object.values(this)) {
      if (value instanceof THREE.Material) value.dispose();
    }
    for (const m of this.poolTiles.values()) m.dispose();
    this.poolTiles.clear();
  }
}
