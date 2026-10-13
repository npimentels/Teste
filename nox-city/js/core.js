/* Nox City — core: namespace, RNG, layout constants, geometry bags, colliders, registries. */
(function () {
  'use strict';
  const NC = (window.NC = {});

  // ---------- RNG ----------
  NC.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const R = (NC.R = NC.mulberry32(2077));
  NC.rand = (a = 0, b = 1) => a + (b - a) * R();
  NC.randi = (a, b) => Math.floor(a + (b - a + 1) * R());
  NC.pick = (arr) => arr[Math.floor(R() * arr.length)];
  NC.chance = (p) => R() < p;
  NC.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  NC.lerp = (a, b, t) => a + (b - a) * t;
  NC.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  NC.hash = (x, y) => {
    let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };

  // ---------- device / quality ----------
  const ua = navigator.userAgent || '';
  NC.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  NC.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (NC.isTouch && Math.min(screen.width, screen.height) < 820);
  NC.QUALITY = {
    low:    { name: 'low',    pr: 0.85, prMax: 1.0,  refl: 0,    rain: 1800, peds: 70,  cars: 0.45, lights: 3, bloom: 0.75, ca: 0, avs: 12 },
    medium: { name: 'medium', pr: 1.0,  prMax: 1.35, refl: 0.33, rain: 3600, peds: 120, cars: 0.7,  lights: 4, bloom: 0.9,  ca: 1, avs: 18 },
    high:   { name: 'high',   pr: 1.0,  prMax: 1.75, refl: 0.5,  rain: 6000, peds: 170, cars: 1.0,  lights: 6, bloom: 1.0,  ca: 1, avs: 26 },
  };
  NC.settings = { quality: NC.isMobile ? 'low' : 'high', sens: 1, vol: 0.8, rain: true, music: true, fps: false };
  try {
    const s = JSON.parse(localStorage.getItem('noxcity.settings') || 'null');
    if (s) Object.assign(NC.settings, s);
  } catch (e) { /* storage unavailable */ }
  NC.saveSettings = () => { try { localStorage.setItem('noxcity.settings', JSON.stringify(NC.settings)); } catch (e) {} };
  NC.Q = () => NC.QUALITY[NC.settings.quality] || NC.QUALITY.medium;

  // ---------- layout ----------
  // River runs along X. Roads every 70 m. Blocks 56 m incl. 4 m sidewalks.
  const L = (NC.L = {
    PITCH: 70, ROAD: 14, HALF: 7, SW: 4,
    RIVER: 24,          // water spans |z| < 24
    PROM: 34,           // promenade spans 24..34
    WATER_Y: -4.6,
    CURB: 0.15,
    XR: [], ZR: [],     // road centres
    INNER_X: 210, INNER_Z: 251,
    LANE_EXT: 430,      // lanes run +-this
  });
  for (let i = -5; i <= 5; i++) L.XR.push(i * 70);
  for (let k = 0; k < 6; k++) { L.ZR.push(41 + 70 * k); L.ZR.push(-(41 + 70 * k)); }
  L.ZR.sort((a, b) => a - b);
  L.blocks = [];
  for (let i = 0; i < L.XR.length - 1; i++) {
    for (let side of [1, -1]) {
      for (let k = 0; k < 5; k++) {
        const za = side * (41 + 70 * k), zb = side * (41 + 70 * (k + 1));
        const x0 = L.XR[i] + 7, x1 = L.XR[i + 1] - 7;
        const z0 = Math.min(za, zb) + 7, z1 = Math.max(za, zb) - 7;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const inner = Math.abs(cx) < L.INNER_X && Math.abs(cz) < L.INNER_Z;
        L.blocks.push({ i, k, side, x0, x1, z0, z1, cx, cz, inner, id: L.blocks.length });
      }
    }
  }
  NC.blockAt = (x, z) => L.blocks.find((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);

  // ---------- shared uniforms ----------
  NC.U = {
    time: { value: 0 },
    fogColor: { value: new THREE.Color(0x1e0f30) },
    fogDensity: { value: 0.0019 },
    beat: { value: 0 },
    camPos: { value: new THREE.Vector3() },
    indoor: { value: 0 },
  };

  // ---------- template geometries ----------
  const G = (NC.G = {});
  G.box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  G.plane = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  G.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1).toNonIndexed();
  G.cyl6 = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1).toNonIndexed();
  G.cylOpen = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, true).toNonIndexed();
  G.sphere = new THREE.SphereGeometry(0.5, 12, 8).toNonIndexed();
  G.ico = new THREE.IcosahedronGeometry(0.5, 1);
  G.cone = new THREE.ConeGeometry(0.5, 1, 12, 1).toNonIndexed();
  G.torus = new THREE.TorusGeometry(0.5, 0.06, 6, 24).toNonIndexed();

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
  NC.mat4 = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
    return _m.compose(_p, _q, _s);
  };

  // A bag of transformed copies of template geometries, merged into one BufferGeometry.
  class GeoBag {
    constructor(spec = {}) {
      this.spec = spec; // e.g. { color: 3, aB: 3, aPhase: 1 }
      this.pos = []; this.nor = []; this.uv = []; this.ex = {};
      for (const k in spec) this.ex[k] = [];
    }
    add(geo, m, vals = {}, uvRect = null) {
      const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
      _nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(m);
        this.pos.push(_v.x, _v.y, _v.z);
        _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
        this.nor.push(_n.x, _n.y, _n.z);
        let u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0;
        if (uvRect) { u = uvRect[0] + u * (uvRect[2] - uvRect[0]); w = uvRect[1] + w * (uvRect[3] - uvRect[1]); }
        this.uv.push(u, w);
        for (const k in this.spec) {
          const c = this.spec[k], v = vals[k];
          if (c === 1) this.ex[k].push(v === undefined ? 0 : v);
          else for (let j = 0; j < c; j++) this.ex[k].push(v === undefined ? 1 : v[j]);
        }
      }
      return this;
    }
    box(x, y, z, sx, sy, sz, vals, ry = 0) { return this.add(G.box, NC.mat4(x, y, z, sx, sy, sz, ry), vals); }
    // box given by min/max corners
    aabb(x0, y0, z0, x1, y1, z1, vals) { return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, vals); }
    // vertical quad facing direction (nx,nz), centred at x,y,z
    quad(x, y, z, w, h, ry, vals, uvRect) { return this.add(G.plane, NC.mat4(x, y, z, w, h, 1, ry), vals, uvRect); }
    get count() { return this.pos.length / 3; }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      for (const k in this.spec) g.setAttribute(k, new THREE.Float32BufferAttribute(this.ex[k], this.spec[k]));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }
  NC.GeoBag = GeoBag;

  // ---------- colliders (AABB + spatial hash) ----------
  const CELL = 8;
  const col = (NC.col = { boxes: [], map: new Map(), stamp: 0 });
  const key = (ix, iz) => (ix + 4096) * 8192 + (iz + 4096);
  NC.addCollider = function (x0, y0, z0, x1, y1, z1, tag) {
    const b = { x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1), tag: tag || 0, s: 0, on: true };
    col.boxes.push(b);
    const ia = Math.floor(b.x0 / CELL), ib = Math.floor(b.x1 / CELL), ka = Math.floor(b.z0 / CELL), kb = Math.floor(b.z1 / CELL);
    for (let i = ia; i <= ib; i++) for (let k = ka; k <= kb; k++) {
      const kk = key(i, k); let a = col.map.get(kk); if (!a) col.map.set(kk, (a = [])); a.push(b);
    }
    return b;
  };
  NC.colliderBox = (cx, cy, cz, sx, sy, sz, tag) => NC.addCollider(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, tag);
  NC.queryColliders = function (x0, z0, x1, z1, out) {
    out.length = 0; col.stamp++;
    const ia = Math.floor(x0 / CELL), ib = Math.floor(x1 / CELL), ka = Math.floor(z0 / CELL), kb = Math.floor(z1 / CELL);
    for (let i = ia; i <= ib; i++) for (let k = ka; k <= kb; k++) {
      const a = col.map.get(key(i, k)); if (!a) continue;
      for (const b of a) if (b.s !== col.stamp && b.on) { b.s = col.stamp; out.push(b); }
    }
    return out;
  };

  // ---------- registries ----------
  NC.interactables = [];
  NC.addInteract = (o) => { o.r = o.r || 1.8; o.y = o.y === undefined ? 1 : o.y; NC.interactables.push(o); return o; };
  NC.seats = [];
  // seat: x,y (seat surface), z, yaw (direction the sitter faces), label
  NC.addSeat = (x, y, z, yaw, label, opts = {}) => {
    const s = { x, y, z, yaw, label: label || 'Sentar', ...opts };
    NC.seats.push(s);
    NC.addInteract({ x, y: y + 0.3, z, r: opts.r || 1.6, label: s.label, kind: 'seat', seat: s, use: () => NC.player.sit(s) });
    return s;
  };
  NC.lightAnchors = [];
  NC.addLight = (x, y, z, color, intensity = 1, distance = 14, w = 1) => {
    const c = new THREE.Color(color);
    NC.lightAnchors.push({ x, y, z, color: c, intensity, distance, w });
  };
  NC.zones = [];
  NC.addZone = (z) => { NC.zones.push(z); return z; };
  NC.zoneAt = (x, y, z) => {
    for (const q of NC.zones) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && y >= (q.y0 ?? -50) && y <= (q.y1 ?? 1e4)) return q;
    return null;
  };
  NC.pois = [];
  NC.addPOI = (p) => { NC.pois.push(p); return p; };
  NC.updaters = [];
  NC.onUpdate = (fn) => NC.updaters.push(fn);
  NC.steamEmitters = [];
  NC.addSteam = (x, y, z, rate = 1, size = 1, color) => NC.steamEmitters.push({ x, y, z, rate, size, acc: 0, color: color || [0.75, 0.72, 0.85] });

  // layer constants: 0 everything reflected, 1 = not in reflection, 2 = reflective surfaces
  NC.LAYER_NOREFL = 1;
  NC.LAYER_SURF = 2;
  NC.noRefl = (obj) => { obj.layers.set(NC.LAYER_NOREFL); return obj; };
  NC.surf = (obj) => { obj.layers.set(NC.LAYER_SURF); return obj; };

  // progress reporting
  NC.progress = (p, txt) => {
    const bar = document.querySelector('#loadbar i'); if (bar) bar.style.width = Math.round(p * 100) + '%';
    const t = document.getElementById('loadtxt'); if (t && txt) t.textContent = txt;
  };
  NC.wait = () => new Promise((r) => setTimeout(r, 0));
})();
