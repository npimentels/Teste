// Sala de estar
import { add, C, S, FABRICS, WOODS, grain, panel, marble, weave, first, legs, turnedLeg, cushion, pillow, foliage, fronds, pot, shadeHex, mix, hash } from './furni_base.js';

// ---------------------------------------------------------------- sofás
add({
  id: 'sofa_moderno', name: 'Sofá Moderno', cat: 'sala', size: [3, 1], h: 40, sit: { z: 17 },
  desc: 'Sofá de três lugares com almofadas fofas. Clique para sentar.',
  variants: FABRICS,
  draw(r, o) {
    const c = o.color, base = shadeHex(c, 0.35);
    for (const [x, y] of [[5, 6], [88, 6], [5, 25], [88, 25]]) r.box(x, y, 0, 3, 3, 5, C.walnut);
    cushion(r, 2, 4, 4, 92, 26, 10, base, { round: 3 });
    cushion(r, 2, 1, 5, 92, 9, 31, base, { round: 4 });
    for (let i = 0; i < 3; i++) {
      cushion(r, 8.5 + i * 26.5, 10, 13, 26, 20, 6, c, { round: 2.6, piping: true });
      cushion(r, 8.5 + i * 26.5, 6, 18, 26, 7, 16, c, { round: 3.4 });
    }
    cushion(r, 0, 2, 4, 9, 28, 21, base, { round: 4 });
    cushion(r, 87, 2, 4, 9, 28, 21, base, { round: 4 });
    const acc = mix(c, '#ffffff', 0.55);
    pillow(r, 18, 12, 25, 13, 5, 12, acc, (x, y, z) => [acc, (Math.floor((x + z) / 2.5) % 2) ? 0.25 : 0]);
    pillow(r, 78, 12, 25, 13, 5, 12, acc, (x, y, z) => [acc, (Math.floor((x - z) / 2.5) % 2) ? 0.25 : 0]);
  },
});

add({
  id: 'chesterfield', name: 'Sofá Chesterfield', cat: 'sala', size: [2, 1], h: 34, sit: { z: 16 },
  desc: 'Clássico de couro capitonê com braços enrolados.',
  variants: ['#7a3f2e', '#2f4a3a', '#2a3550', '#b5574b', '#4a4850'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[4, 6], [57, 6], [4, 25], [57, 25]]) turnedLeg(r, x + 1.5, y + 1.5, 0, 5, C.walnut, 1.6);
    cushion(r, 2, 3, 5, 60, 26, 10, c, { round: 3 });
    cushion(r, 2, 1, 6, 60, 9, 25, c, { round: 3.5, tuft: 5.2 });
    cushion(r, 9, 9, 14, 46, 21, 5, c, { round: 2.4, piping: true });
    for (const x of [5, 59]) {
      r.sdf([{ ...S.cbox(x - 4, 2, 5, 8, 28, 16, 3), mat: c }, { ...S.capsule(x, 3, 22, x, 29, 22, 4.8), mat: (lx, ly, lz) => [c, Math.floor(ly / 3) % 2 ? 0.2 : 0] }], { blend: 1.5 });
    }
  },
});

add({
  id: 'poltrona_concha', name: 'Poltrona Concha', cat: 'sala', size: [1, 1], h: 46, sit: { z: 16 },
  desc: 'Poltrona em forma de concha, com base giratória dourada.',
  variants: ['#d6d9df', '#e8b4b8', '#a3b5a0', '#efe4cf', '#9fa6b3'],
  draw(r, o) {
    const c = o.color;
    r.lathe(16, 16, 0, [7, 7, 6, 3, 2.2, 2.2, 2.2, 2.2, 2.6, 4, 5], C.gold, { shiny: true });
    const shell = S.intersect(
      S.bumpy(S.ellipsoid(16, 15, 24, 15, 13, 21), 1.3, (x, y, z) => Math.abs(Math.sin(Math.atan2(x - 16, z - 12) * 7))),
      { f: (x, y, z) => Math.max(y - 17 - (z - 12) * 0.15, 12 - z), bb: [0, 0, 10, 32, 32, 46] },
    );
    const hollow = S.ellipsoid(16, 19, 26, 12.5, 12, 19);
    r.sdf([{ ...S.subtract(shell, hollow), mat: (x, y, z) => [c, Math.abs(Math.sin(Math.atan2(x - 16, z - 12) * 7)) < 0.25 ? 0.45 : 0] }]);
    cushion(r, 5, 9, 11, 22, 18, 6, mix(c, '#ffffff', 0.25), { round: 3 });
  },
});

add({
  id: 'poltrona_classica', name: 'Poltrona Bergère', cat: 'sala', size: [1, 1], h: 42, sit: { z: 16 },
  desc: 'Poltrona de abas com pés torneados. Perfeita para ler.',
  variants: ['#4f5f7f', '#e8b4b8', '#a3b5a0', '#d9a23b', '#7a3f2e', '#d8d4cc'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[5, 5], [26, 5], [5, 26], [26, 26]]) turnedLeg(r, x, y, 0, 7, C.walnut, 1.5);
    cushion(r, 3, 4, 7, 26, 25, 8, c, { round: 3 });
    cushion(r, 3, 2, 8, 26, 8, 32, c, { round: 4, tuft: 6 });
    cushion(r, 1, 3, 8, 6, 24, 17, c, { round: 3 });
    cushion(r, 25, 3, 8, 6, 24, 17, c, { round: 3 });
    cushion(r, 7, 9, 14, 18, 19, 5, mix(c, '#ffffff', 0.1), { round: 2.4, piping: true });
  },
});

add({
  id: 'puff', name: 'Puff Redondo', cat: 'sala', size: [1, 1], h: 18, sit: { z: 15 }, top: 16, stack: true,
  desc: 'Puff capitonê. Serve de banco ou de apoio.',
  variants: ['#e8b4b8', '#4f5f7f', '#d9a23b', '#a3b5a0', '#d8d4cc', '#2a6a6a'],
  draw(r, o) {
    const c = o.color;
    r.sdf([{ ...S.cyl(16, 16, 0, 16, 11, 4), mat: (x, y, z) => {
      const a = Math.atan2(y - 16, x - 16);
      if (z > 14 && Math.hypot(x - 16, y - 16) < 1.6) return [c, 1.2];
      return [c, Math.abs(Math.sin(a * 5)) < 0.12 && z < 13 ? 0.5 : 0];
    } }]);
  },
});

// ---------------------------------------------------------------- mesas
add({
  id: 'mesa_vidro', name: 'Mesa de Centro de Vidro', cat: 'sala', size: [2, 1], h: 18, top: 15, stack: true, rots: 2,
  desc: 'Tampo de vidro com estrutura dourada e prateleira com livros.',
  variants: [C.gold, C.black, C.chrome, C.walnut],
  draw(r, o) {
    const f = o.color;
    for (const [x, y] of [[4, 6], [58, 6], [4, 24], [58, 24]]) r.box(x, y, 0, 2, 2, 14, f);
    r.box(4, 6, 13, 56, 2, 1, f); r.box(4, 24, 13, 56, 2, 1, f);
    r.box(4, 6, 13, 2, 20, 1, f); r.box(58, 6, 13, 2, 20, 1, f);
    r.box(5, 7, 3, 54, 18, 2, C.walnut, { tex: { top: grain('u', 2) } });
    r.box(12, 11, 5, 14, 10, 2, '#b5574b'); r.box(13, 12, 7, 12, 9, 2, '#3a4a6b'); r.box(14, 12, 9, 10, 8, 1.5, '#e8d9b8');
    r.lathe(44, 16, 5, [2.6, 3.2, 3.6, 3.8, 3.6, 3, 2.2, 1.6, 1.6, 2], C.white, { shiny: true });
    r.box(2, 4, 14, 60, 24, 2, C.glass, { alpha: 0.42, tex: { top: (u, v) => (u + v > 18 && u + v < 22 ? { raw: '#ffffff' } : null) } });
  },
});

add({
  id: 'mesa_lateral', name: 'Mesa Lateral Redonda', cat: 'sala', size: [1, 1], h: 30, top: 27, stack: true, rots: 1,
  desc: 'Mesinha de apoio com tampo de mármore.',
  variants: [C.marble, '#2e2b33', '#c8b9a6'],
  draw(r, o) {
    r.lathe(16, 16, 0, [7, 7, 6, 2], C.gold, { shiny: true });
    r.lathe(16, 16, 4, new Array(20).fill(1.4), C.gold, { shiny: true });
    r.lathe(16, 16, 24, [11, 12, 12], o.color, { topTex: (nx, ny) => marble(3)(nx * 20, ny * 20) });
  },
});

add({
  id: 'rack_tv', name: 'Rack de TV', cat: 'sala', size: [2, 1], h: 30, top: 26, stack: true,
  desc: 'Rack com gavetas e portas. Coloque a TV em cima!',
  variants: [C.walnut, C.oak, C.white, C.black, '#6f8a7a'],
  draw(r, o) {
    const c = o.color, g = grain('u', 4);
    for (const [x, y] of [[4, 8], [57, 8], [4, 24], [57, 24]]) r.box(x, y, 0, 3, 3, 6, C.black);
    r.box(1, 6, 6, 62, 22, 18, c, {
      tex: {
        left: first(
          (u, v) => { const U = Math.floor(u), V = Math.floor(v); if ((U === 21 || U === 41) && V >= 9 && V <= 10) return C.brass; if (V === 11 && ((U >= 25 && U <= 37))) return C.brass; return null; },
          (u, v) => panel(u, v, 2, 1, 19, 16), (u, v) => panel(u, v, 22, 13, 40, 16) ?? panel(u, v, 22, 1, 40, 11), (u, v) => panel(u, v, 43, 1, 59, 16), g),
        right: g, top: g,
      },
    });
    r.box(0, 5, 24, 64, 24, 2, shadeHex(c, -0.25), { tex: { top: g } });
  },
});

const tvScene = (u, v, f) => {
  // paisagem animada: céu, sol, nuvem passando, colinas e um lago
  const W = 52, H = 28;
  const cx = ((u + f * 3) % (W + 14)) - 7;
  if (v < 6 + Math.sin(u * 0.25) * 2) return '#4f9a4a';
  if (v < 9 + Math.sin(u * 0.15 + 2) * 3) return '#6fbf5a';
  if (v < 11 && u > 30) return (u + f) % 4 === 0 ? '#bfe6ff' : '#5ab0e0';
  if (Math.hypot(u - 42, v - 21) < 3.4) return '#ffe27a';
  if (Math.hypot(u - cx, (v - 20) * 1.6) < 4 || Math.hypot(u - cx - 4, (v - 21) * 1.6) < 3.4) return '#ffffff';
  void W; void H;
  return v > 22 ? '#7cc0f0' : '#a7d8fb';
};

add({
  id: 'tv_tela', name: 'TV de Tela Plana', cat: 'sala', size: [2, 1], h: 48, states: ['Desligada', 'Ligada'], frames: 4, fps: 3,
  desc: 'TV fininha com pezinho. Fica linda em cima do rack.',
  variants: ['#26242b', '#e8e6e2'],
  light: (o) => (o.state ? { x: 32, y: 26, z: 26, color: '#a8d8ff', r: 110 } : null),
  draw(r, o) {
    const c = o.color;
    r.box(20, 12, 0, 24, 10, 2, c);
    r.box(30, 15, 2, 4, 3, 8, c);
    r.box(4, 15, 10, 56, 3, 34, c, {
      tex: {
        left: (u, v) => {
          if (u < 2 || u > 54 || v < 3 || v > 32) return v < 3 && Math.floor(u) === 27 ? { raw: o.state ? '#7cff9a' : '#ff6b6b' } : null;
          if (!o.state) { const d = u - (v - 3) * 0.7; return { raw: d > 16 && d < 22 ? '#3c4250' : d > 24 && d < 26 ? '#353a46' : '#1e2128' }; }
          return { raw: tvScene(u - 2, v - 3, o.frame) };
        },
      },
    });
  },
});

// ---------------------------------------------------------- estantes
add({
  id: 'estante', name: 'Estante com Nichos', cat: 'sala', size: [2, 1], h: 100,
  desc: 'Estante de madeira com livros, vasinhos e um porta-retrato.',
  variants: [C.walnut, C.oak, C.white, C.black],
  draw(r, o) {
    const c = o.color, g = grain('v', 2);
    const books = ['#b5574b', '#3a4a6b', '#d9a23b', '#4a9a92', '#6b4f7a', '#e8d9b8', '#7fa86b', '#2e2b33', '#e8b4b8'];
    r.box(0, 0, 0, 64, 3, 96, shadeHex(c, 0.6));
    r.box(0, 0, 0, 3, 26, 96, c, { tex: { left: g, right: g } });
    r.box(61, 0, 0, 3, 26, 96, c, { tex: { left: g, right: g } });
    for (const z of [0, 30, 62]) r.box(3, 2, z, 58, 24, 3, c, { tex: { top: grain('u', z) } });
    r.box(0, 0, 93, 64, 26, 4, shadeHex(c, -0.2));
    // livros nas prateleiras
    const shelf = (z, x0, x1, seed) => {
      let x = x0, i = 0;
      while (x < x1) {
        const bw = 2.5 + Math.floor(hash(i, seed) * 3);
        if (x + bw > x1) break;
        const bh = 16 + Math.floor(hash(i, seed + 1) * 9);
        const col = books[Math.floor(hash(i, seed + 2) * books.length)];
        const lean = hash(i, seed + 4) > 0.9;
        if (!lean) r.box(x, 6, z, bw, 17, bh, col, { tex: { left: (u, v) => (Math.floor(v) === bh - 4 || Math.floor(v) === 3 ? C.gold : null), top: () => ['#f1e7d0', 0] } });
        x += bw + (hash(i, seed + 3) > 0.8 ? 1 : 0);
        i++;
      }
    };
    shelf(3, 4, 36, 1);
    r.lathe(48, 15, 3, [3, 4, 4.5, 4.8, 4.5, 3.8, 2.6, 2, 2, 2.4], '#4a9a92', { shiny: true });
    shelf(33, 30, 60, 5);
    r.box(7, 10, 33, 14, 12, 2, '#e8d9b8'); r.box(8, 11, 35, 12, 10, 2, '#3a4a6b');
    r.box(10, 14, 37, 9, 2, 12, C.gold, { tex: { left: (u, v) => (u > 1 && u < 8 && v > 1 && v < 11 ? { raw: v > 6 ? '#bfe3f0' : '#8cc265' } : null) } });
    shelf(65, 20, 60, 9);
    pot(r, 11, 15, 8, 3.4, 4.6, C.white, { shiny: true });
    foliage(r, 11, 15, 14, 7, 6, 4, { n: 16, leaf: 2.6, seed: 4 });
  },
});

// ---------------------------------------------------------- luminárias
add({
  id: 'luminaria_arco', name: 'Luminária de Arco', cat: 'sala', size: [1, 1], h: 92, states: ['Desligada', 'Ligada'],
  desc: 'Luminária de chão em arco, base de mármore.',
  variants: [C.chrome, C.gold, C.black],
  light: (o) => (o.state ? { x: 16, y: 44, z: 58, color: '#ffe0a8', r: 150 } : null),
  draw(r, o) {
    r.box(8, 6, 0, 16, 16, 6, C.marble, { tex: { left: marble(1), right: marble(2), top: marble(3) } });
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([16, 14 + Math.sin(t * Math.PI * 0.6) * 30, 6 + Math.sin(t * Math.PI * 0.85) * 80 * (1 - t * 0.1)]);
    }
    const prims = [];
    for (let i = 0; i < pts.length - 1; i++) prims.push({ ...S.capsule(...pts[i], ...pts[i + 1], 1.1), mat: o.color });
    r.sdf(prims);
    const [ex, ey, ez] = pts[pts.length - 1];
    r.sdf([{ ...S.intersect(S.sphere(ex, ey + 2, ez - 6, 10), { f: (x, y, z) => ez - 6 - z, bb: [ex - 10, ey - 8, ez - 7, ex + 10, ey + 12, ez + 5] }), mat: o.color }]);
    r.sdf([{ ...S.sphere(ex, ey + 2, ez - 7, 4.5), mat: o.state ? { raw: '#fff6d8' } : '#e6e2d8', glow: !!o.state }]);
  },
});

add({
  id: 'luminaria', name: 'Luminária Clássica', cat: 'sala', size: [1, 1], h: 76, states: ['Desligada', 'Ligada'],
  desc: 'Luz quentinha com cúpula de tecido.',
  variants: ['#f1e4c6', '#e8b4b8', '#a3b5a0', '#2e2b33'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 58, color: '#ffcf86', r: 140 } : null),
  draw(r, o) {
    r.lathe(16, 16, 0, [8, 8, 7.5, 6, 3, 2.2], C.brass, { shiny: true });
    r.lathe(16, 16, 6, new Array(44).fill(1.4), C.brass, { shiny: true });
    const prof = [];
    for (let i = 0; i < 22; i++) prof.push(12 - i * 0.24);
    r.lathe(16, 16, 50, prof, o.state ? mix(o.color, '#fff4c2', 0.55) : o.color, {
      glow: !!o.state, sideTex: (nx, i) => (i === 1 || i === 20 ? 0.5 : null),
      topTex: (nx, ny, d) => (d < 0.5 ? (o.state ? { raw: '#fffbe0' } : 1.4) : d < 0.6 ? 0.4 : 0),
    });
  },
});

// ---------------------------------------------------------- tapetes
const rugDraw = (pattern) => (r, o) => {
  const [w, d] = o.fp;
  r.box(3, 3, 0, w - 6, d - 6, 1, o.color, { tex: { top: (u, v) => pattern(u, v, w - 6, d - 6, o.color) } });
};

add({
  id: 'tapete_moderno', name: 'Tapete Moderno', cat: 'sala', size: [3, 2], h: 2, walk: true, flat: true, rots: 2,
  desc: 'Tapete liso com friso duplo. Elegante e discreto.',
  variants: ['#a8957c', '#9fa6b3', '#d8cfc0', '#6b6f7a', '#c7a7a0'],
  draw: rugDraw((u, v, w, d, c) => {
    const e = Math.min(u, v, w - u, d - v);
    if (e < 1) return 0.7;
    if (Math.floor(e) === 4 || Math.floor(e) === 7) return mix(c, '#ffffff', 0.45);
    return (hash(Math.floor(u), Math.floor(v)) - 0.5) * 0.12;
  }),
});

add({
  id: 'tapete_geometrico', name: 'Tapete Geométrico', cat: 'sala', size: [3, 3], h: 2, walk: true, flat: true, rots: 2,
  desc: 'Triângulos azuis e brancos, como nos quartos de designer.',
  variants: ['#3a4a6b', '#4a6a5a', '#7a4a5a', '#2e2b33'],
  draw: rugDraw((u, v, w, d, c) => {
    const e = Math.min(u, v, w - u, d - v);
    if (e < 1) return 0.8;
    const cell = 11, cu = Math.floor(u / cell), cv = Math.floor(v / cell);
    const lu = (u % cell) / cell, lv = (v % cell) / cell;
    const tri = (cu + cv) % 2 ? lu > lv : lu + lv < 1;
    const kind = Math.floor(hash(cu, cv) * 3);
    if (tri) return kind === 0 ? [c, 0] : kind === 1 ? [mix(c, '#ffffff', 0.45), 0] : ['#f4f2ee', 0];
    return ['#f4f2ee', (hash(Math.floor(u), Math.floor(v)) - 0.5) * 0.12];
  }),
});

add({
  id: 'tapete_persa', name: 'Tapete Persa', cat: 'sala', size: [2, 3], h: 2, walk: true, flat: true, rots: 2,
  desc: 'Tapete com medalhão central e franjas.',
  variants: ['#9a3b3b', '#2f4a6b', '#3f6a4a', '#7a4a6a'],
  draw(r, o) {
    const [w, d] = o.fp, c = o.color, acc = '#e8d0a0', inner = shadeHex(c, 1.2);
    r.box(4, 4, 0, w - 8, d - 8, 1, c, {
      tex: {
        top: (u, v) => {
          const W = w - 8, D = d - 8, U = Math.floor(u), V = Math.floor(v);
          const e = Math.min(U, V, W - 1 - U, D - 1 - V);
          if (e === 0) return 0.6;
          if (e === 3 || e === 7) return acc;
          if (e < 7) return (U + V) % 4 === 0 ? acc : (U - V) % 6 === 0 ? inner : 0;
          const dd = Math.abs(u - W / 2) / W * 2 + Math.abs(v - D / 2) / D * 2;
          if (Math.abs(dd - 0.55) < 0.04 || Math.abs(dd - 0.3) < 0.03) return acc;
          if (dd < 0.3) return [inner, (U + V) % 3 === 0 ? -0.6 : 0];
          return (U % 5 === 0 && V % 5 === 0) ? acc : 0;
        },
      },
    });
    const f = [];
    for (let x = 6; x < w - 6; x += 2) f.push([x, 2, 0, '#f6ead0'], [x, 3, 0, '#f6ead0'], [x, d - 3, 0, '#f6ead0'], [x, d - 4, 0, '#f6ead0']);
    r.pts(f);
  },
});

add({
  id: 'tapete_felpudo', name: 'Tapete Felpudo', cat: 'sala', size: [2, 2], h: 3, walk: true, flat: true, rots: 1,
  desc: 'Tapete redondo e macio, tipo pelúcia.',
  variants: ['#f4f2ee', '#e8b4b8', '#d8cfc0', '#9fa6b3', '#c8b0f0'],
  draw(r, o) {
    r.lathe(32, 32, 0, [27, 27, 26], o.color, { topTex: (nx, ny, d) => (hash(Math.floor(nx * 26), Math.floor(ny * 26)) - 0.5) * 1.1 + (d > 0.94 ? 0.6 : 0) });
  },
});

// ------------------------------------------------------------ decoração
add({
  id: 'palmeira', name: 'Palmeira no Vaso', cat: 'plantas', size: [1, 1], h: 84, rots: 2,
  desc: 'Areca exuberante num vaso alto de cerâmica.',
  variants: ['#d8c4a8', C.white, '#3a3a40', C.terra],
  draw(r, o) {
    pot(r, 16, 16, 26, 7, 9, o.color, { belly: 3 });
    const st = [];
    for (let i = 0; i < 5; i++) { const a = i * 1.3; st.push({ ...S.capsule(16, 16, 22, 16 + Math.cos(a) * 4, 16 + Math.sin(a) * 4, 52 + i * 3, 0.9), mat: '#7a8a3a' }); }
    r.sdf(st);
    fronds(r, 16, 16, 50, 9, 26, { up: 1.2, droop: 1.4, width: 2.4, segs: 5 });
    fronds(r, 16, 16, 62, 6, 20, { up: 1.3, droop: 1.3, width: 2.2, segs: 4, seed: 0.5, pal: [C.leafL, '#7fb85a'] });
  },
});

add({
  id: 'costela_adao', name: 'Costela-de-Adão', cat: 'plantas', size: [1, 1], h: 56, rots: 2,
  desc: 'Folhas enormes e recortadas num vaso de concreto.',
  variants: ['#b9b5ad', C.white, C.terra, '#3a3a40'],
  draw(r, o) {
    pot(r, 16, 16, 16, 8, 9, o.color);
    const prims = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3, L = 12 + hash(i, 3) * 8;
      const ex = 16 + Math.cos(a) * L, ey = 16 + Math.sin(a) * L, ez = 26 + hash(i, 5) * 22;
      prims.push({ ...S.capsule(16, 16, 14, ex * 0.6 + 6.4, ey * 0.6 + 6.4, ez - 4, 0.6), mat: '#4f7a3a' });
      const leaf = S.ellipsoid(ex, ey, ez, 7, 7, 1.6);
      prims.push({ ...S.subtract(leaf, { f: (x, y, z) => Math.abs(Math.sin(Math.atan2(y - ey, x - ex) * 4)) * 7 - Math.hypot(x - ex, y - ey) + 1.5, bb: leaf.bb }), mat: (x, y) => [i % 2 ? C.leaf : '#4a8a3e', Math.hypot(x - ex, y - ey) < 1 ? 0.4 : 0] });
    }
    r.sdf(prims);
  },
});

add({
  id: 'vaso_pampas', name: 'Vaso com Capim-dos-pampas', cat: 'plantas', size: [1, 1], h: 70, rots: 1,
  desc: 'Vaso de cerâmica com plumas secas. Toque boho.',
  variants: ['#f2efe9', '#d9a07a', '#3a3a40'],
  draw(r, o) {
    r.lathe(16, 16, 0, [5, 6, 7, 7.6, 8, 8, 7.8, 7.4, 6.8, 6, 5, 4, 3.2, 2.8, 2.8, 3.2, 3.6, 3.8], o.color, { shiny: true });
    const prims = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.95, tx = 16 + Math.cos(a) * 9, ty = 16 + Math.sin(a) * 9, tz = 52 + hash(i, 9) * 14;
      prims.push({ ...S.capsule(16, 16, 16, tx, ty, tz - 8, 0.5), mat: '#c9b48a' });
      prims.push({ ...S.bumpy(S.ellipsoid(tx, ty, tz, 2.6, 2.6, 7), 0.8, (x, y, z) => Math.sin(z * 2.2 + x) * Math.sin(y * 2)), mat: '#efe2c4' });
    }
    r.sdf(prims);
  },
});

// Aquário com peixinhos animados
add({
  id: 'aquario', name: 'Aquário', cat: 'sala', size: [2, 1], h: 64, frames: 4, fps: 3, states: ['Luz apagada', 'Luz acesa'],
  desc: 'Aquário com peixes-palhaço, plantas e pedrinhas.',
  variants: [C.walnut, C.white, C.black],
  light: (o) => (o.state ? { x: 32, y: 20, z: 44, color: '#8fe0ff', r: 100 } : null),
  draw(r, o) {
    const c = o.color;
    r.box(2, 4, 0, 60, 22, 26, c, { tex: { left: first((u, v) => panel(u, v, 3, 3, 28, 21) ?? panel(u, v, 31, 3, 56, 21), grain('u', 1)), right: grain('u', 2) } });
    r.box(1, 3, 26, 62, 24, 2, shadeHex(c, -0.2));
    r.box(5, 8, 28, 54, 15, 3, '#d9c7a0', { tex: { top: (u, v) => [['#d9c7a0', '#b8a07a', '#efe2c4', '#9a8a7a'][Math.floor(hash(Math.floor(u), Math.floor(v)) * 4)], 0] } });
    for (const [x, h, s] of [[10, 18, 1], [18, 12, 2], [46, 22, 3], [53, 14, 4]]) {
      const pr = [];
      for (let k = 0; k < 4; k++) pr.push({ ...S.capsule(x + k - 1.5, 15 + (k % 2) * 3, 31, x + Math.sin(k + o.frame * 0.8 + s) * 2, 15 + (k % 2) * 3, 31 + h - k * 2, 1.1), mat: k % 2 ? C.leaf : C.leafL });
      r.sdf(pr);
    }
    const fish = (fx, fy, fz, dir, col) => {
      r.sdf([{ ...S.ellipsoid(fx, fy, fz, 3, 1.4, 2), mat: (x) => (Math.abs(x - fx) < 0.5 || Math.abs(x - fx - 1.6) < 0.4 ? '#ffffff' : col) }, { ...S.ellipsoid(fx - dir * 3.4, fy, fz, 1, 0.6, 1.6), mat: col }]);
      r.pts([[Math.round(fx + dir * 2), Math.round(fy) + 2, fz + 1, '#1e1620']], {});
    };
    const f = o.frame;
    fish(16 + f * 6, 15, 42 + (f % 2), 1, '#ff8a3a');
    fish(48 - f * 5, 13, 50 - (f % 2), -1, '#ffb03a');
    fish(30 + ((f * 7) % 20), 17, 36, 1, '#ff6b4a');
    const bub = [];
    for (let i = 0; i < 5; i++) bub.push([52, 15, 34 + ((i * 6 + f * 4) % 24), '*#e8fbff']);
    r.pts(bub);
    r.box(3, 6, 28, 58, 19, 30, C.water, { alpha: 0.3, tex: { top: () => ({ raw: '#9fe0ff' }) } });
    r.box(2, 5, 28, 60, 21, 32, C.glass, { alpha: 0.14 });
    r.box(1, 4, 58, 62, 23, 4, '#2e2b33', { tex: { left: (u, v) => (o.state && Math.floor(u) % 6 === 2 && v < 1.5 ? { raw: '#e8fbff' } : null) } });
  },
});

add({
  id: 'lareira', name: 'Lareira de Mármore', cat: 'sala', size: [2, 1], h: 100, states: ['Apagada', 'Acesa'], frames: 3, fps: 8,
  desc: 'Lareira clássica de mármore branco. Duplo clique para acender.',
  variants: [C.marble, '#a59c8f', '#3a3a40'],
  light: (o) => (o.state ? { x: 32, y: 34, z: 14, color: '#ff9a4a', r: 190, flicker: true } : null),
  draw(r, o) {
    const s = o.color, m = marble(4);
    r.box(0, 2, 0, 64, 18, 48, s, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          const inA = U >= 14 && U <= 49 && (V <= 26 || (V <= 34 && Math.abs(u - 31.5) < 17.5 - (V - 26) * 1.9));
          if (inA) return o.state ? (V < 3 ? ['#3a2420', 0] : ['#2a1a1a', 0.5]) : ['#1e1820', 0];
          if (U === 13 || U === 50) return 0.7;
          if (V === 40 || V === 41) return 0.5;
          return m(u, v);
        },
        right: m, back: m, top: m,
      },
    });
    r.box(-3, 0, 48, 70, 23, 4, s, { tex: { left: m, right: m, top: m } });
    r.box(14, 4, 52, 36, 12, 48, mix(s, '#e6dccb', 0.3), { tex: { left: first((u, v) => panel(u, v, 4, 6, 31, 40), m), right: m } });
    if (o.back) return;
    for (const [x, y, z] of [[24, 22, 0], [38, 22, 0], [31, 21, 4]]) r.sdf([{ ...S.capsule(x - 6, y, z + 2, x + 6, y, z + 2, 2.4), mat: (lx) => (Math.abs(lx - x) > 5 ? '#e0b88a' : '#6b4430') }]);
    if (o.state) {
      const fl = [];
      for (let i = 0; i < 6; i++) {
        const fx = 20 + i * 4.2, hgt = 9 + ((i * 7 + o.frame * 5) % 10);
        fl.push({ ...S.ellipsoid(fx + 2, 21, 5 + hgt / 2, 2.6, 1.4, hgt / 2 + 1.5), mat: (x, y, z) => ({ raw: z > 5 + hgt * 0.75 ? '#ffe27a' : z > 5 + hgt * 0.35 ? '#ffab3d' : '#f2603a' }), glow: true });
      }
      r.sdf(fl);
    }
  },
});

add({
  id: 'relogio_pendulo', name: 'Relógio de Pêndulo', cat: 'sala', size: [1, 1], h: 100, frames: 4, fps: 2,
  desc: 'Tic-tac do vovô. O pêndulo balança sem parar.',
  variants: [C.mahogany, C.walnut, C.black],
  draw(r, o) {
    const c = o.color, sw = [-3, 0, 3, 0][o.frame % 4];
    r.box(4, 6, 0, 24, 18, 6, shadeHex(c, 0.3));
    r.box(6, 7, 6, 20, 15, 74, c, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          const dx = u - 10, dy = v - 62, d = Math.hypot(dx, dy);
          if (d < 7.5) {
            if (d > 6.4) return C.gold;
            const a = Math.atan2(dx, dy);
            if (d > 5 && Math.abs(Math.sin(a * 6)) < 0.18) return ['#2b2232', 0];
            if (Math.abs(dx) < 0.6 && dy > 0 && dy < 4.5) return ['#2b2232', 0];
            if (Math.abs(dy) < 0.6 && dx > 0 && dx < 3.5) return ['#2b2232', 0];
            return ['#fbf3df', -0.4];
          }
          if (U >= 4 && U <= 16 && V >= 8 && V <= 48) {
            if (U === 4 || U === 16 || V === 8 || V === 48) return C.gold;
            const px = 10 + sw * ((48 - V) / 38);
            if (Math.abs(u - px) < 0.6 && V > 18) return C.gold;
            if (Math.hypot(u - (10 + sw * 0.85), v - 15) < 3.2) return [C.gold, -0.6];
            return ['#2a2430', 0];
          }
          return grain('v', 3)(u, v);
        },
      },
    });
    r.box(4, 5, 80, 24, 20, 5, shadeHex(c, -0.3));
    r.box(9, 9, 85, 14, 12, 8, shadeHex(c, -0.1));
    r.sdf([{ ...S.sphere(16, 15, 96, 3), mat: C.gold }]);
  },
});
export const sala = 1;
