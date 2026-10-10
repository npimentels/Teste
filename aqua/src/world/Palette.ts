/**
 * AQUA visual language — the single source of truth for colour, contrast and lighting.
 *
 * Proportion rule (per view, roughly):
 *   ~55% porcelain / pearl whites  → architecture shells, ceilings, large floors
 *   ~25% blues                      → cobalt at human height (bands, frames, furniture),
 *                                     ocean in floor inlays & pools, cyan for light / acrylic
 *   ~12% greens                     → planting first, lime only as small accents
 *    ~8% chrome, glass and light    → edges, rails, fixtures, emissive strips
 *
 * Contrast rules:
 *   - Never put white on white without a separator: every white volume meets another through
 *     a chrome rail, a cobalt band or a shadow gap.
 *   - Cobalt is the "anchor" colour: use it low (0–1.2 m) and on frames so spaces read even
 *     when the sky is bright; keep it out of the ceiling.
 *   - Cyan is reserved for things that glow or are translucent (light, acrylic, water).
 *   - Lime is a highlight: ≤ 1 lime object per sight line (buttons, cushions, bins, signage dots).
 *   - Saturated colours stay glossy (clearcoat); matte surfaces stay neutral.
 */
export const PALETTE = {
  porcelain: 0xf5fbff,
  pearl: 0xe6eff4,
  ice: 0xb7eaf4,
  cyan: 0x28c5df,
  cyanGlow: 0x5fe8f5,
  ocean: 0x087dae,
  cobalt: 0x1747b5,
  cobaltDeep: 0x0d2f86,
  navy: 0x0b2f5c,
  lime: 0x9be22d,
  leaf: 0x64c98b,
  sand: 0xf1e6cf,
  maple: 0xe7c99a,
  chrome: 0xf2f6f8,
  ink: 0x0b4f6c,
} as const;

/** Lighting rules per kind of space. Values are blended smoothly when the player moves. */
export interface AmbienceProfile {
  /** Hemisphere (sky fill) intensity. Lower = more contrast, deeper shadows. */
  hemi: number;
  /** Scene environment (image based reflections / fill) intensity. */
  env: number;
  /** Sun intensity. */
  sun: number;
  /** Tone-mapping exposure. */
  exposure: number;
}

export const AMBIENCE: Record<'hall' | 'aquarium' | 'garden' | 'terrace' | 'open', AmbienceProfile> = {
  // Covered halls: sky fill comes through glass, keep it low so cobalt and shadows read.
  hall: { hemi: 0.42, env: 0.45, sun: 3.4, exposure: 0.98 },
  // Aquarium spaces: dim, cool; accent lights and caustics do the work.
  aquarium: { hemi: 0.3, env: 0.35, sun: 3.0, exposure: 1.08 },
  // Gardens: bright but not washed out.
  garden: { hemi: 0.55, env: 0.55, sun: 3.4, exposure: 0.98 },
  // Terrace: the "reward" view — a touch more exposure for the horizon.
  terrace: { hemi: 0.6, env: 0.6, sun: 3.5, exposure: 1.0 },
  open: { hemi: 0.58, env: 0.55, sun: 3.4, exposure: 0.98 },
};
