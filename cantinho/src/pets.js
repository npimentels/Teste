// Pets (cachorro e gato) modelados em 3D e pré-renderizados em pixel art,
// nas mesmas 8 direções e com o mesmo acabamento do avatar.

import * as S from './sdf.js';
import { renderRig } from './avatar.js';
import { shadeHex, mix } from './color.js';

export const PET_KINDS = {
  cachorro: {
    name: 'Cachorro', sound: ['Au au!', 'Auuu~', 'Woof!', '*abana o rabo*'],
    colors: [
      { a: '#d29a5a', c: '#f6e2c4', n: 'Caramelo' },
      { a: '#3e3842', c: '#d9cfc4', n: 'Pretinho' },
      { a: '#efe8de', c: '#ffffff', n: 'Branquinho' },
      { a: '#9a8a7a', c: '#efe8de', n: 'Cinza' },
      { a: '#b5643a', c: '#f0d6b8', n: 'Ruivo' },
    ],
    names: ['Paçoca', 'Biscoito', 'Bolinha', 'Toddy', 'Pipoca', 'Thor', 'Mel'],
  },
  gato: {
    name: 'Gato', sound: ['Miau~', 'Mrrr...', 'Prrrr', '*boceja*'],
    colors: [
      { a: '#f0a050', c: '#fbe6c8', n: 'Laranja' },
      { a: '#9a9aa8', c: '#ecebf2', n: 'Cinza' },
      { a: '#2e2a36', c: '#5e566a', n: 'Preto' },
      { a: '#f3ece0', c: '#ffffff', n: 'Branco' },
      { a: '#c9a27a', c: '#f6ead6', n: 'Siamês' },
    ],
    names: ['Mingau', 'Frajola', 'Nina', 'Salém', 'Luna', 'Pantufa', 'Fumaça'],
  },
};

// pose: stand | walk | sit | sleep | happy  (frame 0..3)
function dogModel(col, pose, frame) {
  const A = col.a, L = col.c, D = shadeHex(col.a, 1.3);
  const parts = [];
  const stamps = [];
  const bob = pose === 'happy' && frame % 2 ? 2.5 : 0;
  const wag = [-2.5, 1.5, 2.5, -1.5][frame % 4] * (pose === 'happy' ? 1.6 : 1);
  const belly = (x, y, z) => (z < 10.5 && Math.abs(x) < 2.8 ? L : A);
  if (pose === 'sleep') {
    parts.push({ prims: [S.ellipsoid(0, -1, 5, 7.2, 9, 5)], mat: belly, id: 'body' });
    parts.push({ prims: [S.sphere(3, 7.5, 6, 4.8), S.ellipsoid(3.5, 11.5, 4.6, 2.6, 3, 2.2)], mat: (x, y, z) => (y > 10 ? L : A), blend: 1.5, id: 'head' });
    parts.push({ prims: [S.ellipsoid(7.4, 6.8, 6.2, 1.4, 2.4, 3.2)], mat: D, id: 'ear' });
    parts.push({ prims: [S.sphere(3.8, 14.3, 5.2, 1.1)], mat: '#1e1620', id: 'nose' });
    parts.push({ prims: [S.capsule(-5, -8, 3.5, -2, 4, 2.5, 1.5)], mat: A, id: 'tail' });
    stamps.push({ p: [1.2, 11, 7], n: [0, 0.6, 0.8], closed: true }, { p: [5.4, 10.6, 7], n: [0.3, 0.6, 0.8], closed: true });
    return { parts, stamps };
  }
  if (pose === 'sit') {
    parts.push({ prims: [S.capsule(0, -2.5, 7, 0, 3, 14.5, 5.2, 4.4)], mat: belly, id: 'body' });
    parts.push({ prims: [S.capsule(2.6, 5.4, 12, 2.6, 6, 1.4, 1.7), S.capsule(-2.6, 5.4, 12, -2.6, 6, 1.4, 1.7)], mat: A, id: 'legsF' });
    parts.push({ prims: [S.ellipsoid(4.2, -1, 4, 2.2, 5, 3.2), S.ellipsoid(-4.2, -1, 4, 2.2, 5, 3.2)], mat: A, id: 'legsB' });
    parts.push({ prims: [S.capsule(0, -7, 3, 2 + wag * 0.4, -10, 2, 1.3)], mat: A, id: 'tail' });
    headAt(parts, stamps, A, L, D, 0, 6.5, 22.5);
    return { parts, stamps };
  }
  const swing = pose === 'walk' ? [0.45, 0, -0.45, 0][frame % 4] : 0;
  parts.push({ prims: [S.ellipsoid(0, -0.5, 12 + bob, 4.8, 9, 5), S.ellipsoid(0, 5, 13.5 + bob, 4.6, 4.6, 5.4)], mat: belly, blend: 3, id: 'body' });
  const leg = (x, y, s, id) => {
    const fy = y + Math.sin(s) * 4, fz = 1.4 + Math.max(0, -Math.cos(s * 3)) * 0 + (s > 0.2 ? 1.2 : 0);
    parts.push({ prims: [S.capsule(x, y, 10 + bob, x, fy, fz + bob, 1.8, 1.6), S.sphere(x, fy + 0.6, 1.5 + bob, 1.8)], mat: (a, b, c) => (c < 3.2 + bob ? L : A), blend: 0.8, id });
  };
  leg(2.7, 5.5, swing, 'lf1'); leg(-2.7, 5.5, -swing, 'lf2');
  leg(2.9, -5.6, -swing, 'lb1'); leg(-2.9, -5.6, swing, 'lb2');
  parts.push({ prims: [S.capsule(0, -8.5, 14 + bob, wag * 0.6, -12, 21 + bob, 1.6, 1.1)], mat: A, id: 'tail' });
  parts.push({ prims: [S.torus(0, 7.6, 17 + bob, 3.8, 0.9)], mat: '#d94f4f', id: 'collar' });
  headAt(parts, stamps, A, L, D, 0, 10, 21 + bob);
  return { parts, stamps };
}

function headAt(parts, stamps, A, L, D, x, y, z) {
  parts.push({ prims: [S.sphere(x, y, z, 5.3), S.ellipsoid(x, y + 4.8, z - 1.6, 2.9, 3.4, 2.5)], mat: (a, b, c) => (b > y + 3.2 ? L : A), blend: 1.6, id: 'head' });
  parts.push({ prims: [S.sphere(x, y + 8, z - 1, 1.15)], mat: '#1e1620', id: 'nose' });
  parts.push({ prims: [S.ellipsoid(x + 4.8, y - 0.5, z - 0.5, 1.4, 2.4, 3.8), S.ellipsoid(x - 4.8, y - 0.5, z - 0.5, 1.4, 2.4, 3.8)], mat: D, id: 'ears' });
  stamps.push({ p: [x + 2.3, y + 4.4, z + 1.6], n: [0.45, 0.85, 0.25] }, { p: [x - 2.3, y + 4.4, z + 1.6], n: [-0.45, 0.85, 0.25] });
}

function catModel(col, pose, frame) {
  const A = col.a, L = col.c;
  const parts = [];
  const stamps = [];
  const bob = pose === 'happy' && frame % 2 ? 2 : 0;
  const sway = [-1.5, 0.5, 1.5, -0.5][frame % 4];
  const belly = (x, y, z) => (z < 8.5 && Math.abs(x) < 2.2 ? L : A);
  const head = (x, y, z, closed) => {
    parts.push({ prims: [S.ellipsoid(x, y, z, 4.6, 4.2, 4), S.ellipsoid(x, y + 3.4, z - 1.2, 2.2, 1.6, 1.5)], mat: (a, b, c) => (b > y + 2.6 ? L : A), blend: 1.2, id: 'head' });
    parts.push({ prims: [S.cone(x + 2.5, y - 0.4, z + 2.2, z + 7, 1.9, 0.3), S.cone(x - 2.5, y - 0.4, z + 2.2, z + 7, 1.9, 0.3)], mat: A, id: 'ears' });
    parts.push({ prims: [S.sphere(x, y + 4.7, z - 0.5, 0.6)], mat: '#f08fa8', id: 'nose' });
    stamps.push({ p: [x + 2, y + 3.4, z + 0.8], n: [0.45, 0.85, 0.2], cat: true, closed }, { p: [x - 2, y + 3.4, z + 0.8], n: [-0.45, 0.85, 0.2], cat: true, closed });
  };
  if (pose === 'sleep') {
    parts.push({ prims: [S.ellipsoid(0, 0, 4.2, 6.4, 7.4, 4.2)], mat: belly, id: 'body' });
    parts.push({ prims: [S.capsule(-5.5, -4, 2.4, -2, 7, 2, 1.4)], mat: A, id: 'tail' });
    head(3.2, 5.5, 5.2, true);
    return { parts, stamps };
  }
  if (pose === 'sit') {
    parts.push({ prims: [S.capsule(0, -2, 6, 0, 2, 12, 4.4, 3.4)], mat: belly, id: 'body' });
    parts.push({ prims: [S.capsule(1.8, 4, 9, 1.8, 4.6, 1, 1.2), S.capsule(-1.8, 4, 9, -1.8, 4.6, 1, 1.2)], mat: A, id: 'legsF' });
    parts.push({ prims: [S.capsule(0, -5.5, 1.5, 5, -2, 1.2, 1.2)], mat: A, id: 'tail' });
    head(0, 4.2, 18, false);
    return { parts, stamps };
  }
  const swing = pose === 'walk' ? [0.45, 0, -0.45, 0][frame % 4] : 0;
  parts.push({ prims: [S.ellipsoid(0, 0, 10 + bob, 3.7, 7.6, 3.9)], mat: belly, id: 'body' });
  const leg = (x, y, s, id) => {
    const fy = y + Math.sin(s) * 3.5;
    parts.push({ prims: [S.capsule(x, y, 8.5 + bob, x, fy, 1.2 + bob + (s > 0.2 ? 1 : 0), 1.3, 1.1)], mat: (a, b, c) => (c < 2.4 + bob ? L : A), id });
  };
  leg(2, 5, swing, 'lf1'); leg(-2, 5, -swing, 'lf2');
  leg(2.2, -5, -swing, 'lb1'); leg(-2.2, -5, swing, 'lb2');
  parts.push({ prims: [S.capsule(0, -7, 11 + bob, sway, -10, 19 + bob, 1.3, 1.1), S.capsule(sway, -10, 19 + bob, sway + 1.6, -8.6, 22.5 + bob, 1.1, 1)], mat: A, blend: 0.6, id: 'tail' });
  head(0, 8.4, 15.5 + bob, false);
  return { parts, stamps };
}

const cache = new Map();

export function petSprite(kind, colorIdx, pose, frame, dir) {
  const key = [kind, colorIdx, pose, frame, dir].join('|');
  let spr = cache.get(key);
  if (spr) return spr;
  const K = PET_KINDS[kind];
  const col = K.colors[colorIdx % K.colors.length];
  const model = kind === 'gato' ? catModel(col, pose, frame) : dogModel(col, pose, frame);
  const r = renderRig(model.parts, dir, null, (rr, world) => {
    for (const st of model.stamps) {
      const [wx, wy] = world(st.n[0], st.n[1]);
      if ((wx + wy + st.n[2]) / Math.sqrt(3) < 0.1) continue;
      const [x, y] = world(st.p[0], st.p[1]);
      const rows = st.closed ? ['KK'] : st.cat ? ['gK', 'KK'] : ['K', 'K'];
      rr.map(x, y, st.p[2], rows, { K: '#1e1620', g: kind === 'gato' ? '#b8e06a' : '#ffffff' }, { ax: 0, ay: 1, bias: 3 });
    }
  });
  spr = r.finish({ outlineK: 2.2, contact: 2.5, ink: '#140e18', inkMix: 0.65 });
  spr.key = 'pet' + key;
  cache.set(key, spr);
  return spr;
}

export function petThumbColor(kind, i) {
  const c = PET_KINDS[kind].colors[i % PET_KINDS[kind].colors.length];
  return mix(c.a, c.a, 0);
}
