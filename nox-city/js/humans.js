/* Nox City — people: instanced low-poly humans, sidewalk pedestrians on a walk graph, NPC animations. */
(function () {
  'use strict';
  const NC = window.NC;
  const L = NC.L;
  const { rand, randi, pick, chance } = NC;
  const H = (NC.Humans = {});

  const SKIN = ['#f1c7a5', '#e0a882', '#c68863', '#8d5a3b', '#5a3a26', '#f5d6c6', '#d9b08c'].map((c) => new THREE.Color(c));
  const HAIR = ['#0b0b0e', '#1d140f', '#3a2618', '#c9a35a', '#ff3bd0', '#4ef0ff', '#e8e8f0', '#7a2a1a', '#2a2a40'].map((c) => new THREE.Color(c));
  const JACKET = ['#121218', '#0e1424', '#1c0f22', '#20241a', '#2a0c12', '#16161c', '#2c2c34', '#0a0a0c', '#d8c020', '#e4e4ea', '#3a1240', '#123a40'].map((c) => new THREE.Color(c));
  const PANTS = ['#0c0c10', '#16161e', '#1e1a16', '#101828', '#26262c'].map((c) => new THREE.Color(c));
  const ACC = ['#ff2bd6', '#5ef2ff', '#f3e600', '#7dff4a', '#ff6a3d', '#9d6bff'].map((c) => new THREE.Color(c));
  const LOOKS = {
    guard: { jacket: '#13203a', pants: '#0e1424', hair: '#0b0b0e' },
    corp: { jacket: '#e8e8ee', pants: '#d0d0d8', hair: '#0b0b0e', acc: '#5ef2ff' },
    bouncer: { jacket: '#050506', pants: '#050506', hair: '#0b0b0e', acc: '#ff2bd6' },
    bartender: { jacket: '#e8e4dc', pants: '#0a0a0c', hair: '#1d140f' },
    bartender2: { jacket: '#0a0a0c', pants: '#0a0a0c', hair: '#ff3bd0', acc: '#5ef2ff' },
    dj: { jacket: '#160a24', pants: '#0a0a0c', hair: '#4ef0ff', acc: '#ff2bd6' },
    cook: { jacket: '#eeeae2', pants: '#2a2a30', hair: '#e8e8f0' },
    android: { jacket: '#0f5a3a', pants: '#1a1a1e', hair: '#c0c4cc', skin: '#b8c0cc', acc: '#5ef2ff', eyes: true },
    player: { jacket: '#0c0c10', pants: '#14141a', hair: '#0b0b0e', skin: '#d9b08c', acc: '#ff2030', back: true },
  };

  // ---------------- geometry ----------------
  function partGeo(w, h, d, pivotTop) { const g = new THREE.BoxGeometry(w, h, d); if (pivotTop) g.translate(0, -h / 2, 0); return g; }
  H.init = function (scene, max = 300) {
    H.max = max;
    const mk = (geo, mat, opts = {}) => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      if (!opts.refl) m.layers.set(NC.LAYER_NOREFL);
      const c = new Float32Array(max * 3).fill(1);
      m.instanceColor = new THREE.InstancedBufferAttribute(c, 3);
      scene.add(m); return m;
    };
    const std = NC.M.human;
    const emis = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const head = new THREE.SphereGeometry(0.5, 8, 6); head.scale(0.23, 0.27, 0.25);
    const torso = new THREE.CylinderGeometry(0.24, 0.19, 0.62, 6, 1); torso.scale(1, 1, 0.6); torso.rotateY(Math.PI / 6);
    const canopy = new THREE.ConeGeometry(0.6, 0.3, 12, 1, true);
    const rim = new THREE.TorusGeometry(0.6, 0.018, 3, 16); rim.rotateX(Math.PI / 2);
    H.parts = {
      legL: mk(partGeo(0.15, 0.9, 0.17, true), std),
      legR: mk(partGeo(0.15, 0.9, 0.17, true), std),
      torso: mk(torso, std),
      head: mk(head, std),
      hair: mk(partGeo(0.25, 0.13, 0.27), std),
      armL: mk(partGeo(0.11, 0.62, 0.12, true), std),
      armR: mk(partGeo(0.11, 0.62, 0.12, true), std),
      acc: mk(partGeo(0.05, 0.42, 0.02), emis),
      shaft: mk(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 4), std),
      canopy: mk(canopy, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1, envMap: NC.M.envMap, side: THREE.DoubleSide, depthWrite: false })),
      rim: mk(rim, emis),
      phone: mk(partGeo(0.07, 0.13, 0.015), emis),
    };
    H.agents = [];
    H.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const k in H.parts) for (let i = 0; i < max; i++) H.parts[k].setMatrixAt(i, H.zero);
  };

  function setColors(a, i) {
    const P = H.parts;
    P.torso.setColorAt(i, a.cJ); P.armL.setColorAt(i, a.cJ); P.armR.setColorAt(i, a.cJ);
    P.legL.setColorAt(i, a.cP); P.legR.setColorAt(i, a.cP);
    P.head.setColorAt(i, a.cS); P.hair.setColorAt(i, a.cH);
    P.acc.setColorAt(i, a.cA); P.rim.setColorAt(i, a.cU); P.canopy.setColorAt(i, a.cC);
    P.shaft.setColorAt(i, C_SHAFT); P.phone.setColorAt(i, C_PHONE);
    H.colorDirty = true;
  }
  const C_SHAFT = new THREE.Color(0.1, 0.1, 0.1), C_PHONE = new THREE.Color(0.6, 1.2, 1.6);

  H.add = function (o) {
    if (H.agents.length >= H.max) return null;
    const look = (o.look && LOOKS[o.look]) || {};
    const a = Object.assign({
      i: H.agents.length, x: 0, y: L.CURB, z: 0, ry: 0, scale: rand(0.92, 1.08), anim: 'walk', ph: rand(0, 10), speed: 0, vis: true,
      umbrella: false, hasAcc: chance(0.35), accBack: !!look.back, eyes: !!look.eyes,
    }, o);
    a.cJ = new THREE.Color(look.jacket || pick(JACKET));
    a.cP = new THREE.Color(look.pants || pick(PANTS));
    a.cS = new THREE.Color(look.skin || pick(SKIN));
    a.cH = new THREE.Color(look.hair || pick(HAIR));
    a.cA = new THREE.Color(look.acc || pick(ACC)).multiplyScalar(2.2);
    if (look.acc) a.hasAcc = true;
    a.cU = pick(ACC).clone().multiplyScalar(2.4);
    a.cC = chance(0.6) ? new THREE.Color(0.8, 0.85, 0.95) : pick(ACC).clone().multiplyScalar(0.6);
    if (o.yaw !== undefined) a.ry = o.yaw + Math.PI;
    a.slot = -1;
    H.agents.push(a);
    return a;
  };

  // ---------------- walk graph ----------------
  H.buildGraph = function () {
    const nodes = [], edges = [];
    const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;
    const map = new Map();
    const node = (x, z) => { const k = key(x, z); let n = map.get(k); if (!n) { n = { x, z, e: [], id: nodes.length }; nodes.push(n); map.set(k, n); } return n; };
    const link = (a, b, cross) => { const e = { a, b, cross, len: Math.hypot(a.x - b.x, a.z - b.z) }; a.e.push({ to: b, cross, len: e.len }); b.e.push({ to: a, cross, len: e.len }); edges.push(e); };
    const inner = L.blocks.filter((b) => b.inner);
    for (const b of inner) {
      const c = [node(b.x0 + 2, b.z0 + 2), node(b.x1 - 2, b.z0 + 2), node(b.x1 - 2, b.z1 - 2), node(b.x0 + 2, b.z1 - 2)];
      b.nodes = c;
      for (let i = 0; i < 4; i++) link(c[i], c[(i + 1) % 4], false);
    }
    // crossings between neighbouring blocks
    for (const b of inner) for (const o of inner) {
      if (o === b) continue;
      if (Math.abs(o.x0 - (b.x1 + 14)) < 0.5 && Math.abs(o.z0 - b.z0) < 0.5) { link(b.nodes[1], o.nodes[0], true); link(b.nodes[2], o.nodes[3], true); }
      if (Math.abs(o.z0 - (b.z1 + 14)) < 0.5 && Math.abs(o.x0 - b.x0) < 0.5) { link(b.nodes[3], o.nodes[0], true); link(b.nodes[2], o.nodes[1], true); }
    }
    // promenades + bridges
    for (const s of [1, -1]) {
      const row = inner.filter((b) => b.k === 0 && b.side === s).sort((a, b) => a.x0 - b.x0);
      const edgeN = [], walkN = [];
      for (const b of row) for (const ci of (s > 0 ? [0, 1] : [3, 2])) {
        const cn = b.nodes[ci];
        const en = node(cn.x, s * 32.5), wn = node(cn.x, s * 26.9);
        link(cn, en, true); link(en, wn, false);
        edgeN.push(en); walkN.push(wn);
      }
      walkN.sort((a, b) => a.x - b.x);
      for (let i = 0; i < walkN.length - 1; i++) {
        const a = walkN[i], b = walkN[i + 1];
        const crossesRoad = L.XR.some((xc) => xc > a.x && xc < b.x);
        link(a, b, crossesRoad);
      }
    }
    for (const xc of L.XR) {
      if (Math.abs(xc) > L.INNER_X) continue;
      for (const sx of [-1, 1]) {
        const a = map.get(key(xc + sx * 9, 26.9)), b = map.get(key(xc + sx * 9, -26.9));
        if (a && b) link(a, b, false);
      }
    }
    H.nodes = nodes; H.edges = edges;
  };

  H.spawnPeds = function (n) {
    H.peds = [];
    const E = H.edges.filter((e) => !e.cross);
    for (let k = 0; k < n; k++) {
      const e = pick(E);
      const fwd = chance(0.5);
      const a = H.add({ anim: 'walk', umbrella: chance(0.42), kind: 'ped' });
      if (!a) break;
      a.from = fwd ? e.a : e.b; a.to = fwd ? e.b : e.a; a.edgeLen = e.len; a.t = rand(0, e.len);
      a.off = rand(-0.25, 0.9); a.vmax = rand(1.15, 1.6); a.speed = a.vmax; a.wait = 0; a.cross = false;
      H.peds.push(a);
    }
  };
  H.setPedCount = (n) => { if (!H.peds) return; H.peds.forEach((p, i) => { p.active = i < n; }); };

  H.spawnNPCs = function () {
    for (const o of NC.npcs) {
      const a = H.add({ x: o.x, y: o.y, z: o.z, yaw: o.yaw, anim: o.anim, look: o.look, scale: o.scale || rand(0.95, 1.05), seatH: o.seatH || 0.6, kind: 'npc', line: o.line, umbrella: false, club: o.club });
      if (a) a.static = true;
    }
  };

  H.addPlayer = function () {
    H.player = H.add({ anim: 'idle', look: 'player', kind: 'player', scale: 1.0, hasAcc: true });
    H.player.accBack = true;
    return H.player;
  };

  // ---------------- update ----------------
  const mB = new THREE.Matrix4(), mT = new THREE.Matrix4(), mR = new THREE.Matrix4(), mP = new THREE.Matrix4(), eul = new THREE.Euler(), qq = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3();
  function body(x, y, z, ry, s, tilt = 0) {
    eul.set(tilt, ry, 0, 'YXZ'); qq.setFromEuler(eul); vp.set(x, y, z); vs.set(s, s, s); mB.compose(vp, qq, vs);
  }
  function part(mesh, i, ox, oy, oz, rx, rz = 0, ry = 0) {
    mT.makeTranslation(ox, oy, oz); eul.set(rx, ry, rz, 'XYZ'); mR.makeRotationFromEuler(eul);
    mP.multiplyMatrices(mB, mT).multiply(mR); mesh.setMatrixAt(i, mP);
  }
  function hide(i) { for (const k in H.parts) H.parts[k].setMatrixAt(i, H.zero); }

  function pose(a, t, beat) {
    const P = H.parts, i = a.slot;
    let legL = 0, legR = 0, armL = 0.05, armR = 0.05, armLz = 0.06, armRz = -0.06, bob = 0, headX = 0, tilt = 0, hipY = 0.92, yOff = 0, armRy = 0, armLy = 0, headY = 0;
    let phone = false;
    const sw = a.anim;
    if (sw === 'walk') {
      const f = a.speed * 3.6, s = Math.sin(t * f + a.ph);
      const amp = Math.min(0.55, a.speed * 0.38);
      legL = s * amp; legR = -s * amp; armL = -s * amp * 0.8; armR = s * amp * 0.8;
      bob = Math.abs(Math.cos(t * f + a.ph)) * 0.05 * Math.min(1, a.speed);
      if (a.speed < 0.05) { legL = legR = 0; armL = armR = 0.05; bob = 0; }
    } else if (sw === 'idle' || sw === 'wait') {
      const s = Math.sin(t * 1.3 + a.ph);
      bob = s * 0.008; armL = 0.05 + s * 0.02; armR = 0.05 - s * 0.02; headY = Math.sin(t * 0.4 + a.ph) * 0.3;
    } else if (sw === 'phone') {
      armL = -1.9; armLz = 0.45; headX = 0.35; phone = true; bob = Math.sin(t * 1.2 + a.ph) * 0.006;
    } else if (sw === 'sit' || sw === 'sitbar' || sw === 'eat' || sw === 'sleep') {
      hipY = 0; yOff = (a.seatH || 0.6) + 0.06;
      legL = legR = -1.45;
      if (sw === 'sitbar') { armL = armR = -0.9; }
      if (sw === 'eat') { armL = -0.8; armR = -1.2 - Math.max(0, Math.sin(t * 2 + a.ph)) * 0.9; headX = 0.25 + Math.max(0, Math.sin(t * 2 + a.ph)) * 0.15; }
      if (sw === 'sleep') { headX = 0.65; armL = armR = -0.5; armLz = 0.5; armRz = -0.5; tilt = 0.12; }
    } else if (sw === 'dance') {
      const bt = NC.beatPhase || 0, bc = NC.beatCount || 0;
      const k = Math.sin(bt * Math.PI * 2);
      bob = Math.abs(Math.sin(bt * Math.PI)) * 0.12;
      const move = (bc + Math.floor(a.ph * 3)) % 8 < 4;
      armL = move ? -2.6 + k * 0.4 : -0.6 + k * 0.6; armR = move ? -2.6 - k * 0.4 : -0.6 - k * 0.6;
      armLz = 0.3; armRz = -0.3;
      legL = k * 0.25; legR = -k * 0.25; headX = Math.sin(bt * Math.PI * 2) * 0.2;
      tilt = Math.sin(t * 2 + a.ph) * 0.08;
    } else if (sw === 'dj') {
      armL = -1.15; armR = -1.15 + (NC.beatCount % 16 < 2 ? -1.6 : 0); headX = 0.15 + (NC.beatPhase || 0) * 0.25; armLz = 0.2; armRz = -0.2;
      bob = Math.abs(Math.sin((NC.beatPhase || 0) * Math.PI)) * 0.04;
    } else if (sw === 'bartend') {
      armL = -0.9 + Math.sin(t * 3 + a.ph) * 0.25; armR = -0.9; armRz = -0.2 + Math.sin(t * 6 + a.ph) * 0.3; headY = Math.sin(t * 0.5) * 0.4;
    } else if (sw === 'cook') {
      armL = -1.0; armR = -1.1 + Math.sin(t * 4 + a.ph) * 0.3; armRz = Math.cos(t * 4 + a.ph) * 0.3 - 0.1; headX = 0.25;
    }
    const s = a.scale;
    body(a.x, a.y + yOff + bob, a.z, a.ry, s, tilt);
    part(P.legL, i, -0.1, hipY, 0, legL);
    part(P.legR, i, 0.1, hipY, 0, legR);
    const ty = hipY + 0.31;
    part(P.torso, i, 0, ty, 0, 0);
    part(P.head, i, 0, ty + 0.45, 0.01, headX, 0, headY);
    part(P.hair, i, 0, ty + 0.56, -0.03, headX, 0, headY);
    part(P.armL, i, -0.28, ty + 0.27, 0, armL, armLz, armLy);
    if (a.umbrella && a.outdoor !== false && sw === 'walk') {
      part(P.armR, i, 0.28, ty + 0.27, 0, -1.0, -0.15);
      part(P.shaft, i, 0.2, ty + 0.85, 0.32, 0);
      part(P.canopy, i, 0.2, ty + 1.38, 0.32, 0);
      part(P.rim, i, 0.2, ty + 1.24, 0.32, 0);
    } else {
      part(P.armR, i, 0.28, ty + 0.27, 0, armR, armRz, armRy);
      P.shaft.setMatrixAt(i, H.zero); P.canopy.setMatrixAt(i, H.zero); P.rim.setMatrixAt(i, H.zero);
    }
    if (a.hasAcc) part(P.acc, i, a.eyes ? 0 : 0.1, a.eyes ? ty + 0.47 : ty + 0.05, a.accBack ? -0.16 : (a.eyes ? 0.13 : 0.15), 0, a.eyes ? Math.PI / 2 : 0);
    else P.acc.setMatrixAt(i, H.zero);
    if (phone) part(P.phone, i, -0.12, ty + 0.42, 0.24, -0.4); else P.phone.setMatrixAt(i, H.zero);
  }

  // traffic phase helper is supplied by traffic.js (NC.Traffic.phase)
  function stepPed(a, dt, ph) {
    if (a.wait > 0) {
      // waiting at a crossing for the scramble
      a.anim = a.waitAnim; a.speed = 0;
      if (ph.walk && ph.walkLeft > a.edgeLen / 1.9) { a.wait = 0; a.anim = 'walk'; }
      else return;
    }
    a.speed = NC.damp(a.speed, a.cross ? 1.9 : a.vmax, 3, dt);
    a.t += a.speed * dt;
    if (a.t >= a.edgeLen) {
      // arrive at node, pick a next edge
      const n = a.to;
      const opts = n.e.filter((e) => e.to !== a.from);
      const e = opts.length ? pick(opts) : n.e[0];
      a.from = n; a.to = e.to; a.edgeLen = e.len; a.t = 0; a.cross = e.cross;
      if (e.cross) { a.wait = 1; a.waitAnim = chance(0.3) ? 'phone' : 'idle'; a.speed = 0; }
    }
    const fx = a.to.x - a.from.x, fz = a.to.z - a.from.z, len = Math.hypot(fx, fz) || 1;
    const ux = fx / len, uz = fz / len;
    // offset to the right of travel so opposite flows don't overlap
    const off = a.cross ? a.off * 0.6 : a.off;
    a.x = a.from.x + ux * a.t - uz * off * 0.6;
    a.z = a.from.z + uz * a.t + ux * off * 0.6;
    a.y = onRoad(a.x, a.z) ? 0 : L.CURB;
    a.ry = Math.atan2(ux, uz);
  }
  function onRoad(x, z) {
    const az = Math.abs(z);
    if (az < 34) return false;
    const dx = Math.abs(x - Math.round(x / 70) * 70);
    if (dx < 7) return true;
    const k = Math.round((az - 41) / 70), dz = Math.abs(az - (41 + 70 * k));
    return dz < 7;
  }

  H.update = function (t, dt, cam, ph, playerState) {
    const P = H.parts;
    const R2 = 150 * 150;
    let k = 0;
    for (const a of H.agents) {
      a.vis = false;
      if (a.kind === 'ped') {
        if (a.active === false) continue;
        stepPed(a, dt, ph);
      } else if (a.kind === 'player') {
        if (!playerState.show) continue;
        a.x = playerState.x; a.y = playerState.y; a.z = playerState.z; a.ry = playerState.ry; a.anim = playerState.anim; a.speed = playerState.speed; a.seatH = playerState.seatH; a.umbrella = playerState.umbrella;
      }
      const dx = a.x - cam.x, dz = a.z - cam.z, dy = a.y - cam.y;
      const d2 = dx * dx + dz * dz;
      if (d2 > R2 || (a.kind === 'npc' && d2 > 90 * 90) || Math.abs(dy) > 60) continue;
      a.vis = true;
      if (a.slot !== k) { a.slot = k; setColors(a, k); }
      k++;
      pose(a, t, ph);
    }
    for (const n in P) { P[n].count = k; P[n].instanceMatrix.needsUpdate = true; if (H.colorDirty) P[n].instanceColor.needsUpdate = true; }
    H.colorDirty = false;
  };

  H.nearest = function (x, z, r) {
    let best = null, bd = r * r;
    for (const a of H.agents) {
      if (a.kind === 'player' || !a.vis) continue;
      const d = (a.x - x) ** 2 + (a.z - z) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  };
  H.LINES = [
    'Sai da frente, choom. Tô atrasado.', 'Viu a Kaori Static ontem no VOLTAGE? Absurda.', 'Dizem que a chuva para em 2078. Dizem.',
    'Não olha pro drone. Ele olha de volta.', 'O ramen do Tsuki é o melhor do rio. Fato.', 'Você tem cara de quem trabalha na Hyperion.',
    'Meu implante ótico tá dando pau com esse neon todo.', 'Sabe onde fica o Neomart? Tô sem guarda-chuva.', 'Bonita noite, né? Toda noite é essa noite.',
    'Sobe no mirante da ponte. Melhor vista de graça da cidade.', 'Cuidado com os táxis voadores, eles não freiam.', '…', 'Hm? Ah. Oi.',
  ];
})();
