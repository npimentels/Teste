/* Nox City — boot, render loop, dynamic light pool, dynamic resolution, quality presets, intro shot. */
(async function () {
  'use strict';
  const NC = window.NC, FX = NC.FX, M = NC.M;
  NC.UI.init();
  NC.progress(0.03, 'Carregando fontes…');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('900 60px "Noto Sans JP"', '夜の街は眠らない'), document.fonts.load('700 60px "Chakra Petch"'), document.fonts.load('400 20px "Share Tech Mono"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fall back to system fonts */ }

  // ---------------- renderer ----------------
  let Q = NC.Q();
  const app = document.getElementById('app');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    NC.progress(0, 'Seu navegador não conseguiu iniciar o WebGL. Tente outro navegador ou ative a aceleração de hardware.');
    return;
  }
  NC.renderer = renderer;
  let W = innerWidth, H = innerHeight;
  let pr = Math.min(devicePixelRatio || 1, Q.prMax) * Q.pr;
  renderer.setPixelRatio(pr); renderer.setSize(W, H);
  renderer.setClearColor(0x0a0614);
  app.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(NC.U.fogColor.value, NC.U.fogDensity.value);
  const camera = new THREE.PerspectiveCamera(70, W / H, 0.15, 2600);
  camera.layers.enable(NC.LAYER_NOREFL); camera.layers.enable(NC.LAYER_SURF);
  NC.scene = scene; NC.camera = camera;

  scene.add(new THREE.HemisphereLight(0x6660a8, 0x1a0e22, 0.5));
  const moonL = new THREE.DirectionalLight(0x8aa0ff, 0.35); moonL.position.copy(FX.moonDir).multiplyScalar(100); scene.add(moonL);
  const POOL_N = Q.lights;
  const pool = [];
  for (let i = 0; i < POOL_N; i++) { const l = new THREE.PointLight(0xffffff, 0, 14, 1.6); l.userData = { a: null, next: null }; scene.add(l); pool.push(l); }

  NC.progress(0.08, 'Pintando os letreiros…');
  await NC.wait();
  M.initStandard(renderer);
  NC.T.buildAds();
  NC.progress(0.2, 'Levantando os prédios…');
  await NC.wait();
  NC.World.begin();
  NC.World.generate();
  NC.progress(0.42, 'Abrindo o clube, o lámen e o konbini…');
  await NC.wait();
  NC.Interiors.build();
  NC.progress(0.55, 'Soltando o trânsito…');
  await NC.wait();
  const MAXH = 340;
  NC.Humans.init(scene, MAXH);
  NC.Traffic.init(scene);
  NC.progress(0.68, 'Ligando o neon…');
  await NC.wait();
  NC.World.finish(scene);
  NC.Interiors.finish(scene);
  NC.progress(0.78, 'Chamando os pedestres…');
  await NC.wait();
  NC.Humans.buildGraph();
  NC.Humans.spawnPeds(NC.QUALITY.high.peds);
  NC.Humans.setPedCount(Q.peds);
  NC.Humans.spawnNPCs();
  NC.Humans.addPlayer();
  NC.progress(0.86, 'Fazendo chover…');
  await NC.wait();
  FX.makeSky(scene);
  FX.makeRain(scene, NC.QUALITY.high.rain); FX.setRainCount(Q.rain);
  FX.makeSplashes(scene);
  FX.makeSteam(scene);
  FX.makeKoi(scene);
  FX.makeSearchlights(scene, [
    { x: 35, y: 300, z: -79, color: 0x9fd8ff }, { x: -150, y: 200, z: -160, color: 0xff8ad8 },
    { x: 240, y: 190, z: -230, color: 0x9fd8ff }, { x: -280, y: 170, z: 250, color: 0xffd28a },
  ]);
  const refl = new FX.PlanarReflection(Q.refl);
  refl.setScale(Q.refl);
  const composer = FX.setupPost(renderer, scene, camera, W, H);
  composer.setPixelRatio(pr); composer.setSize(W, H);
  refl.setSize(W * pr, H * pr);
  NC.player.init(camera, renderer.domElement);
  NC.progress(0.95, 'Compilando shaders…');
  await NC.wait();

  // ---------------- resize / quality ----------------
  function fovFor(aspect) { return NC.clamp((2 * Math.atan(Math.tan((37 * Math.PI) / 180) / aspect) * 180) / Math.PI, 64, 85); }
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H); composer.setSize(W, H);
    camera.aspect = W / H; NC.player.fovBase = fovFor(camera.aspect); camera.fov = NC.player.fov = NC.player.mode === 'scope' ? camera.fov : NC.player.fovBase;
    camera.updateProjectionMatrix();
    refl.setSize(W * pr, H * pr);
    FX.final.uniforms.uRes.value.set(W * pr, H * pr);
    const s = H * pr * 0.5; FX.splash.material.uniforms.uScale.value = s; FX.steam.pts.material.uniforms.uScale.value = s; FX.koiScale.value = s;
  }
  function setPR(v) {
    pr = v; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize();
  }
  addEventListener('resize', resize);
  resize();
  NC.applyQuality = function (q) {
    Q = NC.QUALITY[q] || Q;
    refl.setScale(Q.refl); refl.setSize(W * pr, H * pr);
    FX.setRainCount(Q.rain);
    NC.Humans.setPedCount(Q.peds);
    NC.Traffic.setDensity(Math.min(1, Q.cars / NC.Traffic.initDensity));
    FX.bloom.strength = 0.85 * Q.bloom;
    FX.final.uniforms.uCA.value = Q.ca;
    setPR(Math.min(devicePixelRatio || 1, Q.prMax) * Q.pr);
    NC.UI.toast(`Qualidade: <b>${{ low: 'baixa', medium: 'média', high: 'alta' }[q]}</b>`);
  };
  FX.bloom.strength = 0.85 * Q.bloom; FX.final.uniforms.uCA.value = Q.ca;

  // ---------------- light pool ----------------
  let poolT = 0;
  const tv = new THREE.Vector3();
  function updatePool(dt, cp) {
    poolT -= dt;
    if (poolT <= 0) {
      poolT = 0.3;
      const cands = [];
      for (const a of NC.lightAnchors) {
        const dx = a.x - cp.x, dy = (a.y - cp.y) * 1.5, dz = a.z - cp.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > a.distance * 2.2 + 6) continue;
        cands.push({ a, s: d / (a.w * Math.sqrt(a.intensity)) });
      }
      cands.sort((x, y) => x.s - y.s);
      const want = cands.slice(0, pool.length).map((c) => c.a);
      const free = [];
      for (const l of pool) { if (l.userData.a && want.includes(l.userData.a)) want.splice(want.indexOf(l.userData.a), 1); else free.push(l); }
      free.forEach((l, i) => { l.userData.next = want[i] || null; });
    }
    for (const l of pool) {
      const u = l.userData;
      if (u.next !== null && u.next !== u.a) {
        l.intensity = Math.max(0, l.intensity - dt * 8);
        if (l.intensity <= 0.02) { u.a = u.next; u.next = null; if (u.a) { l.position.set(u.a.x, u.a.y, u.a.z); l.distance = u.a.distance; } }
      } else {
        u.next = null;
        const target = u.a ? u.a.intensity * 1.5 : 0;
        l.intensity = NC.damp(l.intensity, target, 6, dt);
        if (u.a) l.color.copy(u.a.color);
      }
    }
  }

  // ---------------- intro shot ----------------
  const seat = NC.Interiors.startSeat;
  const cine = { going: false, t0: 0, from: new THREE.Vector3(105.2, 47.3, 49.4), look: new THREE.Vector3(76, 40.5, 42), q0: new THREE.Quaternion(), q1: new THREE.Quaternion() };
  NC.player.mode = 'cinematic';
  NC.player.pos.set(seat.standX, seat.standY, seat.standZ);
  function cineCam(t) {
    const s = Math.sin(t * 0.15) * 0.6;
    camera.position.set(cine.from.x + s * 0.4, cine.from.y + Math.sin(t * 0.21) * 0.12, cine.from.z + s);
    camera.lookAt(cine.look);
  }
  NC.startPlay = function () { cine.going = true; cine.t0 = NC.U.time.value; cine.q0.copy(camera.quaternion); cine.p0 = camera.position.clone(); };
  const eul = new THREE.Euler();

  // ---------------- loop ----------------
  let last = performance.now(), t = 0, fpsAcc = 0, fpsN = 0, drsAcc = 0, drsN = 0, drsCool = 3;
  const fpsEl = document.getElementById('fps');
  const P = NC.player;
  let rainA = 1;
  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000; last = now;
    const dt = Math.min(0.05, Math.max(0.0001, rawDt));
    t += dt; NC.U.time.value = t;
    const beats = NC.Audio.beat(t);
    NC.beatCount = Math.floor(beats); NC.beatPhase = beats - Math.floor(beats);
    NC.U.beat.value = Math.exp(-NC.beatPhase * 5);

    // player / camera
    if (P.mode === 'cinematic') {
      if (cine.going) {
        const k = Math.min(1, (t - cine.t0) / 2.2), e = k * k * (3 - 2 * k);
        eul.set(-0.12, seat.yaw, 0, 'YXZ'); cine.q1.setFromEuler(eul);
        camera.position.lerpVectors(cine.p0, new THREE.Vector3(seat.x, seat.y + 0.78, seat.z), e);
        camera.quaternion.slerpQuaternions(cine.q0, cine.q1, e);
        if (k >= 1) {
          P.enabled = true; P.mode = 'walk'; P.sit(seat); P.pitch = -0.12;
          NC.UI.toast('Bem-vindo a <b>Nox City</b>. Mova-se para levantar. O mapa tem viagem rápida.', 6000);
        }
      } else cineCam(t);
    } else if (!NC.UI.anyOpen()) P.update(dt, t);
    else { P.keys = {}; P.update(0.0001, t); }

    // zone
    const zx = P.mode === 'sit' ? P.seat.x : P.pos.x, zy = P.mode === 'sit' ? P.seat.y : P.pos.y, zz = P.mode === 'sit' ? P.seat.z : P.pos.z;
    const zone = NC.zoneAt(zx, zy, zz);
    NC.zoneIndoor = !!(zone && zone.indoor);
    const zoneName = zone ? zone.name : NC.World.districtAt(zx, zz);
    if (zone && zone.chime && !NC.lastChime) NC.Audio.chime();
    NC.lastChime = zone && zone.chime;

    rainA = NC.damp(rainA, NC.settings.rain && !NC.zoneIndoor ? 1 : 0, 7, dt);
    FX.rain.material.uniforms.uAlpha.value = rainA;
    FX.rain.material.uniforms.uCam.value.copy(camera.position);
    FX.rain.visible = rainA > 0.01;
    FX.splash.material.uniforms.uCam.value.copy(camera.position);
    FX.splash.material.uniforms.uGround.value = P.mode === 'cinematic' ? seat.standY : P.pos.y;
    FX.splash.material.uniforms.uAlpha.value = rainA;
    FX.splash.visible = rainA > 0.01;

    const ph = NC.Traffic.update(t, dt, camera.position);
    const av = P.mode === 'cinematic' ? { show: true, x: seat.x, y: seat.y - 0.66, z: seat.z, ry: seat.yaw + Math.PI, anim: 'sit', speed: 0, seatH: 0.6 } : (P.avatar || { show: false });
    NC.Humans.update(t, dt, camera.position, ph, av);
    NC.Interiors.update(t, dt, NC.U.beat.value, P.pos);
    FX.updateSteam(dt, camera.position);
    FX.updateKoi(t);
    FX.updateBeams(t);
    FX.sky.position.copy(camera.position);
    updatePool(dt, camera.position);
    NC.Audio.update(P.mode === 'sit' ? P.seat : P.pos, zone, dt);
    if (P.enabled) { NC.UI.prompt(P.target, P.mode); NC.UI.hud(false, zoneName, dt); }

    const fu = FX.final.uniforms;
    fu.uTime.value = t;
    fu.uDrunk.value = NC.damp(fu.uDrunk.value, NC.U.drunk || 0, 2, dt);
    camera.updateMatrixWorld();
    refl.render(renderer, scene, camera);
    composer.render();

    // fps + dynamic resolution
    fpsAcc += rawDt; fpsN++;
    if (fpsAcc > 0.5) { if (NC.settings.fps) fpsEl.textContent = `${Math.round(fpsN / fpsAcc)} fps · ${pr.toFixed(2)}x · ${renderer.info.render.calls} dc`; fpsAcc = 0; fpsN = 0; }
    drsAcc += rawDt; drsN++; drsCool -= rawDt;
    if (drsAcc > 1.5) {
      const avg = drsAcc / drsN; drsAcc = 0; drsN = 0;
      if (drsCool <= 0 && document.visibilityState === 'visible') {
        const maxPr = Math.min(devicePixelRatio || 1, Q.prMax);
        if (avg > 1 / 42 && pr > 0.55) { setPR(Math.max(0.55, pr - 0.15)); drsCool = 2.5; }
        else if (avg < 1 / 57 && pr < maxPr - 0.01) { setPR(Math.min(maxPr, pr + 0.1)); drsCool = 4; }
      }
    }
  }
  // warm up shaders before showing the button
  cineCam(0);
  camera.updateMatrixWorld();
  try { renderer.compile(scene, camera); } catch (e) {}
  requestAnimationFrame(frame);
  setTimeout(() => NC.UI.ready(), 300);
})();
