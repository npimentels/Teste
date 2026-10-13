/* Nox City — player: physics + collision, first/third person camera, keyboard/mouse/touch input, sitting,
   binoculars, dancing, items and buffs. */
(function () {
  'use strict';
  const NC = window.NC;
  const L = NC.L;
  const V3 = THREE.Vector3;
  const P = (NC.player = {});
  const R = 0.32, HEIGHT = 1.75, EYE = 1.62, STEP = 0.55, GRAV = 22;

  P.init = function (camera, dom) {
    P.cam = camera; P.dom = dom;
    P.pos = new V3(100, 44, 53.4); P.vel = new V3();
    P.yaw = Math.PI / 2; P.pitch = -0.08; P.onGround = true; P.mode = 'walk';
    P.third = false; P.run = false; P.camY = P.pos.y; P.bob = 0; P.lastStep = 0;
    P.money = 250; P.buffs = {}; P.umbrella = false; P.atmAt = -999; P.fallStart = P.pos.y;
    P.fovBase = 70; P.fov = 70; P.lookRoll = 0;
    P.keys = {}; P.move = { x: 0, y: 0 }; P.joy = { x: 0, y: 0 }; P.jumpQ = false; P.useQ = false;
    P.tmp = []; P.avatarRy = 0; P.speed = 0;
    P.enabled = false;
    P.bindInput();
  };

  // ---------------- input ----------------
  P.bindInput = function () {
    const overlayOpen = () => !!document.querySelector('.overlay.on');
    addEventListener('keydown', (e) => {
      if (e.repeat && (e.code === 'KeyE' || e.code === 'Space')) { e.preventDefault(); return; }
      if (e.code === 'Escape') { NC.UI.closeAll(); return; }
      if (overlayOpen()) { if (e.code === 'KeyM' && NC.UI.isOpen('mapUI')) NC.UI.closeAll(); return; }
      if (!P.enabled) { if (e.code === 'Enter') NC.UI.enter(); return; }
      P.keys[e.code] = true;
      if (e.code === 'Space') { P.jumpQ = true; e.preventDefault(); }
      if (e.code === 'KeyE') P.useQ = true;
      if (e.code === 'KeyM') NC.UI.openMap();
      if (e.code === 'KeyV') P.toggleView();
      if (e.code === 'KeyF') NC.UI.togglePhoto();
      if (e.code === 'KeyR') P.run = !P.run;
    });
    addEventListener('keyup', (e) => { P.keys[e.code] = false; });
    addEventListener('blur', () => { P.keys = {}; });
    const c = P.dom;
    let drag = null;
    c.addEventListener('mousedown', (e) => {
      if (!P.enabled || NC.isTouchUI) return;
      if (document.pointerLockElement !== c) {
        try { const r = c.requestPointerLock && c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* drag fallback */ }
        drag = { x: e.clientX, y: e.clientY };
      }
    });
    addEventListener('mouseup', () => { drag = null; });
    addEventListener('mousemove', (e) => {
      if (!P.enabled || NC.isTouchUI) return;
      if (document.pointerLockElement === c) P.look(e.movementX, e.movementY, 0.0022);
      else if (drag) { P.look(e.clientX - drag.x, e.clientY - drag.y, 0.004); drag = { x: e.clientX, y: e.clientY }; }
    });
    // touch layer
    const layer = document.getElementById('touch');
    const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
    let jp = null, lp = null;
    const resetJoy = () => { joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = ''; knob.style.transform = ''; joyEl.classList.remove('act'); P.joy.x = P.joy.y = 0; };
    layer.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      NC.isTouchUI = true;
      if (e.clientX < innerWidth * 0.45 && !jp) {
        jp = { id: e.pointerId, x: e.clientX, y: e.clientY };
        joyEl.style.left = (e.clientX - 64) + 'px'; joyEl.style.top = (e.clientY - 64) + 'px'; joyEl.style.bottom = 'auto';
        joyEl.classList.add('act');
      } else if (!lp) lp = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      try { layer.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    layer.addEventListener('pointermove', (e) => {
      if (jp && e.pointerId === jp.id) {
        let dx = e.clientX - jp.x, dy = e.clientY - jp.y; const d = Math.hypot(dx, dy), m = 56;
        if (d > m) { dx *= m / d; dy *= m / d; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        P.joy.x = dx / m; P.joy.y = dy / m;
      } else if (lp && e.pointerId === lp.id) {
        P.look(e.clientX - lp.x, e.clientY - lp.y, 0.0052);
        lp.x = e.clientX; lp.y = e.clientY;
      }
      e.preventDefault();
    });
    const up = (e) => {
      if (jp && e.pointerId === jp.id) { jp = null; resetJoy(); }
      if (lp && e.pointerId === lp.id) {
        // quick tap on the right side = interact while scoping / sitting
        if (performance.now() - lp.t < 220 && Math.hypot(e.clientX - lp.sx, e.clientY - lp.sy) < 10 && (P.mode === 'scope')) P.useQ = true;
        lp = null;
      }
    };
    layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', up);
    const tb = (id, fn) => { const b = document.getElementById(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); NC.isTouchUI = true; fn(b); }); };
    tb('tJump', () => { P.jumpQ = true; });
    tb('tRun', (b) => { P.run = !P.run; b.classList.toggle('on', P.run); });
    tb('tUse', () => { P.useQ = true; });
  };

  P.look = function (dx, dy, k) {
    const s = k * NC.settings.sens * (P.mode === 'scope' ? 0.25 : 1);
    P.yaw -= dx * s; P.pitch -= dy * s;
    P.pitch = NC.clamp(P.pitch, -1.45, 1.45);
    if (P.mode === 'scope') {
      let d = P.yaw - P.scopeYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      P.yaw = P.scopeYaw + NC.clamp(d, -1.2, 1.2); P.pitch = NC.clamp(P.pitch, -0.6, 0.5);
    }
  };

  P.toggleView = function () {
    P.third = !P.third;
    document.getElementById('bView').textContent = P.third ? '3ª' : '1ª';
    NC.UI.toast(P.third ? 'Câmera em 3ª pessoa' : 'Câmera em 1ª pessoa');
  };

  // ---------------- actions ----------------
  P.sit = function (seat) {
    if (P.mode === 'sit') return;
    P.mode = 'sit'; P.seat = seat; P.vel.set(0, 0, 0);
    P.yaw = seat.yaw; P.pitch = seat.ledge ? -0.12 : -0.05;
    NC.UI.toast('Sentado. Mova-se ou toque <b>Levantar</b> para sair.');
  };
  P.stand = function () {
    const s = P.seat; if (!s) { P.mode = 'walk'; return; }
    if (s.standX !== undefined) P.pos.set(s.standX, s.standY + 0.02, s.standZ);
    else { const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); P.pos.set(s.x + fx * 0.8, s.y - 0.3, s.z + fz * 0.8); }
    P.camY = P.pos.y; P.mode = 'walk'; P.seat = null; P.vel.set(0, 0, 0); P.fallStart = P.pos.y;
  };
  P.scope = function (x, y, z, yaw) {
    P.mode = 'scope'; P.scopePos = new V3(x, y + 1.25, z); P.scopeYaw = yaw; P.yaw = yaw; P.pitch = -0.04;
    document.getElementById('scope').classList.add('on');
    NC.UI.toast('Binóculo: arraste/mova o mouse para olhar.');
  };
  P.unscope = function () { P.mode = 'walk'; document.getElementById('scope').classList.remove('on'); };
  P.dance = function () { P.mode = 'dance'; P.danceT = 0; NC.UI.toast('Dançando! Mova-se para parar.'); };
  P.atm = function () {
    const t = NC.U.time.value;
    if (t - P.atmAt < 90) { NC.UI.say('Caixa eletrônico', `Limite atingido. Tente de novo em ${Math.ceil(90 - (t - P.atmAt))} s.`); return; }
    P.atmAt = t; P.money += 100; NC.Audio && NC.Audio.buy();
    NC.UI.toast('Você sacou <b>₵100</b>. Taxa de serviço: sua privacidade.'); NC.UI.hud(true);
  };
  P.buy = function (item, opts = {}) {
    if (P.money < item.price) { NC.UI.toast('Créditos insuficientes. Tem um caixa eletrônico no Neomart 24.'); return false; }
    P.money -= item.price;
    if (opts.vend) NC.Audio && NC.Audio.clunk(); else NC.Audio && NC.Audio.buy();
    const t = NC.U.time.value;
    let msg = `Você comprou <b>${item.name}</b> por ₵${item.price}.`;
    switch (item.fx) {
      case 'energy': P.buffs.energy = t + 60; msg += ' Corrida turbinada por 60 s.'; break;
      case 'ultra': P.buffs.energy = t + 60; P.buffs.jump = t + 60; msg += ' Corrida e pulo turbinados por 60 s.'; break;
      case 'drunk': P.buffs.drunk = Math.max(P.buffs.drunk || 0, t) + 35; msg += ' A cidade fica um pouco mais bonita.'; break;
      case 'calm': if (P.buffs.drunk) P.buffs.drunk = Math.min(P.buffs.drunk, t + 5); msg += ' Calma total.'; break;
      case 'umbrella': P.umbrella = true; msg += ' Aparece na 3ª pessoa.'; break;
      case 'food': msg += pick(['Delícia.', 'Exatamente o que precisava.', 'Quentinho.']); break;
      default: msg += ' Refrescante.';
    }
    NC.UI.toast(msg); NC.UI.hud(true);
    if (opts.cook && item.line) setTimeout(() => NC.UI.say(opts.cook, item.line), 500);
    return true;
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  P.teleport = function (x, y, z, yaw, opts = {}) {
    const go = () => {
      if (P.mode === 'scope') P.unscope();
      P.mode = 'walk'; P.seat = null;
      P.pos.set(x, y + 0.05, z); P.vel.set(0, 0, 0); P.camY = P.pos.y; P.fallStart = P.pos.y;
      if (yaw !== undefined) { P.yaw = yaw; P.pitch = 0; }
    };
    if (opts.fade === false) { go(); return; }
    NC.UI.fade(true);
    setTimeout(() => { go(); if (opts.ding) NC.Audio && NC.Audio.ding(); setTimeout(() => NC.UI.fade(false), 160); }, opts.ding ? 900 : 480);
  };

  // ---------------- physics ----------------
  function groundAt(x, z, feet, boxes) {
    let g = Math.abs(z) < L.RIVER ? -60 : 0;
    const r = 0.22;
    for (const b of boxes) {
      if (x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1 && b.y1 <= feet + STEP + 0.01 && b.y1 > g) g = b.y1;
    }
    return g;
  }
  function solveXZ(p, vel, boxes) {
    const feet = p.y, head = p.y + HEIGHT;
    for (let it = 0; it < 3; it++) {
      for (const b of boxes) {
        if (b.y1 <= feet + STEP || b.y0 >= head) continue;
        const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
        const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R) continue;
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, push = R - d;
          p.x += nx * push; p.z += nz * push;
          const vn = vel.x * nx + vel.z * nz; if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
        } else {
          const l = p.x - b.x0, r = b.x1 - p.x, n = p.z - b.z0, s = b.z1 - p.z, m = Math.min(l, r, n, s);
          if (m === l) p.x = b.x0 - R; else if (m === r) p.x = b.x1 + R; else if (m === n) p.z = b.z0 - R; else p.z = b.z1 + R;
        }
      }
    }
  }
  P.physics = function (dt) {
    const p = P.pos, v = P.vel, t = NC.U.time.value;
    // wish direction
    let mx = 0, mz = 0;
    const k = P.keys;
    if (k.KeyW || k.ArrowUp) mz -= 1; if (k.KeyS || k.ArrowDown) mz += 1;
    if (k.KeyA || k.ArrowLeft) mx -= 1; if (k.KeyD || k.ArrowRight) mx += 1;
    mx += P.joy.x; mz += P.joy.y;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    const wx = mx * cos + mz * sin, wz = -mx * sin + mz * cos;
    const runKey = k.ShiftLeft || k.ShiftRight || P.run || Math.hypot(P.joy.x, P.joy.y) > 0.97;
    let speed = runKey ? 7.6 : 4.3;
    if (P.buffs.energy > t) speed *= 1.45;
    if (P.buffs.drunk > t) speed *= 0.85;
    const tx = wx * speed, tz = wz * speed;
    const acc = P.onGround ? 14 : 3;
    v.x = NC.damp(v.x, tx, acc, dt); v.z = NC.damp(v.z, tz, acc, dt);
    if (P.buffs.drunk > t) { v.x += Math.sin(t * 1.7) * 0.6 * dt * 10; v.z += Math.cos(t * 1.3) * 0.6 * dt * 10; }
    if (P.jumpQ && P.onGround) { v.y = P.buffs.jump > t ? 10.5 : 6.6; P.onGround = false; }
    P.jumpQ = false;
    v.y -= GRAV * dt; if (v.y < -55) v.y = -55;
    // integrate in sub-steps
    const n = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.25));
    const h = dt / n;
    const boxes = NC.queryColliders(p.x - 2, p.z - 2, p.x + 2, p.z + 2, P.tmp);
    let wasGround = P.onGround;
    for (let i = 0; i < n; i++) {
      p.x += v.x * h; p.z += v.z * h;
      solveXZ(p, v, boxes);
      const ny = p.y + v.y * h;
      // ceilings
      if (v.y > 0) for (const b of boxes) {
        if (p.x + R > b.x0 && p.x - R < b.x1 && p.z + R > b.z0 && p.z - R < b.z1 && b.y0 >= p.y + HEIGHT - 0.01 && b.y0 < ny + HEIGHT) { v.y = 0; break; }
      }
      const g = groundAt(p.x, p.z, p.y, boxes);
      if (ny <= g) { p.y = g; if (v.y < 0) v.y = 0; P.onGround = true; }
      else if (P.onGround && p.y - g < STEP && v.y <= 0) { p.y = g; v.y = 0; } // stick to stairs / ramps going down
      else { p.y = ny; P.onGround = false; }
    }
    if (P.onGround && !wasGround) {
      const fall = P.fallStart - p.y;
      if (fall > 2.5) { NC.Audio && NC.Audio.land(); P.shake = Math.min(1, fall / 20); }
    }
    if (P.onGround) P.fallStart = p.y; else P.fallStart = Math.max(P.fallStart, p.y);
    p.x = NC.clamp(p.x, -760, 760); p.z = NC.clamp(p.z, -760, 760);
    // river
    if (p.y < L.WATER_Y - 0.6) {
      NC.Audio && NC.Audio.splash();
      const side = p.z >= 0 ? 1 : -1;
      P.teleport(NC.clamp(p.x, -330, 330), L.CURB, side * 27.5, side > 0 ? Math.PI : 0, {});
      NC.UI.toast('<b>Splash!</b> Você caiu no Rio Kuro. Um barco-táxi te puxou de volta para o calçadão.');
      p.y = L.WATER_Y; v.set(0, 0, 0);
    }
    P.speed = Math.hypot(v.x, v.z);
    return ml;
  };

  // ---------------- per-frame ----------------
  const fwd = new V3(), tgt = new V3(), cpos = new V3(), tmpV = new V3();
  P.update = function (dt, t) {
    const cam = P.cam;
    if (P.mode === 'cinematic') return;
    let moving = 0;
    const anyMove = () => P.keys.KeyW || P.keys.KeyA || P.keys.KeyS || P.keys.KeyD || P.keys.ArrowUp || P.keys.ArrowDown || P.keys.ArrowLeft || P.keys.ArrowRight || Math.hypot(P.joy.x, P.joy.y) > 0.35;
    if (P.mode === 'sit') {
      if (anyMove() || P.jumpQ) { P.jumpQ = false; P.stand(); }
    } else if (P.mode === 'scope') {
      if (anyMove() || P.jumpQ || P.useQ) { P.useQ = false; P.jumpQ = false; P.unscope(); }
    } else if (P.mode === 'dance') {
      P.danceT += dt;
      if (anyMove() || P.jumpQ) { P.mode = 'walk'; }
    }
    if (P.mode === 'walk' || P.mode === 'dance') moving = P.mode === 'walk' ? P.physics(dt) : 0;

    // interaction target
    P.target = null;
    if (P.mode === 'walk' || P.mode === 'dance') P.target = P.findTarget();
    if (P.useQ) {
      P.useQ = false;
      if (P.mode === 'sit') P.stand();
      else if (P.target) { P.target.use(); NC.Audio && NC.Audio.ui(); }
    }

    // camera
    const p = P.pos;
    const drunk = P.buffs.drunk > t ? Math.min(1, (P.buffs.drunk - t) / 8) : 0;
    NC.U.drunk = drunk;
    P.camY = NC.damp(P.camY, p.y, P.camY < p.y ? 14 : 30, dt);
    if (Math.abs(P.camY - p.y) > 3) P.camY = p.y;
    let bobY = 0, roll = 0;
    if (P.mode === 'walk' && P.onGround && P.speed > 0.5) {
      P.bob += dt * P.speed * 1.75;
      bobY = Math.sin(P.bob * 2) * 0.045 * Math.min(1, P.speed / 5);
      roll = Math.sin(P.bob) * 0.006;
      const st = Math.floor(P.bob / Math.PI);
      if (st !== P.lastStep) { P.lastStep = st; NC.Audio && NC.Audio.step(!NC.zoneIndoor, P.speed > 6); }
    }
    if (P.mode === 'dance') { const bp = NC.beatPhase || 0; bobY = Math.abs(Math.sin(bp * Math.PI)) * 0.12 - 0.06; roll = Math.sin((NC.beatCount || 0) * Math.PI / 2 + bp * Math.PI) * 0.04; }
    roll += drunk * Math.sin(t * 0.9) * 0.05;
    if (P.shake > 0) { P.shake = Math.max(0, P.shake - dt * 2.5); bobY += (Math.random() - 0.5) * P.shake * 0.2; }

    let targetFov = P.fovBase;
    fwd.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
    if (P.mode === 'scope') {
      targetFov = P.fovBase / 4.2;
      cam.position.copy(P.scopePos);
      cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    } else {
      let ex, ey, ez;
      if (P.mode === 'sit') { const s = P.seat; ex = s.x; ey = s.y + 0.78; ez = s.z; }
      else { ex = p.x; ey = P.camY + EYE + bobY; ez = p.z; }
      if (P.third && P.mode !== 'sit' || (P.third && P.mode === 'sit')) {
        // third person: orbit behind the head with collision
        const hy = P.mode === 'sit' ? P.seat.y + 0.7 : P.camY + 1.55;
        tgt.set(ex, hy, ez);
        const dist = 3.6;
        cpos.set(tgt.x - fwd.x * dist + Math.cos(P.yaw) * 0.45, tgt.y - fwd.y * dist + 0.35, tgt.z - fwd.z * dist - Math.sin(P.yaw) * 0.45);
        const free = P.camRay(tgt, cpos);
        cam.position.copy(free);
        cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
      } else {
        cam.position.set(ex, ey, ez);
        cam.rotation.set(P.pitch, P.yaw, roll, 'YXZ');
      }
    }
    P.fov = NC.damp(P.fov, targetFov, 10, dt);
    if (Math.abs(cam.fov - P.fov) > 0.01) { cam.fov = P.fov; cam.updateProjectionMatrix(); }

    // avatar state for the humans system
    const showAv = P.third && P.mode !== 'scope';
    P.avatar = {
      show: showAv,
      x: P.mode === 'sit' ? P.seat.x : p.x, y: P.mode === 'sit' ? P.seat.y - 0.66 : p.y, z: P.mode === 'sit' ? P.seat.z : p.z,
      ry: P.mode === 'walk' && P.speed > 0.3 ? (P.avatarRy = Math.atan2(P.vel.x, P.vel.z)) : (P.mode === 'sit' ? P.seat.yaw + Math.PI : (P.mode === 'dance' ? P.yaw + Math.PI : P.avatarRy)),
      anim: P.mode === 'sit' ? 'sit' : P.mode === 'dance' ? 'dance' : (P.onGround ? 'walk' : 'idle'), speed: P.speed, seatH: 0.6, umbrella: P.umbrella && !NC.zoneIndoor,
    };
  };

  P.camRay = function (from, to) {
    const boxes = NC.queryColliders(Math.min(from.x, to.x) - 1, Math.min(from.z, to.z) - 1, Math.max(from.x, to.x) + 1, Math.max(from.z, to.z) + 1, P.tmp);
    const steps = 18; let last = from.clone();
    for (let i = 1; i <= steps; i++) {
      tmpV.lerpVectors(from, to, i / steps);
      let hit = false;
      for (const b of boxes) if (tmpV.x > b.x0 - 0.2 && tmpV.x < b.x1 + 0.2 && tmpV.z > b.z0 - 0.2 && tmpV.z < b.z1 + 0.2 && tmpV.y > b.y0 - 0.2 && tmpV.y < b.y1 + 0.2) { hit = true; break; }
      if (hit) break;
      last.copy(tmpV);
    }
    return last;
  };

  P.findTarget = function () {
    const p = P.pos, ey = p.y + 1.0;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    let best = null, bs = 1e9;
    for (const it of NC.interactables) {
      const dx = it.x - p.x, dz = it.z - p.z, dy = it.y - ey;
      if (Math.abs(dy) > 1.7) continue;
      const d = Math.hypot(dx, dz);
      if (d > it.r) continue;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      if (facing < -0.2 && d > 0.9) continue;
      const score = d - facing * 0.8;
      if (score < bs) { bs = score; best = it; }
    }
    const h = NC.Humans && NC.Humans.nearest(p.x, p.z, 1.7);
    if (h && Math.abs(h.y - p.y) < 1.5) {
      const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz), facing = (dx * fx + dz * fz) / (d || 1);
      const score = d - facing * 0.8 + 0.3;
      if (score < bs && facing > 0.2) {
        best = { label: 'Falar', kind: 'talk', use: () => NC.UI.say(h.line ? h.line[0] : 'Pedestre', h.line ? h.line[1] : pick(NC.Humans.LINES)) };
      }
    }
    return best;
  };
})();
