/* Nox City — atmosphere: sky, moon, clouds, rain, steam, koi hologram, searchlights, reflection + post. */
(function () {
  'use strict';
  const NC = window.NC;
  const U = NC.U;
  const FX = (NC.FX = {});

  const COMMON = `
    uniform vec3 uFogColor; uniform float uFogDensity; uniform float uTime;
    float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h12(i),h12(i+vec2(1.,0.)),f.x), mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  `;

  // ---------------- sky ----------------
  FX.moonDir = new THREE.Vector3(-0.86, 0.36, -0.36).normalize();
  FX.makeSky = function (scene) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time, uFogColor: U.fogColor, uFogDensity: U.fogDensity, uMoonDir: { value: FX.moonDir } },
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; gl_Position.z = gl_Position.w*.99999; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform vec3 uMoonDir; varying vec3 vW;
        void main(){
          vec3 d = normalize(vW - cameraPosition);
          float y = d.y;
          vec3 zen = vec3(.004,.005,.018), mid = vec3(.03,.014,.07), hor = vec3(.24,.06,.25);
          vec3 col = mix(hor, mid, smoothstep(-.02, .22, y));
          col = mix(col, zen, smoothstep(.2, .85, y));
          col = mix(col, uFogColor, smoothstep(.02, -.12, y));
          float md = dot(d, uMoonDir);
          float dens = 0.;
          // stars
          vec2 sp = vec2(atan(d.z, d.x)*120., asin(clamp(y,-1.,1.))*120.);
          vec2 sc = floor(sp); float sh = h12(sc);
          float star = step(.9965, sh)*smoothstep(.45, 0., length(fract(sp)-.5))*(.5+.5*sin(uTime*(2.+sh*5.)+sh*60.));
          // clouds
          if(y > -.05){
            vec2 cp = d.xz/(y+.14)*1.4 + vec2(uTime*.008, uTime*.003);
            float c = fbm(cp*.7);
            dens = smoothstep(.40, .78, c)*(.55 + .45*fbm(cp*2.1+3.));
            dens *= smoothstep(-.05, .08, y);
            vec3 cc = mix(vec3(.36,.10,.32), vec3(.05,.04,.11), smoothstep(.0, .45, y));
            cc += vec3(.5,.5,.62)*pow(max(md,0.), 10.)*.7;
            cc += vec3(.20,.05,.12)*(1.-smoothstep(0.,.15,y))*fbm(cp*3.);
            col = mix(col, cc, dens*.92);
          }
          col += vec3(.75,.8,1.)*star*(1.-dens)*smoothstep(.05,.3,y);
          // moon
          float disc = smoothstep(.99935, .99955, md);
          vec3 mpos = d - uMoonDir;
          float crater = fbm(mpos.xy*900.+2.)*.45 + .65;
          vec3 moon = vec3(1.7,1.72,1.9)*crater;
          col = mix(col, moon, disc*(1.-dens*.7));
          col += vec3(.55,.55,.75)*(pow(max(md,0.), 900.)*.6 + pow(max(md,0.), 60.)*.12)*(1.-dens*.5);
          gl_FragColor = vec4(col, 1.);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
    sky.frustumCulled = false; sky.renderOrder = -10;
    scene.add(sky);
    FX.sky = sky;
    return sky;
  };

  // ---------------- rain ----------------
  FX.makeRain = function (scene, maxN = 6000) {
    const pos = new Float32Array(maxN * 2 * 3), end = new Float32Array(maxN * 2);
    for (let i = 0; i < maxN; i++) {
      const x = Math.random(), y = Math.random(), z = Math.random();
      for (let k = 0; k < 2; k++) { pos.set([x, y, z], (i * 2 + k) * 3); end[i * 2 + k] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aEnd; uniform vec3 uCam; uniform float uTime; varying float vA;
        void main(){
          vec3 box = vec3(44., 30., 44.);
          vec3 vel = vec3(2.2, -24., 1.1);
          vec3 p = position*box + vel*uTime;
          vec3 base = uCam - box*.5;
          p = mod(p - base, box) + base;
          p -= vel*.05*aEnd;
          vec4 mv = viewMatrix*vec4(p,1.);
          float d = length(mv.xyz);
          vA = smoothstep(.6, 2.5, d)*(1.-smoothstep(12., 22., d))*(.55+.45*aEnd);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(vec3(.55,.62,.85)*.42*vA*uAlpha, 1.); }`,
    });
    const rain = new THREE.LineSegments(g, mat);
    rain.frustumCulled = false; rain.renderOrder = 5;
    NC.noRefl(rain);
    scene.add(rain);
    FX.rain = rain; FX.rainMax = maxN;
    FX.setRainCount = (n) => g.setDrawRange(0, Math.min(maxN, n) * 2);
    return rain;
  };

  // ---------------- ground splashes ----------------
  FX.makeSplashes = function (scene, n = 500) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([Math.random(), Math.random(), Math.random()], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time, uCam: { value: new THREE.Vector3() }, uGround: { value: 0 }, uAlpha: { value: 1 }, uScale: { value: 300 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        uniform vec3 uCam; uniform float uTime, uGround, uScale; varying float vA;
        void main(){
          vec2 box = vec2(26.);
          float ph = fract(uTime*1.6 + position.y*13.);
          float cyc = floor(uTime*1.6 + position.y*13.);
          vec2 p = fract(position.xz + vec2(cyc*.618, cyc*.381))*box;
          vec2 base = uCam.xz - box*.5;
          p = mod(p - base, box) + base;
          vec4 mv = viewMatrix*vec4(p.x, uGround+.03, p.y, 1.);
          vA = (1.-ph)*(1.-smoothstep(6., 13., length(mv.xyz)));
          gl_PointSize = (.04 + ph*.28)*uScale/max(-mv.z, 1.);
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `uniform float uAlpha; varying float vA; void main(){ vec2 c=gl_PointCoord-.5; float r=length(c); float ring=smoothstep(.5,.35,r)*smoothstep(.15,.32,r); gl_FragColor=vec4(vec3(.6,.7,.95)*ring*vA*.5*uAlpha,1.); }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
    NC.noRefl(pts); scene.add(pts);
    FX.splash = pts;
  };

  // ---------------- steam / smoke particles ----------------
  FX.makeSteam = function (scene, n = 360) {
    const pos = new Float32Array(n * 3), life = new Float32Array(n), size = new Float32Array(n), col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: NC.T.smoke }, uScale: { value: 300 }, uFogColor: U.fogColor, uFogDensity: U.fogDensity },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aLife; attribute float aSize; attribute vec3 color; uniform float uScale; varying float vL; varying vec3 vC;
        void main(){ vL=aLife; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize = aSize*(1.+ (1.-aLife)*2.2)*uScale/max(-mv.z,.5); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vL; varying vec3 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; float f = smoothstep(0.,.25,vL)*smoothstep(1.,.75,vL); gl_FragColor = vec4(vC*a*f*.55, 1.); }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
    NC.noRefl(pts); scene.add(pts);
    const P = [];
    for (let i = 0; i < n; i++) P.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, c: [1, 1, 1] });
    let cursor = 0;
    FX.steam = { pts, P, g };
    FX.updateSteam = function (dt, cam) {
      // emit
      for (const e of NC.steamEmitters) {
        const dx = e.x - cam.x, dz = e.z - cam.z;
        if (dx * dx + dz * dz > 75 * 75) continue;
        e.acc += dt * e.rate * 6;
        while (e.acc > 1) {
          e.acc -= 1;
          const p = P[cursor]; cursor = (cursor + 1) % n;
          p.x = e.x + (Math.random() - 0.5) * 0.6 * e.size; p.y = e.y; p.z = e.z + (Math.random() - 0.5) * 0.6 * e.size;
          p.vx = (Math.random() - 0.5) * 0.4 + 0.25; p.vy = 0.9 + Math.random() * 0.8; p.vz = (Math.random() - 0.5) * 0.4;
          p.max = 2.2 + Math.random() * 1.8; p.life = p.max; p.size = (0.9 + Math.random() * 0.8) * e.size; p.c = e.color;
        }
      }
      for (let i = 0; i < n; i++) {
        const p = P[i];
        if (p.life > 0) {
          p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 0.995;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          life[i] = Math.max(0, p.life / p.max); size[i] = p.size;
          col[i * 3] = p.c[0]; col[i * 3 + 1] = p.c[1]; col[i * 3 + 2] = p.c[2];
        } else { pos[i * 3 + 1] = -999; life[i] = 0; }
      }
      g.attributes.position.needsUpdate = true; g.attributes.aLife.needsUpdate = true; g.attributes.aSize.needsUpdate = true; g.attributes.color.needsUpdate = true;
    };
  };

  // ---------------- koi hologram ----------------
  FX.makeKoi = function (scene) {
    const N = 2600;
    const pos = [], col = [], rnd = [];
    const cA = new THREE.Color(0x5ef2ff), cB = new THREE.Color(0xff2bd6), cC = new THREE.Color(0xffb24a), tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const part = Math.random();
      let x, y, z;
      if (part < 0.72) { // body: tapered ellipsoid along x in [-1,1]
        const t = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - t * t)) * (t > 0 ? 0.32 : 0.32 * (1 + t * 0.55));
        const sh = Math.random() < 0.7 ? 1 : Math.random();
        x = t; y = Math.sin(a) * r * sh * 0.85; z = Math.cos(a) * r * sh * 0.7;
      } else if (part < 0.86) { // tail fin
        const u = Math.random(), v = Math.random() * 2 - 1;
        x = -1 - u * 0.75; y = v * (0.1 + u * 0.55) ; z = (Math.random() - 0.5) * 0.04;
      } else if (part < 0.95) { // pectoral fins
        const s = Math.random() < 0.5 ? -1 : 1, u = Math.random(), v = Math.random();
        x = 0.45 - u * 0.4; y = -0.18 - v * 0.15; z = s * (0.2 + v * 0.45);
      } else { // dorsal
        const u = Math.random(), v = Math.random();
        x = 0.3 - u * 0.9; y = 0.26 + v * 0.22 * (1 - u); z = 0;
      }
      pos.push(x, y, z);
      const t = (x + 1.75) / 2.75;
      tmp.copy(cB).lerp(cA, t); if (Math.random() < 0.12) tmp.copy(cC);
      col.push(tmp.r, tmp.g, tmp.b);
      rnd.push(Math.random());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time, uScale: { value: 300 }, uPhase: { value: 0 }, uFogColor: U.fogColor, uFogDensity: U.fogDensity },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 color; attribute float aR; uniform float uTime, uScale, uPhase; varying vec3 vC; varying float vA;
        void main(){
          vec3 p = position;
          float w = sin(p.x*2.6 - uTime*3.2 + uPhase)*.22*(1.-smoothstep(-1.8,.8,p.x)*.75);
          p.z += w;
          p.y += sin(uTime*1.3 + uPhase)*.03;
          vec4 mv = modelViewMatrix*vec4(p,1.);
          float tw = .6 + .4*sin(uTime*4. + aR*40.);
          vC = color*tw; vA = 1.;
          gl_PointSize = (1.6 + aR*1.6)*uScale/max(-mv.z,1.)*.12;
          gl_Position = projectionMatrix*mv;
        }`,
      fragmentShader: `varying vec3 vC; void main(){ vec2 c=gl_PointCoord-.5; float d=length(c); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vC*a*1.6,1.); }`,
    });
    const kois = [];
    for (let k = 0; k < 2; k++) {
      const m = mat.clone(); m.uniforms.uTime = U.time; m.uniforms.uPhase.value = k * 2.1; m.uniforms.uScale = mat.uniforms.uScale;
      const pts = new THREE.Points(g, m); pts.scale.setScalar(14 - k * 3.5); pts.frustumCulled = false;
      scene.add(pts); kois.push(pts);
    }
    FX.koi = kois; FX.koiScale = mat.uniforms.uScale;
    FX.updateKoi = (t) => {
      kois.forEach((p, k) => {
        const sp = 0.09 + k * 0.025, a = t * sp + k * 2.4, R = 46 - k * 12;
        const cx = 0, cz = 0, y = 40 + Math.sin(t * 0.3 + k) * 6 + k * 9;
        p.position.set(cx + Math.cos(a) * R, y, cz + Math.sin(a) * R * 0.55);
        const dx = -Math.sin(a) * R, dz = Math.cos(a) * R * 0.55;
        p.rotation.set(0, Math.atan2(-dz, dx), Math.sin(t * 0.5 + k) * 0.12);
      });
    };
  };

  // ---------------- searchlights ----------------
  FX.makeSearchlights = function (scene, spots) {
    const geo = new THREE.CylinderGeometry(22, 0.8, 520, 20, 1, true);
    geo.translate(0, 260, 0);
    FX.beams = spots.map((s, i) => {
      const m = NC.M.additive(NC.T.beam, s.color, 0.08, { fog: false });
      const b = new THREE.Mesh(geo, m);
      b.position.set(s.x, s.y, s.z); b.userData = { ph: i * 1.7, sp: 0.16 + i * 0.03 };
      b.frustumCulled = false; NC.noRefl(b);
      scene.add(b); return b;
    });
    FX.updateBeams = (t) => FX.beams.forEach((b) => { const u = b.userData; b.rotation.set(0.34 + Math.sin(t * u.sp + u.ph) * 0.18, t * u.sp * 0.7 + u.ph, Math.cos(t * u.sp * 1.3 + u.ph) * 0.22, 'YXZ'); });
  };

  // ---------------- planar reflection at y = 0 ----------------
  class PlanarReflection {
    constructor(scale) {
      this.scale = scale;
      this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      this.rt.texture.generateMipmaps = false;
      this.cam = new THREE.PerspectiveCamera();
      this.cam.layers.set(0);
      this.tm = new THREE.Matrix4();
      this.v = new THREE.Vector3(); this.t = new THREE.Vector3(); this.u = new THREE.Vector3();
      this.plane = new THREE.Plane(); this.clip = new THREE.Vector4(); this.q = new THREE.Vector4();
      NC.M.reflUniforms.tReflect.value = this.rt.texture;
      NC.M.reflUniforms.uReflMat.value = this.tm;
    }
    setScale(s) { this.scale = s; NC.M.reflUniforms.uRefl.value = s > 0 ? 1 : 0; }
    setSize(w, h) { if (this.scale > 0) this.rt.setSize(Math.max(4, Math.floor(w * this.scale)), Math.max(4, Math.floor(h * this.scale))); }
    render(renderer, scene, camera) {
      if (!(this.scale > 0)) { NC.M.reflUniforms.uRefl.value = 0; return; }
      const cam = this.cam, cp = this.v.setFromMatrixPosition(camera.matrixWorld);
      if (cp.y < 0.05) { NC.M.reflUniforms.uRefl.value = 0; return; }
      NC.M.reflUniforms.uRefl.value = 1;
      this.t.set(0, 0, -1).applyQuaternion(camera.quaternion).add(cp);
      this.u.set(0, 1, 0).applyQuaternion(camera.quaternion);
      cam.position.set(cp.x, -cp.y, cp.z);
      cam.up.set(this.u.x, -this.u.y, this.u.z);
      cam.lookAt(this.t.x, -this.t.y, this.t.z);
      cam.near = camera.near; cam.far = camera.far;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      this.tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      this.tm.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      this.plane.set(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(cam.matrixWorldInverse);
      const c = this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
      const pm = cam.projectionMatrix, e = pm.elements, q = this.q;
      q.x = (Math.sign(c.x) + e[8]) / e[0]; q.y = (Math.sign(c.y) + e[9]) / e[5]; q.z = -1; q.w = (1 + e[10]) / e[14];
      c.multiplyScalar(2 / c.dot(q));
      e[2] = c.x; e[6] = c.y; e[10] = c.z + 1; e[14] = c.w;
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(scene, cam);
      renderer.setRenderTarget(prevRT);
    }
  }
  FX.PlanarReflection = PlanarReflection;

  // ---------------- post ----------------
  FX.setupPost = function (renderer, scene, camera, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    const composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.55, 0.8);
    composer.addPass(bloom);
    const fin = new THREE.ShaderPass(NC.M.FinalShader);
    composer.addPass(fin);
    FX.composer = composer; FX.bloom = bloom; FX.final = fin;
    return composer;
  };
})();
