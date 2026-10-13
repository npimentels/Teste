/* Nox City — hand-built places: rooftop, Hyperion Tower + Sky Lounge, Club VOLTAGE, Neomart, Tsuki Ramen,
   Praça Sakura and the bridge observation pod. */
(function () {
  'use strict';
  const NC = window.NC;
  const L = NC.L, G = NC.G, M = NC.M, T = NC.T, W = NC.World;
  const { rand, randi, pick, chance } = NC;
  const I = (NC.Interiors = {});
  const V3 = THREE.Vector3;
  const nc = W.nc, rot = W.rot, yawDir = W.yawFromDir;
  NC.npcs = [];
  const npc = (o) => NC.npcs.push(o);

  const LOCAL_COMMON = `
    uniform float uTime; uniform float uBeat;
    float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  `;
  const VS_UV = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

  // ---------------- helpers ----------------
  I.begin = function () {
    I.bagFab = new NC.GeoBag({ color: 3 });
    I.bagGlass = new NC.GeoBag({});
    I.bagRail = new NC.GeoBag({});
    I.meshes = [];
    I.doors = [];
    I.updaters = [];
  };
  const P = (...a) => W.prop(...a);
  const PG = (...a) => W.propGeo(...a);
  const N = (...a) => W.neonBox(...a);
  const F = (x, y, z, sx, sy, sz, color, ry = 0) => I.bagFab.box(x, y, z, sx, sy, sz, { color }, ry);
  // local placement helper: returns a function placing boxes relative to (ox,oy,oz) rotated by ry
  const frame = (ox, oy, oz, ry) => ({
    at: (lx, lz) => { const [a, b] = rot(lx, lz, ry); return [ox + a, oz + b]; },
    box: (lx, ly, lz, sx, sy, sz, c, gloss) => { const [a, b] = rot(lx, lz, ry); W.prop(ox + a, oy + ly, oz + b, sx, sy, sz, c, ry, gloss); },
    fab: (lx, ly, lz, sx, sy, sz, c) => { const [a, b] = rot(lx, lz, ry); F(ox + a, oy + ly, oz + b, sx, sy, sz, c, ry); },
    neon: (lx, ly, lz, sx, sy, sz, c, ph = 0) => { const [a, b] = rot(lx, lz, ry); W.neonBox(ox + a, oy + ly, oz + b, sx, sy, sz, c, ph, ry); },
    geo: (g, lx, ly, lz, sx, sy, sz, c, gloss) => { const [a, b] = rot(lx, lz, ry); W.propGeo(g, ox + a, oy + ly, oz + b, sx, sy, sz, c, ry, 0, 0, gloss); },
  });
  I.frame = frame;

  function floorPlane(x0, x1, z0, z1, y, kind, opts = {}) {
    const planar = Math.abs(y) < 0.5;
    const mat = M.ground(kind, Object.assign({ planar }, opts));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    NC.surf(m); I.meshes.push(m); return m;
  }
  function wallCol(x0, z0, x1, z1, y0, y1, th = 0.25) {
    NC.addCollider(Math.min(x0, x1) - (x0 === x1 ? th : 0), y0, Math.min(z0, z1) - (z0 === z1 ? th : 0), Math.max(x0, x1) + (x0 === x1 ? th : 0), y1, Math.max(z0, z1) + (z0 === z1 ? th : 0), 'wall');
  }
  // glass wall along a straight line (axis aligned) with mullions; gaps: [[a,b],...] along the wall
  function glassWall(x0, z0, x1, z1, y0, y1, step = 2.5, gaps = [], noCol = false) {
    const alongX = z0 === z1;
    const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
    let segs = [[Math.min(a0, a1), Math.max(a0, a1)]];
    for (const [g0, g1] of gaps) { const o = []; for (const [s, e] of segs) { if (g1 <= s || g0 >= e) o.push([s, e]); else { if (g0 > s) o.push([s, g0]); if (g1 < e) o.push([g1, e]); } } segs = o; }
    for (const [s, e] of segs) {
      const c = (s + e) / 2, w = e - s;
      if (alongX) I.bagGlass.quad(c, (y0 + y1) / 2, z0, w, y1 - y0, 0); else I.bagGlass.quad(x0, (y0 + y1) / 2, c, w, y1 - y0, Math.PI / 2);
      if (!noCol) { if (alongX) wallCol(s, z0, e, z0, y0, y1, 0.12); else wallCol(x0, s, x0, e, y0, y1, 0.12); }
      for (let p = s; p <= e + 0.01; p += Math.max(0.5, (e - s) / Math.max(1, Math.round((e - s) / step)))) {
        if (alongX) P(p, (y0 + y1) / 2, z0, 0.08, y1 - y0, 0.12, [0.05, 0.05, 0.06]); else P(x0, (y0 + y1) / 2, p, 0.12, y1 - y0, 0.08, [0.05, 0.05, 0.06]);
      }
      if (alongX) { P(c, y1 - 0.04, z0, w, 0.08, 0.14, [0.05, 0.05, 0.06]); P(c, y0 + 0.04, z0, w, 0.08, 0.14, [0.05, 0.05, 0.06]); }
      else { P(x0, y1 - 0.04, c, 0.14, 0.08, w, [0.05, 0.05, 0.06]); P(x0, y0 + 0.04, c, 0.14, 0.08, w, [0.05, 0.05, 0.06]); }
    }
  }
  I.glassWall = glassWall;
  function slidingDoor(cx, y, cz, width, height, alongX) {
    const g = new THREE.BoxGeometry(alongX ? width / 2 : 0.06, height, alongX ? 0.06 : width / 2);
    const a = new THREE.Mesh(g, M.glassDark), b = new THREE.Mesh(g, M.glassDark);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(alongX ? width + 0.2 : 0.12, 0.12, alongX ? 0.12 : width + 0.2), M.metal);
    fr.position.set(cx, y + height + 0.06, cz);
    I.meshes.push(a, b, fr);
    const d = { cx, cz, y, width, alongX, a, b, open: 0 };
    I.doors.push(d);
    return d;
  }
  function elevDoor(x, y, z, ry, color = '#5ef2ff') {
    const f = frame(x, y, z, ry);
    f.box(0, 1.25, 0.02, 2.0, 2.5, 0.08, [0.03, 0.03, 0.035]);
    f.box(-0.48, 1.12, 0.07, 0.94, 2.2, 0.04, [0.35, 0.36, 0.4], true);
    f.box(0.48, 1.12, 0.07, 0.94, 2.2, 0.04, [0.35, 0.36, 0.4], true);
    const c = nc(color);
    f.neon(0, 2.3, 0.08, 2.0, 0.05, 0.05, c);
    f.neon(-1.0, 1.15, 0.08, 0.05, 2.3, 0.05, c); f.neon(1.0, 1.15, 0.08, 0.05, 2.3, 0.05, c);
    f.neon(0, 2.55, 0.08, 0.5, 0.14, 0.04, nc('#ff6a3d'), 0.5);
    const [px, pz] = f.at(1.25, 0.1);
    P(px, y + 1.2, pz, 0.18, 0.3, 0.05, [0.08, 0.08, 0.09], ry);
    N(px + Math.sin(ry) * 0.03, y + 1.25, pz + Math.cos(ry) * 0.03, 0.06, 0.06, 0.03, nc('#7dff4a'), 0, ry);
  }
  // elevator group: floors [{label, sub, x,y,z, yaw (spawn), door:[x,y,z,ry]}]
  I.elevator = function (name, floors, color) {
    floors.forEach((fl, i) => {
      if (fl.door) elevDoor(fl.door[0], fl.door[1], fl.door[2], fl.door[3], color);
      NC.addInteract({ x: fl.x, y: fl.y + 1.1, z: fl.z, r: 2.0, label: 'Chamar elevador', kind: 'elev', use: () => NC.UI.elevator(name, floors, i) });
    });
  };
  function binoculars(x, y, z, ry) {
    const f = frame(x, y, z, ry);
    f.geo(G.cyl6, 0, 0.55, 0, 0.16, 1.1, 0.16, [0.08, 0.08, 0.09]);
    f.box(0, 1.2, 0.05, 0.42, 0.24, 0.5, [0.5, 0.42, 0.1], true);
    f.geo(G.cyl, -0.1, 1.24, 0.34, 0.14, 0.2, 0.14, [0.1, 0.1, 0.1]);
    f.geo(G.cyl, 0.1, 1.24, 0.34, 0.14, 0.2, 0.14, [0.1, 0.1, 0.1]);
    NC.colliderBox(x, y + 0.6, z, 0.4, 1.2, 0.4, 'bino');
    const yaw = yawDir(Math.sin(ry), Math.cos(ry));
    const [ix, iz] = f.at(0, -0.7);
    NC.addInteract({ x: ix, y: y + 1.2, z: iz, r: 1.5, label: 'Usar binóculo', kind: 'scope', use: () => NC.player.scope(ix, y, iz, yaw) });
  }
  I.binoculars = binoculars;
  function stool(x, y, z, yaw, h = 0.75, seat = true) {
    PG(G.cyl6, x, y + h / 2, z, 0.08, h, 0.08, [0.6, 0.62, 0.68], 0, 0, 0, true);
    PG(G.cyl, x, y + 0.03, z, 0.45, 0.04, 0.45, [0.3, 0.3, 0.32], 0, 0, 0, true);
    I.bagFab.add(G.cyl, NC.mat4(x, y + h, z, 0.42, 0.08, 0.42), { color: [0.25, 0.03, 0.06] });
    if (seat) NC.addSeat(x, y + h + 0.04, z, yaw, 'Sentar no banquinho', { r: 1.2 });
  }
  function sofa(x, y, z, ry, len, color, label = 'Sentar no sofá') {
    const f = frame(x, y, z, ry);
    f.fab(0, 0.22, 0, len, 0.44, 0.9, color.map((c) => c * 0.8));
    f.fab(0, 0.52, 0.02, len - 0.3, 0.16, 0.78, color);
    f.fab(0, 0.75, -0.38, len, 0.62, 0.22, color);
    f.fab(-len / 2 + 0.1, 0.45, 0, 0.22, 0.5, 0.9, color.map((c) => c * 0.9));
    f.fab(len / 2 - 0.1, 0.45, 0, 0.22, 0.5, 0.9, color.map((c) => c * 0.9));
    const n = Math.max(1, Math.round(len / 1.1) - 1);
    for (let i = 0; i < n; i++) {
      const lx = -len / 2 + 0.4 + (i + 0.5) * ((len - 0.8) / n);
      const [sx, sz] = f.at(lx, 0.05);
      NC.addSeat(sx, y + 0.6, sz, yawDir(Math.sin(ry), Math.cos(ry)), label, { r: 1.3 });
    }
    const ex = Math.abs(Math.cos(ry)) * len / 2 + Math.abs(Math.sin(ry)) * 0.45, ez = Math.abs(Math.sin(ry)) * len / 2 + Math.abs(Math.cos(ry)) * 0.45;
    NC.addCollider(x - ex, y, z - ez, x + ex, y + 0.58, z + ez, 'sofa');
  }
  I.sofa = sofa;
  function table(x, y, z, r = 0.45, h = 0.45, color = [0.08, 0.08, 0.09], candle) {
    PG(G.cyl, x, y + h, z, r * 2, 0.05, r * 2, color, 0, 0, 0, true);
    PG(G.cyl6, x, y + h / 2, z, 0.08, h, 0.08, [0.05, 0.05, 0.05]);
    if (candle) { N(x, y + h + 0.08, z, 0.07, 0.12, 0.07, nc(candle)); NC.addLight(x, y + h + 0.5, z, candle, 0.6, 4, 0.4); }
    NC.addCollider(x - r, y, z - r, x + r, y + h + 0.03, z + r, 'table');
  }
  function plant(x, y, z, s = 1) {
    PG(G.cyl, x, y + 0.35 * s, z, 0.7 * s, 0.7 * s, 0.7 * s, [0.12, 0.12, 0.13]);
    for (let i = 0; i < 5; i++) PG(G.ico, x + rand(-0.3, 0.3) * s, y + (0.9 + rand(0, 0.8)) * s, z + rand(-0.3, 0.3) * s, 0.8 * s, 0.9 * s, 0.8 * s, [0.03, 0.12 + rand(0, 0.08), 0.06]);
    NC.colliderBox(x, y + 0.5, z, 0.7 * s, 1, 0.7 * s, 'plant');
  }
  function terminal(x, y, z, ry, title, lines, color = '#5ef2ff') {
    const tex = T.screen(lines.slice(0, 6), color, 512, 288, title);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.4, 1.4, 1.4) }));
    const [nx, nz] = rot(0, 1, ry);
    m.position.set(x + nx * 0.07, y + 1.45, z + nz * 0.07); m.rotation.y = ry; I.meshes.push(m);
    P(x, y + 1.45, z, 1.2, 0.72, 0.1, [0.05, 0.05, 0.06], ry);
    PG(G.cyl6, x, y + 0.55, z - nz * 0.02, 0.12, 1.1, 0.12, [0.06, 0.06, 0.07]);
    NC.addInteract({ x: x + nx * 0.8, y: y + 1.2, z: z + nz * 0.8, r: 1.6, label: 'Ler ' + title, kind: 'read', use: () => NC.UI.read(title, lines) });
  }
  I.terminal = terminal;
  function lantern(x, y, z, color = '#ff5a1a', s = 1) {
    W.bagNeon.add(G.cyl, NC.mat4(x, y, z, 0.46 * s, 0.55 * s, 0.46 * s), { color: nc(color).map((c) => c * 0.75), aPhase: 2 + Math.random() * 0.5 });
    P(x, y + 0.33 * s, z, 0.3 * s, 0.08, 0.3 * s, [0.05, 0.03, 0.02]);
    P(x, y - 0.33 * s, z, 0.3 * s, 0.08, 0.3 * s, [0.05, 0.03, 0.02]);
  }
  function wordTex(text, color, w = 1024, h = 256, font = `700 170px ${T.DISP}`, sub) {
    const c = T.canvas(w, h), x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    T.neon(x, text, w / 2, sub ? h * 0.42 : h / 2, font, color, 22);
    if (sub) { x.fillStyle = '#ffffff'; x.font = `600 ${Math.floor(h * 0.14)}px ${T.DISP}`; x.fillText(sub, w / 2, h * 0.82); }
    return T.tex(c, { aniso: 8 });
  }
  function quadMesh(tex, x, y, z, w, h, ry, intensity = 1.6, opts = {}) {
    const mat = opts.holo ? M.holo(opts.color || 0x5ef2ff, { map: tex, alpha: opts.alpha || 0.9 }) : M.billboard(tex, { intensity, side: opts.side });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry; I.meshes.push(m); return m;
  }
  function addZone(z) { NC.addZone(z); }

  // ================= 1. rooftop start: Kagemori Residences =================
  function siteStart() {
    const seed = 0.4321;
    const H = 44;
    // building pieces (facade shader)
    const B = (x0, y0, z0, x1, y1, z1, style, top) => { W.bagB.aabb(x0, y0, z0, x1, y1, z1, { aB: [seed, style, top] }); NC.addCollider(x0, y0, z0, x1, y1, z1, 'bld'); };
    B(81, 4.6, 52, 113, H, 84, 1, H);
    B(81, L.CURB, 52, 91, 4.6, 84, 11, 4.6);
    B(103, L.CURB, 52, 113, 4.6, 84, 11, 4.6);
    B(91, L.CURB, 60, 103, 4.6, 84, 1, 4.6);
    // facade dressing (west + north faces)
    W.dressFacade({ ax: 81, az: 84, tx: 0, tz: -1, nx: -1, nz: 0, len: 32 }, H, 1.2);
    W.dressFacade({ ax: 103, az: 52, tx: 1, tz: 0, nx: 0, nz: -1, len: 10 }, H, 1);
    // neighbours in the same block
    const nb1 = W.addBuilding(114, 129, 52, 84, 30, { inner: true, style: 4 });
    W.dressFacade({ ax: 114, az: 52, tx: 1, tz: 0, nx: 0, nz: -1, len: 15 }, 30, 1);
    W.dressFacade({ ax: 129, az: 52, tx: 0, tz: 1, nx: 1, nz: 0, len: 32 }, 30, 1);
    W.addBuilding(81, 129, 85, 100, 74, { inner: true, style: 0 });
    W.dressFacade({ ax: 129, az: 85, tx: 0, tz: 1, nx: 1, nz: 0, len: 15 }, 74, 1);
    W.dressFacade({ ax: 129, az: 100, tx: -1, tz: 0, nx: 0, nz: 1, len: 48 }, 74, 1);
    W.ad('neo77', 129.45, 40, 92.5, 9.5, 14.25, Math.PI / 2);

    // ---- lobby ----
    glassWall(91, 52.15, 103, 52.15, L.CURB, 4.6, 2, [[95.5, 98.5]]);
    slidingDoor(97, L.CURB, 52.15, 3, 3.0, true);
    P(97, 3.9, 52.15, 3, 1.4, 0.1, [0.03, 0.03, 0.04]);
    P(91.1, 2.4, 56, 0.2, 4.5, 8, [0.14, 0.12, 0.11]);
    P(102.9, 2.4, 56, 0.2, 4.5, 8, [0.14, 0.12, 0.11]);
    P(97, 2.4, 59.9, 12, 4.5, 0.2, [0.1, 0.09, 0.09]);
    P(97, 4.52, 56, 12, 0.1, 8, [0.05, 0.05, 0.06]);
    for (const x of [93.5, 97, 100.5]) N(x, 4.45, 56, 0.12, 0.04, 6.5, [1, 0.8, 0.55]);
    floorPlane(91, 103, 52.2, 60, 0.16, 1);
    // mailboxes
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      P(91.3, 1.0 + r * 0.42, 54 + c * 0.55, 0.12, 0.38, 0.5, [0.32, 0.3, 0.26], 0, true);
      if (chance(0.3)) N(91.38, 1.12 + r * 0.42, 54.2 + c * 0.55, 0.02, 0.04, 0.04, nc('#7dff4a'));
    }
    // guard desk
    P(101.3, 0.65, 55.3, 2.4, 1.0, 2.4, [0.06, 0.06, 0.07], 0, true);
    N(100.08, 0.95, 55.3, 0.04, 0.05, 2.3, nc('#5ef2ff'));
    for (const z of [54.6, 55.6]) { P(101.6, 1.4, z, 0.05, 0.42, 0.62, [0.02, 0.02, 0.02]); N(101.56, 1.4, z, 0.02, 0.36, 0.56, [0.15, 0.4, 0.6]); }
    NC.colliderBox(101.3, 0.6, 55.3, 2.4, 1.2, 2.4, 'desk');
    npc({ x: 102.2, y: L.CURB, z: 55.3, yaw: yawDir(-1, 0), anim: 'sleep', look: 'guard', line: ['Segurança', 'Zzz… hã? Ah, morador. Pode subir. O elevador vai direto pra cobertura.'] });
    W.addBench(92.6, L.CURB, 57.8, Math.PI / 2, { color: [0.2, 0.12, 0.06] });
    plant(92, L.CURB, 53.2, 0.9);
    terminal(98.8, L.CURB, 59.75, Math.PI, 'Quadro de avisos', ['Coleta de lixo: terças, 04:00.', 'Elevador 2 em manutenção (de novo).', 'Proibido drones no terraço.', 'Achado: gato cibernético laranja.', 'Reunião de condomínio: cancelada.', 'Senha do Wi-Fi: n0x-c1ty-2077'], '#f3e600');
    NC.addLight(97, 3.8, 55.5, '#ffd2a0', 1.2, 12, 1);
    addZone({ x0: 91, x1: 103, z0: 52.2, z1: 60, y0: -1, y1: 4.6, name: 'Kagemori Residences · Lobby', indoor: true });

    // ---- rooftop ----
    floorPlane(81, 113, 52, 84, H + 0.01, 2, { wet: 1.2 });
    const pc = [0.075, 0.075, 0.085];
    P(97, H + 0.5, 52.15, 32, 1.0, 0.3, pc); NC.addCollider(81, H, 52, 113, H + 1.0, 52.3, 'wall');
    P(97, H + 0.5, 83.85, 32, 1.0, 0.3, pc); NC.addCollider(81, H, 83.7, 113, H + 1.0, 84, 'wall');
    P(81.15, H + 0.5, 68, 0.3, 1.0, 32, pc); NC.addCollider(81, H, 52, 81.3, H + 1.0, 84, 'wall');
    P(112.85, H + 0.5, 68, 0.3, 1.0, 32, pc); NC.addCollider(112.7, H, 52, 113, H + 1.0, 84, 'wall');
    // stair / elevator hut
    P(110.1, H + 1.7, 80.6, 5.2, 3.4, 6.2, [0.07, 0.07, 0.08]); NC.addCollider(107.5, H, 77.5, 112.7, H + 3.4, 83.7, 'wall');
    P(110.1, H + 3.45, 80.6, 5.6, 0.12, 6.6, [0.04, 0.04, 0.05]);
    N(107.42, H + 2.75, 80.6, 0.05, 0.25, 0.8, nc('#7dff4a'));
    N(107.42, H + 3.15, 80.6, 0.05, 0.08, 2.6, [1, 0.75, 0.45]);
    NC.addLight(106.5, H + 2.8, 80.6, '#ffc890', 1.0, 9, 1);
    I.elevator('Kagemori Residences', [
      { label: 'Cobertura', sub: 'Terraço · 44 m', x: 106.3, y: H, z: 80.6, yaw: yawDir(-1, 0), door: [107.45, H, 80.6, -Math.PI / 2] },
      { label: 'Térreo', sub: 'Lobby · saída para o rio', x: 97, y: L.CURB, z: 58.6, yaw: yawDir(0, -1), door: [97, L.CURB, 59.78, Math.PI] },
    ]);
    // water tank
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) P(88 + dx, H + 1.6, 77 + dz, 0.15, 3.2, 0.15, [0.12, 0.08, 0.06]);
    PG(G.cyl, 88, H + 4.6, 77, 3.6, 2.8, 3.6, [0.16, 0.11, 0.08]);
    PG(G.cone, 88, H + 6.5, 77, 3.8, 1.0, 3.8, [0.12, 0.08, 0.06]);
    NC.addCollider(86.2, H, 75.2, 89.8, H + 6.5, 78.8, 'tank');
    // AC units & vents
    for (const [x, z] of [[101, 70], [105, 66], [96, 79]]) {
      P(x, H + 0.55, z, 2.2, 1.1, 1.6, [0.2, 0.21, 0.22]);
      PG(G.cyl, x, H + 1.12, z, 1.2, 0.05, 1.2, [0.04, 0.04, 0.04]);
      NC.colliderBox(x, H + 0.55, z, 2.2, 1.1, 1.6, 'ac');
      NC.addSteam(x, H + 1.2, z, 0.25, 0.6);
    }
    P(110, H + 0.4, 60, 0.6, 0.8, 8, [0.15, 0.15, 0.16]); // pipe run
    // satellite dish
    PG(G.cyl6, 85, H + 0.9, 81, 0.1, 1.8, 0.1, [0.1, 0.1, 0.1]);
    PG(G.sphere, 85, H + 2.1, 81, 1.6, 1.6, 0.4, [0.5, 0.5, 0.52], 0.6, 0.4);
    // couch, table, radio, chairs
    sofa(94, H, 58.5, Math.PI + 0.35, 2.2, [0.22, 0.05, 0.06], 'Sentar no sofá velho');
    table(94.7, H, 56.6, 0.4, 0.5, [0.1, 0.08, 0.06]);
    N(94.5, H + 0.6, 56.5, 0.07, 0.12, 0.07, nc('#ff2bd6')); N(94.85, H + 0.6, 56.75, 0.07, 0.12, 0.07, nc('#5ef2ff'));
    P(94.9, H + 0.62, 56.4, 0.32, 0.18, 0.12, [0.15, 0.13, 0.1]);
    N(94.9, H + 0.64, 56.33, 0.16, 0.05, 0.02, nc('#ffb24a'));
    NC.addInteract({ x: 94.9, y: H + 0.7, z: 56.4, r: 1.6, label: 'Ligar/desligar o rádio', kind: 'radio', use: () => NC.Audio && NC.Audio.toggleRadio(94.9, H + 0.7, 56.4) });
    // ledge seat (the reference shot)
    I.startSeat = NC.addSeat(100.75, H + 1.02, 52.2, Math.PI / 2 - 0.36, 'Sentar na beirada', { standX: 100.75, standY: H, standZ: 53.4, ledge: true });
    binoculars(89, H, 52.9, Math.PI);
    W.addVending(105.2, H, 82.9, Math.PI, 'zenkai');
    // ronin oni sign on a steel frame at the west edge, angled toward the ledge
    const ry = Math.atan2(0.92, -0.4);
    const sx = 82.6, sz = 61.5;
    const a = T.adByName('oni');
    a.tex = a.tex || T.tex(a.canvas, { aniso: 8 });
    const s = quadMesh(a.tex, sx, H + 6.2, sz, 6.4, 8, ry, 2.2);
    const [nx, nz] = rot(0, 1, ry), [tx, tz] = rot(1, 0, ry);
    for (const sgn of [-1, 1]) P(sx + tx * sgn * 3.3 - nx * 0.15, H + 5, sz + tz * sgn * 3.3 - nz * 0.15, 0.25, 10, 0.25, [0.1, 0.1, 0.11]);
    P(sx - nx * 0.25, H + 6.2, sz - nz * 0.25, 6.8, 8.4, 0.2, [0.03, 0.02, 0.02], ry);
    NC.colliderBox(sx, H + 5, sz, 3, 10, 3, 'sign');
    W.pool(sx + nx * 3, H + 0.04, sz + nz * 3, 5, nc('#ff2030'), 0.35);
    NC.addLight(sx + nx * 2.5, H + 4, sz + nz * 2.5, '#ff2030', 2.0, 18, 1);
    // string lights from hut to tank
    const pts = []; const cols = [];
    const a0 = new V3(107.5, H + 3.3, 78), a1 = new V3(89.5, H + 5.8, 77);
    for (let i = 1; i < 18; i++) { const t = i / 18, p = new V3().lerpVectors(a0, a1, t); p.y -= Math.sin(Math.PI * t) * 1.3; W.lightPts.push(p.x, p.y, p.z); W.lightCols.push(...nc(pick([2, 3, 7, 0]))); }
    const b0 = new V3(107.5, H + 3.3, 78.5), b1 = new V3(94, H + 2.6, 52.3);
    for (let i = 1; i < 22; i++) { const t = i / 22, p = new V3().lerpVectors(b0, b1, t); p.y -= Math.sin(Math.PI * t) * 1.1; W.lightPts.push(p.x, p.y, p.z); W.lightCols.push(...nc(pick([2, 3, 7, 1]))); }
    NC.addLight(97, H + 3, 66, '#ffb070', 0.8, 16, 1);
    addZone({ x0: 81, x1: 113, z0: 52, z1: 84, y0: H - 1, y1: H + 20, name: 'Terraço · Kagemori Residences', indoor: false });
    NC.addPOI({ id: 'start', name: 'Terraço', desc: 'Onde tudo começa. Vista do rio e das pontes.', x: 100, y: H, z: 53.6, yaw: Math.PI / 2 - 0.16, tag: 'MIRANTE' });
  }

  // ================= 2. Hyperion Tower — lobby + Sky Lounge =================
  function siteHyperion() {
    const seed = 0.777, TOP = 226;
    const B = (x0, y0, z0, x1, y1, z1, style, top) => { W.bagB.aabb(x0, y0, z0, x1, y1, z1, { aB: [seed, style, top] }); NC.addCollider(x0, y0, z0, x1, y1, z1, 'bld'); };
    B(15, 12, -96, 55, TOP, -56, 2, TOP);
    const stone = [0.16, 0.15, 0.14];
    P(15.5, 6.07, -76, 1, 11.85, 40, stone); NC.addCollider(15, 0, -96, 16, 12, -56, 'wall');
    P(54.5, 6.07, -76, 1, 11.85, 40, stone); NC.addCollider(54, 0, -96, 55, 12, -56, 'wall');
    P(35, 6.07, -95.5, 38, 11.85, 1, stone); NC.addCollider(15, 0, -96, 55, 12, -95, 'wall');
    glassWall(16, -56.2, 54, -56.2, L.CURB, 12, 2.5, [[33, 37]]);
    I.bagGlass.quad(35, 8, -56.2, 4, 8, 0); P(35, 4.05, -56.2, 4, 0.12, 0.16, [0.05, 0.05, 0.06]);
    slidingDoor(35, L.CURB, -56.2, 4, 3.8, true);
    // canopy
    P(35, 4.75, -54.4, 10, 0.3, 3.6, [0.05, 0.05, 0.06]);
    N(35, 4.58, -52.65, 10, 0.05, 0.05, nc('#5ef2ff'));
    for (let x = 31; x <= 39; x += 2) W.pool(x, L.CURB + 0.02, -54.4, 1.4, [0.8, 0.95, 1], 0.4);
    const hyperionTex = wordTex('HYPERION', '#ffffff', 1024, 256, `700 170px ${T.DISP}`);
    quadMesh(hyperionTex, 35, 5.15, -52.58, 6, 1.5, 0, 1.8);
    // interior
    floorPlane(16, 54, -95, -56.3, 0.16, 1);
    P(35, 11.93, -75.6, 38, 0.1, 39, [0.04, 0.04, 0.05]);
    for (let z = -92; z <= -60; z += 4) N(35, 11.85, z, 34, 0.05, 0.18, [0.5, 0.53, 0.58]);
    // reception desk (arc)
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.32, cx = 35 + Math.sin(a) * 4.2, cz = -74 + Math.cos(a) * 4.2 - 4.2;
      P(cx, 0.7, cz + 4.2, 1.45, 1.1, 0.7, [0.85, 0.86, 0.88], -a, true);
      N(cx + Math.sin(a) * 0.37, 0.35, cz + 4.2 + Math.cos(a) * 0.37, 1.45, 0.04, 0.04, nc('#5ef2ff'), 0, -a);
    }
    NC.addCollider(31, 0, -75.5, 39, 1.25, -72.5, 'desk');
    npc({ x: 35, y: L.CURB, z: -74.6, yaw: yawDir(0, 1), anim: 'idle', look: 'corp', line: ['Recepção', 'Bem-vindo à Hyperion. O Sky Lounge fica no 62º andar: elevadores à direita.'] });
    NC.addInteract({ x: 35, y: 1.2, z: -71.2, r: 2.2, label: 'Falar com a recepção', kind: 'talk', use: () => NC.UI.say('Recepção', pick(['Bem-vindo à Hyperion. O Sky Lounge fica no 62º andar: elevadores à direita.', 'Visitantes sem implante corporativo: apenas Lobby e Sky Lounge, por favor.', 'Um amanhã melhor começa hoje. Aproveite a vista lá de cima.'])) });
    // hologram logo above desk
    const holo = new THREE.Group(); holo.position.set(35, 6.6, -74);
    const ringM = M.holo(0x5ef2ff, { color2: 0xff2bd6, alpha: 0.7 });
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.5, 0.03, 6, 64), ringM); r.rotation.x = Math.PI / 2 + i * 0.4; holo.add(r); }
    const logoC = T.canvas(256, 256), lx = logoC.getContext('2d');
    lx.strokeStyle = '#fff'; lx.lineWidth = 10; lx.shadowColor = '#5ef2ff'; lx.shadowBlur = 20;
    lx.beginPath(); lx.arc(128, 128, 90, 0, 7); lx.stroke(); lx.beginPath(); lx.moveTo(128, 38); lx.lineTo(128, 218); lx.moveTo(50, 83); lx.lineTo(206, 173); lx.moveTo(206, 83); lx.lineTo(50, 173); lx.stroke();
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), M.holo(0x5ef2ff, { map: T.tex(logoC), alpha: 1 }));
    holo.add(logo); I.meshes.push(holo);
    I.updaters.push((t) => { holo.rotation.y = t * 0.4; holo.children.forEach((c, i) => { if (i < 3) c.rotation.z = t * (0.3 + i * 0.2); }); });
    NC.addLight(35, 6, -74, '#5ef2ff', 1.6, 14, 1);
    // LED wall
    const ledC = T.canvas(1024, 340), lc = ledC.getContext('2d');
    lc.textAlign = 'center'; lc.textBaseline = 'middle';
    T.neon(lc, 'HYPERION', 512, 140, `700 150px ${T.DISP}`, '#ffffff', 20);
    lc.fillStyle = '#ffffff'; lc.font = `600 46px ${T.DISP}`; lc.fillText('BETTER TOMORROW · 夜明けを、あなたに', 512, 260);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.ShaderMaterial({
      uniforms: { uTime: NC.U.time, uBeat: NC.U.beat, map: { value: T.tex(ledC) } },
      vertexShader: VS_UV,
      fragmentShader: LOCAL_COMMON + `uniform sampler2D map; varying vec2 vUv;
        void main(){ vec2 uv=vUv; float t=uTime*.25;
          float v = sin(uv.x*7.+t*2.)+sin(uv.y*5.-t*1.6)+sin((uv.x+uv.y)*4.+t*2.4)+sin(length(uv-vec2(.5+.3*sin(t),.5))*12.-t*3.);
          vec3 c = .5+.5*cos(v*.8 + vec3(0.,2.1,4.2) + t);
          c = mix(vec3(.04,.0,.1), c*vec3(1.,.45,1.), .7);
          vec2 g = fract(uv*vec2(300.,100.)); c *= .75+.25*step(.3,g.x)*step(.3,g.y);
          vec4 tx = texture2D(map, uv); c = mix(c, vec3(1.), tx.a*.9);
          gl_FragColor = vec4(c*1.25,1.); }`,
    }));
    led.position.set(35, 6.2, -94.9); I.meshes.push(led);
    NC.addLight(35, 5, -90, '#c060ff', 1.6, 18, 1);
    // columns
    for (const [x, z] of [[24, -66], [46, -66], [24, -86], [46, -86]]) {
      PG(G.cyl, x, 6.0, z, 1.6, 11.8, 1.6, [0.1, 0.095, 0.09], 0, 0, 0, true);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; N(x + Math.cos(a) * 0.8, 6, z + Math.sin(a) * 0.8, 0.06, 11, 0.06, nc('#ffffff').map((c) => c * 0.7)); }
      NC.colliderBox(x, 6, z, 1.6, 12, 1.6, 'col');
    }
    // lounge seating + plants
    sofa(19.2, L.CURB, -63, Math.PI / 2, 3.2, [0.08, 0.08, 0.1]);
    sofa(19.2, L.CURB, -69, Math.PI / 2, 3.2, [0.08, 0.08, 0.1]);
    table(21.4, L.CURB, -66, 0.6, 0.4, [0.8, 0.8, 0.82], '#ffb070');
    plant(18, L.CURB, -58.5, 1.4); plant(52, L.CURB, -58.5, 1.4); plant(18.5, L.CURB, -92.5, 1.6); plant(51.5, L.CURB, -92.5, 1.6);
    // turnstiles
    for (let x = 29; x <= 41; x += 3) { P(x, 0.65, -80, 0.3, 1.0, 1.2, [0.7, 0.72, 0.76], 0, true); N(x, 1.17, -80, 0.24, 0.03, 1.0, nc('#7dff4a')); NC.colliderBox(x, 0.6, -80, 0.3, 1.2, 1.2, 'gate'); }
    terminal(48, L.CURB, -58.4, Math.PI, 'Diretório Hyperion', ['62º  Sky Lounge · bar e mirante', '40º–61º  Diretoria (restrito)', '12º–39º  Pesquisa & Desenvolvimento', 'Lobby  Recepção · Café · Galeria', '', 'Um amanhã melhor começa hoje.'], '#5ef2ff');
    // elevators (east wall)
    const floors = [
      { label: 'Lobby', sub: 'Térreo · saída para o calçadão', x: 52.4, y: L.CURB, z: -76, yaw: yawDir(-1, 0), door: [53.95, L.CURB, -76, -Math.PI / 2] },
      { label: 'Sky Lounge', sub: '62º andar · 226 m', x: 21.2, y: TOP, z: -87.3, yaw: yawDir(0, 1), door: [21.2, TOP, -88.7, 0] },
    ];
    I.elevator('Hyperion Tower', floors, '#ff2bd6');
    elevDoor(53.95, L.CURB, -70, -Math.PI / 2, '#ff2bd6'); elevDoor(53.95, L.CURB, -82, -Math.PI / 2, '#ff2bd6');
    NC.addInteract({ x: 52.4, y: 1.2, z: -70, r: 1.8, label: 'Chamar elevador', kind: 'elev', use: () => NC.UI.elevator('Hyperion Tower', floors, 0) });
    NC.addInteract({ x: 52.4, y: 1.2, z: -82, r: 1.8, label: 'Chamar elevador', kind: 'elev', use: () => NC.UI.elevator('Hyperion Tower', floors, 0) });
    for (const z of [-62, -76, -90]) NC.addLight(30, 9, z, '#f0f4ff', 1.3, 16, 1);
    NC.addLight(18.5, 6, -76, '#ffcf9a', 1.2, 14, 0.8); NC.addLight(51.5, 6, -76, '#ffcf9a', 1.2, 14, 0.8);
    addZone({ x0: 16, x1: 54, z0: -95, z1: -56.3, y0: -1, y1: 12, name: 'Hyperion Tower · Lobby', indoor: true });
    // forecourt
    for (const x of [22, 48]) { PG(G.cyl, x, L.CURB + 0.45, -53.6, 2.4, 0.9, 2.4, [0.1, 0.1, 0.11]); PG(G.ico, x, L.CURB + 1.6, -53.6, 2, 1.6, 2, [0.04, 0.14, 0.07]); N(x, L.CURB + 0.92, -53.6, 2.45, 0.04, 2.45, nc('#5ef2ff').map((c) => c * 0.5)); NC.colliderBox(x, 0.5, -53.6, 2.4, 1, 2.4, 'plant'); }
    W.addBench(27, L.CURB, -52.8, 0); W.addBench(43, L.CURB, -52.8, 0);
    // giant portrait billboard on south face + crown wordmarks
    const ad = T.adByName('hyperion'); ad.tex = ad.tex || T.tex(ad.canvas, { aniso: 8 });
    quadMesh(ad.tex, 35, 118, -55.55, 30, 75, 0, 1.55);
    for (const [fx, fz, r] of [[35, -55.6, 0], [35, -96.4, Math.PI], [14.6, -76, -Math.PI / 2], [55.4, -76, Math.PI / 2]]) quadMesh(hyperionTex, fx, 212, fz, 30, 7.5, r, 2.2);
    W.neonBox(35, 160, -55.7, 0.3, 0.3, 0.3, nc('#ffffff'));

    // ---------- Sky Lounge ----------
    const Y = TOP;
    floorPlane(15, 55, -96, -56, Y + 0.005, 2);
    floorPlane(19, 51, -92, -66, Y + 0.02, 3, { amb: 1.6 });
    glassWall(19, -92, 51, -92, Y, Y + 6.4, 3.2);
    glassWall(19, -66, 51, -66, Y, Y + 6.4, 3.2, [[33, 37]]);
    glassWall(19, -92, 19, -66, Y, Y + 6.4, 3.2);
    glassWall(51, -92, 51, -66, Y, Y + 6.4, 3.2);
    P(35, Y + 6.8, -79, 32.8, 0.8, 26.8, [0.04, 0.04, 0.05]);
    NC.addCollider(18.6, Y + 6.4, -92.4, 51.4, Y + 7.2, -65.6, 'roof');
    for (const [z, c] of [[-65.6, '#ff2bd6'], [-92.4, '#5ef2ff']]) N(35, Y + 7.22, z, 32.8, 0.08, 0.08, nc(c));
    N(18.6, Y + 7.22, -79, 0.08, 0.08, 26.8, nc('#5ef2ff')); N(51.4, Y + 7.22, -79, 0.08, 0.08, 26.8, nc('#ff2bd6'));
    for (let z = -89; z <= -69; z += 4) N(35, Y + 6.38, z, 28, 0.04, 0.1, [1, 0.75, 0.45].map((c) => c * 0.8));
    // spire
    P(35, Y + 40, -79, 1.2, 66, 1.2, [0.07, 0.07, 0.08]);
    N(35, Y + 73.5, -79, 1.0, 1.0, 1.0, nc('#ff2030'), -0.3);
    for (let y = Y + 15; y < Y + 70; y += 9) N(35, y, -79, 1.3, 0.12, 1.3, nc('#ff2bd6'), 3 + (y - Y) / 60);
    // perimeter railings (glass + rail + neon)
    const railY = Y;
    const rails = [[15.2, -95.8, 54.8, -95.8], [15.2, -56.2, 54.8, -56.2], [15.2, -95.8, 15.2, -56.2], [54.8, -95.8, 54.8, -56.2]];
    for (const [ax, az, bx, bz] of rails) {
      const alongX = az === bz;
      if (alongX) { I.bagRail.quad((ax + bx) / 2, railY + 0.6, az, bx - ax, 1.1, 0); P((ax + bx) / 2, railY + 1.18, az, bx - ax, 0.06, 0.1, [0.6, 0.62, 0.68], 0, true); N((ax + bx) / 2, railY + 0.05, az, bx - ax, 0.05, 0.05, nc('#5ef2ff').map((c) => c * 0.6)); }
      else { I.bagRail.quad(ax, railY + 0.6, (az + bz) / 2, bz - az, 1.1, Math.PI / 2); P(ax, railY + 1.18, (az + bz) / 2, 0.1, 0.06, bz - az, [0.6, 0.62, 0.68], 0, true); N(ax, railY + 0.05, (az + bz) / 2, 0.05, 0.05, bz - az, nc('#5ef2ff').map((c) => c * 0.6)); }
      wallCol(ax, az, bx, bz, railY, railY + 1.25, 0.15);
    }
    // bar
    P(35, Y + 0.55, -85.9, 18, 1.1, 1.3, [0.04, 0.035, 0.03], 0, true);
    P(35, Y + 1.12, -85.9, 18.4, 0.05, 1.5, [0.75, 0.7, 0.6], 0, true);
    N(35, Y + 0.95, -85.22, 18, 0.04, 0.04, nc('#ffb24a'));
    NC.addCollider(26, Y, -86.6, 44, Y + 1.15, -85.2, 'bar');
    P(35, Y + 1.8, -91.3, 18, 3.6, 0.5, [0.03, 0.03, 0.035]);
    for (let r = 0; r < 4; r++) {
      P(35, Y + 0.7 + r * 0.75, -91.0, 17.6, 0.04, 0.4, [0.6, 0.55, 0.45], 0, true);
      N(35, Y + 0.68 + r * 0.75, -91.18, 17.6, 0.03, 0.03, [1, 0.7, 0.35]);
      for (let x = 26.6; x < 43.6; x += rand(0.22, 0.4)) N(x, Y + 0.88 + r * 0.75, -90.95, 0.09, rand(0.22, 0.34), 0.09, nc(pick(['#ffb24a', '#ff6a3d', '#7dff4a', '#5ef2ff', '#ffffff', '#ff2bd6'])).map((c) => c * 0.55));
    }
    npc({ x: 35, y: Y, z: -88.2, yaw: yawDir(0, 1), anim: 'bartend', look: 'bartender' });
    for (let x = 27.5; x <= 42.6; x += 3) stool(x, Y, -84.4, 0, 0.78);
    const loungeDrinks = [
      { name: 'Old Fashioned sintético', price: 25, desc: 'Bourbon de laboratório, casca de laranja de verdade.', fx: 'drunk' },
      { name: 'Nox Martini', price: 30, desc: 'Gin cinza com uma pérola de néon.', fx: 'drunk' },
      { name: 'Chá de jasmim gelado', price: 8, desc: 'Para quem quer só a vista.', fx: 'calm' },
    ];
    NC.addInteract({ x: 35, y: Y + 1.2, z: -84.2, r: 3.5, label: 'Pedir no bar do Sky Lounge', kind: 'shop', use: () => NC.UI.shop('Bar do Sky Lounge', loungeDrinks) });
    // sofas facing the glass
    for (const z of [-84, -77, -70]) {
      sofa(21.0, Y, z, -Math.PI / 2, 3.0, [0.32, 0.22, 0.12]);
      table(19.9, Y, z, 0.35, 0.42, [0.05, 0.05, 0.05], '#ffb070');
      sofa(49.0, Y, z, Math.PI / 2, 3.0, [0.32, 0.22, 0.12]);
      table(50.1, Y, z, 0.35, 0.42, [0.05, 0.05, 0.05], '#ffb070');
    }
    // piano
    const pf = frame(41, Y, -73, 0.5);
    pf.box(0, 0.72, 0, 1.6, 0.35, 2.1, [0.02, 0.02, 0.02], true);
    pf.box(0, 0.98, -0.2, 1.55, 0.06, 1.6, [0.02, 0.02, 0.02], true);
    pf.box(0.2, 1.4, -0.25, 1.4, 0.04, 1.4, [0.02, 0.02, 0.02], true);
    pf.box(0, 0.91, 0.95, 1.5, 0.05, 0.22, [0.9, 0.9, 0.88]);
    for (const [lx, lz] of [[-0.7, -0.9], [0.7, -0.9], [0, 0.8]]) pf.box(lx, 0.28, lz, 0.1, 0.56, 0.1, [0.02, 0.02, 0.02]);
    NC.colliderBox(41, Y + 0.5, -73, 2.2, 1, 2.4, 'piano');
    const [pix, piz] = pf.at(0, 1.6);
    NC.addInteract({ x: pix, y: Y + 1, z: piz, r: 1.6, label: 'Tocar o piano', kind: 'piano', use: () => { NC.Audio && NC.Audio.piano(); NC.UI.toast('Você toca alguns acordes. O bartender acena com a cabeça.'); } });
    plant(23.5, Y, -68, 1.2); plant(46.5, Y, -68, 1.2);
    P(21.2, Y + 3.2, -90.25, 4, 6.4, 3, [0.08, 0.075, 0.07]);
    NC.addCollider(19.2, Y, -91.8, 23.2, Y + 6.4, -88.7, 'core');
    for (const [x, z, c] of [[35, -86, '#ffb070'], [26, -78, '#ffc890'], [44, -78, '#ffc890'], [35, -70, '#ff9a60']]) NC.addLight(x, Y + 4.5, z, c, 1.2, 12, 1);
    addZone({ x0: 19, x1: 51, z0: -92, z1: -66, y0: Y - 1, y1: Y + 7, name: 'Sky Lounge · 230 m', indoor: true, music: 'lounge' });
    addZone({ x0: 15, x1: 55, z0: -96, z1: -56, y0: Y - 1, y1: Y + 30, name: 'Deck · Hyperion Tower', indoor: false, high: true });
    // deck: loungers, binoculars, parked AV, vending
    for (const x of [20.5, 25.5]) W.addBench(x, Y, -58.8, 0, { color: [0.3, 0.2, 0.12], label: 'Deitar na espreguiçadeira' });
    binoculars(31, Y, -57.0, 0); binoculars(39, Y, -57.0, 0);
    binoculars(17.2, Y, -79, -Math.PI / 2); binoculars(52.8, Y, -79, Math.PI / 2);
    W.addVending(53.6, Y, -64, -Math.PI / 2, 'blue');
    I.parkedAV = { x: 47, y: Y, z: -61.2, ry: 0.15 };
    NC.addLight(35, Y + 3, -60, '#9fd8ff', 1.0, 18, 1);
    NC.addPOI({ id: 'lounge', name: 'Sky Lounge', desc: 'O bar a 230 m de altura. Vista de 360° de Nox City.', x: 35, y: Y, z: -68.5, yaw: yawDir(0, 1), tag: 'MIRANTE' });
    NC.addPOI({ id: 'deck', name: 'Deck da Hyperion', desc: 'Ao ar livre no topo da torre, com binóculos.', x: 35, y: Y, z: -59, yaw: yawDir(0, 1), tag: 'MIRANTE' });
    NC.addPOI({ id: 'hyperion', name: 'Hyperion Tower', desc: 'Lobby de mármore negro, holograma e elevadores.', x: 35, y: L.CURB, z: -52, yaw: yawDir(0, -1), tag: 'INTERIOR' });
  }

  // ================= 3. Club VOLTAGE =================
  function siteClub() {
    const seed = 0.31;
    W.bagB.aabb(13, 9.6, 56, 57, 26, 98, { aB: [seed, 4, 26] }); NC.addCollider(13, 9.6, 56, 57, 26, 98, 'bld');
    const wc = [0.045, 0.04, 0.055];
    const Wb = (x0, y0, z0, x1, y1, z1) => { W.bagProps.aabb(x0, y0, z0, x1, y1, z1, { color: wc }); NC.addCollider(x0, y0, z0, x1, y1, z1, 'wall'); };
    Wb(13, 0.15, 56, 33, 9.6, 58); Wb(37, 0.15, 56, 57, 9.6, 58); Wb(33, 3.4, 56, 37, 9.6, 58);
    Wb(13, 0.15, 96, 57, 9.6, 98); Wb(13, 0.15, 58, 15, 9.6, 96); Wb(55, 0.15, 58, 57, 9.6, 96);
    // exterior signage
    const vol = T.adByName('voltage'); vol.tex = vol.tex || T.tex(vol.canvas, { aniso: 8 });
    quadMesh(vol.tex, 35, 14, 55.5, 15, 10, Math.PI, 1.9);
    const pink = nc('#ff2bd6'), cyan = nc('#5ef2ff');
    for (let i = 0; i < 14; i++) {
      const t = i / 13, a = Math.PI * t;
      N(35 - Math.cos(a) * 2.6, 3.2 + Math.sin(a) * 1.0, 55.85, 0.22, 0.22, 0.1, i % 2 ? pink : cyan, 3 + t);
    }
    for (const sx of [-1, 1]) for (let y = 0.6; y < 3.2; y += 0.45) N(35 + sx * 2.6, y, 55.85, 0.22, 0.22, 0.1, pink, 3 + y / 4);
    W.pool(35, L.CURB + 0.02, 53.5, 5, pink, 0.5);
    NC.addLight(35, 3, 53.5, '#ff2bd6', 2, 14, 1);
    for (let i = 0; i < 6; i++) {
      const x = 24 + i * 1.6;
      PG(G.cyl6, x, L.CURB + 0.5, 53.6, 0.08, 1, 0.08, [0.75, 0.75, 0.8], 0, 0, 0, true);
      if (i < 5) P(x + 0.8, L.CURB + 0.85, 53.6, 1.55, 0.06, 0.06, [0.5, 0.02, 0.05]);
    }
    NC.addCollider(23.5, 0, 53.4, 32.5, 1.0, 53.8, 'rope');
    npc({ x: 38.3, y: L.CURB, z: 55.0, yaw: yawDir(0, -1), anim: 'idle', look: 'bouncer', scale: 1.15, line: ['Segurança', 'Você está na lista. Tá, tô brincando, não tem lista. Entra.'] });
    NC.addInteract({ x: 38.3, y: 1.4, z: 54, r: 1.8, label: 'Falar com o segurança', kind: 'talk', use: () => NC.UI.say('Segurança', pick(['Você está na lista. Tá, tô brincando, não tem lista. Entra.', 'Sem armas, sem drones, sem drama.', 'A DJ hoje é a Kaori Static. Vale a pena.'])) });
    for (const [x, z] of [[31, 53.0], [29.2, 53.1], [27.3, 52.95], [25.4, 53.1]]) npc({ x, y: L.CURB, z, yaw: yawDir(1, 0.1), anim: chance(0.5) ? 'phone' : 'idle' });

    // interior
    floorPlane(15, 55, 58, 96, 0.16, 4);
    // dance floor (LED)
    const df = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShaderMaterial({
      uniforms: { uTime: NC.U.time, uBeat: NC.U.beat },
      vertexShader: VS_UV,
      fragmentShader: LOCAL_COMMON + `varying vec2 vUv;
        void main(){ vec2 g=vUv*12.; vec2 id=floor(g), f=fract(g);
          float tile = smoothstep(.04,.09,f.x)*smoothstep(.04,.09,f.y)*smoothstep(.04,.09,1.-f.x)*smoothstep(.04,.09,1.-f.y);
          float t=uTime; float pat=floor(mod(t/8.,4.)); vec2 c=id-5.5; float v;
          if(pat<1.) v=step(.5, fract((length(c)-t*2.)/4.));
          else if(pat<2.) v=step(.62, h12(id+floor(t*2.)));
          else if(pat<3.) v=step(.5, fract((id.x+id.y)/6.-t*.5));
          else { float r=abs(c.x)+abs(c.y), m=mod(t*4.,12.); v=step(r,m)*step(m-2.5,r); }
          vec3 col=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+id.x*.04+id.y*.02+t*.08));
          vec3 o = col*v*(.5+1.3*uBeat)*tile + vec3(.015)*tile;
          gl_FragColor=vec4(o*1.7,1.); }`,
    }));
    df.rotation.x = -Math.PI / 2; df.position.set(35, 0.175, 79); NC.noRefl(df); I.meshes.push(df);
    N(35, 0.18, 70.95, 16.1, 0.04, 0.08, cyan); N(35, 0.18, 87.05, 16.1, 0.04, 0.08, cyan);
    N(26.95, 0.18, 79, 0.08, 0.04, 16.1, cyan); N(43.05, 0.18, 79, 0.08, 0.04, 16.1, cyan);
    // stage, DJ, LED wall, speakers
    P(35, 0.6, 92.4, 20, 0.9, 7, [0.03, 0.03, 0.035], 0, true); NC.addCollider(25, 0, 88.9, 45, 1.05, 95.9, 'stage');
    N(35, 1.06, 88.92, 20, 0.05, 0.05, pink);
    P(35, 0.38, 88.5, 6, 0.45, 0.9, [0.05, 0.05, 0.06]); NC.addCollider(32, 0, 88.05, 38, 0.6, 88.95, 'step');
    P(35, 1.6, 91.1, 8, 1.1, 1.2, [0.02, 0.02, 0.025], 0, true); NC.addCollider(31, 1.05, 90.5, 39, 2.15, 91.7, 'desk');
    N(35, 1.6, 90.48, 7.8, 0.6, 0.03, [0.6, 0.1, 0.5], 2.5);
    for (const x of [33, 37]) PG(G.cyl, x, 2.18, 91.1, 0.6, 0.05, 0.6, [0.15, 0.15, 0.16]);
    npc({ x: 35, y: 1.05, z: 92.4, yaw: yawDir(0, -1), anim: 'dj', look: 'dj' });
    const ledC = T.canvas(1024, 256), lc = ledC.getContext('2d');
    lc.textAlign = 'center'; lc.textBaseline = 'middle';
    T.neon(lc, 'KAORI STATIC', 512, 128, `700 130px ${T.DISP}`, '#ffffff', 16);
    const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(36, 7.6), new THREE.ShaderMaterial({
      uniforms: { uTime: NC.U.time, uBeat: NC.U.beat, map: { value: T.tex(ledC) } },
      vertexShader: VS_UV,
      fragmentShader: LOCAL_COMMON + `uniform sampler2D map; varying vec2 vUv;
        void main(){ vec2 uv=vUv; float bars=48.; float bx=floor(uv.x*bars);
          float a=h12(vec2(bx,floor(uTime*6.))), b=h12(vec2(bx,floor(uTime*6.)+1.));
          float hgt=.12+.7*mix(a,b,fract(uTime*6.))*(.45+.8*uBeat)*(1.-abs(uv.x-.5));
          float bar=step(uv.y,hgt)*step(.18,fract(uv.x*bars))*step(.2,fract(uv.y*30.));
          vec3 c=mix(vec3(1.,.1,.75), vec3(.15,.9,1.), uv.y*1.3)*bar;
          float wave=smoothstep(.02,.0,abs(uv.y-.75-.08*sin(uv.x*20.+uTime*4.)*(.3+uBeat)));
          c+=vec3(1.,.9,.3)*wave;
          vec4 tx=texture2D(map, vec2(uv.x, (uv.y-.5)/.5)); float m = step(.5,uv.y)*tx.a;
          c=mix(c, vec3(1.)*(1.+uBeat), m*.85);
          gl_FragColor=vec4(c*1.5,1.); }`,
    }));
    ledWall.position.set(35, 5.0, 95.85); ledWall.rotation.y = Math.PI; I.meshes.push(ledWall);
    for (const x of [22.5, 47.5]) {
      P(x, 2.2, 93.6, 2.2, 4, 2, [0.02, 0.02, 0.025]); NC.colliderBox(x, 2, 93.6, 2.2, 4, 2, 'spk');
      for (const y of [1.0, 2.2, 3.4]) PG(G.cyl, x, y, 92.58, 0.9, 0.06, 0.9, [0.06, 0.06, 0.07], 0, Math.PI / 2);
    }
    // truss + mirror ball + lasers
    for (const z of [72, 79, 86]) P(35, 8.6, z, 22, 0.35, 0.35, [0.08, 0.08, 0.09]);
    for (const x of [26, 44]) P(x, 8.6, 79, 0.35, 0.35, 16, [0.08, 0.08, 0.09]);
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 2), M.chrome);
    ball.position.set(35, 7.4, 79); I.meshes.push(ball);
    const lasers = new THREE.Group();
    const lg = new THREE.CylinderGeometry(0.015, 0.16, 26, 6, 1, true); lg.translate(0, -13, 0);
    const lcol = ['#7dff4a', '#5ef2ff', '#ff2bd6', '#7dff4a', '#ff2bd6', '#5ef2ff', '#f3e600', '#9d6bff'];
    const lpos = [[26, 72], [44, 72], [26, 86], [44, 86], [30, 72], [40, 86], [30, 86], [40, 72]];
    const lmeshes = lpos.map(([x, z], i) => { const m = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(lcol[i]).multiplyScalar(1.6), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, 8.4, z); lasers.add(m); return m; });
    I.meshes.push(lasers);
    const beams = new THREE.Group(); beams.position.copy(ball.position);
    const bg = new THREE.CylinderGeometry(0.01, 0.25, 14, 6, 1, true); bg.translate(0, -7, 0);
    for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(bg, M.additive(T.beam, new THREE.Color(pick(['#ff2bd6', '#5ef2ff', '#ffffff', '#9d6bff'])), 0.05)); m.rotation.set(Math.PI / 2 + rand(-0.9, 0.5), rand(0, 6.28), 0, 'YXZ'); beams.add(m); }
    I.meshes.push(beams);
    I.updaters.push((t, beat) => {
      ball.rotation.y = t * 0.6; beams.rotation.y = t * 0.6;
      lmeshes.forEach((m, i) => { m.rotation.set(0.5 * Math.sin(t * (0.7 + i * 0.13) + i), 0, 0.55 * Math.cos(t * (0.5 + i * 0.11) + i * 2)); m.material.opacity = 0.25 + 0.5 * beat; });
    });
    // bar
    P(16.9, 0.62, 76, 2.6, 0.95, 24, [0.025, 0.025, 0.03], 0, true); NC.addCollider(15.6, 0, 64, 18.2, 1.1, 88, 'bar');
    P(17, 1.12, 76, 2.8, 0.05, 24.2, [0.12, 0.12, 0.14], 0, true);
    N(18.22, 1.0, 76, 0.04, 0.04, 24, cyan);
    for (let r = 0; r < 3; r++) {
      P(15.35, 1.5 + r * 0.6, 76, 0.5, 0.04, 22, [0.3, 0.3, 0.32], 0, true);
      for (let z = 65.5; z < 86.5; z += rand(0.25, 0.45)) N(15.4, 1.68 + r * 0.6, z, 0.09, rand(0.22, 0.34), 0.09, nc(pick(['#ff2bd6', '#5ef2ff', '#7dff4a', '#f3e600', '#ff6a3d', '#9d6bff'])).map((c) => c * 0.6));
    }
    N(15.2, 3.5, 76, 0.04, 0.06, 22, pink);
    npc({ x: 15.95, y: L.CURB, z: 76, yaw: yawDir(1, 0), anim: 'bartend', look: 'bartender2' });
    for (let z = 66.5; z <= 86; z += 3.25) stool(19.3, L.CURB, z, yawDir(-1, 0), 0.75, true);
    const clubDrinks = [
      { name: 'Neon Mule', price: 12, desc: 'Gengibre, vodca sintética e um brilho azul suspeito.', fx: 'drunk' },
      { name: 'Sake bomb', price: 10, desc: 'Um clássico do Kabuki.', fx: 'drunk' },
      { name: 'Zenkai no gelo', price: 7, desc: 'Energia para dançar até o sol nascer.', fx: 'energy' },
      { name: 'Água', price: 2, desc: 'Hidrate-se, choom.', fx: 'calm' },
    ];
    for (const z of [68, 76, 84]) NC.addInteract({ x: 19.3, y: 1.3, z, r: 2.6, label: 'Pedir no bar', kind: 'shop', use: () => NC.UI.shop('Bar do VOLTAGE', clubDrinks) });
    // booths on the east wall
    for (const z of [64, 74, 84]) {
      const f = frame(53.3, L.CURB, z, -Math.PI / 2);
      sofa(53.6, L.CURB, z, -Math.PI / 2, 4.6, [0.2, 0.04, 0.3], 'Sentar no camarote');
      table(51.6, L.CURB, z, 0.7, 0.5, [0.04, 0.04, 0.05], '#ff2bd6');
      N(54.9, 2.4, z, 0.04, 0.04, 4.6, pink);
    }
    NC.addInteract({ x: 35, y: 1.2, z: 79, r: 6, label: 'Dançar', kind: 'dance', use: () => NC.player.dance() });
    // dancers + crowd
    for (let i = 0; i < 26; i++) { const a = rand(0, 6.28), r = rand(1.5, 7); npc({ x: 35 + Math.cos(a) * r, y: L.CURB, z: 79 + Math.sin(a) * r, yaw: rand(-3.1, 3.1), anim: 'dance', club: true }); }
    for (const z of [69.75, 79.5, 82.75]) npc({ x: 19.3, y: L.CURB, z, yaw: yawDir(-1, 0), anim: 'sitbar', seatH: 0.79 });
    npc({ x: 53.3, y: L.CURB, z: 63, yaw: yawDir(-1, 0), anim: 'sit', seatH: 0.6 }); npc({ x: 53.3, y: L.CURB, z: 85, yaw: yawDir(-1, 0), anim: 'sit', seatH: 0.6 });
    // club lights (colors animated)
    const anchors = [];
    for (const [x, z] of [[30, 74], [40, 74], [30, 84], [40, 84]]) { NC.addLight(x, 6, z, '#ff2bd6', 2.4, 16, 1); anchors.push(NC.lightAnchors[NC.lightAnchors.length - 1]); }
    NC.addLight(17.5, 3, 76, '#5ef2ff', 1.4, 10, 1); NC.addLight(35, 5, 92, '#ff2bd6', 2, 14, 1);
    const pal = ['#ff2bd6', '#5ef2ff', '#7dff4a', '#9d6bff', '#f3e600', '#ff6a3d'].map((c) => new THREE.Color(c));
    I.updaters.push((t, beat) => { anchors.forEach((a, i) => { a.color.copy(pal[(Math.floor(t * 2) + i) % pal.length]); a.intensity = 1.2 + beat * 2.4; }); });
    addZone({ x0: 15, x1: 55, z0: 58, z1: 96, y0: -1, y1: 9.6, name: 'Club VOLTAGE', indoor: true, music: 'club' });
    NC.addPOI({ id: 'club', name: 'Club VOLTAGE', desc: 'Pista de LED, lasers, bar e DJ ao vivo.', x: 35, y: L.CURB, z: 51, yaw: yawDir(0, 1), tag: 'INTERIOR' });
    I.clubCenter = new V3(35, 3, 79);
  }

  // ================= 4. Neomart 24 (konbini) =================
  function siteKonbini() {
    const seed = 0.58;
    const B = (x0, y0, z0, x1, y1, z1, style, top) => { W.bagB.aabb(x0, y0, z0, x1, y1, z1, { aB: [seed, style, top] }); NC.addCollider(x0, y0, z0, x1, y1, z1, 'bld'); };
    B(-59, 4.95, 52, -11, 52, 100, 1, 52);
    B(-59, L.CURB, 52, -34, 4.95, 100, 11, 4.95);
    B(-34, L.CURB, 66, -11, 4.95, 100, 11, 4.95);
    B(-14, L.CURB, 52, -11, 4.95, 66, 1, 4.95);
    W.dressFacade({ ax: -59, az: 52, tx: 1, tz: 0, nx: 0, nz: -1, len: 25 }, 52, 1);
    W.dressFacade({ ax: -11, az: 52, tx: 0, tz: 1, nx: 1, nz: 0, len: 48 }, 52, 1);
    W.dressFacade({ ax: -59, az: 100, tx: 0, tz: -1, nx: -1, nz: 0, len: 48 }, 52, 1);
    W.ad('cola', -11.45, 22, 76, 15, 10, Math.PI / 2);
    // storefront
    glassWall(-34, 52.3, -14, 52.3, L.CURB, 4.55, 2.5, [[-25.5, -22.5]]);
    slidingDoor(-24, L.CURB, 52.3, 3, 2.9, true);
    P(-24, 3.72, 52.3, 3, 1.66, 0.1, [0.85, 0.87, 0.9]);
    P(-24, 4.75, 52.25, 20, 0.4, 0.12, [0.9, 0.92, 0.95]);
    const signC = T.canvas(1024, 128), sx = signC.getContext('2d');
    const sg = sx.createLinearGradient(0, 0, 1024, 0); sg.addColorStop(0, '#00a86b'); sg.addColorStop(0.5, '#10c0ff'); sg.addColorStop(1, '#00a86b');
    sx.fillStyle = '#ffffff'; sx.fillRect(0, 0, 1024, 128); sx.fillStyle = sg; sx.fillRect(0, 0, 1024, 26); sx.fillRect(0, 102, 1024, 26);
    sx.fillStyle = '#0a2a4a'; sx.font = `700 74px ${T.DISP}`; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText('NEOMART 24', 400, 66);
    sx.fillStyle = '#00a86b'; sx.font = `900 54px ${T.JP}`; sx.fillText('ネオマート', 820, 66);
    quadMesh(T.tex(signC, { aniso: 8 }), -24, 5.75, 52.1, 12, 1.5, Math.PI, 1.6);
    W.pool(-24, L.CURB + 0.02, 50, 7, [0.9, 1, 1], 0.3);
    NC.addLight(-24, 3, 49.5, '#e8fbff', 1.5, 12, 1);
    // interior shell
    const wcol = [0.55, 0.57, 0.6];
    P(-33.92, 2.35, 59.15, 0.12, 4.4, 13.7, wcol); P(-14.08, 2.35, 59.15, 0.12, 4.4, 13.7, wcol); P(-24, 2.35, 65.92, 19.9, 4.4, 0.12, wcol);
    P(-24, 4.5, 59.15, 20, 0.1, 13.7, [0.6, 0.62, 0.65]);
    for (const x of [-31, -27, -23, -19, -15.5]) N(x, 4.43, 59.15, 0.25, 0.04, 12, [0.75, 0.78, 0.8]);
    floorPlane(-34, -14, 52.35, 66, 0.16, 5, { amb: 0.85 });
    // gondolas
    const prodCols = ['#ff3b4e', '#ffb24a', '#f3e600', '#7dff4a', '#5ef2ff', '#ff2bd6', '#ffffff', '#9d6bff', '#ff6a3d'];
    for (const gx of [-29.5, -25, -20.5]) {
      P(gx, 0.8, 59.5, 1.0, 1.3, 7, [0.45, 0.46, 0.5]);
      NC.addCollider(gx - 0.5, 0, 56, gx + 0.5, 1.6, 63, 'shelf');
      for (const side of [-1, 1]) for (let lvl = 0; lvl < 3; lvl++) {
        const y = 0.45 + lvl * 0.45;
        P(gx + side * 0.6, y - 0.04, 59.5, 0.32, 0.03, 7, [0.5, 0.5, 0.52]);
        for (let z = 56.3; z < 62.8; z += rand(0.22, 0.34)) {
          const h = rand(0.14, 0.32);
          W.prop(gx + side * 0.6, y + h / 2, z, rand(0.12, 0.22), h, rand(0.12, 0.2), nc(pick(prodCols)).map((c) => c * rand(0.5, 1)));
        }
      }
      N(gx, 1.5, 56.02, 0.9, 0.18, 0.03, nc(pick(['#ff3b4e', '#00c080', '#10c0ff'])).map((c) => c * 0.45));
    }
    NC.addInteract({ x: -27.2, y: 1, z: 59.5, r: 2.4, label: 'Ver as prateleiras', kind: 'shop', use: () => NC.UI.shop('Neomart 24 · Prateleiras', [
      { name: 'Onigiri de salmão', price: 3, desc: 'Alga crocante, embalagem que nunca abre direito.', fx: 'food' },
      { name: 'Pocky de morango', price: 2, desc: 'Doce, rosa, perfeito.', fx: 'food' },
      { name: 'Batata chips wasabi', price: 3, desc: 'Arde no nariz.', fx: 'food' },
      { name: 'Guarda-chuva transparente', price: 8, desc: 'O acessório oficial de Nox City.', fx: 'umbrella' },
    ]) });
    // fridges
    P(-27.75, 1.3, 65.35, 11.5, 2.4, 1.0, [0.2, 0.2, 0.22]);
    N(-27.75, 1.3, 64.86, 11.2, 2.2, 0.02, [0.55, 0.75, 1.0].map((c) => c * 0.42));
    for (let r = 0; r < 4; r++) for (let x = -33.2; x < -22.3; x += 0.21) W.prop(x, 0.45 + r * 0.52, 64.75, 0.14, rand(0.22, 0.36), 0.14, nc(pick(prodCols)).map((c) => c * 0.7));
    for (let x = -33.4; x <= -22; x += 2.85) P(x, 1.3, 64.62, 0.06, 2.4, 0.06, [0.6, 0.6, 0.62], 0, true);
    I.bagGlass.quad(-27.75, 1.3, 64.6, 11.5, 2.4, 0);
    NC.addCollider(-33.5, 0, 64.5, -22, 2.5, 66, 'fridge');
    NC.addInteract({ x: -27.75, y: 1.2, z: 63.6, r: 2.6, label: 'Abrir a geladeira', kind: 'shop', use: () => NC.UI.shop('Neomart 24 · Geladeira', [
      { name: 'Synth Cola', price: 3, desc: 'Gelada.', fx: 'drink' },
      { name: 'Zenkai Energy', price: 6, desc: 'Corrida turbinada por 60 segundos.', fx: 'energy' },
      { name: 'Chá de cevada', price: 3, desc: 'Sem cafeína, sem drama.', fx: 'calm' },
      { name: 'Cerveja Kirin-Nox', price: 5, desc: 'Lata alta. Fica tonto rapidinho.', fx: 'drunk' },
    ]) });
    // counter
    P(-18.5, 0.6, 57, 1.4, 0.9, 6, [0.85, 0.87, 0.9], 0, true); NC.addCollider(-19.2, 0, 54, -17.8, 1.1, 60, 'counter');
    P(-18.5, 1.08, 57, 1.5, 0.05, 6.1, [0.2, 0.2, 0.22], 0, true);
    P(-18.3, 1.3, 58.6, 0.5, 0.35, 0.4, [0.1, 0.1, 0.11]); N(-18.6, 1.42, 58.6, 0.02, 0.2, 0.32, [0.3, 0.9, 0.6]);
    P(-18.5, 1.42, 55, 1.2, 0.6, 1.2, [0.2, 0.2, 0.22]); N(-18.5, 1.42, 55, 1.1, 0.5, 1.1, [1, 0.55, 0.18]);
    for (let i = 0; i < 6; i++) W.prop(-18.8 + (i % 3) * 0.3, 1.3, 54.75 + Math.floor(i / 3) * 0.5, 0.22, 0.14, 0.22, [0.85, 0.7, 0.45]);
    npc({ x: -16.7, y: L.CURB, z: 57.5, yaw: yawDir(-1, 0), anim: 'idle', look: 'android', line: ['Atendente', 'Irasshaimase! Bem-vindo ao Neomart.'] });
    const lines = ['Irasshaimase! Bem-vindo ao Neomart.', 'Quer esquentar? Não? Tudo bem.', 'O nikuman acabou de sair. Cuidado, está quente.', 'Promoção: dois Zenkai pelo preço de dois.', 'Sou um modelo KR-7. Trabalho aqui faz 11 anos. Gosto.', 'Está chovendo há 41 dias. Guarda-chuva na prateleira do meio.'];
    NC.addInteract({ x: -20.1, y: 1.2, z: 57.5, r: 1.8, label: 'Falar com o atendente', kind: 'talk', use: () => NC.UI.say('Atendente KR-7', pick(lines)) });
    NC.addInteract({ x: -20.1, y: 1.2, z: 55, r: 1.6, label: 'Comprar algo quente', kind: 'shop', use: () => NC.UI.shop('Neomart 24 · Balcão quente', [
      { name: 'Nikuman', price: 3, desc: 'Pãozinho no vapor recheado de carne cultivada.', fx: 'food' },
      { name: 'Karaage', price: 4, desc: 'Frango frito em espetinho.', fx: 'food' },
      { name: 'Café quente', price: 3, desc: 'Da máquina. Surpreendentemente bom.', fx: 'calm' },
    ]) });
    // magazine rack + ATM + coffee machine
    P(-31.3, 0.7, 52.9, 4.5, 1.1, 0.5, [0.7, 0.72, 0.75]);
    for (let x = -33.3; x < -29.2; x += 0.42) W.prop(x, 1.0, 52.8, 0.36, 0.48, 0.03, nc(pick(prodCols)).map((c) => c * 0.8));
    NC.addInteract({ x: -31.3, y: 1, z: 54, r: 1.6, label: 'Folhear revista', kind: 'read', use: () => NC.UI.read('Nox Weekly', ['MANCHETE: Hyperion anuncia implante "que sonha por você".', 'Chuva completa 41 dias seguidos; recorde histórico.', 'Entrevista: Kaori Static, a DJ que tocou 14 horas sem parar.', 'Guia: os 10 melhores lámens do Rio Kuro.', 'Classificados: vende-se AV usado, só 300 mil km.']) });
    P(-33.3, 1.0, 62.3, 0.8, 1.9, 0.9, [0.3, 0.32, 0.36], 0, true); N(-32.88, 1.35, 62.3, 0.02, 0.4, 0.5, [0.2, 0.8, 1]);
    NC.colliderBox(-33.3, 1, 62.3, 0.8, 2, 0.9, 'atm');
    NC.addInteract({ x: -32.2, y: 1.2, z: 62.3, r: 1.5, label: 'Usar caixa eletrônico', kind: 'atm', use: () => NC.player.atm() });
    P(-15.2, 1.0, 64.6, 1.2, 2.0, 0.8, [0.15, 0.15, 0.17]); N(-15.2, 1.3, 64.18, 0.8, 0.3, 0.02, [1, 0.5, 0.2]);
    NC.colliderBox(-15.2, 1, 64.6, 1.2, 2, 0.8, 'coffee');
    for (const z of [55, 59.5, 63.5]) NC.addLight(-24, 3.9, z, '#f4fbff', 1.1, 10, 3);
    addZone({ x0: -34, x1: -14, z0: 52.3, z1: 66, y0: -1, y1: 4.6, name: 'Neomart 24', indoor: true, chime: true });
    // outside
    W.addVending(-36.2, L.CURB, 51.5, Math.PI, 'cola'); W.addVending(-37.5, L.CURB, 51.5, Math.PI, 'noodle');
    W.addBench(-44, L.CURB, 50.6, Math.PI);
    for (const x of [-15.4, -14.6]) { PG(G.cyl, x, L.CURB + 0.45, 51.4, 0.6, 0.9, 0.6, [0.15, 0.4, 0.25]); }
    NC.addPOI({ id: 'konbini', name: 'Neomart 24', desc: 'Konbini aberto 24h: lanches, bebidas, revista e caixa.', x: -24, y: L.CURB, z: 49.5, yaw: yawDir(0, 1), tag: 'INTERIOR' });
  }

  // ================= 5. Praça Sakura =================
  function sitePlaza() {
    const b = W.addBuilding(-59, -11, -100, -80, 150, { inner: true, style: 0 });
    W.dressFacade({ ax: -11, az: -80, tx: -1, tz: 0, nx: 0, nz: 1, len: 48 }, b.tiers[0][5], 1.2);
    W.dressFacade({ ax: -59, az: -100, tx: 1, tz: 0, nx: 0, nz: -1, len: 48 }, b.tiers[0][5], 1);
    W.ad('jinguji', -35, 34, -79.5, 14, 28, 0);
    // torii
    const red = [0.55, 0.04, 0.03];
    for (const x of [-38.6, -31.4]) { PG(G.cyl, x, L.CURB + 3.2, -53.2, 0.7, 6.4, 0.7, red); PG(G.cyl, x, L.CURB + 0.2, -53.2, 0.9, 0.4, 0.9, [0.05, 0.05, 0.05]); NC.colliderBox(x, 3, -53.2, 0.7, 6.5, 0.7, 'torii'); }
    P(-35, L.CURB + 6.55, -53.2, 11.5, 0.45, 0.9, red); P(-35, L.CURB + 6.9, -53.2, 12.4, 0.25, 1.0, [0.06, 0.03, 0.03]);
    P(-35, L.CURB + 5.3, -53.2, 9.2, 0.32, 0.4, red);
    N(-35, L.CURB + 6.3, -52.7, 11.3, 0.05, 0.05, nc('#ff3b4e'));
    for (const x of [-37.2, -35, -32.8]) lantern(x, L.CURB + 4.5, -53.2, '#ff7a2a', 1.1);
    // sakura trees
    const trees = [[-50, -60, 1.0], [-21, -61, 1.05], [-47, -72, 0.95], [-22, -73, 0.9], [-35, -67, 1.35]];
    const petalSrc = [];
    for (const [x, z, s] of trees) {
      PG(G.cyl6, x, L.CURB + 1.6 * s, z, 0.45 * s, 3.2 * s, 0.45 * s, [0.08, 0.04, 0.03]);
      W.beam(W.bagProps, new V3(x, L.CURB + 2.6 * s, z), new V3(x + 1.6 * s, L.CURB + 4.2 * s, z + 0.6 * s), 0.25 * s, { color: [0.08, 0.04, 0.03] });
      W.beam(W.bagProps, new V3(x, L.CURB + 2.8 * s, z), new V3(x - 1.4 * s, L.CURB + 4.0 * s, z - 0.8 * s), 0.25 * s, { color: [0.08, 0.04, 0.03] });
      for (let i = 0; i < 9; i++) {
        const a = rand(0, 6.28), r = rand(0.5, 2.4) * s;
        W.bagNeon.add(G.ico, NC.mat4(x + Math.cos(a) * r, L.CURB + rand(3.8, 5.6) * s, z + Math.sin(a) * r, rand(1.6, 2.6) * s, rand(1.3, 2.0) * s, rand(1.6, 2.6) * s, rand(0, 6)), { color: [1.0, 0.42 + rand(0, 0.12), 0.68].map((c) => c * 0.3), aPhase: 0 });
      }
      NC.colliderBox(x, 1.6, z, 0.6, 3.2, 0.6, 'tree');
      NC.addLight(x, L.CURB + 3.5, z, '#ff8ac8', 1.2, 12, 1);
      W.pool(x, L.CURB + 0.03, z, 5 * s, nc('#ff6ab8'), 0.3);
      petalSrc.push([x, L.CURB + 4.5 * s, z, s]);
    }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; W.addBench(-35 + Math.cos(a) * 4.6, L.CURB, -67 + Math.sin(a) * 4.6, Math.atan2(Math.cos(a), Math.sin(a)), { color: [0.2, 0.1, 0.06] }); }
    // petals
    const PN = 700, pp = new Float32Array(PN * 3), pdata = [];
    for (let i = 0; i < PN; i++) { const t = pick(petalSrc); pdata.push({ t, ph: rand(0, 1), r: rand(0.5, 4), sp: rand(0.25, 0.6), a: rand(0, 6.28) }); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    const petals = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.12, color: new THREE.Color(1.6, 0.7, 1.1), map: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    NC.noRefl(petals); I.meshes.push(petals);
    I.updaters.push((t) => {
      for (let i = 0; i < PN; i++) {
        const d = pdata[i], [x, y, z, s] = d.t, k = (t * d.sp * 0.15 + d.ph) % 1;
        pp[i * 3] = x + Math.cos(d.a + t * 0.3) * d.r * s + k * 3; pp[i * 3 + 1] = y - k * (y - 0.2); pp[i * 3 + 2] = z + Math.sin(d.a + t * 0.25) * d.r * s;
      }
      pg.attributes.position.needsUpdate = true;
    });
    // yakitori food truck
    const tf = frame(-53, L.CURB, -76, -Math.PI / 2);
    tf.box(0, 1.6, 0, 6, 2.6, 2.6, [0.85, 0.82, 0.75], true);
    tf.box(0, 0.4, 0, 6.2, 0.5, 2.7, [0.05, 0.05, 0.05]);
    tf.box(0.5, 1.75, 1.32, 3.4, 1.1, 0.04, [0.04, 0.03, 0.03]);
    tf.neon(0.5, 1.75, 1.34, 3.2, 0.9, 0.02, [1, 0.6, 0.25].map((c) => c * 0.8));
    tf.box(0.5, 2.55, 1.9, 3.8, 0.08, 1.2, [0.6, 0.06, 0.04]);
    tf.neon(0.5, 2.5, 2.48, 3.8, 0.05, 0.05, nc('#ffb24a'));
    for (const lx of [-2.2, 2.2]) tf.geo(G.cyl, lx, 0.35, 1.3, 0.7, 0.3, 0.7, [0.02, 0.02, 0.02], false);
    NC.colliderBox(-53, 1.5, -76, 2.8, 3, 6.2, 'truck');
    const yakT = wordTex('焼鳥 YAKITORI', '#ffb24a', 1024, 200, `900 120px ${T.JP}`);
    quadMesh(yakT, -51.65, 3.45, -75.5, 4.5, 0.9, Math.PI / 2, 1.6);
    NC.addSteam(-51.8, 2.9, -75.5, 0.8, 0.8, [0.9, 0.6, 0.4]);
    npc({ x: -53.4, y: L.CURB + 0.5, z: -75.5, yaw: yawDir(1, 0), anim: 'cook', look: 'cook' });
    NC.addInteract({ x: -50, y: 1.2, z: -75.5, r: 2.2, label: 'Comprar no Yakitori Truck', kind: 'shop', use: () => NC.UI.shop('Yakitori Truck', [
      { name: 'Espeto de frango (tare)', price: 4, desc: 'Grelhado no carvão sintético.', fx: 'food' },
      { name: 'Tsukune', price: 5, desc: 'Almôndega de frango com gema.', fx: 'food' },
      { name: 'Highball', price: 7, desc: 'Uísque com soda. Leve.', fx: 'drunk' },
    ]) });
    NC.addLight(-50.5, 2.5, -75.5, '#ffb070', 1.4, 10, 1);
    // hologram statue
    PG(G.cyl6, -16, L.CURB + 0.5, -56.5, 2.6, 1, 2.6, [0.08, 0.08, 0.09]);
    NC.colliderBox(-16, 0.5, -56.5, 2.6, 1, 2.6, 'ped');
    N(-16, L.CURB + 1.02, -56.5, 2.65, 0.05, 2.65, nc('#5ef2ff'));
    const va = T.adByName('vanta'); va.tex = va.tex || T.tex(va.canvas, { aniso: 8 });
    const hs = new THREE.Group(); hs.position.set(-16, L.CURB + 4.3, -56.5);
    const hp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.5), M.holo(0x9fe8ff, { map: va.tex, alpha: 0.85 })); hs.add(hp);
    const hr = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 6, 48), M.holo(0x5ef2ff, { alpha: 0.9 })); hr.rotation.x = Math.PI / 2; hr.position.y = -3.1; hs.add(hr);
    I.meshes.push(hs);
    I.updaters.push((t) => { hs.rotation.y = t * 0.5; hr.position.y = -3.1 + ((t * 0.8) % 1) * 6.2; });
    NC.addLight(-16, 3, -56.5, '#5ef2ff', 1.2, 10, 1);
    // string lights across the plaza
    for (let k = 0; k < 4; k++) {
      const a0 = new V3(-58, 6.5, -55 - k * 6), a1 = new V3(-12, 6.5, -57 - k * 6);
      for (let i = 1; i < 30; i++) { const t = i / 30, p = new V3().lerpVectors(a0, a1, t); p.y -= Math.sin(Math.PI * t) * 1.6; W.lightPts.push(p.x, p.y, p.z); W.lightCols.push(...nc(pick([2, 3, 7, 0]))); }
    }
    terminal(-44, L.CURB, -53.6, Math.PI, 'Praça Sakura', ['Cerejeiras bioluminescentes, plantadas', 'em 2061 pela Jinguji Foundation.', 'Florescem o ano inteiro.', '', 'Proibido drones. Proibido tristeza.', 'Fotografe à vontade.'], '#ff8ac8');
    addZone({ x0: -59, x1: -11, z0: -80, z1: -52, y0: -1, y1: 30, name: 'Praça Sakura', indoor: false });
    NC.addPOI({ id: 'plaza', name: 'Praça Sakura', desc: 'Cerejeiras que brilham, torii e yakitori.', x: -35, y: L.CURB, z: -50.5, yaw: yawDir(0, -1), tag: 'PRAÇA' });
  }

  // ================= 6. Tsuki Ramen on the south promenade =================
  function siteRamen() {
    const Y = L.CURB, wood = [0.12, 0.07, 0.04];
    P(23, Y + 1.4, 33.1, 14, 2.8, 1.0, wood); NC.addCollider(16, 0, 32.6, 30, 3, 33.6, 'wall');
    P(23, Y + 0.45, 31.95, 13, 0.9, 1.1, [0.45, 0.46, 0.5], 0, true); NC.addCollider(16.5, 0, 31.4, 29.5, 1.05, 32.5, 'counter');
    P(23, Y + 0.5, 29.95, 13, 1.0, 0.7, wood); P(23, Y + 1.03, 29.85, 13.2, 0.06, 0.95, [0.35, 0.22, 0.12], 0, true);
    NC.addCollider(16.5, 0, 29.6, 29.5, 1.08, 30.3, 'counter');
    for (const x of [15.6, 30.4]) for (const z of [28, 33.6]) P(x, Y + 1.5, z, 0.14, 3.0, 0.14, [0.08, 0.05, 0.03]);
    P(23, Y + 3.05, 30.8, 15.2, 0.14, 6.2, [0.45, 0.05, 0.04]);
    N(23, Y + 2.96, 27.72, 15.2, 0.06, 0.06, nc('#ffb24a'));
    for (let i = 0; i < 7; i++) lantern(16.8 + i * 2.05, Y + 2.55, 27.9, '#ff5a1a', 0.9);
    for (let i = 0; i < 8; i++) F(16.4 + i * 1.88, Y + 2.55, 27.82, 1.7, 0.75, 0.02, i % 2 ? [0.03, 0.05, 0.14] : [0.04, 0.06, 0.18]);
    // menu boards
    const mc = T.canvas(1024, 256), mx = mc.getContext('2d');
    mx.fillStyle = '#120804'; mx.fillRect(0, 0, 1024, 256);
    mx.textBaseline = 'middle';
    const items = [['醤油ラーメン', 'Shoyu', '12'], ['豚骨ラーメン', 'Tonkotsu', '14'], ['餃子', 'Gyoza', '6'], ['緑茶', 'Chá verde', '2']];
    items.forEach(([jp, pt, pr], i) => { const x = 20 + i * 252; mx.fillStyle = '#ffcf6a'; mx.font = `900 40px ${T.JP}`; mx.fillText(jp.slice(0, 5), x, 70); mx.fillStyle = '#ffffff'; mx.font = `600 34px ${T.DISP}`; mx.fillText(pt, x, 140); mx.fillStyle = '#ff6a3d'; mx.fillText('₵' + pr, x, 200); });
    const menu = quadMesh(T.tex(mc), 23, Y + 2.1, 32.56, 9, 2.25, Math.PI, 1.3);
    // pots + steam
    for (const x of [18.5, 20.5, 25.5]) { PG(G.cyl, x, Y + 1.1, 31.95, 0.7, 0.4, 0.7, [0.6, 0.6, 0.62], 0, 0, 0, true); NC.addSteam(x, Y + 1.35, 31.95, 1.2, 0.7); }
    N(22.5, Y + 0.93, 31.95, 1.5, 0.04, 0.6, [1, 0.35, 0.1]);
    npc({ x: 23, y: Y, z: 30.85, yaw: yawDir(0, 1), anim: 'cook', look: 'cook' });
    // stools
    const occupied = [1, 4];
    for (let i = 0; i < 6; i++) {
      const x = 17.6 + i * 2.15;
      stool(x, Y, 29.0, yawDir(0, 1), 0.72, !occupied.includes(i));
      if (occupied.includes(i)) npc({ x, y: Y, z: 29.0, yaw: yawDir(0, 1), anim: 'eat', seatH: 0.76 });
    }
    const ramenMenu = [
      { name: 'Shoyu ramen', price: 12, desc: 'Caldo de soja, chashu, ovo marinado.', fx: 'food', line: 'Shoyu saindo! Itadakimasu.' },
      { name: 'Tonkotsu ramen', price: 14, desc: 'Caldo de osso cozido por 18 horas.', fx: 'food', line: 'Tonkotsu, bem quente. Cuidado.' },
      { name: 'Gyoza (6 un.)', price: 6, desc: 'Crocantes embaixo, macios em cima.', fx: 'food', line: 'Gyoza na chapa, um minuto!' },
      { name: 'Chá verde', price: 2, desc: 'Por conta da casa? Não. ₵2.', fx: 'calm', line: 'Chá. Pra esquentar.' },
    ];
    NC.addInteract({ x: 23, y: 1.2, z: 28.6, r: 4.2, label: 'Pedir no Tsuki Ramen', kind: 'shop', use: () => NC.UI.shop('Tsuki Ramen 月', ramenMenu, { cook: 'Mestre Tsuki' }) });
    const rad = T.adByName('ramenad'); rad.tex = rad.tex || T.tex(rad.canvas, { aniso: 8 });
    quadMesh(rad.tex, 23, Y + 4.35, 30.8, 4.8, 3.2, Math.PI, 1.6);
    P(23, Y + 4.35, 30.86, 5, 3.3, 0.1, [0.03, 0.02, 0.02]);
    for (const x of [18, 23, 28]) NC.addLight(x, Y + 2.3, 29, '#ff7a30', 1.4, 9, 1);
    W.pool(23, Y + 0.03, 28, 6, [1, 0.45, 0.15], 0.45);
    // yakitori cart + standing tables
    P(33.8, Y + 0.5, 29.5, 3.2, 1.0, 1.6, [0.3, 0.2, 0.12]); NC.addCollider(32.2, 0, 28.7, 35.4, 1.1, 30.3, 'cart');
    P(33.8, Y + 1.05, 29.5, 2.6, 0.1, 1.0, [0.04, 0.04, 0.04]); N(33.8, Y + 1.11, 29.5, 2.4, 0.02, 0.8, [1, 0.3, 0.05]);
    NC.addSteam(33.8, Y + 1.3, 29.5, 1.0, 0.8, [0.9, 0.55, 0.35]);
    lantern(35.2, Y + 2.1, 28.8, '#ff3b1a', 1);
    PG(G.cyl6, 35.3, Y + 1.0, 28.8, 0.05, 2.0, 0.05, [0.1, 0.1, 0.1]);
    npc({ x: 33.8, y: Y, z: 30.6, yaw: yawDir(0, -1), anim: 'cook', look: 'cook' });
    for (const [x, c] of [[38.5, '#ff2bd6'], [42.5, '#5ef2ff']]) {
      table(x, Y, 28.6, 0.45, 1.05, [0.1, 0.1, 0.11]);
      PG(G.cyl6, x, Y + 1.6, 28.6, 0.05, 2.2, 0.05, [0.2, 0.2, 0.2]);
      PG(G.cone, x, Y + 2.9, 28.6, 2.8, 0.55, 2.8, [0.08, 0.08, 0.1]);
      N(x, Y + 2.63, 28.6, 2.75, 0.03, 2.75, nc(c), 2.4);
    }
    npc({ x: 38.9, y: Y, z: 29.2, yaw: yawDir(-0.5, -1), anim: 'idle' }); npc({ x: 42.1, y: Y, z: 28.0, yaw: yawDir(0.4, 1), anim: 'phone' });
    addZone({ x0: 15.5, x1: 30.5, z0: 27.5, z1: 33.8, y0: -1, y1: 6, name: 'Tsuki Ramen 月', indoor: false });
    NC.addPOI({ id: 'ramen', name: 'Tsuki Ramen', desc: 'Balcão de lámen na beira do rio, com vapor e lanternas.', x: 23, y: Y, z: 26.6, yaw: yawDir(0, 1), tag: 'COMIDA' });
  }

  // ================= 7. Mirante da Ponte (observation pod between pylons) =================
  function siteMirante() {
    const Y = 48.4;
    P(0, Y - 0.4, 0, 32, 0.8, 12, [0.06, 0.06, 0.07]); NC.addCollider(-16, Y - 0.8, -6, 16, Y, 6, 'floor');
    floorPlane(-16, 16, -6, 6, Y + 0.01, 3, { amb: 1.4 });
    glassWall(-16, -6, 16, -6, Y, Y + 6.8, 2.6); glassWall(-16, 6, 16, 6, Y, Y + 6.8, 2.6);
    glassWall(-16, -6, -16, 6, Y, Y + 6.8, 2.4); glassWall(16, -6, 16, 6, Y, Y + 6.8, 2.4);
    P(0, Y + 7.1, 0, 32.6, 0.6, 12.6, [0.05, 0.05, 0.06]);
    const pink = nc('#ff2bd6');
    for (const z of [-6.3, 6.3]) N(0, Y + 7.42, z, 32.6, 0.08, 0.08, pink);
    for (const x of [-16.3, 16.3]) N(x, Y + 7.42, 0, 0.08, 0.08, 12.6, pink);
    N(0, Y - 0.82, -6.05, 32, 0.06, 0.06, pink); N(0, Y - 0.82, 6.05, 32, 0.06, 0.06, pink);
    for (let x = -10; x <= 10; x += 5) N(x, Y + 6.75, 0, 0.12, 0.04, 9, [1, 0.8, 0.6]);
    // benches looking along the river both ways, and toward each bank
    for (const sx of [-1, 1]) for (const z of [-3.6, 3.6]) W.addBench(sx * 14.6, Y, z, sx > 0 ? Math.PI / 2 : -Math.PI / 2, { color: [0.18, 0.1, 0.06], neon: pink.map((c) => c * 0.5) });
    for (const sz of [-1, 1]) for (const x of [-6, 6]) W.addBench(x, Y, sz * 4.8, sz > 0 ? 0 : Math.PI, { color: [0.18, 0.1, 0.06] });
    binoculars(15.3, Y, -4.9, Math.PI / 2); binoculars(-15.3, Y, 4.9, -Math.PI / 2);
    W.addVending(-9.5, Y, -5.4, 0, 'cola');
    terminal(9.5, Y, 5.45, Math.PI, 'Ponte Neon', ['Inaugurada em 2069. 312 cabos estaiados.', 'O letreiro diz: 夜の街は、眠らない', '"A cidade da noite não dorme."', '', 'Altura do mirante: 48 m acima do rio.', 'Barcos-táxi passam a cada 4 minutos.'], '#ff8ad8');
    for (const x of [-8, 0, 8]) NC.addLight(x, Y + 5, 0, '#ffb8e8', 1.0, 12, 1);
    // pylon elevator: deck level and pod level (inner face of the +x pylon)
    P(11.5, L.CURB - 0.08, 0, 1.25, 0.16, 3.2, [0.08, 0.08, 0.09]); NC.addCollider(10.85, -0.5, -1.6, 12.15, L.CURB, 1.6, 'slab');
    I.elevator('Elevador da Ponte', [
      { label: 'Deck da ponte', sub: 'Calçada · nível da rua', x: 10.6, y: L.CURB, z: 0, yaw: yawDir(-1, 0), door: [12.08, L.CURB, 0, -Math.PI / 2] },
      { label: 'Mirante', sub: '48 m · vista do rio', x: 10.9, y: Y, z: 0, yaw: yawDir(-1, 0), door: [12.08, Y, 0, -Math.PI / 2] },
    ], '#ff2bd6');
    addZone({ x0: -16, x1: 16, z0: -6, z1: 6, y0: Y - 1, y1: Y + 7, name: 'Mirante da Ponte · 48 m', indoor: true });
    NC.addPOI({ id: 'mirante', name: 'Mirante da Ponte', desc: 'Cápsula de vidro entre os pilares, a 48 m do rio.', x: 0, y: Y, z: 0, yaw: Math.PI / 2, tag: 'MIRANTE' });
    NC.addPOI({ id: 'bridge', name: 'Ponte Neon', desc: 'A ponte do letreiro 夜の街は、眠らない. Elevador para o mirante.', x: -9, y: L.CURB, z: 22, yaw: yawDir(0, -1), tag: 'PONTE' });
    NC.addPOI({ id: 'cross', name: 'Cruzamento Central', desc: 'Cruzamento diagonal estilo scramble, cercado de letreiros.', x: 60, y: L.CURB, z: -116, yaw: yawDir(1, -1), tag: 'RUA' });
  }

  I.build = function () {
    I.begin();
    siteStart(); siteHyperion(); siteClub(); siteKonbini(); sitePlaza(); siteRamen(); siteMirante();
  };

  I.finish = function (scene) {
    scene.add(new THREE.Mesh(I.bagFab.build(), M.fabric));
    const glass = new THREE.Mesh(I.bagGlass.build(), M.glass); glass.renderOrder = 3; scene.add(glass);
    const rail = new THREE.Mesh(I.bagRail.build(), M.glassRail); rail.renderOrder = 3; scene.add(rail);
    I.meshes.forEach((m) => scene.add(m));
    I.doors.forEach((d) => { d.a.position.set(d.cx, d.y + 1.5, d.cz); d.b.position.set(d.cx, d.y + 1.5, d.cz); scene.add(d.a, d.b); });
  };

  I.update = function (t, dt, beat, pp) {
    for (const u of I.updaters) u(t, beat, dt);
    for (const d of I.doors) {
      const dist = Math.hypot(pp.x - d.cx, pp.z - d.cz);
      const target = dist < 4 && Math.abs(pp.y - d.y) < 3 ? 1 : 0;
      const prev = d.open;
      d.open = NC.damp(d.open, target, 6, dt);
      if (target && prev < 0.05 && d.open >= 0.05 && NC.Audio) NC.Audio.door(d.cx, d.y, d.cz);
      const off = d.width / 4 + d.open * d.width / 2 * 0.95;
      if (d.alongX) { d.a.position.x = d.cx - off; d.b.position.x = d.cx + off; }
      else { d.a.position.z = d.cz - off; d.b.position.z = d.cz + off; }
    }
  };
})();
