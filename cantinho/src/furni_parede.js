// Mobis de parede. Coordenadas locais: x ao longo da parede, y saindo dela,
// z para cima a partir da base do item. size = [largura, altura].
import { add, C, S, grain, panel, marble, first, cushion, foliage, fronds, pot, shadeHex, mix, hash } from './furni_base.js';

export function skyColor(env, u, v, w, h, frame = 0) {
  const t = v / h;
  const band = Math.floor(t * 6 + (hash(Math.floor(u), Math.floor(v)) < 0.25 ? 0.5 : 0));
  if (env === 'night') {
    const s = hash(Math.floor(u), Math.floor(v), 7);
    if (s > 0.975) return (frame + Math.floor(s * 100)) % 7 === 0 ? '#9fa8ff' : '#fff6c8';
    const mx = u - w * 0.7, my = v - h * 0.74;
    if (mx * mx + my * my < 26) return mx + my > 2.5 ? '#c9c1a0' : '#fff3c4';
    return ['#2b2f6b', '#262a60', '#20244f', '#1b1f45', '#171a3b', '#141632', '#121428'][Math.min(6, band)];
  }
  if (env === 'dusk') {
    const sx = u - w * 0.3, sy = v - h * 0.22;
    if (sx * sx + sy * sy < 30) return '#fff0a8';
    return ['#ffd27a', '#ffb06a', '#f08a6a', '#c96a86', '#8a5c9e', '#5c4c8f', '#4a3f80'][Math.min(6, band)];
  }
  const cl = (cx, cy, rx) => { const dx = (u - cx) / rx, dy = (v - cy) / (rx * 0.42); return dx * dx + dy * dy < 1; };
  if (v < h * 0.16 + Math.sin(u * 0.3) * 2) return u % 7 < 3 ? '#7cc46a' : '#5fa64a';
  if (cl(w * 0.3, h * 0.66, 10) || cl(w * 0.42, h * 0.72, 7) || cl(w * 0.78, h * 0.42, 8)) return v > h * 0.68 || (v > h * 0.4 && v < h * 0.46) ? '#ffffff' : '#e6f3ff';
  return ['#d5f0ff', '#c2e7ff', '#addcff', '#9ad1ff', '#88c5fb', '#78b8f4', '#6aaeee'][Math.min(6, band)];
}

add({
  id: 'janela', name: 'Janela com Cortinas', cat: 'parede', wall: true, size: [60, 72], states: ['Cortinas abertas', 'Cortinas fechadas'],
  desc: 'Janela de madeira branca. O céu muda com a hora do dia.',
  variants: ['#e8e2d8', '#5f7394', '#e8b4b8', '#a3b5a0', '#d9a23b'],
  draw(r, o) {
    const fr = '#f4f2ee';
    r.box(6, 0, 4, 48, 3, 62, fr, {
      tex: {
        left: (u, v) => {
          if (u < 3 || u > 45 || v < 3 || v > 59) return null;
          if (Math.abs(u - 24) < 1.5 || Math.abs(v - 31) < 1.2) return null;
          if (Math.abs(u - 24) < 2.5 || Math.abs(v - 31) < 2.2) return 0.4;
          return { raw: skyColor(o.env, u - 3, v - 3, 42, 56, o.frame) };
        },
      },
    });
    r.box(3, 0, 0, 54, 7, 4, fr, { tex: { top: () => -0.2 } });
    r.sdf([{ ...S.capsule(-2, 5, 70, 62, 5, 70, 1.2), mat: C.brass }, { ...S.sphere(-3, 5, 70, 2), mat: C.brass }, { ...S.sphere(63, 5, 70, 2), mat: C.brass }]);
    const curtain = (x0, w, closed) => {
      const prims = [];
      const folds = Math.max(2, Math.round(w / 4));
      for (let i = 0; i < folds; i++) {
        const x = x0 + (i + 0.5) * (w / folds);
        const sway = closed ? 0 : (x0 < 30 ? 1 : -1) * 1.5;
        prims.push({ ...S.capsule(x, 6, 69, x + sway, 7, closed ? 2 : 6, w / folds * 0.62), mat: (a, b, z) => [o.color, z > 63 ? -0.3 : 0] });
      }
      r.sdf(prims, { blend: 1 });
      if (!closed) r.sdf([{ ...S.torus(x0 + w / 2, 6.5, 30, w / 2 + 0.5, 1), mat: C.brass }]);
    };
    if (o.state) { curtain(-2, 32, true); curtain(30, 32, true); }
    else { curtain(-4, 12, false); curtain(52, 12, false); }
  },
});

add({
  id: 'janelao', name: 'Janelão de Vidro', cat: 'parede', wall: true, size: [60, 108], floor: true,
  desc: 'Janela do chão ao teto com caixilhos pretos, estilo loft.',
  variants: ['#2e2b33', '#f4f2ee', '#8a5a3c'],
  draw(r, o) {
    r.box(0, 0, 0, 60, 3, 106, o.color, {
      tex: {
        left: (u, v) => {
          if (u < 2.5 || u > 57.5 || v < 2.5 || v > 103.5) return null;
          if (Math.abs(u - 30) < 1.3 || Math.floor(v) % 26 < 1.6) return null;
          return { raw: skyColor(o.env, u, v, 60, 106, o.frame) };
        },
      },
    });
  },
});

const frameArt = (w, h, art, gap = 3) => (r, o) => {
  r.box(0, 0, 0, w, 2.5, h, o.color, {
    tex: {
      left: (u, v) => {
        const U = Math.floor(u), V = Math.floor(v);
        if (U < gap || U >= w - gap || V < gap || V >= h - gap) return (U + V) % 4 === 0 ? -0.5 : U === 0 || V === h - 1 ? -0.4 : null;
        return art(u - gap, v - gap, w - gap * 2, h - gap * 2, o);
      },
    },
  });
};

add({
  id: 'quadro_paisagem', name: 'Quadro Paisagem', cat: 'parede', wall: true, size: [44, 32],
  desc: 'Pintura de colinas ao pôr do sol.', variants: [C.gold, C.walnut, C.black, C.white],
  draw: frameArt(44, 32, (u, v, w) => {
    const h1 = 7 + Math.sin(u * 0.25) * 3, h2 = 11 + Math.sin(u * 0.16 + 2) * 4;
    if (v < h1) return ['#4f8a43', (Math.floor(u) % 5 === 0) ? 0.3 : 0];
    if (v < h2) return ['#7fbf4a', 0];
    if (Math.hypot(u - w * 0.65, v - 16) < 4.4) return ['#fff0a8', -0.5];
    return [v > 20 ? '#f7a37a' : v > 15 ? '#ffc98a' : '#ffe2a0', 0];
  }),
});

add({
  id: 'quadro_abstrato', name: 'Quadro Abstrato', cat: 'parede', wall: true, size: [32, 44],
  desc: 'Formas orgânicas em tons terrosos. Muito chique.', variants: [C.white, C.gold, C.black],
  draw: frameArt(32, 44, (u, v) => {
    if (Math.hypot(u - 10, v - 26) < 8) return ['#d9a07a', 0];
    if (Math.hypot(u - 18, v - 12) < 6.5) return ['#3a4a6b', 0];
    if (Math.abs(u - v * 0.4 - 6) < 1.2) return ['#2e2b33', 0];
    if (Math.hypot(u - 21, v - 31) < 4) return ['#c8693f', 0];
    return ['#f4efe6', 0];
  }, 3),
});

add({
  id: 'quadro_gato', name: 'Retrato de Gato', cat: 'parede', wall: true, size: [32, 38],
  desc: 'Retrato oficial do gato mais nobre do bairro.', variants: [C.gold, C.walnut, '#d96c7a'],
  draw: frameArt(32, 38, (u, v) => {
    const cx = u - 13, cy = v - 15;
    const head = (cx * cx) / 60 + (cy * cy) / 40 < 1;
    const ear = v > 19 && v < 24 && ((u > 5 && u < 9 && v - 19 < (u - 5) * 1.4) || (u > 17 && u < 21 && v - 19 < (21 - u) * 1.4));
    if ((Math.abs(u - 9.5) < 1 || Math.abs(u - 16.5) < 1) && Math.abs(v - 16) < 1.2) return ['#2b2232', 0];
    if (Math.abs(u - 13) < 1 && Math.abs(v - 12.5) < 0.8) return ['#f08fa8', 0];
    if (head || ear) return ['#f08a3a', (Math.floor(u) + Math.floor(v)) % 4 === 0 ? 0.5 : 0];
    if (v < 4) return ['#7d4c31', 0];
    return ['#3a4a6b', Math.floor(v) % 2 ? 0.15 : 0];
  }),
});

add({
  id: 'fotos', name: 'Quadrinhos de Fotos', cat: 'parede', wall: true, size: [24, 44],
  desc: 'Duas molduras empilhadas com fotos de viagem.', variants: [C.white, C.gold, C.black],
  draw(r, o) {
    const art = (seed) => (u, v) => {
      if (u < 2 || u > 15 || v < 2 || v > 15) return null;
      return [seed ? (v < 6 ? '#5fa64a' : v < 9 ? '#2f7a4a' : '#bfe3f7') : (v < 7 ? '#e8d9b8' : Math.hypot(u - 9, v - 11) < 3 ? '#f7d65a' : '#9fd0f0'), 0];
    };
    r.box(2, 0, 24, 18, 2, 18, o.color, { tex: { left: art(1) } });
    r.box(4, 0, 0, 18, 2, 18, o.color, { tex: { left: art(0) } });
  },
});

add({
  id: 'espelho_redondo', name: 'Espelho Redondo', cat: 'parede', wall: true, size: [36, 36],
  desc: 'Espelho redondo com moldura fina dourada.', variants: [C.gold, C.black, C.walnut],
  draw(r, o) {
    r.box(0, 0, 0, 36, 2, 36, o.color, {
      tex: {
        top: () => ({ skip: true }), right: () => ({ skip: true }),
        left: (u, v) => {
          const d = Math.hypot(u - 18, v - 18);
          if (d > 18) return { skip: true };
          if (d > 16.4) return null;
          const s = u - v * 0.7;
          return { raw: s > -2 && s < 3 ? '#f4fbff' : s > 6 && s < 8 ? '#e4f2f8' : v > 18 ? '#cfe4ee' : '#b8d4e0' };
        },
      },
    });
  },
});

add({
  id: 'arandela', name: 'Arandela Tubo', cat: 'parede', wall: true, size: [10, 30], states: ['Desligada', 'Ligada'],
  desc: 'Luminária de parede em tubo, como nos banheiros chiques.',
  variants: [C.white, C.black, C.gold],
  light: (o) => (o.state ? { x: 5, y: 8, z: 16, color: '#fff0d0', r: 110 } : null),
  draw(r, o) {
    r.box(3, 0, 12, 4, 3, 6, o.color);
    r.sdf([{ ...S.cyl(5, 6, 0, 30, 3.6, 1.5), mat: o.state ? { raw: '#fffbea' } : '#eef0f2', glow: !!o.state }]);
    r.sdf([{ ...S.cyl(5, 6, 0, 2, 3.8, 0.6), mat: o.color }, { ...S.cyl(5, 6, 28, 30, 3.8, 0.6), mat: o.color }]);
  },
});

add({
  id: 'arandela_classica', name: 'Arandela Clássica', cat: 'parede', wall: true, size: [16, 26], states: ['Desligada', 'Ligada'],
  desc: 'Braço dourado com cúpula de tecido.',
  variants: ['#f1e8d6', '#e8b4b8', '#5f7394'],
  light: (o) => (o.state ? { x: 8, y: 12, z: 18, color: '#ffd29a', r: 100 } : null),
  draw(r, o) {
    r.box(5, 0, 2, 6, 2, 10, C.brass);
    r.sdf([{ ...S.capsule(8, 2, 7, 8, 10, 10, 0.9), mat: C.brass }]);
    const prof = []; for (let i = 0; i < 12; i++) prof.push(7.6 - i * 0.25);
    r.lathe(8, 11, 11, prof, o.state ? '#fff0c4' : o.color, { glow: !!o.state });
  },
});

add({
  id: 'prateleira', name: 'Prateleira Decorada', cat: 'parede', wall: true, size: [52, 30],
  desc: 'Prateleira com livros, um vasinho e uma vela.', variants: [C.oak, C.walnut, C.white, C.black],
  draw(r, o) {
    r.box(0, 0, 0, 52, 12, 3, o.color, { tex: { top: grain('u', 1), left: grain('u', 2) } });
    const books = ['#b5574b', '#3a4a6b', '#d9a23b', '#4a9a92', '#e8d9b8'];
    for (let i = 0; i < 5; i++) r.box(4 + i * 3.2, 2, 3, 3, 9, 14 + (i % 3) * 2, books[i], { tex: { top: () => ['#f1e7d0', 0] } });
    r.box(21, 3, 3, 3, 8, 13, '#6b4f7a');
    pot(r, 32, 6, 8, 3.2, 4, C.white, { shiny: true });
    foliage(r, 32, 6, 13, 6, 5, 4, { n: 14, leaf: 2.4, seed: 2 });
    r.lathe(45, 6, 3, [3, 3, 3, 3, 3, 3], '#f1e4c6', { topTex: (nx, ny, d) => (d < 0.3 ? C.black : null) });
  },
});

add({
  id: 'relogio_parede', name: 'Relógio de Parede', cat: 'parede', wall: true, size: [28, 28], clock: true,
  desc: 'Mostra a hora real do seu computador!', variants: [C.black, C.white, C.walnut, '#d94f4f'],
  draw(r, o) {
    const now = o.time || { h: 10, m: 10 };
    const ha = ((now.h % 12) + now.m / 60) / 12 * Math.PI * 2, ma = (now.m / 60) * Math.PI * 2;
    r.box(0, 0, 0, 28, 3, 28, o.color, {
      tex: {
        top: () => ({ skip: true }), right: () => ({ skip: true }),
        left: (u, v) => {
          const dx = u - 14, dy = v - 14, d = Math.hypot(dx, dy);
          if (d > 14) return { skip: true };
          if (d > 12.4) return null;
          for (const [a, len, wd] of [[ha, 6.5, 0.9], [ma, 10, 0.6]]) {
            const px = Math.sin(a), py = Math.cos(a);
            const t = dx * px + dy * py, perp = Math.abs(dx * py - dy * px);
            if (t > -1 && t < len && perp < wd) return ['#1e1820', 0];
          }
          if (d > 10 && Math.abs(Math.sin(Math.atan2(dx, dy) * 6)) < 0.12) return ['#1e1820', 0];
          return ['#fbf6ea', -0.4];
        },
      },
    });
  },
});

add({
  id: 'tv_parede', name: 'TV de Parede', cat: 'parede', wall: true, size: [64, 38], states: ['Desligada', 'Ligada'], frames: 4, fps: 3,
  desc: 'Smart TV fininha presa na parede.', variants: ['#26242b'],
  light: (o) => (o.state ? { x: 32, y: 14, z: 18, color: '#a8d8ff', r: 110 } : null),
  draw(r, o) {
    r.box(0, 0, 0, 64, 3, 38, o.color, {
      tex: {
        left: (u, v) => {
          if (u < 1.5 || u > 62.5 || v < 1.5 || v > 36.5) return null;
          if (!o.state) { const d = u - v * 0.8; return { raw: d > 18 && d < 26 ? '#3c4250' : '#1e2128' }; }
          const f = o.frame, W = 61;
          if (v < 9 + Math.sin(u * 0.2) * 2) return { raw: '#4f9a4a' };
          if (v < 12 + Math.sin(u * 0.12 + 1) * 3) return { raw: '#6fbf5a' };
          if (Math.hypot(u - W * 0.75, v - 27) < 4) return { raw: '#ffe27a' };
          const cx = ((u + f * 4) % 70) - 8;
          if (Math.hypot(u - cx, (v - 26) * 1.7) < 5) return { raw: '#ffffff' };
          return { raw: v > 28 ? '#7cc0f0' : '#a7d8fb' };
        },
      },
    });
  },
});

add({
  id: 'toalheiro_parede', name: 'Toalheiro de Parede', cat: 'parede', wall: true, size: [30, 24],
  desc: 'Barra dourada com toalha felpuda.', variants: ['#f4f2ee', '#a3b5a0', '#e8b4b8', '#5f7394'],
  draw(r, o) {
    r.sdf([{ ...S.capsule(2, 5, 22, 28, 5, 22, 0.9), mat: C.gold }, { ...S.cbox(0, 0, 20, 3, 6, 4, 1), mat: C.gold }, { ...S.cbox(27, 0, 20, 3, 6, 4, 1), mat: C.gold }]);
    r.sdf([{ ...S.cbox(6, 4, 0, 18, 4, 23, 1.6), mat: (x, y, z) => [o.color, Math.floor(z) === 4 || Math.floor(z) === 6 ? 0.4 : 0] }]);
  },
});

add({
  id: 'interruptor', name: 'Interruptor', cat: 'parede', wall: true, size: [8, 12], switch: true, states: ['Luzes apagadas', 'Luzes acesas'],
  desc: 'Liga e desliga todas as luzes do quarto de uma vez!', variants: [C.white, C.black, C.gold],
  draw(r, o) {
    r.box(0, 0, 0, 8, 1.5, 12, o.color);
    r.box(3, 1, o.state ? 6 : 4, 2, 1.5, 3, mix(o.color, '#888888', 0.3));
  },
});

add({
  id: 'jardim_vertical', name: 'Jardim Vertical', cat: 'parede', wall: true, size: [60, 104],
  desc: 'Parede verde com folhagens atrás de ripas de madeira escura.', variants: ['#2e2b33', C.walnut, C.white],
  draw(r, o) {
    r.box(0, 0, 0, 60, 2, 104, '#2f4a3a');
    const prims = [];
    for (let i = 0; i < 70; i++) {
      const x = 3 + hash(i, 1) * 54, z = 4 + hash(i, 2) * 96;
      prims.push({ ...S.ellipsoid(x, 3, z, 3.4, 2, 2.4), mat: [C.leafL, C.leaf, '#4f8a43', C.leafD, '#c94f4f'][i % 13 === 0 ? 4 : Math.floor(hash(i, 3) * 4)] });
    }
    r.sdf(prims, { blend: 1 });
    for (let x = 0; x < 60; x += 6) r.box(x, 4, 0, 2, 3, 104, o.color);
    r.box(-1, 0, 0, 62, 7, 3, o.color); r.box(-1, 0, 101, 62, 7, 3, o.color);
  },
});

add({
  id: 'painel_ripado', name: 'Painel Ripado', cat: 'parede', wall: true, size: [60, 110],
  desc: 'Revestimento de ripas de madeira para aquecer a parede.', variants: [C.walnut, C.oak, C.black, C.white],
  draw(r, o) {
    r.box(0, 0, 0, 60, 1.5, 110, shadeHex(o.color, 1.4));
    for (let x = 1; x < 60; x += 5) r.box(x, 1, 0, 3.4, 2.5, 110, o.color, { tex: { left: grain('v', x) } });
  },
});

add({
  id: 'varal_luzes', name: 'Varal de Luzinhas', cat: 'parede', wall: true, size: [80, 18], states: ['Desligado', 'Ligado'], frames: 3, fps: 2,
  desc: 'Luzinhas de fada que piscam devagar.', variants: ['#ffd35a', '#ff8fd0', '#8fd0ff'],
  light: (o) => (o.state ? { x: 40, y: 6, z: 8, color: o.color, r: 120 } : null),
  draw(r, o) {
    const sag = (x) => 16 - Math.sin(((x % 40) / 40) * Math.PI) * 11;
    const wire = [];
    for (let x = 0; x <= 80; x++) wire.push([x, 2, Math.round(sag(x)), '#4f6b45']);
    r.pts(wire);
    const cols = [o.color, '#ff8f8f', '#9fe0ff', '#c9f08a'];
    for (let i = 0, x = 4; x < 80; x += 6, i++) {
      if (x % 40 === 0) continue;
      const on = o.state && (i + o.frame) % 3 !== 0, c = cols[i % 4];
      r.sdf([{ ...S.ellipsoid(x, 3, sag(x) - 3, 1.6, 1.6, 2.4), mat: on ? { raw: c } : [c, 1.2], glow: on }]);
    }
  },
});

add({
  id: 'porta_entrada', name: 'Porta de Entrada', cat: null, wall: true, fixed: true, size: [42, 92], states: ['Fechada', 'Aberta'],
  variants: ['#f4f2ee'],
  draw(r, o) {
    const fr = '#e8e2d8', leaf = '#7a4a34';
    r.box(-3, 0, 0, 3, 3, 90, fr); r.box(42, 0, 0, 3, 3, 90, fr); r.box(-3, 0, 88, 48, 3, 5, fr);
    const pan = (u, v) => panel(u, v, 5, 8, 36, 40) ?? panel(u, v, 5, 46, 36, 82) ?? ((Math.floor(u) === 32 || Math.floor(u) === 33) && Math.abs(v - 44) < 2 ? C.brass : grain('v', 1)(u, v));
    if (!o.state) r.box(0, 0, 0, 42, 1.5, 88, leaf, { tex: { left: pan } });
    else {
      r.box(0, -1, 0, 42, 1, 88, '#1c1830', { tex: { left: (u, v) => ({ raw: v < 6 ? '#3a3350' : '#1c1830' }) } });
      r.box(0, 1, 0, 2, 40, 88, leaf, { tex: { right: (u, v) => pan(41 - u, v) } });
    }
  },
});

export const parede = 1;
