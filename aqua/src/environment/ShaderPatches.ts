import * as THREE from 'three';

/**
 * Composable patches for built-in Three.js materials (MeshStandard/Physical).
 * Several patches can be stacked on one material; they share a world-position varying.
 */
export interface ShaderPatch {
  name: string;
  uniforms?: Record<string, THREE.IUniform>;
  vertexPars?: string;
  /** Runs after <begin_vertex>; may modify `transformed` (object space). */
  vertexTransform?: string;
  fragmentPars?: string;
  /** Runs after <emissivemap_fragment>; may add to `totalEmissiveRadiance`. */
  fragmentEmissive?: string;
  /** Runs before <opaque_fragment>; may modify `outgoingLight`. */
  fragmentFinal?: string;
}

/** Global time uniform shared by every animated shader. */
export const sharedTime: THREE.IUniform<number> = { value: 0 };

const PATCHES = Symbol('aquaPatches');

type PatchedMaterial = THREE.Material & { [PATCHES]?: ShaderPatch[] };

export function addPatch<T extends THREE.Material>(material: T, patch: ShaderPatch): T {
  const m = material as PatchedMaterial;
  const list = m[PATCHES] ?? (m[PATCHES] = []);
  if (list.some((p) => p.name === patch.name)) return material;
  list.push(patch);
  const key = list.map((p) => p.name).join('+');
  m.customProgramCacheKey = () => `aqua:${key}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedTime;
    let vPars = 'varying vec3 vPatchWorld;\nuniform float uTime;\n';
    let vTransform = '';
    let fPars = 'varying vec3 vPatchWorld;\nuniform float uTime;\n' + NOISE_GLSL;
    let fEmissive = '';
    let fFinal = '';
    for (const p of list) {
      if (p.uniforms) Object.assign(shader.uniforms, p.uniforms);
      vPars += p.vertexPars ?? '';
      vTransform += p.vertexTransform ?? '';
      fPars += p.fragmentPars ?? '';
      fEmissive += p.fragmentEmissive ?? '';
      fFinal += p.fragmentFinal ?? '';
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vTransform}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 pw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pw = instanceMatrix * pw;
          #endif
          vPatchWorld = (modelMatrix * pw).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fPars}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fEmissive}`)
      .replace('#include <opaque_fragment>', `${fFinal}\n#include <opaque_fragment>`);
  };
  material.needsUpdate = true;
  return material;
}

/** Hash / value-noise / caustic helpers shared by all patched shaders. */
export const NOISE_GLSL = /* glsl */ `
#ifndef AQUA_NOISE
#define AQUA_NOISE
float aquaHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec2 aquaHash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float aquaNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = aquaHash(i);
  float b = aquaHash(i + vec2(1.0, 0.0));
  float c = aquaHash(i + vec2(0.0, 1.0));
  float d = aquaHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Distance between the two nearest animated cell points: thin bright web = caustic lines.
float aquaCellEdge(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = aquaHash2(i + g);
      o = 0.5 + 0.42 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
float aquaCaustic(vec2 p, float t) {
  float a = aquaCellEdge(p, t * 0.9);
  float b = aquaCellEdge(p * 1.37 + vec2(3.1, 1.7), -t * 0.7 + 2.0);
  float ca = 1.0 - smoothstep(0.0, 0.16, a);
  float cb = 1.0 - smoothstep(0.0, 0.2, b);
  return ca * ca * 0.75 + cb * cb * 0.45 + ca * cb * 0.6;
}
#endif
`;

/** Animated caustic light on surfaces below a water level (pool floors, basin walls). */
export function causticsPatch(level: THREE.IUniform<number>, strength: THREE.IUniform<number>, color = new THREE.Color(0x9ff4ff), scale = 0.75): ShaderPatch {
  return {
    name: 'caustics',
    uniforms: { uCausticLevel: level, uCausticStrength: strength, uCausticColor: { value: color }, uCausticScale: { value: scale } },
    fragmentPars: 'uniform float uCausticLevel; uniform float uCausticStrength; uniform vec3 uCausticColor; uniform float uCausticScale;',
    fragmentEmissive: /* glsl */ `
      {
        float below = smoothstep(uCausticLevel + 0.02, uCausticLevel - 0.12, vPatchWorld.y);
        if (below > 0.0 && uCausticStrength > 0.0) {
          float c = aquaCaustic(vPatchWorld.xz * uCausticScale + vec2(vPatchWorld.y * 0.35), uTime * 1.1);
          totalEmissiveRadiance += uCausticColor * c * uCausticStrength * below;
        }
      }`,
  };
}

/** Wind sway for instanced foliage: displacement grows with height above the instance origin. */
export function windPatch(strength = 0.06, frequency = 1.2, name = 'wind'): ShaderPatch {
  return {
    name,
    uniforms: { uWindStrength: { value: strength }, uWindFreq: { value: frequency } },
    vertexPars: 'uniform float uWindStrength; uniform float uWindFreq;',
    vertexTransform: /* glsl */ `
      {
        vec3 basePos = vec3(0.0);
        #ifdef USE_INSTANCING
          basePos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #endif
        float h = max(transformed.y, 0.0);
        float phase = basePos.x * 0.37 + basePos.z * 0.23;
        float sway = sin(uTime * uWindFreq + phase) + 0.45 * sin(uTime * uWindFreq * 2.3 + phase * 1.7);
        float flutter = sin(uTime * 6.0 + transformed.x * 3.0 + transformed.z * 2.0 + phase) * 0.15;
        transformed.x += (sway + flutter) * uWindStrength * h * h * 0.35;
        transformed.z += (cos(uTime * uWindFreq * 0.8 + phase) * 0.6 + flutter) * uWindStrength * h * h * 0.25;
      }`,
  };
}

/** Body undulation for fish: the tail (−X in model space) swings sideways. */
export function swimPatch(): ShaderPatch {
  return {
    name: 'swim',
    vertexTransform: /* glsl */ `
      {
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3 + instanceMatrix[3].y;
        #endif
        float tail = smoothstep(0.15, -0.6, transformed.x);
        transformed.z += sin(uTime * 7.0 + ph - transformed.x * 4.0) * 0.12 * tail;
      }`,
  };
}

export interface TankVolume {
  /** 0 = axis aligned box, 1 = vertical cylinder. */
  shape: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** Cylinder only: axis position in XZ (min/max still give the vertical range). */
  center: THREE.Vector2;
  radius: number;
}

/**
 * Underwater look for everything inside an aquarium: light absorption proportional to the
 * distance travelled through water (ray/volume intersection), depth darkening and caustics.
 */
export function underwaterPatch(volume: TankVolume, waterColor: THREE.Color, density: THREE.IUniform<number>, light: THREE.IUniform<number>): ShaderPatch {
  return {
    name: 'underwater',
    uniforms: {
      uTankShape: { value: volume.shape },
      uTankMin: { value: volume.min },
      uTankMax: { value: volume.max },
      uTankCenter: { value: volume.center },
      uTankRadius: { value: volume.radius },
      uTankColor: { value: waterColor },
      uTankDensity: density,
      uTankLight: light,
    },
    fragmentPars: /* glsl */ `
      uniform float uTankShape; uniform vec3 uTankMin; uniform vec3 uTankMax; uniform vec2 uTankCenter;
      uniform float uTankRadius; uniform vec3 uTankColor; uniform float uTankDensity; uniform float uTankLight;
      float tankEnter(vec3 ro, vec3 rd) {
        if (uTankShape < 0.5) {
          vec3 inv = 1.0 / rd;
          vec3 t0 = (uTankMin - ro) * inv;
          vec3 t1 = (uTankMax - ro) * inv;
          vec3 tmin = min(t0, t1);
          return max(max(max(tmin.x, tmin.y), tmin.z), 0.0);
        }
        vec2 oc = ro.xz - uTankCenter;
        float a = dot(rd.xz, rd.xz);
        float b = dot(oc, rd.xz);
        float c = dot(oc, oc) - uTankRadius * uTankRadius;
        float h = b * b - a * c;
        if (h < 0.0 || a < 1e-6) return 0.0;
        return max((-b - sqrt(h)) / a, 0.0);
      }`,
    fragmentEmissive: /* glsl */ `
      {
        float topFade = smoothstep(uTankMin.y, uTankMax.y, vPatchWorld.y);
        float cs = aquaCaustic(vPatchWorld.xz * 0.9 + vPatchWorld.y * 0.2, uTime * 1.2);
        totalEmissiveRadiance += vec3(0.55, 0.95, 1.0) * cs * (0.18 + 0.3 * topFade) * uTankLight;
      }`,
    fragmentFinal: /* glsl */ `
      {
        vec3 toFrag = vPatchWorld - cameraPosition;
        float len = length(toFrag);
        vec3 rd = toFrag / max(len, 1e-4);
        float path = max(len - tankEnter(cameraPosition, rd), 0.0);
        float fogF = 1.0 - exp(-path * uTankDensity);
        float depth01 = clamp((vPatchWorld.y - uTankMin.y) / max(uTankMax.y - uTankMin.y, 0.01), 0.0, 1.0);
        vec3 deepCol = uTankColor * mix(0.35, 1.0, depth01) * mix(0.45, 1.0, uTankLight);
        outgoingLight = mix(outgoingLight * mix(vec3(0.75, 0.95, 1.0), vec3(1.0), depth01), deepCol, fogF);
      }`,
  };
}
