// Renderizador da cena (escala Habbo: tile 64 × 32).
// Tudo é desenhado num buffer de baixa resolução (1 pixel de arte = 1 pixel)
// e ampliado por um fator inteiro, mantendo os pixels nítidos.

import { TILE, WALL_H, WALL_T, FLOOR_T, unproject } from './config.js';
import { Raster } from './raster.js';
import { furniSprite, outlineOf } from './sprites.js';
import { FURNI } from './furniture.js';
import { FLOOR_STYLES, WALL_STYLES } from './room.js';
import { avatarSprite } from './avatar.js';
import { petSprite } from './pets.js';
import { iconSprite } from './characters.js';
import { shadeHex, mix, hash, hexToRgb } from './color.js';
import { rotPoint } from './entities.js';
import { POOL } from './furni_jardim.js';
import * as S from './sdf.js';

const ENV = {
  day: { ambient: null, halo: 0, shaft: 'rgba(255,244,214,', shaftA: 0.14 },
  dusk: { ambient: '#dcb0a8', halo: 0.12, shaft: 'rgba(255,170,110,', shaftA: 0.2 },
  night: { ambient: '#4a5088', halo: 0.16, shaft: 'rgba(150,170,255,', shaftA: 0.06 },
};

// ------------------------------------------------------------ texturas
function floorTex(style, c) {
  switch (style) {
    case 'porcelanato': return (u, v) => {
      if (Math.floor(u) % 32 === 0 || Math.floor(v) % 32 === 0) return 0.45;
      const n = S.noise3(u * 0.07, v * 0.07, 3) * 5;
      const vein = Math.abs(Math.sin(u * 0.09 + v * 0.05 + n));
      return vein < 0.05 ? 0.5 : (S.noise3(u * 0.3, v * 0.3, 1) - 0.5) * 0.12;
    };
    case 'taco': return (u, v) => {
      const cx = Math.floor(u / 16), cy = Math.floor(v / 16);
      const lu = u - cx * 16, lv = v - cy * 16;
      const along = (cx + cy) % 2 ? lu : lv;
      if (Math.floor(lu) === 0 || Math.floor(lv) === 0) return 0.7;
      return Math.floor(along) % 5 === 0 ? 0.4 : (hash(cx, cy, Math.floor(along / 5)) - 0.5) * 0.45;
    };
    case 'xadrez': return (u, v) => {
      const odd = (Math.floor(u / 16) + Math.floor(v / 16)) % 2;
      if (Math.floor(u) % 16 === 0 || Math.floor(v) % 16 === 0) return [mix(c, '#ffffff', 0.4), 0.5];
      return [odd ? c : c === '#3c3546' ? '#e9e1d2' : mix(c, '#ffffff', 0.55), 0];
    };
    case 'carpete': return (u, v) => {
      const U = Math.floor(u), V = Math.floor(v);
      const d = Math.abs((U % 32) - 16) + Math.abs((V % 32) - 16);
      return (d === 15 ? 0.3 : 0) + (hash(U, V) - 0.5) * 0.3;
    };
    case 'pedra': return (u, v) => {
      const row = Math.floor(v / 14), uu = u + (row % 2) * 9, col = Math.floor(uu / 20);
      if (Math.floor(v) % 14 === 0 || Math.floor(uu) % 20 === 0) return 0.9;
      return (hash(col, row, 5) - 0.5) * 0.7;
    };
    case 'grama': return (u, v) => { const h = hash(Math.floor(u), Math.floor(v)); return h > 0.86 ? 0.45 : h < 0.12 ? -0.45 : 0; };
    default: return (u, v) => {
      const row = Math.floor(v / 9);
      const off = hash(row, 1) * 90;
      const seg = Math.floor((u + off) / 80);
      if (Math.floor(v) % 9 === 0 || Math.floor(u + off) % 80 === 0) return 0.7;
      const grain = Math.floor(u * 0.4 + hash(row, seg) * 9 + Math.sin(u * 0.08 + row) * 1.5) % 9 === 0 ? 0.18 : 0;
      return (hash(row, seg, 3) - 0.5) * 0.5 + grain;
    };
  }
}

function wallTex(style, c, side) {
  const soft = side === 'L' ? -0.55 : 0;
  const base = '#f4f2ee';
  return (u, v) => {
    const U = Math.floor(u), V = Math.floor(v);
    if (V < 0) return [base, 1 + soft];
    if (V < 9) return [base, (V === 8 ? -0.5 : V === 0 ? 0.6 : 0.1) + soft];
    if (V >= WALL_H - 5) return [mix(c, '#ffffff', 0.55), (V === WALL_H - 5 ? 0.7 : V === WALL_H - 3 ? -0.4 : 0) + soft];
    switch (style) {
      case 'lambri':
        if (V < 46) {
          const p = U % 26;
          if (V === 44 || V === 45) return [base, -0.3 + soft];
          if (V > 13 && V < 40 && p > 3 && p < 23) return [base, (p === 4 || V === 39 ? 0.5 : p === 22 || V === 14 ? -0.4 : 0.08) + soft];
          return [base, soft];
        }
        if (V < 49) return [base, (V === 48 ? -0.6 : 0.2) + soft];
        return [c, soft];
      case 'ripada':
        return [c, (U % 7 === 0 ? 0.9 : U % 7 === 1 ? -0.3 : (Math.floor(V * 0.3 + Math.sin(U) * 2) % 9 === 0 ? 0.15 : 0)) + soft];
      case 'marmore': {
        if (V % 40 === 0 || U % 32 === 0) return [c, 0.35 + soft];
        const n = S.noise3(u * 0.08, v * 0.08, 7) * 5;
        const vein = Math.abs(Math.sin(u * 0.07 + v * 0.11 + n));
        return [c, (vein < 0.05 ? 0.7 : vein < 0.12 ? 0.25 : 0) + soft];
      }
      case 'listras':
        return [Math.floor(U / 12) % 2 ? c : mix(c, '#ffffff', 0.45), soft];
      case 'floral': {
        const gx = (U + (Math.floor(V / 20) % 2) * 14) % 28, gy = V % 20;
        const d = Math.hypot(gx - 14, gy - 10);
        if (d < 1.5) return ['#f2b8c8', soft];
        if (d < 3.4 && Math.abs(Math.sin(Math.atan2(gy - 10, gx - 14) * 2.5)) > 0.5) return [mix(c, '#ffffff', 0.7), soft];
        if (gx === 18 && gy > 4 && gy < 8) return [shadeHex(c, 1.2), soft];
        return [c, soft];
      }
      case 'tijolo': {
        const row = Math.floor(V / 9), uu = U + (row % 2) * 9;
        if (V % 9 === 0 || uu % 18 === 0) return ['#e3d8c4', 0.4 + soft];
        return [c, (hash(Math.floor(uu / 18), row, 2) - 0.5) * 0.6 + soft];
      }
      default:
        return [c, (V === 9 ? 0.5 : 0) + soft];
    }
  };
}

// --------------------------------------------------------- ordenação 3D
function behind(a, b) {
  if ((a.before && a.before === b.ref) || (b.after && b.after === a.ref)) return true;
  if ((a.after && a.after === b.ref) || (b.before && b.before === a.ref)) return false;
  // paredes e mobis de parede ficam atrás de tudo que está na frente do plano
  if (a.plane != null && b.plane == null) { if (a.side === 'L' ? b.box.x0 >= a.plane - 0.5 : b.box.y0 >= a.plane - 0.5) return true; }
  if (b.plane != null && a.plane == null) { if (b.side === 'L' ? a.box.x0 >= b.plane - 0.5 : a.box.y0 >= b.plane - 0.5) return false; }
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

const glowCache = new Map();
function glowCanvas(spr) {
  let g = glowCache.get(spr.key);
  if (g !== undefined) return g;
  g = null;
  if (spr.glowMask && spr.glowMask.some((v) => v)) {
    g = document.createElement('canvas');
    g.width = spr.w;
    g.height = spr.h;
    const src = spr.canvas.getContext('2d').getImageData(0, 0, spr.w, spr.h);
    for (let i = 0; i < spr.glowMask.length; i++) if (!spr.glowMask[i]) src.data[i * 4 + 3] = 0;
    g.getContext('2d').putImageData(src, 0, 0);
  }
  glowCache.set(spr.key, g);
  return g;
}

function diamondCanvas(color, fill) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 32; y++) {
    const half = y < 16 ? (y + 1) * 2 : (32 - y) * 2;
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(32 - half, y, half * 2, 1); }
    if (color) { ctx.fillStyle = color; ctx.fillRect(32 - half, y, 2, 1); ctx.fillRect(32 + half - 2, y, 2, 1); }
  }
  return c;
}

function rippleCanvas() {
  const c = document.createElement('canvas');
  c.width = 34; c.height = 13;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(232,251,255,0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(17, 6.5, 15.5, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,251,255,0.35)';
  ctx.beginPath(); ctx.ellipse(17, 6.5, 12, 3.8, 0, 0, Math.PI * 2); ctx.stroke();
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
    this.zoom = 1;
    this.zoomBias = 0;
    this.pan = [0, 0];
    this.dpr = 1;
    this.layerKey = '';
    this.wallCache = new Map();
    this.drawn = [];
    this.diamonds = {
      hover: diamondCanvas('#fff6d8', 'rgba(255,246,216,0.12)'),
      ok: diamondCanvas('#7dffa0', 'rgba(125,255,160,0.25)'),
      bad: diamondCanvas('#ff6b6b', 'rgba(255,107,107,0.25)'),
      shadow: diamondCanvas(null, 'rgba(36,20,40,0.18)'),
      edit: diamondCanvas('rgba(255,246,216,0.5)', 'rgba(255,246,216,0.05)'),
    };
    this.ripple = rippleCanvas();
  }

  resize(room) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const W = window.innerWidth, H = window.innerHeight;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    const rw = (room.w + room.d) * 32 + 48, rh = WALL_H + (room.w + room.d) * 16 + FLOOR_T + 40;
    const portrait = H > W * 1.2 ? 1.4 : 1;
    const fit = Math.min(((W * dpr) / rw) * portrait, ((H - 80) * dpr) / rh);
    this.zoom = Math.max(1, Math.min(8, Math.max(1, Math.floor(fit + 0.15)) + this.zoomBias));
    this.buf.width = Math.ceil(this.canvas.width / this.zoom);
    this.buf.height = Math.ceil(this.canvas.height / this.zoom);
    this.light.width = this.halo.width = this.buf.width;
    this.light.height = this.halo.height = this.buf.height;
    this.bg = null;
  }

  origin(room) {
    const minSx = -room.d * TILE - WALL_T, maxSx = room.w * TILE + WALL_T;
    const minSy = -WALL_H, maxSy = (room.w + room.d) * 16 + FLOOR_T;
    const ox = Math.round(this.buf.width / 2 - (minSx + maxSx) / 2 + this.pan[0]);
    const oy = Math.round(this.buf.height / 2 - (minSy + maxSy) / 2 - (24 / this.zoom) * this.dpr + this.pan[1]);
    return [ox, oy];
  }

  clientToBuf(cx, cy) { return [(cx * this.dpr) / this.zoom, (cy * this.dpr) / this.zoom]; }
  worldToClient(x, y, z) {
    const [ox, oy] = this.o;
    return [((ox + x - y) * this.zoom) / this.dpr, ((oy + (x + y) / 2 - z) * this.zoom) / this.dpr];
  }
  bufToWorld(bx, by, z = 0) {
    const [ox, oy] = this.o;
    return unproject(bx - ox, by - oy, z);
  }

  // ------------------------------------------------------- piso e paredes
  styleColors(room) {
    const fs = FLOOR_STYLES.find((f) => f.id === room.floor.style) || FLOOR_STYLES[0];
    const ws = WALL_STYLES.find((f) => f.id === room.wall.style) || WALL_STYLES[0];
    return { fs, ws, fc: fs.colors[room.floor.color % fs.colors.length], wc: ws.colors[room.wall.color % ws.colors.length] };
  }

  floorLayer(room) {
    const key = JSON.stringify([room.w, room.d, room.tiles, room.floor, room.wall]);
    if (key === this.layerKey) return this.floorSpr;
    const { fs, fc } = this.styleColors(room);
    const W = room.w * TILE, D = room.d * TILE;
    const r = new Raster(-D - 32, -40, W + 32, (W + D) / 2 + FLOOR_T + 32);
    const tex = floorTex(fs.id, fc);
    const edge = (u, v) => [shadeHex(fc, 1.8), Math.floor(v) === FLOOR_T - 1 ? -1.2 : Math.floor(v) === 0 ? 0.5 : 0.2];
    for (let y = 0; y < room.d; y++)
      for (let x = 0; x < room.w; x++) {
        if (!room.hasTile(x, y)) continue;
        const wl = room.rowMin(y) === x, wr = room.colMin(x) === y;
        const ox = x * TILE, oy = y * TILE;
        r.box(ox, oy, -FLOOR_T, TILE, TILE, FLOOR_T, fc, {
          tex: {
            top: (u, v) => {
              let k = tex(u + ox, v + oy);
              const ao = (wl && u < 8 ? (8 - u) * 0.09 : 0) + (wr && v < 8 ? (8 - v) * 0.09 : 0);
              if (!ao) return k;
              if (typeof k === 'number') return k + ao;
              if (Array.isArray(k)) return [k[0], k[1] + ao];
              return k;
            },
            left: edge, right: edge,
          },
        });
      }
    this.floorSpr = r.finish({ outlineK: 2, contact: 999 });
    this.layerKey = key;
    this.maskKey = '';
    return this.floorSpr;
  }

  wallSprite(room, seg) {
    const { ws, wc } = this.styleColors(room);
    const key = [seg.side, seg.x, seg.y, seg.x1, seg.y1, ws.id, wc].join('|');
    let s = this.wallCache.get(key);
    if (s) return s;
    const T = WALL_T;
    const bx0 = seg.side === 'L' ? seg.plane - T : seg.x * TILE - T, bx1 = seg.side === 'L' ? seg.plane : seg.x1 * TILE;
    const by0 = seg.side === 'L' ? seg.y * TILE - T : seg.plane - T, by1 = seg.side === 'L' ? seg.y1 * TILE : seg.plane;
    const r = new Raster(bx0 - by1 - 4, (bx0 + by0) / 2 - WALL_H - 8, bx1 - by0 + 4, (bx1 + by1) / 2 + FLOOR_T + 8);
    const cap = () => ['#efe8dc', 0];
    const endc = (u, v) => ['#e6dccb', v < FLOOR_T + 9 ? 0.8 : 0];
    if (seg.side === 'L') {
      const X = seg.plane, y0 = seg.y * TILE;
      const wl = wallTex(ws.id, wc, 'L');
      r.box(X - T, y0 - T, -FLOOR_T, T, (seg.y1 - seg.y) * TILE + T, WALL_H + FLOOR_T, wc, { tex: { right: (u, v) => wl(u + y0 - T, v - FLOOR_T), top: cap, left: endc } });
    } else {
      const Y = seg.plane, x0 = seg.x * TILE;
      const wr = wallTex(ws.id, wc, 'R');
      r.box(x0 - T, Y - T, -FLOOR_T, (seg.x1 - seg.x) * TILE + T, T, WALL_H + FLOOR_T, wc, { tex: { left: (u, v) => wr(u + x0 - T, v - FLOOR_T), top: cap, right: (u, v) => ['#e6dccb', v < FLOOR_T + 9 ? 1 : 0.2] } });
    }
    s = r.finish({ outlineK: 1.8, contact: 999 });
    s.key = 'wall' + key;
    this.wallCache.set(key, s);
    if (this.wallCache.size > 400) this.wallCache.clear();
    return s;
  }

  // silhueta do quarto (piso + paredes) para recortar a luz
  roomMask(room) {
    const key = this.layerKey + '#' + room.version;
    if (key === this.maskKey) return this.mask;
    const f = this.floorSpr;
    const c = this.mask || document.createElement('canvas');
    const W = room.w * TILE, D = room.d * TILE;
    c.width = W + D + 120;
    c.height = (W + D) / 2 + WALL_H + 140;
    const ox = D + 60, oy = WALL_H + 60;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(f.canvas, ox - f.ax, oy - f.ay);
    for (const seg of room.walls()) { const s = this.wallSprite(room, seg); ctx.drawImage(s.canvas, ox - s.ax, oy - s.ay); }
    this.mask = c;
    this.maskO = [ox, oy];
    this.maskKey = key;
    return c;
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
    for (let i = 0; i < (c.width * c.height) / 1400; i++) {
      const x = Math.floor(hash(i, 1) * c.width), y = Math.floor(hash(i, 2) * c.height);
      ctx.fillStyle = hash(i, 3) > 0.8 ? 'rgba(255,240,200,0.35)' : 'rgba(200,180,255,0.15)';
      ctx.fillRect(x, y, 1, 1);
    }
    this.bg = c;
    return c;
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

    const F = this.floorLayer(room);
    b.drawImage(F.canvas, ox - F.ax, oy - F.ay);
    const P = (x, y, z) => [ox + x - y, oy + (x + y) / 2 - z];
    const lights = [];
    const frameOf = (def, uid) => (def.frames ? Math.floor(t * (def.fps || 4) + uid * 0.37) % def.frames : 0);
    const objects = [];
    const sel = game.selected, hov = game.hovered;

    // --- editor de planta: mostra os tiles possíveis
    if (game.editPlan) {
      for (let y = 0; y < room.d; y++) for (let x = 0; x < room.w; x++) {
        const [sx, sy] = P(x * TILE, y * TILE, 0);
        b.drawImage(room.hasTile(x, y) ? this.diamonds.edit : this.diamonds.shadow, sx - 32, sy);
      }
    }

    // --- paredes (entram na ordenação)
    for (const seg of room.walls()) {
      const s = this.wallSprite(room, seg);
      const box = seg.side === 'L'
        ? { x0: seg.plane - WALL_T, x1: seg.plane, y0: seg.y * TILE - WALL_T, y1: seg.y1 * TILE, z0: -FLOOR_T, z1: WALL_H }
        : { x0: seg.x * TILE - WALL_T, x1: seg.x1 * TILE, y0: seg.plane - WALL_T, y1: seg.plane, z0: -FLOOR_T, z1: WALL_H };
      objects.push({ kind: 'wallseg', spr: s, x: ox - s.ax, y: oy - s.ay, box, plane: seg.plane, side: seg.side, noPick: true });
    }

    // --- mobis de parede
    for (const wi of room.wallItems) {
      if (game.placing && game.placing.uid === wi.uid) continue;
      const def = FURNI[wi.id];
      const plane = room.wallPlane(wi.wall, wi.pos, def.size[0]);
      if (plane == null) continue;
      const spr = furniSprite(def, { rot: wi.wall === 'L' ? 1 : 0, state: wi.state, variant: wi.variant, frame: frameOf(def, wi.uid), env, time });
      const [wx, wy] = wi.wall === 'L' ? [plane, wi.pos] : [wi.pos, plane];
      const [sx, sy] = P(wx, wy, wi.z);
      const box = wi.wall === 'L'
        ? { x0: plane, x1: plane + 6, y0: wi.pos, y1: wi.pos + def.size[0], z0: wi.z, z1: wi.z + def.size[1] }
        : { x0: wi.pos, x1: wi.pos + def.size[0], y0: plane, y1: plane + 6, z0: wi.z, z1: wi.z + def.size[1] };
      objects.push({ kind: 'wall', ref: wi, spr, x: Math.round(sx - spr.ax), y: Math.round(sy - spr.ay), box, plane: plane + 0.01, side: wi.wall });
      if (def.light) {
        const l = def.light({ state: wi.state, color: def.variants[wi.variant % def.variants.length] });
        if (l) lights.push({ ...l, x: wi.wall === 'L' ? plane + l.y : wx + l.x, y: wi.wall === 'L' ? wy + l.x : plane + l.y, z: wi.z + l.z, uid: wi.uid });
      }
      if ((def.id === 'janela' && !wi.state) || def.id === 'janelao') this.shaft(room, wi, def, plane, E, lights);
    }

    // --- marcações no piso
    if (game.placing && game.placing.target && !FURNI[game.placing.id].wall && !game.placing.pet) {
      const pl = game.placing;
      const [fw, fd] = pl.rot & 1 ? [FURNI[pl.id].size[1], FURNI[pl.id].size[0]] : FURNI[pl.id].size;
      const dm = pl.valid ? this.diamonds.ok : this.diamonds.bad;
      for (let x = pl.target[0]; x < pl.target[0] + fw; x++)
        for (let y = pl.target[1]; y < pl.target[1] + fd; y++) { const [sx, sy] = P(x * TILE, y * TILE, 0); b.drawImage(dm, sx - 32, sy); }
    }

    // --- mobis de chão
    const flats = [];
    for (const it of room.items) {
      if (game.placing && game.placing.uid === it.uid) continue;
      const def = FURNI[it.id];
      const spr = furniSprite(def, { rot: it.rot, state: it.state, variant: it.variant, frame: frameOf(def, it.uid), env, time, occupied: it.occupied, nb: def.autotile ? room.poolMask(it.x, it.y) : 0 });
      const [sx, sy] = P(it.x * TILE, it.y * TILE, it.z);
      const dx = Math.round(sx - spr.ax), dy = Math.round(sy - spr.ay);
      if (def.light) {
        const l = def.light({ state: it.state, color: def.variants[it.variant % def.variants.length] });
        if (l) {
          const [lx, ly] = rotPoint([l.x, l.y], def.size, it.rot);
          lights.push({ ...l, x: it.x * TILE + lx, y: it.y * TILE + ly, z: it.z + l.z, uid: it.uid });
        }
      }
      if (def.flat) { flats.push({ kind: 'furni', ref: it, spr, x: dx, y: dy, flat: true }); continue; }
      const [fw, fd] = room.footprint(it);
      objects.push({
        kind: 'furni', ref: it, spr, x: dx, y: dy,
        box: { x0: it.x * TILE, x1: (it.x + fw) * TILE, y0: it.y * TILE, y1: (it.y + fd) * TILE, z0: it.z, z1: it.z + def.h },
        shadow: it.z === 0 && !def.small ? [it.x, it.y, fw, fd] : null,
      });
    }
    for (const f of flats) { b.drawImage(f.spr.canvas, f.x, f.y); this.drawn.push(f); }

    // cursor do tile (por cima dos tapetes)
    if (game.hoverTile && !game.placing) {
      const [x, y] = game.hoverTile;
      const [sx, sy] = P(x * TILE, y * TILE, 0);
      b.drawImage(this.diamonds.hover, sx - 32, sy);
    }
    // sombras de contato
    for (const ob of objects)
      if (ob.shadow) {
        const [x0, y0, fw, fd] = ob.shadow;
        for (let x = x0; x < x0 + fw; x++) for (let y = y0; y < y0 + fd; y++) { const [sx, sy] = P(x * TILE, y * TILE, 0); b.drawImage(this.diamonds.shadow, sx - 32, sy); }
      }

    // --- personagens
    const ripples = [];
    const ents = [game.avatar, ...game.pets];
    for (const e of ents) {
      const isAv = e === game.avatar;
      let spr;
      if (isAv) {
        const [pose, frame] = e.spritePose();
        const opts = { hand: e.hand && e.pose !== 'lay' ? e.hand.item : null, blink: e.blink };
        if (e.pose === 'lay') opts.headOnly = true;
        if (e.swimming) opts.cutBelow = POOL.surface - e.z;
        if (e.cut != null) opts.cutBelow = e.cut;
        spr = avatarSprite(e.look, pose, frame, e.dir, opts);
      } else {
        const [pose, frame] = e.spritePose();
        spr = petSprite(e.kind, e.color, pose, frame, e.dir);
      }
      const [sx, sy] = P(e.x, e.y, e.z);
      if (!e.swimming && e.pose !== 'lay' && !(isAv && e.cut != null)) {
        const [shx, shy] = P(e.x, e.y, isAv && e.pose !== 'sit' ? 0 : e.z);
        b.fillStyle = 'rgba(36,20,40,0.26)';
        b.beginPath();
        b.ellipse(Math.round(shx), Math.round(shy), isAv ? 12 : 10, isAv ? 5 : 4, 0, 0, Math.PI * 2);
        b.fill();
      }
      const ob = { kind: isAv ? 'avatar' : 'pet', ref: e, spr, x: Math.round(sx - spr.ax), y: Math.round(sy - spr.ay), box: e.box(isAv ? 72 : 22, isAv ? 7 : 8) };
      if (isAv && e.seat) {
        const it = e.seat.item;
        if ((it.rot & 3) >= 2 && e.pose === 'sit' && e.cut == null) ob.before = it; else ob.after = it;
      }
      if (!isAv && e.z > 0) {
        const bed = room.at(e.tx, e.ty).find((i) => FURNI[i.id].pet);
        if (bed) ob.after = bed;
      }
      if (e.swimming) {
        ob.box = { ...ob.box, z0: POOL.surface };
        const [rx, ry] = P(e.x, e.y, POOL.surface);
        ripples.push([rx, ry]);
      }
      objects.push(ob);
    }

    // --- fantasma de posicionamento
    if (game.placing && game.placing.target) {
      const pl = game.placing, def = FURNI[pl.id];
      if (pl.pet) {
        /* pets são adotados pela porta */
      } else {
        const spr = furniSprite(def, { rot: def.wall ? (pl.target[0] === 'L' ? 1 : 0) : pl.rot, state: pl.state || 0, variant: pl.variant, env, time, nb: def.autotile ? 0 : 0 });
        let sx, sy, box;
        if (def.wall) {
          const [side, pos, z] = pl.target;
          const plane = room.wallPlane(side, pos, def.size[0]) ?? 0;
          [sx, sy] = side === 'L' ? P(plane, pos, z) : P(pos, plane, z);
        } else {
          const [x, y] = pl.target;
          [sx, sy] = P(x * TILE, y * TILE, pl.z || 0);
          const [fw, fd] = pl.rot & 1 ? [def.size[1], def.size[0]] : def.size;
          box = { x0: x * TILE, x1: (x + fw) * TILE, y0: y * TILE, y1: (y + fd) * TILE, z0: pl.z || 0, z1: (pl.z || 0) + def.h };
        }
        const ghost = { kind: 'ghost', spr, x: Math.round(sx - spr.ax), y: Math.round(sy - spr.ay), box, ok: pl.valid, noPick: true };
        if (def.flat || def.wall) { b.globalAlpha = pl.valid ? 0.75 : 0.4; b.drawImage(spr.canvas, ghost.x, ghost.y); b.globalAlpha = 1; }
        else objects.push(ghost);
      }
    }

    for (const ob of objects) {
      ob.rx0 = ob.x; ob.ry0 = ob.y; ob.rx1 = ob.x + ob.spr.w; ob.ry1 = ob.y + ob.spr.h;
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
      b.drawImage(ob.spr.canvas, ob.x, ob.y);
      if (!ob.noPick) this.drawn.push(ob);
    }
    for (const [rx, ry] of ripples) b.drawImage(this.ripple, Math.round(rx - 17), Math.round(ry - 6));

    // --- contornos de seleção / hover
    for (const [target, color] of [[hov, '#fff6d8'], [sel, '#ffd35a']]) {
      if (!target || game.placing) continue;
      const d = this.drawn.find((x) => x.ref === target);
      if (!d) continue;
      const ol = outlineOf(d.spr, color);
      b.globalAlpha = target === sel ? 1 : 0.8;
      b.drawImage(ol.canvas, d.x - 1, d.y - 1);
      b.globalAlpha = 1;
    }

    this.lighting(room, E, lights, t, P);
    if (E.ambient) for (const d of this.drawn) { const g = glowCanvas(d.spr); if (g) b.drawImage(g, d.x, d.y); }

    // --- partículas
    for (const p of game.fx.list) {
      const ic = iconSprite(p.icon);
      const [sx, sy] = P(p.x, p.y, p.z);
      b.globalAlpha = Math.min(1, p.life * 2);
      b.drawImage(ic, Math.round(sx - ic.width / 2), Math.round(sy - ic.height));
    }
    b.globalAlpha = 1;

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, this.buf.width * this.zoom, this.buf.height * this.zoom);
  }

  shaft(room, wi, def, plane, E, lights) {
    const isBig = def.id === 'janelao';
    const [gx0, gx1, gz0, gz1] = isBig ? [3, 57, 3, 100] : [9, 51, 7, 62];
    const mid = (gx0 + gx1) / 2;
    const proj = (u, z) => {
      const depth = Math.max(4, (wi.z + z - 4) * 0.85);
      return wi.wall === 'L' ? [plane + depth, wi.pos + u + depth * 0.3] : [wi.pos + u + depth * 0.3, plane + depth];
    };
    const clampXY = ([x, y]) => [Math.min(x, room.w * TILE - 2), Math.min(y, room.d * TILE - 2)];
    const zm = (gz0 + gz1) / 2;
    const quads = [[gx0, mid - 1.5, gz0, zm - 1.5], [mid + 1.5, gx1, gz0, zm - 1.5], [gx0, mid - 1.5, zm + 1.5, gz1], [mid + 1.5, gx1, zm + 1.5, gz1]];
    lights.push({ shaft: quads.map(([u0, u1, z0, z1]) => [proj(u0, z0), proj(u1, z0), proj(u1, z1), proj(u0, z1)].map(clampXY)), color: E.shaft, a: E.shaftA });
  }

  lighting(room, E, lights, t, P) {
    const b = this.bctx, l = this.lctx;
    const W = this.buf.width, H = this.buf.height;
    const flick = (li) => (li.flicker ? 1 + Math.sin(t * 13 + li.uid) * 0.05 + Math.sin(t * 31 + li.uid * 2) * 0.03 : 1);
    const shafts = lights.filter((x) => x.shaft);
    const lamps = lights.filter((x) => !x.shaft);
    const drawShafts = (ctx, mul) => {
      for (const s of shafts)
        for (const quad of s.shaft) {
          ctx.fillStyle = s.color + (s.a * mul).toFixed(3) + ')';
          ctx.beginPath();
          quad.forEach(([x, y], i) => { const [sx, sy] = P(x, y, 0); if (i) ctx.lineTo(Math.round(sx), Math.round(sy)); else ctx.moveTo(Math.round(sx), Math.round(sy)); });
          ctx.closePath();
          ctx.fill();
        }
    };
    const mask = this.roomMask(room);
    const [mx, my] = this.maskO;
    const [ox, oy] = this.o;
    const mpos = [ox - mx, oy - my];
    if (!E.ambient) {
      const hx = this.hctx;
      hx.globalCompositeOperation = 'source-over';
      hx.clearRect(0, 0, W, H);
      drawShafts(hx, 1);
      hx.globalCompositeOperation = 'destination-in';
      hx.drawImage(mask, ...mpos);
      b.globalCompositeOperation = 'lighter';
      b.drawImage(this.halo, 0, 0);
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
    l.globalCompositeOperation = 'destination-in';
    l.drawImage(mask, ...mpos);
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
    hx.drawImage(mask, ...mpos);
    b.globalCompositeOperation = 'lighter';
    b.drawImage(this.halo, 0, 0);
    b.globalCompositeOperation = 'source-over';
  }

  // --------------------------------------------------------------- picking
  pick(bx, by) {
    for (let i = this.drawn.length - 1; i >= 0; i--) {
      const d = this.drawn[i];
      const lx = Math.floor(bx - d.x), ly = Math.floor(by - d.y);
      if (lx < 0 || ly < 0 || lx >= d.spr.w || ly >= d.spr.h) continue;
      if (d.spr.mask[ly * d.spr.w + lx]) return d;
    }
    return null;
  }

  // Ponto da parede sob o cursor: [lado, posição ao longo, altura] ou null
  wallAt(room, bx, by) {
    const [ox, oy] = this.o;
    const sx = bx - ox, sy = by - oy;
    let best = null;
    for (const seg of room.walls()) {
      if (seg.side === 'L') {
        const X = seg.plane, y = X - sx, z = (X + y) / 2 - sy;
        if (Math.floor(y / TILE) !== seg.y || z < -4 || z > WALL_H + 4) continue;
        const depth = X + y + z;
        if (!best || depth > best.depth) best = { side: 'L', along: y, z, depth };
      } else {
        const Y = seg.plane, x = sx + Y, z = (x + Y) / 2 - sy;
        if (Math.floor(x / TILE) !== seg.x || z < -4 || z > WALL_H + 4) continue;
        const depth = x + Y + z;
        if (!best || depth > best.depth) best = { side: 'R', along: x, z, depth };
      }
    }
    return best;
  }
}
