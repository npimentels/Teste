import * as THREE from 'three';
import { NOISE_GLSL, sharedTime } from './ShaderPatches';
import type { QualityAware, QualityProfile, Updatable } from '../core/types';
import { damp } from '../core/math';

const MAX_RIPPLES = 10;
const MAX_SOURCES = 10;

export interface WaterLook {
  shallow: THREE.ColorRepresentation;
  deep: THREE.ColorRepresentation;
  /** 0 = shallow pool, 1 = deep open water. */
  depth: number;
  opacity: number;
  waveAmp: number;
  /** Strength of the small-scale normal detail. */
  normalScale: number;
  /** Strength of the bright meniscus / foam line along the edges (0 for open sea). */
  edgeFoam?: number;
  /** World-space scale of the detail noise (bigger = finer ripples). */
  detailScale: number;
  /** Distance over which small ripples fade out (prevents sparkle / aliasing far away). */
  fadeDistance?: number;
}

export const WATER_LOOKS = {
  pool: { shallow: 0x5fe3ee, deep: 0x0a92bf, depth: 0.25, opacity: 0.55, waveAmp: 0.012, normalScale: 1, detailScale: 1 },
  canal: { shallow: 0x46d4dc, deep: 0x077fa6, depth: 0.45, opacity: 0.62, waveAmp: 0.015, normalScale: 1.1, detailScale: 1 },
  infinity: { shallow: 0x58dcf0, deep: 0x0779b8, depth: 0.55, opacity: 0.6, waveAmp: 0.01, normalScale: 0.9, detailScale: 0.9 },
  ocean: { shallow: 0x1aa6c8, deep: 0x05568f, depth: 0.8, opacity: 1, waveAmp: 0.25, normalScale: 0.9, detailScale: 0.08, fadeDistance: 260, edgeFoam: 0 },
  tankTop: { shallow: 0x3fd0e6, deep: 0x066a9a, depth: 0.7, opacity: 0.8, waveAmp: 0.01, normalScale: 1, detailScale: 1 },
} satisfies Record<string, WaterLook>;

export type WaterShape = { kind: 'circle'; x: number; z: number; r: number } | { kind: 'rect'; x: number; z: number; hx: number; hz: number };

export interface WaterBodyOptions {
  name: string;
  shape: WaterShape;
  /** Resting surface height. */
  surfaceY: number;
  look: WaterLook;
  /** Flow direction × speed (m/s) of the surface pattern. */
  flow?: THREE.Vector2;
  /** Grid resolution of the surface mesh. */
  segments?: number;
  /** If false this body is visual only (not reported to gameplay queries). */
  queryable?: boolean;
  renderOrder?: number;
}

/** One animated water surface (pool, canal, tank top, ocean). */
export class WaterBody {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly shape: WaterShape;
  readonly baseY: number;
  readonly queryable: boolean;
  readonly name: string;
  /** Current level offset (animated towards targetLevel). */
  level = 0;
  targetLevel = 0;
  readonly flow = new THREE.Vector2();
  readonly targetFlow = new THREE.Vector2();
  /** Multiplier for the continuous jet disturbances (follows a fountain's on/off state). */
  sourceGain = 1;
  /** True once a local reflection probe replaced the sky reflection. */
  hasProbe = false;

  constructor(opts: WaterBodyOptions, material: THREE.ShaderMaterial) {
    this.name = opts.name;
    this.shape = opts.shape;
    this.baseY = opts.surfaceY;
    this.queryable = opts.queryable ?? true;
    const seg = opts.segments ?? 24;
    let geometry: THREE.BufferGeometry;
    if (opts.shape.kind === 'circle') {
      geometry = new THREE.CircleGeometry(opts.shape.r, Math.max(32, seg * 2), 0, Math.PI * 2);
    } else {
      const sx = opts.shape.hx * 2;
      const sz = opts.shape.hz * 2;
      geometry = new THREE.PlaneGeometry(sx, sz, Math.max(1, Math.round((seg * sx) / Math.max(sx, sz))), Math.max(1, Math.round((seg * sz) / Math.max(sx, sz))));
    }
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = `Water:${opts.name}`;
    this.mesh.position.set(opts.shape.x, opts.surfaceY, opts.shape.z);
    this.mesh.renderOrder = opts.renderOrder ?? 2;
    if (opts.flow) {
      this.flow.copy(opts.flow);
      this.targetFlow.copy(opts.flow);
    }
    material.uniforms.uFlow.value = this.flow;
    const u = material.uniforms;
    const s = opts.shape;
    u.uEdgeKind.value = s.kind === 'circle' ? 1 : 2;
    u.uEdgeCenter.value.set(s.x, s.z);
    if (s.kind === 'circle') u.uEdgeSize.value.set(s.r, s.r);
    else u.uEdgeSize.value.set(s.hx, s.hz);
  }

  /**
   * Continuous disturbances (where jets hit the water): x, z, strength, ring speed.
   * Up to MAX_SOURCES (10) per body.
   */
  setSources(sources: Array<{ x: number; z: number; strength: number; speed?: number }>): void {
    const arr = this.mesh.material.uniforms.uSources.value as THREE.Vector4[];
    for (let i = 0; i < arr.length; i++) {
      const src = sources[i];
      if (src) arr[i].set(src.x, src.z, src.strength, src.speed ?? 9);
      else arr[i].set(0, 0, 0, 0);
    }
  }

  get surfaceY(): number {
    return this.baseY + this.level;
  }

  contains(x: number, z: number): boolean {
    const s = this.shape;
    if (s.kind === 'circle') {
      const dx = x - s.x;
      const dz = z - s.z;
      return dx * dx + dz * dz <= s.r * s.r;
    }
    return Math.abs(x - s.x) <= s.hx && Math.abs(z - s.z) <= s.hz;
  }

  update(dt: number): void {
    this.level = damp(this.level, this.targetLevel, 0.8, dt);
    this.flow.x = damp(this.flow.x, this.targetFlow.x, 0.9, dt);
    this.flow.y = damp(this.flow.y, this.targetFlow.y, 0.9, dt);
    this.mesh.position.y = this.surfaceY;
    this.mesh.material.uniforms.uFlowOffset.value.addScaledVector(this.flow, dt);
    this.mesh.material.uniforms.uSourceGain.value = this.sourceGain;
  }
}

/**
 * Owns every water surface: shared shader, ripple impulses, quality switching and the
 * gameplay queries (surface height, flow) used by the player and floating objects.
 */
export class WaterSystem implements Updatable, QualityAware {
  readonly group = new THREE.Group();
  readonly bodies: WaterBody[] = [];
  private readonly ripples: THREE.Vector4[] = [];
  private rippleIndex = 0;
  private readonly shared: {
    uSunDir: THREE.IUniform<THREE.Vector3>;
    uSunColor: THREE.IUniform<THREE.Color>;
    uEnv: THREE.IUniform<THREE.CubeTexture | null>;
    uEnvStrength: THREE.IUniform<number>;
    uDetail: THREE.IUniform<number>;
    uRipples: THREE.IUniform<THREE.Vector4[]>;
    uSkyHorizon: THREE.IUniform<THREE.Color>;
    uSkyZenith: THREE.IUniform<THREE.Color>;
  };
  private time = 0;

  constructor(sunDir: THREE.Vector3, sunColor: THREE.Color, horizon: THREE.Color, zenith: THREE.Color) {
    this.group.name = 'Water';
    for (let i = 0; i < MAX_RIPPLES; i++) this.ripples.push(new THREE.Vector4(0, 0, -100, 0));
    this.shared = {
      uSunDir: { value: sunDir },
      uSunColor: { value: sunColor },
      uEnv: { value: null },
      uEnvStrength: { value: 1 },
      uDetail: { value: 1 },
      uRipples: { value: this.ripples },
      uSkyHorizon: { value: horizon },
      uSkyZenith: { value: zenith },
    };
  }

  setEnvironment(cube: THREE.CubeTexture): void {
    this.shared.uEnv.value = cube;
    for (const b of this.bodies) if (!b.hasProbe) b.mesh.material.uniforms.uEnv.value = cube;
  }

  /**
   * Bakes a local reflection probe (cube map of the real surroundings) at `position` and makes
   * the given bodies reflect it with a sphere-proxy parallax correction of `radius` metres.
   * Done once at load: predictable cost, coherent reflections of nearby architecture.
   * Returns a PMREM version usable as `envMap` for nearby glossy floors.
   */
  bakeProbe(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, radius: number, bodies: WaterBody[], hide: THREE.Object3D[] = [], size = 256): { env: THREE.Texture; dispose: () => void } {
    const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cam = new THREE.CubeCamera(0.2, 2500, rt);
    cam.position.copy(position);
    const hidden = [this.group, ...hide].map((o) => [o, o.visible] as const);
    for (const [o] of hidden) o.visible = false;
    cam.update(renderer, scene);
    for (const [o, v] of hidden) o.visible = v;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromCubemap(rt.texture);
    pmrem.dispose();
    for (const b of bodies) {
      const u = b.mesh.material.uniforms;
      u.uEnv.value = rt.texture;
      u.uProbePos.value.copy(position);
      u.uProbeRadius.value = radius;
      b.hasProbe = true;
    }
    this.probes.push(rt, envRT);
    return {
      env: envRT.texture,
      dispose: () => {
        rt.dispose();
        envRT.dispose();
      },
    };
  }

  private readonly probes: Array<THREE.WebGLCubeRenderTarget | THREE.WebGLRenderTarget> = [];

  add(opts: WaterBodyOptions): WaterBody {
    const material = this.createMaterial(opts.look);
    const body = new WaterBody(opts, material);
    this.bodies.push(body);
    this.group.add(body.mesh);
    return body;
  }

  createMaterial(look: WaterLook): THREE.ShaderMaterial {
    const opaque = look.opacity >= 1;
    return new THREE.ShaderMaterial({
      name: 'AquaWater',
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        ...this.shared,
        uTime: sharedTime,
        uShallow: { value: new THREE.Color(look.shallow) },
        uDeep: { value: new THREE.Color(look.deep) },
        uDepth: { value: look.depth },
        uOpacity: { value: look.opacity },
        uWaveAmp: { value: look.waveAmp },
        uNormalScale: { value: look.normalScale },
        uDetailScale: { value: look.detailScale },
        uFadeDist: { value: look.fadeDistance ?? 45 },
        uFlow: { value: new THREE.Vector2() },
        uFlowOffset: { value: new THREE.Vector2() },
        uEnv: { value: this.shared.uEnv.value },
        uProbePos: { value: new THREE.Vector3() },
        uProbeRadius: { value: 0 },
        uEdgeKind: { value: 0 },
        uEdgeCenter: { value: new THREE.Vector2() },
        uEdgeSize: { value: new THREE.Vector2() },
        uEdgeFoam: { value: look.edgeFoam ?? 1 },
        uSources: { value: Array.from({ length: MAX_SOURCES }, () => new THREE.Vector4()) },
        uSourceGain: { value: 1 },
      },
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: !opaque,
      depthWrite: opaque,
      fog: true,
      side: THREE.FrontSide,
    });
  }

  /** Expanding ring disturbance on every water surface near (x, z). */
  addRipple(x: number, z: number, strength = 1): void {
    const r = this.ripples[this.rippleIndex];
    r.set(x, z, this.time, Math.min(strength, 2));
    this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  bodyAt(x: number, z: number): WaterBody | null {
    let best: WaterBody | null = null;
    for (const b of this.bodies) {
      if (!b.queryable || !b.contains(x, z)) continue;
      if (!best || b.surfaceY > best.surfaceY) best = b;
    }
    return best;
  }

  surfaceAt(x: number, z: number): number | null {
    const b = this.bodyAt(x, z);
    return b ? b.surfaceY : null;
  }

  applyQuality(profile: QualityProfile): void {
    this.shared.uDetail.value = profile.waterDetail;
    this.shared.uEnvStrength.value = profile.waterDetail > 0 ? 1 : 0.85;
  }

  update(dt: number, time: number): void {
    this.time = time;
    for (const b of this.bodies) b.update(dt);
  }

  dispose(): void {
    for (const b of this.bodies) {
      b.mesh.geometry.dispose();
      b.mesh.material.dispose();
    }
    this.bodies.length = 0;
    this.group.clear();
    for (const p of this.probes) p.dispose();
    this.probes.length = 0;
  }
}

const WAVES_GLSL = /* glsl */ `
  // Three gentle directional swells (height) — kept in sync between vertex & fragment.
  float swell(vec2 p, float t) {
    return sin(p.x * 0.9 + t * 1.3) * 0.5 + sin(p.y * 1.1 - t * 1.1) * 0.5 + sin((p.x + p.y) * 0.6 + t * 0.8) * 0.5;
  }
  vec2 swellGrad(vec2 p, float t) {
    float c3 = cos((p.x + p.y) * 0.6 + t * 0.8) * 0.3;
    return vec2(cos(p.x * 0.9 + t * 1.3) * 0.45 + c3, cos(p.y * 1.1 - t * 1.1) * 0.55 + c3);
  }
`;

const WATER_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  ${WAVES_GLSL}
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    wp.y += swell(wp.xz * (uWaveAmp > 0.1 ? 0.08 : 1.0), uTime) * uWaveAmp;
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform float uDepth;
  uniform float uOpacity;
  uniform float uWaveAmp;
  uniform float uNormalScale;
  uniform float uDetailScale;
  uniform float uFadeDist;
  uniform vec2 uFlowOffset;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform samplerCube uEnv;
  uniform float uEnvStrength;
  uniform float uDetail;
  uniform vec4 uRipples[${MAX_RIPPLES}];
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;
  uniform vec3 uProbePos;
  uniform float uProbeRadius;
  uniform float uEdgeKind;
  uniform vec2 uEdgeCenter;
  uniform vec2 uEdgeSize;
  uniform float uEdgeFoam;
  uniform vec4 uSources[${MAX_SOURCES}];
  uniform float uSourceGain;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>
  ${NOISE_GLSL}
  ${WAVES_GLSL}

  // Value noise with analytic derivatives -> cheap normal perturbation.
  vec3 noiseD(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = aquaHash(i);
    float b = aquaHash(i + vec2(1.0, 0.0));
    float c = aquaHash(i + vec2(0.0, 1.0));
    float d = aquaHash(i + vec2(1.0, 1.0));
    float k = a - b - c + d;
    return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
  }

  vec2 waterGradient(vec2 p) {
    float t = uTime;
    float macroScale = uWaveAmp > 0.1 ? 0.08 : 1.0;
    vec2 g = swellGrad(p * macroScale, t) * uWaveAmp * macroScale;
    vec2 q = p * uDetailScale;
    vec2 fo = uFlowOffset * uDetailScale;
    float dist = length(cameraPosition - vWorld);
    float near = 1.0 - smoothstep(uFadeDist * 0.25, uFadeDist, dist);
    float ns = uNormalScale * mix(0.25, 1.0, near);
    g += noiseD(q * 1.6 - fo * 1.6 + vec2(t * 0.11, t * 0.07)).yz * 0.16 * ns;
    g += noiseD(q * 3.7 - fo * 3.7 + vec2(-t * 0.19, t * 0.13)).yz * 0.08 * ns * mix(0.2, 1.0, near);
    if (uDetail > 0.5 && near > 0.0) {
      g += noiseD(q * 8.3 - fo * 8.3 + vec2(t * 0.31, -t * 0.27)).yz * 0.035 * ns * near;
      g += noiseD(q.yx * 15.0 - fo * 15.0 + vec2(-t * 0.5, -t * 0.4)).yz * 0.012 * ns * near;
    }
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w <= 0.0 || age < 0.0 || age > 3.5) continue;
      vec2 d = p - r.xy;
      float dist = length(d) + 1e-4;
      float x = dist - age * 1.4;
      float env = exp(-x * x * 4.0) * exp(-age * 1.3) * r.w;
      g += (d / dist) * cos(x * 11.0) * env * 0.5;
    }
    // continuous rings where fountain jets land
    if (uSourceGain > 0.01) {
      for (int i = 0; i < ${MAX_SOURCES}; i++) {
        vec4 s = uSources[i];
        if (s.z <= 0.0) continue;
        vec2 d = p - s.xy;
        float dd = length(d) + 1e-3;
        float env = exp(-dd * 2.4) * s.z * uSourceGain;
        g += (d / dd) * (cos(dd * 17.0 - uTime * s.w) * 0.7 + cos(dd * 31.0 - uTime * s.w * 1.7) * 0.3) * env * 0.14;
      }
    }
    return g;
  }

  void main() {
    vec2 g = waterGradient(vWorld.xz);
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float NdV = clamp(dot(N, V), 0.0, 1.0);
    float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(R.y, 0.5));
    // Local probe: correct the lookup direction against a sphere proxy of the surroundings
    // so nearby walls / columns appear where they really are.
    vec3 Rs = R;
    if (uProbeRadius > 0.0) {
      vec3 o = vWorld - uProbePos;
      float pb = dot(o, R);
      float pc = dot(o, o) - uProbeRadius * uProbeRadius;
      float ph = pb * pb - pc;
      if (ph > 0.0) Rs = normalize(o + R * (-pb + sqrt(ph)));
    }
    vec3 refl = mix(skyRefl, texture(uEnv, Rs).rgb, uEnvStrength);

    // Body colour: deeper / darker at grazing angles, light patterns from the floor.
    float grazing = 1.0 - NdV;
    vec3 body = mix(uShallow, uDeep, clamp(uDepth + grazing * 0.4, 0.0, 1.0));
    float shimmer = aquaCaustic(vWorld.xz * 0.9 + g * 0.6, uTime * 1.1);
    body += uShallow * shimmer * 0.22 * (1.0 - uDepth);

    float sunAlign = max(dot(R, uSunDir), 0.0);
    float spec = pow(sunAlign, 520.0) * 9.0 + pow(sunAlign, 60.0) * 0.35;
    // Edge: slightly deeper colour just inside, a bright meniscus and broken foam on the rim.
    float edgeD = 1e3;
    if (uEdgeKind > 0.5 && uEdgeKind < 1.5) edgeD = uEdgeSize.x - length(vWorld.xz - uEdgeCenter);
    else if (uEdgeKind > 1.5) {
      vec2 q = abs(vWorld.xz - uEdgeCenter);
      edgeD = min(uEdgeSize.x - q.x, uEdgeSize.y - q.y);
    }
    float foamN = aquaNoise(vWorld.xz * 7.0 + vec2(uTime * 0.5, -uTime * 0.35)) * aquaNoise(vWorld.xz * 3.1 - uTime * 0.2);
    float foam = (1.0 - smoothstep(0.0, 0.2, edgeD)) * (0.35 + foamN * 1.3) * uEdgeFoam;
    float meniscus = (1.0 - smoothstep(0.0, 0.035, edgeD)) * uEdgeFoam;
    body *= 1.0 - 0.12 * smoothstep(0.9, 0.25, edgeD) * uEdgeFoam;

    vec3 col = mix(body, refl, clamp(fres * 1.05, 0.0, 1.0)) + uSunColor * spec;
    col = mix(col, vec3(0.93, 0.99, 1.0), clamp(foam * 0.5 + meniscus * 0.6, 0.0, 0.85));
    float alpha = clamp(mix(uOpacity, 1.0, fres) + spec * 0.5 + foam * 0.35 + meniscus * 0.4, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;
