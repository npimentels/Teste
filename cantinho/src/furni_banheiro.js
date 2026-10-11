// Banheiro (branco rústico, inspirado nas referências)
import { add, C, S, grain, panel, marble, first, legs, turnedLeg, cushion, foliage, pot, shadeHex, mix, hash } from './furni_base.js';

add({
  id: 'banheira', name: 'Banheira Vitoriana', cat: 'banheiro', size: [2, 1], h: 30, states: ['Vazia', 'Com espuma'], frames: 3, fps: 2,
  sit: { z: 9, cut: 20 },
  desc: 'Banheira com pés de garra. Encha de espuma e entre!',
  variants: [C.white, '#e8b4b8', '#9fd0c8', '#2e2b33'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[9, 8], [55, 8], [9, 24], [55, 24]]) r.sdf([{ ...S.sphere(x, y, 2.5, 2.6), mat: C.gold }, { ...S.capsule(x, y, 3, x, y, 7, 1.8), mat: C.gold }]);
    const outer = S.blend(3, S.cbox(4, 3, 6, 56, 26, 20, 9), S.cbox(2, 2, 18, 60, 28, 6, 3));
    const inner = S.cbox(8, 6, 9, 48, 20, 22, 7);
    r.sdf([{ ...S.subtract(outer, inner), mat: (x, y, z) => (z > 23 ? [mix(c, '#ffffff', 0.4), 0] : c) }]);
    r.sdf([{ ...S.capsule(56, 16, 22, 56, 16, 30, 1.1), mat: C.gold }, { ...S.capsule(56, 16, 30, 52, 16, 30, 1), mat: C.gold }]);
    if (o.state) {
      const foam = [];
      for (let i = 0; i < 22; i++) {
        const x = 11 + hash(i, 1) * 42, y = 8 + hash(i, 2) * 16, z = 21 + hash(i, 3) * 4 + ((i + o.frame) % 3 === 0 ? 1 : 0);
        foam.push({ ...S.sphere(x, y, z, 2.6 + hash(i, 4) * 2.4), mat: hash(i, 5) > 0.7 ? '#e6f3fb' : '#ffffff' });
      }
      r.sdf(foam, { blend: 1.6 });
    } else r.box(8, 6, 16, 48, 20, 1, C.water, { alpha: 0.35 });
  },
});

add({
  id: 'vaso_sanitario', name: 'Vaso Sanitário', cat: 'banheiro', size: [1, 1], h: 44, sit: { z: 16 }, states: ['Tampa fechada', 'Tampa aberta'],
  desc: 'Louça branca com caixa acoplada. Também dá para sentar.',
  variants: [C.white, '#2e2b33'],
  draw(r, o) {
    const c = o.color;
    r.sdf([{ ...S.cbox(7, 3, 12, 18, 9, 30, 3), mat: c }, { ...S.cbox(6, 2, 40, 20, 11, 3, 1.5), mat: c }, { ...S.cbox(10, 9, 0, 12, 8, 14, 3), mat: c }], { blend: 2 });
    r.sdf([{ ...S.capsule(22, 8, 37, 22, 10, 37, 1.1), mat: C.chrome }]);
    const bowl = S.blend(4, S.cone(16, 18, 0, 13, 6, 9), S.ellipsoid(16, 18, 13, 9.5, 11.5, 4), S.cbox(9, 9, 2, 14, 8, 13, 3));
    r.sdf([{ ...bowl, mat: c }]);
    if (o.state) {
      r.sdf([{ ...S.subtract(S.ellipsoid(16, 19, 15.5, 9, 11, 1.4), S.ellipsoid(16, 20, 15.5, 6, 7.5, 3)), mat: c }]);
      r.sdf([{ ...S.ellipsoid(16, 20, 14.6, 6, 7.4, 0.6), mat: { raw: '#a8d8ec' } }]);
      r.sdf([{ ...S.cbox(7, 9, 16, 18, 2, 18, 4), mat: c }]);
    } else r.sdf([{ ...S.ellipsoid(16, 19, 16, 9, 11, 1.6), mat: c }]);
  },
});

add({
  id: 'pia_banheiro', name: 'Gabinete com Cuba', cat: 'banheiro', size: [2, 1], h: 52, top: 30,
  desc: 'Gabinete de madeira com cuba de apoio, torneira preta e saboneteira.',
  variants: [C.oak, C.walnut, C.white, '#6f8a7a'],
  draw(r, o) {
    const c = o.color, g = grain('v', 4);
    r.box(2, 4, 0, 60, 24, 6, shadeHex(c, 0.5));
    r.box(1, 3, 6, 62, 25, 22, c, { tex: { left: first((u, v) => (Math.abs(u - 31) < 0.7 ? 0.9 : null), (u, v) => ((Math.floor(u) === 27 || Math.floor(u) === 35) && v > 9 && v < 15 ? C.black : null), (u, v) => panel(u, v, 3, 2, 29, 19) ?? panel(u, v, 33, 2, 59, 19), g), right: g } });
    r.box(0, 2, 28, 64, 27, 2, C.marble, { tex: { top: marble(4), left: marble(2), right: marble(3) } });
    r.lathe(30, 17, 30, [7, 9, 10.5, 11.2, 11.6, 11.8, 11.8], C.white, { shiny: true, topTex: (nx, ny, d) => (d < 0.82 ? ['#e8eef2', 0.6 + (1 - d) * 0.5] : 0) });
    r.sdf([{ ...S.capsule(30, 4, 30, 30, 4, 44, 1.1), mat: '#2a2a30' }, { ...S.capsule(30, 4, 44, 30, 11, 44, 1), mat: '#2a2a30' }, { ...S.capsule(30, 11, 44, 30, 12, 41, 0.9), mat: '#2a2a30' }]);
    r.lathe(52, 12, 30, [2.6, 3, 3, 3, 3, 3, 2.6, 1, 1, 1.4], '#e8e2d8', { shiny: true, topTex: () => C.black });
    r.lathe(10, 12, 30, [3, 3.4, 3.4, 3.4, 3.2, 3], '#f4f2ee', { topTex: (nx, ny, d) => (d < 0.3 ? 0.8 : 0) });
  },
});

add({
  id: 'box_chuveiro', name: 'Box com Chuveiro', cat: 'banheiro', size: [1, 1], h: 104, states: ['Desligado', 'Ligado'], frames: 3, fps: 8, walk: true,
  desc: 'Box de vidro com ducha. Ligue e entre debaixo da água!',
  variants: [C.chrome, C.black, C.gold],
  draw(r, o) {
    const m = o.color;
    r.box(0, 0, 0, 32, 32, 3, C.white, { tex: { top: (u, v) => (Math.hypot(u - 16, v - 16) < 2 ? ['#9aa3ad', 0] : (Math.floor(u) % 8 === 0 || Math.floor(v) % 8 === 0 ? 0.3 : 0)) } });
    r.sdf([{ ...S.capsule(4, 3, 3, 4, 3, 86, 0.9), mat: m }, { ...S.capsule(4, 3, 86, 16, 12, 92, 0.9), mat: m }, { ...S.cyl(16, 12, 88, 91, 4.6, 1), mat: m }]);
    r.sdf([{ ...S.cbox(8, 1, 40, 6, 2, 8, 1), mat: m }]);
    if (o.state) {
      const drops = [];
      for (let i = 0; i < 26; i++) {
        const x = 12 + hash(i, 1) * 8, y = 8 + hash(i, 2) * 8, z = 4 + ((hash(i, 3) * 84 + o.frame * 28) % 84);
        drops.push([Math.floor(x), Math.floor(y), Math.floor(z), '*#d8f2ff']);
      }
      r.pts(drops);
    }
    r.box(31, 0, 3, 1, 32, 98, C.glass, { alpha: 0.22 });
    r.box(0, 31, 3, 32, 1, 98, C.glass, { alpha: 0.22 });
    r.box(30.5, 0, 3, 1.5, 32, 2, m); r.box(0, 30.5, 3, 32, 1.5, 2, m);
    r.box(30.5, 0, 99, 1.5, 32, 2, m); r.box(0, 30.5, 99, 32, 1.5, 2, m);
    r.box(30.5, 30.5, 3, 1.5, 1.5, 98, m);
  },
});

add({
  id: 'toalheiro', name: 'Toalheiro de Pé', cat: 'banheiro', size: [1, 1], h: 56, rots: 2,
  desc: 'Escada de madeira com toalhas felpudas.',
  variants: ['#f4f2ee', '#e8b4b8', '#a3b5a0', '#5f7394'],
  draw(r, o) {
    const w = C.oak;
    r.sdf([{ ...S.capsule(5, 10, 0, 5, 16, 54, 1.2), mat: w }, { ...S.capsule(27, 10, 0, 27, 16, 54, 1.2), mat: w }]);
    for (const z of [16, 30, 44]) r.sdf([{ ...S.capsule(5, 10 + z / 9, z, 27, 10 + z / 9, z, 0.9), mat: w }]);
    r.sdf([{ ...S.cbox(7, 11, 20, 18, 7, 26, 2), mat: (x, y, z) => [o.color, Math.floor(z) % 5 === 0 ? 0.3 : 0] }]);
    r.sdf([{ ...S.cbox(8, 13, 36, 16, 5, 10, 2), mat: mix(o.color, '#ffffff', 0.4) }]);
  },
});

add({
  id: 'cesto_roupa', name: 'Cesto de Vime', cat: 'banheiro', size: [1, 1], h: 30, rots: 1,
  desc: 'Cesto de palha trançada com toalhas dobradas.',
  variants: ['#c9a36a', '#8a6a4a', '#f2efe9'],
  draw(r, o) {
    r.lathe(16, 16, 0, Array.from({ length: 24 }, (_, i) => 8 + i * 0.12), o.color, { sideTex: (nx, i, dsx) => ((Math.floor(dsx * 8) + Math.floor(i / 2)) % 2 ? 0.35 : 0), topTex: (nx, ny, d) => (d > 0.86 ? 0 : ['#5a4034', 0.4]) });
    r.sdf([{ ...S.cbox(10, 10, 20, 12, 12, 8, 2.5), mat: '#f4f2ee' }, { ...S.cbox(11, 11, 27, 10, 10, 4, 2), mat: '#e8b4b8' }]);
  },
});

add({
  id: 'tapete_banheiro', name: 'Tapete de Banheiro', cat: 'banheiro', size: [1, 1], h: 2, walk: true, flat: true, rots: 2,
  desc: 'Tapetinho felpudo para sair do banho.',
  variants: ['#f4f2ee', '#a3b5a0', '#e8b4b8', '#5f7394'],
  draw(r, o) {
    r.box(4, 6, 0, 24, 20, 1.5, o.color, { tex: { top: (u, v) => (Math.min(u, v, 24 - u, 20 - v) < 1 ? 0.5 : (hash(Math.floor(u), Math.floor(v)) - 0.5) * 0.4) } });
  },
});

add({
  id: 'suporte_papel', name: 'Escova e Papel', cat: 'banheiro', size: [1, 1], h: 26, small: true, rots: 2,
  desc: 'Suporte de papel higiênico e escovinha. Os detalhes contam!',
  variants: [C.chrome, C.black, C.gold],
  draw(r, o) {
    r.lathe(10, 16, 0, [4, 4, 3.6, 3.4, 3.4, 3.4, 3.4, 3.4, 3.4, 3.6], o.color, { shiny: true });
    r.sdf([{ ...S.capsule(10, 16, 9, 10, 16, 22, 0.7), mat: o.color }, { ...S.sphere(10, 16, 23, 1.3), mat: o.color }]);
    r.sdf([{ ...S.capsule(22, 16, 0, 22, 16, 18, 0.8), mat: o.color }, { ...S.cyl(22, 16, 10, 18, 4.6, 1.6), mat: '#ffffff' }]);
  },
});

export const banheiro = 1;
