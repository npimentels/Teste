import * as THREE from 'three';
import type { QualityAware, QualityProfile, Updatable } from '../core/types';
import { damp } from '../core/math';

/** Sun, sky fill and the switchable accent light groups of each zone. */
export class LightingSystem implements QualityAware {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sunDir = new THREE.Vector3(-0.42, 0.78, 0.46).normalize();
  readonly sunColor = new THREE.Color(1.0, 0.96, 0.88);
  private readonly target = new THREE.Object3D();
  private shadowExtent = 34;

  constructor(private readonly scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xeef8ff, 0xc9dccb, 0.6);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(this.sunColor, 3.4);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -this.shadowExtent;
    cam.right = this.shadowExtent;
    cam.top = this.shadowExtent;
    cam.bottom = -this.shadowExtent;
    cam.near = 1;
    cam.far = 180;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.sun.target = this.target;
    scene.add(this.sun, this.target);
  }

  /** Keeps the shadow frustum centred on the player, snapped to texels to avoid shimmering. */
  follow(focus: THREE.Vector3): void {
    const size = this.sun.shadow.mapSize.x || 2048;
    const texel = (this.shadowExtent * 2) / size;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.sunDir.x * 90, this.sunDir.y * 90, fz + this.sunDir.z * 90);
    this.target.updateMatrixWorld();
  }

  applyQuality(profile: QualityProfile): void {
    this.sun.castShadow = profile.shadows;
    if (this.sun.shadow.mapSize.x !== profile.shadowMapSize) {
      this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
    this.scene.remove(this.sun, this.hemi, this.target);
  }
}

/**
 * A switchable set of lights + emissive materials that fade together (e.g. "atrium accent
 * lighting"). Point lights stay in the scene at intensity 0 so toggling never recompiles shaders.
 */
export class LightGroup implements Updatable {
  level = 1;
  target = 1;
  private readonly lights: Array<{ light: THREE.Light; base: number }> = [];
  private readonly emissives: Array<{ material: THREE.MeshStandardMaterial; base: number; off: number }> = [];
  private readonly uniforms: Array<{ uniform: THREE.IUniform<number>; on: number; off: number }> = [];
  private readonly visibles: THREE.Object3D[] = [];

  constructor(public readonly name: string, initiallyOn = true) {
    this.level = this.target = initiallyOn ? 1 : 0;
  }

  addLight(light: THREE.Light): this {
    this.lights.push({ light, base: light.intensity });
    return this;
  }

  addEmissive(material: THREE.MeshStandardMaterial, off = 0.05): this {
    this.emissives.push({ material, base: material.emissiveIntensity, off });
    return this;
  }

  addUniform(uniform: THREE.IUniform<number>, on: number, off: number): this {
    this.uniforms.push({ uniform, on, off });
    return this;
  }

  /** Objects (e.g. additive light cones) that are only shown when lit. */
  addVisible(obj: THREE.Object3D): this {
    this.visibles.push(obj);
    return this;
  }

  setActive(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  get active(): boolean {
    return this.target > 0.5;
  }

  update(dt: number): void {
    this.level = damp(this.level, this.target, 3.5, dt);
    if (Math.abs(this.level - this.target) < 0.001) this.level = this.target;
    this.apply();
  }

  apply(): void {
    const k = this.level;
    for (const l of this.lights) {
      l.light.intensity = l.base * k;
      l.light.visible = true;
    }
    for (const e of this.emissives) e.material.emissiveIntensity = e.off + (e.base - e.off) * k;
    for (const u of this.uniforms) u.uniform.value = u.off + (u.on - u.off) * k;
    for (const v of this.visibles) {
      v.visible = k > 0.02;
      const m = (v as THREE.Mesh).material as THREE.Material | undefined;
      if (m && 'opacity' in m && m.userData.baseOpacity !== undefined) (m as THREE.Material & { opacity: number }).opacity = m.userData.baseOpacity * k;
    }
  }
}
