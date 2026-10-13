/* Nox City — traffic: lanes with car-following + synced lights (with Shibuya-style scramble),
   flying AVs on sky lanes, water taxis on the river. */
(function () {
  'use strict';
  const NC = window.NC;
  const L = NC.L, G = NC.G, M = NC.M, T = NC.T;
  const { rand, randi, pick, chance } = NC;
  const TR = (NC.Traffic = {});
  const EXT = L.LANE_EXT;

  // ---------------- signal cycle (44 s) ----------------
  // 0-11 EW green · 11-13.5 EW yellow · 13.5-15 all red · 15-26 NS green · 26-28.5 NS yellow · 28.5-30 all red · 30-44 scramble
  const CYCLE = 44;
  const PH = { ew: 'r', ns: 'r', walk: false, walkLeft: 0, t: 0 };
  TR.phase = function (time) {
    const t = ((time % CYCLE) + CYCLE) % CYCLE;
    PH.t = t;
    PH.ew = t < 11 ? 'g' : t < 13.5 ? 'y' : 'r';
    PH.ns = t >= 15 && t < 26 ? 'g' : t >= 26 && t < 28.5 ? 'y' : 'r';
    PH.walk = t >= 30;
    PH.walkLeft = PH.walk ? CYCLE - t : 0;
    return PH;
  };

  // ---------------- car models ----------------
  function buildModel(kind) {
    const body = new NC.GeoBag({}), glass = new NC.GeoBag({}), lights = new NC.GeoBag({ color: 3 });
    const B = (bag, x, y, z, sx, sy, sz, vals) => bag.box(x, y, z, sx, sy, sz, vals);
    if (kind === 'van') {
      B(body, 0, 0.75, 0, 2.05, 1.1, 5.0); B(body, 0, 1.75, -0.4, 2.0, 0.9, 4.0);
      B(glass, 0, 1.55, 1.75, 1.9, 0.55, 0.3); B(glass, 0, 1.6, -0.4, 2.04, 0.4, 3.6);
      for (const [x, z] of [[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.6], [0.95, -1.6]]) glass.add(G.cyl6, NC.mat4(x, 0.36, z, 0.72, 0.28, 0.72, 0, 0, Math.PI / 2));
      B(lights, -0.72, 0.85, 2.51, 0.42, 0.14, 0.04, { color: [3, 3.2, 3.6] }); B(lights, 0.72, 0.85, 2.51, 0.42, 0.14, 0.04, { color: [3, 3.2, 3.6] });
      B(lights, 0, 1.0, -2.51, 1.9, 0.12, 0.04, { color: [3.2, 0.2, 0.25] });
      B(lights, 0, 0.36, 0, 2.08, 0.04, 4.4, { color: [0.6, 0.6, 0.7] });
    } else {
      B(body, 0, 0.55, 0, 1.92, 0.6, 4.5); B(body, 0, 0.9, 1.5, 1.86, 0.18, 1.4); B(body, 0, 1.42, -0.35, 1.62, 0.06, 1.9);
      B(glass, 0, 1.1, -0.3, 1.7, 0.6, 2.3);
      for (const [x, z] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.45], [0.92, -1.45]]) glass.add(G.cyl6, NC.mat4(x, 0.34, z, 0.66, 0.26, 0.66, 0, 0, Math.PI / 2));
      B(lights, 0, 0.72, 2.26, 1.8, 0.07, 0.04, { color: [2.6, 2.9, 3.4] });
      B(lights, -0.68, 0.66, 2.27, 0.32, 0.1, 0.04, { color: [3.4, 3.5, 3.8] }); B(lights, 0.68, 0.66, 2.27, 0.32, 0.1, 0.04, { color: [3.4, 3.5, 3.8] });
      B(lights, 0, 0.78, -2.26, 1.86, 0.08, 0.04, { color: [3.4, 0.15, 0.25] });
    }
    return { body: body.build(), glass: glass.build(), lights: lights.build() };
  }

  // ---------------- lanes ----------------
  TR.init = function (scene) {
    const Q = NC.Q();
    TR.lanes = [];
    const innerZ = L.ZR.filter((z) => Math.abs(z) <= 251), outerZ = L.ZR.filter((z) => Math.abs(z) > 251);
    const innerX = L.XR.filter((x) => Math.abs(x) <= 210), outerX = L.XR.filter((x) => Math.abs(x) > 210);
    const mkLane = (axis, dir, c, inner) => {
      const crosses = axis === 'x' ? L.XR : L.ZR;
      const stops = crosses.map((xc) => dir * (xc - dir * 11.7)).sort((a, b) => a - b);
      const lane = { axis, dir, c, stops, cars: [], inner, vmax: inner ? rand(11, 15) : rand(15, 20) };
      TR.lanes.push(lane); return lane;
    };
    for (const z of innerZ) { mkLane('x', 1, z + 1.75, true); mkLane('x', 1, z + 5.25, true); mkLane('x', -1, z - 1.75, true); mkLane('x', -1, z - 5.25, true); }
    for (const x of innerX) { mkLane('z', 1, x - 1.75, true); mkLane('z', 1, x - 5.25, true); mkLane('z', -1, x + 1.75, true); mkLane('z', -1, x + 5.25, true); }
    for (const z of outerZ) { mkLane('x', 1, z + 3.5, false); mkLane('x', -1, z - 3.5, false); }
    for (const x of outerX) { mkLane('z', 1, x - 3.5, false); mkLane('z', -1, x + 3.5, false); }

    // models
    const sedan = buildModel('sedan'), van = buildModel('van');
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    TR.cars = [];
    const perLane = (lane) => Math.round((2 * EXT) / (lane.inner ? 72 : 150) * Q.cars);
    let total = 0; TR.lanes.forEach((l) => (total += Math.max(1, perLane(l))));
    TR.max = total;
    const counts = { sedan: 0, van: 0 };
    const specs = [];
    for (const lane of TR.lanes) {
      const n = Math.max(1, perLane(lane));
      const step = (2 * EXT) / n;
      for (let i = 0; i < n; i++) {
        const kind = chance(0.82) ? 'sedan' : 'van';
        const r = rand();
        const role = kind === 'sedan' ? (r < 0.13 ? 'taxi' : r < 0.16 ? 'police' : 'car') : 'car';
        specs.push({ lane, q: -EXT + i * step + rand(0, step * 0.5), kind, role, idx: counts[kind]++ });
      }
    }
    const mkInst = (geo, mat, n, refl = true) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; if (!refl) m.layers.set(NC.LAYER_NOREFL); scene.add(m); return m; };
    TR.mesh = {
      sedan: { body: mkInst(sedan.body, M.carPaint, counts.sedan, false), glass: mkInst(sedan.glass, M.glassDark.clone(), counts.sedan, false), lights: mkInst(sedan.lights, lightMat, counts.sedan) },
      van: { body: mkInst(van.body, M.carPaint, counts.van, false), glass: mkInst(van.glass, M.glassDark.clone(), counts.van, false), lights: mkInst(van.lights, lightMat, counts.van) },
    };
    TR.mesh.sedan.glass.material.transparent = false; TR.mesh.sedan.glass.material.opacity = 1; TR.mesh.sedan.glass.material.depthWrite = true;
    TR.mesh.van.glass.material = TR.mesh.sedan.glass.material;
    // roof signs (taxi / police)
    const signGeo = new THREE.BoxGeometry(0.7, 0.18, 0.3);
    TR.roof = mkInst(signGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), counts.sedan, false);
    TR.roof.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, counts.sedan) * 3).fill(0), 3);
    // ground glows: head beam, tail glow, underglow (3 per car)
    const glowGeo = new THREE.PlaneGeometry(1, 1); glowGeo.rotateX(-Math.PI / 2);
    TR.glow = mkInst(glowGeo, M.additive(T.pool, 0xffffff, 1), total * 3, false);
    TR.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 9), 3);
    TR.glow.renderOrder = 2;

    const PAINT = ['#101014', '#1a1a22', '#2a2a32', '#3a0a12', '#0a1a3a', '#c8c8d0', '#5a5a64', '#0c2a22', '#3a2a0a', '#6a0a3a', '#0a4a5a'];
    const tmpC = new THREE.Color();
    TR.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    specs.forEach((s, k) => {
      const lane = s.lane;
      const car = { lane, q: s.q, v: lane.vmax * rand(0.85, 1), vmax: lane.vmax * rand(0.85, 1.1), kind: s.kind, role: s.role, idx: s.idx, g: k, len: s.kind === 'van' ? 5.2 : 4.6 };
      const m = TR.mesh[s.kind];
      if (s.role === 'taxi') tmpC.set('#e8c200'); else if (s.role === 'police') tmpC.set('#e8e8ee'); else tmpC.set(pick(PAINT));
      car.paint = tmpC.clone(); m.body.setColorAt(s.idx, tmpC);
      if (s.kind === 'sedan') {
        if (s.role === 'taxi') car.roofC = new THREE.Color(2.5, 2.0, 0.3);
        else if (s.role === 'police') car.roofC = new THREE.Color(3, 0.2, 0.3);
      }
      const ug = chance(0.3) ? pick(['#ff2bd6', '#5ef2ff', '#7dff4a', '#9d6bff', '#f3e600']) : null;
      car.under = ug ? new THREE.Color(ug).multiplyScalar(0.55) : null;
      lane.cars.push(car); TR.cars.push(car);
    });
    for (const k in TR.mesh) for (const p in TR.mesh[k]) { const im = TR.mesh[k][p]; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    TR.roof.instanceColor.needsUpdate = true; TR.glow.instanceColor.needsUpdate = true;
    TR.initDensity = Q.cars;
    TR.setDensity(1);

    TR.initSignals(scene);
    TR.initAVs(scene, Q.avs);
    TR.initBoats(scene);
  };
  TR.setDensity = function (f) {
    // f in 0..1 hides a fraction of cars (quality changes at runtime)
    TR.cars.forEach((c, i) => { c.active = ((i * 0.618) % 1) < f + 0.001; });
  };

  // ---------------- signals ----------------
  TR.initSignals = function (scene) {
    const heads = [], peds = [];
    const bag = W_bag();
    function W_bag() { return NC.World.bagProps; }
    for (const xc of L.XR) for (const zr of L.ZR) {
      if (Math.abs(xc) > 210 || Math.abs(zr) > 251) continue;
      const corners = [
        { x: xc - 7.6, z: zr + 7.6, axis: 'x', face: [-1, 0], arm: [0, -1] },  // eastbound
        { x: xc + 7.6, z: zr - 7.6, axis: 'x', face: [1, 0], arm: [0, 1] },    // westbound
        { x: xc - 7.6, z: zr - 7.6, axis: 'z', face: [0, -1], arm: [1, 0] },   // southbound
        { x: xc + 7.6, z: zr + 7.6, axis: 'z', face: [0, 1], arm: [-1, 0] },   // northbound
      ];
      for (const c of corners) {
        const pc = [0.06, 0.06, 0.07];
        NC.World.propGeo(G.cyl6, c.x, L.CURB + 3.1, c.z, 0.2, 6.2, 0.2, pc);
        const ax = c.x + c.arm[0] * 2.6, az = c.z + c.arm[1] * 2.6;
        bag.box((c.x + ax) / 2, L.CURB + 5.9, (c.z + az) / 2, Math.abs(c.arm[0]) * 5.2 + 0.12, 0.12, Math.abs(c.arm[1]) * 5.2 + 0.12, { color: pc });
        const hx = c.x + c.arm[0] * 4.4, hz = c.z + c.arm[1] * 4.4;
        const ry = Math.atan2(c.face[0], c.face[1]);
        bag.box(hx, L.CURB + 5.45, hz, 0.42, 1.15, 0.32, { color: [0.03, 0.03, 0.035] }, ry);
        bag.box(c.x - c.arm[0] * 2.6 * 0 + c.arm[0] * 0.5, L.CURB + 5.9, c.z + c.arm[1] * 0.5, 0.1, 0.1, 0.1, { color: pc });
        heads.push({ x: hx + c.face[0] * 0.17, y: L.CURB + 5.45, z: hz + c.face[1] * 0.17, ry, axis: c.axis });
        peds.push({ x: c.x + c.face[0] * 0.12 - c.arm[0] * 0.0, y: L.CURB + 2.6, z: c.z + c.face[1] * 0.12, ry });
        NC.addCollider(c.x - 0.15, 0, c.z - 0.15, c.x + 0.15, 6.2, c.z + 0.15, 'pole');
      }
    }
    const geo = new THREE.BoxGeometry(0.3, 0.3, 0.05);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    TR.sigHeads = heads;
    TR.sig = new THREE.InstancedMesh(geo, mat, heads.length);
    TR.sigPed = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), mat, peds.length);
    const m = new THREE.Matrix4();
    heads.forEach((h, i) => { TR.sig.setMatrixAt(i, NC.mat4(h.x, h.y, h.z, 1, 1, 1, h.ry)); });
    peds.forEach((p, i) => { TR.sigPed.setMatrixAt(i, NC.mat4(p.x, p.y, p.z, 1, 1, 1, p.ry)); });
    TR.sig.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(heads.length * 3), 3);
    TR.sigPed.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(peds.length * 3), 3);
    scene.add(TR.sig, TR.sigPed);
    TR.lastSig = '';
  };
  const SIGC = { g: new THREE.Color(0.2, 3, 1.2), y: new THREE.Color(3, 2, 0.1), r: new THREE.Color(3, 0.1, 0.12) };
  function updateSignals(ph) {
    const key = ph.ew + ph.ns + (ph.walk ? 'w' : '');
    if (key === TR.lastSig) return;
    TR.lastSig = key;
    TR.sigHeads.forEach((h, i) => TR.sig.setColorAt(i, SIGC[h.axis === 'x' ? ph.ew : ph.ns]));
    const pc = ph.walk ? new THREE.Color(2.4, 2.8, 3) : new THREE.Color(2.6, 0.5, 0.1);
    for (let i = 0; i < TR.sigPed.count; i++) TR.sigPed.setColorAt(i, pc);
    TR.sig.instanceColor.needsUpdate = true; TR.sigPed.instanceColor.needsUpdate = true;
  }

  // ---------------- car update ----------------
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  function stepLane(lane, dt, ph) {
    const cars = lane.cars;
    // insertion sort by q
    for (let i = 1; i < cars.length; i++) { const c = cars[i]; let j = i - 1; while (j >= 0 && cars[j].q > c.q) { cars[j + 1] = cars[j]; j--; } cars[j + 1] = c; }
    const light = lane.axis === 'x' ? ph.ew : ph.ns;
    const n = cars.length;
    for (let i = 0; i < n; i++) {
      const c = cars[i];
      if (c.active === false) continue;
      let lead = null;
      for (let k = 1; k < n; k++) { const o = cars[(i + k) % n]; if (o.active !== false) { lead = o; break; } }
      let gap = 1e9;
      if (lead && lead !== c) { let dq = lead.q - c.q; if (dq <= 0) dq += 2 * EXT; gap = dq - (lead.len + c.len) / 2 - 2.2; }
      if (light !== 'g') {
        const front = c.q + c.len / 2;
        for (const s of lane.stops) {
          if (s >= front - 0.5) {
            const dist = s - front;
            if (light === 'r' || dist > (c.v * c.v) / 9) gap = Math.min(gap, dist - 0.3);
            break;
          }
        }
      }
      const vt = Math.min(c.vmax, Math.sqrt(Math.max(0, gap) * 2 * 4.5));
      if (c.v < vt) c.v = Math.min(vt, c.v + 3.2 * dt); else c.v = Math.max(vt, c.v - 9 * dt);
      if (gap < 0.3) c.v = 0;
      c.q += c.v * dt;
      if (c.q > EXT) c.q -= 2 * EXT;
    }
  }

  TR.update = function (t, dt, cam) {
    const ph = TR.phase(t);
    updateSignals(ph);
    for (const lane of TR.lanes) stepLane(lane, Math.min(dt, 0.1), ph);
    const R2 = 420 * 420;
    const flash = Math.floor(t * 6) % 2;
    const n = { sedan: 0, van: 0 }; let nr = 0, ng = 0;
    for (const c of TR.cars) {
      if (c.active === false) continue;
      const lane = c.lane;
      const p = c.q * lane.dir;
      const x = lane.axis === 'x' ? p : lane.c, z = lane.axis === 'x' ? lane.c : p;
      const dx = x - cam.x, dz = z - cam.z;
      if (dx * dx + dz * dz > R2) continue;
      const m = TR.mesh[c.kind], i = n[c.kind]++;
      const ry = lane.axis === 'x' ? (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane.dir > 0 ? 0 : Math.PI);
      const fx = Math.sin(ry), fz = Math.cos(ry);
      q.setFromAxisAngle(up, ry); pos.set(x, 0, z); scl.set(1, 1, 1);
      mm.compose(pos, q, scl);
      m.body.setMatrixAt(i, mm); m.glass.setMatrixAt(i, mm); m.lights.setMatrixAt(i, mm);
      m.body.setColorAt(i, c.paint);
      if (c.roofC) {
        pos.set(x - fx * 0.3, 1.55, z - fz * 0.3); mm.compose(pos, q, scl); TR.roof.setMatrixAt(nr, mm);
        TR.roof.setColorAt(nr, c.role === 'police' ? (flash ? SIGC.r : _blue) : c.roofC); nr++;
      }
      const d2 = dx * dx + dz * dz;
      if (d2 < 260 * 260) {
        pos.set(x + fx * 6.5, 0.03, z + fz * 6.5); scl.set(3.4, 1, 9); mm.compose(pos, q, scl); TR.glow.setMatrixAt(ng, mm); TR.glow.setColorAt(ng++, _head);
        pos.set(x - fx * 3.2, 0.03, z - fz * 3.2); scl.set(2.6, 1, 2.8); mm.compose(pos, q, scl); TR.glow.setMatrixAt(ng, mm); TR.glow.setColorAt(ng++, _tail);
        if (c.under) { pos.set(x, 0.035, z); scl.set(3.2, 1, 6); mm.compose(pos, q, scl); TR.glow.setMatrixAt(ng, mm); TR.glow.setColorAt(ng++, c.under); }
      }
    }
    for (const kk in TR.mesh) {
      const g = TR.mesh[kk];
      for (const p in g) { g[p].count = n[kk]; g[p].instanceMatrix.needsUpdate = true; }
      if (g.body.instanceColor) g.body.instanceColor.needsUpdate = true;
    }
    TR.roof.count = nr; TR.roof.instanceMatrix.needsUpdate = true; TR.roof.instanceColor.needsUpdate = true;
    TR.glow.count = ng; TR.glow.instanceMatrix.needsUpdate = true; TR.glow.instanceColor.needsUpdate = true;
    TR.updateAVs(t, dt, cam);
    TR.updateBoats(t, dt);
    return ph;
  };
  const _blue = new THREE.Color(0.2, 0.6, 3.2), _head = new THREE.Color(0.42, 0.42, 0.38), _tail = new THREE.Color(0.4, 0.02, 0.03);

  // ---------------- flying cars ----------------
  TR.initAVs = function (scene, n) {
    const body = new NC.GeoBag({ color: 3 });
    body.box(0, 0, 0, 2.4, 0.7, 5.6, { color: [0.1, 0.1, 0.12] });
    body.box(0, 0.5, -0.4, 1.9, 0.5, 2.6, { color: [0.02, 0.03, 0.05] });
    body.box(-1.6, -0.1, -1.2, 1.2, 0.25, 1.6, { color: [0.08, 0.08, 0.1] });
    body.box(1.6, -0.1, -1.2, 1.2, 0.25, 1.6, { color: [0.08, 0.08, 0.1] });
    body.box(-1.6, -0.1, 1.6, 1.0, 0.25, 1.2, { color: [0.08, 0.08, 0.1] });
    body.box(1.6, -0.1, 1.6, 1.0, 0.25, 1.2, { color: [0.08, 0.08, 0.1] });
    const lights = new NC.GeoBag({ color: 3 });
    lights.box(0, 0.05, 2.82, 2.0, 0.12, 0.05, { color: [3, 3.2, 3.6] });
    lights.box(0, 0.05, -2.82, 2.2, 0.14, 0.05, { color: [3.5, 0.15, 0.4] });
    for (const sx of [-1, 1]) for (const sz of [-1.2, 1.6]) lights.box(sx * 1.6, -0.24, sz, 0.7, 0.04, 0.7, { color: [0.4, 1.6, 2.4] });
    const trail = new THREE.PlaneGeometry(1, 1); trail.rotateX(-Math.PI / 2); trail.translate(0, 0, -0.5);
    TR.av = {
      body: new THREE.InstancedMesh(body.build(), M.props, n + 1),
      lights: new THREE.InstancedMesh(lights.build(), new THREE.MeshBasicMaterial({ vertexColors: true }), n + 1),
      trail: new THREE.InstancedMesh(trail, M.additive(T.beam, 0xff3060, 0.5, { fog: true }), n * 2),
      strobe: new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) }), n),
    };
    for (const k in TR.av) { TR.av[k].frustumCulled = false; TR.av[k].instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(TR.av[k]); }
    TR.av.trail.layers.set(NC.LAYER_NOREFL);
    TR.avs = [];
    for (let i = 0; i < n; i++) {
      const loop = chance(0.65);
      TR.avs.push(loop
        ? { loop: true, R: rand(110, 430), r2: rand(0.5, 1), y: rand(55, 170), sp: rand(18, 34) * (chance(0.5) ? 1 : -1), a: rand(0, 6.28), cx: rand(-80, 80), cz: rand(-80, 80) }
        : { loop: false, axis: chance(0.5) ? 'x' : 'z', c: pick([-140, -70, 70, 140]) + rand(-6, 6), y: rand(70, 140), sp: rand(28, 42) * (chance(0.5) ? 1 : -1), p: rand(-700, 700) });
    }
    // parked AV on the Hyperion deck
    const pk = NC.Interiors.parkedAV;
    if (pk) {
      const m = NC.mat4(pk.x, pk.y + 0.75, pk.z, 1, 1, 1, pk.ry + Math.PI / 2);
      TR.av.body.setMatrixAt(n, m); TR.av.lights.setMatrixAt(n, m);
      NC.colliderBox(pk.x, pk.y + 0.8, pk.z, 5.6, 1.6, 3.4, 'av');
    }
  };
  TR.updateAVs = function (t, dt, cam) {
    const av = TR.av, n = TR.avs.length;
    const fl = Math.floor(t * 1.4) % 2 === 0;
    TR.avs.forEach((a, i) => {
      let x, y, z, ry, bank = 0;
      if (a.loop) {
        a.a += (a.sp / a.R) * dt;
        x = a.cx + Math.cos(a.a) * a.R; z = a.cz + Math.sin(a.a) * a.R * a.r2; y = a.y + Math.sin(a.a * 2) * 6;
        const dx = -Math.sin(a.a) * a.R * Math.sign(a.sp), dz = Math.cos(a.a) * a.R * a.r2 * Math.sign(a.sp);
        ry = Math.atan2(dx, dz); bank = -0.25 * Math.sign(a.sp);
      } else {
        a.p += a.sp * dt; if (a.p > 800) a.p -= 1600; if (a.p < -800) a.p += 1600;
        x = a.axis === 'x' ? a.p : a.c; z = a.axis === 'x' ? a.c : a.p; y = a.y;
        ry = a.axis === 'x' ? (a.sp > 0 ? Math.PI / 2 : -Math.PI / 2) : (a.sp > 0 ? 0 : Math.PI);
      }
      const m = NC.mat4(x, y, z, 1, 1, 1, ry, 0, bank);
      av.body.setMatrixAt(i, m); av.lights.setMatrixAt(i, m);
      const fx = Math.sin(ry), fz = Math.cos(ry);
      for (const s of [-1, 1]) {
        const ox = Math.cos(ry) * s * 0.9, oz = -Math.sin(ry) * s * 0.9;
        av.trail.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), NC.mat4(x - fx * 2.9 + ox, y + 0.05, z - fz * 2.9 + oz, 0.35, 1, 22, ry));
      }
      av.strobe.setMatrixAt(i, fl ? NC.mat4(x, y + 0.75, z, 1, 1, 1, 0) : TR.zero);
    });
    for (const k in av) av[k].instanceMatrix.needsUpdate = true;
  };

  // ---------------- water taxis ----------------
  TR.initBoats = function (scene) {
    TR.boats = [];
    const mk = (col) => {
      const bag = new NC.GeoBag({ color: 3 });
      bag.box(0, 0.35, 0, 2.6, 0.7, 9, { color: [0.08, 0.08, 0.1] });
      bag.box(0, 0.9, 0.6, 2.4, 0.4, 7, { color: [0.12, 0.12, 0.14] });
      bag.box(0, 1.55, -0.4, 2.1, 1.0, 4.2, { color: [0.02, 0.03, 0.05] });
      bag.box(0, 2.1, -0.4, 2.3, 0.1, 4.5, { color: [0.1, 0.1, 0.12] });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bag.build(), M.props));
      const nb = new NC.GeoBag({ color: 3, aPhase: 1 });
      const c = new THREE.Color(col);
      nb.box(-1.32, 0.72, 0, 0.05, 0.05, 9, { color: [c.r, c.g, c.b], aPhase: 0 });
      nb.box(1.32, 0.72, 0, 0.05, 0.05, 9, { color: [c.r, c.g, c.b], aPhase: 0 });
      nb.box(0, 1.55, 1.72, 1.9, 0.6, 0.04, { color: [0.6, 0.8, 1.0].map((v) => v * 0.5), aPhase: 0 });
      nb.box(0, 0.6, 4.52, 1.6, 0.12, 0.04, { color: [3, 3, 3], aPhase: 0 });
      nb.box(0, 2.2, -0.4, 0.25, 0.25, 0.25, { color: [3, 0.2, 0.2], aPhase: -0.5 });
      TR.boatNeon = TR.boatNeon || M.neon({ intensity: 2.2 });
      g.add(new THREE.Mesh(nb.build(), TR.boatNeon));
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(5, 26), M.additive(T.beam, 0x9fb8ff, 0.18));
      wake.rotation.x = -Math.PI / 2; wake.position.set(0, 0.05, -17); NC.noRefl(wake); g.add(wake);
      scene.add(g); return g;
    };
    const spec = [{ z: 3.5, sp: 7, col: '#ff2bd6' }, { z: -3.5, sp: -6, col: '#5ef2ff' }, { z: 16, sp: 5, col: '#f3e600' }, { z: -16, sp: -8, col: '#7dff4a' }];
    spec.forEach((s, i) => { const g = mk(s.col); TR.boats.push({ g, z: s.z, sp: s.sp, x: -600 + i * 330 }); });
  };
  TR.updateBoats = function (t, dt) {
    for (const b of TR.boats) {
      b.x += b.sp * dt; if (b.x > 1000) b.x = -1000; if (b.x < -1000) b.x = 1000;
      b.g.position.set(b.x, L.WATER_Y + Math.sin(t * 1.3 + b.z) * 0.06, b.z);
      b.g.rotation.set(Math.sin(t * 0.9 + b.x) * 0.015, b.sp > 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(t * 1.1) * 0.02);
    }
  };
})();
