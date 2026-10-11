// Rasterizador isométrico de sprites.
//
// Em vez de desenhar cada mobília à mão em PNG, cada peça é "esculpida" com
// primitivas 3D (caixas, sólidos de revolução e mapas de pixel) que são
// rasterizadas pixel a pixel na projeção 2:1. Isso garante linhas isométricas
// perfeitas, iluminação consistente (luz vindo da esquerda, como no Habbo) e
// rotação gratuita: girar 90° é só trocar X↔Y, reacendendo as faces.
//
// Depois da rasterização, um pós-processamento aplica:
//   • contorno escuro colorido na silhueta (sel-out)
//   • linha de contato entre peças (separa almofada do sofá, etc.)
//   • brilho na aresta frontal do topo e na quina vertical

import { shade, hexToRgb, shadeRgb } from './color.js';

// "k" de sombreamento base por face: topo claro, esquerda média, direita escura
const FACE_K = { top: -0.9, left: 0, right: 1.15 };
const K_TOP = 1, K_LEFT = 2, K_RIGHT = 3, K_DETAIL = 4;

export class Raster {
  constructor(minX, minY, maxX, maxY) {
    this.ox = -Math.floor(minX);
    this.oy = -Math.floor(minY);
    this.w = Math.ceil(maxX) + this.ox;
    this.h = Math.ceil(maxY) + this.oy;
    const n = this.w * this.h;
    this.data = new Uint8ClampedArray(n * 4);
    this.part = new Int16Array(n).fill(-1);
    this.kind = new Uint8Array(n);
    this.glow = new Uint8Array(n);
    this.rot = 0;
    this.fw = 16;
    this.fd = 16;
    this.parts = [];
  }

  // rot 0: frente para +Y | 1: frente para +X (troca X↔Y)
  // rot 2: frente para -Y (180°) | 3: frente para -X
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
  // Todas as primitivas aceitam coordenadas "de rotação 0"; com this.swap
  // o eixo X e Y são trocados (espelhamento com luz correta).

  box(x, y, z, w, d, h, color, opt = {}) {
    const tex = this._tTex(opt.tex, w, d);
    [x, y, w, d] = this._tBox(x, y, w, d);
    this.parts.push({
      t: 'box', x0: x, y0: y, z0: z, x1: x + w, y1: y + d, z1: z + h,
      color, tex, glow: opt.glow, after: opt.after, before: opt.before,
    });
    return this;
  }

  // Sólido de revolução: perfil = raio (em unidades) por pixel de altura,
  // de baixo para cima. topTex(nx, ny, dist) colore a tampa.
  lathe(cx, cy, z, profile, color, opt = {}) {
    [cx, cy] = this._tPt(cx, cy);
    if (opt.topTex && this.rot) {
      const t = opt.topTex, rot = this.rot;
      const m = rot === 1 ? (a, b) => [b, a] : rot === 2 ? (a, b) => [-a, -b] : (a, b) => [-b, -a];
      opt = { ...opt, topTex: (nx, ny, d, dist) => t(...m(nx, ny), d, dist) };
    }
    const rmax = Math.max(...profile);
    this.parts.push({
      t: 'lathe', cx, cy, z0: z, profile, color, opt,
      x0: cx - rmax, x1: cx + rmax, y0: cy - rmax, y1: cy + rmax, z1: z + profile.length,
      glow: opt.glow, after: opt.after, before: opt.before,
    });
    return this;
  }

  // Mapa de pixels 2D ancorado num ponto 3D. Linhas: string por linha,
  // cada caractere indexa pal (hex). '.' ou ' ' = transparente.
  // Valores de pal iniciados com '*' brilham (não recebem contorno/luz).
  map(x, y, z, rows, pal, opt = {}) {
    [x, y] = this._tPt(x, y);
    const mirror = this.rot === 1 || this.rot === 2;
    const ax = opt.ax ?? Math.floor(rows[0].length / 2);
    const ay = opt.ay ?? rows.length - 1;
    const r = opt.r ?? 3;
    this.parts.push({
      t: 'map', x, y, z, rows, pal, ax, ay, flip: mirror !== !!opt.flip,
      x0: x - r, x1: x + r, y0: y - r, y1: y + r, z0: z, z1: z + (opt.zh ?? rows.length),
      after: opt.after, before: opt.before,
    });
    return this;
  }

  // Pontos soltos [x, y, z, hex] — fios, varais de luz, detalhes finos.
  pts(list, opt = {}) {
    const L = list.map(([x, y, z, c]) => {
      const [a, b] = this._tPt(x + 0.5, y + 0.5);
      return [Math.floor(a), Math.floor(b), z, c];
    });
    const xs = L.map((p) => p[0]), ys = L.map((p) => p[1]), zs = L.map((p) => p[2]);
    this.parts.push({
      t: 'pts', list: L,
      x0: Math.min(...xs), x1: Math.max(...xs) + 1, y0: Math.min(...ys), y1: Math.max(...ys) + 1,
      z0: Math.min(...zs), z1: Math.max(...zs) + 1, after: opt.after, before: opt.before,
    });
    return this;
  }

  // ------------------------------------------------------------- escrita
  _put(px, py, rgb, pi, kind, glow) {
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
    const i = py * this.w + px;
    const o = i * 4;
    this.data[o] = rgb[0];
    this.data[o + 1] = rgb[1];
    this.data[o + 2] = rgb[2];
    this.data[o + 3] = 255;
    this.part[i] = pi;
    this.kind[i] = kind;
    this.glow[i] = glow ? 1 : 0;
  }

  _faceColor(p, face, u, v) {
    let k = FACE_K[face];
    let hex = p.color;
    const fn = p.tex && p.tex[face];
    if (fn) {
      const r = fn(u, v);
      if (r == null) {
        /* cor base */
      } else if (typeof r === 'number') k += r;
      else if (typeof r === 'string') hex = r;
      else if (Array.isArray(r)) { hex = r[0]; k += r[1]; }
      else if (r.raw) return { rgb: hexToRgb(r.raw), glow: true };
      else if (r.skip) return null;
    }
    if (p.glow) k = Math.min(k, 0) * 0.35;
    return { rgb: shade(hex, k), glow: !!p.glow };
  }

  _drawBox(p, pi) {
    const { x0, x1, y0, y1, z0, z1 } = p;
    const ox = this.ox, oy = this.oy;
    // face direita (x = x1)
    for (let px = Math.floor(x1 - y1 + ox) - 1; px <= Math.ceil(x1 - y0 + ox); px++) {
      const sx = px + 0.5 - ox;
      const y = x1 - sx;
      if (y < y0 || y >= y1) continue;
      const base = (x1 + y) / 2;
      for (let py = Math.floor(base - z1 + oy) - 1; py <= Math.ceil(base - z0 + oy); py++) {
        const z = base - (py + 0.5 - oy);
        if (z < z0 || z >= z1) continue;
        const c = this._faceColor(p, 'right', y - y0, z - z0);
        if (c) this._put(px, py, c.rgb, pi, K_RIGHT, c.glow);
      }
    }
    // face esquerda (y = y1)
    for (let px = Math.floor(x0 - y1 + ox) - 1; px <= Math.ceil(x1 - y1 + ox); px++) {
      const sx = px + 0.5 - ox;
      const x = sx + y1;
      if (x < x0 || x >= x1) continue;
      const base = (x + y1) / 2;
      for (let py = Math.floor(base - z1 + oy) - 1; py <= Math.ceil(base - z0 + oy); py++) {
        const z = base - (py + 0.5 - oy);
        if (z < z0 || z >= z1) continue;
        const c = this._faceColor(p, 'left', x - x0, z - z0);
        if (c) this._put(px, py, c.rgb, pi, K_LEFT, c.glow);
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
        if (c) this._put(px, py, c.rgb, pi, K_TOP, c.glow);
      }
    }
  }

  _drawLathe(p, pi) {
    const { cx, cy, z0, profile, color, opt } = p;
    const scx = cx - cy + this.ox;
    const n = profile.length;
    for (let i = 0; i < n; i++) {
      const r = profile[i];
      if (r <= 0) continue;
      const z = z0 + i;
      const scy = (cx + cy) / 2 - z + this.oy;
      const isTop = i === n - 1 || profile[i + 1] <= 0 || (opt.lid && i === n - 1);
      const a = r * Math.SQRT2 + 1;
      const b = a / 2 + 1;
      for (let py = Math.floor(scy - b); py <= Math.ceil(scy + b); py++) {
        for (let px = Math.floor(scx - a); px <= Math.ceil(scx + a); px++) {
          const dsx = px + 0.5 - scx, dsy = py + 0.5 - scy;
          const ux = dsy + dsx / 2, uy = dsy - dsx / 2;
          const dist = Math.sqrt(ux * ux + uy * uy);
          if (dist > r) continue;
          let rgb, glow = !!p.glow, kind = K_LEFT;
          if (isTop) {
            let hex = color, k = FACE_K.top;
            if (opt.topTex) {
              const t = opt.topTex(ux / r, uy / r, dist / r, dist);
              if (t == null) { /* base */ }
              else if (typeof t === 'number') k += t;
              else if (typeof t === 'string') hex = t;
              else if (Array.isArray(t)) { hex = t[0]; k += t[1]; }
              else if (t.raw) { rgb = hexToRgb(t.raw); glow = true; }
            }
            if (!rgb) rgb = shade(hex, glow ? k * 0.3 : k);
            kind = K_TOP;
          } else {
            const nx = dsx / (r * Math.SQRT2); // -1 esquerda … 1 direita
            let k = 0.45 + nx * 0.85 + Math.pow(Math.abs(nx), 4) * 0.6;
            if (opt.shiny && nx > -0.62 && nx < -0.32) k -= 1.1;
            let hex = color;
            if (opt.sideTex) {
              const t = opt.sideTex(nx, i, dsx);
              if (typeof t === 'number') k += t;
              else if (typeof t === 'string') hex = t;
              else if (Array.isArray(t)) { hex = t[0]; k += t[1]; }
            }
            if (glow) k *= 0.3;
            rgb = shade(hex, k);
            kind = nx < 0.15 ? K_LEFT : K_RIGHT;
          }
          this._put(px, py, rgb, pi, kind, glow);
        }
      }
    }
  }

  _drawMap(p, pi) {
    const sx = Math.round(p.x - p.y + this.ox);
    const sy = Math.round((p.x + p.y) / 2 - p.z + this.oy);
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
        this._put(sx + dx, sy + j - p.ay, hexToRgb(hex), pi, K_DETAIL, glow);
      }
    }
  }

  // ------------------------------------------------------------ ordenação
  static behind(a, b) {
    if (a.x1 <= b.x0) return true;
    if (b.x1 <= a.x0) return false;
    if (a.y1 <= b.y0) return true;
    if (b.y1 <= a.y0) return false;
    if (a.z1 <= b.z0) return true;
    if (b.z1 <= a.z0) return false;
    if (a.z1 !== b.z1) return a.z1 < b.z1;
    return a.x0 + a.y0 + a.z0 < b.x0 + b.y0 + b.z0;
  }

  _sorted() {
    const pre = this.parts.filter((p) => p.before);
    const post = this.parts.filter((p) => p.after);
    const mid = this.parts.filter((p) => !p.before && !p.after);
    return [...pre, ...topoSort(mid, Raster.behind), ...post];
  }

  // --------------------------------------------------------- finalização
  finish(opt = {}) {
    const order = this._sorted();
    order.forEach((p, i) => {
      if (p.t === 'box') this._drawBox(p, i);
      else if (p.t === 'lathe') this._drawLathe(p, i);
      else if (p.t === 'pts') {
        for (const [x, y, z, c] of p.list) {
          let hex = c, glow = false;
          if (hex[0] === '*') { glow = true; hex = hex.slice(1); }
          this._put(Math.floor(x - y + this.ox), Math.floor((x + y) / 2 - z + this.oy), hexToRgb(hex), i, K_DETAIL, glow);
        }
      } else this._drawMap(p, i);
    });
    if (!opt.raw) this._post(opt);
    return this._crop();
  }

  _post(opt) {
    const { w, h, data, part, kind, glow } = this;
    const src = new Uint8ClampedArray(data);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
    const outlineK = opt.outlineK ?? 2.6;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!src[i * 4 + 3] || glow[i]) continue;
        const rgb = [src[i * 4], src[i * 4 + 1], src[i * 4 + 2]];
        let k = 0;
        const nb = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
        const edge = nb.some((j) => j < 0 || !src[j * 4 + 3]);
        if (edge) k = outlineK;
        else {
          // linha de contato: este pixel está atrás de uma peça vizinha
          const pi = part[i];
          if (nb.some((j) => part[j] > pi && !glow[j] && kind[j] !== K_DETAIL)) k = 0.95;
          else if (kind[i] === K_TOP) {
            const below = at(x, y + 1);
            if (part[below] === pi && kind[below] !== K_TOP) k = -0.9;
          } else if (kind[i] === K_LEFT) {
            const right = at(x + 1, y);
            if (part[right] === part[i] && kind[right] === K_RIGHT) k = -0.55;
          }
        }
        if (k) {
          const c = shadeRgb(rgb, k);
          data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2];
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
        mask[y * cw + x] = data[(srcRow + x) * 4 + 3] ? 1 : 0;
        glowMask[y * cw + x] = this.glow[srcRow + x];
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas, ax: this.ox - minX, ay: this.oy - minY, w: cw, h: ch, mask, glowMask };
  }
}

// Ordenação topológica com quebra de ciclos (usada também pela cena).
export function topoSort(items, behind) {
  const n = items.length;
  if (n < 2) return items.slice();
  const indeg = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (behind(items[i], items[j])) { adj[i].push(j); indeg[j]++; }
      else if (behind(items[j], items[i])) { adj[j].push(i); indeg[i]++; }
    }
  const done = new Array(n).fill(false);
  const out = [];
  while (out.length < n) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0) { pick = i; break; }
    if (pick < 0) {
      // ciclo: escolhe o com menor grau de entrada
      let best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && indeg[i] < best) { best = indeg[i]; pick = i; }
    }
    done[pick] = true;
    out.push(items[pick]);
    for (const j of adj[pick]) indeg[j]--;
  }
  return out;
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
