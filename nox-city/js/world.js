/* Nox City — city generator: ground, blocks, buildings, signs, ads, river, bridges, street furniture. */
(function () {
  'use strict';
  const NC = window.NC;
  const L = NC.L, G = NC.G, M = NC.M, T = NC.T;
  const { rand, randi, pick, chance } = NC;
  const W = (NC.World = {});
  const V3 = THREE.Vector3;

  const NEON = ['#ff2bd6', '#5ef2ff', '#f3e600', '#ff6a3d', '#9d6bff', '#ff3b4e', '#7dff4a', '#ffffff'].map((c) => new THREE.Color(c));
  const nc = (i) => { const c = typeof i === 'number' ? NEON[i % NEON.length] : new THREE.Color(i); return [c.r, c.g, c.b]; };
  W.nc = nc; W.NEON = NEON;
  const rot = (lx, lz, ry) => [lx * Math.cos(ry) + lz * Math.sin(ry), -lx * Math.sin(ry) + lz * Math.cos(ry)];
  W.rot = rot;
  W.yawFromDir = (fx, fz) => Math.atan2(-fx, -fz);

  // Blocks given over to hand-built sites in interiors.js
  W.SPECIAL = [
    { x0: 77, x1: 133, z0: 48, z1: 104, id: 'start' },
    { x0: 7, x1: 63, z0: 48, z1: 104, id: 'club' },
    { x0: -63, x1: -7, z0: 48, z1: 104, id: 'konbini' },
    { x0: 7, x1: 63, z0: -104, z1: -48, id: 'hyperion' },
    { x0: -63, x1: -7, z0: -104, z1: -48, id: 'plaza' },
  ];
  const isSpecial = (b) => W.SPECIAL.find((s) => Math.abs(s.x0 - b.x0) < 1 && Math.abs(s.z0 - b.z0) < 1);

  // ---------------- bags ----------------
  W.begin = function () {
    W.bagB = new NC.GeoBag({ aB: 3 });
    W.bagFar = new NC.GeoBag({ aB: 3 });
    W.bagNeon = new NC.GeoBag({ color: 3, aPhase: 1 });
    W.bagSign = new NC.GeoBag({ color: 3, aPhase: 1 });
    W.bagGround = new NC.GeoBag({});
    W.bagProps = new NC.GeoBag({ color: 3 });
    W.bagGloss = new NC.GeoBag({ color: 3 });
    W.bagPool = new NC.GeoBag({ color: 3 });
    W.adBags = {};
    W.vendBags = {};
    W.cables = [];
    W.stringLights = [];
    W.holos = [];
    W.atlas = T.buildSignAtlas();
  };

  // ---------------- helpers ----------------
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new V3(0, 1, 0), _d = new V3(), _mid = new V3(), _sc = new V3();
  W.beam = function (bag, a, b, thick, vals) {
    _d.subVectors(b, a); const len = _d.length(); _d.normalize();
    _mid.addVectors(a, b).multiplyScalar(0.5);
    _q.setFromUnitVectors(_up, _d); _sc.set(thick, len, thick);
    _m.compose(_mid, _q, _sc); bag.add(G.box, _m, vals);
  };
  W.neonBox = (x, y, z, sx, sy, sz, color, phase = 0, ry = 0) => W.bagNeon.box(x, y, z, sx, sy, sz, { color: color, aPhase: phase }, ry);
  W.prop = (x, y, z, sx, sy, sz, color, ry = 0, gloss = false) => (gloss ? W.bagGloss : W.bagProps).box(x, y, z, sx, sy, sz, { color }, ry);
  W.propGeo = (geo, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, gloss = false) => (gloss ? W.bagGloss : W.bagProps).add(geo, NC.mat4(x, y, z, sx, sy, sz, ry, rx, rz), { color });
  W.pool = (x, y, z, r, color, k = 0.35) => W.bagPool.add(G.plane, NC.mat4(x, y, z, r * 2, r * 2, 1, 0, -Math.PI / 2), { color: color.map((c) => c * k) });

  // A sign quad from the atlas. (x,y,z) centre, ry facing, width w.
  W.sign = function (rect, x, y, z, w, ry, phase, tint) {
    const h = w / rect.aspect;
    W.bagSign.quad(x, y, z, w, h, ry, { color: tint || [1, 1, 1], aPhase: phase }, rect.uv);
    return h;
  };
  // Ad billboard on a facade
  W.ad = function (name, x, y, z, w, h, ry, frameColor) {
    if (!W.adBags[name]) W.adBags[name] = new NC.GeoBag({});
    W.adBags[name].quad(x, y, z, w, h, ry);
    const fc = frameColor || nc(randi(0, 6));
    const [nx, nz] = rot(0, 1, ry), [tx, tz] = rot(1, 0, ry);
    const fx = x + nx * 0.02, fz = z + nz * 0.02;
    W.neonBox(fx + tx * (w / 2 + 0.12), y, fz + tz * (w / 2 + 0.12), 0.18, h + 0.4, 0.18, fc, 2 + Math.random());
    W.neonBox(fx - tx * (w / 2 + 0.12), y, fz - tz * (w / 2 + 0.12), 0.18, h + 0.4, 0.18, fc, 2 + Math.random());
    W.bagNeon.box(fx, y + h / 2 + 0.12, fz, w + 0.4, 0.18, 0.18, { color: fc, aPhase: 0 }, ry);
    W.bagNeon.box(fx, y - h / 2 - 0.12, fz, w + 0.4, 0.18, 0.18, { color: fc, aPhase: 0 }, ry);
    // a glow pool on the ground in front of low ads
    NC.addLight(x + nx * 4, Math.min(y, 12), z + nz * 4, new THREE.Color(...fc), 1.4, 26, 0.5);
  };

  // ---------------- building ----------------
  // returns footprint info; tiers & details are added to bags
  W.addBuilding = function (x0, x1, z0, z1, h, o = {}) {
    const seed = rand();
    const style = o.style !== undefined ? o.style : pick([0, 0, 1, 1, 2, 3, 4, 0, 1, 4]);
    const shop = o.shop !== undefined ? o.shop : !!o.inner;
    const y0 = o.y0 !== undefined ? o.y0 : L.CURB;
    const tiers = [];
    const w = x1 - x0, d = z1 - z0;
    if (!o.noTiers && h > 55 && chance(0.62) && Math.min(w, d) > 18) {
      const h1 = h * rand(0.5, 0.74), ins = Math.min(rand(3, 7), Math.min(w, d) / 4);
      tiers.push([x0, x1, z0, z1, y0, h1]);
      tiers.push([x0 + ins, x1 - ins, z0 + ins, z1 - ins, h1, h]);
      if (h > 130 && chance(0.55)) { const i2 = ins + Math.min(rand(3, 6), (Math.min(w, d) - 2 * ins) / 4); tiers.push([x0 + i2, x1 - i2, z0 + i2, z1 - i2, h, h + rand(8, 22)]); }
    } else tiers.push([x0, x1, z0, z1, y0, h]);
    const bag = o.far ? W.bagFar : W.bagB;
    tiers.forEach((t, i) => {
      bag.aabb(t[0], t[4], t[2], t[1], t[5], t[3], { aB: [seed, style + (shop && i === 0 ? 10 : 0), t[5]] });
      if (!o.far) NC.addCollider(t[0], t[4], t[2], t[1], t[5], t[3], 'bld');
    });
    const top = tiers[tiers.length - 1];
    const topH = top[5];
    if (o.far) return { x0, x1, z0, z1, h: topH };
    // spire + aviation lights
    if (topH > 85 && chance(0.55)) {
      const sh = rand(14, 46), cx = (top[0] + top[1]) / 2, cz = (top[2] + top[3]) / 2;
      W.prop(cx, topH + sh / 2, cz, 0.7, sh, 0.7, [0.08, 0.08, 0.1]);
      W.neonBox(cx, topH + sh + 0.4, cz, 0.8, 0.8, 0.8, nc('#ff2030'), -rand(0, 1));
    }
    if (topH > 50) {
      for (const [cx, cz] of [[top[0] + 0.5, top[2] + 0.5], [top[1] - 0.5, top[3] - 0.5]]) W.neonBox(cx, topH + 0.5, cz, 0.6, 0.6, 0.6, nc('#ff2030'), -rand(0, 1));
    }
    // neon corner strips
    if (o.inner !== false && (o.inner || topH > 70) && chance(0.42)) {
      const col = nc(randi(0, 6)), ph = chance(0.5) ? 0 : 2 + rand();
      const t0 = tiers[0];
      for (const [cx, cz] of [[t0[0], t0[2]], [t0[1], t0[2]], [t0[0], t0[3]], [t0[1], t0[3]]]) if (chance(0.8)) W.neonBox(cx, (6 + t0[5]) / 2, cz, 0.22, t0[5] - 6, 0.22, col, ph);
    }
    // rooftop outline neon on some
    if (chance(0.3)) {
      const col = nc(randi(0, 6));
      W.neonBox((top[0] + top[1]) / 2, topH + 0.1, top[2], top[1] - top[0], 0.2, 0.2, col);
      W.neonBox((top[0] + top[1]) / 2, topH + 0.1, top[3], top[1] - top[0], 0.2, 0.2, col);
      W.neonBox(top[0], topH + 0.1, (top[2] + top[3]) / 2, 0.2, 0.2, top[3] - top[2], col);
      W.neonBox(top[1], topH + 0.1, (top[2] + top[3]) / 2, 0.2, 0.2, top[3] - top[2], col);
    }
    // rooftop clutter on lower buildings
    if (o.inner && topH < 70) {
      const n = randi(1, 4);
      for (let i = 0; i < n; i++) {
        const px = rand(top[0] + 2, top[1] - 2), pz = rand(top[2] + 2, top[3] - 2);
        if (chance(0.5)) { W.propGeo(G.cyl, px, topH + 2.6, pz, 3, 3, 3, [0.12, 0.1, 0.09]); W.prop(px, topH + 0.6, pz, 2.6, 1.2, 2.6, [0.06, 0.06, 0.07]); }
        else W.prop(px, topH + 0.7, pz, rand(1.5, 3), 1.4, rand(1.5, 3), [0.1, 0.1, 0.12]);
      }
    }
    return { x0, x1, z0, z1, h: topH, tiers, seed, style };
  };

  // street-level dressing on a facade of an inner building
  W.dressFacade = function (face, bh, dense = 1) {
    const { ax, az, tx, tz, nx, nz, len } = face;
    const ry = Math.atan2(nx, nz);
    // vertical protruding signs
    const nv = Math.floor(len / 14 * dense) + (chance(0.5) ? 1 : 0);
    for (let i = 0; i < nv; i++) {
      const s = rand(3, len - 3), y = rand(7.5, Math.min(bh - 3, 16));
      if (y < 7) continue;
      const px = ax + tx * s + nx * 1.05, pz = az + tz * s + nz * 1.05;
      const r = pick(W.atlas.vert), wv = 1.5;
      const ryS = Math.atan2(tx, tz);
      W.sign(r, px, y, pz, wv, ryS, chance(0.25) ? rand(0.01, 0.99) : 0);
      W.sign(r, px, y, pz, wv, ryS + Math.PI, 0);
      W.prop(ax + tx * s + nx * 0.25, y, az + tz * s + nz * 0.25, 0.1, 0.1, 0.5, [0.1, 0.1, 0.1], ry);
    }
    // horizontal signs above storefronts
    const nh = Math.floor(len / 12 * dense);
    for (let i = 0; i < nh; i++) {
      const s = (i + 0.5) * (len / nh) + rand(-1, 1);
      const r = pick(W.atlas.horiz), ww = rand(3.6, 5.4);
      const y = chance(0.75) ? 5.6 : rand(8, Math.min(14, bh - 2));
      if (y > bh - 1) continue;
      W.sign(r, ax + tx * s + nx * 0.12, y, az + tz * s + nz * 0.12, ww, ry, chance(0.2) ? rand(0.01, 0.99) : 0);
    }
    // awnings
    for (let s = 3; s < len - 3; s += 6) {
      if (!chance(0.35)) continue;
      const col = nc(randi(0, 6)).map((c) => c * 0.35);
      const px = ax + tx * s + nx * 0.8, pz = az + tz * s + nz * 0.8;
      W.prop(px, 3.55, pz, 4.6, 0.1, 1.6, col, ry);
      W.bagNeon.box(ax + tx * s + nx * 1.6, 3.5, az + tz * s + nz * 1.6, 4.6, 0.06, 0.06, { color: nc(randi(0, 6)), aPhase: 0 }, ry);
    }
    // AC units / boxes
    const nac = Math.floor(len / 6 * dense);
    for (let i = 0; i < nac; i++) {
      const s = rand(1.5, len - 1.5), y = rand(7, Math.min(bh - 1, 30));
      W.prop(ax + tx * s + nx * 0.35, y, az + tz * s + nz * 0.35, 0.9, 0.6, 0.7, [0.13, 0.13, 0.14], ry);
    }
  };

  function facesOf(x0, x1, z0, z1) {
    return [
      { id: 'N', ax: x0, az: z0, tx: 1, tz: 0, nx: 0, nz: -1, len: x1 - x0 },
      { id: 'S', ax: x1, az: z1, tx: -1, tz: 0, nx: 0, nz: 1, len: x1 - x0 },
      { id: 'W', ax: x0, az: z1, tx: 0, tz: -1, nx: -1, nz: 0, len: z1 - z0 },
      { id: 'E', ax: x1, az: z0, tx: 0, tz: 1, nx: 1, nz: 0, len: z1 - z0 },
    ];
  }
  W.facesOf = facesOf;

  function heightFor(b, cx, cz) {
    const north = cz < 0, row = b.k;
    const dC = Math.hypot(cx, cz);
    if (!b.inner) return north ? rand(60, 230) : rand(40, 170);
    if (north && row === 0) return rand(110, 210);
    if (north) return rand(55, 170);
    if (row === 0) return rand(16, 58);
    return rand(22, 110) * (dC < 200 ? 1.1 : 1);
  }

  // ---------------- generate the city ----------------
  W.generate = function () {
    const ads = ['hyperion', 'vanta', 'kurogane', 'neo77', 'skull', 'jinguji', 'cola', 'zenkai', 'voltage', 'mirai', 'ramenad'];
    for (const b of L.blocks) {
      // sidewalk slab
      W.bagGround.aabb(b.x0, 0, b.z0, b.x1, L.CURB, b.z1);
      NC.addCollider(b.x0, -0.5, b.z0, b.x1, L.CURB, b.z1, 'slab');
      if (isSpecial(b)) continue;
      const lx0 = b.x0 + L.SW, lx1 = b.x1 - L.SW, lz0 = b.z0 + L.SW, lz1 = b.z1 - L.SW;
      // parcels
      let parcels;
      const r = rand();
      const mx = (lx0 + lx1) / 2 + rand(-6, 6), mz = (lz0 + lz1) / 2 + rand(-6, 6);
      if (r < 0.2) parcels = [[lx0, lx1, lz0, lz1]];
      else if (r < 0.45) parcels = [[lx0, mx, lz0, lz1], [mx, lx1, lz0, lz1]];
      else if (r < 0.65) parcels = [[lx0, lx1, lz0, mz], [lx0, lx1, mz, lz1]];
      else parcels = [[lx0, mx, lz0, mz], [mx, lx1, lz0, mz], [lx0, mx, mz, lz1], [mx, lx1, mz, lz1]];
      for (const p of parcels) {
        const gap = b.inner ? 0.8 : 0.5;
        const px0 = p[0] + (Math.abs(p[0] - lx0) < 0.1 ? 0 : gap), px1 = p[1] - (Math.abs(p[1] - lx1) < 0.1 ? 0 : gap);
        const pz0 = p[2] + (Math.abs(p[2] - lz0) < 0.1 ? 0 : gap), pz1 = p[3] - (Math.abs(p[3] - lz1) < 0.1 ? 0 : gap);
        const cx = (px0 + px1) / 2, cz = (pz0 + pz1) / 2;
        let h = heightFor(b, cx, cz);
        if (parcels.length === 4 && b.inner && chance(0.3)) h *= 0.5;
        const info = W.addBuilding(px0, px1, pz0, pz1, h, { inner: b.inner });
        if (!b.inner) {
          if (h > 120 && chance(0.35)) {
            const f = pick(facesOf(px0, px1, pz0, pz1)), a = W.T_ad(pick(ads));
            const aw = Math.min(f.len * 0.7, 26), ah = Math.min(aw / a.aspect, info.tiers[0][5] * 0.6);
            const s = f.len / 2, y = info.tiers[0][5] * 0.55;
            W.ad(a.name, f.ax + f.tx * s + f.nx * 0.4, y, f.az + f.tz * s + f.nz * 0.4, ah * a.aspect, ah, Math.atan2(f.nx, f.nz));
          }
          continue;
        }
        // street dressing on faces that touch the lot boundary
        for (const f of facesOf(px0, px1, pz0, pz1)) {
          const street = (f.id === 'N' && Math.abs(pz0 - lz0) < 0.1) || (f.id === 'S' && Math.abs(pz1 - lz1) < 0.1) || (f.id === 'W' && Math.abs(px0 - lx0) < 0.1) || (f.id === 'E' && Math.abs(px1 - lx1) < 0.1);
          if (street) W.dressFacade(f, info.tiers[0][5], 1);
          // billboards
          const tall = info.h > 60;
          const wantAd = (b.side < 0 && b.k === 0 && f.id === 'S') || (tall && chance(0.3)) || (!tall && street && chance(0.18));
          if (wantAd && f.len > 10) {
            let a;
            if (b.side < 0 && b.k === 0) a = W.T_ad(pick(['hyperion', 'vanta', 'skull', 'jinguji', 'mirai', 'kurogane', 'neo77']));
            else a = W.T_ad(pick(ads));
            const t0top = info.tiers[0][5];
            let aw, ah;
            if (a.aspect < 0.7) { aw = Math.min(f.len * 0.55, 20); ah = aw / a.aspect; if (ah > t0top - 14) { ah = t0top - 14; aw = ah * a.aspect; } }
            else { aw = Math.min(f.len * 0.7, 18); ah = aw / a.aspect; }
            if (ah < 4) continue;
            const y = a.aspect < 0.7 ? Math.max(12 + ah / 2, t0top * 0.5) : rand(9 + ah / 2, Math.max(10 + ah / 2, Math.min(t0top - ah / 2 - 2, 30)));
            if (y + ah / 2 > t0top - 1) continue;
            const s = f.len * rand(0.35, 0.65);
            W.ad(a.name, f.ax + f.tx * s + f.nx * 0.45, y, f.az + f.tz * s + f.nz * 0.45, aw, ah, Math.atan2(f.nx, f.nz));
          }
        }
      }
    }
    W.sidewalkProps();
    W.riverAndBridges();
    W.farSkyline();
    W.cablesAndLights();
  };
  W.T_ad = (n) => T.adByName(n);

  // ---------------- street furniture ----------------
  W.addLamp = function (x, z, nx, nz, cool) {
    const ry = Math.atan2(nx, nz);
    const pc = [0.07, 0.07, 0.08];
    W.propGeo(G.cyl6, x, L.CURB + 3.6, z, 0.22, 7.2, 0.22, pc);
    W.prop(x + nx * 0.9, L.CURB + 7.15, z + nz * 0.9, 0.16, 0.16, 1.9, pc, ry);
    const hx = x + nx * 1.75, hz = z + nz * 1.75;
    W.prop(hx, L.CURB + 7.05, hz, 0.5, 0.18, 0.9, pc, ry);
    const col = cool ? [0.75, 0.9, 1.0] : [1.0, 0.72, 0.42];
    W.neonBox(hx, L.CURB + 6.93, hz, 0.42, 0.06, 0.8, col.map((c) => c * 1.2), 0, ry);
    W.pool(hx, 0.025, hz, 6.5, col, 0.26);
    NC.addLight(hx, 6.5, hz, new THREE.Color(...col), 1.2, 18, 1);
    NC.addCollider(x - 0.15, 0, z - 0.15, x + 0.15, 7, z + 0.15, 'pole');
  };

  W.addBench = function (x, y, z, ry, opts = {}) {
    const wood = opts.color || [0.16, 0.09, 0.05], metal = [0.06, 0.06, 0.07];
    const P = (lx, ly, lz, sx, sy, sz, c) => { const [ox, oz] = rot(lx, lz, ry); W.prop(x + ox, y + ly, z + oz, sx, sy, sz, c, ry); };
    P(0, 0.44, 0, 1.9, 0.07, 0.48, wood);
    P(0, 0.8, -0.26, 1.9, 0.38, 0.06, wood);
    for (const s of [-0.8, 0.8]) { P(s, 0.22, 0, 0.06, 0.44, 0.44, metal); P(s, 0.62, -0.25, 0.06, 0.6, 0.05, metal); }
    if (opts.neon) { const [ox, oz] = rot(0, 0.24, ry); W.neonBox(x + ox, y + 0.4, z + oz, 1.9, 0.03, 0.03, opts.neon, 0, ry); }
    const [cx, cz] = rot(0, 0.05, ry);
    NC.addSeat(x + cx, y + 0.48, z + cz, W.yawFromDir(Math.sin(ry), Math.cos(ry)), opts.label || 'Sentar no banco');
    const ex = Math.abs(Math.cos(ry)) * 0.95 + Math.abs(Math.sin(ry)) * 0.25, ez = Math.abs(Math.sin(ry)) * 0.95 + Math.abs(Math.cos(ry)) * 0.25;
    NC.addCollider(x - ex, y, z - ez, x + ex, y + 0.47, z + ez, 'bench');
  };

  const VEND_ITEMS = {
    cola: [
      { name: 'Synth Cola', price: 3, desc: 'Gelada, gás de nitrogênio. Clássico de Nox.', fx: 'drink' },
      { name: 'Synth Cola Zero', price: 3, desc: 'Mesma coisa, zero açúcar sintético.', fx: 'drink' },
      { name: 'Chá matcha em lata', price: 4, desc: 'Amargo e reconfortante.', fx: 'calm' },
    ],
    zenkai: [
      { name: 'Zenkai Energy', price: 6, desc: 'Corrida turbinada por 60 segundos.', fx: 'energy' },
      { name: 'Zenkai Ultra', price: 9, desc: 'Corrida turbinada e pulo alto por 60 segundos.', fx: 'ultra' },
    ],
    noodle: [
      { name: 'Copo de lámen', price: 5, desc: 'Água quente inclusa. Sabor missô.', fx: 'food' },
      { name: 'Onigiri de atum', price: 4, desc: 'Embalado às 03:00. Ainda bom.', fx: 'food' },
      { name: 'Takoyaki congelado', price: 6, desc: 'Esquenta no próprio pacote.', fx: 'food' },
    ],
    blue: [
      { name: 'Água AQUA+', price: 2, desc: 'Filtrada três vezes. Dizem.', fx: 'drink' },
      { name: 'Isotônico neon', price: 4, desc: 'Brilha no escuro. Não pergunte.', fx: 'energy' },
    ],
  };
  const VEND_NAMES = { cola: 'Máquina Synth Cola', zenkai: 'Máquina Zenkai', noodle: 'Máquina de comida', blue: 'Máquina AQUA+' };
  W.addVending = function (x, y, z, ry, kind) {
    kind = kind || pick(['cola', 'zenkai', 'noodle', 'blue', 'cola']);
    const [nx, nz] = rot(0, 1, ry);
    W.prop(x, y + 0.95, z, 1.05, 1.9, 0.8, [0.75, 0.77, 0.82], ry, true);
    if (!W.vendBags[kind]) W.vendBags[kind] = new NC.GeoBag({});
    W.vendBags[kind].quad(x + nx * 0.41, y + 0.98, z + nz * 0.41, 0.98, 1.84, ry);
    const glow = { cola: '#ff3a4a', zenkai: '#7dff4a', noodle: '#ffcf6a', blue: '#5ef2ff' }[kind];
    W.pool(x + nx * 1.1, y + 0.03, z + nz * 1.1, 1.8, nc(glow), 0.4);
    NC.addLight(x + nx * 1.2, y + 1.4, z + nz * 1.2, glow, 1.0, 7, 0.6);
    NC.colliderBox(x, y + 0.95, z, 1.1, 1.9, 1.1, 'vend');
    NC.addInteract({ x: x + nx * 0.9, y: y + 1, z: z + nz * 0.9, r: 1.7, label: 'Usar ' + VEND_NAMES[kind], kind: 'vend', use: () => NC.UI.shop(VEND_NAMES[kind], VEND_ITEMS[kind], { vend: true, x, y, z, nx, nz }) });
  };
  W.VEND_ITEMS = VEND_ITEMS;

  W.sidewalkProps = function () {
    for (const b of L.blocks) {
      if (!b.inner) continue;
      const faces = facesOf(b.x0, b.x1, b.z0, b.z1);
      for (const f of faces) {
        // lamps along the curb, arm over the road
        const cool = chance(0.3);
        for (let s = 9; s < f.len - 8; s += 26) {
          const x = f.ax + f.tx * s + f.nx * -0.7, z = f.az + f.tz * s + f.nz * -0.7;
          // faces' normals point outward from the block, toward the road
          W.addLamp(x, z, f.nx, f.nz, cool);
        }
        // manholes with steam on the road in front
        if (chance(0.35)) {
          const s = rand(10, f.len - 10), x = f.ax + f.tx * s + f.nx * rand(3, 10), z = f.az + f.tz * s + f.nz * rand(3, 10);
          W.propGeo(G.cyl, x, 0.01, z, 1.0, 0.02, 1.0, [0.05, 0.05, 0.05]);
          NC.addSteam(x, 0.1, z, 0.9, 1.1);
        }
        // benches / vending on the building side of the sidewalk
        const special = isSpecial(b);
        if (!special && chance(0.45)) {
          const s = rand(10, f.len - 10);
          const x = f.ax + f.tx * s - f.nx * (L.SW - 0.6), z = f.az + f.tz * s - f.nz * (L.SW - 0.6);
          W.addVending(x, L.CURB, z, Math.atan2(f.nx, f.nz));
        }
        if (chance(0.4)) {
          const s = rand(8, f.len - 8);
          const x = f.ax + f.tx * s - f.nx * 1.4, z = f.az + f.tz * s - f.nz * 1.4;
          W.addBench(x, L.CURB, z, Math.atan2(f.nx, f.nz));
        }
        // trash bags / boxes near walls
        if (!special && chance(0.5)) {
          const s = rand(4, f.len - 4);
          for (let i = 0; i < randi(2, 5); i++) {
            const x = f.ax + f.tx * (s + rand(-1, 1)) - f.nx * rand(3.3, 3.8), z = f.az + f.tz * (s + rand(-1, 1)) - f.nz * rand(3.3, 3.8);
            W.propGeo(G.ico, x, L.CURB + 0.3, z, rand(0.6, 0.9), rand(0.5, 0.7), rand(0.6, 0.9), chance(0.5) ? [0.02, 0.02, 0.025] : [0.08, 0.1, 0.16], rand(0, 6));
          }
        }
      }
    }
  };

  // ---------------- river, promenades, bridges ----------------
  W.bridgeXs = L.XR.slice();
  W.riverAndBridges = function () {
    const WY = L.WATER_Y;
    // embankment walls
    for (const s of [1, -1]) {
      W.prop(0, -3, s * 24.2, 2400, 6.3, 0.6, [0.07, 0.07, 0.085]);
      // promenade segments between N-S roads, plus long ones beyond the grid
      const xs = [-1200, ...L.XR, 1200];
      for (let i = 0; i < xs.length - 1; i++) {
        const xa = xs[i] === -1200 ? -1200 : xs[i] + 7, xb = xs[i + 1] === 1200 ? 1200 : xs[i + 1] - 7;
        W.bagGround.aabb(xa, 0, Math.min(s * 24, s * 34), xb, L.CURB, Math.max(s * 24, s * 34));
        NC.addCollider(xa, -0.5, Math.min(s * 24, s * 34), xb, L.CURB, Math.max(s * 24, s * 34), 'slab');
      }
      // railing along the water with gaps at bridges
      let segs = [[-1200, 1200]];
      for (const xc of L.XR) {
        const out = [];
        for (const [a, b] of segs) { if (xc + 11 <= a || xc - 11 >= b) out.push([a, b]); else { if (xc - 11 > a) out.push([a, xc - 11]); if (xc + 11 < b) out.push([xc + 11, b]); } }
        segs = out;
      }
      for (const [a, b] of segs) {
        const zr = s * 24.35;
        W.prop((a + b) / 2, L.CURB + 1.05, zr, b - a, 0.08, 0.12, [0.1, 0.1, 0.12], 0, true);
        if (Math.abs(a) < 400 || Math.abs(b) < 400) {
          const aa = Math.max(a, -400), bb = Math.min(b, 400);
          for (let x = aa + 1; x < bb; x += 2.2) W.prop(x, L.CURB + 0.52, zr, 0.06, 1.05, 0.06, [0.1, 0.1, 0.12]);
          W.neonBox((aa + bb) / 2, L.CURB + 1.11, zr, bb - aa, 0.04, 0.04, nc('#5ef2ff').map((c) => c * 0.6));
        }
        NC.addCollider(a, 0, zr - 0.15, b, 1.25, zr + 0.15, 'rail');
      }
      // promenade lamps and benches near the city centre
      for (let x = -340; x <= 340; x += 22) {
        if (L.XR.some((xc) => Math.abs(x - xc) < 12)) continue;
        const z = s * 33.2;
        if (Math.abs(x) <= 330) W.addLamp(x, z, 0, s, false);
        if (Math.abs(x) < 240 && chance(0.7)) {
          const bx = x + 11;
          if (!L.XR.some((xc) => Math.abs(bx - xc) < 12) && !(s > 0 && bx > 14 && bx < 46)) W.addBench(bx, L.CURB, s * 25.6, Math.atan2(0, -s), { neon: nc('#ff2bd6').map((c) => c * 0.5) });
        }
      }
      // drain lights on the embankment
      for (let x = -600; x <= 600; x += 37) W.neonBox(x, -2.2, s * 23.88, 1.6, 0.25, 0.08, nc('#ff6a3d').map((c) => c * 0.7), Math.random() < 0.3 ? 0.5 : 0);
    }
    // water
    const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 48.2, 1, 1), M.water());
    water.rotation.x = -Math.PI / 2; water.position.y = WY;
    NC.surf(water); W.water = water;

    // bridges
    for (const xc of L.XR) W.addBridge(xc, xc === 0);
  };

  W.addBridge = function (xc, main) {
    const zc = 24.6;
    // deck body
    W.prop(xc, -0.8, 0, 22, 1.56, zc * 2, [0.06, 0.06, 0.07]);
    W.bagGround.add(G.plane, NC.mat4(xc, 0.0, 0, 14, zc * 2, 1, 0, -Math.PI / 2));
    W.bagGround.aabb(xc - 11, 0, -zc, xc - 7, L.CURB, zc);
    W.bagGround.aabb(xc + 7, 0, -zc, xc + 11, L.CURB, zc);
    NC.addCollider(xc - 11, -1.6, -zc, xc + 11, 0, zc, 'deck');
    NC.addCollider(xc - 11, 0, -zc, xc - 7, L.CURB, zc, 'slab');
    NC.addCollider(xc + 7, 0, -zc, xc + 11, L.CURB, zc, 'slab');
    // piers
    for (const pz of [-9, 9]) W.prop(xc, -5.5, pz, 13, 8, 2.6, [0.05, 0.05, 0.06]);
    // railings
    const railCol = main ? nc('#ff2bd6') : nc(xc % 140 === 0 ? '#5ef2ff' : '#ffffff').map((c) => c * 0.7);
    for (const sx of [-1, 1]) {
      const rx = xc + sx * 10.9;
      const gap = main && sx === 1; // opening to the pylon elevator
      const segs = gap ? [[-zc, -1.6], [1.6, zc]] : [[-zc, zc]];
      for (const [a, b] of segs) {
        W.prop(rx, L.CURB + 1.08, (a + b) / 2, 0.1, 0.08, b - a, [0.1, 0.1, 0.12], 0, true);
        W.prop(rx, L.CURB + 0.55, (a + b) / 2, 0.04, 0.9, b - a, [0.05, 0.05, 0.06]);
        W.neonBox(rx, L.CURB + 1.14, (a + b) / 2, 0.05, 0.05, b - a, railCol);
        NC.addCollider(rx - 0.15, 0, a, rx + 0.15, 1.3, b, 'rail');
      }
      // under-deck light line
      W.neonBox(xc + sx * 11.05, -1.55, 0, 0.08, 0.08, zc * 2, main ? nc('#ff2bd6') : nc('#9d6bff').map((c) => c * 0.6));
      // lamps
      for (let z = -18; z <= 18; z += 12) W.addLamp(xc + sx * 10.4, z, -sx, 0, true);
    }
    if (main) W.mainBridge(xc);
  };

  W.mainBridge = function (xc) {
    const pink = nc('#ff2bd6'), cyan = nc('#5ef2ff');
    // LED text bands on both girder faces
    const band = T.ledBand('夜の街は、眠らない  //  NOX CITY NEVER SLEEPS  //  ', '#ff3bd8');
    const mat = M.billboard(band, { intensity: 2.0, scroll: 0.05 });
    mat.uniforms.uSeed.value = 99;
    for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(49, 1.25), mat);
      m.position.set(xc + sx * 11.07, -0.78, 0); m.rotation.y = sx * Math.PI / 2;
      // texture repeats along the length
      const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 3 * (sx > 0 ? 1 : -1));
      W.extraMeshes.push(m);
    }
    // pylons
    for (const sx of [-1, 1]) {
      const px = xc + sx * 13.3;
      W.prop(px, 26, 0, 2.4, 64, 2.6, [0.07, 0.07, 0.085]);
      NC.addCollider(px - 1.2, -6, -1.3, px + 1.2, 58, 1.3, 'pylon');
      for (const ez of [-1.33, 1.33]) W.neonBox(px - sx * 1.22, 27, ez, 0.12, 54, 0.12, pink, 2.3);
      W.neonBox(px + sx * 1.22, 27, 0, 0.12, 54, 0.12, cyan, 0);
      // stay cables
      for (const dz of [-1, 1]) for (let k = 0; k < 5; k++) {
        const z = dz * (6 + k * 4.2);
        W.beam(W.bagNeon, new V3(px - sx * 0.6, 46 - k * 1.5, dz * 0.8), new V3(xc + sx * 10.9, L.CURB + 1.2, z), 0.09, { color: pink.map((c) => c * 0.8), aPhase: 0 });
      }
    }
    // cross beams
    for (const y of [20, 34]) { W.prop(xc, y, 0, 26, 1.4, 2.2, [0.07, 0.07, 0.085]); W.neonBox(xc, y - 0.75, 1.12, 26, 0.08, 0.08, pink); W.neonBox(xc, y - 0.75, -1.12, 26, 0.08, 0.08, pink); }
    // big crown sign
    W.neonBox(xc, 59.2, 0, 28.4, 0.25, 0.25, pink, 2.1);
  };

  // ---------------- far skyline ----------------
  W.farSkyline = function () {
    const rng = NC.mulberry32(909);
    const R2 = (a, b) => a + (b - a) * rng();
    for (let i = 0; i < 520; i++) {
      const a = R2(0, Math.PI * 2), r = R2(470, 1150);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(z) < 50) continue;
      if (Math.abs(x) < 380 && Math.abs(z) < 410) continue;
      const w = R2(24, 70), d = R2(24, 70), h = R2(60, 200) + (r - 470) * R2(0.05, 0.4) * (rng() < 0.3 ? 1.5 : 1);
      W.addBuilding(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h, { far: true, style: Math.floor(R2(0, 5)), shop: false, noTiers: rng() < 0.5, y0: 0 });
    }
    // towers lining the river toward both horizons
    for (const s of [1, -1]) for (let x = 370; x < 1200; x += R2(30, 55)) for (const sx of [1, -1]) {
      const w = R2(22, 46), h = R2(70, 260);
      const z0 = s * R2(52, 60);
      W.addBuilding(sx * x - w / 2, sx * x + w / 2, Math.min(z0, z0 + s * w), Math.max(z0, z0 + s * w), h, { far: true, style: Math.floor(R2(0, 5)), shop: false, y0: 0 });
      if (rng() < 0.35) { // a few giant ads far away for colour
        const a = T.ads[Math.floor(rng() * T.ads.length)];
        const aw = Math.min(w * 0.7, 26), ah = Math.min(aw / a.aspect, h * 0.5);
        if (!W.adBags[a.name]) W.adBags[a.name] = new NC.GeoBag({});
        W.adBags[a.name].quad(sx * x, h * 0.55, z0 - s * 0.4, ah * a.aspect, ah, s > 0 ? Math.PI : 0);
      }
    }
  };

  // ---------------- overhead cables + string lights ----------------
  W.cablesAndLights = function () {
    const pts = [], lights = [], lcol = [];
    const cat = (a, b, sag, n, withLights, color) => {
      let prev = a.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n, p = new V3().lerpVectors(a, b, t); p.y -= Math.sin(Math.PI * t) * sag;
        pts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
        if (withLights && i < n) { lights.push(p.x, p.y - 0.15, p.z); lcol.push(...color); }
      }
    };
    for (const b of L.blocks) {
      if (!b.inner || isSpecial(b)) continue;
      // across E-W road north of block
      for (let i = 0; i < 3; i++) {
        const x = rand(b.x0 + 6, b.x1 - 6), y1 = rand(8, 16), y2 = y1 + rand(-2, 2);
        const lit = chance(0.35), col = nc(pick([0, 1, 2, 3, 7]));
        cat(new V3(x, y1, b.z0 + L.SW), new V3(x + rand(-4, 4), y2, b.z0 - 14 + -L.SW), rand(0.8, 2.2), lit ? 14 : 6, lit, col);
      }
      for (let i = 0; i < 2; i++) {
        const z = rand(b.z0 + 6, b.z1 - 6), y1 = rand(8, 15);
        const lit = chance(0.3), col = nc(pick([0, 1, 2, 3, 7]));
        cat(new V3(b.x0 + L.SW, y1, z), new V3(b.x0 - 14 - L.SW, y1 + rand(-2, 2), z + rand(-4, 4)), rand(0.8, 2), lit ? 14 : 6, lit, col);
      }
    }
    W.cablePts = pts; W.lightPts = lights; W.lightCols = lcol;
  };

  W.extraMeshes = [];

  // ---------------- districts ----------------
  W.districtAt = function (x, z) {
    const az = Math.abs(z);
    if (Math.abs(x) > 360 || az > 400) return 'Periferia de Nox';
    if (az < 24) return 'Rio Kuro · 黒川';
    if (az < 34) return z < 0 ? 'Calçadão Norte' : 'Calçadão Sul';
    if (z < 0) return az < 110 ? 'Corpo Plaza' : 'Distrito Shinkai';
    return az < 110 ? 'Margem Sul · Kabuki' : 'Bairro Hikari';
  };

  // ---------------- build meshes ----------------
  W.finish = function (scene) {
    const add = (geo, mat, layer) => { const m = new THREE.Mesh(geo, mat); if (layer) m.layers.set(layer); scene.add(m); return m; };
    W.matBuilding = M.building(0.85);
    W.matFar = M.building(0.42);
    W.matNeon = M.neon({ intensity: 2.3 });
    W.matSign = M.neon({ map: W.atlas.tex, intensity: 1.8, fogMul: 0.6 });
    W.matGround = M.ground(0);
    add(W.bagB.build(), W.matBuilding);
    add(W.bagFar.build(), W.matFar);
    add(W.bagNeon.build(), W.matNeon);
    add(W.bagSign.build(), W.matSign);
    add(W.bagProps.build(), M.props);
    add(W.bagGloss.build(), M.propsGloss);
    const pool = add(W.bagPool.build(), M.additive(T.pool, 0xffffff, 1, { vertexColors: true }), NC.LAYER_NOREFL);
    pool.renderOrder = 2;
    // ground planes + slabs (reflective surfaces)
    const gbag = W.bagGround;
    for (const s of [1, -1]) {
      const z0 = s > 0 ? 24 : -1200, z1 = s > 0 ? 1200 : -24;
      gbag.add(G.plane, NC.mat4(0, 0, (z0 + z1) / 2, 2400, z1 - z0, 1, 0, -Math.PI / 2));
    }
    add(gbag.build(), W.matGround, NC.LAYER_SURF);
    scene.add(W.water);
    // ads
    for (const name in W.adBags) {
      const a = T.adByName(name);
      if (!a.tex) a.tex = T.tex(a.canvas, { aniso: 8 });
      add(W.adBags[name].build(), M.billboard(a.tex, { intensity: 1.45 }));
    }
    // vending fronts
    for (const k in W.vendBags) {
      const mat = new THREE.MeshBasicMaterial({ map: T.vending(k), color: new THREE.Color(1.5, 1.5, 1.5) });
      add(W.vendBags[k].build(), mat);
    }
    W.extraMeshes.forEach((m) => scene.add(m));
    // cables
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(W.cablePts, 3));
    scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x050508 })));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(W.lightPts, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(W.lightCols.map((c) => c * 2), 3));
    const lp = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.45, map: T.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(lp);
  };
})();
