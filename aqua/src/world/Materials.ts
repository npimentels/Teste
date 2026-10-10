import * as THREE from 'three';
import type { AssetManager } from '../core/AssetManager';
import { addPatch, causticsPatch } from '../environment/ShaderPatches';
import { PALETTE } from './Palette';

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
  // ---- AQUA visual system (see Palette.ts for usage rules) -------------------------------
  /** Glossy cobalt ceramic — the anchor colour: bands, frames, furniture shells. */
  readonly cobaltCeramic: THREE.MeshPhysicalMaterial;
  /** Darker cobalt for undersides, recesses and edge reveals. */
  readonly cobaltDeep: THREE.MeshPhysicalMaterial;
  /** Glass mosaic band (cobalt / ocean / cyan). */
  readonly cobaltMosaic: THREE.MeshStandardMaterial;
  /** Translucent cyan acrylic (fins, lamp shades, arches). */
  readonly cyanAcrylic: THREE.MeshPhysicalMaterial;
  /** Lime gloss — highlight only. */
  readonly limeGlossy: THREE.MeshPhysicalMaterial;
  /** Polished white terrazzo with coloured chips. */
  readonly terrazzo: THREE.MeshStandardMaterial;
  /** Wet stone around water: darker, mirror-like. */
  readonly wetStone: THREE.MeshStandardMaterial;
  readonly brushedMetal: THREE.MeshStandardMaterial;
  readonly fabricCobalt: THREE.MeshPhysicalMaterial;
  readonly fabricCyan: THREE.MeshPhysicalMaterial;
  readonly fabricLime: THREE.MeshPhysicalMaterial;
  /** Pale maple wood — warm counterpoint, used sparingly (tops, slats). */
  readonly maple: THREE.MeshStandardMaterial;
  readonly frostedGlass: THREE.MeshPhysicalMaterial;
  /** Glossy black bezel for screens and devices. */
  readonly glossBlack: THREE.MeshPhysicalMaterial;
  /** White fluted wall panels. */
  readonly flutedWall: THREE.MeshStandardMaterial;
  readonly rug: THREE.MeshStandardMaterial;
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
    this.floorTile = new THREE.MeshStandardMaterial({ name: 'floorTile', map: floorTex, roughness: 0.28, metalness: 0, envMapIntensity: 0.6, color: 0xfffdf8 });
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
    const glossyPhys = (name: string, color: number, roughness = 0.2) =>
      new THREE.MeshPhysicalMaterial({ name, color, roughness, clearcoat: 1, clearcoatRoughness: 0.06 });
    this.cobaltCeramic = glossyPhys('cobaltCeramic', PALETTE.cobalt, 0.22);
    this.cobaltDeep = glossyPhys('cobaltDeep', PALETTE.cobaltDeep, 0.3);
    const cm = assets.cobaltMosaic();
    cm.repeat.set(0.9, 0.9);
    this.cobaltMosaic = new THREE.MeshStandardMaterial({ name: 'cobaltMosaic', map: cm, roughness: 0.12, envMapIntensity: 1.1 });
    this.cyanAcrylic = new THREE.MeshPhysicalMaterial({
      name: 'cyanAcrylic',
      color: PALETTE.cyanGlow,
      emissive: 0x0b5f72,
      emissiveIntensity: 0.6,
      roughness: 0.08,
      clearcoat: 1,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.limeGlossy = glossyPhys('limeGlossy', PALETTE.lime, 0.2);
    const tz = assets.terrazzo();
    tz.repeat.set(0.16, 0.16);
    this.terrazzo = new THREE.MeshStandardMaterial({ name: 'terrazzo', map: tz, roughness: 0.2, envMapIntensity: 0.75 });
    this.wetStone = new THREE.MeshStandardMaterial({ name: 'wetStone', map: tz, color: 0xbcd3de, roughness: 0.05, envMapIntensity: 1.35 });
    this.brushedMetal = new THREE.MeshStandardMaterial({ name: 'brushedMetal', color: 0xd3dde3, metalness: 1, roughness: 0.32 });
    const fabric = (name: string, color: number, sheen: number) =>
      new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.82, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(sheen) });
    this.fabricCobalt = fabric('fabricCobalt', 0x2155c4, 0x8fd8ff);
    this.fabricCyan = fabric('fabricCyan', 0x5fd2e6, 0xe0fbff);
    this.fabricLime = fabric('fabricLime', 0xa6dc4a, 0xf2ffd0);
    this.maple = new THREE.MeshStandardMaterial({ name: 'maple', color: PALETTE.maple, roughness: 0.45 });
    this.frostedGlass = new THREE.MeshPhysicalMaterial({
      name: 'frostedGlass',
      color: 0xf2fbff,
      roughness: 0.45,
      transparent: true,
      opacity: 0.6,
      emissive: 0xfff6e6,
      emissiveIntensity: 0.9,
      depthWrite: false,
    });
    this.glossBlack = glossyPhys('glossBlack', 0x0f1820, 0.12);
    const fl = assets.flutedPanels();
    fl.repeat.set(0.5, 0.3);
    this.flutedWall = new THREE.MeshStandardMaterial({ name: 'flutedWall', map: fl, color: 0xe6f1f7, roughness: 0.42 });
    this.rug = new THREE.MeshStandardMaterial({ name: 'rug', map: assets.rug(), roughness: 0.95 });
    for (const m of [this.floorTile, this.wetTile, this.paving, this.lawn, this.wallPanels, this.cobaltMosaic, this.terrazzo, this.wetStone, this.flutedWall]) m.userData.worldUV = true;
  }

  /**
   * Mosaic pool tile with animated caustics below `waterLevel`. One material per water level;
   * `strength` can be driven by light groups (e.g. pool lights).
   */
  poolTileAt(waterLevel: number, strength: THREE.IUniform<number> = { value: 0.55 }, key = '', style: 'cyan' | 'cobalt' = 'cyan'): THREE.MeshStandardMaterial {
    const k = `${waterLevel.toFixed(2)}:${key}:${style}`;
    let m = this.poolTiles.get(k);
    if (!m) {
      const map = style === 'cobalt' ? (this.cobaltMosaic.map as THREE.Texture) : this.mosaic;
      m = new THREE.MeshStandardMaterial({ name: `poolTile${k}`, map, roughness: 0.18 });
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
