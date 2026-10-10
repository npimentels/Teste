/** Small math helpers shared across systems (no per-frame allocations). */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent exponential smoothing factor. */
export const dampFactor = (lambda: number, dt: number): number => 1 - Math.exp(-lambda * dt);
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, dampFactor(lambda, dt));

/** Deterministic PRNG (mulberry32) so procedural placement is stable between sessions. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng: () => number, lo: number, hi: number): number => lo + (hi - lo) * rng();

export const TAU = Math.PI * 2;

/** Shortest signed angular difference a→b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
