// Rasterizador isométrico de sprites (v2).
//
// Cada mobília é "esculpida" com primitivas 3D e rasterizada pixel a pixel na
// projeção 2:1 do Habbo. Agora com:
//   • z-buffer: cada pixel guarda sua profundidade (x + y + z), então peças que
//     se cruzam ficam sempre na ordem certa
//   • transparência (vidro, água) desenhada por último, por cima do opaco
//   • formas orgânicas via SDF (almofadas, louças, folhagens, o avatar)
//   • luz única para tudo: topo claro, face esquerda média, direita escura
// e um pós-processamento com contorno colorido, linha de contato entre peças
// e brilho de aresta, que dão o acabamento das mobis do Habbo.

import { shade, hexToRgb, shadeRgb } from './color.js';

const FACE_K = { top: -0.9, left: 0, right: 1.15 };
const K_TOP = 1, K_LEFT = 2, K_RIGHT = 3, K_DETAIL = 4, K_SDF = 5;
const SQ3 = Math.sqrt(3);

// tom a partir da normal (mesma luz das caixas)
export function kNormal(nx, ny, nz) {
  return 1.15 * nx - 0.9 * nz + 0.1 * (1 - Math.abs(ny));
}
const posterize = (k) => Math.round(k * 3) / 3;

export class Raster {
  constructor(minX, minY, maxX, maxY) {
    this.ox = -Math.floor(minX);
    this.oy = -Math.floor(minY);
    this.w = Math.ceil(maxX) + this.ox;
    this.h = Math.ceil(maxY) + this.oy;
    const n = this.w * this.h;
    this.data = new Uint8ClampedArray(n * 4);
    this.depth = new Float32Array(n).fill(-Infinity);
    this.part = new Int16Array(n).fill(-1);
    this.kind = new Uint8Array(n);
    this.glow = new Uint8Array(n);
    this.rot = 0;
    this.fw = 32;
    this.fd = 32;
    this.parts = [];
  }

  // rot 0: frente para +Y | 1: frente para +X | 2: frente para -Y | 3: frente para -X
  setRot(rot, fw, fd) {
    this.rot = rot & 3;
    this.fw = fw;
    this.fd = fd;
    return this;
  }

  get swap() { return this.rot === 1 || this.rot === 3; }

  _tBox(x, y, w, d) {
    const { fw, fd } = this;
    switch (this.rot) {
      case 1: return [y, x, d, w];
      case 2: return [fw - x - w, fd - y - d, w, d];
      case 3: return [fd - y - d, fw - x - w, d, w];
      default: return [x, y, w, d];
    }
  }

  _tPt(x, y) {
    const { fw, fd } = this;
    switch (this.rot) {
      case 1: return [y, x];
      case 2: return [fw - x, fd - y];
      case 3: return [fd - y, fw - x];
      default: return [x, y];
    }
  }

  _inv(X, Y) {
    const { fw, fd } = this;
    switch (this.rot) {
      case 1: return [Y, X];
      case 2: return [fw - X, fd - Y];
      case 3: return [fw - Y, fd - X];
      default: return [X, Y];
    }
  }

  _tTex(t, w, d) {
    if (!t) return t;
    const r2 = () => ({
      top: t.top && ((u, v) => t.top(w - u, d - v)),
      left: t.back && ((u, v) => t.back(w - u, v)),
      right: (t.side0 || t.right) && ((u, v) => (t.side0 || t.right)(d - u, v)),
    });
    const sw = (q) => ({ top: q.top && ((u, v) => q.top(v, u)), left: q.right, right: q.left });
    switch (this.rot) {
      case 1: return sw(t);
      case 2: return r2();
      case 3: return sw(r2());
      default: return t;
    }
  }

  // ---------------------------------------------------------------- partes
  box(x, y, z, w, d, h, color, opt = {}) {
    const tex = this._tTex(opt.tex, w, d);
    [x, y, w, d] = this._tBox(x, y, w, d);
    this.parts.push({ t: 'box', x0: x, y0: y, z0: z, x1: x + w, y1: y + d, z1: z + h, color, tex, ...pick(opt) });
    return this;
  }

  lathe(cx, cy, z, profile, color, opt = {}) {
    [cx, cy] = this._tPt(cx, cy);
    if (opt.topTex && this.rot) {
      const t = opt.topTex, rot = this.rot;
      const m = rot === 1 ? (a, b) => [b, a] : rot === 2 ? (a, b) => [-a, -b] : (a, b) => [-b, -a];
      opt = { ...opt, topTex: (nx, ny, d, dist) => t(...m(nx, ny), d, dist) };
    }
    this.parts.push({ t: 'lathe', cx, cy, z0: z, profile, color, opt, ...pick(opt) });
    return this;
  }

  map(x, y, z, rows, pal, opt = {}) {
    [x, y] = this._tPt(x, y);
    const mirror = this.rot === 1 || this.rot === 2;
    const ax = opt.ax ?? Math.floor(rows[0].length / 2);
    const ay = opt.ay ?? rows.length - 1;
    this.parts.push({ t: 'map', x, y, z, rows, pal, ax, ay, flip: mirror !== !!opt.flip, ...pick(opt) });
    return this;
  }

  pts(list, opt = {}) {
    const L = list.map(([x, y, z, c]) => {
      const [a, b] = this._tPt(x + 0.5, y + 0.5);
      return [Math.floor(a), Math.floor(b), z, c];
    });
    this.parts.push({ t: 'pts', list: L, ...pick(opt) });
    return this;
  }

  // Formas SDF. prims: [{ f, bb, mat, glow, alpha }] em coordenadas de rotação 0.
  // mat: hex | (x, y, z, nx, ny, nz) → hex | [hex, k] | { raw } | número (k)
  sdf(prims, opt = {}) {
    if (!Array.isArray(prims)) prims = [prims];
    const W = prims.map((p) => {
      const [x0, y0, z0, x1, y1, z1] = p.bb;
      const c = [this._tPt(x0, y0), this._tPt(x1, y0), this._tPt(x0, y1), this._tPt(x1, y1)];
      const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]);
      const inv = (X, Y) => this._inv(X, Y);
      return {
        f: (X, Y, Z) => { const [x, y] = inv(X, Y); return p.f(x, y, Z); },
        loc: (X, Y) => inv(X, Y),
        bb: [Math.min(...xs) - 0.5, Math.min(...ys) - 0.5, z0 - 0.5, Math.max(...xs) + 0.5, Math.max(...ys) + 0.5, z1 + 0.5],
        mat: p.mat ?? opt.mat ?? '#cccccc', glow: p.glow ?? opt.glow, alpha: p.alpha ?? opt.alpha, cut: p.cut ?? opt.cut,
      };
    });
    this.parts.push({ t: 'sdf', prims: W, blend: opt.blend || 0, ...pick(opt) });
    return this;
  }

  // ---------------------------------------------------------------- escrita
  _put(px, py, rgb, pi, kind, glow, d, a = 1) {
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const i = py * this.w + px;
    if (d < this.depth[i] - 0.01) return;
    const o = i * 4;
    if (a < 1) {
      const da = this.data[o + 3] / 255;
      if (da > 0) {
        this.data[o] = rgb[0] * a + this.data[o] * (1 - a);
        this.data[o + 1] = rgb[1] * a + this.data[o + 1] * (1 - a);
        this.data[o + 2] = rgb[2] * a + this.data[o + 2] * (1 - a);
        this.data[o + 3] = Math.max(this.data[o + 3], 255 * a);
        return;
      }
      this.data[o] = rgb[0]; this.data[o + 1] = rgb[1]; this.data[o + 2] = rgb[2];
      this.data[o + 3] = 255 * a;
      this.part[i] = pi;
      this.kind[i] = kind;
      return;
    }
    this.data[o] = rgb[0];
    this.data[o + 1] = rgb[1];
    this.data[o + 2] = rgb[2];
    this.data[o + 3] = 255;
    this.depth[i] = d;
    this.part[i] = pi;
    this.kind[i] = kind;
    this.glow[i] = glow ? 1 : 0;
  }

  _spec(r, hex, k, glow) {
    if (r == null) return { rgb: shade(hex, glow ? Math.min(k, 0) * 0.35 : k), glow };
    if (typeof r === 'number') return this._spec(null, hex, k + r, glow);
    if (typeof r === 'string') return this._spec(null, r, k, glow);
    if (Array.isArray(r)) return this._spec(null, r[0], k + r[1], glow);
    if (r.raw) return { rgb: hexToRgb(r.raw), glow: true };
    if (r.skip) return null;
    return this._spec(null, hex, k, glow);
  }

  _faceColor(p, face, u, v) {
    const fn = p.tex && p.tex[face];
    return this._spec(fn ? fn(u, v) : null, p.color, FACE_K[face], p.glow);
  }

  _drawBox(p, pi) {
    const { x0, x1, y0, y1, z0, z1 } = p;
    const ox = this.ox, oy = this.oy, a = p.alpha ?? 1;
    // face direita (x = x1)
    for (let px = Math.floor(x1 - y1 + ox) - 1; px <= Math.ceil(x1 - y0 + ox); px++) {
      const y = x1 - (px + 0.5 - ox);
      if (y < y0 || y >= y1) continue;
      const base = (x1 + y) / 2;
      for (let py = Math.floor(base - z1 + oy) - 1; py <= Math.ceil(base - z0 + oy); py++) {
        const z = base - (py + 0.5 - oy);
        if (z < z0 || z >= z1) continue;
        const c = this._faceColor(p, 'right', y - y0, z - z0);
        if (c) this._put(px, py, c.rgb, pi, K_RIGHT, c.glow, x1 + y + z, a);
      }
    }
    // face esquerda (y = y1)
    for (let px = Math.floor(x0 - y1 + ox) - 1; px <= Math.ceil(x1 - y1 + ox); px++) {
      const x = px + 0.5 - ox + y1;
      if (x < x0 || x >= x1) continue;
      const base = (x + y1) / 2;
      for (let py = Math.floor(base - z1 + oy) - 1; py <= Math.ceil(base - z0 + oy); py++) {
        const z = base - (py + 0.5 - oy);
        if (z < z0 || z >= z1) continue;
        const c = this._faceColor(p, 'left', x - x0, z - z0);
        if (c) this._put(px, py, c.rgb, pi, K_LEFT, c.glow, x + y1 + z, a);
      }
    }
    // topo (z = z1)
    const minSx = x0 - y1, maxSx = x1 - y0;
    const minSy = (x0 + y0) / 2 - z1, maxSy = (x1 + y1) / 2 - z1;
    for (let py = Math.floor(minSy + oy) - 1; py <= Math.ceil(maxSy + oy); py++) {
      const s = py + 0.5 - oy + z1;
      for (let px = Math.floor(minSx + ox) - 1; px <= Math.ceil(maxSx + ox); px++) {
        const sx = px + 0.5 - ox;
        const x = s + sx / 2, y = s - sx / 2;
        if (x < x0 || x >= x1 || y < y0 || y >= y1) continue;
        const c = this._faceColor(p, 'top', x - x0, y - y0);
        if (c) this._put(px, py, c.rgb, pi, K_TOP, c.glow, x + y + z1, a);
      }
    }
  }

  _drawLathe(p, pi) {
    const { cx, cy, z0, profile, color, opt } = p;
    const scx = cx - cy + this.ox;
    const n = profile.length;
    const a = p.alpha ?? 1;
    for (let i = 0; i < n; i++) {
      const r = profile[i];
      if (r <= 0) continue;
      const z = z0 + i;
      const scy = (cx + cy) / 2 - z + this.oy;
      const isTop = i === n - 1 || profile[i + 1] <= 0;
      const A = r * Math.SQRT2 + 1, B = A / 2 + 1;
      for (let py = Math.floor(scy - B); py <= Math.ceil(scy + B); py++) {
        for (let px = Math.floor(scx - A); px <= Math.ceil(scx + A); px++) {
          const dsx = px + 0.5 - scx, dsy = py + 0.5 - scy;
          const ux = dsy + dsx / 2, uy = dsy - dsx / 2;
          const dist = Math.sqrt(ux * ux + uy * uy);
          if (dist > r) continue;
          const depth = cx + cy + z + ux + uy;
          let c, kind;
          if (isTop) {
            c = this._spec(opt.topTex ? opt.topTex(ux / r, uy / r, dist / r, dist) : null, color, FACE_K.top, p.glow);
            kind = K_TOP;
          } else {
            // normal lateral: do centro até a borda do disco
            const nx = ux / (dist || 1), ny = uy / (dist || 1);
            let k = posterize(kNormal(nx, ny, 0));
            if (opt.shiny && dsx < -A * 0.25 && dsx > -A * 0.6) k -= 1.1;
            c = this._spec(opt.sideTex ? opt.sideTex(nx, i, dsx / (A - 1), ny) : null, color, k, p.glow);
            kind = nx > ny ? K_RIGHT : K_LEFT;
          }
          if (c) this._put(px, py, c.rgb, pi, kind, c.glow, depth, a);
        }
      }
    }
  }

  _drawMap(p, pi) {
    const sx = Math.round(p.x - p.y + this.ox);
    const sy = Math.round((p.x + p.y) / 2 - p.z + this.oy);
    const d = p.after ? 1e6 : p.x + p.y + p.z + (p.bias ?? 2);
    const rows = p.rows;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        let hex = p.pal[ch];
        if (!hex) continue;
        let glow = false;
        if (hex[0] === '*') { glow = true; hex = hex.slice(1); }
        const dx = p.flip ? p.ax - i : i - p.ax;
        this._put(sx + dx, sy + j - p.ay, hexToRgb(hex), pi, K_DETAIL, glow, d);
      }
    }
  }

  _drawPts(p, pi) {
    for (const [x, y, z, c] of p.list) {
      let hex = c, glow = false;
      if (hex[0] === '*') { glow = true; hex = hex.slice(1); }
      this._put(Math.floor(x - y + this.ox), Math.floor((x + y) / 2 - z + this.oy), hexToRgb(hex), pi, K_DETAIL, glow, p.after ? 1e6 : x + y + z + 1);
    }
  }

  _drawSdf(p, pi) {
    const ox = this.ox, oy = this.oy;
    const prims = p.prims;
    // caixa de tela de cada primitiva
    for (const q of prims) {
      const [x0, y0, z0, x1, y1, z1] = q.bb;
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity, e = Infinity, f = -Infinity;
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
        const sx = x - y, sy = (x + y) / 2 - z, k = x + y + z;
        if (sx < a) a = sx; if (sx > b) b = sx;
        if (sy < c) c = sy; if (sy > d) d = sy;
        if (k < e) e = k; if (k > f) f = k;
      }
      q.s = [a, b, c, d, e, f];
    }
    let A = Infinity, B = -Infinity, Cc = Infinity, D = -Infinity;
    for (const q of prims) { A = Math.min(A, q.s[0]); B = Math.max(B, q.s[1]); Cc = Math.min(Cc, q.s[2]); D = Math.max(D, q.s[3]); }
    const blend = p.blend;
    const cands = [];
    const field = (x, y, z) => {
      let d = Infinity;
      for (const q of cands) {
        const v = q.f(x, y, z);
        d = blend && d < Infinity ? smin(d, v, blend) : Math.min(d, v);
      }
      return d;
    };
    for (let py = Math.floor(Cc + oy); py <= Math.ceil(D + oy); py++) {
      const sy = py + 0.5 - oy;
      for (let px = Math.floor(A + ox); px <= Math.ceil(B + ox); px++) {
        const sx = px + 0.5 - ox;
        cands.length = 0;
        let kTop = -Infinity, kBot = Infinity;
        for (const q of prims) {
          const s = q.s;
          if (sx < s[0] - 1 || sx > s[1] + 1 || sy < s[2] - 1 || sy > s[3] + 1) continue;
          cands.push(q);
          if (s[5] > kTop) kTop = s[5];
          if (s[4] < kBot) kBot = s[4];
        }
        if (!cands.length) continue;
        let k = kTop + 1, hit = false, x = 0, y = 0, z = 0;
        for (let it = 0; it < 90 && k > kBot - 1; it++) {
          const s = (2 / 3) * (k + sy);
          z = s / 2 - sy; x = (s + sx) / 2; y = (s - sx) / 2;
          const d = field(x, y, z);
          if (d < 0.2) { hit = true; break; }
          k -= Math.max(d * SQ3 * 0.9, 0.3);
        }
        if (!hit) continue;
        // material = primitiva mais próxima
        let best = cands[0], bd = Infinity;
        for (const q of cands) { const v = q.f(x, y, z); if (v < bd) { bd = v; best = q; } }
        if (best.cut && best.cut(x, y, z)) continue;
        const e = 0.45;
        let nx = field(x + e, y, z) - field(x - e, y, z);
        let ny = field(x, y + e, z) - field(x, y - e, z);
        let nz = field(x, y, z + e) - field(x, y, z - e);
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const kk = posterize(kNormal(nx, ny, nz));
        const [lx, ly] = best.loc(x, y);
        const r = typeof best.mat === 'function' ? best.mat(lx, ly, z, nx, ny, nz, kk) : best.mat;
        const spec = typeof r === 'string' ? this._spec(null, r, kk, best.glow) : this._spec(r, '#cccccc', kk, best.glow);
        if (!spec) continue;
        this._put(px, py, spec.rgb, pi, K_SDF, spec.glow, k, best.alpha ?? 1);
      }
    }
  }

  // ------------------------------------------------------------ finalização
  finish(opt = {}) {
    const opaque = [], glass = [], late = [];
    this.parts.forEach((p, i) => {
      p.idx = i;
      if (p.after) late.push(p);
      else if ((p.alpha ?? 1) < 1 || (p.t === 'sdf' && p.prims.some((q) => (q.alpha ?? 1) < 1))) glass.push(p);
      else opaque.push(p);
    });
    // vidro de trás para frente
    glass.sort((a, b) => depthOf(a) - depthOf(b));
    for (const p of [...opaque, ...glass, ...late]) {
      if (p.t === 'box') this._drawBox(p, p.idx);
      else if (p.t === 'lathe') this._drawLathe(p, p.idx);
      else if (p.t === 'sdf') this._drawSdf(p, p.idx);
      else if (p.t === 'pts') this._drawPts(p, p.idx);
      else this._drawMap(p, p.idx);
    }
    if (!opt.raw) this._post(opt);
    return this._crop();
  }

  _post(opt) {
    const { w, h, data, part, kind, glow, depth } = this;
    const src = new Uint8ClampedArray(data);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
    const outlineK = opt.outlineK ?? 2.4;
    const contact = opt.contact ?? 4;
    const ink = opt.ink ? hexToRgb(opt.ink) : hexToRgb('#2a1c26');
    const inkMix = opt.inkMix ?? 0.35;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const al = src[i * 4 + 3];
        if (!al || glow[i]) continue;
        const rgb = [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]];
        let k = 0;
        const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
        const edge = nb.some((j) => j < 0 || src[j * 4 + 3] === 0);
        if (edge) k = al < 255 ? 1.2 : outlineK;
        else if (al === 255) {
          const pi = part[i];
          if (nb.some((j) => part[j] !== pi && depth[j] > depth[i] + contact && !glow[j] && kind[j] !== K_DETAIL && src[j * 4 + 3] === 255)) k = 0.95;
          else if (kind[i] === K_TOP) {
            const below = at(x, y + 1);
            if (part[below] === pi && kind[below] !== K_TOP) k = -0.85;
          } else if (kind[i] === K_LEFT) {
            const right = at(x + 1, y);
            if (part[right] === part[i] && kind[right] === K_RIGHT) k = -0.5;
          }
        }
        if (k) {
          let c = shadeRgb(rgb, k);
          if (edge && ink) c = [c[0] + (ink[0] - c[0]) * inkMix, c[1] + (ink[1] - c[1]) * inkMix, c[2] + (ink[2] - c[2]) * inkMix];
          else if (k > 0.9 && ink) c = [c[0] + (ink[0] - c[0]) * inkMix * 0.5, c[1] + (ink[1] - c[1]) * inkMix * 0.5, c[2] + (ink[2] - c[2]) * inkMix * 0.5];
          data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2];
          if (edge && al < 255) data[i * 4 + 3] = Math.min(255, al + 90);
        }
      }
    }
  }

  _crop() {
    const { w, h, data } = this;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (data[(y * w + x) * 4 + 3]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
    if (maxX < 0) { minX = minY = 0; maxX = maxY = 0; }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(cw, ch);
    const mask = new Uint8Array(cw * ch);
    const glowMask = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      const srcRow = (y + minY) * w + minX;
      img.data.set(data.subarray(srcRow * 4, (srcRow + cw) * 4), y * cw * 4);
      for (let x = 0; x < cw; x++) {
        mask[y * cw + x] = data[(srcRow + x) * 4 + 3] > 40 ? 1 : 0;
        glowMask[y * cw + x] = this.glow[srcRow + x];
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, ax: this.ox - minX, ay: this.oy - minY, w: cw, h: ch, mask, glowMask };
  }
}

const pick = (o) => ({ glow: o.glow, after: o.after, alpha: o.alpha, bias: o.bias });
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
function depthOf(p) {
  if (p.t === 'box') return p.x0 + p.y0 + p.z0;
  if (p.t === 'lathe') return p.cx + p.cy + p.z0;
  if (p.t === 'sdf') return Math.min(...p.prims.map((q) => q.bb[0] + q.bb[1] + q.bb[2]));
  return 0;
}

// Sprite de contorno (hover/seleção) a partir da máscara.
export function outlineSprite(spr, color = '#ffffff') {
  const w = spr.w + 2, h = spr.h + 2;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const [r, g, b] = hexToRgb(color);
  const m = (x, y) => (x < 0 || y < 0 || x >= spr.w || y >= spr.h ? 0 : spr.mask[y * spr.w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x - 1, sy = y - 1;
      if (m(sx, sy)) continue;
      if (m(sx - 1, sy) || m(sx + 1, sy) || m(sx, sy - 1) || m(sx, sy + 1)) {
        const o = (y * w + x) * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
  ctx.putImageData(img, 0, 0);
  return { canvas: c, ax: spr.ax + 1, ay: spr.ay + 1 };
}
