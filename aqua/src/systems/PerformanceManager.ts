import type * as THREE from 'three';
import { QUALITY_PROFILES, type QualityAware, type QualityLevel, type QualityProfile } from '../core/types';

/**
 * Measures frame time, shows an optional overlay (FPS / draw calls / triangles) and applies
 * graphics profiles to the renderer and to every registered quality-aware system.
 */
export class PerformanceManager {
  fps = 60;
  frameMs = 16.7;
  profile: QualityProfile = QUALITY_PROFILES.high;
  private readonly overlay: HTMLDivElement;
  private accum = 0;
  private frames = 0;
  private worst = 0;
  private readonly targets: QualityAware[] = [];
  private resolutionScale = 1;

  constructor(private readonly renderer: THREE.WebGLRenderer, parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'fps-overlay';
    this.overlay.hidden = true;
    parent.appendChild(this.overlay);
  }

  register(target: QualityAware): void {
    this.targets.push(target);
    target.applyQuality(this.profile);
  }

  setVisible(v: boolean): void {
    this.overlay.hidden = !v;
  }

  setQuality(level: QualityLevel, resolutionScale: number): void {
    const prev = this.profile;
    this.profile = QUALITY_PROFILES[level];
    this.resolutionScale = resolutionScale;
    this.applyPixelRatio();
    const shadowsChanged = prev.shadows !== this.profile.shadows || this.renderer.shadowMap.enabled !== this.profile.shadows;
    this.renderer.shadowMap.enabled = this.profile.shadows;
    for (const t of this.targets) t.applyQuality(this.profile);
    if (shadowsChanged) this.renderer.shadowMap.needsUpdate = true;
  }

  applyPixelRatio(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.profile.maxPixelRatio);
    this.renderer.setPixelRatio(Math.max(0.35, dpr * this.resolutionScale));
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  frame(dtSeconds: number): void {
    this.accum += dtSeconds;
    this.frames++;
    this.worst = Math.max(this.worst, dtSeconds);
    if (this.accum >= 0.5) {
      this.fps = this.frames / this.accum;
      this.frameMs = (this.accum / this.frames) * 1000;
      if (!this.overlay.hidden) {
        const info = this.renderer.info;
        this.overlay.textContent =
          `${this.fps.toFixed(0)} FPS · ${this.frameMs.toFixed(1)} ms (pior ${(this.worst * 1000).toFixed(0)} ms)\n` +
          `${info.render.calls} draw calls · ${(info.render.triangles / 1000).toFixed(0)}k triângulos\n` +
          `Qualidade: ${this.profile.level === 'high' ? 'Alta' : 'Econômica'} · escala ${(this.resolutionScale * 100).toFixed(0)}% · DPR ${this.pixelRatio.toFixed(2)}`;
      }
      this.accum = 0;
      this.frames = 0;
      this.worst = 0;
    }
  }
}
