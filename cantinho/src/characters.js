// Sprites de personagens (avatar e pets), desenhados à mão como mapas de pixel.
// Cada letra é um "papel" (pele, cabelo, camisa…) que é recolorido conforme o
// visual escolhido — assim um único desenho gera infinitas combinações.

import { shadeHex, mix } from './color.js';

const OUT = '#2a1f30';

// ------------------------------------------------------------------ avatar
// Tela do avatar: 20 x 34. Cabeça a partir da linha 7, corpo 21, pernas 28.
const AW = 20, AH = 34, HEAD_Y = 7, BODY_Y = 21, LEGS_Y = 28;

const HEAD_FRONT = [
  '................',
  '....QQQQQQQ.....',
  '..QQSSSSSSSQQ...',
  '.QSSSSSSSSSSSQ..',
  '.QSSSSSSSSSSSSQ.',
  'QSSSSSSSSSSSSSSQ',
  'QSSSSSSSSSSSSSSQ',
  'QSSSSSSSSSSSSSSQ',
  'QsSSSSSSESSSESSQ',
  'QsSSSSSSESSSESSQ',
  '.QsSSSSCSSSSCSQ.',
  '.QsSSSSSSSMSSSQ.',
  '..QQsSSSSSSSsQ..',
  '....QQQQQQQQ....',
];
const HEAD_BACK = HEAD_FRONT.map((r) => r.replace(/[ECM]/g, 'S'));

const HAIR = {
  curto: {
    front: [
      '....KKKKKKK.....',
      '..KKHHHHHHHKK...',
      '.KHHHiiiHHHHHK..',
      '.KHHiiHHHHHHHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHhHHHHHhHHHhHK',
      'KHhh..hh...h.hhK',
      'KHh...........hK',
      'Khh.............',
      '.Kh.............',
    ],
    back: [
      '....KKKKKKK.....',
      '..KKHHHHHHHKK...',
      '.KHHHiiiHHHHHK..',
      '.KHHiiHHHHHHHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHhHK',
      'KHHhHHHHHHHHhhHK',
      'KhHhhHHHHHHhhhhK',
      'KhhhhhHHHHhhhhhK',
      '.KhhhhhhhhhhhhK.',
      '.KKhhhhhhhhhhKK.',
    ],
  },
  longo: {
    front: [
      '....KKKKKKK.....',
      '..KKHHHHHHHKK...',
      '.KHHHiiiHHHHHK..',
      '.KHHiiHHHHHHHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHhHHHHHhHHHhHK',
      'KHhh..hh...h.hhK',
      'KHh...........hK',
      'KHh...........HK',
      'KHh...........HK',
      'KHhK.........KhK',
      'KhhK.........KhK',
      'KhhK.........KhK',
      'KhhK..........Kh',
      '.KhK...........K',
      '..K.............',
    ],
    back: [
      '....KKKKKKK.....',
      '..KKHHHHHHHKK...',
      '.KHHHiiiHHHHHK..',
      '.KHHiiHHHHHHHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHHHK',
      'KHHHHHHHHHHHHhHK',
      'KHHhHHHHHHHHhhHK',
      'KhHhhHHHHHHhhhhK',
      'KhhhhhHHHHhhhhhK',
      'KhhhhhhHHhhhhhhK',
      'KhhhhhhhhhhhhhhK',
      'KhhhhhhhhhhhhhhK',
      '.KhhhhhhhhhhhhK.',
      '.KhhhhhhhhhhhhK.',
      '..KKhhhhhhhhKK..',
      '....KKKKKKKK....',
    ],
  },
  coque: {
    top: [
      '......KKKK......',
      '.....KHiiHK.....',
      '.....KHHHhK.....',
      '......KhhK......',
    ],
  },
  cacheado: {
    front: [
      '...KK.KKK.KK....',
      '..KHHKHHHKHHK...',
      '.KHiHHHiHHHHHK..',
      'KHiHHHiHHHHiHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHhHHHHhHHHHhHK',
      'KHhHHhHHHhHHhHHK',
      'KHhh.hh.hh.hhhHK',
      'KHhK.........KhK',
      'KhHK..........hK',
      'KHhK...........K',
      '.KK.............',
    ],
    back: [
      '...KK.KKK.KK....',
      '..KHHKHHHKHHK...',
      '.KHiHHHiHHHHHK..',
      'KHiHHHiHHHHiHHK.',
      'KHHHHHHHHHHHHHHK',
      'KHHhHHHHhHHHHhHK',
      'KHhHHhHHHhHHhHHK',
      'KHHhHHhHHhHHhHHK',
      'KhHhhHHhHHhHhhhK',
      'KhhHhhHhhHhhHhhK',
      '.KhhhKhhhKhhhKK.',
      '..KK.KKK.KKK....',
    ],
  },
};
HAIR.coque.front = HAIR.curto.front;
HAIR.coque.back = HAIR.curto.back;

const HATS = {
  bruxa: [
    '..............KK....',
    '.............KPK....',
    '............KPPK....',
    '...........KPPPK....',
    '..........KPPPK.....',
    '.........KPPPPK.....',
    '........KPPPPPPK....',
    '.......KPPPPPPPPK...',
    '......KbbbbbbbbbK...',
    '....KKPPPPPPPPPPPKK.',
    '..KKPPPPPPPPPPPPPPPK',
    '.KpppppppppppppppppK',
    '..KKKKKKKKKKKKKKKK..',
  ],
  gorro: [
    '.........KK.........',
    '........KwwK........',
    '......KKKwKKK.......',
    '....KKBBBBBBBKK.....',
    '...KBBBBBBBBBBBK....',
    '..KBBdBBdBBdBBdBK...',
    '..KBBdBBdBBdBBdBBK..',
    '..KBdBBdBBdBBdBBdK..',
    '..KwwwwwwwwwwwwwwK..',
    '..KKKKKKKKKKKKKKKK..',
  ],
  flor: [
    '....................',
    '....................',
    '....................',
    '...........KK.KK....',
    '..........KppKppK...',
    '...........KyyK.....',
    '..........KppKppK...',
    '...........KK.KK....',
  ],
};
const HAT_Y = { bruxa: HEAD_Y - 7, gorro: HEAD_Y - 3, flor: HEAD_Y - 3 };

const BODY_FRONT = [
  '....OTTwwTTO....',
  '...OTTTTTTTTO...',
  '..OTTTTTTTTTtO..',
  '..OTtTTTTTTTtO..',
  '..OtOTTTTTTOtO..',
  '..OSOTTTTTTOSO..',
  '..OOOPPPPPPOOO..',
];
const BODY_BACK = BODY_FRONT.map((r, i) => (i === 0 ? '....OTTTTTTO....' : r));
const swingA = (b) => b.map((r, i) => (i === 4 ? '..OSOTTTTTTOtO..' : i === 5 ? '..OOOTTTTTTOSO..' : r));
const swingB = (b) => b.map((r, i) => (i === 4 ? '..OtOTTTTTTOSO..' : i === 5 ? '..OSOTTTTTTOOO..' : r));
const noRightArm = (b) => b.map((r, i) =>
  i === 2 ? '..OTTTTTTTTTO...' : i === 3 ? '..OTtTTTTTTTO...' : i === 4 ? '..OtOTTTTTTTO...' : i === 5 ? '..OSOTTTTTTTO...' : i === 6 ? '..OOOPPPPPPO....' : r);
const ARM_UP = [
  ['................OSO.', '................OSO.', '...............OtO..', '..............OtO...', '.............OTO....', '............OTTO....'],
  ['...............OSO..', '...............OSO..', '...............OtO..', '..............OtO...', '.............OTO....', '............OTTO....'],
];

const LEGS = {
  idle: ['....OPPpPPPO....', '....OPPOOPPO....', '....OPPOOPPO....', '....OBBOOBBBO...', '....OOO..OOOO...'],
  idleBack: ['....OPPpPPPO....', '....OPPOOPPO....', '....OPPOOPPO....', '....OBBOOBBO....', '....OOO..OOO....'],
  a: ['....OPPPPPPO....', '...OPPOOOPPO....', '...OPPO.OPPO....', '..OBBO..OBBBO...', '..OOO....OOOO...'],
  b: ['....OPPPPPPO....', '....OPPOOOPPO...', '....OPPO.OPPO...', '....OBBO..OBBBO.', '....OOO...OOOO..'],
  sit: ['...OPPPPPPPPO...', '...OPPPOOPPPO...', '...OBBBOOBBBO...', '...OOOO..OOOO...'],
};

export const LOOK_OPTIONS = {
  skin: ['#f6d4b8', '#eab38e', '#c98b62', '#9a6142', '#6b4130'],
  hair: ['#3b2a26', '#7a4a2e', '#d9a24c', '#e2683c', '#2f2f4a', '#c9c6dc', '#e07aa8', '#4f9a9a'],
  hairStyle: ['curto', 'longo', 'coque', 'cacheado'],
  shirt: ['#d96c7a', '#4b6aa3', '#7fa86b', '#d9a23b', '#8f7bc2', '#f1e4c6', '#3c3546', '#4a9a92', '#e2683c'],
  pants: ['#3c4a6b', '#5a3b2b', '#3c3546', '#7a6a58', '#4a7a5a', '#8f7bc2'],
  hat: ['nenhum', 'bruxa', 'gorro', 'flor'],
  hatColor: ['#5c4c8f', '#2f4a6b', '#d94f4f', '#3c3546', '#7fa86b'],
};

export const DEFAULT_LOOK = {
  name: 'Você', skin: '#eab38e', hair: '#7a4a2e', hairStyle: 'coque',
  shirt: '#d96c7a', pants: '#3c4a6b', hat: 'nenhum', hatColor: '#5c4c8f',
};

function avatarPalette(look, blink) {
  const s = look.skin, h = look.hair, t = look.shirt, p = look.pants, hc = look.hatColor;
  return {
    O: OUT, Q: mix(shadeHex(s, 1.5), OUT, 0.6), S: s, s: shadeHex(s, 1.1), C: mix(s, '#ff6f7d', 0.35),
    E: blink ? s : OUT, M: shadeHex(s, 2.4),
    K: shadeHex(h, 3), H: h, h: shadeHex(h, 1.2), i: shadeHex(h, -1.4),
    T: t, t: shadeHex(t, 1.2), w: mix(t, '#ffffff', 0.7),
    P: p, p: shadeHex(p, 1.4), B: '#3a2a2a',
    b: '#e8b34b', y: '#ffd35a',
    hat: { K: OUT, P: hc, p: shadeHex(hc, -0.9), b: '#e8b34b', B: hc, d: shadeHex(hc, 1.1), w: '#f3efe6', y: '#ffd35a' },
    flowerP: '#f08fb0',
  };
}

function stamp(ctx, rows, x, y, pal, blinkRow = -1) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      let ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      let c = pal[ch];
      if (ch === 'E' && j === blinkRow) c = pal.Q;
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));

const avatarCache = new Map();

// pose: stand | walk0..3 | sit | wave0/1 | dance0..3 | lay
export function avatarSprite(look, pose, view, blink = false) {
  const key = JSON.stringify(look) + pose + view + blink;
  let c = avatarCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const ctx = c.getContext('2d');
  const pal = avatarPalette(look, false);
  const back = view === 'back';

  let legs = back ? LEGS.idleBack : LEGS.idle;
  let body = back ? BODY_BACK : BODY_FRONT;
  let bob = 0, arm = null, armMirror = false;
  if (pose.startsWith('walk')) {
    const f = +pose[4];
    legs = [LEGS.a, back ? LEGS.idleBack : LEGS.idle, LEGS.b, back ? LEGS.idleBack : LEGS.idle][f];
    body = f === 0 ? swingA(body) : f === 2 ? swingB(body) : body;
    bob = f % 2 ? -1 : 0;
  } else if (pose === 'sit') {
    legs = LEGS.sit;
    bob = 1;
  } else if (pose.startsWith('wave')) {
    body = noRightArm(body);
    arm = ARM_UP[+pose[4] % 2];
  } else if (pose.startsWith('dance')) {
    const f = +pose[5];
    bob = f % 2 ? -1 : 0;
    if (f < 2) { body = noRightArm(body); arm = ARM_UP[f % 2]; }
    else { body = mirror(noRightArm(mirror(body))); arm = ARM_UP[f % 2]; armMirror = true; }
    legs = f % 2 ? LEGS.a : LEGS.b;
  }

  const lay = pose === 'lay';
  const off = lay ? 14 : 0; // deitado: só a cabeça, mais baixa
  if (!lay) {
    stamp(ctx, legs, 2, LEGS_Y + (pose === 'sit' ? 1 : 0), pal);
    stamp(ctx, body, 2, BODY_Y + bob, pal);
    if (arm) stamp(ctx, armMirror ? mirror(arm) : arm, 0, BODY_Y + bob - 4, pal);
  }
  const hy = HEAD_Y + bob + off;
  const style = HAIR[look.hairStyle] || HAIR.curto;
  stamp(ctx, back ? HEAD_BACK : HEAD_FRONT, 2, hy, pal, blink || lay ? 8 : -1);
  if (blink || lay) {
    // olho fechado = tracinho
    ctx.fillStyle = pal.s;
    for (const x of [10, 14]) ctx.fillRect(x, hy + 8, 1, 1);
  }
  if (look.hair !== 'none') {
    // cabelo longo atrás do corpo na vista frontal fica por cima dos ombros
    stamp(ctx, back ? style.back : style.front, 2, hy, pal);
    if (style.top && look.hat !== 'bruxa') stamp(ctx, style.top, 2, hy - 4, pal);
  }
  if (look.hat && look.hat !== 'nenhum' && HATS[look.hat] && !(lay && look.hat === 'bruxa')) {
    const hp = { ...pal.hat };
    if (look.hat === 'flor') { hp.p = '#f08fb0'; hp.y = '#ffd35a'; }
    stamp(ctx, back && look.hat === 'flor' ? mirror(HATS.flor) : HATS[look.hat], 0, HAT_Y[look.hat] + bob + off, hp);
  }
  avatarCache.set(key, c);
  return c;
}

export const AVATAR_ANCHOR = { x: 10, y: AH - 2 };

// -------------------------------------------------------------------- pets
const CAT = {
  stand: [
    '..........OO..OO',
    '..O.......OpOOpO',
    '.OaO......OaaaaO',
    '.OaO.....OaEaaEO',
    '..OaO....OaancaO',
    '..OaOOOOOOaaaaO.',
    '...OaaaaaaaaaaO.',
    '...OaaaaaaaacaO.',
    '...ObaaaaaaaccO.',
    '...ObO.ObO.OcO..',
    '...OO..OO..OO...',
  ],
  walk: [
    '..........OO..OO',
    '..O.......OpOOpO',
    '.OaO......OaaaaO',
    '.OaO.....OaEaaEO',
    '..OaO....OaancaO',
    '..OaOOOOOOaaaaO.',
    '...OaaaaaaaaaaO.',
    '...OaaaaaaaacaO.',
    '...ObaaaaaaaccO.',
    '..ObO..ObO.OcO..',
    '..OO....OO..OO..',
  ],
  sit: [
    '........OO..OO..',
    '........OpOOpO..',
    '........OaaaaO..',
    '.......OaEaaEO..',
    '.......OaancaO..',
    '..OO....OaaaO...',
    '.OaO...OaaaaaO..',
    '.OaO..OaaaaacO..',
    '..OaOOaaaaaccO..',
    '...OaaabaacccO..',
    '....OOOOOOOOO...',
  ],
  sleep: [
    '................',
    '................',
    '................',
    '................',
    '.....OOOOOO.....',
    '...OOaaaaaaOO.OO',
    '..OaaaaaaaaaaOpO',
    '.OaabaaaaaaaOaaO',
    '.OabaaaaaaaOa-aO',
    '.OaaOOOaaaaOacaO',
    '..OOcccOOOOOOOO.',
  ],
};

const DOG = {
  stand: [
    '...........OOOO...',
    '..........OaaaaO..',
    '..O......ObaaEaO..',
    '.OaO.....ObaaaacOO',
    '.OaO.....ObaaaccnO',
    '..OaO....OOaaaacO.',
    '...OaOOOOOkkkkkO..',
    '...OaaaaaaaaaaaO..',
    '...OaaaaaaaaaccO..',
    '...ObaaaaaaaacccO.',
    '...ObbaaaaaaacccO.',
    '...ObO.ObO..ObOcO.',
    '...OO..OO...OO.OO.',
  ],
  walk: [
    '...........OOOO...',
    '..........OaaaaO..',
    '.O.......ObaaEaO..',
    'OaO......ObaaaacOO',
    '.OaO.....ObaaaccnO',
    '..OaO....OOaaaacO.',
    '...OaOOOOOkkkkkO..',
    '...OaaaaaaaaaaaO..',
    '...OaaaaaaaaaccO..',
    '...ObaaaaaaaacccO.',
    '...ObbaaaaaaacccO.',
    '..ObO..ObO.ObO.OcO',
    '..OO...OO..OO..OO.',
  ],
  sit: [
    '..........OOOO....',
    '.........OaaaaO...',
    '........ObaaEaO...',
    '........ObaaaacOO.',
    '........ObaaaccnO.',
    '........OOaaaacO..',
    '..O......OkkkkO...',
    '.OaO....OaaaacO...',
    '..OaO..OaaaacccO..',
    '...OaOOaaaaacccO..',
    '...ObaaaaaaacccO..',
    '...ObbbaaaaOcOcO..',
    '....OOOOOOOOOOOO..',
  ],
  sleep: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..................',
    '.......OOOOOOO....',
    '.....OOaaaaaaaOOO.',
    '...OOaaaaaaaaObaaO',
    '..OaaaaaaaaaObaa-O',
    '..OabaaaaaaaObaacnO',
    '..ObbaaaaaaaaOcccO',
    '...OOOOOOOOOOOOOO.',
  ],
};
DOG.sleep[9] = '..OabaaaaaaaObaacO';

export const PET_KINDS = {
  cachorro: {
    name: 'Cachorro', art: DOG, sound: ['Au au!', 'Auuu~', 'Woof!', '*abana o rabo*'],
    colors: [
      { a: '#d29a5a', c: '#f6e2c4', n: 'Caramelo' },
      { a: '#4a4250', c: '#d9cfc4', n: 'Pretinho' },
      { a: '#efe8de', c: '#ffffff', n: 'Branquinho' },
      { a: '#9a8a7a', c: '#efe8de', n: 'Cinza' },
    ],
    names: ['Paçoca', 'Biscoito', 'Bolinha', 'Toddy', 'Pipoca', 'Thor', 'Mel'],
  },
  gato: {
    name: 'Gato', art: CAT, sound: ['Miau~', 'Mrrr...', 'Prrrr', '*boceja*'],
    colors: [
      { a: '#f0a050', c: '#fbe6c8', n: 'Laranja' },
      { a: '#9a9aa8', c: '#ecebf2', n: 'Cinza' },
      { a: '#3e3848', c: '#6e6478', n: 'Preto' },
      { a: '#f3ece0', c: '#ffffff', n: 'Branco' },
    ],
    names: ['Mingau', 'Frajola', 'Nina', 'Salém', 'Luna', 'Pantufa', 'Fumaça'],
  },
};

const petCache = new Map();
export function petSprite(kind, colorIdx, pose) {
  const key = kind + colorIdx + pose;
  let c = petCache.get(key);
  if (c) return c;
  const K = PET_KINDS[kind];
  const col = K.colors[colorIdx % K.colors.length];
  const rows = K.art[pose] || K.art.stand;
  const pal = {
    O: OUT, a: col.a, b: shadeHex(col.a, 1.2), c: col.c, n: '#2a1f30', E: OUT,
    p: '#f08fb0', k: '#d94f4f', '-': shadeHex(col.a, 2.4),
  };
  if (kind === 'gato') pal.n = '#f08fb0';
  c = document.createElement('canvas');
  c.width = rows[0].length + 2;
  c.height = rows.length;
  stamp(c.getContext('2d'), rows, 1, 0, pal);
  petCache.set(key, c);
  return c;
}

// ------------------------------------------------------------- partículas
export const ICONS = {
  heart: { rows: ['.OO.OO.', 'OrrOrrO', 'OrwrrrO', '.OrrrO.', '..OrO..', '...O...'], pal: { O: OUT, r: '#ff6b8a', w: '#ffd0dc' } },
  zzz: { rows: ['OOOO', '..O.', '.O..', 'OOOO'], pal: { O: '#e8eaff' } },
  note: { rows: ['..OO', '..OO', '..O.', 'OOO.', 'OOO.'], pal: { O: '#fff3c4' } },
  sparkle: { rows: ['..y..', '..y..', 'yyyyy', '..y..', '..y..'], pal: { y: '#fff6c8' } },
  smoke: { rows: ['.ss.', 'ssss', '.ss.'], pal: { s: '#d8d0e6' } },
};

const iconCache = new Map();
export function iconSprite(name) {
  let c = iconCache.get(name);
  if (c) return c;
  const ic = ICONS[name];
  c = document.createElement('canvas');
  c.width = ic.rows[0].length;
  c.height = ic.rows.length;
  stamp(c.getContext('2d'), ic.rows, 0, 0, ic.pal);
  iconCache.set(name, c);
  return c;
}

// Verificação de largura dos mapas (ajuda ao desenhar novos sprites)
export function validateArt() {
  const bad = [];
  const check = (name, rows) => rows.forEach((r, i) => { if (r.length !== rows[0].length) bad.push(`${name}[${i}] ${r.length}≠${rows[0].length}`); });
  check('HEAD_FRONT', HEAD_FRONT);
  for (const [k, v] of Object.entries(HAIR)) for (const [vk, rows] of Object.entries(v)) check(`HAIR.${k}.${vk}`, rows);
  for (const [k, v] of Object.entries(HATS)) check(`HAT.${k}`, v);
  check('BODY', BODY_FRONT);
  for (const [k, v] of Object.entries(LEGS)) check(`LEGS.${k}`, v);
  ARM_UP.forEach((a, i) => check('ARM' + i, a));
  for (const [k, v] of Object.entries(CAT)) check('CAT.' + k, v);
  for (const [k, v] of Object.entries(DOG)) check('DOG.' + k, v);
  return bad;
}
