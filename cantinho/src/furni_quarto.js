// Quarto
import { add, C, S, FABRICS, WOODS, grain, panel, marble, weave, first, legs, turnedLeg, cushion, pillow, foliage, pot, shadeHex, mix, hash } from './furni_base.js';

const bed = (W) => (r, o) => {
  const c = o.color, wood = C.walnut, linen = '#f4f2ee';
  const head = mix(c, '#2a2a30', 0.15);
  // cabeceira estofada alta
  r.box(0, 0, 0, W, 4, 6, shadeHex(wood, 0.3));
  cushion(r, 0, 0, 4, W, 6, 46, head, { round: 3, tuft: W > 40 ? 8 : 7 });
  // estrado e colchão
  r.box(1, 5, 2, W - 2, 88, 10, wood, { tex: { left: grain('u', 1), right: grain('u', 3) } });
  legs(r, 2, 6, W - 2, 92, 3, shadeHex(wood, 0.6), 3);
  r.sdf([{ ...S.cbox(2, 6, 12, W - 4, 84, 8, 3), mat: linen }]);
  // travesseiros
  const pw = W > 40 ? 26 : 22;
  for (let i = 0; i < (W > 40 ? 2 : 1); i++) {
    const cx = W > 40 ? 16 + i * 32 : W / 2;
    pillow(r, cx, 14, 23, pw, 9, 7, linen);
    pillow(r, cx + (i ? -2 : 2), 20, 25, pw - 8, 5, 9, c, (x, y, z) => [c, (Math.floor((x + 40) / 3) + Math.floor((z + 40) / 3)) % 2 ? 0.3 : 0]);
  }
  if (W > 40) pillow(r, W / 2, 23, 24, 10, 6, 9, '#f4f2ee', (x, y, z) => ['#f4f2ee', Math.hypot(x, z) < 2 ? 0.5 : 0]);
  // edredom com dobra e manta nos pés
  const duvet = (x, y, z) => {
    if (y < 34) return [linen, 0];
    return [c, (Math.floor(y / 6) % 2 && Math.floor(x / 6) % 2) ? 0.12 : Math.floor(y) % 6 === 0 ? 0.25 : 0];
  };
  r.sdf([{ ...S.cbox(0, 28, 13, W, 64, 9, 3), mat: duvet }]);
  if (o.occupied) r.sdf([{ ...S.ellipsoid(W / 2, 58, 21, W > 40 ? 9 : 7, 22, 5), mat: c }]);
  r.sdf([{ ...S.cbox(-1, 72, 13, W + 2, 14, 10.5, 2.5), mat: (x, y, z) => ['#e8e2d8', Math.floor(x / 3) % 2 ? 0.2 : 0] }]);
  r.box(0, 92, 0, W, 4, 16, wood, { tex: { left: grain('u', 2) } });
};

add({
  id: 'cama_casal', name: 'Cama de Casal', cat: 'quarto', size: [2, 3], h: 50, lay: { z: 22, head: [32, 16] },
  desc: 'Cama com cabeceira estofada capitonê, travesseiros e manta. Clique para deitar.',
  variants: ['#5f7394', '#e8b4b8', '#a3b5a0', '#d9c7a0', '#6b4f7a', '#4a4850'],
  draw: bed(64),
});

add({
  id: 'cama_solteiro', name: 'Cama de Solteiro', cat: 'quarto', size: [1, 3], h: 50, lay: { z: 22, head: [16, 16] },
  desc: 'Caminha estreita e aconchegante.',
  variants: ['#5f7394', '#e8b4b8', '#a3b5a0', '#d9c7a0', '#6b4f7a'],
  draw: bed(32),
});

add({
  id: 'criado', name: 'Criado-mudo', cat: 'quarto', size: [1, 1], h: 30, top: 27, stack: true,
  desc: 'Duas gavetas com puxadores dourados. Apoie um abajur em cima.',
  variants: [C.walnut, C.oak, C.white, C.black],
  draw(r, o) {
    const c = o.color, g = grain('u', 5);
    legs(r, 4, 6, 28, 28, 5, C.black, 2);
    r.box(2, 4, 5, 28, 24, 20, c, {
      tex: {
        left: first((u, v) => (Math.floor(v) === 9 || Math.floor(v) === 10 ? 0.7 : null), (u, v) => ((Math.floor(v) === 5 || Math.floor(v) === 15) && u > 11 && u < 17 ? C.brass : null), (u, v) => panel(u, v, 2, 1, 25, 8) ?? panel(u, v, 2, 11, 25, 18), g),
        right: g, top: g,
      },
    });
    r.box(1, 3, 25, 30, 26, 2, shadeHex(c, -0.25), { tex: { top: grain('u', 2) } });
  },
});

add({
  id: 'abajur', name: 'Abajur de Cerâmica', cat: 'quarto', size: [1, 1], h: 36, small: true, states: ['Desligado', 'Ligado'], rots: 1,
  desc: 'Base redonda de cerâmica e cúpula de linho. Fica em cima dos móveis.',
  variants: ['#5f7394', '#f2efe9', '#e8b4b8', '#a3b5a0', '#d9a23b'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 26, color: '#ffd29a', r: 100 } : null),
  draw(r, o) {
    r.lathe(16, 16, 0, [4, 5, 6.5, 7.5, 8, 8, 7.6, 7, 6, 4.6, 3, 2, 1.6, 1.4], o.color, { shiny: true });
    r.lathe(16, 16, 14, new Array(4).fill(0.8), C.brass);
    const prof = []; for (let i = 0; i < 14; i++) prof.push(10 - i * 0.18);
    r.lathe(16, 16, 18, prof, o.state ? '#fff2d0' : '#f1e8d6', {
      glow: !!o.state, sideTex: (nx, i) => (i === 0 || i === 13 ? 0.4 : null),
      topTex: (nx, ny, d) => (d < 0.55 ? (o.state ? { raw: '#fffbe0' } : 1.3) : 0),
    });
  },
});

add({
  id: 'guarda_roupa', name: 'Guarda-roupa', cat: 'quarto', size: [2, 1], h: 108, states: ['Fechado', 'Aberto'],
  desc: 'Armário alto de duas portas. Duplo clique para ver as roupas.',
  variants: [C.walnut, C.oak, C.white, '#6f8a7a', '#e8e2d8'],
  draw(r, o) {
    const c = o.color, open = o.state === 1, g = grain('v', 6);
    r.box(0, 0, 0, 64, 28, 6, shadeHex(c, 0.5));
    if (!open) {
      r.box(0, 0, 6, 64, 28, 96, c, {
        tex: {
          left: first(
            (u, v) => (Math.floor(u) === 31 || Math.floor(u) === 32 ? 0.9 : null),
            (u, v) => ((Math.floor(u) === 28 || Math.floor(u) === 35) && v > 44 && v < 56 ? C.brass : null),
            (u, v) => panel(u, v, 4, 6, 27, 88) ?? panel(u, v, 36, 6, 59, 88), g),
          right: g, top: g,
        },
      });
    } else {
      r.box(0, 0, 6, 64, 3, 96, shadeHex(c, 1.6));
      r.box(0, 0, 6, 3, 28, 96, c, { tex: { right: g, left: g } });
      r.box(61, 0, 6, 3, 28, 96, c, { tex: { right: g, left: g } });
      r.box(3, 3, 6, 58, 25, 3, shadeHex(c, 0.8));
    }
    r.box(-2, -1, 102, 68, 31, 5, shadeHex(c, -0.2));
    if (open) {
      r.sdf([{ ...S.capsule(3, 16, 84, 61, 16, 84, 0.8), mat: C.chrome }]);
      const cols = ['#e8b4b8', '#5f7394', '#f4f2ee', '#a3b5a0', '#d9a23b', '#6b4f7a', '#2e2b33', '#b5574b'];
      for (let i = 0; i < 9; i++) {
        const x = 7 + i * 6, len = 24 + hash(i, 2) * 26;
        r.sdf([{ ...S.cbox(x, 9, 84 - len, 4, 15, len, 1.4), mat: cols[i % cols.length] }]);
        r.sdf([{ ...S.capsule(x + 2, 16, 84, x + 2, 16, 87, 0.5), mat: C.chrome }]);
      }
      for (let i = 0; i < 3; i++) r.sdf([{ ...S.cbox(8 + i * 18, 8, 9, 12, 10, 7, 2), mat: ['#2e2b33', '#b5574b', '#f4f2ee'][i] }]);
      const door = (u, v) => panel(u, v, 3, 6, 26, 88) ?? g(u, v);
      r.box(-2, 28, 6, 2, 30, 96, c, { tex: { right: door } });
      r.box(64, 28, 6, 2, 30, 96, c, { tex: { right: door } });
    }
  },
});

add({
  id: 'comoda', name: 'Cômoda', cat: 'quarto', size: [2, 1], h: 46, top: 42, stack: true,
  desc: 'Cômoda de quatro gavetas. Ótima para decorar em cima.',
  variants: [C.white, C.walnut, C.oak, '#a3b5a0', '#e8b4b8'],
  draw(r, o) {
    const c = o.color, g = grain('u', 7);
    for (const [x, y] of [[4, 7], [57, 7], [4, 24], [57, 24]]) turnedLeg(r, x + 1.5, y + 1.5, 0, 6, shadeHex(c, 0.4), 1.6);
    r.box(2, 5, 6, 60, 22, 34, c, {
      tex: {
        left: first(
          (u, v) => { const row = Math.floor(v / 8.5); const lv = v - row * 8.5; return Math.abs(lv - 4.2) < 0.7 && Math.abs(u - 30) < 4 ? C.brass : null; },
          (u, v) => { const row = Math.floor(v / 8.5); return panel(u, v - row * 8.5, 2, 1, 57, 7); }, g),
        right: g, top: g,
      },
    });
    r.box(1, 4, 40, 62, 24, 2, shadeHex(c, -0.2), { tex: { top: g } });
  },
});

add({
  id: 'penteadeira', name: 'Penteadeira', cat: 'quarto', size: [2, 1], h: 92,
  desc: 'Penteadeira com espelho oval, maquiagens e perfumes.',
  variants: [C.white, '#e8b4b8', C.walnut, '#a3b5a0'],
  draw(r, o) {
    const c = o.color, g = grain('u', 3);
    for (const [x, y] of [[4, 6], [57, 6], [4, 23], [57, 23]]) turnedLeg(r, x + 1.5, y + 1.5, 0, 22, shadeHex(c, 0.2), 1.6);
    r.box(2, 4, 22, 60, 22, 8, c, { tex: { left: first((u, v) => (Math.abs(u - 30) < 3 && Math.floor(v) === 4 ? C.gold : null), (u, v) => panel(u, v, 3, 1, 56, 6), g) } });
    r.box(1, 3, 30, 62, 24, 2, shadeHex(c, -0.2));
    // espelho oval
    r.box(14, 4, 32, 36, 3, 56, c, {
      tex: {
        left: (u, v) => {
          const d = Math.hypot((u - 18) / 16, (v - 30) / 25);
          if (d > 1.05) return { skip: true };
          if (d > 0.9) return C.gold;
          const s = u - (v - 30) * 0.4;
          return { raw: s > 6 && s < 10 ? '#f4fbff' : v > 34 ? '#cfe4ee' : '#b4d2df' };
        },
        top: () => ({ skip: true }), right: (u, v) => (Math.hypot((u - 1.5) / 5, (v - 30) / 25) > 1.05 ? { skip: true } : C.gold),
      },
    });
    // maquiagem e perfumes
    r.lathe(8, 16, 32, [2.2, 2.6, 2.6, 2.6, 2.4, 1.2, 1.2, 1.6], '#e8b4b8', { shiny: true, topTex: () => C.gold });
    r.lathe(54, 14, 32, [2.6, 3, 3, 3, 2.8, 1.2, 1.2], '#c8b0f0', { shiny: true, topTex: () => C.gold });
    r.lathe(58, 20, 32, [1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4, 1.4], '#c94f6a', { topTex: () => '#e8b4b8' });
    r.box(44, 18, 32, 6, 4, 1, C.gold);
  },
});

add({
  id: 'banqueta', name: 'Banqueta Capitonê', cat: 'quarto', size: [2, 1], h: 22, sit: { z: 17 }, rots: 2,
  desc: 'Banco estofado com pés entalhados, para o pé da cama.',
  variants: ['#d6d9df', '#5f7394', '#e8b4b8', '#a3b5a0', '#d9a23b'],
  draw(r, o) {
    const c = o.color;
    for (const [x, y] of [[5, 8], [57, 8], [5, 23], [57, 23]]) turnedLeg(r, x, y, 0, 12, '#8a6a52', 1.8);
    r.box(3, 7, 10, 58, 18, 3, '#8a6a52', { tex: { left: (u, v) => (Math.floor(u) % 8 === 4 ? 0.5 : null) } });
    cushion(r, 3, 6, 13, 28, 20, 6, c, { round: 3, tuft: 7 });
    cushion(r, 33, 6, 13, 28, 20, 6, c, { round: 3, tuft: 7 });
  },
});

add({
  id: 'espelho', name: 'Espelho de Chão', cat: 'quarto', size: [1, 1], h: 92,
  desc: 'Espelho alto com moldura dourada trabalhada.',
  variants: [C.gold, C.walnut, C.white, C.black],
  draw(r, o) {
    r.box(4, 18, 0, 3, 8, 4, o.color); r.box(25, 18, 0, 3, 8, 4, o.color);
    r.box(4, 20, 4, 24, 4, 84, o.color, {
      tex: {
        left: (u, v) => {
          const U = Math.floor(u), V = Math.floor(v);
          if (U < 2 || U > 21 || V < 2 || V > 81) return (U + V) % 3 === 0 ? -0.6 : null;
          if (U === 2 || U === 21 || V === 2 || V === 81) return 0.6;
          const d = u - (v - 2) * 0.35;
          return { raw: d > -6 && d < -2 ? '#eef8fc' : d > 1 && d < 2.5 ? '#e2f1f7' : v > 50 ? '#c3dbe6' : '#acc9d6' };
        },
      },
    });
  },
});

add({
  id: 'cavalete', name: 'Cavalete de Pintura', cat: 'quarto', size: [1, 1], h: 80,
  desc: 'Cavalete com uma tela em andamento.',
  variants: ['#c49a6c', C.walnut],
  draw(r, o) {
    const w = o.color;
    r.sdf([
      { ...S.capsule(6, 22, 0, 13, 14, 76, 1.1), mat: w }, { ...S.capsule(26, 22, 0, 19, 14, 76, 1.1), mat: w },
      { ...S.capsule(16, 2, 0, 16, 12, 70, 1), mat: w }, { ...S.capsule(7, 20, 30, 25, 20, 30, 1.2), mat: w },
    ]);
    r.box(5, 18, 30, 22, 4, 2, w);
    r.box(6, 16, 32, 20, 2, 32, '#f4f2ee', {
      tex: {
        left: (u, v) => {
          if (u < 1 || u > 18.5 || v < 1 || v > 30.5) return ['#e0d6c4', 0];
          if (v < 10 + Math.sin(u * 0.5) * 2) return ['#7cc46a', 0];
          if (Math.hypot(u - 13, v - 22) < 3.5) return ['#f7d65a', 0];
          if (v < 16) return ['#5a9ee0', 0];
          return ['#bfe3f7', 0];
        },
      },
    });
  },
});

add({
  id: 'bau', name: 'Baú do Tesouro', cat: 'quarto', size: [1, 1], h: 30, states: ['Fechado', 'Aberto'],
  desc: 'Guarda segredos (e moedas). Duplo clique para abrir.',
  variants: [C.teak, C.mahogany, '#5f7394'],
  draw(r, o) {
    const c = o.color, g = grain('u', 2);
    const band = (u, v) => { const U = Math.floor(u); if (U === 4 || U === 5 || U === 22 || U === 23) return C.gold; return null; };
    r.box(3, 7, 0, 26, 19, 15, c, { tex: { left: first(band, (u, v) => (Math.abs(u - 13.5) < 2 && v > 8 && v < 13 && !o.state ? C.gold : null), g), right: first((u) => (Math.floor(u) === 3 || Math.floor(u) === 15 ? C.gold : null), g), top: o.state ? (u, v) => (u > 1.5 && u < 24.5 && v > 1.5 && v < 17.5 ? { raw: hash(Math.floor(u), Math.floor(v)) > 0.75 ? '#fff6b0' : '#e8b34b' } : null) : null } });
    if (!o.state) r.sdf([{ ...S.intersect(S.capsule(3, 16.5, 15, 29, 16.5, 15, 9.5), { f: (x, y, z) => 15 - z, bb: [3, 7, 15, 29, 26, 25] }), mat: (x) => (Math.abs(x - 4.5) < 1 || Math.abs(x - 22.5) < 1 ? C.gold : [c, 0]) }]);
    else r.sdf([{ ...S.intersect(S.capsule(3, 3, 22, 29, 3, 22, 9.5), { f: (x, y, z) => y - 7, bb: [3, -7, 13, 29, 7, 32] }), mat: (x) => (Math.abs(x - 4.5) < 1 || Math.abs(x - 22.5) < 1 ? C.gold : [c, 0.3]) }]);
  },
});

add({
  id: 'cabideiro', name: 'Cabideiro', cat: 'quarto', size: [1, 1], h: 96, rots: 2,
  desc: 'Cabideiro de madeira com chapéu, bolsa e cachecol.',
  variants: [C.walnut, C.oak, C.black],
  draw(r, o) {
    const w = o.color;
    r.sdf([{ ...S.capsule(16, 16, 2, 16, 16, 88, 1.4), mat: w }, { ...S.capsule(16, 16, 3, 6, 10, 0, 1.1), mat: w }, { ...S.capsule(16, 16, 3, 26, 12, 0, 1.1), mat: w }, { ...S.capsule(16, 16, 3, 14, 26, 0, 1.1), mat: w }]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; r.sdf([{ ...S.capsule(16, 16, 82, 16 + Math.cos(a) * 6, 16 + Math.sin(a) * 6, 88, 0.8), mat: w }]); }
    r.sdf([{ ...S.cyl(21, 18, 84, 85.4, 7, 0.6), mat: '#c9a35a' }, { ...S.cyl(21, 18, 85, 91, 4.2, 2), mat: (x, y, z) => (z < 86.6 ? '#2e2b33' : '#c9a35a') }]);
    r.sdf([{ ...S.cbox(7, 17, 52, 7, 4, 10, 2), mat: '#b5574b' }, { ...S.capsule(10.5, 19, 62, 14, 17, 80, 0.5), mat: '#7a3f2e' }]);
    r.sdf([{ ...S.capsule(19, 13, 80, 22, 12, 58, 2.2), mat: (x, y, z) => ['#5f7394', Math.floor(z / 3) % 2 ? 0.3 : 0] }]);
  },
});

export const quarto = 1;
