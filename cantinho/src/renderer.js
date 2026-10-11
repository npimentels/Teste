// Renderizador da cena: tudo é desenhado numa tela de baixa resolução
// (1 pixel de arte = 1 pixel do buffer) e depois ampliado por um fator inteiro,
// mantendo os pixels nítidos em qualquer tamanho de janela.

import { TILE, WALL_H, WALL_T, FLOOR_T, unproject } from './config.js';
import { Raster } from './raster.js';
import { furniSprite, outlineOf } from './sprites.js';
import { FURNI } from './furniture.js';
import { FLOOR_STYLES, WALL_STYLES } from './room.js';
import { avatarSprite, AVATAR_ANCHOR, petSprite, iconSprite } from './characters.js';
import { shadeHex, mix, hash, hexToRgb } from './color.js';
import { rotPoint } from './entities.js';

const ENV = {
  day: { ambient: null, halo: 0, shaft: 'rgba(255,244,214,', shaftA: 0.16 },
  dusk: { ambient: '#d9a6a0', halo: 0.18, shaft: 'rgba(255,170,110,', shaftA: 0.22 },
  night: { ambient: '#3a3f75', halo: 0.3, shaft: 'rgba(150,170,255,', shaftA: 0.07 },
};

// ------------------------------------------------------------ texturas
function floorTex(style, c) {
  const seam = 0.75;
  const ao = (u, v) => (u < 4 ? (4 - u) * 0.18 : 0) + (v < 4 ? (4 - v) * 0.18 : 0);
  switch (style) {
    case 'taco': return (u, v) => {
      const cx = Math.floor(u / 8), cy = Math.floor(v / 8);
      const lu = u - cx * 8, lv = v - cy * 8;
      const along = (cx + cy) % 2 ? lu : lv;
      if (Math.floor(lu) === 0 || Math.floor(lv) === 0) return seam + ao(u, v);
      return (Math.floor(along) % 3 === 0 ? 0.4 : (hash(cx, cy, Math.floor(along / 3)) - 0.5) * 0.5) + ao(u, v);
    };
    case 'xadrez': return (u, v) => {
      const odd = (Math.floor(u / 8) + Math.floor(v / 8)) % 2;
      if (Math.floor(u) % 8 === 0 || Math.floor(v) % 8 === 0) return [mix(c, '#ffffff', 0.4), 0.6 + ao(u, v)];
      return [odd ? c : (c === '#3c3546' ? '#e9e1d2' : mix(c, '#ffffff', 0.55)), ao(u, v)];
    };
    case 'carpete': return (u, v) => {
      const U = Math.floor(u), V = Math.floor(v);
      const d = (Math.abs((U % 16) - 8) + Math.abs((V % 16) - 8));
      return (d === 7 ? 0.35 : 0) + (hash(U, V) - 0.5) * 0.35 + ao(u, v);
    };
    case 'pedra': return (u, v) => {
      const row = Math.floor(v / 8);
      const uu = u + (row % 2) * 5;
      const col = Math.floor(uu / 10);
      if (Math.floor(v) % 8 === 0 || Math.floor(uu) % 10 === 0) return 1 + ao(u, v);
      return (hash(col, row, 5) - 0.5) * 0.8 + ao(u, v);
    };
    default: return (u, v) => {
      const row = Math.floor(v / 5);
      const off = hash(row, 1) * 40;
      const seg = Math.floor((u + off) / 36);
      if (Math.floor(v) % 5 === 0 || Math.floor(u + off) % 36 === 0) return seam + ao(u, v);
      const grain = Math.floor(u * 0.5 + hash(row, seg) * 9) % 7 === 0 ? 0.18 : 0;
      return (hash(row, seg, 3) - 0.5) * 0.55 + grain + ao(u, v);
    };
  }
}

function wallTex(style, c, side) {
  const soft = side === 'L' ? -0.55 : 0;
  const wood = '#a8744c';
  return (u, v) => {
    const U = Math.floor(u), V = Math.floor(v);
    if (V < 0) return [wood, 1 + soft];
    if (V < 4) return [wood, (V === 3 ? -0.5 : 0.3) + soft];
    if (V >= WALL_H - 3) return [mix(c, '#ffffff', 0.5), (V === WALL_H - 3 ? 0.8 : -0.2) + soft];
    switch (style) {
      case 'lambri':
        if (V < 24) return [wood, (U % 7 === 0 ? 0.55 : U % 7 === 1 ? -0.35 : 0) + soft];
        if (V < 27) return [wood, (V === 26 ? -0.6 : 0.15) + soft];
        return [c, (((U + (Math.floor(V / 9) % 2) * 6) % 12 === 0 && V % 9 === 4) ? 0.45 : 0) + soft];
      case 'listras':
        return [Math.floor(U / 6) % 2 ? c : mix(c, '#ffffff', 0.45), soft];
      case 'floral': {
        const gx = (U + (Math.floor(V / 10) % 2) * 7) % 14, gy = V % 10;
        if ((gx === 6 && (gy === 4 || gy === 6)) || (gy === 5 && (gx === 5 || gx === 7))) return [mix(c, '#ffffff', 0.7), soft];
        if (gx === 6 && gy === 5) return ['#f2b8c8', soft];
        if (gx === 7 && gy === 3) return [shadeHex(c, 1.2), soft];
        return [c, soft];
      }
      case 'tijolo': {
        const row = Math.floor(V / 5);
        const uu = U + (row % 2) * 5;
        if (V % 5 === 0 || uu % 10 === 0) return ['#e3d8c4', 0.4 + soft];
        return [c, (hash(Math.floor(uu / 10), row, 2) - 0.5) * 0.6 + soft];
      }
      default:
        return [c, (V === 4 ? 0.5 : 0) + soft];
    }
  };
}

// --------------------------------------------------------- ordenação 3D
function behind(a, b) {
  // after: desenhar depois de X | before: desenhar antes de X
  if (a.before === b.ref || b.after === a.ref) return true;
  if (a.after === b.ref || b.before === a.ref) return false;
  const A = a.box, B = b.box;
  if (A.x1 <= B.x0) return true;
  if (B.x1 <= A.x0) return false;
  if (A.y1 <= B.y0) return true;
  if (B.y1 <= A.y0) return false;
  if (A.z1 <= B.z0) return true;
  if (B.z1 <= A.z0) return false;
  return A.x0 + A.x1 + A.y0 + A.y1 < B.x0 + B.x1 + B.y0 + B.y1;
}

function sortScene(list) {
  const n = list.length;
  list.sort((a, b) => a.key - b.key);
  const indeg = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = list[i];
    for (let j = i + 1; j < n; j++) {
      const b = list[j];
      if (a.rx1 <= b.rx0 || b.rx1 <= a.rx0 || a.ry1 <= b.ry0 || b.ry1 <= a.ry0) continue;
      if (behind(a, b)) { adj[i].push(j); indeg[j]++; } else { adj[j].push(i); indeg[i]++; }
    }
  }
  const out = [], done = new Array(n).fill(false);
  while (out.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) { pick = i; break; }
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i]) { pick = i; break; }
    done[pick] = true;
    out.push(list[pick]);
    for (const j of adj[pick]) indeg[j]--;
  }
  return out;
}

const maskCache = new WeakMap();
function canvasMask(c) {
  let m = maskCache.get(c);
  if (!m) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    m = new Uint8Array(c.width * c.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    maskCache.set(c, m);
  }
  return m;
}

const glowCache = new Map();
function glowCanvas(spr) {
  let g = glowCache.get(spr.key);
  if (g !== undefined) return g;
  g = null;
  if (spr.glowMask && spr.glowMask.some((v) => v)) {
    g = document.createElement('canvas');
    g.width = spr.w;
    g.height = spr.h;
    const ctx = g.getContext('2d');
    const src = spr.canvas.getContext('2d').getImageData(0, 0, spr.w, spr.h);
    for (let i = 0; i < spr.glowMask.length; i++) if (!spr.glowMask[i]) src.data[i * 4 + 3] = 0;
    ctx.putImageData(src, 0, 0);
  }
  glowCache.set(spr.key, g);
  return g;
}

function diamondCanvas(color, fill) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 16;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    const half = y < 8 ? (y + 1) * 2 : (16 - y) * 2;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(16 - half, y, half * 2, 1);
    }
    ctx.fillStyle = color;
    ctx.fillRect(16 - half, y, 2, 1);
    ctx.fillRect(16 + half - 2, y, 2, 1);
  }
  return c;
}

// ------------------------------------------------------------- renderer
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.bctx = this.buf.getContext('2d');
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.halo = document.createElement('canvas');
    this.hctx = this.halo.getContext('2d');
    this.zoom = 3;
    this.zoomBias = 0;
    this.pan = [0, 0];
    this.dpr = 1;
    this.roomKey = '';
    this.drawn = [];
    this.diamonds = {
      hover: diamondCanvas('#fff6d8', 'rgba(255,246,216,0.12)'),
      ok: diamondCanvas('#7dffa0', 'rgba(125,255,160,0.25)'),
      bad: diamondCanvas('#ff6b6b', 'rgba(255,107,107,0.25)'),
      shadow: diamondCanvas('rgba(0,0,0,0)', 'rgba(36,20,40,0.2)'),
    };
  }

  resize(room) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    const rw = (room.w + room.d) * 16 + 32, rh = WALL_H + (room.w + room.d) * 8 + FLOOR_T + 24;
    // em tela retrato aceitamos cortar um pouco as laterais (dá para arrastar)
    const portrait = H > W * 1.2 ? 1.35 : 1;
    const fit = Math.floor(Math.min(((W * dpr) / rw) * portrait, ((H - 70) * dpr) / rh));
    this.zoom = Math.max(1, Math.min(8, fit + this.zoomBias));
    this.buf.width = Math.ceil(this.canvas.width / this.zoom);
    this.buf.height = Math.ceil(this.canvas.height / this.zoom);
    this.light.width = this.halo.width = this.buf.width;
    this.light.height = this.halo.height = this.buf.height;
    this.bg = null;
  }

  origin(room) {
    const minSx = -room.d * 16 - WALL_T, maxSx = room.w * 16 + WALL_T;
    const minSy = -WALL_H, maxSy = (room.w + room.d) * 8 + FLOOR_T;
    const ox = Math.round(this.buf.width / 2 - (minSx + maxSx) / 2 + this.pan[0]);
    const oy = Math.round(this.buf.height / 2 - (minSy + maxSy) / 2 - 12 / this.zoom * this.dpr + this.pan[1]);
    return [ox, oy];
  }

  // conversões
  clientToBuf(cx, cy) { return [(cx * this.dpr) / this.zoom, (cy * this.dpr) / this.zoom]; }
  worldToClient(x, y, z) {
    const [ox, oy] = this.o;
    return [((ox + x - y) * this.zoom) / this.dpr, ((oy + (x + y) / 2 - z) * this.zoom) / this.dpr];
  }
  bufToWorld(bx, by, z = 0) {
    const [ox, oy] = this.o;
    return unproject(bx - ox, by - oy, z);
  }

  roomLayer(room) {
    const key = JSON.stringify([room.w, room.d, room.floor, room.wall]);
    if (key === this.roomKey) return this.roomSpr;
    const fs = FLOOR_STYLES.find((f) => f.id === room.floor.style) || FLOOR_STYLES[0];
    const ws = WALL_STYLES.find((f) => f.id === room.wall.style) || WALL_STYLES[0];
    const fc = fs.colors[room.floor.color % fs.colors.length];
    const wc = ws.colors[room.wall.color % ws.colors.length];
    const W = room.w * TILE, D = room.d * TILE;
    const r = new Raster(-D - 24, -WALL_H - 24, W + 24, (W + D) / 2 + FLOOR_T + 24);
    const edge = (u, v) => [shadeHex(fc, 1.8), Math.floor(v) === FLOOR_T - 1 ? -1.2 : 0.2];
    r.box(0, 0, -FLOOR_T, W, D, FLOOR_T, fc, { tex: { top: floorTex(fs.id, fc), left: edge, right: edge } });
    const cap = () => ['#efe6d8', 0];
    const wl = wallTex(ws.id, wc, 'L'), wr = wallTex(ws.id, wc, 'R');
    r.box(-WALL_T, -WALL_T, -FLOOR_T, WALL_T, D + WALL_T, WALL_H + FLOOR_T, wc, {
      tex: { right: (u, v) => wl(u - WALL_T, v - FLOOR_T), top: cap, left: (u, v) => ['#d8ccba', v < FLOOR_T + 4 ? 0.8 : 0] },
    });
    r.box(0, -WALL_T, -FLOOR_T, W, WALL_T, WALL_H + FLOOR_T, wc, {
      tex: { left: (u, v) => wr(u, v - FLOOR_T), top: cap, right: (u, v) => ['#d8ccba', v < FLOOR_T + 4 ? 1 : 0.2] },
    });
    this.roomSpr = r.finish({ outlineK: 2.2 });
    this.roomKey = key;
    return this.roomSpr;
  }

  background() {
    if (this.bg) return this.bg;
    const c = document.createElement('canvas');
    c.width = this.buf.width;
    c.height = this.buf.height;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(c.width / 2, c.height * 0.45, 10, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7);
    g.addColorStop(0, '#3b2e4a');
    g.addColorStop(1, '#1b1524');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < c.width * c.height / 900; i++) {
      const x = Math.floor(hash(i, 1) * c.width), y = Math.floor(hash(i, 2) * c.height);
      ctx.fillStyle = hash(i, 3) > 0.8 ? 'rgba(255,240,200,0.35)' : 'rgba(200,180,255,0.15)';
      ctx.fillRect(x, y, 1, 1);
    }
    this.bg = c;
    return c;
  }

  envName(game) {
    return game.env;
  }

  // ---------------------------------------------------------------- frame
  render(game, t) {
    const { room } = game;
    const b = this.bctx;
    const o = (this.o = this.origin(room));
    const [ox, oy] = o;
    const env = game.env;
    const E = ENV[env];
    const now = new Date();
    const time = { h: now.getHours(), m: now.getMinutes() };
    this.drawn = [];
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.imageSmoothingEnabled = false;
    b.drawImage(this.background(), 0, 0);

    const L = this.roomLayer(room);
    this.roomPos = [ox - L.ax, oy - L.ay];
    b.drawImage(L.canvas, ...this.roomPos);

    const lights = [];
    const frameOf = (def, uid) => (def.frames ? Math.floor(t * (def.fps || 4) + uid * 0.37) % def.frames : 0);
    const P = (x, y, z) => [ox + x - y, oy + (x + y) / 2 - z];

    // --- mobis de parede
    const sel = game.selected, hov = game.hovered;
    for (const wi of room.wallItems) {
      if (game.placing && game.placing.uid === wi.uid) continue;
      const def = FURNI[wi.id];
      const spr = furniSprite(def, { rot: wi.wall === 'L' ? 1 : 0, state: wi.state, variant: wi.variant, frame: frameOf(def, wi.uid), env, time });
      const [wx, wy] = wi.wall === 'L' ? [0, wi.pos] : [wi.pos, 0];
      const [sx, sy] = P(wx, wy, wi.z);
      b.drawImage(spr.canvas, Math.round(sx - spr.ax), Math.round(sy - spr.ay));
      this.drawn.push({ kind: 'wall', ref: wi, spr, x: Math.round(sx - spr.ax), y: Math.round(sy - spr.ay) });
      if (def.light) {
        const l = def.light({ state: wi.state, color: def.variants[wi.variant % def.variants.length] });
        if (l) lights.push({ ...l, x: wi.wall === 'L' ? l.y : wx + l.x, y: wi.wall === 'L' ? wy + l.x : l.y, z: wi.z + l.z, uid: wi.uid });
      }
      if (def.id === 'janela' && !wi.state) this.shaft(game, wi, E, lights);
    }

    // --- marcações no piso
    if (game.placing && game.placing.target && !FURNI[game.placing.id].wall) {
      const pl = game.placing;
      const [fw, fd] = pl.rot & 1 ? [FURNI[pl.id].size[1], FURNI[pl.id].size[0]] : FURNI[pl.id].size;
      const dm = pl.valid ? this.diamonds.ok : this.diamonds.bad;
      for (let x = pl.target[0]; x < pl.target[0] + fw; x++)
        for (let y = pl.target[1]; y < pl.target[1] + fd; y++)
          if (room.inside(x, y)) { const [sx, sy] = P(x * TILE, y * TILE, 0); b.drawImage(dm, sx - 16, sy); }
    } else if (game.hoverTile && !game.placing) {
      const [x, y] = game.hoverTile;
      const [sx, sy] = P(x * TILE, y * TILE, 0);
      b.drawImage(this.diamonds.hover, sx - 16, sy);
    }

    // --- tapetes (camada plana)
    const objects = [];
    for (const it of room.items) {
      if (game.placing && game.placing.uid === it.uid) continue;
      const def = FURNI[it.id];
      const spr = furniSprite(def, { rot: it.rot, state: it.state, variant: it.variant, frame: frameOf(def, it.uid), env, time, occupied: it.occupied });
      const [sx, sy] = P(it.x * TILE, it.y * TILE, it.z);
      const dx = Math.round(sx - spr.ax), dy = Math.round(sy - spr.ay);
      if (def.light) {
        const l = def.light({ state: it.state, color: def.variants[it.variant % def.variants.length] });
        if (l) {
          const [lx, ly] = rotPoint([l.x, l.y], def.size, it.rot);
          lights.push({ ...l, x: it.x * TILE + lx, y: it.y * TILE + ly, z: it.z + l.z, uid: it.uid });
        }
      }
      if (def.flat) {
        b.drawImage(spr.canvas, dx, dy);
        this.drawn.push({ kind: 'furni', ref: it, spr, x: dx, y: dy, flat: true });
        continue;
      }
      const [fw, fd] = room.footprint(it);
      objects.push({
        kind: 'furni', ref: it, spr, x: dx, y: dy,
        box: { x0: it.x * TILE, x1: (it.x + fw) * TILE, y0: it.y * TILE, y1: (it.y + fd) * TILE, z0: it.z, z1: it.z + def.h },
        shadow: it.z === 0 ? [it.x, it.y, fw, fd] : null,
      });
    }

    // sombras de contato
    b.globalAlpha = 1;
    for (const ob of objects)
      if (ob.shadow) {
        const [x0, y0, fw, fd] = ob.shadow;
        for (let x = x0; x < x0 + fw; x++)
          for (let y = y0; y < y0 + fd; y++) { const [sx, sy] = P(x * TILE, y * TILE, 0); b.drawImage(this.diamonds.shadow, sx - 16, sy); }
      }

    // --- personagens
    const ents = [game.avatar, ...game.pets];
    for (const e of ents) {
      const isAv = e === game.avatar;
      let c, ax, ay;
      if (isAv) {
        c = avatarSprite(e.look, e.spritePose(), e.face.view, e.blink);
        ax = AVATAR_ANCHOR.x;
        ay = AVATAR_ANCHOR.y;
      } else {
        c = petSprite(e.kind, e.color, e.spritePose());
        ax = Math.floor(c.width / 2);
        ay = c.height - 1;
      }
      const flip = e.face.flip !== (!isAv && false);
      const [sx, sy] = P(e.x, e.y, e.z);
      if (!e.seat || e.pose !== 'lay') {
        const [shx, shy] = P(e.x, e.y, isAv ? 0 : e.z);
        b.fillStyle = 'rgba(36,20,40,0.28)';
        b.fillRect(Math.round(shx) - 5, Math.round(shy) - 1, 10, 3);
        b.fillRect(Math.round(shx) - 3, Math.round(shy) - 2, 6, 5);
      }
      const dx = Math.round(sx - (flip ? c.width - 1 - ax : ax)), dy = Math.round(sy - ay);
      const ob = {
        kind: isAv ? 'avatar' : 'pet', ref: e, canvas: c, flip, x: dx, y: dy,
        box: e.box(isAv ? 30 : 12, isAv ? 4 : 5),
      };
      if (isAv && e.seat) {
        const it = room.items.find((i) => i.uid === e.seat.uid);
        if (it) { if ((it.rot & 3) >= 2 && e.pose === 'sit') ob.before = it; else ob.after = it; }
      }
      if (!isAv && e.z > 0) {
        const bed = room.at(e.tx, e.ty).find((i) => FURNI[i.id].pet);
        if (bed) ob.after = bed;
      }
      objects.push(ob);
    }

    // --- fantasma de posicionamento
    let ghost = null;
    if (game.placing && game.placing.target) {
      const pl = game.placing, def = FURNI[pl.id];
      const spr = furniSprite(def, { rot: def.wall ? (pl.target[0] === 'L' ? 1 : 0) : pl.rot, state: pl.state || 0, variant: pl.variant, env, time });
      let sx, sy, box;
      if (def.wall) {
        const [wall, pos, z] = pl.target;
        [sx, sy] = wall === 'L' ? P(0, pos, z) : P(pos, 0, z);
      } else {
        const [x, y] = pl.target;
        [sx, sy] = P(x * TILE, y * TILE, pl.z || 0);
        const [fw, fd] = pl.rot & 1 ? [def.size[1], def.size[0]] : def.size;
        box = { x0: x * TILE, x1: (x + fw) * TILE, y0: y * TILE, y1: (y + fd) * TILE, z0: pl.z || 0, z1: (pl.z || 0) + def.h };
      }
      ghost = { kind: 'ghost', spr, x: Math.round(sx - spr.ax), y: Math.round(sy - spr.ay), box, ok: pl.valid };
      if (def.flat || def.wall) { b.globalAlpha = pl.valid ? 0.75 : 0.4; b.drawImage(spr.canvas, ghost.x, ghost.y); b.globalAlpha = 1; ghost = null; }
      else objects.push(ghost);
    }

    for (const ob of objects) {
      const w = ob.spr ? ob.spr.w : ob.canvas.width, h = ob.spr ? ob.spr.h : ob.canvas.height;
      ob.rx0 = ob.x; ob.ry0 = ob.y; ob.rx1 = ob.x + w; ob.ry1 = ob.y + h;
      ob.key = (ob.box.x0 + ob.box.x1 + ob.box.y0 + ob.box.y1) * 10 + ob.box.z0;
    }
    const sorted = sortScene(objects);

    for (const ob of sorted) {
      if (ob.kind === 'ghost') {
        b.globalAlpha = ob.ok ? 0.8 : 0.4;
        b.drawImage(ob.spr.canvas, ob.x, ob.y);
        b.globalAlpha = 1;
        continue;
      }
      if (ob.spr) b.drawImage(ob.spr.canvas, ob.x, ob.y);
      else if (ob.flip) {
        b.save();
        b.translate(ob.x + ob.canvas.width, ob.y);
        b.scale(-1, 1);
        b.drawImage(ob.canvas, 0, 0);
        b.restore();
      } else b.drawImage(ob.canvas, ob.x, ob.y);
      this.drawn.push(ob);
    }

    // --- contornos de seleção / hover
    for (const [target, color] of [[hov, '#fff6d8'], [sel, '#ffd35a']]) {
      if (!target || game.placing) continue;
      const d = this.drawn.find((x) => x.ref === target);
      if (!d) continue;
      if (d.spr) {
        const ol = outlineOf(d.spr, color);
        b.globalAlpha = target === sel ? 1 : 0.8;
        b.drawImage(ol.canvas, d.x - 1, d.y - 1);
        b.globalAlpha = 1;
      }
    }

    // --- iluminação
    this.lighting(game, E, lights, t, P);

    // brilhos emissivos por cima da luz
    if (E.ambient) for (const d of this.drawn) if (d.spr) { const g = glowCanvas(d.spr); if (g) b.drawImage(g, d.x, d.y); }

    // --- partículas
    for (const p of game.fx.list) {
      const ic = iconSprite(p.icon);
      const [sx, sy] = P(p.x, p.y, p.z);
      b.globalAlpha = Math.min(1, p.life * 2);
      b.drawImage(ic, Math.round(sx - ic.width / 2), Math.round(sy - ic.height));
    }
    b.globalAlpha = 1;

    // --- apresenta
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, this.buf.width * this.zoom, this.buf.height * this.zoom);
  }

  shaft(game, wi, E, lights) {
    // Feixe de luz da janela projetado no chão (sol entrando de cima/esquerda)
    const { room } = game;
    const pts = [];
    const w = 22, x0 = wi.pos + 4, zb = wi.z + 4, zt = wi.z + 30;
    const proj = (u, z) => {
      const depth = (z - 2) * 0.9;
      return wi.wall === 'L' ? [depth, u + depth * 0.35] : [u + depth * 0.35, depth];
    };
    const clampXY = ([x, y]) => [Math.min(x, room.w * TILE - 2), Math.min(y, room.d * TILE - 2)];
    for (const [u0, u1, z0, z1] of [[x0, x0 + w / 2 - 1, zb, zb + 12], [x0 + w / 2 + 1, x0 + w, zb, zb + 12], [x0, x0 + w / 2 - 1, zb + 14, zt], [x0 + w / 2 + 1, x0 + w, zb + 14, zt]])
      pts.push([proj(u0, z0), proj(u1, z0), proj(u1, z1), proj(u0, z1)].map(clampXY));
    lights.push({ shaft: pts, wall: wi.wall, wi, color: E.shaft, a: E.shaftA });
  }

  lighting(game, E, lights, t, P) {
    const b = this.bctx, l = this.lctx;
    const W = this.buf.width, H = this.buf.height;
    const flick = (li) => (li.flicker ? 1 + Math.sin(t * 13 + li.uid) * 0.05 + Math.sin(t * 31 + li.uid * 2) * 0.03 : 1);
    const shafts = lights.filter((x) => x.shaft);
    const lamps = lights.filter((x) => !x.shaft);

    const drawShafts = (ctx, mul) => {
      for (const s of shafts) {
        for (const quad of s.shaft) {
          ctx.fillStyle = s.color + (s.a * mul).toFixed(3) + ')';
          ctx.beginPath();
          quad.forEach(([x, y], i) => { const [sx, sy] = P(x, y, 0); if (i) ctx.lineTo(Math.round(sx), Math.round(sy)); else ctx.moveTo(Math.round(sx), Math.round(sy)); });
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    if (!E.ambient) {
      b.globalCompositeOperation = 'lighter';
      drawShafts(b, 1);
      b.globalCompositeOperation = 'source-over';
      return;
    }
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = E.ambient;
    l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'lighter';
    for (const li of lamps) {
      const [sx, sy] = P(li.x, li.y, li.z);
      const r = li.r * flick(li);
      const [cr, cg, cb] = hexToRgb(li.color);
      const g = l.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
      g.addColorStop(0.45, `rgba(${cr},${cg},${cb},0.45)`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      l.fillStyle = g;
      l.beginPath();
      l.ellipse(sx, sy + r * 0.15, r, r * 0.75, 0, 0, Math.PI * 2);
      l.fill();
    }
    drawShafts(l, 2.2);
    // a luz só existe dentro do quarto (não vaza para o vazio)
    const room = this.roomSpr.canvas;
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(room, ...this.roomPos);
    b.globalCompositeOperation = 'multiply';
    b.drawImage(this.light, 0, 0);
    const hx = this.hctx;
    hx.globalCompositeOperation = 'source-over';
    hx.clearRect(0, 0, W, H);
    for (const li of lamps) {
      const [sx, sy] = P(li.x, li.y, li.z);
      const r = li.r * 0.35 * flick(li);
      const [cr, cg, cb] = hexToRgb(li.color);
      const g = hx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${E.halo})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      hx.fillStyle = g;
      hx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    drawShafts(hx, 0.6);
    hx.globalCompositeOperation = 'destination-in';
    hx.drawImage(room, ...this.roomPos);
    b.globalCompositeOperation = 'lighter';
    b.drawImage(this.halo, 0, 0);
    b.globalCompositeOperation = 'source-over';
  }

  // --------------------------------------------------------------- picking
  pick(bx, by) {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i];
      const w = d.spr ? d.spr.w : d.canvas.width, h = d.spr ? d.spr.h : d.canvas.height;
      let lx = Math.floor(bx - d.x), ly = Math.floor(by - d.y);
      if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
      if (d.flip) lx = w - 1 - lx;
      const mask = d.spr ? d.spr.mask : canvasMask(d.canvas);
      if (mask[ly * w + lx]) return d;
    }
    return null;
  }
}
