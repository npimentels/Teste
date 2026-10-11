// Decoração, escritório, mágico e pets
import { add, C, S, FABRICS, grain, panel, marble, first, legs, turnedLeg, cushion, pillow, foliage, fronds, pot, shadeHex, mix, hash } from './furni_base.js';

// ------------------------------------------------------------ decoração
add({
  id: 'vaso_flores', name: 'Vaso de Tulipas', cat: 'decoracao', size: [1, 1], h: 34, small: true, rots: 2,
  desc: 'Vaso de vidro com tulipas frescas. Fica lindo nas mesas.',
  variants: ['#f08fa8', '#f7d65a', '#e2574c', '#c8b0f0', '#f4f2ee'],
  draw(r, o) {
    r.lathe(16, 16, 0, [3.4, 4, 4.4, 4.6, 4.6, 4.4, 4, 3.4, 3, 2.8, 2.8, 3, 3.4], C.glass, { alpha: 0.5, topTex: () => ({ raw: '#d8f2fa' }) });
    const prims = [];
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, tx = 16 + Math.cos(a) * 5, ty = 16 + Math.sin(a) * 5, tz = 22 + hash(i, 1) * 8;
      prims.push({ ...S.capsule(16, 16, 6, tx, ty, tz, 0.55), mat: '#5fa64a' });
      prims.push({ ...S.ellipsoid(tx, ty, tz + 2, 2, 2, 2.8), mat: (x, y, z) => [o.color, z > tz + 3.2 ? -0.4 : 0] });
      prims.push({ ...S.ellipsoid(16 + Math.cos(a + 0.5) * 3, 16 + Math.sin(a + 0.5) * 3, 13, 0.8, 0.8, 4), mat: C.leaf });
    }
    r.sdf(prims);
  },
});

add({
  id: 'velas', name: 'Velas Aromáticas', cat: 'decoracao', size: [1, 1], h: 18, small: true, states: ['Apagadas', 'Acesas'], frames: 3, fps: 6, rots: 1,
  desc: 'Trio de velas numa bandeja. Clima aconchegante.',
  variants: ['#f4f2ee', '#e8b4b8', '#a3b5a0', '#c8b0f0'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 16, color: '#ffc76a', r: 80, flicker: true } : null),
  draw(r, o) {
    r.lathe(16, 16, 0, [11, 11.5, 11.5], C.gold, { shiny: true });
    for (const [x, y, h] of [[12, 13, 13], [20, 15, 9], [15, 21, 6]]) {
      r.lathe(x, y, 2, new Array(h).fill(2.6), o.color, { topTex: (nx, ny, d) => (d < 0.3 ? C.black : -0.2) });
      if (o.state) {
        const fl = (o.frame + x) % 3;
        r.sdf([{ ...S.ellipsoid(x + (fl - 1) * 0.3, y, h + 4.5, 1, 1, 2), mat: (a, b, z) => ({ raw: z > h + 5 ? '#ffe27a' : '#ffab3d' }), glow: true }]);
      }
    }
  },
});

add({
  id: 'livros', name: 'Pilha de Livros', cat: 'decoracao', size: [1, 1], h: 14, small: true,
  desc: 'Livros empilhados com uma xícara em cima. Charme de biblioteca.',
  variants: ['#3a4a6b', '#b5574b', '#4a9a92', '#6b4f7a'],
  draw(r, o) {
    const pages = (u, v) => (Math.floor(v) === 1 && u > 1 && u < 17 ? '#f1e7d0' : null);
    r.box(6, 9, 0, 20, 14, 4, '#b5574b', { tex: { left: pages } });
    r.box(7, 8, 4, 18, 14, 4, o.color, { tex: { left: pages, top: (u) => (Math.floor(u) === 9 ? C.gold : null) } });
    r.box(8, 10, 8, 16, 12, 3, '#e8d9b8', { tex: { left: (u, v) => (Math.floor(v) === 1 ? '#f4f2ee' : null) } });
    r.lathe(16, 16, 11, [3, 3.4, 3.6, 3.8, 3.8], C.white, { topTex: (nx, ny, d) => (d < 0.75 ? ['#6a3f26', 0] : 0) });
  },
});

add({
  id: 'porta_retrato', name: 'Porta-retrato', cat: 'decoracao', size: [1, 1], h: 18, small: true, rots: 4,
  desc: 'Uma foto especial num porta-retrato dourado.',
  variants: [C.gold, C.white, C.walnut],
  draw(r, o) {
    r.box(9, 14, 0, 14, 3, 17, o.color, {
      tex: {
        left: (u, v) => {
          if (u < 2 || u > 12 || v < 2 || v > 15) return null;
          if (Math.hypot(u - 6, v - 9) < 2.4) return ['#f2c39f', 0];
          if (Math.hypot(u - 9, v - 8) < 2.2) return ['#f6d3b5', 0];
          if (v > 12) return ['#9fd0f0', 0];
          return v < 6 ? ['#7cc46a', 0] : ['#cfeaf7', 0];
        },
      },
    });
    r.box(14, 17, 0, 3, 6, 10, o.color);
  },
});

add({
  id: 'globo', name: 'Globo Terrestre', cat: 'decoracao', size: [1, 1], h: 30, small: true, rots: 1,
  desc: 'Para planejar as próximas viagens.',
  variants: [C.walnut, C.gold],
  draw(r, o) {
    r.lathe(16, 16, 0, [6, 6, 4, 2, 1.4, 1.4, 1.4], o.color, { shiny: true });
    r.sdf([{ ...S.sphere(16, 16, 18, 9), mat: (x, y, z) => (S.noise3(x * 0.25, y * 0.25, z * 0.25) > 0.55 ? '#7cc46a' : '#5a9ee0') }]);
    r.sdf([{ ...S.torusXZ(16, 16, 18, 10.4, 0.7), mat: C.gold }]);
  },
});

add({
  id: 'vitrola', name: 'Vitrola', cat: 'decoracao', size: [1, 1], h: 24, small: true, states: ['Parada', 'Tocando'], frames: 4, fps: 6,
  desc: 'Toca-discos de madeira. Duplo clique para tocar um vinil.',
  variants: [C.walnut, '#2f6f7a', '#b5574b'],
  draw(r, o) {
    r.box(3, 5, 0, 26, 22, 8, o.color, { tex: { left: first((u, v) => (u > 20 && u < 23 && v > 2 && v < 5 ? C.gold : null), grain('u', 2)) } });
    r.lathe(14, 16, 8, [9.5, 9.5], '#1e1820', { topTex: (nx, ny, d) => (d < 0.32 ? ['#e2574c', 0] : (Math.floor(d * 14 + (o.state ? o.frame : 0)) % 3 === 0 ? -0.6 : 0)) });
    r.sdf([{ ...S.capsule(25, 8, 9, 25, 8, 13, 1), mat: C.chrome }, { ...S.capsule(25, 8, 13, 19, o.state ? 14 : 22, 11.5, 0.6), mat: C.chrome }]);
    if (o.state) r.pts([[20, 10, 22 + (o.frame % 2) * 2, '*#ffd35a'], [10, 20, 24 - (o.frame % 2) * 2, '*#f08fa8']]);
  },
});

add({
  id: 'vaso_ceramica', name: 'Vaso de Cerâmica', cat: 'decoracao', size: [1, 1], h: 32, small: true, rots: 1,
  desc: 'Vaso artesanal de cerâmica com galhos secos.',
  variants: [C.white, '#d9a07a', '#5f7394', '#2e2b33'],
  draw(r, o) {
    r.lathe(16, 16, 0, [4, 5.5, 7, 8, 8.6, 8.8, 8.6, 8, 7, 5.6, 4.2, 3.2, 2.8, 2.8, 3.2, 3.6], o.color, { shiny: true, topTex: () => [shadeHex(o.color, 2), 0] });
    const pr = [];
    for (let i = 0; i < 4; i++) { const a = i * 1.6; pr.push({ ...S.capsule(16, 16, 12, 16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, 30 + i * 2, 0.5), mat: '#6b4a34' }); }
    r.sdf(pr);
  },
});

add({
  id: 'escrivaninha', name: 'Escrivaninha', cat: 'quarto', size: [2, 1], h: 34, top: 31, stack: true,
  desc: 'Mesa de estudos com gaveteiro. Combine com o notebook!',
  variants: [C.oak, C.walnut, C.white, C.black],
  draw(r, o) {
    const c = o.color, g = grain('u', 4);
    r.box(2, 4, 0, 3, 24, 29, shadeHex(c, 0.3));
    r.box(42, 4, 0, 20, 24, 29, c, { tex: { left: first((u, v) => ((Math.floor(v) === 7 || Math.floor(v) === 18 || Math.floor(v) === 27) && Math.abs(u - 10) < 2.5 ? C.brass : null), (u, v) => panel(u, v, 2, 1, 17, 10) ?? panel(u, v, 2, 12, 17, 21) ?? panel(u, v, 2, 23, 17, 28), g), right: g } });
    r.box(0, 2, 29, 64, 28, 3, c, { tex: { top: g, left: g } });
  },
});

add({
  id: 'notebook', name: 'Notebook', cat: 'quarto', size: [1, 1], h: 16, small: true, states: ['Desligado', 'Ligado'], frames: 2, fps: 1,
  desc: 'Notebook para navegar. Que tal visitar o Habbo?',
  variants: ['#d6d9df', '#2e2b33', '#e8b4b8'],
  light: (o) => (o.state ? { x: 16, y: 14, z: 10, color: '#bfe3ff', r: 50 } : null),
  draw(r, o) {
    r.box(5, 10, 0, 22, 16, 1.6, o.color, { tex: { top: (u, v) => (v > 2 && v < 9 && u > 2 && u < 19 && (Math.floor(u) + Math.floor(v)) % 2 ? 0.25 : null) } });
    r.box(5, 8, 1.6, 22, 2, 15, o.color, {
      tex: {
        left: (u, v) => {
          if (u < 1.5 || u > 20.5 || v < 1.5 || v > 13.5) return null;
          if (!o.state) return { raw: '#1e2128' };
          if (v > 11) return { raw: '#5a3a8a' };
          if (v > 8 && u > 3 && u < 12) return { raw: o.frame ? '#ffd35a' : '#f08fa8' };
          return { raw: (Math.floor(v) % 3 === 0 && u > 3 && u < 18) ? '#9ac8f0' : '#e8f2fa' };
        },
      },
    });
  },
});

add({
  id: 'cadeira_escritorio', name: 'Cadeira de Escritório', cat: 'quarto', size: [1, 1], h: 46, sit: { z: 19 },
  desc: 'Cadeira giratória com rodinhas.',
  variants: ['#2e2b33', '#e8b4b8', '#5f7394', '#d6d9df'],
  draw(r, o) {
    const pr = [];
    for (let i = 0; i < 5; i++) { const a = i * 1.257; pr.push({ ...S.capsule(16, 16, 3, 16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 2, 1.1), mat: '#3a3a40' }, { ...S.sphere(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 1.4, 1.4), mat: '#1e1e22' }); }
    pr.push({ ...S.capsule(16, 16, 3, 16, 16, 16, 1.4), mat: C.chrome });
    r.sdf(pr);
    cushion(r, 6, 6, 15, 20, 20, 5, o.color, { round: 2.5 });
    r.sdf([{ ...S.capsule(16, 6, 18, 16, 5, 26, 1.2), mat: '#3a3a40' }]);
    cushion(r, 7, 3, 24, 18, 5, 20, o.color, { round: 2.5 });
  },
});

// --------------------------------------------------------------- mágico
add({
  id: 'caldeirao', name: 'Caldeirão', cat: 'magico', size: [1, 1], h: 40, states: ['Frio', 'Borbulhando'], frames: 3, fps: 5,
  desc: 'Para poções duvidosas. Duplo clique para ferver.',
  variants: ['#6fe08a', '#b07cf0', '#ff7aa8', '#6ac8ff'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 24, color: o.color, r: 100 } : null),
  draw(r, o) {
    for (const a of [0.6, 2.7, 4.8]) r.sdf([{ ...S.capsule(16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, 0, 16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 6, 1.4), mat: C.black }]);
    r.lathe(16, 16, 3, [6, 9, 11, 12.4, 13.2, 13.6, 13.8, 13.8, 13.6, 13.2, 12.6, 12, 11.6, 11.4, 11.6, 12.4, 13, 13], '#3a3346', {
      shiny: true,
      topTex: (nx, ny, d) => {
        if (d > 0.86) return -0.6;
        if (!o.state) return [shadeHex(o.color, 1.8), 0];
        const b = hash(Math.floor((nx + 1) * 6), Math.floor((ny + 1) * 6), o.frame);
        return { raw: b > 0.8 ? mix(o.color, '#ffffff', 0.6) : o.color };
      },
    });
    if (o.state) {
      const f = o.frame;
      r.sdf([0, 1, 2].map((i) => ({ ...S.sphere(12 + i * 4, 16 + (i % 2) * 3, 24 + ((i * 5 + f * 4) % 14), 1.5 + (i % 2) * 0.6), mat: { raw: mix(o.color, '#ffffff', 0.5) }, glow: true })));
    }
  },
});

add({
  id: 'bola_cristal', name: 'Bola de Cristal', cat: 'magico', size: [1, 1], h: 30, small: true, states: ['Adormecida', 'Brilhando'], frames: 4, fps: 4, rots: 1,
  desc: 'Mostra o futuro... ou só brilha bonito.',
  variants: ['#b07cf0', '#6ac8ff', '#ff7aa8', '#6fe08a'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 18, color: o.color, r: 90 } : null),
  draw(r, o) {
    r.lathe(16, 16, 0, [7, 7, 6, 5, 5, 5.4, 6, 6], C.gold, { shiny: true });
    r.sdf([{ ...S.sphere(16, 16, 16, 8), mat: (x, y, z) => {
      if (!o.state) return [o.color, -0.3];
      const sw = Math.sin(Math.atan2(y - 16, x - 16) * 3 + z * 0.4 + o.frame * 1.6);
      return { raw: sw > 0.6 ? '#ffffff' : sw > 0 ? mix(o.color, '#ffffff', 0.5) : o.color };
    }, glow: !!o.state }]);
  },
});

add({
  id: 'abobora', name: 'Abóbora Encantada', cat: 'magico', size: [1, 1], h: 26, small: true, states: ['Quieta', 'Acesa'], frames: 2, fps: 3, rots: 4,
  desc: 'Abóbora esculpida. Acesa, ganha um sorriso brilhante.',
  variants: ['#f08a3a', '#b07cf0', '#f3efe6'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 10, color: '#ffae4a', r: 70, flicker: true } : null),
  draw(r, o) {
    const pk = S.bumpy(S.ellipsoid(16, 16, 10, 11, 10, 9), 0.9, (x, y) => Math.abs(Math.sin(Math.atan2(y - 16, x - 16) * 5)));
    r.sdf([{ ...pk, mat: (x, y, z, nx, ny) => {
      if (o.state && ny > 0.5) {
        const fx = x - 16, fz = z - 10;
        if (fz > 1 && fz < 4 && (Math.abs(fx + 3.5) < 1.5 || Math.abs(fx - 3.5) < 1.5)) return { raw: '#ffe27a' };
        if (fz > -4 && fz < -2 && Math.abs(fx) < 5) return { raw: '#ffe27a' };
      }
      return [o.color, Math.abs(Math.sin(Math.atan2(y - 16, x - 16) * 5)) < 0.15 ? 0.5 : 0];
    } }]);
    r.sdf([{ ...S.capsule(16, 16, 18, 17, 16, 23, 1.2), mat: '#5d7a3c' }]);
  },
});

add({
  id: 'grimorio', name: 'Grimório no Atril', cat: 'magico', size: [1, 1], h: 50, states: ['Fechado', 'Aberto'], frames: 3, fps: 4,
  desc: 'Livro de feitiços num atril de madeira. Aberto, as runas brilham.',
  variants: ['#6b4f7a', '#7a3f2e', '#2f4a3a'],
  light: (o) => (o.state ? { x: 16, y: 18, z: 42, color: '#c8a0ff', r: 70 } : null),
  draw(r, o) {
    const w = C.walnut;
    r.lathe(16, 16, 0, [8, 8, 6, 3], w);
    r.lathe(16, 16, 4, new Array(30).fill(2), w, { shiny: true });
    r.box(6, 10, 34, 20, 14, 3, w);
    if (o.state) {
      r.box(5, 10, 37, 22, 14, 2, '#f4ecd8', { tex: { top: (u, v) => (Math.abs(u - 11) < 0.6 ? 0.6 : (Math.floor(v) % 3 === 1 && u % 11 > 2 && u % 11 < 9 && hash(Math.floor(u), Math.floor(v), o.frame) > 0.3 ? { raw: '#b07cf0' } : null)) } });
      r.pts([[10, 14, 44 + o.frame * 2, '*#e8d0ff'], [22, 18, 46 - o.frame, '*#ffffff'], [15, 20, 48 + o.frame, '*#c8a0ff']]);
    } else r.box(7, 11, 37, 18, 12, 4, o.color, { tex: { top: (u, v) => (Math.hypot(u - 9, v - 6) < 2.5 ? C.gold : null) } });
  },
});

add({
  id: 'vassoura', name: 'Vassoura de Bruxa', cat: 'magico', size: [1, 1], h: 70, rots: 4,
  desc: 'Encostada no canto, pronta para voar.',
  variants: ['#c9a36a', '#8a6a4a'],
  draw(r, o) {
    r.sdf([{ ...S.capsule(16, 6, 22, 16, 2, 70, 1.2), mat: '#7a5038' }]);
    const br = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; br.push({ ...S.capsule(16, 6, 22, 16 + Math.cos(a) * 5, 9 + Math.sin(a) * 2.5, 0, 1), mat: i % 3 ? o.color : shadeHex(o.color, 0.6) }); }
    r.sdf(br, { blend: 1 });
    r.sdf([{ ...S.torus(16, 6, 20, 2.4, 0.8), mat: '#b5574b' }]);
  },
});

add({
  id: 'cristais', name: 'Cristais Brilhantes', cat: 'magico', size: [1, 1], h: 30, states: ['Apagados', 'Brilhando'], rots: 2,
  desc: 'Aglomerado de cristais que brilham no escuro.',
  variants: ['#b07cf0', '#6ac8ff', '#ff7aa8'],
  light: (o) => (o.state ? { x: 16, y: 16, z: 14, color: o.color, r: 80 } : null),
  draw(r, o) {
    r.sdf([{ ...S.bumpy(S.ellipsoid(16, 16, 2, 11, 10, 4), 1, (x, y) => Math.sin(x) * Math.sin(y)), mat: '#7a7480' }]);
    const pr = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, d = i ? 5 : 0, h = i ? 12 + hash(i, 1) * 8 : 26;
      const bx = 16 + Math.cos(a) * d, by = 16 + Math.sin(a) * d;
      pr.push({ ...S.cone(bx, by, 2, 2 + h, i ? 2.2 : 3.2, 0.3), mat: o.state ? { raw: i % 2 ? mix(o.color, '#ffffff', 0.5) : o.color } : [o.color, 0.5], glow: !!o.state });
    }
    r.sdf(pr);
  },
});

// ------------------------------------------------------------------ pets
add({
  id: 'caminha', name: 'Caminha de Pet', cat: 'pets', size: [1, 1], h: 14, pet: 'bed', walk: true, rots: 1, petZ: 5,
  desc: 'Seus pets dormem aqui quando estão com soninho.',
  variants: ['#d96c7a', '#5f7394', '#a3b5a0', '#d9a23b', '#d6d9df'],
  draw(r, o) {
    r.sdf([{ ...S.subtract(S.cyl(16, 16, 0, 11, 14, 5), S.cyl(16, 16, 5, 16, 10, 3)), mat: (x, y) => [o.color, Math.abs(Math.sin(Math.atan2(y - 16, x - 16) * 6)) < 0.15 ? 0.4 : 0] }]);
    r.sdf([{ ...S.cyl(16, 16, 3, 7, 10.4, 3), mat: '#f4f2ee' }]);
  },
});

add({
  id: 'pote_racao', name: 'Pote de Ração', cat: 'pets', size: [1, 1], h: 8, small: true, pet: 'bowl', walk: true, rots: 1,
  desc: 'Seus pets vêm comer aqui de vez em quando.',
  variants: ['#d94f4f', '#5f7394', '#7fa86b', '#e8b4b8'],
  draw(r, o) {
    r.lathe(16, 17, 0, [6, 7.5, 8.4, 9, 9.2, 9.2], o.color, { shiny: true, topTex: (nx, ny, d) => (d < 0.72 ? [hash(Math.floor(nx * 9), Math.floor(ny * 9)) > 0.5 ? '#a8693a' : '#7d4c31', 0] : 0) });
  },
});

add({
  id: 'arranhador', name: 'Arranhador de Gato', cat: 'pets', size: [1, 1], h: 76, rots: 2,
  desc: 'Torre com plataformas e uma bolinha pendurada. Gatos amam.',
  variants: ['#d6d9df', '#c9a36a', '#e8b4b8'],
  draw(r, o) {
    const c = o.color, rope = (x, y, z) => ['#c9a36a', Math.floor(z * 1.5) % 2 ? 0.3 : 0];
    r.box(2, 2, 0, 28, 28, 4, c);
    r.sdf([{ ...S.cyl(10, 10, 4, 40, 3, 0.5), mat: rope }, { ...S.cyl(22, 22, 4, 66, 3, 0.5), mat: rope }]);
    cushion(r, 3, 3, 38, 16, 16, 4, c, { round: 1.6 });
    cushion(r, 12, 12, 64, 18, 18, 5, c, { round: 2 });
    r.sdf([{ ...S.capsule(6, 18, 38, 6, 18, 28, 0.3), mat: '#7a5038' }, { ...S.sphere(6, 18, 26, 2.2), mat: '#e2574c' }]);
  },
});

add({
  id: 'casinha', name: 'Casinha de Cachorro', cat: 'pets', size: [2, 2], h: 56, pet: 'bed', petZ: 2,
  desc: 'Casinha de madeira com telhado vermelho.',
  variants: ['#c49a6c', '#f2efe9', '#7fa0b8'],
  draw(r, o) {
    const g = (u, v) => (Math.floor(v) % 6 === 0 ? 0.4 : null);
    r.box(6, 6, 0, 52, 50, 34, o.color, { tex: { left: (u, v) => (Math.hypot(u - 26, v - 14) < 12 && v < 26 ? ['#2a2020', 0] : g(u, v)), right: g } });
    const roof = (x, y, z) => ['#b5323a', Math.floor((z - 34) / 3) % 2 ? 0.3 : 0];
    r.sdf([{ ...S.intersect(S.cbox(2, 2, 34, 60, 58, 24, 1), { f: (x, y, z) => Math.abs(x - 32) * 0.85 + (z - 34) - 26, bb: [2, 2, 34, 62, 60, 60] }), mat: roof }]);
    r.box(16, 54, 32, 18, 2, 6, '#f4f2ee', { tex: { left: (u, v) => (v > 1.5 && v < 4.5 && u > 3 && u < 15 && Math.floor(u) % 3 ? '#2a2a30' : null) } });
  },
});

add({
  id: 'bolinha', name: 'Bolinha de Brinquedo', cat: 'pets', size: [1, 1], h: 8, small: true, walk: true, rots: 1,
  desc: 'Bolinha de tênis para os pets brincarem.',
  variants: ['#c8e05a', '#e2574c', '#5a9ee0'],
  draw(r, o) {
    r.sdf([{ ...S.sphere(16, 16, 4, 4), mat: (x, y, z) => (Math.abs(Math.sin((x - 16) * 0.7) * 2 - (z - 4)) < 0.6 ? '#f4f2ee' : o.color) }]);
  },
});

export const decor = 1;
