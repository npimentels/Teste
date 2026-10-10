export type ZoneId = 'atrium' | 'gardens' | 'gallery' | 'terrace' | 'exterior' | 'metro' | 'park' | 'market';

export type QualityLevel = 'high' | 'economy';

export interface QualityProfile {
  level: QualityLevel;
  shadows: boolean;
  shadowMapSize: number;
  maxPixelRatio: number;
  /** 1 = full detail water normals, 0 = simplified. */
  waterDetail: number;
  /** Multiplier on particle counts (applied via draw ranges). */
  particleScale: number;
  /** Fraction of grass / small plant instances drawn. */
  vegetationDensity: number;
  cloudOctaves: number;
  /** Use physical transmission on hero glass spheres. */
  transmission: boolean;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    level: 'high',
    shadows: true,
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    waterDetail: 1,
    particleScale: 1,
    vegetationDensity: 1,
    cloudOctaves: 5,
    transmission: true,
  },
  economy: {
    level: 'economy',
    shadows: false,
    shadowMapSize: 1024,
    maxPixelRatio: 1,
    waterDetail: 0,
    particleScale: 0.4,
    vegetationDensity: 0.35,
    cloudOctaves: 3,
    transmission: false,
  },
};

export interface Updatable {
  update(dt: number, time: number): void;
}

export interface QualityAware {
  applyQuality(profile: QualityProfile): void;
}
