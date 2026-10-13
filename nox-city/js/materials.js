/* Nox City — shader materials (facades, neon, signs, ads, wet ground, water, holograms) and PBR props. */
(function () {
  'use strict';
  const NC = window.NC;
  const U = NC.U;
  const M = (NC.M = {});

  const COMMON = /* glsl */`
    uniform vec3 uFogColor; uniform float uFogDensity; uniform float uTime;
    float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
    float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(h12(i),h12(i+vec2(1.,0.)),f.x), mix(h12(i+vec2(0.,1.)),h12(i+vec2(1.,1.)),f.x), f.y); }
    float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
    vec3 applyFog(vec3 c, float d, float dens){ float f=1.0-exp(-dens*dens*d*d); return mix(c, uFogColor, clamp(f,0.,1.)); }
    float lineAA(float d, float w){ float fw=fwidth(d); return 1.-smoothstep(w-fw, w+fw, abs(d)); }
  `;
  const sharedU = () => ({ uFogColor: U.fogColor, uFogDensity: U.fogDensity, uTime: U.time });
  const EXT = { derivatives: true };

  // ---------------- building facades ----------------
  M.building = function (fogMul = 0.85) {
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), uFogMul: { value: fogMul } },
      extensions: EXT,
      vertexShader: /* glsl */`
        attribute vec3 aB; varying vec3 vW; varying vec3 vN; varying vec3 vB; varying float vD;
        void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vB=aB;
          vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform float uFogMul;
        varying vec3 vW; varying vec3 vN; varying vec3 vB; varying float vD;
        vec3 winCol(float h){
          if(h<.46) return vec3(1.0,.70,.42);
          if(h<.84) return vec3(.78,.86,1.0);
          if(h<.91) return vec3(.35,.88,1.0);
          if(h<.96) return vec3(1.0,.34,.78);
          return vec3(.70,.52,1.0);
        }
        void main(){
          vec3 n=normalize(vN);
          float seed=vB.x, styleRaw=vB.y, top=vB.z;
          float shop = step(9.5, styleRaw); float style = styleRaw - shop*10.;
          vec3 base = mix(vec3(.020,.022,.038), vec3(.042,.036,.05), h12(vec2(seed,1.3)));
          vec3 col;
          if(n.y>.5){
            col = base*(.55+.5*vnoise(vW.xz*.4));
          } else if(n.y<-.5){
            col = base*.4;
          } else {
            float u = abs(n.x)>.5 ? vW.z*sign(n.x) : -vW.x*sign(n.z);
            float y = vW.y;
            float up = clamp(y/max(top,1.),0.,1.);
            vec3 wall = base*(.75+.45*up);
            wall += vec3(.22,.05,.17)*exp(-y/24.)*.3;
            wall += vec3(.05,.08,.16)*.22*max(0., n.x*.6+n.z*.4);
            int st = int(style+.5);
            float colW = st==1?2.4: st==2?1.7: st==3?4.2: 3.0;
            float flH = st==2?3.9:3.4;
            vec2 c = vec2(u/colW, y/flH);
            vec2 id=floor(c), f=fract(c), fw=fwidth(c);
            float mX = st==2?0.08: st==1?0.24: 0.18;
            float mB = st==2?0.10:0.26, mT = st==2?0.06:0.14;
            float wx = smoothstep(mX-fw.x, mX+fw.x, f.x)*(1.-smoothstep(1.-mX-fw.x, 1.-mX+fw.x, f.x));
            float wy = smoothstep(mB-fw.y, mB+fw.y, f.y)*(1.-smoothstep(1.-mT-fw.y, 1.-mT+fw.y, f.y));
            float win = wx*wy;
            float occ = (st==3?0.08: st==2?0.22: 0.30) + 0.22*h12(vec2(seed,7.7));
            float r = h12(id + vec2(seed*17.31, seed*5.13));
            float floorDark = step(h12(vec2(id.y*1.37, seed*31.7)), 0.13);
            float lit = step(r, occ)*(1.-floorDark);
            float hc = h12(id*1.31 + seed*3.7);
            vec3 wc = winCol(st==2 ? hc*.55+.45 : hc);
            float tv = step(.968, h12(id*3.3+seed*9.1));
            wc = mix(wc, vec3(.35,.55,1.)*(.55+.45*sin(uTime*6.+hc*40.)*sin(uTime*2.3+hc*13.)), tv);
            float inten = .28 + .62*h12(id*7.7+seed);
            vec3 litC = wc*inten*(.7+.4*f.y);
            vec3 glass = vec3(.028,.035,.07) + vec3(.07,.02,.09)*f.y*f.y;
            vec3 wcol = mix(glass, litC, lit);
            float lod = clamp(max(fw.x,fw.y)*1.5-.3, 0., 1.);
            vec3 avg = mix(wall, mix(glass, vec3(1.,.78,.62)*.62, occ), .55);
            col = mix(mix(wall, wcol, win), avg, lod);
            if(st==4){
              float by = fract(y/(flH*5.));
              float band = smoothstep(0.,.015,by)*(1.-smoothstep(.035,.05,by));
              vec3 bc = h12(vec2(seed,3.))<.5 ? vec3(1.,.18,.78) : vec3(.25,.9,1.);
              col += bc*band*2.4;
            }
            // crown light band
            float crown = smoothstep(top-1.6, top-1.3, y)*(1.-smoothstep(top-.7, top-.5, y));
            col += winCol(h12(vec2(seed,9.))*.5+.5)*crown*1.25*step(60., top);
            // storefronts
            if(shop>.5 && y<5.2){
              float sid = floor(u/6.); float sf = fract(u/6.);
              float hs = h12(vec2(sid, seed*3.1));
              vec3 sc = winCol(h12(vec2(sid*1.7, seed)));
              if(hs<.78){
                float gx = smoothstep(.04,.06,sf)*(1.-smoothstep(.94,.96,sf));
                float gy = smoothstep(.45,.6,y)*(1.-smoothstep(3.5,3.6,y));
                vec3 inside = sc*(.32+.3*smoothstep(.6,3.4,y))*(.75+.45*vnoise(vec2(u*1.3, y)));
                vec3 sh = mix(vec3(.03), inside, gx*gy);
                float sign = smoothstep(3.85,3.95,y)*(1.-smoothstep(4.6,4.7,y))*gx;
                sh += sc*sign*1.3;
                col = sh;
              } else {
                float stripe = .6+.4*step(.5, fract(y*4.));
                col = vec3(.05,.05,.06)*stripe*(.7+.3*vnoise(vec2(u*.7,y*.3)));
              }
            }
          }
          col = applyFog(col, length(vW - cameraPosition), uFogDensity*uFogMul);
          gl_FragColor = vec4(col,1.);
        }`,
    });
  };

  // ---------------- neon / signs (vertex colour + optional atlas map) ----------------
  M.neon = function (opts = {}) {
    const useMap = !!opts.map;
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), map: { value: opts.map || null }, uIntensity: { value: opts.intensity || 2.2 }, uFogMul: { value: opts.fogMul || 0.7 }, uOpacity: { value: opts.opacity ?? 1 } },
      defines: useMap ? { USE_MAP: '' } : {},
      transparent: !!opts.transparent, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !opts.additive, side: opts.side || THREE.FrontSide,
      extensions: EXT,
      vertexShader: /* glsl */`
        attribute vec3 color; attribute float aPhase;
        varying vec3 vC; varying float vP; varying vec2 vUv; varying float vD;
        void main(){ vC=color; vP=aPhase; vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D map; uniform float uIntensity, uFogMul, uOpacity;
        varying vec3 vC; varying float vP; varying vec2 vUv; varying float vD;
        void main(){
          float fl = 1.;
          if(vP > 0. && vP < 1.){ float k = h12(vec2(floor(uTime*9. + vP*91.), vP*13.)); fl = k < .045 ? .12 : (k<.07 ? .55 : 1.); }
          else if(vP < 0.){ fl = .08 + .92*step(.78, fract(uTime*.75 + vP*7.)); }
          else if(vP >= 2. && vP < 3.){ fl = .55 + .45*sin(uTime*2.2 + (vP-2.)*30.); }
          else if(vP >= 3.){ fl = .2 + .8*step(.5, fract(uTime*1.6 - (vP-3.)*6.)); }
          vec3 c = vC*uIntensity*fl;
          #ifdef USE_MAP
            c *= texture2D(map, vUv).rgb;
          #endif
          c = applyFog(c, vD, uFogDensity*uFogMul);
          gl_FragColor = vec4(c, uOpacity);
        }`,
    });
  };

  // ---------------- billboards (ads with scanlines + glitch) ----------------
  M.billboard = function (tex, opts = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), map: { value: tex }, uIntensity: { value: opts.intensity || 1.5 }, uSeed: { value: Math.random() * 10 }, uScroll: { value: opts.scroll || 0 }, uFogMul: { value: 0.6 } },
      side: opts.side || THREE.FrontSide,
      vertexShader: /* glsl */`varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D map; uniform float uIntensity, uSeed, uScroll, uFogMul;
        varying vec2 vUv; varying float vD;
        void main(){
          vec2 uv = vUv; uv.x += uTime*uScroll;
          float tick = floor(uTime*7. + uSeed*10.);
          float g = step(.975, h12(vec2(tick, uSeed)));
          float by = h12(vec2(tick, uSeed+1.));
          float band = step(abs(uv.y-by), .07);
          uv.x += g*band*.05*(h12(vec2(floor(uTime*40.), uSeed))-.5);
          vec3 c = texture2D(map, uv).rgb;
          c.r = mix(c.r, texture2D(map, uv+vec2(.006,0.)).r, g);
          c.b = mix(c.b, texture2D(map, uv-vec2(.006,0.)).b, g);
          float scan = .88 + .12*sin(vUv.y*1400. - uTime*6.);
          float roll = .9 + .1*smoothstep(0., .08, abs(fract(vUv.y*.5 - uTime*.12)-.5));
          c *= uIntensity*scan*roll*(1.-g*.3);
          c = applyFog(c, vD, uFogDensity*uFogMul);
          gl_FragColor = vec4(c,1.);
        }`,
    });
  };

  // ---------------- additive hologram ----------------
  M.holo = function (color = 0x5ef2ff, opts = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(opts.color2 || color) }, uAlpha: { value: opts.alpha || 0.8 }, uMap: { value: opts.map || null }, uUseMap: { value: opts.map ? 1 : 0 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: /* glsl */`varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vD;
        void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform vec3 uColor, uColor2; uniform float uAlpha, uUseMap; uniform sampler2D uMap;
        varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying float vD;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float fr = pow(1.-abs(dot(normalize(vN), V)), 1.5);
          float scan = .55 + .45*step(.5, fract(vW.y*3. - uTime*1.5));
          float fl = .85 + .15*sin(uTime*40.)*step(.92, h12(vec2(floor(uTime*8.),1.)));
          vec3 c = mix(uColor, uColor2, clamp(vUv.y,0.,1.));
          float a = (.25 + fr*.9)*scan*fl*uAlpha;
          if(uUseMap>.5){ vec4 t = texture2D(uMap, vUv); a = t.a*uAlpha*scan*fl; c *= t.rgb*1.6; }
          c = applyFog(c*a, vD, uFogDensity*.6);
          gl_FragColor = vec4(c, 1.);
        }`,
    });
  };

  // ---------------- additive soft decal (light pools, beams, glows) ----------------
  M.additive = function (tex, color = 0xffffff, opacity = 1, opts = {}) {
    const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: opts.side || THREE.DoubleSide, fog: opts.fog !== false, vertexColors: !!opts.vertexColors });
    return m;
  };

  // ---------------- wet ground / floors with planar reflection ----------------
  M.reflUniforms = { tReflect: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uRefl: { value: 0 } };
  M.ground = function (kind = 0, opts = {}) {
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), ...M.reflUniforms, uRefl: opts.planar === false ? { value: 0 } : M.reflUniforms.uRefl, tEnv: { value: NC.T.env }, uKind: { value: kind }, uAmb: { value: opts.amb ?? 1 }, uWet: { value: opts.wet ?? 1 }, uTint: { value: new THREE.Color(opts.tint || 0xffffff) } },
      extensions: EXT,
      vertexShader: /* glsl */`
        uniform mat4 uReflMat; varying vec3 vW; varying vec3 vN; varying vec4 vR; varying float vD;
        void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normalize(mat3(modelMatrix)*normal); vR=uReflMat*w;
          vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D tReflect; uniform sampler2D tEnv; uniform float uRefl, uKind, uAmb, uWet; uniform vec3 uTint;
        varying vec3 vW; varying vec3 vN; varying vec4 vR; varying float vD;
        vec3 roadMarks(vec2 p){
          float ax = abs(p.y);
          float xc = floor(p.x/70.+.5)*70.; float dx = p.x-xc;
          float k = floor((ax-41.)/70.+.5); float zc = 41.+70.*k; float dz = (ax-zc)*sign(p.y);
          bool onNS = abs(dx) < 7.;
          bool onEW = ax > 33.9 && abs(dz) < 7. && k > -.5;
          bool inner = abs(p.x) < 215. && ax < 256.;
          float yel=0., wht=0.;
          if(onNS && onEW){
            if(inner){
              float d1 = abs(dx-dz)*.7071, d2 = abs(dx+dz)*.7071;
              float s1 = step(fract((dx+dz)*.7071/1.2), .5)*step(d1, 1.6);
              float s2 = step(fract((dx-dz)*.7071/1.2), .5)*step(d2, 1.6);
              wht = max(s1, s2)*step(abs(dx),6.)*step(abs(dz),6.);
            }
          } else if(onEW){
            if(abs(dx) > 7.6 && abs(dx) < 11.){ wht = step(fract(dz/1.2), .55)*step(abs(dz), 6.4); }
            else {
              yel = lineAA(abs(dz)-.22, .07);
              wht = lineAA(abs(dz)-3.5, .07)*step(fract(p.x/9.), .5) + lineAA(abs(dz)-6.55, .08);
              if(abs(dx) < 13.) wht += (step(0.,dz)*lineAA(dx+11.7,.22) + step(dz,0.)*lineAA(dx-11.7,.22));
            }
          } else if(onNS){
            float ez = ax - 41.; // distance from bank road for bridge region
            if(abs(dz) > 7.6 && abs(dz) < 11. && ax > 33.9){ wht = step(fract(dx/1.2), .55)*step(abs(dx), 6.4); }
            else {
              yel = lineAA(abs(dx)-.22, .07);
              wht = lineAA(abs(dx)-3.5, .07)*step(fract(p.y/9.), .5) + lineAA(abs(dx)-6.55, .08);
              if(abs(dz) < 13. && ax > 33.9) wht += (step(dx,0.)*lineAA(dz+11.7,.22) + step(0.,dx)*lineAA(dz-11.7,.22));
            }
          }
          float wear = .55 + .45*vnoise(p*1.7);
          return (vec3(1.,.78,.18)*yel*.6 + vec3(.85)*wht*.42)*wear;
        }
        void main(){
          vec3 n = normalize(vN);
          vec3 V = normalize(cameraPosition - vW);
          vec2 p = vW.xz;
          vec3 alb; vec3 mark = vec3(0.); float wet = .6; float smear = 1.; float pudAmt = 1.; float ripK = 1.;
          int kind = int(uKind+.5);
          if(kind==0){
            if(n.y < .5){ alb = vec3(.10,.10,.11); wet=.25; }
            else if(vW.y > .07){
              vec2 t = p/1.2; vec2 f = abs(fract(t)-.5);
              float grout = smoothstep(.46,.5,max(f.x,f.y));
              alb = vec3(.085,.082,.095)*(.75+.5*h12(floor(t)))*(1.-grout*.55);
              wet = .5;
            } else {
              alb = vec3(.034,.034,.042)*(.7+.6*vnoise(p*.9))*(.8+.4*vnoise(p*.04));
              mark = roadMarks(p);
              wet = .7;
            }
          } else if(kind==1){ // black marble
            vec2 t = p/2.; vec2 f = abs(fract(t)-.5);
            float seam = smoothstep(.485,.5,max(f.x,f.y));
            float vein = pow(abs(sin(p.x*.9 + p.y*.4 + fbm(p*.5)*7.)), 18.);
            alb = vec3(.018,.018,.022) + vec3(.35,.3,.25)*vein*.25 - seam*.01;
            wet = 1.; smear = .15; pudAmt = 0.; ripK = .08;
          } else if(kind==2){ // rooftop concrete
            alb = vec3(.06,.06,.065)*(.6+.7*fbm(p*.6));
            vec2 f = abs(fract(p/3.)-.5); alb *= 1.-smoothstep(.48,.5,max(f.x,f.y))*.5;
            wet = .55;
          } else if(kind==3){ // dark wood
            float plank = floor(p.x/.22); float g = fract(p.y/2.4 + h12(vec2(plank,1.)));
            alb = vec3(.09,.05,.03)*(.7+.5*h12(vec2(plank,floor(p.y/2.4 + h12(vec2(plank,1.))))))*(.85+.15*sin(p.y*30.+plank));
            alb *= 1.-smoothstep(.46,.5,abs(fract(p.x/.22)-.5))*.6;
            wet = .35; smear = .4; pudAmt = 0.; ripK = .08;
          } else if(kind==4){ // glossy black club floor
            alb = vec3(.012,.012,.02); wet = 1.; smear = .2; pudAmt = 0.; ripK = .08;
          } else { // konbini white tiles
            vec2 t = p/.6; vec2 f = abs(fract(t)-.5);
            alb = vec3(.62,.64,.66)*(.92+.08*h12(floor(t)))*(1.-smoothstep(.46,.5,max(f.x,f.y))*.25);
            wet = .45; smear = .1; pudAmt = 0.; ripK = .08;
          }
          float pud = smoothstep(.5,.62, fbm(p*.085+3.1))*pudAmt;
          float wetAmt = clamp(wet*uWet + pud*.55, 0., 1.);
          vec2 rip = vec2(vnoise(p*2.3+uTime*.7)-.5, vnoise(p.yx*2.1-uTime*.6)-.5)*.007*ripK;
          vec2 cell = floor(p*1.4); vec2 cp = fract(p*1.4)-.5;
          float ph = fract(uTime*1.1 + h12(cell)*7.);
          float ring = (1.-smoothstep(0.,.06,abs(length(cp)-ph*.5)))*(1.-ph);
          rip += normalize(cp+1e-4)*ring*.012*(pud+.2)*pudAmt*uWet;
          float NdV = clamp(dot(n,V),0.,1.);
          float F = .04 + .96*pow(1.-NdV, 5.);
          vec3 refl;
          if(uRefl > .5 && n.y > .5){
            vec4 rc = vR; rc.xy += rip*rc.w*(1.4 - pud*.6);
            vec3 s = texture2DProj(tReflect, rc).rgb;
            vec4 r2 = rc; float sm = .012*smear*(1.-pud*.7);
            r2.y += sm*rc.w; s += texture2DProj(tReflect, r2).rgb*.9;
            r2.y += sm*1.5*rc.w; s += texture2DProj(tReflect, r2).rgb*.75;
            r2.y += sm*2.2*rc.w; s += texture2DProj(tReflect, r2).rgb*.55;
            refl = s/3.2;
          } else {
            vec3 r = reflect(-V, n); r.xz += rip*6.;
            vec2 euv = vec2(atan(r.z, r.x)/6.2831853+.5, 1.-acos(clamp(r.y,-1.,1.))/3.14159265);
            refl = texture2D(tEnv, euv, 2.5).rgb*.45;
          }
          float k = mix(.06, .8, wetAmt)*(.3+.7*F);
          vec3 col = (alb*uTint + mark)*uAmb*.9 + refl*k;
          col = applyFog(col, length(vW - cameraPosition), uFogDensity);
          gl_FragColor = vec4(col,1.);
        }`,
    });
  };

  // ---------------- river water ----------------
  M.water = function () {
    return new THREE.ShaderMaterial({
      uniforms: { ...sharedU(), ...M.reflUniforms, tEnv: { value: NC.T.env } },
      vertexShader: /* glsl */`
        uniform mat4 uReflMat; varying vec3 vW; varying vec4 vR; varying float vD;
        void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vR=uReflMat*vec4(w.x, 0., w.z, 1.); vec4 mv=viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: COMMON + /* glsl */`
        uniform sampler2D tReflect; uniform sampler2D tEnv; uniform float uRefl;
        varying vec3 vW; varying vec4 vR; varying float vD;
        void main(){
          vec2 p = vW.xz; float t = uTime;
          vec2 d1 = vec2(fbm(p*vec2(.05,.12)+vec2(t*.08,0.)), fbm(p*vec2(.05,.12)+vec2(4.,t*.05)))-.5;
          vec2 d2 = vec2(vnoise(p*vec2(.35,.7)+vec2(t*.6,t*.15)), vnoise(p*vec2(.4,.8)-vec2(t*.5,t*.2)))-.5;
          vec2 dist = d1*.035 + d2*.012;
          vec3 V = normalize(cameraPosition - vW);
          vec3 n = normalize(vec3(dist.x*3., 1., dist.y*3.));
          float F = .03 + .97*pow(1.-clamp(dot(n,V),0.,1.), 4.);
          vec3 refl;
          if(uRefl>.5){
            vec4 rc = vR; rc.xy += dist*rc.w*1.2;
            vec3 s = texture2DProj(tReflect, rc).rgb; vec4 r2 = rc;
            r2.y += .015*rc.w; s += texture2DProj(tReflect, r2).rgb*.9;
            r2.y += .02*rc.w; s += texture2DProj(tReflect, r2).rgb*.8;
            r2.y += .03*rc.w; s += texture2DProj(tReflect, r2).rgb*.65;
            r2.y += .04*rc.w; s += texture2DProj(tReflect, r2).rgb*.5;
            refl = s/3.;
          } else {
            vec3 r = reflect(-V, n);
            vec2 euv = vec2(atan(r.z, r.x)/6.2831853+.5, 1.-acos(clamp(r.y,-1.,1.))/3.14159265);
            refl = texture2D(tEnv, euv, 1.5).rgb*.8;
          }
          vec3 base = vec3(.006,.01,.026);
          float flow = smoothstep(.62,.7, vnoise(vec2(p.x*.04 - t*.5, p.y*.6)))*.04;
          vec3 col = base + refl*(.35+.65*F) + vec3(.4,.2,.6)*flow;
          col = applyFog(col, length(vW - cameraPosition), uFogDensity);
          gl_FragColor = vec4(col,1.);
        }`,
    });
  };

  // ---------------- PBR-ish props (lit by the light pool + env) ----------------
  M.initStandard = function (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(NC.T.env).texture;
    M.envMap = env;
    const S = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMap: env, envMapIntensity: 1 }, o));
    M.props = S({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
    M.propsGloss = S({ vertexColors: true, roughness: 0.25, metalness: 0.6, envMapIntensity: 1.4 });
    M.metal = S({ color: 0x2a2d38, roughness: 0.35, metalness: 0.85 });
    M.dark = S({ color: 0x0c0d12, roughness: 0.6, metalness: 0.4 });
    M.concrete = S({ color: 0x24252b, roughness: 0.9, metalness: 0.05 });
    M.chrome = S({ color: 0x9aa0b0, roughness: 0.12, metalness: 1.0, envMapIntensity: 1.6 });
    M.fabric = S({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
    M.glass = S({ color: 0x1c2a3a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.22, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide });
    M.glassRail = S({ color: 0x2a3a4a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.12, envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    M.glassDark = S({ color: 0x0a0f18, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.55, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
    M.carPaint = S({ roughness: 0.22, metalness: 0.75, envMapIntensity: 1.6 });
    M.human = S({ roughness: 0.75, metalness: 0.08, envMapIntensity: 0.8 });
    M.basic = (c, k = 1) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) }); return m; };
    return env;
  };

  // ---------------- final post shader ----------------
  M.FinalShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 1 }, uDrunk: { value: 0 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uExposure: { value: 1.15 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime, uCA, uDrunk, uFade, uExposure; uniform vec2 uRes; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv = vUv;
        if(uDrunk > 0.){ uv += vec2(sin(uTime*1.3+uv.y*6.), cos(uTime*1.1+uv.x*5.))*.008*uDrunk; }
        vec2 cc = uv-.5; float r2 = dot(cc,cc);
        vec2 off = cc*r2*.012*uCA + vec2(.003,0.)*uDrunk;
        vec3 c;
        c.r = texture2D(tDiffuse, uv+off).r;
        c.g = texture2D(tDiffuse, uv).g;
        c.b = texture2D(tDiffuse, uv-off).b;
        if(uDrunk > 0.){ c = mix(c, texture2D(tDiffuse, uv+vec2(.012,.004)*uDrunk).rgb, .35*uDrunk); }
        c *= uExposure;
        c = c/(1.+c*.32);                        // soft shoulder
        c = pow(c, vec3(.95));
        c += vec3(.012,.004,.03)*(1.-c);          // lift blacks toward violet
        float lum = dot(c, vec3(.299,.587,.114));
        c = mix(vec3(lum), c, 1.12);             // a touch of saturation
        c *= 1. - r2*.85;                        // vignette
        c += (hh(uv*uRes + fract(uTime)*91.)-.5)*.035;  // grain
        c = mix(c, vec3(0.), uFade);
        gl_FragColor = vec4(c,1.);
      }`,
  };
})();
