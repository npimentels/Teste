import * as THREE from 'three';
import { NOISE_GLSL, sharedTime } from './ShaderPatches';

export interface SkyPalette {
  zenith: THREE.Color;
  horizon: THREE.Color;
  ground: THREE.Color;
  sunColor: THREE.Color;
}

/**
 * Procedural day sky: vertical gradient, sun disc + halo and drifting fbm cumulus clouds.
 * The dome follows the camera and is drawn first, behind everything.
 */
export class SkyDome {
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly uniforms: {
    uZenith: THREE.IUniform<THREE.Color>;
    uHorizon: THREE.IUniform<THREE.Color>;
    uGround: THREE.IUniform<THREE.Color>;
    uSunDir: THREE.IUniform<THREE.Vector3>;
    uSunColor: THREE.IUniform<THREE.Color>;
    uOctaves: THREE.IUniform<number>;
    uCloudCover: THREE.IUniform<number>;
    uTime: THREE.IUniform<number>;
  };

  constructor(sunDir: THREE.Vector3, palette: SkyPalette) {
    this.uniforms = {
      uZenith: { value: palette.zenith },
      uHorizon: { value: palette.horizon },
      uGround: { value: palette.ground },
      uSunDir: { value: sunDir },
      uSunColor: { value: palette.sunColor },
      uOctaves: { value: 5 },
      uCloudCover: { value: 0.46 },
      uTime: sharedTime,
    };
    const material = new THREE.ShaderMaterial({
      name: 'SkyDome',
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uOctaves; uniform float uCloudCover;
        uniform float uTime;
        varying vec3 vDir;
        ${NOISE_GLSL}
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 6; i++) {
            if (float(i) >= uOctaves) break;
            v += a * aquaNoise(p);
            p = p * 2.03 + vec2(17.1, 9.2);
            a *= 0.5;
          }
          return v;
        }
        void main() {
          vec3 d = normalize(vDir);
          float y = d.y;
          float hy = max(y, 0.0);
          vec3 sky = mix(uHorizon, uZenith, pow(hy, 0.5));
          sky = mix(sky, uHorizon * 1.08, exp(-hy * 22.0) * 0.6);
          float sd = max(dot(d, uSunDir), 0.0);
          // Clouds projected on a high plane.
          if (y > 0.0) {
            vec2 uv = d.xz / (y + 0.08) * 0.9 + vec2(uTime * 0.006, uTime * 0.0025);
            float n = fbm(uv);
            float cover = smoothstep(1.0 - uCloudCover - 0.05, 1.0 - uCloudCover + 0.32, n);
            float lit = fbm(uv + uSunDir.xz * 0.08) ;
            float shade = clamp(0.62 + (n - lit) * 2.6, 0.0, 1.0);
            vec3 cloudCol = mix(vec3(0.66, 0.78, 0.9), vec3(1.04, 1.04, 1.02), shade);
            cloudCol += uSunColor * pow(sd, 6.0) * 0.18;
            cover *= smoothstep(0.0, 0.22, y);
            sky = mix(sky, cloudCol, cover * 0.92);
          }
          sky += uSunColor * (pow(sd, 1400.0) * 40.0 + pow(sd, 90.0) * 0.6 + pow(sd, 6.0) * 0.12);
          if (y < 0.0) sky = mix(uHorizon * 0.98, uGround, smoothstep(0.0, -0.25, y));
          gl_FragColor = vec4(sky, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
    this.mesh.name = 'SkyDome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  follow(camera: THREE.Camera): void {
    this.mesh.position.copy(camera.position);
  }

  setOctaves(n: number): void {
    this.uniforms.uOctaves.value = n;
  }

  /**
   * Renders the sky into a cube map (for water reflections) and a PMREM environment
   * (for glossy material reflections / ambient specular). Done once at load.
   */
  bakeEnvironment(renderer: THREE.WebGLRenderer): { cube: THREE.CubeTexture; env: THREE.Texture; dispose: () => void } {
    const scene = new THREE.Scene();
    const dome = new THREE.Mesh(this.mesh.geometry, this.mesh.material);
    dome.frustumCulled = false;
    scene.add(dome);
    // A soft "ground bounce" disc so reflections of downward directions read as sunlit floor.
    const groundMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8ecf0), side: THREE.DoubleSide });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 32), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -40;
    scene.add(ground);

    const target = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCam = new THREE.CubeCamera(1, 2000, target);
    cubeCam.update(renderer, scene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromCubemap(target.texture);
    pmrem.dispose();
    ground.geometry.dispose();
    groundMat.dispose();
    return {
      cube: target.texture,
      env: envRT.texture,
      dispose: () => {
        target.dispose();
        envRT.dispose();
      },
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
