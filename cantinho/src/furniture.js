// Catálogo de mobílias (inspirado nas "mobis" do Habbo, com tempero cozy/bruxinho).
//
// Cada definição descreve a peça na rotação 0, com a FRENTE virada para +Y
// (face esquerda na tela). A rotação 1 é gerada automaticamente trocando X↔Y.
//
// Campos principais:
//   size [w, d]   pegada em tiles (rotação 0)
//   h             altura máxima aproximada (para o tamanho do sprite)
//   top           altura da superfície onde outras mobis podem ser empilhadas
//   sit / lay     altura do assento / colchão (o avatar pode sentar/deitar)
//   walk          true ou (state) => bool : se dá para andar por cima
//   states        nomes dos estados; duplo clique alterna (porta, luz…)
//   variants      cores disponíveis
//   light         (o) => fonte de luz {x, y, z, color, r} em unidades locais
//   frames/fps    animação
//   wall          mobi de parede: size = [largura em unidades, altura px]

import { shadeHex, mix, hash } from './color.js';

const C = {
  wood: '#b0744a', woodD: '#7d4c31', woodL: '#d39b63', woodR: '#8e3f2f',
  cream: '#f1e4c6', white: '#f3efe6', metal: '#8d93a6', iron: '#3c3546', gold: '#e8b34b',
  brick: '#b25a42', stone: '#a59c8f', leaf: '#5d9b4c', terra: '#c8693f', dark: '#2b2232',
};

const legs = (r, x0, y0, x1, y1, h, col, s = 2) => {
  r.box(x0, y0, 0, s, s, h, col);
  r.box(x1 - s, y0, 0, s, s, h, col);
  r.box(x0, y1 - s, 0, s, s, h, col);
  r.box(x1 - s, y1 - s, 0, s, s, h, col);
};

const planks = (step, axis = 'v') => (u, v) => {
  const t = axis === 'v' ? v : u;
  return Math.floor(t) % step === 0 ? 0.45 : 0;
};

const sphere = (R, squash = 1) => {
  const out = [];
  const H = Math.round(R * 2 * squash);
  for (let i = 0; i < H; i++) {
    const t = (i + 0.5) / H * 2 - 1;
    out.push(Math.max(0.6, R * Math.sqrt(1 - t * t)));
  }
  return out;
};

// ----------------------------------------------------------------- céu
export function skyColor(env, u, v, w, h, frame = 0) {
  const t = v / h; // 0 base … 1 topo
  const band = Math.floor(t * 5 + (hash(u, v) < 0.25 ? 0.5 : 0));
  if (env === 'night') {
    const s = hash(Math.floor(u), Math.floor(v), 7);
    if (s > 0.965) return (frame + Math.floor(s * 100)) % 7 === 0 ? '#9fa8ff' : '#fff6c8';
    const mx = u - w * 0.7, my = v - h * 0.72;
    if (mx * mx + my * my < 9) return mx + my > 1.5 ? '#c9c1a0' : '#fff3c4';
    return ['#2b2f6b', '#262a60', '#20244f', '#1b1f45', '#171a3b', '#141632'][Math.min(5, band)];
  }
  if (env === 'dusk') {
    const sx = u - w * 0.3, sy = v - h * 0.25;
    if (sx * sx + sy * sy < 10) return '#fff0a8';
    return ['#ffd27a', '#ffb06a', '#f08a6a', '#c96a86', '#8a5c9e', '#5c4c8f'][Math.min(5, band)];
  }
  // dia: nuvenzinhas
  const cl = (cx, cy, rx) => {
    const dx = (u - cx) / rx, dy = (v - cy) / (rx * 0.45);
    return dx * dx + dy * dy < 1;
  };
  if (cl(w * 0.3, h * 0.62, 6) || cl(w * 0.42, h * 0.68, 4) || cl(w * 0.78, h * 0.35, 5))
    return v > h * 0.62 || (v > h * 0.32 && v < h * 0.38) ? '#ffffff' : '#e6f3ff';
  return ['#d5f0ff', '#c2e7ff', '#addcff', '#9ad1ff', '#88c5fb', '#78b8f4'][Math.min(5, band)];
}

// ------------------------------------------------------------- mapas
const LEAVES = [
  '.......OO.........',
  '......OgGO..OO....',
  '..OO..OgGDOOgGO...',
  '.OggO.OgGDOggGDO..',
  '.OgGGOOgGGDgGGDO..',
  '..OgGGDOgGDGGDO.OO',
  'OO.OGGDDOGDGDDOOgO',
  'OgOO.OOGDGGOODOggO',
  'OggGOOGOGGGOgOgGDO',
  '.OGGGDDGGGGGGGDDO.',
  '..OODGDGGgGGGDDO..',
  '....OODGGGgGDOO...',
  '......OOGGGDOO....',
  '........OGDO......',
];
const LEAF_PAL = { O: '#22402b', g: '#9fd16a', G: '#5f9f4b', D: '#3a7240' };

const CACTUS = [
  '...OO...',
  '..OgGO..',
  'O.OgGO..',
  'gOOgGO.O',
  'GOOgGOOg',
  'GDOgGDOG',
  'OGGgGGDO',
  '.OOgGOO.',
  '..OgGO..',
  '..OgGO..',
];
const FERN = [
  '..O.....O...O..',
  '.OgO..O.gO.OgO.',
  'OgGDOOgOGDOgGDO',
  '.OGDOgGDGDOGDO.',
  'O.OGDGGDGDGDO.O',
  'gOOOGGDGDGGOOOg',
  'OGDDGGgGGDGDDGO',
  '.OOGGGGgGGGDOO.',
  '...OODGGGDOO...',
];
const FLOWERS = [
  '.OpO.OyO.',
  'OpwpOyxyO',
  '.OpOGOyO.',
  'OrO.G.OGO',
  'rwrOGOGO.',
  'OrOGGO...',
  '..OGO....',
];
const FLOWER_PAL = { O: '#3b2a3a', p: '#f08fb0', w: '#fff3c4', y: '#ffd35a', x: '#f08a3a', r: '#e2574c', G: '#5f9f4b' };

const FIRE = [
  [
    '.....y......',
    '....yy...y..',
    '...yoy..yo..',
    '..yoooyyoy..',
    '..yorooyoo..',
    '.yorrrrooy..',
    '.oorrrrrroy.',
    'yorrwwrrrooy',
    'orrwwwwrrroo',
  ],
  [
    '......y.....',
    '..y...yy....',
    '..oy.yoy....',
    '..yooyooy...',
    '.yoorroooy..',
    '.oorrrrrooy.',
    'yorrrwrrroo.',
    'orrwwwwrrroy',
    'orrwwwwwrroo',
  ],
  [
    '...y........',
    '...yy...y...',
    '..yoy..yoy..',
    '..yooyyooy..',
    '.yoorrooroy.',
    '.yorrrrrroo.',
    'yorrrwwrrroy',
    'orrwwwwwrroo',
    'orrwwwwrrroo',
  ],
];
const FIRE_PAL = { y: '*#ffe27a', o: '*#ffab3d', r: '*#f2603a', w: '*#fff8d8' };
const LOGS = ['.ObbbbbbbbO.', 'ObbcbbbbcbbO', '.OOOOOOOOOO.'];
const LOG_PAL = { O: '#3a2420', b: '#7d4c31', c: '#c08a55' };

const FLAME = [
  ['.y.', 'yoy', 'owo', '.o.'],
  ['y..', 'yoy', 'owo', '.o.'],
  ['..y', 'yoy', 'owo', '.o.'],
];
const FLAME_PAL = { y: '*#ffe27a', o: '*#ffab3d', w: '*#fffbe8' };

const STEAM = [
  ['..o..', '.o...', '..o..', '...o.', '.....'],
  ['.o...', '..o..', '...o.', '..o..', '.o...'],
  ['...o.', '..o..', '.o...', '..o..', '...o.'],
];

const BOTTLE_COLORS = ['#e2574c', '#6fd3a0', '#8a7cf0', '#ffd35a'];

// --------------------------------------------------------------- defs
const defs = [];
const add = (d) => defs.push(d);

// =========================== SALA ===========================
add({
  id: 'sofa', name: 'Sofá Aconchego', cat: 'sala', size: [2, 1], h: 30, sit: { z: 11 },
  desc: 'Sofá fofinho de dois lugares. Clique para sentar.',
  variants: ['#4a9a92', '#c96b80', '#d9a23b', '#8f7bc2', '#7fa86b', '#4b6aa3', '#b5574b'],
  draw(r, o) {
    const c = o.color, dk = C.woodD;
    for (const [x, y] of [[1, 3], [29, 3], [1, 13], [29, 13]]) r.box(x, y, 0, 2, 2, 3, dk);
    r.box(0, 2, 3, 4, 13, 13, c);
    r.box(28, 2, 3, 4, 13, 13, c);
    r.box(4, 2, 3, 24, 5, 21, c, {
      tex: { left: (u, v) => ((Math.floor(u) === 6 || Math.floor(u) === 17) && Math.floor(v) === 15 ? 1.4 : v > 19 ? -0.25 : 0) },
    });
    r.box(4, 7, 3, 24, 8, 5, c, { tex: { left: () => 0.5 } });
    r.box(4, 7, 8, 12, 8, 3, c);
    r.box(16, 7, 8, 12, 8, 3, c);
  },
});

add({
  id: 'poltrona', name: 'Poltrona da Vovó', cat: 'sala', size: [1, 1], h: 28, sit: { z: 11 },
  desc: 'Poltrona estofada, perfeita para ler um livro.',
  variants: ['#c96b80', '#4a9a92', '#d9a23b', '#8f7bc2', '#7fa86b', '#b5574b'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[1, 3], [13, 3], [1, 13], [13, 13]]) r.box(x, y, 0, 2, 2, 3, C.woodD);
    r.box(0, 2, 3, 3, 13, 12, c);
    r.box(13, 2, 3, 3, 13, 12, c);
    r.box(3, 2, 3, 10, 5, 20, c, { tex: { left: (u, v) => (Math.floor(u) === 5 && Math.floor(v) === 14 ? 1.4 : v > 18 ? -0.25 : 0) } });
    r.box(3, 7, 3, 10, 8, 5, c, { tex: { left: () => 0.5 } });
    r.box(3, 7, 8, 10, 8, 3, c);
  },
});

add({
  id: 'cadeira', name: 'Cadeira de Madeira', cat: 'cozinha', size: [1, 1], h: 26, sit: { z: 10 },
  desc: 'Cadeira simples com almofadinha.',
  variants: ['#d94f4f', '#4a9a92', '#d9a23b', '#8f7bc2', '#f1e4c6'],
  draw(r, o) {
    const w = C.wood;
    legs(r, 3, 4, 13, 14, 8, w);
    r.box(3, 4, 8, 10, 10, 2, w);
    r.box(4, 6, 10, 8, 7, 1, o.color);
    r.box(3, 3, 10, 2, 2, 15, w);
    r.box(11, 3, 10, 2, 2, 15, w);
    r.box(5, 3, 21, 6, 2, 3, w);
    r.box(5, 3, 15, 6, 2, 2, w);
  },
});

add({
  id: 'mesa_centro', name: 'Mesa de Centro', cat: 'sala', size: [2, 1], rots: 2, h: 14, top: 10, stack: true,
  desc: 'Mesinha baixa. Dá para empilhar objetos em cima!',
  variants: [C.wood, C.woodL, C.woodR, '#e9e1d2'],
  draw(r, o) {
    legs(r, 2, 3, 30, 13, 7, shadeHex(o.color, 0.6), 2);
    r.box(3, 4, 2, 26, 8, 1, shadeHex(o.color, 0.3));
    r.box(1, 2, 7, 30, 12, 3, o.color, { tex: { top: planks(4) } });
  },
});

add({
  id: 'tapete', name: 'Tapete Persa', cat: 'sala', size: [2, 3], rots: 2, h: 2, walk: true, flat: true,
  desc: 'Tapete grande com padrão de losangos. Dá para andar por cima.',
  variants: ['#b5574b', '#4b6aa3', '#7fa86b', '#8f7bc2', '#d9a23b'],
  draw(r, o) {
    const c = o.color, acc = '#f1d9a0', inner = shadeHex(c, 1.2);
    r.box(2, 2, 0, 28, 44, 1, c, {
      tex: {
        top: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U === 0 || U === 27 || V === 0 || V === 43) return 0.6;
          if (U === 2 || U === 25 || V === 2 || V === 41) return acc;
          if (U < 2 || U > 25 || V < 2 || V > 41) return (U + V) % 4 === 0 ? acc : 0;
          const d = Math.abs(U - 13.5) + Math.abs(V - 21.5);
          if (Math.floor(d) % 8 === 0) return acc;
          if (Math.floor(d) % 8 === 4) return inner;
          return (U + V) % 2 === 0 && Math.floor(d) % 8 === 2 ? -0.6 : 0;
        },
      },
    });
    // franjas
    const f = [];
    for (let x = 3; x < 30; x += 2) { f.push([x, 1, 0, '#f6ead0'], [x, 46, 0, '#f6ead0']); }
    r.pts(f, { after: true });
  },
});

add({
  id: 'tapete_redondo', name: 'Tapete Redondo', cat: 'sala', size: [2, 2], rots: 1, h: 2, walk: true, flat: true,
  desc: 'Tapete de crochê redondinho.',
  variants: ['#e9b8c6', '#a8cfe0', '#f1e4c6', '#b9d99a', '#c9b6ee'],
  draw(r, o) {
    const c = o.color, acc = shadeHex(c, 1.6), lt = shadeHex(c, -1.4);
    r.lathe(16, 16, 0, [15], c, {
      topTex: (nx, ny, d) => {
        const ring = Math.floor(d * 15);
        if (ring >= 14) return acc;
        if (ring === 11 || ring === 6) return lt;
        if (ring === 9 || ring === 3) return acc;
        if (ring === 0) return lt;
        return 0;
      },
    });
  },
});

add({
  id: 'estante', name: 'Estante de Livros', cat: 'sala', size: [2, 1], h: 56,
  desc: 'Estante cheia de livros coloridos.',
  variants: [C.wood, C.woodR, C.woodL, '#6b6f8a'],
  draw(r, o) {
    const books = ['#c94f4f', '#4b6aa3', '#d9a23b', '#4a9a92', '#8f7bc2', '#e9e1d2', '#7fa86b', '#b5574b', '#e88aa6'];
    r.box(0, 1, 0, 32, 12, 50, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U < 2 || U >= 30 || V < 2 || V >= 48) return null;
          if (V === 17 || V === 16 || V === 32 || V === 33) return -0.2;
          const shelf = V < 16 ? 0 : V < 32 ? 1 : 2;
          const base = [2, 18, 34][shelf];
          // larguras variadas de livros
          let x = 2, bi = 0;
          while (x <= U) { const bw = 2 + Math.floor(hash(bi, shelf, 3) * 2); if (U < x + bw) break; x += bw; bi++; }
          const top = 9 + Math.floor(hash(bi, shelf, 5) * 5);
          if (V - base > top || hash(bi, shelf, 9) > 0.86) return [shadeHex(o.color, 2.4), 0];
          const col = books[Math.floor(hash(bi, shelf, 1) * books.length)];
          return [col, U === x ? 0.6 : V - base === top - 2 ? -0.5 : 0];
        },
      },
    });
    r.box(-1, 0, 50, 34, 14, 3, shadeHex(o.color, -0.3));
  },
});

add({
  id: 'luminaria', name: 'Luminária de Chão', cat: 'sala', size: [1, 1], h: 46, states: ['Desligada', 'Ligada'],
  desc: 'Luz quentinha para as noites. Duplo clique liga/desliga.',
  variants: ['#f1e4c6', '#e9b8c6', '#a8cfe0', '#d9a23b'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 34, color: '#ffcf86', r: 95 } : null),
  draw(r, o) {
    r.lathe(8, 8, 0, [5, 5, 4], C.iron, { shiny: true });
    r.box(7, 7, 3, 2, 2, 28, C.metal);
    const prof = [];
    for (let i = 0; i < 12; i++) prof.push(7.5 - i * 0.32);
    r.lathe(8, 8, 30, prof, o.state ? mix(o.color, '#fff4c2', 0.55) : o.color, {
      glow: !!o.state, topTex: (nx, ny, d) => (d < 0.55 ? (o.state ? { raw: '#fffbe0' } : 1.2) : 0),
    });
  },
});

add({
  id: 'tv', name: 'TV Retrô', cat: 'sala', size: [1, 1], h: 34, states: ['Desligada', 'Ligada'], frames: 4, fps: 6,
  desc: 'Televisão de tubo com antena. Duplo clique para assistir!',
  variants: ['#b0744a', '#d94f4f', '#4a9a92', '#e9e1d2'],
  light: (o) => (o.state ? { x: 8, y: 16, z: 14, color: '#8fd0ff', r: 55 } : null),
  draw(r, o) {
    legs(r, 2, 4, 14, 13, 4, C.iron, 2);
    const bars = ['#ff6b6b', '#ffd35a', '#6fe08a', '#5ac8fa', '#a78bfa', '#ff8fd0'];
    r.box(0, 2, 4, 16, 12, 15, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U >= 2 && U <= 10 && V >= 2 && V <= 12) {
            const edge = U === 2 || U === 10 || V === 2 || V === 12;
            if (edge) return [C.dark, 0.6];
            if (!o.state) return (U - V === -6 || U - V === -5) && V > 7 ? { raw: '#5d7a7a' } : { raw: '#2c3a3d' };
            const scan = (V + o.frame * 3) % 10 === 0;
            const col = bars[(Math.floor(U / 2) + o.frame) % bars.length];
            return { raw: scan ? '#ffffff' : col };
          }
          if (U >= 12 && U <= 13 && (V === 9 || V === 5)) return C.gold;
          if (U >= 12 && U <= 13 && V >= 2 && V <= 3) return [C.dark, 0.6];
          return null;
        },
      },
    });
    r.pts([[6, 6, 20, C.iron], [5, 5, 21, C.iron], [4, 4, 22, C.iron], [3, 3, 23, C.iron], [10, 6, 20, C.iron], [11, 5, 21, C.iron], [12, 4, 22, C.iron], [13, 3, 23, C.iron], [13, 3, 24, '#d94f4f'], [3, 3, 24, '#d94f4f']], { after: true });
  },
});

add({
  id: 'planta', name: 'Costela-de-Adão', cat: 'decoracao', size: [1, 1], rots: 2, h: 34,
  desc: 'Uma planta enorme que deixa tudo mais vivo.',
  variants: ['#c8693f', '#e9e1d2', '#4b6aa3', '#3c3546'],
  draw(r, o) {
    r.lathe(8, 8, 0, [4, 4.5, 5, 5, 5.5, 5.5, 6, 6, 6.5, 6.5, 6.5], o.color, {
      topTex: (nx, ny, d) => (d < 0.8 ? ['#5a3b2b', 0] : 0),
    });
    r.map(8, 8, 9, LEAVES, LEAF_PAL, { ax: 8, ay: 13, after: true });
  },
});

add({
  id: 'cacto', name: 'Cactinho', cat: 'decoracao', size: [1, 1], rots: 2, h: 18, small: true,
  desc: 'Pequeno, espinhoso e adorável. Cabe em cima das mesas.',
  variants: ['#c8693f', '#e9b8c6', '#a8cfe0'],
  draw(r, o) {
    r.lathe(8, 8, 0, [3, 3, 3.5, 3.5, 4, 4], o.color, { topTex: (nx, ny, d) => (d < 0.75 ? ['#5a3b2b', 0] : 0) });
    r.map(8, 8, 5, CACTUS, { ...LEAF_PAL, O: '#22402b' }, { ax: 4, ay: 9, after: true });
  },
});

add({
  id: 'samambaia', name: 'Samambaia', cat: 'decoracao', size: [1, 1], rots: 2, h: 22,
  desc: 'Samambaia cheinha num vaso de cerâmica.',
  variants: ['#e9e1d2', '#c8693f', '#8f7bc2'],
  draw(r, o) {
    r.lathe(8, 8, 0, [3.5, 4, 4.5, 5, 5.5, 5.5, 6, 6], o.color, { shiny: true, topTex: (nx, ny, d) => (d < 0.8 ? ['#5a3b2b', 0] : 0) });
    r.map(8, 8, 6, FERN, LEAF_PAL, { ax: 7, ay: 8, after: true });
  },
});

add({
  id: 'flores', name: 'Vasinho de Flores', cat: 'decoracao', size: [1, 1], rots: 2, h: 16, small: true,
  desc: 'Florzinhas do campo. Fica lindo em cima de mesas.',
  variants: ['#a8cfe0', '#e9b8c6', '#f1e4c6', '#4a9a92'],
  draw(r, o) {
    r.lathe(8, 8, 0, [2, 2.5, 3, 3, 3, 2.5, 2, 2, 2.5], o.color, { shiny: true });
    r.map(8, 8, 8, FLOWERS, FLOWER_PAL, { ax: 4, ay: 6, after: true });
  },
});

add({
  id: 'lareira', name: 'Lareira de Pedra', cat: 'sala', size: [2, 1], h: 70, states: ['Apagada', 'Acesa'], frames: 3, fps: 8,
  desc: 'Uma lareira crepitante. Duplo clique para acender.',
  variants: [C.stone, C.brick, '#8a8fa3'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 8, color: '#ff9a4a', r: 120, flicker: true } : null),
  draw(r, o) {
    const s = o.color;
    const stoneTex = (u, v) => {
      const V = Math.floor(v), row = Math.floor(V / 5);
      const U = Math.floor(u + (row % 2) * 4);
      if (V % 5 === 0 || U % 8 === 0) return 0.9;
      return (hash(Math.floor(U / 8), row, 2) - 0.5) * 0.8;
    };
    r.box(0, 0, 0, 32, 12, 34, s, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          const inArch = U >= 7 && U <= 24 && (V <= 14 || (V <= 18 && Math.abs(U - 15.5) < 8.5 - (V - 14) * 1.6));
          if (inArch) return o.state ? (V < 2 ? '#5a2e2a' : ['#3a1e1e', 0]) : ['#241b22', 0];
          return stoneTex(u, v);
        },
        right: stoneTex, back: stoneTex, top: () => -0.2,
      },
    });
    r.box(-2, 0, 34, 36, 14, 3, C.woodR);
    r.box(7, 0, 37, 18, 9, 33, s, { tex: { left: stoneTex, right: stoneTex, back: stoneTex } });
    if (o.back) return;
    r.map(16, 12, 1, LOGS, LOG_PAL, { ax: 6, ay: 2, after: true });
    if (o.state) r.map(16, 12, 3, FIRE[o.frame % 3], FIRE_PAL, { ax: 6, ay: 8, after: true });
  },
});

// =========================== QUARTO ===========================
const bed = (single) => (r, o) => {
  const W = single ? 16 : 32, c = o.color, wd = o.wood || C.wood;
  r.box(0, 0, 0, W, 3, 26, wd, { tex: { left: (u, v) => (Math.floor(v) === 20 || (Math.floor(u) % 6 === 2 && v > 8 && v < 20) ? 0.6 : 0) } });
  r.box(0, 0, 26, W, 3, 2, shadeHex(wd, -0.3));
  r.box(0, 3, 2, W, 43, 7, wd);
  legs(r, 0, 3, W, 46, 2, shadeHex(wd, 0.8), 2);
  r.box(1, 3, 9, W - 2, 42, 4, C.white);
  const pw = single ? 12 : 12;
  r.box(2, 5, 13, pw, 8, 3, '#ffffff');
  if (!single) r.box(18, 5, 13, pw, 8, 3, '#ffffff');
  const quilt = (u, v) => {
    const q = (Math.floor(u / 6) + Math.floor(v / 6)) % 2;
    return [q ? c : mix(c, '#ffffff', 0.35), Math.floor(u) % 6 === 0 || Math.floor(v) % 6 === 0 ? 0.35 : 0];
  };
  r.box(0, 16, 10, W, 30, 4, c, {
    tex: { top: (u, v) => (v < 4 ? [C.white, 0] : quilt(u, v)), left: quilt, right: (u, v) => (u < 4 ? [C.white, 0] : quilt(u, v)) },
  });
  if (o.occupied) r.box(single ? 3 : 9, 20, 14, single ? 10 : 14, 20, 3, c, { after: true, tex: { top: (u, v) => quilt(u + 3, v + 4), left: quilt, right: quilt } });
  r.box(0, 46, 0, W, 2, 15, wd);
};

add({
  id: 'cama', name: 'Cama de Casal', cat: 'quarto', size: [2, 3], h: 30, lay: { z: 14, head: [16, 9] },
  desc: 'Cama com colcha de retalhos. Clique para deitar.',
  variants: ['#d96c7a', '#4b6aa3', '#7fa86b', '#d9a23b', '#8f7bc2'],
  draw: bed(false),
});

add({
  id: 'cama_solteiro', name: 'Cama de Solteiro', cat: 'quarto', size: [1, 3], h: 30, lay: { z: 14, head: [8, 9] },
  desc: 'Caminha estreita e confortável.',
  variants: ['#4b6aa3', '#d96c7a', '#7fa86b', '#d9a23b', '#8f7bc2'],
  draw: bed(true),
});

add({
  id: 'criado', name: 'Criado-mudo', cat: 'quarto', size: [1, 1], h: 18, top: 16, stack: true,
  desc: 'Com gaveta e tudo. Ótimo para apoiar um abajur.',
  variants: [C.wood, C.woodR, C.woodL, '#e9e1d2'],
  draw(r, o) {
    r.box(1, 2, 0, 14, 12, 14, o.color, {
      tex: { left: (u, v) => { const U = Math.floor(u), V = Math.floor(v); if (V === 7 || V === 0) return 0.7; if (U >= 6 && U <= 7 && (V === 10 || V === 3)) return C.gold; return null; } },
    });
    r.box(0, 1, 14, 16, 14, 2, shadeHex(o.color, -0.3));
  },
});

add({
  id: 'abajur', name: 'Abajur', cat: 'quarto', size: [1, 1], h: 18, small: true, states: ['Desligado', 'Ligado'],
  desc: 'Luzinha de cabeceira. Fica em cima de mesas e criados.',
  variants: ['#e9b8c6', '#a8cfe0', '#f1e4c6', '#d9a23b'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 12, color: '#ffd29a', r: 60 } : null),
  draw(r, o) {
    r.lathe(8, 8, 0, [3, 3.5, 4, 4, 3.5, 2.5, 1.5, 1], o.color, { shiny: true });
    r.lathe(8, 8, 8, [6, 5.6, 5.2, 4.8, 4.4, 4, 3.6], o.state ? '#fff0c4' : C.cream, {
      glow: !!o.state, topTex: (nx, ny, d) => (d < 0.5 ? (o.state ? { raw: '#fffbe0' } : 1) : 0),
    });
  },
});

add({
  id: 'guarda_roupa', name: 'Guarda-roupa', cat: 'quarto', size: [2, 1], h: 58, states: ['Fechado', 'Aberto'],
  desc: 'Armário de duas portas. Duplo clique para abrir.',
  variants: [C.wood, C.woodR, C.woodL, '#e9e1d2', '#7fa0b8'],
  draw(r, o) {
    const c = o.color, open = o.state === 1;
    const clothes = ['#d96c7a', '#4b6aa3', '#f1e4c6', '#7fa86b', '#d9a23b', '#8f7bc2'];
    r.box(0, 0, 0, 32, 14, 50, c, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (!open) {
            if (U === 16 || U === 15) return 0.8;
            if (V < 3) return 0.4;
            if (((U === 3 || U === 12 || U === 19 || U === 28) && V > 7 && V < 44) || ((V === 8 || V === 43) && ((U > 3 && U < 12) || (U > 19 && U < 28)))) return 0.45;
            if ((U === 13 || U === 18) && V >= 24 && V <= 28) return C.gold;
            return null;
          }
          if (U < 1 || U > 30 || V < 2 || V > 48) return null;
          if (V === 42) return [C.metal, 0];
          const hang = Math.floor((U - 1) / 3);
          const len = 16 + Math.floor(hash(hang, 1) * 14);
          if (V < 42 && V >= 42 - len && hash(hang, 4) > 0.15) return [clothes[hang % clothes.length], (U - 1) % 3 === 0 ? 0.6 : 0];
          if (V < 5) return [shadeHex(c, 1.5), 0];
          return [shadeHex(c, 2.6), 0];
        },
      },
    });
    r.box(-1, -1, 50, 34, 16, 3, shadeHex(c, -0.3));
    if (open) {
      const door = { left: (u, v) => (Math.floor(u) === 2 || Math.floor(u) === 11 ? 0.45 : null) };
      r.box(-1, 14, 2, 2, 14, 46, c, { tex: { right: door.left } });
      r.box(31, 14, 2, 2, 14, 46, c, { tex: { right: door.left } });
    }
  },
});

add({
  id: 'bau', name: 'Baú do Tesouro', cat: 'quarto', size: [1, 1], h: 24, states: ['Fechado', 'Aberto'],
  desc: 'Guarda segredos (e moedas). Duplo clique para abrir.',
  variants: [C.wood, C.woodR, '#6b6f8a'],
  draw(r, o) {
    const c = o.color;
    const band = (u, v) => { const U = Math.floor(u); if (U === 2 || U === 11) return C.gold; if (U >= 6 && U <= 7 && v >= 4 && v < 8) return o.state ? null : C.gold; return null; };
    r.box(1, 3, 0, 14, 11, 9, c, { tex: { left: band, right: (u) => (Math.floor(u) === 2 || Math.floor(u) === 8 ? C.gold : null), top: o.state ? (u, v) => (u > 1 && u < 13 && v > 1 && v < 10 ? { raw: hash(Math.floor(u), Math.floor(v)) > 0.7 ? '#fff6b0' : '#e8b34b' } : null) : null } });
    if (!o.state) {
      r.box(1, 3, 9, 14, 11, 3, c, { tex: { left: band, right: (u) => (Math.floor(u) === 2 || Math.floor(u) === 8 ? C.gold : null) } });
      r.box(1, 4, 12, 14, 9, 2, c, { tex: { top: (u) => (Math.floor(u) === 2 || Math.floor(u) === 11 ? C.gold : null) } });
    } else {
      r.box(1, 0, 9, 14, 3, 12, c, { tex: { left: (u, v) => (Math.floor(u) === 2 || Math.floor(u) === 11 ? C.gold : 0.5) } });
    }
  },
});

add({
  id: 'espelho', name: 'Espelho de Chão', cat: 'quarto', size: [1, 1], h: 46,
  desc: 'Espelho alto com moldura dourada.',
  variants: [C.gold, C.wood, '#e9e1d2'],
  draw(r, o) {
    r.box(2, 9, 0, 2, 4, 3, o.color);
    r.box(12, 9, 0, 2, 4, 3, o.color);
    r.box(2, 9, 3, 12, 3, 38, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U < 1 || U > 10 || V < 1 || V > 36) return null;
          const d = U + (36 - V) * 0.5;
          return { raw: (d > 6 && d < 9) || (d > 11 && d < 12) ? '#eaf6fb' : V > 26 ? '#b9d7e6' : '#a3c6d9' };
        },
      },
    });
  },
});

// =========================== COZINHA ===========================
add({
  id: 'mesa_jantar', name: 'Mesa de Jantar', cat: 'cozinha', size: [2, 2], rots: 1, h: 20, top: 17, stack: true,
  desc: 'Mesa quadrada para reunir a família (e os pets).',
  variants: [C.wood, C.woodR, C.woodL, '#e9e1d2'],
  draw(r, o) {
    legs(r, 3, 3, 29, 29, 14, shadeHex(o.color, 0.4), 3);
    r.box(1, 1, 14, 30, 30, 3, o.color, { tex: { top: planks(5, 'u') } });
  },
});

add({
  id: 'geladeira', name: 'Geladeira Retrô', cat: 'cozinha', size: [1, 1], h: 48, states: ['Fechada', 'Aberta'],
  desc: 'Geladeira anos 50. Duplo clique para espiar dentro.',
  variants: ['#9fd8c8', '#f3efe6', '#e9b8c6', '#ffd98a'],
  light: (o) => (o.state ? { x: 8, y: 18, z: 20, color: '#fff3c4', r: 45 } : null),
  draw(r, o) {
    const c = o.color, open = o.state === 1;
    const food = ['#e2574c', '#ffd35a', '#6fe08a', '#f3efe6', '#f08a3a'];
    r.box(1, 1, 0, 14, 13, 44, c, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (V < 2) return [C.iron, 0];
          if (open) {
            if (U < 1 || U > 12 || V < 3 || V > 41) return null;
            if (V === 28 || V === 29) return 0.6;
            if (V % 8 === 3) return { raw: '#cfd6dc' };
            const slot = Math.floor(U / 3) + Math.floor(V / 8) * 5;
            if (V % 8 > 3 && V % 8 < 7 && U % 3 !== 0 && hash(slot, 3) > 0.35) return { raw: food[slot % food.length] };
            return { raw: '#fff8e2' };
          }
          if (V === 30) return 0.8;
          if (U >= 10 && U <= 11 && ((V >= 32 && V <= 37) || (V >= 20 && V <= 27))) return C.metal;
          if (U === 0 && V > 2) return -0.4;
          return null;
        },
      },
    });
    if (open) r.box(15, 14, 2, 2, 13, 42, c);
  },
});

add({
  id: 'fogao', name: 'Fogão a Lenha', cat: 'cozinha', size: [1, 1], h: 22, states: ['Apagado', 'Aceso'], top: 18, stack: true,
  desc: 'Fogão de ferro. Duplo clique para acender as bocas.',
  variants: [C.iron, '#7d2f2f', '#2f4a6b'],
  light: (o) => (o.state ? { x: 8, y: 14, z: 6, color: '#ff8a3a', r: 50, flicker: true } : null),
  draw(r, o) {
    r.box(1, 2, 0, 14, 12, 18, o.color, {
      tex: {
        top: (u, v) => {
          for (const [cx, cy] of [[4, 3.5], [10, 3.5], [4, 8.5], [10, 8.5]]) {
            const d = Math.hypot(u - cx, (v - cy));
            if (d < 2.6) return o.state ? (d < 1.2 ? { raw: '#ffe27a' } : { raw: '#f2603a' }) : (d < 1.3 ? 1.4 : 0.8);
          }
          return null;
        },
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (V === 15 && U % 3 === 1) return C.gold;
          if (U >= 2 && U <= 11 && V >= 3 && V <= 11) {
            if (U === 2 || U === 11 || V === 3 || V === 11) return [C.metal, 0];
            return o.state ? { raw: V < 6 ? '#f2603a' : '#7a2a1e' } : [C.dark, 0];
          }
          return null;
        },
      },
    });
  },
});

add({
  id: 'balcao', name: 'Balcão', cat: 'cozinha', size: [1, 1], h: 20, top: 18, stack: true,
  desc: 'Bancada com tampo de pedra. Combine vários lado a lado.',
  variants: [C.wood, '#9fd8c8', '#e9e1d2', '#4b6aa3'],
  draw(r, o) {
    r.box(0, 2, 0, 16, 13, 16, o.color, {
      tex: { left: (u, v) => { const U = Math.floor(u), V = Math.floor(v); if (V < 2) return 0.9; if (V === 12 || U === 0) return 0.6; if (U >= 7 && U <= 8 && V === 9) return C.gold; return null; } },
    });
    r.box(0, 1, 16, 16, 15, 2, '#e8e2d8');
  },
});

add({
  id: 'pote_racao', name: 'Pote de Ração', cat: 'pets', size: [1, 1], rots: 1, h: 6, small: true, pet: 'bowl', walk: true,
  desc: 'Seus pets vêm comer aqui de vez em quando.',
  variants: ['#d94f4f', '#4b6aa3', '#7fa86b', '#e9b8c6'],
  draw(r, o) {
    r.lathe(8, 9, 0, [3, 4, 4.5, 5], o.color, {
      shiny: true, topTex: (nx, ny, d) => (d < 0.72 ? [hash(Math.floor(nx * 9), Math.floor(ny * 9)) > 0.5 ? '#a8693a' : '#7d4c31', 0] : 0),
    });
  },
});

add({
  id: 'caminha', name: 'Caminha de Pet', cat: 'pets', size: [1, 1], rots: 1, h: 8, pet: 'bed', walk: true,
  desc: 'Seus pets dormem aqui quando estão com soninho.',
  variants: ['#d96c7a', '#4b6aa3', '#7fa86b', '#d9a23b'],
  draw(r, o) {
    r.lathe(8, 8, 0, [7, 7.3, 7.3, 7.3, 7.1], o.color, {
      topTex: (nx, ny, d) => (d < 0.68 ? ['#f1e4c6', d > 0.55 ? 0.6 : 0] : d < 0.8 ? 0.6 : 0),
    });
  },
});

// =========================== MÁGICO ===========================
add({
  id: 'caldeirao', name: 'Caldeirão', cat: 'magico', size: [1, 1], h: 26, states: ['Frio', 'Borbulhando'], frames: 3, fps: 5,
  desc: 'Para poções duvidosas. Duplo clique para ferver.',
  variants: ['#6fe08a', '#b07cf0', '#ff7aa8', '#6ac8ff'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 14, color: o.color, r: 60 } : null),
  draw(r, o) {
    r.pts([[4, 8, 1, C.iron], [4, 8, 0, C.iron], [12, 8, 1, C.iron], [12, 8, 0, C.iron], [8, 12, 0, C.iron], [8, 12, 1, C.iron]]);
    r.lathe(8, 8, 2, [4, 5.5, 6.3, 6.8, 7, 7, 7, 6.8, 6.4, 6.2, 6.6], C.iron, {
      shiny: true,
      topTex: (nx, ny, d) => {
        if (d > 0.84) return -0.8;
        const lq = o.state ? mix(o.color, '#ffffff', 0) : shadeHex(o.color, 2);
        if (o.state) {
          const b = hash(Math.floor((nx + 1) * 4), Math.floor((ny + 1) * 4), o.frame);
          return { raw: b > 0.8 ? mix(o.color, '#ffffff', 0.6) : lq };
        }
        return [lq, 0];
      },
    });
    if (o.state) r.map(8, 8, 18, STEAM[o.frame % 3], { o: '*' + mix(o.color, '#ffffff', 0.5) }, { ax: 2, ay: 4, after: true });
  },
});

add({
  id: 'bola_cristal', name: 'Bola de Cristal', cat: 'magico', size: [1, 1], h: 20, small: true, states: ['Adormecida', 'Brilhando'], frames: 4, fps: 4,
  desc: 'Mostra o futuro… ou só brilha bonito. Fica em mesas.',
  variants: ['#b07cf0', '#6ac8ff', '#ff7aa8', '#6fe08a'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 10, color: o.color, r: 55 } : null),
  draw(r, o) {
    r.lathe(8, 8, 0, [4, 4, 3.4, 3, 3.4], C.gold, { shiny: true });
    r.lathe(8, 8, 4, sphere(4.6), o.color, {
      glow: !!o.state, shiny: true,
      sideTex: (nx, i) => (o.state && (i + o.frame * 2) % 7 === 0 ? -1.4 : 0),
      topTex: () => (o.state ? { raw: mix(o.color, '#ffffff', 0.6) } : -0.5),
    });
  },
});

add({
  id: 'abobora', name: 'Abóbora Encantada', cat: 'magico', size: [1, 1], h: 18, small: true, states: ['Quieta', 'Acesa'], frames: 2, fps: 3,
  desc: 'Abóbora esculpida. Acesa, ganha um sorriso brilhante.',
  variants: ['#f08a3a', '#b07cf0', '#f3efe6'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 6, color: '#ffae4a', r: 45, flicker: true } : null),
  draw(r, o) {
    r.lathe(8, 8, 0, sphere(6, 0.75), o.color, {
      sideTex: (nx, i, dsx) => {
        const rib = Math.floor(dsx + 40) % 4 === 0 ? 0.7 : 0;
        if (!o.state) return rib;
        const fx = Math.round(dsx), row = i;
        if ((row === 5 || row === 6) && (fx === -3 || fx === 2)) return '#ffe27a';
        if (row === 2 && fx >= -3 && fx <= 2) return '#ffe27a';
        if (row === 3 && (fx === -4 || fx === 3)) return '#ffe27a';
        return rib;
      },
    });
    r.pts([[8, 8, 9, '#5d7a3c'], [8, 8, 10, '#5d7a3c'], [9, 7, 11, '#5d7a3c']], { after: true });
  },
});

add({
  id: 'vela', name: 'Velas', cat: 'magico', size: [1, 1], h: 14, small: true, states: ['Apagadas', 'Acesas'], frames: 3, fps: 6,
  desc: 'Trio de velas. Clima de feitiço.',
  variants: ['#f1e4c6', '#b07cf0', '#d94f4f'],
  light: (o) => (o.state ? { x: 8, y: 8, z: 10, color: '#ffc76a', r: 50, flicker: true } : null),
  draw(r, o) {
    r.lathe(8, 8, 0, [6, 6], '#c9b48a', { shiny: true });
    const cs = [[6, 7, 9], [10, 8, 6], [8, 11, 4]];
    for (const [x, y, h] of cs) {
      const prof = new Array(h).fill(1.4);
      r.lathe(x, y, 2, prof, o.color, { topTex: () => -0.3 });
      if (o.state) r.map(x, y, 2 + h, FLAME[(o.frame + x) % 3], FLAME_PAL, { ax: 1, ay: 3, after: true });
      else r.pts([[x, y, 2 + h, C.dark]], { after: true });
    }
  },
});

add({
  id: 'livros', name: 'Pilha de Livros', cat: 'magico', size: [1, 1], h: 10, small: true,
  desc: 'Grimórios empilhados. Fica bem em mesas.',
  variants: ['#8f7bc2', '#d94f4f', '#4a9a92'],
  draw(r, o) {
    const page = (u, v) => (Math.floor(v) === 1 && u > 0.5 ? '#f1e4c6' : null);
    r.box(3, 4, 0, 10, 8, 3, '#b5574b', { tex: { left: page } });
    r.box(4, 5, 3, 9, 7, 3, o.color, { tex: { left: page, top: (u, v) => (Math.floor(u) === 4 ? C.gold : null) } });
    r.box(4, 4, 6, 8, 7, 2, '#4b6aa3', { tex: { left: (u, v) => (Math.floor(v) === 0 ? '#f1e4c6' : null) } });
  },
});

add({
  id: 'relogio', name: 'Relógio de Pêndulo', cat: 'sala', size: [1, 1], h: 56, frames: 4, fps: 2,
  desc: 'Tic-tac do vovô. O pêndulo balança sem parar.',
  variants: [C.woodR, C.wood, '#3c3546'],
  draw(r, o) {
    const sw = [-2, 0, 2, 0][o.frame % 4];
    r.box(2, 3, 0, 12, 10, 48, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (V < 3) return 0.6;
          // mostrador
          const dx = u - 6, dy = v - 39;
          const d = Math.hypot(dx, dy);
          if (d < 4.2) {
            if (d > 3.4) return C.gold;
            if (U === 6 && V >= 39 && V <= 41) return [C.dark, 0];
            if (V === 39 && U >= 6 && U <= 7) return [C.dark, 0];
            return ['#f6ecd2', -0.4];
          }
          // janela do pêndulo
          if (U >= 3 && U <= 8 && V >= 7 && V <= 31) {
            if (U === 3 || U === 8 || V === 7 || V === 31) return C.gold;
            const px = 6 + sw * ((31 - V) / 24);
            if (Math.abs(u - px) < 0.6 && V > 14) return C.gold;
            const bx = 6 + sw * 0.9;
            if (Math.hypot(u - bx, v - 12) < 2) return [C.gold, -0.5];
            return ['#2a2430', 0];
          }
          return null;
        },
      },
    });
    r.box(1, 2, 48, 14, 12, 3, shadeHex(o.color, -0.3));
    r.box(5, 5, 51, 6, 6, 3, shadeHex(o.color, -0.3));
  },
});

// =========================== CONSTRUÇÃO ===========================
add({
  id: 'porta', name: 'Porta de Madeira', cat: 'construcao', size: [1, 1], h: 48, states: ['Fechada', 'Aberta'],
  walk: (s) => s === 1,
  desc: 'Uma porta de verdade: fechada bloqueia a passagem. Duplo clique abre!',
  variants: [C.wood, C.woodR, '#4a9a92', '#d96c7a', '#e9e1d2'],
  draw(r, o) {
    const fr = shadeHex(o.color, 0.6);
    r.box(0, 6, 0, 2, 4, 42, fr);
    r.box(14, 6, 0, 2, 4, 42, fr);
    r.box(0, 6, 42, 16, 4, 3, fr);
    const panel = (u, v) => {
      const U = Math.floor(u), V = Math.floor(v);
      if (((U === 2 || U === 9) && V > 4 && V < 36) || ((V === 5 || V === 20 || V === 21 || V === 35) && U > 2 && U < 9)) return 0.5;
      if (U === 10 && V >= 18 && V <= 19) return C.gold;
      return null;
    };
    if (!o.state) r.box(2, 7, 0, 12, 2, 42, o.color, { tex: { left: panel } });
    else r.box(2, 9, 0, 2, 12, 42, o.color, { tex: { right: (u, v) => panel(11 - u, v) } });
  },
});

add({
  id: 'mureta', name: 'Mureta de Tijolos', cat: 'construcao', size: [1, 1], rots: 2, h: 24, top: 20, stack: true,
  desc: 'Muro baixo para dividir ambientes. Empilhável!',
  variants: [C.brick, C.stone, '#e9e1d2', '#7fa0b8'],
  draw(r, o) {
    const br = (u, v) => {
      const V = Math.floor(v), row = Math.floor(V / 4);
      const U = Math.floor(u + (row % 2) * 4);
      if (V % 4 === 3 || U % 8 === 0) return ['#e3d8c4', 0.3];
      return (hash(Math.floor(U / 8), row, 4) - 0.5) * 0.7;
    };
    r.box(0, 5, 0, 16, 6, 18, o.color, { tex: { left: br, right: br, back: br } });
    r.box(0, 4, 18, 16, 8, 2, C.stone);
  },
});

add({
  id: 'divisoria', name: 'Parede Divisória', cat: 'construcao', size: [1, 1], rots: 2, h: 64, top: null,
  desc: 'Parede alta para criar cômodos novos. Combine várias!',
  variants: ['#f1e4c6', '#e9b8c6', '#a8cfe0', '#b9d99a', '#c9b6ee', '#a59c8f'],
  draw(r, o) {
    const t = (u, v) => (v < 6 ? ['#8e5a3a', Math.floor(v) === 5 ? -0.6 : 0] : Math.floor(u) % 4 === 0 && v > 6 ? 0.18 : 0);
    r.box(0, 5, 0, 16, 6, 60, o.color, { tex: { left: t, right: t, back: t } });
    r.box(0, 4, 60, 16, 8, 2, shadeHex(o.color, -0.6));
  },
});

add({
  id: 'coluna', name: 'Coluna Clássica', cat: 'construcao', size: [1, 1], rots: 1, h: 64,
  desc: 'Coluna de pedra com capitel.',
  variants: ['#e9e1d2', C.stone, '#c9b6ee'],
  draw(r, o) {
    r.box(1, 1, 0, 14, 14, 4, o.color);
    const prof = new Array(50).fill(5);
    r.lathe(8, 8, 4, prof, o.color, { sideTex: (nx, i, dsx) => (Math.floor(dsx + 20) % 3 === 0 ? 0.5 : 0) });
    r.box(1, 1, 54, 14, 14, 4, o.color);
  },
});

// =========================== PAREDE ===========================
add({
  id: 'janela', name: 'Janela com Cortina', cat: 'parede', wall: true, size: [30, 36], states: ['Cortina aberta', 'Cortina fechada'],
  desc: 'Mostra o céu lá fora — muda de dia, entardecer e noite.',
  variants: ['#d96c7a', '#4b6aa3', '#f1e4c6', '#7fa86b', '#8f7bc2'],
  draw(r, o) {
    const fr = '#f3efe6';
    r.box(2, 0, 2, 26, 2, 30, fr, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U < 2 || U > 23 || V < 2 || V > 27) return null;
          if (U === 12 || U === 13 || V === 14) return null;
          return { raw: skyColor(o.env, u - 2, v - 2, 22, 26, o.frame) };
        },
      },
    });
    r.box(0, 0, 0, 30, 5, 2, fr);
    const fold = (u) => (Math.floor(u) % 3 === 0 ? 0.6 : Math.floor(u) % 3 === 1 ? -0.3 : 0);
    r.box(-2, 3, 34, 34, 1, 1, C.woodD);
    if (o.state) r.box(0, 3, 1, 30, 1, 33, o.color, { tex: { left: fold } });
    else {
      r.box(-2, 3, 4, 6, 1, 30, o.color, { tex: { left: fold } });
      r.box(26, 3, 4, 6, 1, 30, o.color, { tex: { left: fold } });
    }
  },
});

const painting = (art) => (r, o) => {
  r.box(0, 0, 0, 24, 2, 18, o.color, {
    tex: {
      left: (u, v) => {
        const U = Math.floor(u), V = Math.floor(v);
        if (U < 2 || U > 21 || V < 2 || V > 15) return U === 0 || V === 0 ? 0.5 : null;
        return art(U - 2, V - 2);
      },
    },
  });
};

add({
  id: 'quadro', name: 'Quadro Paisagem', cat: 'parede', wall: true, size: [24, 18],
  desc: 'Pinturinha de colinas ao pôr do sol.',
  variants: [C.gold, C.wood, '#3c3546'],
  draw: painting((u, v) => {
    const hill1 = 4 + Math.sin(u * 0.45) * 1.6, hill2 = 6 + Math.sin(u * 0.3 + 2) * 2;
    if (v < hill1) return ['#5f9f4b', 0];
    if (v < hill2) return ['#8cc265', 0];
    if (Math.hypot(u - 13, v - 8) < 2.4) return ['#fff0a8', -0.5];
    return [v > 10 ? '#f7a37a' : '#ffd27a', 0];
  }),
});

add({
  id: 'quadro_gato', name: 'Retrato de Gato', cat: 'parede', wall: true, size: [24, 18],
  desc: 'Retrato oficial do gato mais nobre do bairro.',
  variants: [C.gold, C.wood, '#d96c7a'],
  draw: painting((u, v) => {
    const cx = u - 9.5, cy = v - 5.5;
    const ear = (v === 10 || v === 11) && (u === 6 || u === 7 || u === 12 || u === 13);
    const head = cx * cx / 20 + cy * cy / 14 < 1;
    if ((u === 7 || u === 12) && v === 6) return ['#2b2232', 0];
    if (u >= 9 && u <= 10 && v === 4) return ['#f08fb0', 0];
    if (head || ear) return ['#f08a3a', (u + v) % 3 === 0 ? 0.6 : 0];
    if (v < 2) return ['#7d4c31', 0];
    return ['#4b6aa3', v % 2 ? 0.2 : 0];
  }),
});

add({
  id: 'poster', name: 'Pôster Estrelado', cat: 'parede', wall: true, size: [16, 22],
  desc: 'Pôster de constelações para sonhar acordado.',
  variants: ['#2b2f6b', '#5c4c8f', '#2f4a6b'],
  draw(r, o) {
    r.box(0, 0, 0, 16, 1, 22, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U === 0 || U === 15 || V === 0 || V === 21) return ['#f1e4c6', 0];
          const st = [[4, 16], [7, 18], [10, 15], [12, 12], [5, 8], [9, 6], [11, 9]];
          if (st.some(([x, y]) => x === U && y === V)) return { raw: '#fff6c8' };
          if (Math.hypot(U - 8, V - 4) < 3 && Math.hypot(U - 9, V - 5) > 2.4) return { raw: '#ffe27a' };
          return null;
        },
      },
    });
  },
});

add({
  id: 'relogio_parede', name: 'Relógio de Parede', cat: 'parede', wall: true, size: [14, 14], clock: true,
  desc: 'Mostra a hora real do seu computador!',
  variants: ['#d94f4f', '#4a9a92', C.wood, '#3c3546'],
  draw(r, o) {
    const now = o.time || { h: 10, m: 10 };
    const ha = ((now.h % 12) + now.m / 60) / 12 * Math.PI * 2, ma = now.m / 60 * Math.PI * 2;
    r.box(0, 0, 0, 14, 2, 14, o.color, {
      tex: {
        top: () => ({ skip: true }), right: () => ({ skip: true }),
        left: (u, v) => {
          const dx = u - 7, dy = v - 7, d = Math.hypot(dx, dy);
          if (d > 7) return { skip: true };
          if (d > 5.6) return null;
          for (const [a, len] of [[ha, 3], [ma, 4.6]])
            for (let t = 0; t <= len; t += 0.5)
              if (Math.floor(7 + Math.sin(a) * t) === Math.floor(u) && Math.floor(7 + Math.cos(a) * t) === Math.floor(v)) return [C.dark, 0];
          if (d > 4.6 && d < 5.4 && Math.abs(Math.atan2(dx, dy) % (Math.PI / 2)) < 0.15) return [C.dark, 0];
          return ['#fbf3df', -0.3];
        },
      },
    });
  },
});

add({
  id: 'prateleira', name: 'Prateleira de Poções', cat: 'parede', wall: true, size: [26, 14],
  desc: 'Frasquinhos coloridos de poções caseiras.',
  variants: [C.wood, C.woodR, '#e9e1d2'],
  draw(r, o) {
    r.box(0, 0, 0, 26, 7, 2, o.color);
    r.pts([[3, 1, -1, C.iron], [3, 2, -2, C.iron], [3, 1, -2, C.iron], [22, 1, -1, C.iron], [22, 2, -2, C.iron], [22, 1, -2, C.iron]]);
    const bots = [[5, 3, 1], [11, 4, 2], [16, 3, 0], [21, 4, 3]];
    for (const [x, y, ci] of bots) {
      const tall = ci % 2 ? [2, 2.3, 2.3, 2.3, 2, 1.2, 0.8, 0.8] : [2.6, 2.8, 2.8, 2.6, 2.2, 1.4, 0.8, 0.8, 0.8];
      r.lathe(x, y, 2, tall, BOTTLE_COLORS[ci], { shiny: true, topTex: () => '#c9a26b' });
    }
  },
});

add({
  id: 'arandela', name: 'Arandela', cat: 'parede', wall: true, size: [10, 16], states: ['Desligada', 'Ligada'],
  desc: 'Luminária de parede com cúpula.',
  variants: ['#f1e4c6', '#e9b8c6', '#a8cfe0'],
  light: (o) => (o.state ? { x: 5, y: 6, z: 10, color: '#ffd29a', r: 65 } : null),
  draw(r, o) {
    r.box(4, 0, 2, 2, 1, 6, C.gold);
    r.box(4, 0, 5, 2, 5, 1, C.gold);
    r.lathe(5, 6, 6, [3.2, 3.6, 4, 4.4, 4.6, 4.6, 4.4], o.state ? '#fff0c4' : o.color, { glow: !!o.state });
  },
});

add({
  id: 'varal_luzes', name: 'Varal de Luzinhas', cat: 'parede', wall: true, size: [40, 10], states: ['Desligado', 'Ligado'], frames: 3, fps: 2,
  desc: 'Luzinhas de fada que piscam devagar.',
  variants: ['#ffd35a', '#ff8fd0', '#8fd0ff'],
  light: (o) => (o.state ? { x: 20, y: 4, z: 4, color: o.color, r: 70 } : null),
  draw(r, o) {
    const wire = [];
    const sag = (x) => 9 - Math.sin(((x % 20) / 20) * Math.PI) * 6;
    for (let x = 0; x <= 40; x++) wire.push([x, 1, Math.round(sag(x)), '#4f6b45']);
    r.pts(wire);
    const cols = [o.color, '#ff8f8f', '#9fe0ff', '#c9f08a'];
    for (let i = 0, x = 3; x < 40; x += 5, i++) {
      if (x % 20 === 0) continue;
      const on = o.state && (i + o.frame) % 3 !== 0;
      const c = cols[i % cols.length];
      const pal = on ? { c: '*' + c, w: '*' + mix(c, '#ffffff', 0.6), k: '#3b4a35' } : { c: shadeHex(c, 1.6), w: shadeHex(c, 0.8), k: '#3b4a35' };
      r.map(x, 1, Math.round(sag(x)) - 1, ['.k.', 'cwc', 'ccc', '.c.'], pal, { ax: 1, ay: 0, after: true });
    }
  },
});

// Porta de entrada do quarto (fixa na parede esquerda).
add({
  id: 'porta_entrada', name: 'Porta de Entrada', cat: null, wall: true, fixed: true, size: [20, 44], states: ['Fechada', 'Aberta'],
  variants: [C.woodR],
  draw(r, o) {
    const fr = '#f3efe6';
    r.box(-2, 0, 0, 2, 2, 42, fr);
    r.box(20, 0, 0, 2, 2, 42, fr);
    r.box(-2, 0, 42, 24, 2, 3, fr);
    const panel = (u, v) => {
      const U = Math.floor(u), V = Math.floor(v);
      if (((U === 3 || U === 16) && V > 4 && V < 37) || ((V === 5 || V === 21 || V === 36) && U > 3 && U < 16)) return 0.5;
      if (U >= 9 && U <= 10 && V >= 26 && V <= 33) return { raw: o.env === 'night' ? '#ffe9a8' : '#bfe4ff' };
      return null;
    };
    if (!o.state) r.box(0, 0, 0, 20, 1, 42, o.color, { tex: { left: panel } });
    else {
      r.box(0, -1, 0, 20, 1, 42, '#1c1830', { tex: { left: (u, v) => ({ raw: v < 3 ? '#3a3350' : '#1c1830' }) } });
      r.box(0, 1, 0, 1, 18, 42, o.color, { tex: { right: (u, v) => panel(19 - u, v) } });
    }
  },
});

export const FURNI = Object.fromEntries(defs.map((d) => [d.id, d]));

export const CATEGORIES = [
  { id: 'sala', name: 'Sala' },
  { id: 'quarto', name: 'Quarto' },
  { id: 'cozinha', name: 'Cozinha' },
  { id: 'decoracao', name: 'Plantas' },
  { id: 'magico', name: 'Mágico' },
  { id: 'parede', name: 'Parede' },
  { id: 'construcao', name: 'Construção' },
  { id: 'pets', name: 'Pets' },
];

export const isWalkable = (def, state) =>
  typeof def.walk === 'function' ? def.walk(state) : !!def.walk;
