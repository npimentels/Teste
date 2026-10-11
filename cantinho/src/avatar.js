// Avatar estilo Habbo, pré-renderizado de um boneco 3D articulado.
//
// O corpo é montado com formas SDF (cabeça, tronco, braços, pernas) num espaço
// local onde +Y é a frente e +X é a direita do personagem. Ele é girado para
// as 8 direções do Habbo e rasterizado com o mesmo motor das mobílias, então
// recebe o mesmo contorno, luz e paleta. Olhos e boca são carimbos de pixel
// desenhados à mão, posicionados sobre a superfície do rosto.
//
// Altura: ~72 px sem chapéu (tile de 64 × 32, igual ao Habbo).

import { Raster } from './raster.js';
import * as S from './sdf.js';
import { shadeHex, mix } from './color.js';

const { sin, cos, PI } = Math;

// ------------------------------------------------------------ paletas
export const SKIN = ['#fde6d2', '#f8d5b9', '#f2c39f', '#eab08a', '#dc9b72', '#c9855e', '#b0704b', '#94593a', '#7a462c', '#5e3422', '#f6d3c3', '#e9c09a'];
export const HAIR_COLORS = ['#2a201e', '#4a3125', '#6b4430', '#8a5a3c', '#b57a4a', '#d9a65e', '#f1cd7a', '#f7e2a8', '#e8e3d8', '#9a9aa6', '#c6452f', '#e2683c', '#e98fb4', '#b07cf0', '#5a7fd6', '#4fa39a', '#7cc46a', '#2f2f4a'];
export const CLOTH = [
  '#f4f2ee', '#d8d6d0', '#a9a7a2', '#6e6c6a', '#45444a', '#2a2a30',
  '#e2574c', '#b8323a', '#f08fa8', '#e86fa0', '#c94f8a', '#8a3a6a',
  '#f3a64a', '#e8792f', '#f7d65a', '#e6b83c', '#c9a35a', '#8e6a3c',
  '#9fd36a', '#5fa64a', '#2f7a4a', '#6fcbb0', '#2f9a8a', '#1f5f5a',
  '#9fd0f0', '#5a9ee0', '#3a6ab8', '#2a3f7a', '#1f2a4a', '#7a8fc8',
  '#c8b0f0', '#9a7ce0', '#6a4ab0', '#4a2f7a', '#f0d0b8', '#b88a6a',
];

// ----------------------------------------------------------- catálogo
// g: U (todos) | M | F — como no Habbo, alguns itens são de um gênero.
export const WARDROBE = {
  hair: [
    { id: 'careca', name: 'Careca', g: 'U' },
    { id: 'curto', name: 'Curtinho', g: 'U' },
    { id: 'topete', name: 'Topete', g: 'M' },
    { id: 'moicano', name: 'Moicano', g: 'M' },
    { id: 'franja', name: 'Franja', g: 'U' },
    { id: 'chanel', name: 'Chanel', g: 'F' },
    { id: 'longo', name: 'Longo', g: 'F' },
    { id: 'rabo', name: 'Rabo de cavalo', g: 'F' },
    { id: 'coque', name: 'Coque', g: 'F' },
    { id: 'chiquinha', name: 'Maria-chiquinha', g: 'F' },
    { id: 'cacheado', name: 'Black power', g: 'U' },
  ],
  hat: [
    { id: 'nenhum', name: 'Nenhum', g: 'U' },
    { id: 'gorro', name: 'Gorro com pompom', g: 'U' },
    { id: 'bone', name: 'Boné', g: 'U' },
    { id: 'bruxa', name: 'Chapéu de bruxa', g: 'U' },
    { id: 'praia', name: 'Chapéu de praia', g: 'F' },
    { id: 'coroa', name: 'Coroa de flores', g: 'F' },
    { id: 'laco', name: 'Laço', g: 'F' },
    { id: 'fones', name: 'Fones', g: 'U' },
  ],
  top: [
    { id: 'camiseta', name: 'Camiseta', g: 'U' },
    { id: 'listrada', name: 'Listrada', g: 'U' },
    { id: 'regata', name: 'Regata', g: 'U' },
    { id: 'manga_longa', name: 'Manga longa', g: 'U' },
    { id: 'moletom', name: 'Moletom', g: 'U' },
    { id: 'jaqueta', name: 'Jaqueta', g: 'U' },
    { id: 'social', name: 'Camisa social', g: 'M' },
    { id: 'cropped', name: 'Cropped', g: 'F' },
    { id: 'vestido', name: 'Vestido', g: 'F' },
  ],
  bottom: [
    { id: 'calca', name: 'Calça', g: 'U' },
    { id: 'jeans', name: 'Jeans', g: 'U' },
    { id: 'bermuda', name: 'Bermuda', g: 'U' },
    { id: 'shorts', name: 'Shorts', g: 'F' },
    { id: 'saia', name: 'Saia', g: 'F' },
  ],
  shoes: [
    { id: 'tenis', name: 'Tênis', g: 'U' },
    { id: 'pantufa', name: 'Pantufa', g: 'U' },
    { id: 'botas', name: 'Botas', g: 'U' },
    { id: 'sapatilha', name: 'Sapatilha', g: 'F' },
    { id: 'chinelo', name: 'Chinelo', g: 'U' },
  ],
  acc: [
    { id: 'nenhum', name: 'Nenhum', g: 'U' },
    { id: 'oculos', name: 'Óculos', g: 'U' },
    { id: 'brinco', name: 'Brincos', g: 'U' },
    { id: 'colar', name: 'Colar', g: 'U' },
    { id: 'cachecol', name: 'Cachecol', g: 'U' },
    { id: 'mochila', name: 'Mochila', g: 'U' },
  ],
};

export const DEFAULT_LOOK = {
  name: 'Você', gender: 'F', skin: '#f2c39f',
  hair: 'franja', hairColor: '#6b4430',
  hat: 'gorro', hatColor: '#f7d65a',
  top: 'moletom', topColor: '#45444a',
  bottom: 'calca', bottomColor: '#2a2a30',
  shoes: 'pantufa', shoesColor: '#d8d6d0',
  acc: 'brinco', accColor: '#9fd0f0',
};

export const DEFAULT_LOOK_M = {
  ...DEFAULT_LOOK, gender: 'M', hair: 'curto', hairColor: '#4a3125', hat: 'nenhum',
  top: 'camiseta', topColor: '#3a6ab8', bottom: 'jeans', bottomColor: '#2a3f7a', shoes: 'tenis', shoesColor: '#f4f2ee', acc: 'nenhum',
};

// Direções do Habbo: vetor de frente em coordenadas de chão
export const DIRS = [
  [1, 1], // 0 S   (de frente)
  [1, 0], // 1 SE
  [1, -1], // 2 E  (perfil)
  [0, -1], // 3 NE
  [-1, -1], // 4 N (de costas)
  [-1, 0], // 5 NW
  [-1, 1], // 6 W
  [0, 1], // 7 SW
];
export function dirFromVec(dx, dy) {
  const a = Math.atan2(dy, dx);
  let best = 0, bd = Infinity;
  DIRS.forEach(([x, y], i) => {
    const d = Math.abs(((Math.atan2(y, x) - a + 3 * PI) % (2 * PI)) - PI);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// ------------------------------------------------------------ esqueleto
// Membro: começa apontando para baixo; roll abre para o lado (+X), pitch
// gira para a frente (+Y). Ângulos absolutos em radianos.
function seg(start, len, pitch, roll) {
  const dx = sin(roll), dz0 = -cos(roll);
  const dy = -dz0 * sin(pitch), dz = dz0 * cos(pitch);
  return [start[0] + dx * len, start[1] + dy * len, start[2] + dz * len];
}

function poseAngles(pose, frame) {
  // braços: [pitch, roll, forearmPitch, forearmRoll] | pernas: [thighPitch, shinPitch]
  const P = {
    armR: [0, 0.12, 0.1, 0.12], armL: [0, 0.12, 0.1, 0.12],
    legR: [0, 0], legL: [0, 0], bob: 0, lift: 0,
  };
  if (pose === 'walk') {
    const a = [0.42, 0, -0.42, 0][frame % 4];
    P.legR = [a, a > 0 ? a - 0.15 : a - 0.35];
    P.legL = [-a, -a > 0 ? -a - 0.15 : -a - 0.35];
    P.armR = [-a * 0.9, 0.12, -a * 0.9 + 0.25, 0.12];
    P.armL = [a * 0.9, 0.12, a * 0.9 + 0.25, 0.12];
    P.bob = frame % 2 ? 1 : 0;
  } else if (pose.startsWith('sit')) {
    P.legR = [PI / 2, 0.08];
    P.legL = [PI / 2, 0.08];
    P.armR = [0.35, 0.12, 0.9, 0.12];
    P.armL = [0.35, 0.12, 0.9, 0.12];
    P.lift = -9.5;
    if (pose === 'sithold') P.armR = [0.55, 0.12, 1.55, 0.12];
    if (pose === 'sitsip') P.armR = [1.0, 0.25, 2.65, 0.3];
  } else if (pose === 'wave') {
    const w = frame % 2 ? 2.75 : 3.15;
    P.armR = [0, 2.35, 0, w];
  } else if (pose === 'dance') {
    const f = frame % 4;
    P.bob = f % 2 ? 1.5 : 0;
    if (f < 2) { P.armR = [0, 2.4, 0, 2.9]; P.armL = [0.5, 0.5, 1.4, 0.4]; }
    else { P.armL = [0, 2.4, 0, 2.9]; P.armR = [0.5, 0.5, 1.4, 0.4]; }
    P.legR = f < 2 ? [0.25, 0] : [0, 0];
    P.legL = f < 2 ? [0, 0] : [0.25, 0];
  } else if (pose === 'hold') {
    P.armR = [0.55, 0.12, 1.55, 0.12];
  } else if (pose === 'sip') {
    P.armR = [1.0, 0.25, 2.65, 0.3];
  } else if (pose === 'swim') {
    const a = [0.9, 0.2, -0.6, 0.2][frame % 4];
    P.armR = [a + 1.2, 0.5, a + 1.6, 0.5];
    P.armL = [-a + 1.2, 0.5, -a + 1.6, 0.5];
  }
  return P;
}

// ------------------------------------------------------------ modelo
// Devolve partes { prims, mat, blend } em coordenadas locais + carimbos do rosto.
function buildModel(look, pose, frame, hand) {
  const F = look.gender === 'F';
  const P = poseAngles(pose, frame);
  if (hand && (pose === 'walk' || pose === 'stand' || pose === 'dance')) P.armR = [0.55, 0.12, 1.55, 0.12];
  const lift = P.lift + P.bob;
  const z = (v) => v + lift;
  const skin = look.skin;
  const parts = [];
  const top = look.top, bottom = look.bottom;
  const dress = top === 'vestido';
  const TC = look.topColor, BC = dress ? look.topColor : look.bottomColor;
  const long = top === 'manga_longa' || top === 'moletom' || top === 'jaqueta' || top === 'social';
  const sleeveless = top === 'regata' || top === 'vestido';
  const legBare = bottom === 'saia' || bottom === 'shorts' || dress;
  const kneeBare = legBare || bottom === 'bermuda';

  // --- tronco (camisa)
  const shW = F ? 6.0 : 6.9, waW = F ? 4.9 : 5.7, hipW = F ? 6.0 : 5.8;
  const bulk = top === 'moletom' || top === 'jaqueta' ? 0.6 : 0;
  const topMat = (x, y, zz) => {
    const zl = zz - lift;
    if (top === 'cropped' && zl < 33.5) return skin;
    if (top === 'listrada' && Math.floor(zl) % 4 < 2) return mix(TC, '#ffffff', 0.75);
    if (top === 'jaqueta' && y > 1.5 && Math.abs(x) < 1.6) return '#f4f2ee';
    if (top === 'social' && y > 1.5 && Math.abs(x) < 0.6 && Math.floor(zl) % 4 === 0) return '#f4f2ee';
    if (top === 'moletom' && y > 2 && zl < 34 && zl > 29 && Math.abs(x) < 4) return [TC, 0.55];
    if (top === 'moletom' && y > 2 && zl > 38 && zl < 43 && (Math.abs(x - 1.2) < 0.45 || Math.abs(x + 1.2) < 0.45)) return '#f4f2ee';
    if (top === 'regata' && zl > 41 && Math.abs(x) > 3.6) return skin;
    return TC;
  };
  const torso = [
    S.rbox(0, 0, z(32), waW + bulk, 3.3 + bulk, 4.2, 2.6),
    S.rbox(0, 0, z(39.6), shW + bulk, 3.8 + bulk, 5.4, 3),
  ];
  if (F) { torso.push(S.sphere(-2.4, 2.6, z(39), 2.5), S.sphere(2.4, 2.6, z(39), 2.5)); }
  parts.push({ prims: torso, mat: topMat, blend: 2.2, id: 'torso' });
  if (top === 'moletom') parts.push({ prims: [S.capsule(-4, -3.4, z(45.5), 4, -3.4, z(45.5), 2.2)], mat: [TC, 0.3], id: 'hood' });
  if (top === 'social' || top === 'jaqueta') parts.push({ prims: [S.capsule(-3.4, 2.4, z(45), 0, 3.6, z(43.2), 1), S.capsule(3.4, 2.4, z(45), 0, 3.6, z(43.2), 1)], mat: top === 'social' ? '#f4f2ee' : [TC, -0.3], id: 'collar' });

  // --- quadril / saia
  const hipMat = (x, y, zz) => (bottom === 'jeans' && y > 2 && Math.abs(x) < 0.5 ? [BC, 0.6] : BC);
  if (dress || bottom === 'saia') {
    parts.push({ prims: [S.cone(0, 0, z(13), z(29), 9.4, hipW - 0.2)], mat: dress ? TC : BC, id: 'skirt' });
  } else {
    parts.push({ prims: [S.rbox(0, 0, z(26.4), hipW, 3.5, 3.6, 2.4)], mat: hipMat, id: 'hips' });
  }

  // --- pernas
  for (const side of [1, -1]) {
    const [tp, sp] = side > 0 ? P.legR : P.legL;
    const hip = [side * 3.1, 0, z(24.5)];
    const knee = seg(hip, 10.5, tp, 0);
    const ankle = seg(knee, 10, sp, 0);
    const legMat = (x, y, zz) => {
      const d = Math.hypot(x - hip[0], y - hip[1], zz - hip[2]);
      if (dress || bottom === 'saia') return skin;
      if (bottom === 'shorts') return d < 5 ? BC : skin;
      if (bottom === 'bermuda') return d < 11 ? BC : skin;
      if (bottom === 'jeans' && Math.floor(d * 1.2) % 8 === 0) return [BC, -0.35];
      return BC;
    };
    parts.push({ prims: [S.capsule(...hip, ...knee, 3.1, 2.8), S.capsule(...knee, ...ankle, 2.8, 2.4)], mat: legMat, blend: 1, id: 'leg' + side });
    // pé
    const fz = ankle[2] - 1.3;
    const sh = look.shoes, SC = look.shoesColor;
    const foot = [];
    if (sh === 'botas') foot.push(S.capsule(ankle[0], ankle[1], ankle[2] + 6, ankle[0], ankle[1], ankle[2], 3.1));
    const fy = ankle[1] + 1.4;
    if (sh === 'pantufa') foot.push(S.ellipsoid(ankle[0], fy + 0.6, fz + 0.4, 3.2, 4.8, 2.6));
    else foot.push(S.rbox(ankle[0], fy, fz, sh === 'sapatilha' || sh === 'chinelo' ? 2.3 : 2.7, 4.1, 2.0, 1.6));
    const shoeMat = (x, y, zz) => {
      const zl = zz - lift;
      if (sh === 'chinelo') return zl < fz - lift - 1.2 ? SC : skin;
      if (sh === 'tenis' && zl < fz - lift - 0.9) return '#f4f2ee';
      if (sh === 'tenis' && y > fy + 1 && Math.abs(x - ankle[0]) < 0.6) return '#f4f2ee';
      if (sh === 'sapatilha' && zl > fz - lift + 0.5) return skin;
      return SC;
    };
    parts.push({ prims: foot, mat: shoeMat, id: 'foot' + side });
  }

  // --- braços
  let handPos = null;
  for (const side of [1, -1]) {
    const [ap, ar, fp, fr] = side > 0 ? P.armR : P.armL;
    const sh = [side * (shW + 0.4 + bulk), 0, z(43.5)];
    const elbow = seg(sh, 9.5, ap, side * ar);
    const wrist = seg(elbow, 8.5, fp, side * fr);
    const dir = [(wrist[0] - elbow[0]) / 8.5, (wrist[1] - elbow[1]) / 8.5, (wrist[2] - elbow[2]) / 8.5];
    const hpos = [wrist[0] + dir[0] * 1.6, wrist[1] + dir[1] * 1.6, wrist[2] + dir[2] * 1.6];
    if (side > 0) handPos = hpos;
    const sr = 2.7 + bulk * 0.6;
    const upMat = sleeveless ? skin : TC;
    const loMat = long ? TC : skin;
    parts.push({
      prims: [
        { ...S.capsule(...sh, ...elbow, sr, sr - 0.2), mat: (x, y, zz) => (top === 'listrada' && Math.floor(zz - lift) % 4 < 2 && !sleeveless ? mix(TC, '#ffffff', 0.75) : upMat) },
        { ...S.capsule(...elbow, ...wrist, long ? 2.5 : 2.2, long ? 2.4 : 2.0), mat: loMat },
        { ...S.sphere(...hpos, 2.3), mat: skin },
      ], id: 'arm' + side, blend: 0.8,
    });
  }

  // --- pescoço e cabeça
  const HC = [0, 0.4, z(59)];
  parts.push({ prims: [S.capsule(0, 0, z(44), 0, 0.3, z(50), 2.3)], mat: skin, id: 'neck' });
  parts.push({
    prims: [S.rbox(HC[0], HC[1], HC[2], 8.7, 7.6, 10.4, 5.6), S.sphere(8.7, 0, z(56.5), 2), S.sphere(-8.7, 0, z(56.5), 2), S.ellipsoid(0, 8.1, z(55.3), 1.3, 1.1, 1.6)],
    mat: skin, id: 'head',
  });

  // --- cabelo e chapéu
  const hairParts = buildHair(look, z, HC);
  // sob chapéus que cobrem a cabeça, o cabelo de cima é cortado
  const capLine = { gorro: HC[2] + 3, bone: HC[2] + 2.6, bruxa: HC[2] + 4.4, praia: HC[2] + 3.4 }[look.hat];
  if (capLine != null) for (const hp of hairParts) hp.cut = (x, y, zz) => zz > capLine && !(look.hair === 'coque' && false);
  parts.push(...hairParts);
  parts.push(...buildHat(look, z, HC));
  parts.push(...buildAcc(look, z, HC, shW));
  if (hand) parts.push(...buildHandItem(hand, handPos));

  // carimbos do rosto (pontos locais na superfície + normal local)
  const stamps = [];
  const eyeZ = z(58);
  stamps.push({ type: 'eye', side: 1, p: [3.5, 7.75, eyeZ], n: [0.38, 0.92, 0] });
  stamps.push({ type: 'eye', side: -1, p: [-3.5, 7.75, eyeZ], n: [-0.38, 0.92, 0] });
  stamps.push({ type: 'mouth', p: [0, 7.9, z(52.4)], n: [0, 1, -0.1] });
  if (look.acc === 'oculos') stamps.push({ type: 'glasses', p: [0, 8, eyeZ], n: [0, 1, 0] });
  return { parts, stamps, F };
}

function buildHair(look, z, HC) {
  const s = look.hair, c = look.hairColor;
  if (s === 'careca') return [];
  const out = [];
  const cz = HC[2];
  // "capacete" um pouco maior que a cabeça, recortado pela linha do cabelo
  const shell = S.rbox(0, 0.1, cz + 0.6, 9.5, 8.5, 11, 6.2);
  const fringe = (x, y) => {
    // altura da linha do cabelo (z relativo ao centro da cabeça) em volta da cabeça
    const front = y > 2.5, back = y < -2;
    const side = !front && !back;
    let line;
    switch (s) {
      case 'curto': line = front ? 4.2 - (Math.abs(x) > 4 ? 1.2 : 0) : side ? 1.6 : -5.5; break;
      case 'topete': line = front ? 5 : side ? 2 : -5; break;
      case 'moicano': line = Math.abs(x) < 2.6 ? -6 : 9; break;
      case 'chanel': line = front ? 2.4 - (Math.floor((x + 9) / 2.4) % 2) * 1.2 : side ? -6.5 : -7.5; break;
      case 'longo': case 'chiquinha': line = front ? 2.2 - (Math.floor((x + 9) / 2.2) % 2) * 1.4 : side ? -4 : -7; break;
      case 'rabo': case 'coque': line = front ? 3.4 - (Math.abs(x) < 1.2 ? 1.5 : 0) : side ? 0.5 : -6; break;
      case 'cacheado': line = front ? 3.8 : -2; break;
      default: line = front ? 1.8 - (Math.floor((x + 9) / 2.3) % 2) * 1.6 : side ? 0 : -6; // franja
    }
    return line;
  };
  const hairMat = (x, y, zz, nx, ny, nz) => {
    // fios: leve variação em faixas
    const k = Math.floor((x * 0.9 + zz * 0.35 + 20)) % 5 === 0 ? 0.35 : 0;
    return [c, k];
  };
  const main = S.intersect(shell, { f: (x, y, zz) => fringe(x, y) - (zz - cz), bb: shell.bb });
  if (s === 'cacheado') {
    const afro = S.bumpy(S.ellipsoid(0, -1, cz + 3, 12.5, 12, 12.5), 1.2, (x, y, zz) => Math.sin(x * 1.1) * Math.sin(y * 1.2) * Math.sin(zz * 1.1));
    out.push({ prims: [S.intersect(afro, { f: (x, y, zz) => (y > 4 ? (fringe(x, y) - (zz - cz)) : -1), bb: afro.bb })], mat: hairMat, id: 'hair' });
    return out;
  }
  const prims = [main];
  if (s === 'topete') prims.push(S.ellipsoid(0, 4, cz + 9.5, 6, 5, 4));
  if (s === 'moicano') prims.push(S.rbox(0, -1, cz + 9, 1.8, 8.5, 4, 1.6));
  if (s === 'longo') prims.push(S.rbox(0, -4.2, cz - 9, 8.6, 4.2, 12, 4), S.capsule(8.2, 1.5, cz + 1, 7.6, 3.4, cz - 17, 2.6, 2.2), S.capsule(-8.2, 1.5, cz + 1, -7.6, 3.4, cz - 17, 2.6, 2.2));
  if (s === 'chanel') prims.push(S.intersect(S.rbox(0, -0.6, cz - 3.5, 9.6, 8.6, 7, 4.5), { f: (x, y) => y - 4.2, bb: [-10, -10, cz - 11, 10, 5, cz + 4] }));
  if (s === 'rabo') prims.push(S.capsule(0, -8.4, cz + 3, 0, -11.5, cz - 12, 3.4, 2));
  if (s === 'coque') prims.push(S.sphere(0, -4.5, cz + 11, 4.6));
  if (s === 'chiquinha') prims.push(S.capsule(9.2, -2, cz + 1, 10.5, -3, cz - 10, 3.2, 2), S.capsule(-9.2, -2, cz + 1, -10.5, -3, cz - 10, 3.2, 2));
  out.push({ prims, mat: hairMat, blend: 1.6, id: 'hair' });
  if (s === 'rabo' || s === 'chiquinha') out.push({ prims: s === 'rabo' ? [S.torus(0, -9, cz + 1.5, 2.6, 1)] : [S.sphere(9.4, -2.2, cz + 0.5, 1.6), S.sphere(-9.4, -2.2, cz + 0.5, 1.6)], mat: '#e2574c', id: 'tie' });
  return out;
}

function buildHat(look, z, HC) {
  const s = look.hat, c = look.hatColor, cz = HC[2];
  const out = [];
  switch (s) {
    case 'gorro': {
      const crown = S.rbox(0, 0.3, cz + 1.4, 10, 8.9, 11.2, 6.6);
      const cap = S.intersect(S.blend(3, crown, S.ellipsoid(0, -0.6, cz + 5.6, 9.4, 8.8, 9.2)), { f: (x, y, zz) => cz + 3 - zz + (y > 0 ? 0 : -2.5), bb: [-11, -10, cz - 1, 11, 10, cz + 15] });
      out.push({ prims: [cap], mat: (x, y, zz) => [c, Math.floor((x + 20) / 1.6) % 2 ? 0.28 : 0], id: 'hat' });
      out.push({ prims: [S.intersect(S.rbox(0, 0.3, cz + 4.2, 10.8, 9.7, 2.3, 2.2), { f: (x, y, zz) => (y > 0 ? -1 : cz + 1 - zz), bb: [-11.5, -11, cz + 1.5, 11.5, 11, cz + 7] })], mat: [c, -0.35], id: 'hatcuff' });
      out.push({ prims: [S.bumpy(S.sphere(0.5, -1.5, cz + 15.6, 3.8), 0.5, (x, y, zz) => Math.sin(x * 2.5 + zz * 2) * Math.sin(y * 2.3))], mat: [c, -0.2], id: 'pom' });
      break;
    }
    case 'bone':
      out.push({ prims: [S.intersect(S.rbox(0, 0.3, cz + 1.6, 9.7, 8.6, 11, 6.4), { f: (x, y, zz) => cz + 2.6 - zz, bb: [-10.5, -10, cz, 10.5, 10, cz + 13] })], mat: c, id: 'hat' });
      out.push({ prims: [S.rbox(0, 10, cz + 3, 6.8, 5, 0.8, 0.8)], mat: [c, 0.4], id: 'brim' });
      out.push({ prims: [S.sphere(0, 0.3, cz + 12.4, 1.3)], mat: [c, -0.5], id: 'btn' });
      break;
    case 'bruxa':
      out.push({ prims: [S.intersect(S.rbox(0, 0.3, cz + 1.4, 9.8, 8.7, 11, 6.4), { f: (x, y, zz) => Math.max(cz + 5.8 - zz, zz - cz - 8.2), bb: [-10.5, -10, cz + 5, 10.5, 10, cz + 9] })], mat: '#e8b34b', id: 'band' });
      out.push({ prims: [S.cyl(0, 0, cz + 4.4, cz + 6, 16, 0.8)], mat: c, id: 'brim' });
      out.push({ prims: [S.cone(0, -0.6, cz + 9, cz + 30, 7.4, 0.6)], mat: c, id: 'hat' });
      out.push({ prims: [S.intersect(S.rbox(0, 0.3, cz + 1.6, 9.9, 8.8, 11.2, 6.4), { f: (x, y, zz) => cz + 8.2 - zz, bb: [-10.5, -10, cz + 8, 10.5, 10, cz + 13] })], mat: c, id: 'crown' });
      break;
    case 'praia':
      out.push({ prims: [S.cyl(0, 0, cz + 3.2, cz + 4.2, 16, 0.5)], mat: (x, y) => [c, Math.floor(Math.hypot(x, y) / 2) % 2 ? 0.25 : 0], id: 'brim' });
      out.push({ prims: [S.intersect(S.rbox(0, 0.3, cz + 1.4, 9.8, 8.8, 11.6, 6.4), { f: (x, y, zz) => cz + 3.5 - zz, bb: [-10.5, -10, cz + 3, 10.5, 10, cz + 14] })], mat: (x, y, zz) => (zz < cz + 6.4 ? '#e2574c' : c), id: 'hat' });
      break;
    case 'coroa': {
      const pr = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2;
        pr.push({ ...S.sphere(sin(a) * 8.6, cos(a) * 8, cz + 6.5 + (i % 2), 2), mat: ['#f08fa8', '#f7d65a', '#f4f2ee', '#c8b0f0'][i % 4] });
      }
      out.push({ prims: pr, id: 'hat' });
      out.push({ prims: [S.torus(0, 0, cz + 6, 8.6, 1)], mat: '#5fa64a', id: 'ring' });
      break;
    }
    case 'laco':
      out.push({ prims: [S.ellipsoid(4.6, 1.2, cz + 9.8, 3.2, 1.4, 2.4), S.ellipsoid(9.6, 1.2, cz + 9.8, 3.2, 1.4, 2.4), S.sphere(7.1, 1.4, cz + 9.8, 1.6)], mat: c, id: 'hat' });
      break;
    case 'fones':
      out.push({ prims: [S.intersect(S.torusXZ(0, 0, cz + 1, 10.2, 1.1), { f: (x, y, zz) => cz + 1 - zz, bb: [-12, -2, cz, 12, 2, cz + 12] })], mat: '#45444a', id: 'band' });
      out.push({ prims: [S.cyl(9.6, 0, cz - 3.5, cz + 0.5, 3.2, 1.2), S.cyl(-9.6, 0, cz - 3.5, cz + 0.5, 3.2, 1.2)], mat: c, id: 'cups' });
      break;
    default:
  }
  return out;
}

function buildAcc(look, z, HC, shW) {
  const s = look.acc, c = look.accColor, cz = HC[2];
  switch (s) {
    case 'brinco': return [{ prims: [S.sphere(8.4, 0.4, cz - 4.8, 1.3), S.sphere(-8.4, 0.4, cz - 4.8, 1.3)], mat: c, id: 'acc' }];
    case 'colar': return [{ prims: [S.intersect(S.torus(0, 0.6, z(44.3), 4.3, 0.7), { f: (x, y) => -y - 1, bb: [-6, -6, z(42), 6, 6, z(46)] }), S.sphere(0, 4.4, z(42.4), 1.2)], mat: c, id: 'acc' }];
    case 'cachecol': return [{ prims: [S.torus(0, 0.3, z(45.5), 4.6, 2.3), S.capsule(2.4, 4.4, z(45), 3, 5.2, z(36), 1.8)], mat: (x, y, zz) => [c, Math.floor(zz) % 3 === 0 ? 0.4 : 0], id: 'acc' }];
    case 'mochila': return [{ prims: [S.rbox(0, -5.6, z(36.5), 4.6, 2.4, 6, 1.8)], mat: c, id: 'acc' }, { prims: [S.capsule(-3.6, -3.2, z(44), -3.6, 3.6, z(40), 0.8), S.capsule(3.6, -3.2, z(44), 3.6, 3.6, z(40), 0.8)], mat: [c, 0.5], id: 'straps' }];
    default: return [];
  }
}

// Itens de mão (comidas e bebidas)
export const HAND_ITEMS = {
  cafe: { name: 'Café', sips: 4 },
  cha: { name: 'Chá', sips: 4 },
  suco: { name: 'Suco de laranja', sips: 4 },
  refri: { name: 'Refrigerante', sips: 5 },
  agua: { name: 'Água', sips: 3 },
  sorvete: { name: 'Sorvete', sips: 5 },
  bolo: { name: 'Fatia de bolo', sips: 4 },
  pizza: { name: 'Fatia de pizza', sips: 4 },
  maca: { name: 'Maçã', sips: 3 },
  cookie: { name: 'Cookie', sips: 2 },
  pipoca: { name: 'Pipoca', sips: 5 },
  rosquinha: { name: 'Rosquinha', sips: 3 },
};

function buildHandItem(id, h) {
  const [x, y, zz] = h;
  const out = [];
  const add = (prims, mat) => out.push({ prims, mat, id: 'item' });
  switch (id) {
    case 'cafe': case 'cha':
      add([S.cyl(x, y + 1.6, zz - 1, zz + 3.6, 2.3, 0.5)], (a, b, c) => (c > zz + 3 ? (id === 'cafe' ? '#6a3f26' : '#c9853a') : '#f4f2ee'));
      add([S.torusXZ(x + 2.3, y + 1.6, zz + 1.4, 1.2, 0.45)], '#f4f2ee');
      break;
    case 'suco': case 'agua':
      add([S.cyl(x, y + 1.6, zz - 1.5, zz + 4.2, 1.9, 0.3)], (a, b, c) => (c > zz + 3.7 ? '#ffffff' : id === 'suco' ? '#f3a64a' : '#bfe6ff'));
      break;
    case 'refri':
      add([S.cyl(x, y + 1.6, zz - 1.5, zz + 4.2, 1.8, 0.5)], (a, b, c) => (c > zz + 3.5 ? '#d8d6d0' : Math.abs(c - zz - 1.2) < 0.9 ? '#f4f2ee' : '#e2574c'));
      break;
    case 'sorvete':
      add([S.cone(x, y + 1.4, zz - 3, zz + 2, 0.4, 2)], '#d9a65e');
      add([S.sphere(x, y + 1.4, zz + 3.3, 2.5)], '#f08fa8');
      break;
    case 'bolo':
      add([S.rbox(x, y + 2, zz + 0.6, 1.8, 2.8, 1.8, 0.4)], (a, b, c) => (Math.abs(c - zz - 0.6) < 0.5 ? '#f4f2ee' : '#6a3f26'));
      break;
    case 'pizza':
      add([S.rbox(x, y + 2.4, zz + 0.4, 2.6, 3.2, 0.7, 0.5)], (a, b) => (b > y + 4.6 ? '#c9853a' : '#f7d65a'));
      break;
    case 'maca':
      add([S.sphere(x, y + 1.6, zz + 0.8, 2.4)], '#e2574c');
      add([S.capsule(x, y + 1.6, zz + 3, x + 0.4, y + 1.6, zz + 4.2, 0.4)], '#5a3b2b');
      break;
    case 'cookie':
      add([S.cyl(x, y + 1.6, zz - 0.2, zz + 1, 2.6, 0.4)], (a, b) => ((Math.floor(a * 1.7) + Math.floor(b * 1.7)) % 3 === 0 ? '#5a3b2b' : '#d9a65e'));
      break;
    case 'pipoca':
      add([S.cone(x, y + 1.6, zz - 2, zz + 3, 1.9, 2.6)], (a, b) => (Math.floor(Math.atan2(b - y - 1.6, a - x) * 2.2 + 9) % 2 ? '#e2574c' : '#f4f2ee'));
      add([S.bumpy(S.sphere(x, y + 1.6, zz + 3.6, 2.4), 0.6, (a, b, c) => Math.sin(a * 3) * Math.sin(b * 3) * Math.sin(c * 3))], '#fbeec0');
      break;
    case 'rosquinha':
      add([S.torus(x, y + 1.8, zz + 0.6, 2, 1.1)], (a, b, c) => (c > zz + 0.9 ? '#f08fa8' : '#d9a65e'));
      break;
    default:
  }
  return out;
}

// ------------------------------------------------------------ carimbos
const EYE = {
  front: ['KK', 'WK', 'WK'], // pupila virada para o lado de dentro
  side: ['K', 'K', 'K'],
  closed: ['..', 'KK'],
};
const pal = (look) => ({
  K: '#1e1620', W: '#ffffff', M: shadeHex(look.skin, 2.2), P: '#c94f6a', G: '#2a2a30', g: '#cfe8ff',
});

function stampFace(r, model, look, world, blink, lay) {
  const pl = pal(look);
  const camDot = (n) => {
    const [wx, wy] = world(n[0], n[1]);
    return (wx + wy + n[2]) / Math.sqrt(3);
  };
  // para onde o rosto aponta na tela (>0 direita, <0 esquerda)
  const [fx, fy] = world(0, 1);
  const look2 = fx - fy;
  const [hx, hy] = world(0, 0);
  const headSx = hx - hy;
  for (const st of model.stamps) {
    const vis = camDot(st.n);
    if (vis < 0.12) continue;
    const [x, y] = world(st.p[0], st.p[1]);
    const z = st.p[2];
    const outer = Math.sign(x - y - headSx) || 1; // lado de fora do rosto
    if (st.type === 'eye') {
      let rows;
      if (blink || lay) rows = ['..', 'KK'];
      else if (vis < 0.5) rows = ['K', 'K', 'K'];
      else if (Math.abs(look2) < 0.2) rows = outer < 0 ? ['KK', 'KW', 'KW'] : ['KK', 'WK', 'WK'];
      else rows = look2 > 0 ? ['KK', 'WK', 'WK'] : ['KK', 'KW', 'KW'];
      let ax = rows[0].length > 1 ? 1 : 0;
      if (model.F && !blink && !lay && rows[0].length > 1) {
        // cílio no canto de fora
        if (outer < 0) { rows = ['K' + rows[0], '.' + rows[1], '.' + rows[2]].map((q, i) => (i === 0 ? 'K' + q.slice(1) : q)); rows[0] = 'K' + rows[0].slice(1); ax += 1; }
        else rows = [rows[0] + 'K', rows[1] + '.', rows[2] + '.'];
      }
      r.map(x, y, z, rows, pl, { ax, ay: 1, bias: 3 });
    } else if (st.type === 'mouth') {
      const row = model.F ? 'PP' : 'MM';
      r.map(x, y, z, [vis < 0.55 ? row[0] : row], pl, { ax: look2 >= 0 ? 0 : 1, ay: 0, bias: 3 });
    } else if (st.type === 'glasses' && vis > 0.35) {
      const rows = Math.abs(look2) < 0.2
        ? ['GGGG.GGGG', 'G..GGG..G', 'GGGG.GGGG']
        : look2 > 0 ? ['GGGG.GGG', 'G..GG..G', 'GGGG.GGG'] : ['GGG.GGGG', 'G..GG..G', 'GGG.GGGG'];
      r.map(x, y, z, rows, pl, { ax: Math.floor(rows[0].length / 2) - (look2 > 0.2 ? 1 : look2 < -0.2 ? -1 : 0), ay: 2, bias: 5 });
    }
  }
}

// ------------------------------------------------------------ render
const cache = new Map();

export function lookKey(look) {
  return [look.gender, look.skin, look.hair, look.hairColor, look.hat, look.hatColor, look.top, look.topColor, look.bottom, look.bottomColor, look.shoes, look.shoesColor, look.acc, look.accColor].join('|');
}

// opts: { hand, blink, headOnly, cutBelow }
export function avatarSprite(look, pose, frame, dir, opts = {}) {
  const key = lookKey(look) + '#' + pose + frame + '#' + dir + '#' + (opts.hand || '') + (opts.blink ? 'b' : '') + (opts.headOnly ? 'h' : '') + (opts.cutBelow ?? '');
  let spr = cache.get(key);
  if (spr) return spr;
  const model = buildModel(look, pose === 'lay' ? 'stand' : pose, frame, opts.hand);
  const headIds = new Set(['head', 'hair', 'hat', 'hatcuff', 'pom', 'brim', 'btn', 'tie', 'band', 'cups', 'ring', 'acc', 'crown']);
  const parts = opts.headOnly ? model.parts.filter((p) => headIds.has(p.id)) : model.parts;
  const r = renderRig(parts, dir, opts.cutBelow, (rr, world) => stampFace(rr, model, look, world, opts.blink, pose === 'lay'));
  spr = r.finish({ outlineK: 2.2, contact: 2.5, ink: '#140e18', inkMix: 0.72 });
  spr.key = 'av' + key;
  cache.set(key, spr);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return spr;
}

export function clearAvatarCache() { cache.clear(); }

// Rasteriza um "boneco" (lista de partes SDF em espaço local) numa das 8 direções.
export function renderRig(parts, dir, cutBelow, after) {
  const [fx0, fy0] = DIRS[dir];
  const fl = Math.hypot(fx0, fy0);
  const fx = fx0 / fl, fy = fy0 / fl;
  // local (x = direita, y = frente) → mundo
  const world = (lx, ly) => [lx * -fy + ly * fx, lx * fx + ly * fy];
  const local = (wx, wy) => [-wx * fy + wy * fx, wx * fx + wy * fy];
  const r = new Raster(-60, -130, 60, 30);
  for (const part of parts) {
    const prims = part.prims.map((p) => {
      const mat = p.mat ?? part.mat;
      const [x0, y0, z0, x1, y1, z1] = p.bb;
      const cs = [world(x0, y0), world(x1, y0), world(x0, y1), world(x1, y1)];
      const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
      const pc = part.cut;
      return {
        f: (x, y, z) => { const [a, b] = local(x, y); return p.f(a, b, z); },
        bb: [Math.min(...xs), Math.min(...ys), z0, Math.max(...xs), Math.max(...ys), z1],
        mat: typeof mat === 'function' ? (x, y, z, nx, ny, nz, k) => { const [a, b] = local(x, y); return mat(a, b, z, nx, ny, nz, k); } : mat,
        cut: pc || cutBelow != null ? (x, y, z) => (cutBelow != null && z < cutBelow) || (pc && pc(...local(x, y), z)) : undefined,
      };
    });
    r.sdf(prims, { blend: part.blend || 0 });
  }
  if (after) after(r, world);
  return r;
}
