// Construção: portas, divisórias, pisos e estruturas
import { add, C, S, grain, panel, marble, first, legs, foliage, shadeHex, mix, hash } from './furni_base.js';
import { WALL_H } from './config.js';

add({
  id: 'porta', name: 'Porta de Madeira', cat: 'construcao', size: [1, 1], h: 96, states: ['Fechada', 'Aberta'], walk: (s) => s === 1,
  desc: 'Porta de verdade: fechada bloqueia a passagem. Duplo clique abre!',
  variants: [C.walnut, C.white, C.oak, '#4a7a6a', '#d96c7a'],
  draw(r, o) {
    const fr = shadeHex(o.color, 0.5);
    r.box(0, 12, 0, 3, 8, 90, fr); r.box(29, 12, 0, 3, 8, 90, fr); r.box(0, 12, 88, 32, 8, 6, fr);
    const pan = (u, v) => panel(u, v, 3, 8, 22, 40) ?? panel(u, v, 3, 46, 22, 80) ?? (Math.floor(u) >= 22 && Math.floor(u) <= 23 && Math.abs(v - 44) < 2 ? C.brass : grain('v', 2)(u, v));
    if (!o.state) r.box(3, 14, 0, 26, 3, 88, o.color, { tex: { left: pan } });
    else r.box(3, 17, 0, 3, 26, 88, o.color, { tex: { right: (u, v) => pan(25 - u, v) } });
  },
});

add({
  id: 'porta_dupla', name: 'Porta Dupla Clássica', cat: 'construcao', size: [2, 1], h: 108, states: ['Fechada', 'Aberta'], walk: (s) => s === 1,
  desc: 'Porta de duas folhas branca com almofadas, elegante como nas mansões.',
  variants: [C.white, '#e8e2d8', '#2e2b33', '#5f7394'],
  draw(r, o) {
    const c = o.color, fr = mix(c, '#ffffff', 0.4);
    r.box(0, 10, 0, 4, 12, 104, fr); r.box(60, 10, 0, 4, 12, 104, fr); r.box(0, 10, 100, 64, 12, 8, fr, { tex: { left: (u, v) => (Math.floor(v) === 3 ? 0.4 : null) } });
    const pan = (u, v) => panel(u, v, 3, 6, 23, 44) ?? panel(u, v, 3, 52, 23, 92) ?? null;
    if (!o.state) {
      r.box(4, 14, 0, 28, 3, 100, c, { tex: { left: first(pan, (u, v) => (Math.floor(u) >= 25 && Math.abs(v - 48) < 3 ? C.gold : null)) } });
      r.box(32, 14, 0, 28, 3, 100, c, { tex: { left: first((u, v) => pan(u - 1, v), (u, v) => (Math.floor(u) <= 2 && Math.abs(v - 48) < 3 ? C.gold : null)) } });
    } else {
      r.box(4, 17, 0, 3, 28, 100, c, { tex: { right: (u, v) => pan(27 - u, v) } });
      r.box(57, 17, 0, 3, 28, 100, c, { tex: { right: (u, v) => pan(u, v) } });
    }
  },
});

const partition = (texFn) => (r, o) => {
  const t = (u, v) => (v < 6 ? ['#e8e2d8', Math.floor(v) === 5 ? -0.6 : 0.2] : texFn(u, v, o));
  r.box(0, 12, 0, 32, 8, WALL_H, o.color, { tex: { left: t, right: t, back: t } });
  r.box(0, 11, WALL_H, 32, 10, 3, mix(o.color, '#ffffff', 0.4));
};

add({
  id: 'divisoria', name: 'Parede Divisória', cat: 'construcao', size: [1, 1], h: WALL_H + 4, rots: 2,
  desc: 'Parede da altura do quarto para criar cômodos. Combine várias!',
  variants: ['#f1e4c6', '#e8e2d8', '#c9dbe8', '#d6e3c4', '#e8c2c8', '#5c6a7a', '#3a3a40'],
  draw: partition(() => null),
});

add({
  id: 'divisoria_ripada', name: 'Divisória Ripada', cat: 'construcao', size: [1, 1], h: WALL_H + 4, rots: 2,
  desc: 'Divisória de ripas de madeira escura.',
  variants: [C.walnut, C.oak, C.black],
  draw: partition((u, v, o) => (Math.floor(u) % 5 === 0 ? 0.8 : Math.floor(u) % 5 === 1 ? -0.3 : grain('v', Math.floor(u / 5))(u, v))),
});

add({
  id: 'divisoria_marmore', name: 'Divisória de Mármore', cat: 'construcao', size: [1, 1], h: WALL_H + 4, rots: 2,
  desc: 'Revestimento de mármore com veios. Perfeito para banheiros.',
  variants: [C.marble, '#e8dce8', '#3a3a40'],
  draw: partition((u, v) => (Math.floor(v) % 30 === 0 || Math.floor(u) % 32 === 0 ? 0.4 : marble(7)(u, v))),
});

add({
  id: 'divisoria_vidro', name: 'Divisória de Vidro', cat: 'construcao', size: [1, 1], h: WALL_H + 4, rots: 2,
  desc: 'Vidro com caixilho preto, deixa a luz passar.',
  variants: ['#2e2b33', C.gold, C.white],
  draw(r, o) {
    r.box(0, 14, 0, 32, 4, 3, o.color); r.box(0, 14, WALL_H - 3, 32, 4, 3, o.color);
    r.box(0, 14, 0, 2, 4, WALL_H, o.color); r.box(30, 14, 0, 2, 4, WALL_H, o.color);
    r.box(0, 14, 60, 32, 4, 2, o.color);
    r.box(2, 15, 3, 28, 2, WALL_H - 6, C.glass, { alpha: 0.28, tex: { left: (u, v) => (Math.abs(u - v * 0.4 - 4) < 1.6 ? { raw: '#ffffff' } : null) } });
  },
});

add({
  id: 'meia_parede', name: 'Mureta', cat: 'construcao', size: [1, 1], h: 42, top: 40, stack: true, rots: 2,
  desc: 'Meia parede para separar ambientes sem fechar. Empilhável.',
  variants: ['#f1e4c6', '#b25a42', C.marble, '#5c6a7a'],
  draw(r, o) {
    const brick = o.color === '#b25a42';
    const t = (u, v) => {
      if (!brick) return v < 5 ? 0.3 : null;
      const row = Math.floor(v / 6), U = Math.floor(u + (row % 2) * 5);
      if (Math.floor(v) % 6 === 5 || U % 10 === 0) return ['#e3d8c4', 0.2];
      return (hash(Math.floor(U / 10), row, 4) - 0.5) * 0.6;
    };
    r.box(0, 11, 0, 32, 10, 38, o.color, { tex: { left: t, right: t, back: t } });
    r.box(-1, 10, 38, 34, 12, 3, C.marble, { tex: { top: marble(2) } });
  },
});

add({
  id: 'coluna', name: 'Coluna Clássica', cat: 'construcao', size: [1, 1], h: WALL_H + 4, rots: 1,
  desc: 'Coluna de pedra com base e capitel.',
  variants: [C.marble, '#e8e2d8', '#3a3a40'],
  draw(r, o) {
    r.box(3, 3, 0, 26, 26, 8, o.color, { tex: { top: marble(1), left: marble(2), right: marble(3) } });
    r.lathe(16, 16, 8, new Array(WALL_H - 18).fill(9), o.color, { sideTex: (nx, i, dsx) => (Math.floor((dsx + 1) * 10) % 2 ? 0.35 : 0) });
    r.box(3, 3, WALL_H - 10, 26, 26, 10, o.color, { tex: { left: (u, v) => (Math.floor(v) === 4 ? 0.5 : marble(4)(u, v)) } });
  },
});

add({
  id: 'cerca', name: 'Cerca Branca', cat: 'construcao', size: [1, 1], h: 40, rots: 2,
  desc: 'Cerquinha de madeira para o jardim.',
  variants: [C.white, C.oak, '#7fa0b8'],
  draw(r, o) {
    for (let x = 2; x < 32; x += 7.5) {
      r.box(x, 14, 0, 4, 3, 32, o.color);
      r.sdf([{ ...S.cone(x + 2, 15.5, 32, 38, 2.4, 0.4), mat: o.color }]);
    }
    r.box(0, 17, 10, 32, 2, 4, o.color); r.box(0, 17, 24, 32, 2, 4, o.color);
  },
});

add({
  id: 'cerca_viva', name: 'Cerca Viva', cat: 'construcao', size: [1, 1], h: 46, rots: 2,
  desc: 'Arbusto podado em bloco. Forma muros verdes.',
  variants: ['#5d9b4c', '#4a7a3a'],
  draw(r, o) {
    const c = o.color;
    r.sdf([{ ...S.bumpy(S.cbox(1, 3, 0, 30, 26, 44, 5), 1.4, (x, y, z) => S.noise3(x * 0.4, y * 0.4, z * 0.4) - 0.5), mat: (x, y, z) => [hash(Math.floor(x), Math.floor(y + z)) > 0.6 ? mix(c, '#ffffff', 0.2) : c, (S.noise3(x * 0.6, y * 0.6, z * 0.6) - 0.5) * 1.4] }]);
  },
});

// ------------------------------------------------------------------ pisos
const tile = (name, desc, variants, tex) => ({
  name, cat: 'construcao', size: [1, 1], h: 2, walk: true, flat: true, floorTile: true, rots: 1, desc, variants,
  draw(r, o) { r.box(0, 0, 0, 32, 32, 1, o.color, { tex: { top: (u, v) => tex(u, v, o) } }); },
});

add({ id: 'piso_marmore', ...tile('Piso de Mármore', 'Porcelanato marmorizado em placas.', [C.marble, '#e8dce8', '#3a3a40', '#d8cfc0'], (u, v) => (Math.floor(u) === 0 || Math.floor(v) === 0 ? 0.35 : marble(3)(u, v))) });
add({ id: 'piso_madeira', ...tile('Piso de Madeira', 'Tábuas largas de madeira escura.', [C.walnut, C.oak, '#5a3b2b', '#d8bf98'], (u, v) => (Math.floor(v) % 8 === 0 || (Math.floor(u + (Math.floor(v / 8) % 2) * 16) % 32 === 0) ? 0.55 : grain('u', Math.floor(v / 8))(u, v))) });
add({ id: 'piso_grama', ...tile('Grama', 'Gramado verdinho para jardins.', ['#6fae4a', '#5d9b4c', '#86b85a'], (u, v) => { const h = hash(Math.floor(u), Math.floor(v)); return h > 0.86 ? 0.5 : h < 0.12 ? -0.5 : h > 0.97 ? '#f7d65a' : 0; }) });
add({ id: 'piso_pedra', ...tile('Piso de Pedra', 'Pedras ardósia para áreas externas.', ['#6a6670', '#a59c8f', '#4a4850'], (u, v) => { const row = Math.floor(v / 11), uu = u + (row % 2) * 7; if (Math.floor(v) % 11 === 0 || Math.floor(uu) % 15 === 0) return 0.9; return (hash(Math.floor(uu / 15), row, 5) - 0.5) * 0.6; }) });
add({ id: 'piso_deck', ...tile('Deck de Madeira', 'Deck de madeira para a beira da piscina.', ['#a8805a', '#c49a6c', '#7a5a42'], (u, v) => (Math.floor(u) % 6 === 0 ? 0.6 : grain('v', Math.floor(u / 6))(u, v))) });
add({ id: 'piso_hidraulico', ...tile('Ladrilho Hidráulico', 'Ladrilho estampado, charme de cozinha antiga.', ['#3a4a6b', '#4a7a6a', '#b5574b'], (u, v, o) => {
  const lu = u % 16, lv = v % 16, d = Math.abs(lu - 8) + Math.abs(lv - 8);
  if (Math.floor(lu) === 0 || Math.floor(lv) === 0) return ['#d8d4cc', 0];
  if (d < 3 || (d > 6 && d < 8)) return [o.color, 0];
  if (Math.hypot(lu - 8, lv - 8) > 9.5) return [mix(o.color, '#ffffff', 0.5), 0];
  return ['#f4f2ee', 0];
}) });

export const construcao = 1;
