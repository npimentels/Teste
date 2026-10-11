// Cache de sprites de mobília gerados pelo rasterizador.
import { Raster, outlineSprite } from './raster.js';
import { TILE } from './config.js';

const cache = new Map();
const outlines = new Map();

export function furniKey(def, o) {
  return [def.id, o.rot | 0, o.state | 0, o.variant | 0, o.frame | 0, o.env || 'day',
    def.clock && o.time ? o.time.h + ':' + o.time.m : '', o.occupied ? 1 : 0, o.nb | 0].join('|');
}

export function furniSprite(def, o = {}) {
  const key = furniKey(def, o);
  let s = cache.get(key);
  if (s) return s;
  const m = def.wall ? def.size[0] + 32 : Math.max(def.size[0], def.size[1]) * TILE;
  const H = def.wall ? def.size[1] : def.h;
  const r = new Raster(-m - 64, -H - 80, m + 64, m + 64);
  const fp = def.wall ? [def.size[0], 0] : [def.size[0] * TILE, def.size[1] * TILE];
  r.setRot(def.wall ? (o.rot | 0) & 1 : o.rot | 0, fp[0], fp[1]);
  const variants = def.variants || ['#cccccc'];
  def.draw(r, {
    rot: o.rot | 0, back: !def.wall && (o.rot | 0) >= 2,
    state: o.state | 0, frame: o.frame | 0, env: o.env || 'day', time: o.time,
    color: variants[(o.variant | 0) % variants.length], occupied: !!o.occupied, fp, nb: o.nb | 0,
  });
  s = r.finish({ contact: 3 });
  s.key = key;
  cache.set(key, s);
  if (cache.size > 1500) cache.delete(cache.keys().next().value);
  return s;
}

export function outlineOf(spr, color) {
  const k = spr.key + color;
  let o = outlines.get(k);
  if (!o) {
    o = outlineSprite(spr, color);
    outlines.set(k, o);
  }
  return o;
}

// Ícone do catálogo: sprite centralizado num quadrado.
export function thumb(def, variant = 0, size = 56) {
  const spr = furniSprite(def, { variant, state: def.thumbState ?? (def.states && def.light && !def.food ? 1 : 0), env: 'day', time: { h: 10, m: 10 } });
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const fit = Math.min((size - 2) / spr.w, (size - 2) / spr.h);
  const sc = fit >= 2 ? 2 : fit >= 1 ? 1 : fit;
  ctx.imageSmoothingEnabled = sc < 1;
  ctx.imageSmoothingQuality = 'high';
  const w = spr.w * sc, h = spr.h * sc;
  ctx.drawImage(spr.canvas, Math.round((size - w) / 2), Math.round((size - h) / 2), w, h);
  return c;
}
