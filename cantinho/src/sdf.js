// Funções de distância com sinal (SDF) para formas orgânicas.
// Cada construtor devolve { f(x, y, z) → distância, bb: [x0, y0, z0, x1, y1, z1] }.
// Coordenadas no mesmo espaço das mobílias: X/Y em unidades de chão, Z em px.

const { sqrt, abs, max, min } = Math;
export const len3 = (x, y, z) => sqrt(x * x + y * y + z * z);
const len2 = (x, y) => sqrt(x * x + y * y);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function sphere(cx, cy, cz, r) {
  return { f: (x, y, z) => len3(x - cx, y - cy, z - cz) - r, bb: [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r] };
}

export function ellipsoid(cx, cy, cz, rx, ry, rz) {
  return {
    f: (x, y, z) => {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = len3(px, py, pz);
      const k1 = len3(px / rx, py / ry, pz / rz) || 1e-6;
      return (k0 * (k0 - 1)) / k1;
    },
    bb: [cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz],
  };
}

// Caixa com cantos arredondados (centro + meias-medidas)
export function rbox(cx, cy, cz, hx, hy, hz, r = 0) {
  return {
    f: (x, y, z) => {
      const qx = abs(x - cx) - hx + r, qy = abs(y - cy) - hy + r, qz = abs(z - cz) - hz + r;
      return len3(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - r;
    },
    bb: [cx - hx, cy - hy, cz - hz, cx + hx, cy + hy, cz + hz],
  };
}

// Caixa por cantos (x, y, z, largura, profundidade, altura)
export const cbox = (x, y, z, w, d, h, r = 0) => rbox(x + w / 2, y + d / 2, z + h / 2, w / 2, d / 2, h / 2, r);

// Cápsula (possivelmente afunilada) entre a e b
export function capsule(ax, ay, az, bx, by, bz, ra, rb = ra) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L2 = dx * dx + dy * dy + dz * dz || 1e-6;
  const R = max(ra, rb);
  return {
    f: (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      const t = clamp((px * dx + py * dy + pz * dz) / L2, 0, 1);
      return len3(px - dx * t, py - dy * t, pz - dz * t) - (ra + (rb - ra) * t);
    },
    bb: [min(ax, bx) - R, min(ay, by) - R, min(az, bz) - R, max(ax, bx) + R, max(ay, by) + R, max(az, bz) + R],
  };
}

// Cilindro vertical com borda arredondada
export function cyl(cx, cy, z0, z1, r, rr = 0) {
  const hz = (z1 - z0) / 2, mz = (z0 + z1) / 2;
  return {
    f: (x, y, z) => {
      const d1 = len2(x - cx, y - cy) - r + rr, d2 = abs(z - mz) - hz + rr;
      return min(max(d1, d2), 0) + len2(max(d1, 0), max(d2, 0)) - rr;
    },
    bb: [cx - r, cy - r, z0, cx + r, cy + r, z1],
  };
}

// Tronco de cone vertical (raio r0 embaixo, r1 em cima)
export function cone(cx, cy, z0, z1, r0, r1) {
  const h = (z1 - z0) / 2, mz = (z0 + z1) / 2;
  const k1x = r1, k1y = h, k2x = r1 - r0, k2y = 2 * h;
  const k2l = k2x * k2x + k2y * k2y;
  const R = max(r0, r1);
  return {
    f: (x, y, z) => {
      const qx = len2(x - cx, y - cy), qy = z - mz;
      const cax = qx - min(qx, qy < 0 ? r0 : r1), cay = abs(qy) - h;
      const t = clamp(((k1x - qx) * k2x + (k1y - qy) * k2y) / k2l, 0, 1);
      const cbx = qx - k1x + k2x * t, cby = qy - k1y + k2y * t;
      const s = cbx < 0 && cay < 0 ? -1 : 1;
      return s * sqrt(min(cax * cax + cay * cay, cbx * cbx + cby * cby));
    },
    bb: [cx - R, cy - R, z0, cx + R, cy + R, z1],
  };
}

// Toro deitado (anel horizontal)
export function torus(cx, cy, cz, R, r) {
  return { f: (x, y, z) => len2(len2(x - cx, y - cy) - R, z - cz) - r, bb: [cx - R - r, cy - R - r, cz - r, cx + R + r, cy + R + r, cz + r] };
}

// Toro em pé, no plano XZ (alças, argolas)
export function torusXZ(cx, cy, cz, R, r) {
  return { f: (x, y, z) => len2(len2(x - cx, z - cz) - R, y - cy) - r, bb: [cx - R - r, cy - r, cz - R - r, cx + R + r, cy + r, cz + R + r] };
}

// Operações ----------------------------------------------------------
export const smin = (a, b, k) => {
  const h = max(k - abs(a - b), 0) / k;
  return min(a, b) - h * h * k * 0.25;
};

export function union(...ps) {
  return { f: (x, y, z) => { let d = Infinity; for (const p of ps) d = min(d, p.f(x, y, z)); return d; }, bb: bbUnion(ps.map((p) => p.bb)) };
}

export function blend(k, ...ps) {
  return { f: (x, y, z) => { let d = ps[0].f(x, y, z); for (let i = 1; i < ps.length; i++) d = smin(d, ps[i].f(x, y, z), k); return d; }, bb: bbUnion(ps.map((p) => p.bb)) };
}

export function subtract(a, b) {
  return { f: (x, y, z) => max(a.f(x, y, z), -b.f(x, y, z)), bb: a.bb };
}

export function intersect(a, b) {
  return { f: (x, y, z) => max(a.f(x, y, z), b.f(x, y, z)), bb: a.bb };
}

// Deforma a superfície (ruído, rugas, folhagem)
export function bumpy(p, amp, fn) {
  const [x0, y0, z0, x1, y1, z1] = p.bb;
  return { f: (x, y, z) => p.f(x, y, z) + amp * fn(x, y, z), bb: [x0 - amp, y0 - amp, z0 - amp, x1 + amp, y1 + amp, z1 + amp] };
}

export function bbUnion(bbs) {
  const o = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const b of bbs) for (let i = 0; i < 3; i++) { o[i] = min(o[i], b[i]); o[i + 3] = max(o[i + 3], b[i + 3]); }
  return o;
}

// Ruído de valor 3D suave (folhagem, pedras)
function h3(x, y, z) {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1442695041;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h3(xi, yi, zi), h3(xi + 1, yi, zi), u), l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), u), v),
    l(l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), u), l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
