import type { QualityLevel } from './types';

export interface GameSettings {
  /** Mouse sensitivity multiplier (1 = default). */
  sensitivity: number;
  invertY: boolean;
  /** Vertical field of view in degrees. */
  fov: number;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
  quality: QualityLevel;
  /** 0.5 – 1.0 multiplier on the device pixel ratio. */
  resolutionScale: number;
  /** 0 disables camera bob entirely, 1 = subtle default. */
  headBob: number;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  sensitivity: 1,
  invertY: false,
  fov: 75,
  musicVolume: 0.55,
  ambientVolume: 0.8,
  sfxVolume: 0.8,
  quality: 'high',
  resolutionScale: 1,
  headBob: 0.5,
  showFps: false,
});

const STORAGE_KEY = 'aqua-dream-of-tomorrow.settings.v1';

type Listener = (settings: Readonly<GameSettings>, changed: ReadonlyArray<keyof GameSettings>) => void;

/** Holds user preferences, persists them to localStorage (best effort) and notifies listeners. */
export class SettingsStore {
  private data: GameSettings;
  private listeners = new Set<Listener>();

  constructor() {
    this.data = { ...DEFAULT_SETTINGS, ...SettingsStore.load() };
    this.sanitize();
  }

  get(): Readonly<GameSettings> {
    return this.data;
  }

  set(patch: Partial<GameSettings>): void {
    const changed: (keyof GameSettings)[] = [];
    for (const key of Object.keys(patch) as (keyof GameSettings)[]) {
      const value = patch[key];
      if (value !== undefined && this.data[key] !== value) {
        (this.data as unknown as Record<string, unknown>)[key] = value;
        changed.push(key);
      }
    }
    if (changed.length === 0) return;
    this.sanitize();
    this.save();
    for (const l of this.listeners) l(this.data, changed);
  }

  reset(): void {
    this.set({ ...DEFAULT_SETTINGS });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private sanitize(): void {
    const d = this.data;
    const num = (v: unknown, lo: number, hi: number, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
    d.sensitivity = num(d.sensitivity, 0.1, 4, DEFAULT_SETTINGS.sensitivity);
    d.fov = num(d.fov, 55, 110, DEFAULT_SETTINGS.fov);
    d.musicVolume = num(d.musicVolume, 0, 1, DEFAULT_SETTINGS.musicVolume);
    d.ambientVolume = num(d.ambientVolume, 0, 1, DEFAULT_SETTINGS.ambientVolume);
    d.sfxVolume = num(d.sfxVolume, 0, 1, DEFAULT_SETTINGS.sfxVolume);
    d.resolutionScale = num(d.resolutionScale, 0.5, 1, DEFAULT_SETTINGS.resolutionScale);
    d.headBob = num(d.headBob, 0, 1, DEFAULT_SETTINGS.headBob);
    if (d.quality !== 'high' && d.quality !== 'economy') d.quality = DEFAULT_SETTINGS.quality;
    d.invertY = Boolean(d.invertY);
    d.showFps = Boolean(d.showFps);
  }

  private static load(): Partial<GameSettings> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Partial<GameSettings>) : {};
    } catch {
      return {};
    }
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable (private mode, quota) — preferences stay in memory */
    }
  }
}
