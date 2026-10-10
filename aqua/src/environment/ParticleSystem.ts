import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE_GLSL, sharedTime } from './ShaderPatches';
import type { QualityAware, QualityProfile, Updatable } from '../core/types';
import { createRng, damp } from '../core/math';

/**
 * GPU-animated particles: every particle's trajectory is a closed-form function of time, so
 * the CPU never touches the buffers after creation (except the small one-shot splash pool).
 */

const pixelRatioUniform: THREE.IUniform<number> = { value: 1 };
export function setParticlePixelRatio(v: number): void {
  pixelRatioUniform.value = v;
}

const SPRITE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d) * vAlpha * uOpacity;
    float hl = smoothstep(0.22, 0.0, length(c - vec2(-0.13, -0.13)));
    vec3 col = mix(uColor, vec3(1.0), hl * 0.85);
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface JetSpec {
  origin: THREE.Vector3;
  velocity: THREE.Vector3;
  spread: number;
  count: number;
}

/**
 * A set of ballistic water jets sharing one draw call. Intensity animates 0..1 when the
 * fountain is switched on/off, collapsing the jets smoothly.
 */
export class FountainEmitter implements Updatable, QualityAware {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  intensity = 1;
  target = 1;
  private total = 0;

  constructor(
    jets: JetSpec[],
    opts: { floorY: number; life?: number; size?: number; color?: THREE.ColorRepresentation; opacity?: number; seed?: number; gravity?: number },
  ) {
    const rng = createRng(opts.seed ?? 7);
    const total = jets.reduce((s, j) => s + j.count, 0);
    this.total = total;
    const origin = new Float32Array(total * 3);
    const vel = new Float32Array(total * 3);
    const rand = new Float32Array(total * 4);
    let i = 0;
    for (const j of jets) {
      for (let n = 0; n < j.count; n++, i++) {
        origin.set([j.origin.x, j.origin.y, j.origin.z], i * 3);
        const sp = j.spread;
        vel.set([j.velocity.x + (rng() - 0.5) * sp, j.velocity.y + (rng() - 0.5) * sp * 0.5, j.velocity.z + (rng() - 0.5) * sp], i * 3);
        rand.set([rng(), rng(), rng(), rng()], i * 4);
      }
    }
    // Shuffle-free: interleave jets by drawing a random subset when the quality is reduced.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(origin, 3));
    geometry.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    geometry.boundingSphere = new THREE.Sphere(jets[0]?.origin.clone() ?? new THREE.Vector3(), 12);
    shuffleGeometry(geometry, rng);

    const material = new THREE.ShaderMaterial({
      name: 'FountainParticles',
      uniforms: {
        uTime: sharedTime,
        uIntensity: { value: 1 },
        uGravity: { value: opts.gravity ?? 9.8 },
        uLife: { value: opts.life ?? 1.4 },
        uSize: { value: opts.size ?? 0.09 },
        uFloorY: { value: opts.floorY },
        uPixelRatio: pixelRatioUniform,
        uColor: { value: new THREE.Color(opts.color ?? 0xd8fbff) },
        uOpacity: { value: opts.opacity ?? 0.85 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aVel;
        attribute vec4 aRand;
        uniform float uTime, uIntensity, uGravity, uLife, uSize, uFloorY, uPixelRatio;
        varying float vAlpha;
        void main() {
          float life = fract(uTime / (uLife * (0.85 + 0.3 * aRand.y)) + aRand.x);
          float T = life * uLife;
          vec3 v = aVel * (0.94 + 0.12 * aRand.z) * uIntensity;
          vec3 p = position + v * T;
          p.y -= 0.5 * uGravity * T * T;
          vAlpha = smoothstep(0.0, 0.06, life) * (1.0 - smoothstep(0.8, 1.0, life)) * smoothstep(0.02, 0.25, uIntensity);
          if (p.y < uFloorY) { vAlpha = 0.0; }
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * mix(0.7, 1.5, life) * (0.6 + aRand.w * 0.8) * uPixelRatio * (420.0 / max(-mv.z, 0.1));
        }`,
      fragmentShader: SPRITE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  setActive(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  update(dt: number): void {
    this.intensity = damp(this.intensity, this.target, this.target > this.intensity ? 1.6 : 2.4, dt);
    if (Math.abs(this.intensity - this.target) < 0.002) this.intensity = this.target;
    this.points.material.uniforms.uIntensity.value = this.intensity;
    this.points.visible = this.intensity > 0.01;
  }

  applyQuality(profile: QualityProfile): void {
    this.points.geometry.setDrawRange(0, Math.max(1, Math.floor(this.total * profile.particleScale)));
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/** Rising bubbles (or slow floating motes) inside a box volume. */
export class BubbleEmitter implements Updatable, QualityAware {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  intensity = 1;
  target = 1;
  private total: number;

  constructor(opts: {
    min: THREE.Vector3;
    max: THREE.Vector3;
    count: number;
    speed?: number;
    size?: number;
    color?: THREE.ColorRepresentation;
    opacity?: number;
    /** Emit from a few columns instead of the whole floor. */
    columns?: THREE.Vector2[];
    columnRadius?: number;
    seed?: number;
    wobble?: number;
  }) {
    const rng = createRng(opts.seed ?? 11);
    this.total = opts.count;
    const pos = new Float32Array(opts.count * 3);
    const rand = new Float32Array(opts.count * 4);
    const size = new THREE.Vector3().subVectors(opts.max, opts.min);
    for (let i = 0; i < opts.count; i++) {
      let x: number;
      let z: number;
      if (opts.columns && opts.columns.length) {
        const c = opts.columns[i % opts.columns.length];
        const a = rng() * Math.PI * 2;
        const r = Math.sqrt(rng()) * (opts.columnRadius ?? 0.15);
        x = c.x + Math.cos(a) * r;
        z = c.y + Math.sin(a) * r;
      } else {
        x = opts.min.x + rng() * size.x;
        z = opts.min.z + rng() * size.z;
      }
      pos.set([x, opts.min.y, z], i * 3);
      rand.set([rng(), rng(), rng(), rng()], i * 4);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3().addVectors(opts.min, opts.max).multiplyScalar(0.5), size.length());
    const material = new THREE.ShaderMaterial({
      name: 'Bubbles',
      uniforms: {
        uTime: sharedTime,
        uHeight: { value: size.y },
        uSpeed: { value: opts.speed ?? 0.6 },
        uSize: { value: opts.size ?? 0.06 },
        uWobble: { value: opts.wobble ?? 0.08 },
        uIntensity: { value: 1 },
        uPixelRatio: pixelRatioUniform,
        uColor: { value: new THREE.Color(opts.color ?? 0xe8ffff) },
        uOpacity: { value: opts.opacity ?? 0.7 },
      },
      vertexShader: /* glsl */ `
        attribute vec4 aRand;
        uniform float uTime, uHeight, uSpeed, uSize, uWobble, uIntensity, uPixelRatio;
        varying float vAlpha;
        void main() {
          float speed = uSpeed * (0.6 + aRand.y * 0.8);
          float y = mod(aRand.x * uHeight + uTime * speed, uHeight);
          float life = y / uHeight;
          vec3 p = position;
          p.y += y;
          float ph = aRand.z * 6.2831;
          p.x += sin(uTime * (1.5 + aRand.w * 2.0) + ph) * uWobble * (0.3 + life);
          p.z += cos(uTime * (1.3 + aRand.y * 2.0) + ph) * uWobble * (0.3 + life);
          // Fade per-particle by a stable random threshold so turning off thins the stream.
          float on = step(aRand.w, uIntensity);
          vAlpha = smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.9, 1.0, life)) * on;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * (0.5 + aRand.z) * (0.8 + life * 0.5) * uPixelRatio * (420.0 / max(-mv.z, 0.1));
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float ring = smoothstep(0.5, 0.36, d) * (0.35 + 0.65 * smoothstep(0.2, 0.46, d));
          float hl = smoothstep(0.14, 0.0, length(c - vec2(-0.15, -0.15)));
          float a = (ring + hl) * vAlpha * uOpacity;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), hl), a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.renderOrder = 5;
  }

  setActive(on: boolean): void {
    this.target = on ? 1 : 0;
  }

  update(dt: number): void {
    this.intensity = damp(this.intensity, this.target, 1.2, dt);
    this.points.material.uniforms.uIntensity.value = this.intensity;
    this.points.visible = this.intensity > 0.01;
  }

  applyQuality(profile: QualityProfile): void {
    this.points.geometry.setDrawRange(0, Math.max(1, Math.floor(this.total * profile.particleScale)));
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/**
 * A continuous stream of water rendered as a tube or ribbon along a path. `head`/`tail`
 * reveal the stream progressively so it visibly starts flowing and drains away.
 */
export class WaterStream implements Updatable {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private head = 1;
  private tail = 0;
  private active = true;
  /** Seconds the water front needs to travel the whole path. */
  travelTime: number;

  static tube(points: THREE.Vector3[], radius: number, opts: StreamOptions = {}): WaterStream {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 8, false);
    return new WaterStream(geometry, opts);
  }

  /** Several tubes sharing one draw call (all switch on/off together). */
  static tubes(paths: THREE.Vector3[][], radius: number, opts: StreamOptions = {}): WaterStream {
    const parts = paths.map((points) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), Math.max(8, points.length * 6), radius, 8, false));
    const merged = mergeGeometries(parts, false)!;
    for (const g of parts) g.dispose();
    return new WaterStream(merged, opts);
  }

  /** Flat sheet following `points`, extruded sideways along `side` (half width). */
  static ribbon(points: THREE.Vector3[], side: THREE.Vector3, opts: StreamOptions = {}): WaterStream {
    const curve = new THREE.CatmullRomCurve3(points);
    const segs = Math.max(8, points.length * 8);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPoint(t, p);
      pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
      uv.push(0, t, 1, t);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(idx);
    geometry.computeVertexNormals();
    return new WaterStream(geometry, { ...opts, ribbon: true });
  }

  /** Ring-shaped falling curtain (overflowing bowl): uv.x around, uv.y from top (0) to bottom (1). */
  static curtain(center: THREE.Vector3, rTop: number, rBottom: number, yTop: number, yBottom: number, opts: StreamOptions = {}): WaterStream {
    const radial = 48;
    const rows = 6;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      // slight outward bulge as water leaves the rim
      const r = THREE.MathUtils.lerp(rTop, rBottom, Math.sqrt(t));
      const y = THREE.MathUtils.lerp(yTop, yBottom, t);
      for (let i = 0; i <= radial; i++) {
        const a = (i / radial) * Math.PI * 2;
        pos.push(center.x + Math.cos(a) * r, y, center.z + Math.sin(a) * r);
        uv.push(i / radial, t);
      }
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < radial; i++) {
        const a = j * (radial + 1) + i;
        const b = a + radial + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(idx);
    geometry.computeVertexNormals();
    return new WaterStream(geometry, { ...opts, ribbon: true, closed: true });
  }

  private constructor(geometry: THREE.BufferGeometry, opts: StreamOptions & { ribbon?: boolean; closed?: boolean }) {
    this.travelTime = opts.travelTime ?? 0.8;
    const material = new THREE.ShaderMaterial({
      name: 'WaterStream',
      uniforms: {
        uTime: sharedTime,
        uHead: { value: 1 },
        uTail: { value: 0 },
        uSpeed: { value: opts.speed ?? 2.2 },
        uColor: { value: new THREE.Color(opts.color ?? 0xbff6ff) },
        uOpacity: { value: opts.opacity ?? 0.75 },
        uRibbon: { value: opts.ribbon ? (opts.closed ? 2 : 1) : 0 },
        uStreaks: { value: opts.streaks ?? 6 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uHead, uTail, uSpeed, uOpacity, uRibbon, uStreaks;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vNormalW;
        varying vec3 vWorld;
        ${NOISE_GLSL}
        void main() {
          // Tube geometry: uv.x runs along the path, uv.y around it. Ribbon: uv.y along the path.
          float along = uRibbon > 0.5 ? vUv.y : vUv.x;
          float across = uRibbon > 0.5 ? vUv.x : vUv.y;
          if (along > uHead || along < uTail) discard;
          float edgeHead = smoothstep(uHead, uHead - 0.04, along);
          float edgeTail = smoothstep(uTail, uTail + 0.04, along);
          float n = aquaNoise(vec2(across * uStreaks * 3.0, along * 14.0 - uTime * uSpeed * 3.0));
          float n2 = aquaNoise(vec2(across * uStreaks * 7.0 + 3.0, along * 31.0 - uTime * uSpeed * 5.0));
          float streak = 0.55 + 0.45 * n * n2 * 2.0;
          vec3 V = normalize(cameraPosition - vWorld);
          float rim = 1.0 - abs(dot(normalize(vNormalW), V));
          float sideFade = (uRibbon > 0.5 && uRibbon < 1.5) ? smoothstep(0.0, 0.12, across) * smoothstep(1.0, 0.88, across) : 1.0;
          float a = uOpacity * (0.45 + 0.55 * rim) * streak * edgeHead * edgeTail * sideFade;
          vec3 col = mix(uColor, vec3(1.0), clamp(streak - 0.6 + rim * 0.4, 0.0, 1.0));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 3;
  }

  setActive(on: boolean, instant = false): void {
    if (on === this.active && !instant) return;
    this.active = on;
    if (instant) {
      this.head = on ? 1 : 0;
      this.tail = 0;
    } else if (on) {
      this.head = 0;
      this.tail = 0;
    }
    this.apply();
  }

  update(dt: number): void {
    const step = dt / this.travelTime;
    if (this.active) {
      this.head = Math.min(1, this.head + step);
      this.tail = 0;
    } else if (this.head > 0) {
      this.tail = Math.min(1, this.tail + step);
      if (this.tail >= 1) this.head = 0;
    }
    this.apply();
  }

  private apply(): void {
    const u = this.mesh.material.uniforms;
    u.uHead.value = this.head;
    u.uTail.value = this.tail;
    this.mesh.visible = this.head > 0.001 && this.tail < 0.999;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export interface StreamOptions {
  speed?: number;
  color?: THREE.ColorRepresentation;
  opacity?: number;
  travelTime?: number;
  streaks?: number;
}

/** CPU pool for one-shot splashes (footsteps in water, dropped objects). */
export class SplashPool implements Updatable {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly alpha: Float32Array;
  private next = 0;
  private alive = 0;
  private readonly rng = createRng(99);

  constructor(private readonly capacity = 320) {
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      name: 'Splash',
      uniforms: { uPixelRatio: pixelRatioUniform, uColor: { value: new THREE.Color(0xe6fdff) }, uOpacity: { value: 0.9 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 0.07 * uPixelRatio * (420.0 / max(-mv.z, 0.1)) * (0.6 + aAlpha * 0.6);
        }`,
      fragmentShader: SPRITE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.points.visible = false;
  }

  emit(x: number, y: number, z: number, count: number, power = 1): void {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.capacity;
      const a = this.rng() * Math.PI * 2;
      const h = (0.6 + this.rng() * 1.2) * power;
      const up = (1.6 + this.rng() * 2.2) * power;
      this.pos[i * 3] = x + Math.cos(a) * 0.08;
      this.pos[i * 3 + 1] = y + 0.02;
      this.pos[i * 3 + 2] = z + Math.sin(a) * 0.08;
      this.vel[i * 3] = Math.cos(a) * h;
      this.vel[i * 3 + 1] = up;
      this.vel[i * 3 + 2] = Math.sin(a) * h;
      this.life[i] = 0.5 + this.rng() * 0.4;
    }
    this.alive = Math.min(this.capacity, this.alive + count);
    this.points.visible = true;
  }

  update(dt: number): void {
    if (!this.points.visible) return;
    let any = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, Math.min(1, this.life[i] * 3));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    if (!any) {
      this.points.visible = false;
      this.alive = 0;
    }
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

/** Randomizes vertex order so a reduced draw range still samples every jet evenly. */
function shuffleGeometry(geometry: THREE.BufferGeometry, rng: () => number): void {
  const count = geometry.attributes.position.count;
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const name of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[name] as THREE.BufferAttribute;
    const src = attr.array as Float32Array;
    const copy = new Float32Array(src.length);
    const size = attr.itemSize;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < size; k++) copy[i * size + k] = src[order[i] * size + k];
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(copy, size));
  }
}
