// Cozinha e sala de jantar
import { add, C, S, FABRICS, WOODS, grain, panel, marble, first, legs, turnedLeg, cushion, pillow, foliage, pot, shadeHex, mix, hash } from './furni_base.js';

add({
  id: 'mesa_jantar', name: 'Mesa de Jantar', cat: 'cozinha', size: [3, 2], h: 36, top: 33, stack: true, rots: 2,
  desc: 'Mesa grande de madeira maciça para reunir todo mundo.',
  variants: [C.walnut, C.oak, C.white, C.black],
  draw(r, o) {
    const c = o.color, g = grain('u', 3);
    for (const [x, y] of [[6, 6], [86, 6], [6, 54], [86, 54]]) {
      r.lathe(x + 2, y + 2, 0, Array.from({ length: 28 }, (_, i) => 2.4 - i * 0.03), shadeHex(c, 0.25));
    }
    r.box(6, 6, 24, 84, 52, 6, shadeHex(c, 0.3), { tex: { left: g, right: g } });
    r.box(1, 1, 30, 94, 62, 3, c, { tex: { top: (u, v) => (Math.floor(v) % 15 === 0 ? 0.55 : g(u, v)), left: g, right: g } });
  },
});

add({
  id: 'mesa_redonda', name: 'Mesa Redonda', cat: 'cozinha', size: [2, 2], h: 36, top: 33, stack: true, rots: 1,
  desc: 'Mesa redonda com pé central. Charmosa para o café da tarde.',
  variants: [C.walnut, C.marble, C.white, C.oak],
  draw(r, o) {
    r.lathe(32, 32, 0, [12, 12, 11, 8, 5], shadeHex(C.walnut, 0.2), { shiny: true });
    r.lathe(32, 32, 5, Array.from({ length: 24 }, (_, i) => 3.4 + Math.sin(i / 4) * 0.6), C.walnut, { shiny: true });
    r.lathe(32, 32, 29, [24, 26, 26, 26], o.color, {
      topTex: o.color === C.marble ? (nx, ny) => marble(5)(nx * 40, ny * 40) : (nx, ny, d) => (Math.floor(d * 16) % 4 === 0 ? 0.25 : 0),
    });
  },
});

add({
  id: 'cadeira_jantar', name: 'Cadeira Estofada', cat: 'cozinha', size: [1, 1], h: 48, sit: { z: 17 },
  desc: 'Cadeira de jantar com assento e encosto estofados.',
  variants: ['#d6d9df', '#5f7394', '#e8b4b8', '#a3b5a0', '#d9a23b', '#7a3f2e'],
  draw(r, o) {
    const c = o.color, w = C.walnut;
    for (const [x, y] of [[7, 9], [23, 9], [7, 25], [23, 25]]) r.box(x, y, 0, 2.5, 2.5, 14, w);
    r.box(6, 7, 13, 21, 21, 3, w);
    cushion(r, 6, 8, 15, 21, 20, 4, c, { round: 2, piping: true });
    r.box(7, 6, 14, 2.5, 2.5, 34, w); r.box(23.5, 6, 14, 2.5, 2.5, 34, w);
    cushion(r, 8, 5.5, 22, 17, 4, 24, c, { round: 2.2, tuft: 6 });
  },
});

add({
  id: 'cadeira_madeira', name: 'Cadeira Windsor', cat: 'cozinha', size: [1, 1], h: 46, sit: { z: 16 },
  desc: 'Cadeira rústica de madeira com encosto de varetas.',
  variants: [C.oak, C.walnut, C.white, '#6f8a7a', '#b5574b'],
  draw(r, o) {
    const w = o.color;
    r.sdf([[8, 22], [24, 22], [9, 9], [23, 9]].map(([x, y]) => ({ ...S.capsule(x, y, 0, x + (x < 16 ? 1 : -1), y + (y < 16 ? 1 : -1), 14, 1.3), mat: w })));
    r.lathe(16, 16, 13, [11, 11, 11.5], w, { topTex: (nx, ny, d) => (d > 0.85 ? 0.3 : (Math.floor(d * 10) % 3 === 0 ? 0.15 : 0)) });
    const back = [];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.15 + i * 0.175);
      back.push({ ...S.capsule(16 - Math.cos(a) * 9, 16 - Math.sin(a) * 9, 16, 16 - Math.cos(a) * 9.5, 16 - Math.sin(a) * 9.5, 42, 0.8), mat: w });
    }
    for (let k = 0; k < 6; k++) {
      const a0 = Math.PI * (0.1 + k * 0.133), a1 = Math.PI * (0.1 + (k + 1) * 0.133);
      back.push({ ...S.capsule(16 - Math.cos(a0) * 9.6, 16 - Math.sin(a0) * 9.6, 42, 16 - Math.cos(a1) * 9.6, 16 - Math.sin(a1) * 9.6, 42, 1.6), mat: w });
    }
    r.sdf(back);
  },
});

add({
  id: 'banqueta_alta', name: 'Banqueta Alta', cat: 'cozinha', size: [1, 1], h: 36, sit: { z: 31 }, rots: 1,
  desc: 'Banqueta de bar para a bancada ou ilha.',
  variants: ['#2e2b33', '#c49a6c', '#5f7394', '#b5574b'],
  draw(r, o) {
    const m = C.chrome;
    r.sdf([[8, 8], [24, 8], [8, 24], [24, 24]].map(([x, y]) => ({ ...S.capsule(x, y, 0, 16 + (x - 16) * 0.5, 16 + (y - 16) * 0.5, 30, 1), mat: m })));
    r.sdf([{ ...S.torus(16, 16, 10, 7, 0.8), mat: m }]);
    r.sdf([{ ...S.cyl(16, 16, 29, 34, 9, 2.2), mat: o.color }]);
  },
});

const counterTex = (c, extra) => {
  const g = grain('v', 4);
  return first(extra, (u, v) => (Math.floor(u) === 24 && v > 18 && v < 26 ? C.chrome : null), (u, v) => panel(u, v, 3, 3, 28, 28), g);
};

add({
  id: 'balcao', name: 'Balcão de Cozinha', cat: 'cozinha', size: [1, 1], h: 38, top: 35, stack: true,
  desc: 'Armário com tampo de mármore. Junte vários lado a lado.',
  variants: [C.white, C.walnut, '#6f8a7a', '#5f7394', '#2e2b33'],
  draw(r, o) {
    const c = o.color;
    r.box(1, 3, 0, 30, 26, 3, C.black);
    r.box(0, 2, 3, 32, 26, 29, c, { tex: { left: counterTex(c), right: grain('v', 2) } });
    r.box(0, 1, 32, 32, 30, 3, C.marble, { tex: { top: marble(2), left: marble(5), right: marble(6) } });
  },
});

add({
  id: 'pia_cozinha', name: 'Pia de Cozinha', cat: 'cozinha', size: [1, 1], h: 52, top: 35,
  desc: 'Balcão com cuba de inox e torneira gourmet.',
  variants: [C.white, C.walnut, '#6f8a7a', '#5f7394', '#2e2b33'],
  draw(r, o) {
    const c = o.color;
    r.box(1, 3, 0, 30, 26, 3, C.black);
    r.box(0, 2, 3, 32, 26, 29, c, { tex: { left: counterTex(c), right: grain('v', 2) } });
    r.box(0, 1, 32, 32, 30, 3, C.marble, {
      tex: {
        top: (u, v) => {
          if (u > 5 && u < 27 && v > 8 && v < 26) { const e = Math.min(u - 5, 27 - u, v - 8, 26 - v); return e < 1 ? ['#9aa3ad', 0] : ['#c9d3de', e < 2.5 ? 0.9 : 0.4]; }
          return marble(2)(u, v);
        }, left: marble(5), right: marble(6),
      },
    });
    r.sdf([{ ...S.capsule(16, 5, 35, 16, 5, 50, 1.2), mat: C.chrome }, { ...S.capsule(16, 5, 50, 16, 12, 50, 1.1), mat: C.chrome }, { ...S.capsule(16, 12, 50, 16, 13, 46, 1), mat: C.chrome }]);
  },
});

add({
  id: 'fogao', name: 'Fogão', cat: 'cozinha', size: [1, 1], h: 46, states: ['Desligado', 'Aceso'], top: 34, stack: true,
  desc: 'Fogão de quatro bocas com forno. Duplo clique para acender.',
  variants: ['#d6d9df', '#2e2b33', '#b5574b', '#9fd0c8'],
  light: (o) => (o.state ? { x: 16, y: 20, z: 36, color: '#ff8a3a', r: 70, flicker: true } : null),
  draw(r, o) {
    const c = o.color;
    r.box(0, 2, 0, 32, 28, 33, c, {
      tex: {
        left: (u, v) => {
          if (Math.floor(v) === 28 && Math.floor(u) % 6 === 3) return C.black;
          if (u > 3 && u < 29 && v > 4 && v < 24) {
            if (u < 4.5 || u > 27.5 || v < 5.5 || v > 22.5) return C.black;
            if (Math.floor(v) === 21 && u > 8 && u < 24) return C.chrome;
            return o.state ? { raw: v < 11 ? '#f2603a' : '#7a2a1e' } : ['#2a2a30', (u - v) > 2 && (u - v) < 5 ? -1 : 0];
          }
          return null;
        },
      },
    });
    r.box(0, 1, 33, 32, 30, 1.5, C.charcoal, {
      tex: {
        top: (u, v) => {
          for (const [cx, cy] of [[9, 9], [23, 9], [9, 22], [23, 22]]) {
            const d = Math.hypot(u - cx, v - cy);
            if (d < 5) return o.state && d > 2 && d < 4 ? { raw: hash(Math.floor(u), Math.floor(v)) > 0.5 ? '#6ab0ff' : '#3a7aff' } : d < 1.5 ? C.black : d > 3.6 ? C.chrome : ['#2a2a30', 0];
          }
          return null;
        },
      },
    });
  },
});

add({
  id: 'geladeira', name: 'Geladeira Retrô', cat: 'cozinha', size: [1, 1], h: 82, states: ['Fechada', 'Aberta'],
  dispenser: ['refri', 'suco', 'agua'],
  desc: 'Geladeira anos 50. Use para pegar uma bebida gelada!',
  variants: ['#9fd8c8', '#f2efe9', '#e8b4b8', '#ffd98a', '#e2574c'],
  light: (o) => (o.state ? { x: 16, y: 36, z: 40, color: '#fff3c4', r: 80 } : null),
  draw(r, o) {
    const c = o.color, open = o.state === 1;
    const food = ['#e2574c', '#ffd35a', '#6fe08a', '#f4f2ee', '#f08a3a', '#c8b0f0'];
    const body = S.cbox(2, 2, 2, 28, 26, 76, 5);
    r.sdf([{
      ...body, mat: (x, y, z, nx, ny) => {
        if (open && ny > 0.8 && x > 5 && x < 27 && z > 6 && z < 74) {
          if (Math.abs(z - 52) < 1) return ['#9aa3ad', 0];
          const sh = Math.floor((z - 6) / 12);
          if ((z - 6) % 12 < 1) return { raw: '#d8e2ea' };
          const slot = Math.floor((x - 5) / 4) + sh * 7;
          if ((z - 6) % 12 > 2 && (z - 6) % 12 < 9 && hash(slot, 3) > 0.35) return { raw: food[slot % food.length] };
          return { raw: '#fff8e2' };
        }
        if (!open && ny > 0.8 && Math.abs(z - 52) < 0.7) return [c, 0.8];
        if (!open && ny > 0.8 && x > 23 && x < 25.5 && ((z > 56 && z < 66) || (z > 32 && z < 46))) return C.chrome;
        if (z < 4) return C.chrome;
        return c;
      },
    }]);
    if (open) r.sdf([{ ...S.cbox(28, 28, 3, 4, 24, 74, 2), mat: (x, y, z) => (x < 29 && z > 6 && z < 74 && Math.floor(z) % 12 === 0 ? ['#d8e2ea', 0] : c) }]);
  },
});

add({
  id: 'maquina_cafe', name: 'Máquina de Café', cat: 'cozinha', size: [1, 1], h: 30, small: true, frames: 3, fps: 4, states: ['Pronta', 'Passando café'],
  dispenser: ['cafe'],
  desc: 'Espresso na hora! Use para pegar uma xícara de café.',
  variants: ['#b5574b', '#2e2b33', '#d6d9df', '#9fd8c8'],
  draw(r, o) {
    const c = o.color;
    r.sdf([{ ...S.cbox(8, 6, 0, 16, 16, 24, 3), mat: (x, y, z, nx, ny) => (ny > 0.7 && z > 6 && z < 16 && x > 11 && x < 21 ? ['#2a2a30', 0] : z > 20 ? [c, -0.3] : c) }]);
    r.sdf([{ ...S.cbox(10, 18, 4, 12, 6, 2, 1), mat: C.chrome }, { ...S.cyl(16, 20, 6, 11, 2.4, 0.4), mat: C.white }]);
    r.sdf([{ ...S.capsule(12, 22, 18, 12, 24, 14, 0.8), mat: C.chrome }]);
    if (o.state) r.pts([[16, 20, 12 + o.frame, '*#6a3f26'], [16, 21, 14 + o.frame * 2, '*#ffffff'], [17, 20, 17 + o.frame * 2, '*#e8e8f0']]);
  },
});

add({
  id: 'ilha_cozinha', name: 'Ilha de Cozinha', cat: 'cozinha', size: [2, 1], h: 38, top: 35, stack: true,
  desc: 'Ilha com tampo de mármore e prateleira aberta.',
  variants: [C.walnut, C.white, '#5f7394', '#6f8a7a'],
  draw(r, o) {
    const c = o.color, g = grain('u', 5);
    r.box(1, 3, 0, 62, 26, 3, C.black);
    r.box(0, 2, 3, 64, 28, 29, c, { tex: { left: first((u, v) => (u > 33 && u < 61 && v > 3 && v < 26 ? ['#4a3a30', (Math.floor(v) === 14 ? -0.6 : 0.4)] : null), (u, v) => panel(u, v, 3, 3, 30, 26), g), right: g } });
    r.box(-1, 1, 32, 66, 30, 3, C.marble, { tex: { top: marble(8), left: marble(3), right: marble(4) } });
  },
});

export const cozinha = 1;
