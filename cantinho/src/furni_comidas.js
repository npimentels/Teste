// Comidas e bebidas (comestíveis estilo Habbo)
//
// food:      { item, portions } → cada "uso" serve uma porção na mão do avatar e
//            o estado avança (o bolo perde uma fatia, a pizza um pedaço...)
// dispenser: [itens] → serve à vontade (bule, jarra, pipoqueira...)
import { add, C, S, grain, panel, marble, first, legs, cushion, pot, shadeHex, mix, hash } from './furni_base.js';

const portionStates = (n, empty = 'Só o prato') => Array.from({ length: n + 1 }, (_, i) => (i === 0 ? 'Inteiro' : i === n ? empty : `${n - i} de ${n}`));

// Fatia em cunha: mantém o ângulo [0, A] em volta de (cx, cy)
function wedge(cx, cy, A) {
  return {
    f: (x, y) => {
      const px = x - cx, py = y - cy;
      const d1 = -py, d2 = Math.cos(A) * py - Math.sin(A) * px;
      return A <= Math.PI ? Math.max(d1, d2) : Math.min(d1, d2);
    },
    bb: [-1e3, -1e3, -1e3, 1e3, 1e3, 1e3],
  };
}

add({
  id: 'bolo', name: 'Bolo de Chocolate', cat: 'comidas', size: [1, 1], h: 30, small: true, rots: 1,
  states: portionStates(6), food: { item: 'bolo', portions: 6 },
  desc: 'Bolo com morangos. Cada uso serve uma fatia até sobrar só o prato.',
  variants: ['#6a3f26', '#f4e2c8', '#e8a0b4'],
  draw(r, o) {
    r.lathe(16, 16, 0, [5, 5, 3, 2, 2, 2, 2, 3, 12.5, 13], C.white, { shiny: true });
    const left = 6 - o.state;
    if (left <= 0) { r.pts([[14, 18, 10, '#6a3f26'], [18, 13, 10, '#6a3f26'], [16, 16, 10, '#f4f2ee']]); return; }
    const cake = S.cyl(16, 16, 10, 24, 10.5, 1.5);
    const shape = left === 6 ? cake : S.intersect(cake, wedge(16, 16, (Math.PI * 2 * left) / 6));
    const sponge = o.color, cream = '#fbf3e6';
    r.sdf([{ ...shape, mat: (x, y, z, nx, ny, nz) => {
      if (nz > 0.6) return [sponge === '#f4e2c8' ? '#fff6ea' : mix(sponge, '#3a2016', 0.3), 0];
      if (Math.abs(z - 17) < 1 || z > 22.6) return cream;
      return sponge;
    } }]);
    const berries = [];
    for (let i = 0; i < 6; i++) {
      const a = (i + 0.5) / 6 * Math.PI * 2;
      if (i >= left) continue;
      berries.push({ ...S.sphere(16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 26, 2), mat: '#e2574c' });
    }
    if (berries.length) r.sdf(berries);
  },
});

add({
  id: 'pizza', name: 'Pizza na Tábua', cat: 'comidas', size: [1, 1], h: 8, small: true, rots: 1,
  states: portionStates(8, 'Só a tábua'), food: { item: 'pizza', portions: 8 },
  desc: 'Pizza de calabresa quentinha. Oito pedaços para dividir.',
  variants: ['#c94f3a', '#f7d65a'],
  draw(r, o) {
    r.lathe(16, 16, 0, [13.5, 13.5, 13.5], '#c49a6c', { topTex: grain('u', 1) ? (nx, ny) => grain('u', 1)(nx * 20, ny * 20) : null });
    const left = 8 - o.state;
    if (left <= 0) return;
    const disk = S.cyl(16, 16, 3, 5, 12, 1);
    const shape = left === 8 ? disk : S.intersect(disk, wedge(16, 16, (Math.PI * 2 * left) / 8));
    r.sdf([{ ...shape, mat: (x, y, z) => {
      const d = Math.hypot(x - 16, y - 16);
      if (d > 10.6) return '#d9a65e';
      const px = Math.floor(x / 3.4), py = Math.floor(y / 3.4);
      if (hash(px, py, 4) > 0.75 && (x % 3.4) > 0.8 && (y % 3.4) > 0.8) return o.color === '#c94f3a' ? '#b8323a' : '#5fa64a';
      if (hash(px, py, 9) > 0.88) return '#2a2a30';
      return hash(Math.floor(x), Math.floor(y)) > 0.5 ? '#f7d65a' : '#f3c84a';
    } }]);
  },
});

add({
  id: 'fruteira', name: 'Fruteira', cat: 'comidas', size: [1, 1], h: 22, small: true, rots: 1,
  states: portionStates(5, 'Vazia'), food: { item: 'maca', portions: 5 },
  desc: 'Tigela com maçãs, laranja, bananas e uvas.',
  variants: [C.white, '#c49a6c', '#5f7394'],
  draw(r, o) {
    r.lathe(16, 16, 0, [4, 4, 3, 5, 8, 10, 11, 11.6, 12], o.color, { shiny: true, topTex: (nx, ny, d) => (d < 0.88 ? [shadeHex(o.color, 1), 0] : 0) });
    const left = 5 - o.state;
    const fr = [
      () => ({ ...S.sphere(12, 14, 12, 3.6), mat: '#e2574c' }),
      () => ({ ...S.sphere(20, 13, 12, 3.6), mat: '#f3a64a' }),
      () => ({ ...S.capsule(10, 20, 12, 20, 22, 13, 2), mat: '#f7d65a' }),
      () => ({ ...S.sphere(17, 19, 14, 3.4), mat: '#7fbf4a' }),
      () => ({ ...S.sphere(15, 15, 16, 3.2), mat: '#c94f3a' }),
    ];
    const prims = fr.slice(0, left).map((f) => f());
    if (left > 2) for (let i = 0; i < 6; i++) prims.push({ ...S.sphere(21 + (i % 2) * 2, 18 + Math.floor(i / 2) * 1.6, 13 + (i % 3), 1.3), mat: '#7a4a9a' });
    if (prims.length) r.sdf(prims);
  },
});

add({
  id: 'cookies', name: 'Prato de Cookies', cat: 'comidas', size: [1, 1], h: 10, small: true, rots: 1,
  states: portionStates(6), food: { item: 'cookie', portions: 6 },
  desc: 'Cookies com gotas de chocolate, recém-saídos do forno.',
  variants: [C.white, '#9fd0c8', '#e8b4b8'],
  draw(r, o) {
    r.lathe(16, 16, 0, [8, 10, 11, 11.4], o.color, { shiny: true });
    const left = 6 - o.state;
    const pos = [[12, 13, 4], [20, 14, 4], [15, 20, 4], [16, 15, 6], [13, 17, 8], [18, 17, 9]];
    const prims = pos.slice(0, left).map(([x, y, z]) => ({ ...S.cyl(x, y, z, z + 1.6, 4, 0.6), mat: (a, b) => ((Math.floor(a * 1.4) * 7 + Math.floor(b * 1.4) * 3) % 5 === 0 ? '#5a3b2b' : '#d9a65e') }));
    if (prims.length) r.sdf(prims);
  },
});

add({
  id: 'rosquinhas', name: 'Caixa de Rosquinhas', cat: 'comidas', size: [1, 1], h: 12, small: true,
  states: portionStates(6, 'Caixa vazia'), food: { item: 'rosquinha', portions: 6 },
  desc: 'Seis rosquinhas com cobertura colorida.',
  variants: ['#f08fa8', '#9fd0f0', '#f7d65a'],
  draw(r, o) {
    r.box(3, 7, 0, 26, 18, 4, '#f4f2ee', { tex: { left: (u, v) => (Math.floor(u) % 6 === 2 && v > 1 ? o.color : null) } });
    r.box(3, 3, 3, 26, 4, 14, '#f4f2ee', { tex: { left: (u, v) => (v > 4 && v < 9 && u > 5 && u < 21 ? [o.color, -0.2] : null) } });
    const left = 6 - o.state, tops = [o.color, '#6a3f26', '#f4f2ee'];
    const prims = [];
    for (let i = 0; i < left; i++) {
      const x = 9 + (i % 3) * 7, y = 12 + Math.floor(i / 3) * 7;
      prims.push({ ...S.torus(x, y, 5, 2.4, 1.3), mat: (a, b, c) => (c > 5.3 ? tops[i % 3] : '#d9a65e') });
    }
    if (prims.length) r.sdf(prims);
  },
});

add({
  id: 'xicara_cafe', name: 'Xícara de Café', cat: 'comidas', size: [1, 1], h: 12, small: true, rots: 2, frames: 3, fps: 3,
  states: ['Cheia', 'Vazia'], food: { item: 'cafe', portions: 1 },
  desc: 'Cafezinho fumegante no pires.',
  variants: [C.white, '#5f7394', '#e8b4b8', '#2e2b33'],
  draw(r, o) {
    r.lathe(16, 16, 0, [6, 7, 7.4], o.color, { shiny: true });
    r.lathe(16, 16, 2, [3, 3.6, 4, 4.3, 4.5, 4.6, 4.7], o.color, { shiny: true, topTex: (nx, ny, d) => (d < 0.8 ? (o.state ? [shadeHex(o.color, 1.4), 0] : ['#6a3f26', 0]) : 0) });
    r.sdf([{ ...S.torusXZ(21.5, 16, 6, 2, 0.7), mat: o.color }]);
    if (!o.state) r.pts([[15, 16, 12 + o.frame, '*#f4f4fa'], [16, 15, 14 + o.frame, '*#e8e8f2'], [15, 16, 16 + o.frame, '*#dcdcea']]);
  },
});

add({
  id: 'bule_cha', name: 'Jogo de Chá', cat: 'comidas', size: [1, 1], h: 20, small: true, rots: 2, dispenser: ['cha'],
  desc: 'Bule de porcelana com duas xícaras. Sirva-se à vontade!',
  variants: [C.white, '#9fd0c8', '#e8b4b8'],
  draw(r, o) {
    const c = o.color;
    r.lathe(14, 16, 0, [4, 6, 7.4, 8, 8.2, 8.2, 8, 7.4, 6.4, 5, 3.6, 2.6, 2.2, 1.4, 1.2, 1.8], c, { shiny: true, sideTex: (nx, i) => (i === 6 ? '#5f7394' : null) });
    r.sdf([{ ...S.capsule(21, 16, 5, 25, 16, 11, 1.1), mat: c }, { ...S.torusXZ(6, 16, 8, 3, 0.9), mat: c }]);
    for (const [x, y] of [[25, 25], [7, 27]]) { r.lathe(x, y, 0, [3.4, 3.6], c); r.lathe(x, y, 1, [2, 2.4, 2.8, 3], c, { topTex: (nx, ny, d) => (d < 0.75 ? ['#c9853a', 0] : 0) }); }
  },
});

add({
  id: 'jarra_suco', name: 'Jarra de Suco', cat: 'comidas', size: [1, 1], h: 22, small: true, rots: 1, dispenser: ['suco'],
  desc: 'Suco de laranja geladinho com dois copos.',
  variants: ['#f3a64a', '#e2574c', '#9fd36a'],
  draw(r, o) {
    r.lathe(14, 15, 0, [5, 5.4, 5.6, 5.6, 5.6, 5.6, 5.6, 5.6, 5.6, 5.4, 5.2, 5, 5, 5.2, 5.4, 5.6, 5.8], o.color, { topTex: (nx, ny, d) => (d < 0.8 ? [o.color, -0.4] : { raw: '#e8f6fb' }) });
    r.lathe(14, 15, 0, [5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 6, 6.2, 6.4], C.glass, { alpha: 0.35 });
    r.sdf([{ ...S.torusXZ(20.5, 15, 11, 3.2, 0.8), mat: C.glass, alpha: 0.6 }]);
    for (const [x, y] of [[24, 24], [8, 26]]) r.lathe(x, y, 0, [2.4, 2.4, 2.5, 2.5, 2.6, 2.6, 2.6, 2.7], o.color, { topTex: () => ({ raw: '#e8f6fb' }), sideTex: (nx, i) => (i > 5 ? '#e8f6fb' : null) });
  },
});

add({
  id: 'pipoqueira', name: 'Pipoqueira', cat: 'comidas', size: [1, 1], h: 80, rots: 2, dispenser: ['pipoca'], frames: 3, fps: 5,
  desc: 'Carrinho de pipoca de cinema! Use para pegar um saquinho.',
  variants: ['#e2574c', '#5f7394', '#f7d65a'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[5, 6], [24, 6], [5, 24], [24, 24]]) r.box(x, y, 0, 3, 3, 30, C.chrome);
    r.sdf([{ ...S.cyl(4, 27, 2, 8, 4, 1), mat: '#2a2a30' }, { ...S.cyl(28, 27, 2, 8, 4, 1), mat: '#2a2a30' }]);
    r.box(3, 4, 30, 26, 24, 14, c, { tex: { left: (u, v) => (v > 4 && v < 10 && u > 4 && u < 22 ? ['#ffd35a', 0] : null) } });
    r.box(4, 5, 44, 24, 22, 2, C.chrome);
    const pop = [];
    for (let i = 0; i < 26; i++) pop.push({ ...S.sphere(7 + hash(i, 1) * 18, 8 + hash(i, 2) * 16, 47 + hash(i, 3) * 6, 1.8), mat: hash(i, 4) > 0.8 ? '#f3c84a' : '#fbeec0' });
    r.sdf(pop, { blend: 0.6 });
    const f = o.frame;
    r.pts([[12 + f * 3, 15, 58 + f * 3, '#fbeec0'], [20 - f * 2, 12, 62 - f, '#fbeec0'], [16, 18 - f, 56 + f * 2, '#fbeec0']]);
    r.box(4, 5, 46, 24, 22, 22, C.glass, { alpha: 0.25 });
    r.box(3, 4, 68, 26, 24, 4, c, { tex: { left: (u, v) => (Math.floor(u) % 4 === 0 ? '#f4f2ee' : null) } });
    r.box(3, 4, 72, 26, 24, 2, C.gold);
  },
});

add({
  id: 'carrinho_sorvete', name: 'Carrinho de Sorvete', cat: 'comidas', size: [2, 1], h: 92, dispenser: ['sorvete'],
  desc: 'Sorvete de morango na casquinha, à vontade.',
  variants: ['#9fd0f0', '#f08fa8', '#9fd36a'],
  draw(r, o) {
    const c = o.color;
    r.sdf([{ ...S.cyl(8, 26, 3, 7, 7, 1), mat: '#2a2a30' }, { ...S.cyl(56, 26, 3, 7, 7, 1), mat: '#2a2a30' }]);
    r.box(4, 6, 6, 56, 22, 28, c, { tex: { left: (u, v) => (v > 8 && v < 20 && u > 10 && u < 46 ? ['#f4f2ee', 0] : Math.floor(u) % 8 === 0 ? 0.3 : null) } });
    r.box(4, 6, 34, 56, 22, 3, C.chrome, { tex: { top: (u, v) => { const k = Math.floor(u / 14); if (u % 14 > 2 && v > 5 && v < 17) return [['#f08fa8', '#fbf3e6', '#6a3f26', '#9fd36a'][k % 4], 0]; return null; } } });
    r.lathe(32, 17, 37, new Array(50).fill(1.2), C.chrome);
    const can = [];
    for (let i = 0; i < 10; i++) can.push(26 * (1 - i / 10) + 0.5);
    r.lathe(32, 17, 84, can, '#f4f2ee', { sideTex: (nx, i, dsx, ny) => (Math.floor((Math.atan2(ny, nx) + 4) * 2.5) % 2 ? c : null), topTex: (nx, ny) => (Math.floor((Math.atan2(ny, nx) + 4) * 2.5) % 2 ? c : null) });
  },
});

export const comidas = 1;
