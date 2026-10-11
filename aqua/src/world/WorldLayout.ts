import type { ZoneId } from '../core/types';
import type { FootSurface } from '../player/PlayerController';

/**
 * Shared coordinates of the complex (metres, +Y up, north = −Z) and spatial queries used by
 * gameplay (zone detection, footstep surfaces). Every zone builder reads its anchors from here.
 */
export const LAYOUT = {
  spawn: { x: 0, y: 0, z: 12.5, yaw: 0 },
  atrium: { x: 0, z: 0, rIn: 16, wallT: 0.7, wallH: 8.5, poolR: 6, rimR: 6.6, poolFloor: -0.15, waterY: 0.18 },
  gallery: { x0: 16.3, x1: 43.2, halfW: 2.5, tankDepth: 6.5, room: { x: 50, z: 0, r: 7 }, ceiling: 4 },
  gardens: { z0: -18, z1: -64, canal: { x0: -25.5, x1: 24, z0: -41, z1: -37, floor: -0.4, water: -0.08 } },
  terrace: { x0: -24, x1: 24, z0: -84.5, z1: -66, y: 4 },
  /** Aqua Metro: station on the east cliff edge, viaduct over the sea, island terminus. */
  metro: {
    trackX: 66.5,
    psdX: 64,
    railY: -1.05,
    stopCentral: -38,
    stopPark: -422,
    station: { x0: 51.5, x1: 69.6, z0: -64, z1: -12, roofY: 7.2 },
    island: { x0: 42, x1: 64, z0: -454, z1: -392 },
  },
  /** Mercado Aqua footprint (south-east lawn, entrance facing the Átrio's south plaza). */
  market: { x0: 19, x1: 46, z0: 11.5, z1: 26 },
  /**
   * Ala Horizonte: an island south of the esplanade reached by a footbridge. Salão Maré
   * (rest lounge + spa restrooms), Hotel AQUA (lobby, rooms on the 1st floor, rooftop deck)
   * and gardens. y levels: ground 0, hotel 1st floor 4.6, roof 8.4.
   */
  horizonte: {
    island: { x0: -60, x1: 22, z0: 44, z1: 118 },
    bridge: { x0: -2.6, x1: 2.6, z0: 27.2, z1: 45 },
    lounge: { x0: -24, x1: 16, z0: 50, z1: 76, h: 6.2 },
    spa: { x0: 8, x1: 16, z0: 50, z1: 60, h: 3.2 },
    skywalk: { x0: 11, x1: 14.6, z0: 76, z1: 84 },
    hotel: { x0: -16, x1: 18, z0: 84, z1: 100, floor1: 4.6, ceil0: 4.3, roof: 8.4 },
  },
  /** Plateau outline (the cliff edge). */
  outline: [
    [-34, 28],
    [52, 28],
    [64, 16],
    [64, -74],
    [54, -86.5],
    [-28, -86.5],
    [-38, -76],
    [-38, 18],
  ] as Array<[number, number]>,
} as const;

export const ZONE_INFO: Record<ZoneId, { title: string; subtitle: string }> = {
  atrium: { title: 'Átrio Azul', subtitle: 'O coração luminoso do complexo' },
  gardens: { title: 'Jardins Hidráulicos', subtitle: 'Água em movimento, natureza em equilíbrio' },
  gallery: { title: 'Galeria Aquática', subtitle: 'Um passeio entre peixes e luz' },
  terrace: { title: 'Terraço do Horizonte', subtitle: 'O amanhã, até onde a vista alcança' },
  exterior: { title: 'Esplanada', subtitle: 'Os gramados abertos do platô' },
  metro: { title: 'Aqua Metro', subtitle: 'Estação AQUA Central · Linha 2' },
  park: { title: 'Parque Flutuante', subtitle: 'Uma ilha-jardim no meio do mar' },
  market: { title: 'Mercado Aqua', subtitle: 'Frescor, cor e água gelada' },
  lounge: { title: 'Salão Maré', subtitle: 'Descanso entre aquários e horizonte' },
  hotel: { title: 'Hotel AQUA', subtitle: 'Hospedagem com vista para o amanhã' },
  isle: { title: 'Ala Horizonte', subtitle: 'Jardins sobre o mar' },
};

export function zoneAt(x: number, y: number, z: number): ZoneId {
  const M = LAYOUT.metro;
  if (x > M.island.x0 - 2 && x < M.station.x1 + 1 && z > M.island.z0 - 2 && z < M.island.z1 + 2) return 'park';
  if (x > M.station.x0 - 0.3 && x < M.station.x1 + 1 && z > M.island.z1 && z < M.station.z1 + 0.3) return 'metro';
  const HZ = LAYOUT.horizonte;
  if (z > HZ.bridge.z0 + 0.5 && x > HZ.island.x0 - 2 && x < HZ.island.x1 + 2 && z < HZ.island.z1 + 2) {
    const L = HZ.lounge;
    if (x > L.x0 - 0.2 && x < L.x1 + 0.2 && z > L.z0 - 0.2 && z < L.z1 + 0.2) return 'lounge';
    const H = HZ.hotel;
    const S = HZ.skywalk;
    if ((x > H.x0 - 0.2 && x < H.x1 + 0.2 && z > H.z0 - 0.2 && z < H.z1 + 0.2) || (x > S.x0 && x < S.x1 && z > S.z0 && z < S.z1)) return 'hotel';
    return 'isle';
  }
  const K = LAYOUT.market;
  if (x > K.x0 - 0.2 && x < K.x1 + 0.2 && z > K.z0 - 0.2 && z < K.z1 + 0.2) return 'market';
  if (y > 2.5 && z < -62) return 'terrace';
  const a = LAYOUT.atrium;
  if ((x - a.x) ** 2 + (z - a.z) ** 2 < (a.rIn + a.wallT) ** 2) return 'atrium';
  const g = LAYOUT.gallery;
  if ((x > g.x0 && x < g.x1 + 0.5 && Math.abs(z) < 9.6) || (x - g.room.x) ** 2 + (z - g.room.z) ** 2 < (g.room.r + 0.5) ** 2) return 'gallery';
  if (z < -17.5 && z > -66 && Math.abs(x) < 32) return 'gardens';
  return 'exterior';
}

/** Hard paved surfaces outside buildings (rectangles x0, z0, x1, z1). */
const PAVED: Array<[number, number, number, number]> = [];
const PAVED_CIRCLES: Array<[number, number, number, number]> = [];

export function registerPaving(x0: number, z0: number, x1: number, z1: number): void {
  PAVED.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
}

export function registerPavingRing(x: number, z: number, rIn: number, rOut: number): void {
  PAVED_CIRCLES.push([x, z, rIn, rOut]);
}

export function isPaved(x: number, z: number): boolean {
  for (const [x0, z0, x1, z1] of PAVED) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
  for (const [cx, cz, r0, r1] of PAVED_CIRCLES) {
    const d = Math.hypot(x - cx, z - cz);
    if (d >= r0 && d <= r1) return true;
  }
  return false;
}

export function surfaceAt(x: number, z: number, y: number): FootSurface {
  const zone = zoneAt(x, y, z);
  if (zone === 'atrium' || zone === 'gallery' || zone === 'terrace' || zone === 'metro' || zone === 'market' || zone === 'lounge' || zone === 'hotel') return 'tile';
  if (y > 0.12) return 'tile';
  return isPaved(x, z) ? 'tile' : 'grass';
}
