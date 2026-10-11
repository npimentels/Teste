// Cor com "hue shifting": tons claros puxam para o amarelo quente e tons
// escuros puxam para o azul/violeta — técnica clássica de pixel art que
// deixa o sombreamento vivo em vez de simplesmente "acinzentado".

const rgbCache = new Map();
const shadeCache = new Map();

export function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, c);
  return c;
}

export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function towards(h, target, amt) {
  let d = ((target - h + 540) % 360) - 180;
  if (Math.abs(d) < amt) return target;
  return h + Math.sign(d) * amt;
}

// k > 0 escurece, k < 0 clareia. Cada passo ≈ 8.5% de luminosidade.
export function shadeRgb(rgb, k) {
  if (k === 0) return rgb;
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  l = clamp(l - k * 0.085, 0.03, 0.97);
  h = towards(h, k > 0 ? 250 : 52, Math.min(Math.abs(k) * 7, 36));
  s = clamp(s + k * 0.03, 0, 1);
  return hslToRgb(h, s, l).map((v) => Math.round(clamp(v, 0, 255)));
}

export function shade(hex, k) {
  const key = hex + '|' + Math.round(k * 20);
  let c = shadeCache.get(key);
  if (!c) {
    c = shadeRgb(hexToRgb(hex), Math.round(k * 20) / 20);
    shadeCache.set(key, c);
  }
  return c;
}

export const shadeHex = (hex, k) => rgbToHex(...shade(hex, k));

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

// Hash determinístico 2D → [0,1) para texturas procedurais estáveis.
export function hash(x, y, seed = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
