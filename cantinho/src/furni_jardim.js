// Jardim e piscina
import { add, C, S, grain, panel, marble, first, legs, cushion, pillow, foliage, fronds, pot, shadeHex, mix, hash } from './furni_base.js';

// Água de piscina: se emenda sozinha com os vizinhos (nb = máscara de vizinhos com água)
// bits: 1 = -X, 2 = -Y, 4 = +X, 8 = +Y
export const POOL = { surface: -4, bottom: -16 };
add({
  id: 'piscina', name: 'Piscina (módulo)', cat: 'jardim', size: [1, 1], h: 2, walk: true, flat: true, pool: true, rots: 1, frames: 4, fps: 3, autotile: true,
  desc: 'Módulo de piscina: coloque vários lado a lado e as bordas se ajustam. Dá para nadar!',
  variants: ['#4fb0d6', '#3fc0b0', '#5a8ee0'],
  draw(r, o) {
    const nb = o.nb | 0, wc = o.color, f = o.frame;
    const tile = (u, v) => (Math.floor(u) % 8 === 0 || Math.floor(v) % 8 === 0 ? ['#d8eef5', 0.2] : ['#8fd0ea', (hash(Math.floor(u / 8), Math.floor(v / 8)) - 0.5) * 0.2]);
    const B = POOL.bottom;
    r.box(0, 0, B - 1, 32, 32, 1, '#8fd0ea', { tex: { top: tile } });
    const rimC = '#e8e2d8';
    const rimTex = { top: (u, v) => (Math.floor(u + v) % 9 === 0 ? 0.3 : (hash(Math.floor(u), Math.floor(v)) - 0.5) * 0.15) };
    const wallTex = (u, v) => (v > 15 ? null : tile(u, v + 2));
    if (!(nb & 1)) r.box(0, 0, B, 5, 32, -B + 1, rimC, { tex: { ...rimTex, right: wallTex, left: wallTex } });
    if (!(nb & 2)) r.box(0, 0, B, 32, 5, -B + 1, rimC, { tex: { ...rimTex, left: wallTex, right: wallTex } });
    if (!(nb & 4)) r.box(27, 0, B, 5, 32, -B + 1, rimC, { tex: rimTex });
    if (!(nb & 8)) r.box(0, 27, B, 32, 5, -B + 1, rimC, { tex: rimTex });
    const x0 = nb & 1 ? 0 : 5, y0 = nb & 2 ? 0 : 5, x1 = nb & 4 ? 32 : 27, y1 = nb & 8 ? 32 : 27;
    r.box(x0, y0, POOL.surface - 1, x1 - x0, y1 - y0, 1, wc, {
      alpha: 0.62,
      tex: {
        left: () => ({ skip: true }), right: () => ({ skip: true }),
        top: (u, v) => {
          const U = u + x0, V = v + y0;
          const w = Math.sin(U * 0.45 + V * 0.2 + f * 1.6) + Math.sin(V * 0.5 - U * 0.15 - f * 1.1);
          return w > 1.5 ? { raw: '#e8fbff' } : w > 0.9 ? [mix(wc, '#ffffff', 0.35), 0] : null;
        },
      },
    });
  },
});

add({
  id: 'escada_piscina', name: 'Escada de Piscina', cat: 'jardim', size: [1, 1], h: 40, poolItem: true,
  desc: 'Escada de inox com corrimãos curvos. Coloque na borda da piscina.',
  variants: [C.chrome, C.gold],
  draw(r, o) {
    const m = o.color, B = POOL.bottom;
    for (const x of [8, 24]) {
      const pts = [[x, 9, B], [x, 9, 4], [x, 7, 14], [x, 3, 18], [x, -1, 16], [x, -3, 8]];
      const prims = [];
      for (let i = 0; i < pts.length - 1; i++) prims.push({ ...S.capsule(...pts[i], ...pts[i + 1], 1.2), mat: m });
      r.sdf(prims);
    }
    for (const z of [B + 4, B + 9, -2]) r.box(8, 7, z, 16, 4, 1.5, m);
  },
});

add({
  id: 'pedra_passagem', name: 'Pedras de Passagem', cat: 'jardim', size: [1, 1], h: 4, walk: true, flat: true, stepping: true, rots: 2,
  desc: 'Pedras de madeira sobre a água: atravesse a piscina sem se molhar.',
  variants: ['#a8805a', '#a59c8f', '#eceae6'],
  draw(r, o) {
    r.box(5, 5, POOL.surface - 1, 22, 22, 4, o.color, { tex: { top: (u, v) => (Math.floor(v) % 5 === 0 ? 0.45 : grain('u', 1)(u, v)), left: grain('u', 2), right: grain('u', 3) } });
  },
});

add({
  id: 'espreguicadeira', name: 'Espreguiçadeira', cat: 'jardim', size: [1, 2], h: 36, lay: { z: 14, head: [16, 12], sun: true },
  desc: 'Para tomar sol na beira da piscina. Clique para deitar.',
  variants: ['#f4f2ee', '#5f7394', '#e8b4b8', '#d9a23b'],
  draw(r, o) {
    const w = '#c49a6c';
    legs(r, 3, 4, 29, 60, 6, shadeHex(w, 0.3), 3);
    r.box(2, 2, 6, 28, 60, 3, w, { tex: { top: (u, v) => (Math.floor(v) % 5 === 0 ? 0.5 : 0), left: grain('u', 1) } });
    cushion(r, 3, 20, 9, 26, 41, 4, o.color, { round: 2, piping: true });
    r.sdf([{ ...S.intersect(S.cbox(3, 2, 6, 26, 20, 30, 2), { f: (x, y, z) => (z - 9) - (20 - y) * 1.3 - 1.5 + 0 * x, bb: [3, 2, 6, 29, 22, 36] }), mat: o.color }]);
    pillow(r, 16, 10, 25, 14, 5, 6, mix(o.color, '#ffffff', 0.4));
  },
});

add({
  id: 'guarda_sol', name: 'Guarda-sol', cat: 'jardim', size: [1, 1], h: 104, rots: 1,
  desc: 'Guarda-sol de lona com franjinha.',
  variants: ['#efe4cf', '#5f7394', '#e2574c', '#a3b5a0'],
  draw(r, o) {
    r.lathe(16, 16, 0, [9, 9, 8.5, 7, 3], '#d8d4cc', { shiny: true });
    r.lathe(16, 16, 4, new Array(78).fill(1.3), '#c9c4ba', { shiny: true });
    const can = [];
    for (let i = 0; i < 14; i++) { const t = i / 14; can.push(30 * (1 - t) ** 0.9 + 0.5); }
    r.lathe(16, 16, 80, can, o.color, {
      sideTex: (nx, i, dsx, ny) => (Math.abs(Math.sin(Math.atan2(ny, nx) * 4)) < 0.12 ? 0.5 : null),
      topTex: (nx, ny) => (Math.abs(Math.sin(Math.atan2(ny, nx) * 4)) < 0.1 ? 0.4 : null),
    });
    r.lathe(16, 16, 77, [30, 30, 30], mix(o.color, '#ffffff', 0.25), { sideTex: (nx, i, dsx) => (Math.floor(dsx * 20) % 2 ? 0.4 : null) });
  },
});

add({
  id: 'fonte', name: 'Fonte de Água', cat: 'jardim', size: [1, 1], h: 56, frames: 4, fps: 6, rots: 1,
  desc: 'Fonte de pedra com jato de água borbulhante.',
  variants: ['#d8d4cc', '#a59c8f', '#eceae6'],
  draw(r, o) {
    const s = o.color, f = o.frame;
    r.lathe(16, 16, 0, [13, 13, 13.4, 13.6, 13.6, 13.6, 13.6, 13.6, 14, 14], s, { topTex: (nx, ny, d) => (d < 0.82 ? { raw: (Math.sin(d * 18 - f * 2) > 0.6 ? '#bfe9fb' : '#5fb7d9') } : 0) });
    r.lathe(16, 16, 10, Array.from({ length: 20 }, (_, i) => 3 - Math.sin(i / 6) * 0.6), s);
    r.lathe(16, 16, 30, [5, 6.5, 7.4, 7.8, 8], s, { topTex: (nx, ny, d) => (d < 0.75 ? { raw: '#5fb7d9' } : 0) });
    const jets = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, t = ((i * 3 + f * 2) % 8) / 8;
      jets.push([Math.floor(16 + Math.cos(a) * 9 * t), Math.floor(16 + Math.sin(a) * 9 * t), Math.floor(48 - t * t * 38), '*#d8f4ff']);
    }
    for (let z = 35; z < 50; z++) jets.push([16, 16, z, '*#e8fbff']);
    r.pts(jets);
  },
});

add({
  id: 'arvore', name: 'Árvore Frondosa', cat: 'jardim', size: [2, 2], h: 170, rots: 2,
  desc: 'Uma árvore grande com copa cheia. Traz o jardim para dentro!',
  variants: ['#5d9b4c', '#7aa83c', '#c87a3a', '#e89ab0'],
  draw(r, o) {
    const leaf = o.color;
    const bark = (x, y, z) => ['#6b4a34', Math.floor(z / 3 + Math.sin(x)) % 3 === 0 ? 0.35 : 0];
    r.sdf([{ ...S.capsule(32, 32, 0, 32, 34, 58, 6.5, 4.2), mat: bark }, { ...S.capsule(32, 34, 44, 18, 28, 80, 3, 1.8), mat: bark }, { ...S.capsule(32, 34, 48, 46, 38, 82, 3, 1.8), mat: bark }, { ...S.capsule(31, 32, 2, 21, 30, 0, 3.4, 1.5), mat: bark }, { ...S.capsule(33, 32, 2, 43, 36, 0, 3.4, 1.5), mat: bark }], { blend: 2.5 });
    const pal = [mix(leaf, '#ffffff', 0.25), leaf, shadeHex(leaf, 0.7), shadeHex(leaf, 1.3)];
    foliage(r, 18, 28, 86, 20, 18, 15, { n: 46, leaf: 5, seed: 2, pal });
    foliage(r, 46, 38, 88, 20, 18, 15, { n: 46, leaf: 5, seed: 5, pal });
    foliage(r, 32, 30, 110, 25, 23, 20, { n: 64, leaf: 5.4, seed: 9, pal });
  },
});

add({
  id: 'cipreste', name: 'Cipreste', cat: 'jardim', size: [1, 1], h: 140, rots: 1,
  desc: 'Cipreste alto e elegante, ótimo em fileiras.',
  variants: ['#4f8a43', '#3f7a52', '#6a9a3a'],
  draw(r, o) {
    const c = o.color;
    r.lathe(16, 16, 0, [9, 9.6, 10, 10, 10, 10, 10, 10, 10.6, 10.6], '#b5a48a');
    r.lathe(16, 16, 10, [3, 3, 3, 2.6, 2.6], '#6b4a34');
    const pal = [mix(c, '#ffffff', 0.2), c, shadeHex(c, 0.8), shadeHex(c, 1.4)];
    const prims = [];
    for (let i = 0; i < 70; i++) {
      const t = i / 70, z = 16 + t * 116, rad = 9.5 * Math.sin(Math.min(1, (t * 1.05)) * Math.PI) ** 0.8 + 1;
      const a = i * 2.4;
      prims.push({ ...S.ellipsoid(16 + Math.cos(a) * rad * 0.6, 16 + Math.sin(a) * rad * 0.6, z, 4.2, 4.2, 6), mat: pal[(i * 7) % 4 === 0 ? 0 : Math.floor(hash(i, 4) * 3) + 1] });
    }
    r.sdf(prims, { blend: 2.5 });
  },
});

add({
  id: 'arbusto', name: 'Arbusto Florido', cat: 'jardim', size: [1, 1], h: 34, rots: 2,
  desc: 'Arbusto redondinho cheio de flores.',
  variants: ['#f08fa8', '#f7f2ea', '#f7d65a', '#c8b0f0', '#e2574c'],
  draw(r, o) {
    foliage(r, 16, 16, 15, 14, 14, 12, { n: 36, leaf: 4.6, seed: 3 });
    if (o.color) {
      const fl = [];
      for (let i = 0; i < 16; i++) { const a = hash(i, 9) * 6.28, b = hash(i, 8) * 1.2; fl.push({ ...S.sphere(16 + Math.cos(a) * Math.cos(b) * 14, 16 + Math.sin(a) * Math.cos(b) * 14, 15 + Math.sin(b) * 13, 1.6), mat: i % 4 === 0 ? '#ffd35a' : o.color }); }
      r.sdf(fl);
    }
  },
});

add({
  id: 'canteiro', name: 'Canteiro de Flores', cat: 'jardim', size: [1, 1], h: 22, rots: 2,
  desc: 'Jardineira de madeira com flores coloridas.',
  variants: ['#a8734a', '#d8d4cc', '#2e2b33'],
  draw(r, o) {
    r.box(2, 4, 0, 28, 24, 10, o.color, { tex: { left: grain('u', 1), right: grain('u', 2) } });
    r.box(4, 6, 9, 24, 20, 1, '#5a3b2b');
    foliage(r, 16, 16, 12, 11, 9, 4, { n: 20, leaf: 3, seed: 6 });
    const cols = ['#f08fa8', '#ffd35a', '#c8b0f0', '#e2574c', '#f4f2ee'];
    const fl = [];
    for (let i = 0; i < 12; i++) fl.push({ ...S.sphere(6 + hash(i, 1) * 20, 8 + hash(i, 2) * 16, 15 + hash(i, 3) * 5, 1.7), mat: cols[i % cols.length] });
    r.sdf(fl);
  },
});

add({
  id: 'poste_jardim', name: 'Poste de Jardim', cat: 'jardim', size: [1, 1], h: 70, states: ['Apagado', 'Aceso'], rots: 1,
  desc: 'Lanterna de jardim com luz amarelinha.',
  variants: ['#2e2b33', '#6f8a7a', C.gold],
  light: (o) => (o.state ? { x: 16, y: 16, z: 58, color: '#ffd28a', r: 130 } : null),
  draw(r, o) {
    r.lathe(16, 16, 0, [6, 6, 5, 3, 2], o.color, { shiny: true });
    r.lathe(16, 16, 5, new Array(46).fill(1.4), o.color, { shiny: true });
    r.box(11, 11, 51, 10, 10, 13, o.state ? '#fff2c4' : '#d8e8ee', { glow: !!o.state, alpha: o.state ? 1 : 0.7 });
    r.box(10, 10, 50, 12, 12, 1.5, o.color); r.box(10, 10, 64, 12, 12, 1.5, o.color);
    r.lathe(16, 16, 65, [8, 6, 4, 2, 1], o.color, { shiny: true });
  },
});

add({
  id: 'fogueira', name: 'Lareira Externa', cat: 'jardim', size: [1, 1], h: 30, states: ['Apagada', 'Acesa'], frames: 3, fps: 8, rots: 1,
  desc: 'Braseiro de pedra para noites frescas.',
  variants: ['#4a4850', '#a59c8f'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 12, color: '#ff9a4a', r: 150, flicker: true } : null),
  draw(r, o) {
    const s = o.color;
    r.box(2, 2, 0, 28, 28, 10, s, { tex: { left: (u, v) => (Math.floor(v) === 7 ? -0.5 : null), top: (u, v) => (u > 4 && u < 24 && v > 4 && v < 24 ? ['#2a2420', 0.3] : null) } });
    if (o.state) {
      const fl = [];
      for (let i = 0; i < 5; i++) {
        const fx = 10 + i * 3, h = 8 + ((i * 5 + o.frame * 4) % 9);
        fl.push({ ...S.ellipsoid(fx, 16 + (i % 2) * 2, 10 + h / 2, 2.4, 2.4, h / 2 + 1), mat: (x, y, z) => ({ raw: z > 10 + h * 0.7 ? '#ffe27a' : z > 10 + h * 0.3 ? '#ffab3d' : '#f2603a' }), glow: true });
      }
      r.sdf(fl);
    } else r.sdf([{ ...S.capsule(9, 16, 11, 23, 16, 11, 1.8), mat: '#6b4430' }, { ...S.capsule(16, 9, 12, 16, 23, 12, 1.8), mat: '#7a5038' }]);
  },
});

add({
  id: 'sofa_externo', name: 'Sofá de Área Externa', cat: 'jardim', size: [2, 1], h: 32, sit: { z: 15 },
  desc: 'Sofá de madeira teca com almofadas brancas e azuis.',
  variants: ['#f4f2ee', '#d8d4cc', '#efe4cf'],
  draw(r, o) {
    const w = '#a8734a', c = o.color;
    r.box(1, 2, 0, 62, 28, 9, w, { tex: { left: (u, v) => (Math.floor(u) % 6 === 0 ? 0.4 : grain('u', 1)(u, v)) } });
    r.box(1, 1, 9, 62, 6, 18, w, { tex: { left: (u, v) => (Math.floor(v) % 4 === 0 ? 0.4 : null) } });
    cushion(r, 4, 9, 9, 28, 20, 6, c, { round: 2.5 }); cushion(r, 32, 9, 9, 28, 20, 6, c, { round: 2.5 });
    cushion(r, 4, 5, 14, 28, 6, 14, c, { round: 3 }); cushion(r, 32, 5, 14, 28, 6, 14, c, { round: 3 });
    pillow(r, 14, 12, 22, 11, 4, 10, '#2f6f7a'); pillow(r, 50, 12, 22, 11, 4, 10, '#2f6f7a');
  },
});

add({
  id: 'mesa_jardim', name: 'Mesa de Jardim', cat: 'jardim', size: [1, 1], h: 30, top: 27, stack: true, rots: 1,
  desc: 'Mesinha redonda de ferro branco.',
  variants: ['#f2efe9', '#2e2b33', '#6f8a7a'],
  draw(r, o) {
    const c = o.color;
    r.sdf([0, 1, 2].map((i) => { const a = i * 2.09; return { ...S.capsule(16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, 0, 16, 16, 24, 1), mat: c }; }));
    r.lathe(16, 16, 24, [13, 14, 14], c, { topTex: (nx, ny, d) => (Math.floor(d * 7) % 2 === 0 && d > 0.2 ? 0.3 : 0) });
  },
});

export const jardim = 1;
