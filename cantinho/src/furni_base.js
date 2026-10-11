// Base do catálogo: registro, paleta e utilitários de arte compartilhados.
//
// Convenções (rotação 0):
//   • 1 tile = 32 unidades; a FRENTE da peça aponta para +Y (face esquerda na tela)
//   • z em pixels; assentos ~15 px, mesas ~30 px, armários ~100 px
//   • texturas recebem (u, v) da face: u na largura, v na altura (de baixo p/ cima)
//     e devolvem deslocamento de sombra (número), cor, [cor, sombra] ou { raw }

import { shadeHex, mix, hash } from './color.js';
import * as S from './sdf.js';

export { S, shadeHex, mix, hash };

export const defs = [];
export const add = (d) => { defs.push(d); return d; };

export const C = {
  walnut: '#8a5a3c', oak: '#c49a6c', teak: '#a8734a', mahogany: '#7a3f2e', ash: '#d8bf98',
  white: '#f2efe9', ivory: '#f7f3ea', cream: '#efe4cf', linen: '#e6dccb',
  grey: '#b9bcc4', silver: '#d6d9df', charcoal: '#4a4850', black: '#2e2b33',
  brass: '#d9a94a', gold: '#e8b34b', chrome: '#c9d3de', copper: '#c87a4a',
  marble: '#eceae6', stone: '#a59c8f', terra: '#c8693f', clay: '#d9a07a',
  leaf: '#5d9b4c', leafD: '#3a7240', leafL: '#8cc265',
  glass: '#c6e6f2', water: '#4fb0d6', navy: '#3a4a6b', blush: '#e8b4b8', sage: '#a3b5a0',
};

export const FABRICS = ['#d8d4cc', '#9fa6b3', '#4f5f7f', '#e8b4b8', '#a3b5a0', '#d9a23b', '#b5574b', '#6b4f7a', '#4a4850'];
export const WOODS = [C.walnut, C.oak, C.teak, C.white, C.black];

// ------------------------------------------------------------- texturas
// Veio de madeira correndo ao longo de u (ou v)
export const grain = (axis = 'u', seed = 0, amt = 0.22) => (u, v) => {
  const along = axis === 'u' ? u : v, across = axis === 'u' ? v : u;
  const w = across + Math.sin(along * 0.17 + seed) * 1.2 + Math.sin(along * 0.05 + seed * 3) * 2.2;
  const m = ((Math.floor(w) % 6) + 6) % 6;
  return m === 0 ? amt : m === 3 ? -amt * 0.35 : 0;
};

// Painel rebaixado (porta de armário, gaveta): sombra em cima/esquerda, luz embaixo/direita
export function panel(u, v, x0, y0, x1, y1) {
  const U = Math.floor(u), V = Math.floor(v);
  if (U < x0 || U > x1 || V < y0 || V > y1) return null;
  if (U === x0 || V === y1) return 0.6;
  if (U === x1 || V === y0) return -0.5;
  return 0.12;
}

// Mármore com veios suaves
export const marble = (seed = 0) => (u, v) => {
  const n = S.noise3(u * 0.09 + seed, v * 0.09, seed * 1.7) * 6;
  const vein = Math.abs(Math.sin(u * 0.12 + v * 0.07 + n));
  return vein < 0.06 ? 0.75 : vein < 0.14 ? 0.3 : (S.noise3(u * 0.3, v * 0.3, seed) - 0.5) * 0.15;
};

// Trama de tecido bem sutil
export const weave = (u, v) => ((Math.floor(u) + Math.floor(v)) % 2 ? 0.07 : 0);

// Combina texturas: a primeira que devolver algo vence
export const first = (...fns) => (u, v) => {
  for (const f of fns) { const r = f && f(u, v); if (r != null) return r; }
  return null;
};

// ------------------------------------------------------------- peças
export function legs(r, x0, y0, x1, y1, h, col, s = 3, z = 0) {
  r.box(x0, y0, z, s, s, h, col);
  r.box(x1 - s, y0, z, s, s, h, col);
  r.box(x0, y1 - s, z, s, s, h, col);
  r.box(x1 - s, y1 - s, z, s, s, h, col);
}

// Pé torneado (estilo clássico) via sólido de revolução
export function turnedLeg(r, cx, cy, z, h, col, rr = 2) {
  const prof = [];
  for (let i = 0; i < h; i++) {
    const t = i / h;
    let rad = rr * (0.75 + 0.25 * Math.cos(t * Math.PI * 2));
    if (t < 0.12) rad = rr * 0.7;
    if (Math.abs(t - 0.62) < 0.07) rad = rr * 1.25;
    if (t > 0.9) rad = rr * 1.15;
    prof.push(rad);
  }
  r.lathe(cx, cy, z, prof, col, { shiny: true });
}

// Almofada / estofado fofinho (caixa arredondada SDF)
export function cushion(r, x, y, z, w, d, h, col, opt = {}) {
  const rr = opt.round ?? Math.min(4, Math.min(w, d, h) / 2.2);
  const mat = opt.mat || ((lx, ly, lz) => {
    if (opt.tuft) {
      const gx = (lx - x) / opt.tuft, gy = (lz - z) / opt.tuft;
      if (Math.abs(gx - Math.round(gx)) < 0.08 && Math.abs(gy - Math.round(gy)) < 0.12 && Math.round(gx) > 0 && Math.round(gx) < w / opt.tuft) return [col, 1.1];
    }
    if (opt.piping && (lz > z + h - 1.2 || lz < z + 1)) return [col, 0.35];
    return col;
  });
  r.sdf([{ ...S.cbox(x, y, z, w, d, h, rr), mat }]);
}

// Travesseiro / almofada de decoração (bem estufada)
export function pillow(r, cx, cy, cz, w, d, h, col, pattern) {
  const p = S.blend(2.5, S.rbox(cx, cy, cz, w / 2, d / 2, h / 2, Math.min(w, d, h) / 2.1), S.ellipsoid(cx, cy, cz, w / 2.3, d / 1.6, h / 1.9));
  const mat = pattern ? (x, y, z) => pattern(x - cx, y - cy, z - cz) : col;
  r.sdf([{ ...p, mat }]);
}

// Folhagem: nuvem de folhas (elipsoides) com cores variadas
export function foliage(r, cx, cy, cz, rx, ry, rz, opt = {}) {
  const n = opt.n ?? 26;
  const pal = opt.pal || [C.leafL, C.leaf, '#4f8a43', C.leafD];
  const seed = opt.seed ?? 1;
  const prims = [];
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * Math.PI * 2, b = (hash(i, seed + 1) - 0.35) * Math.PI * 0.9;
    const rad = 0.55 + hash(i, seed + 2) * 0.45;
    const x = cx + Math.cos(a) * Math.cos(b) * rx * rad, y = cy + Math.sin(a) * Math.cos(b) * ry * rad, z = cz + Math.sin(b) * rz * rad;
    const s = (opt.leaf ?? 3.2) * (0.75 + hash(i, seed + 3) * 0.5);
    const top = (z - cz) / rz;
    const col = pal[Math.min(pal.length - 1, Math.max(0, Math.floor((1 - top) * 1.6 + hash(i, seed + 4) * 1.6)))];
    prims.push({ ...S.ellipsoid(x, y, z, s * 1.2, s, s * 0.8), mat: col });
  }
  r.sdf(prims, { blend: opt.blend ?? 1.4 });
}

// Folhas longas tipo palmeira/costela-de-adão partindo de um ponto
export function fronds(r, cx, cy, cz, n, len, opt = {}) {
  const prims = [];
  const pal = opt.pal || [C.leafL, C.leaf, C.leafD];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (opt.seed ?? 0);
    const up = opt.up ?? 0.9;
    const L = len * (0.75 + hash(i, 7) * 0.4);
    let px = cx, py = cy, pz = cz;
    const segs = opt.segs ?? 4;
    for (let k = 1; k <= segs; k++) {
      const t = k / segs;
      const nx = cx + Math.cos(a) * L * t, ny = cy + Math.sin(a) * L * t;
      const nz = cz + L * up * t - L * (opt.droop ?? 0.9) * t * t;
      const w = (opt.width ?? 2.6) * Math.sin(t * Math.PI * 0.9 + 0.2);
      prims.push({ ...S.capsule(px, py, pz, nx, ny, nz, w, w * 0.8), mat: pal[(i + k) % pal.length] });
      px = nx; py = ny; pz = nz;
    }
  }
  r.sdf(prims, { blend: 0.6 });
}

// Vaso de planta com terra (sólido de revolução)
export function pot(r, cx, cy, h, r0, r1, col, opt = {}) {
  const prof = [];
  for (let i = 0; i < h; i++) {
    const t = i / (h - 1);
    let rad = r0 + (r1 - r0) * t;
    if (opt.belly) rad += Math.sin(t * Math.PI) * opt.belly;
    if (t > 0.9) rad += 0.8;
    prof.push(rad);
  }
  r.lathe(cx, cy, 0, prof, col, {
    shiny: opt.shiny,
    sideTex: opt.band ? (nx, i) => (Math.abs(i - h * 0.62) < 1.5 ? opt.band : null) : null,
    topTex: (nx, ny, d) => (d < 0.84 ? [opt.soil || '#5a3b2b', (S.noise3(nx * 5, ny * 5, 1) - 0.5) * 0.6] : -0.4),
  });
}

// Cerâmica / louça branca brilhante
export const porcelain = (k = 0) => [C.white, k];

export const rnd = (i, s = 0) => hash(i, s);
