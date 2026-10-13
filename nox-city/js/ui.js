/* Nox City — HUD, overlays (map + fast travel, settings, elevator, shops), toasts, subtitles, minimap. */
(function () {
  'use strict';
  const NC = window.NC;
  const UI = (NC.UI = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  UI.init = function () {
    if (NC.isTouch) { document.body.classList.add('is-touch'); $('keysPc').hidden = true; $('keysTouch').hidden = false; }
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => UI.closeAll()));
    document.querySelectorAll('.overlay').forEach((o) => o.addEventListener('pointerdown', (e) => { if (e.target === o) UI.closeAll(); }));
    $('bMap').addEventListener('click', () => UI.openMap());
    $('bMenu').addEventListener('click', () => UI.open('menuUI'));
    $('bView').addEventListener('click', () => NC.player.toggleView());
    $('bPhoto').addEventListener('click', () => UI.togglePhoto());
    $('enter').addEventListener('click', () => UI.enter());
    // settings
    const seg = (id, key, conv, onChange) => {
      const el = $(id);
      const sync = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(conv(b.dataset.v)) === String(NC.settings[key])));
      el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { NC.settings[key] = conv(b.dataset.v); NC.saveSettings(); sync(); onChange && onChange(NC.settings[key]); }));
      sync();
    };
    seg('optQ', 'quality', (v) => v, (q) => NC.applyQuality && NC.applyQuality(q));
    seg('optRain', 'rain', (v) => v === '1', () => {});
    seg('optMusic', 'music', (v) => v === '1', () => {});
    seg('optFps', 'fps', (v) => v === '1', (v) => { $('fps').style.display = v ? 'block' : 'none'; });
    $('fps').style.display = NC.settings.fps ? 'block' : 'none';
    $('optSens').value = NC.settings.sens; $('optVol').value = NC.settings.vol;
    $('optSens').addEventListener('input', (e) => { NC.settings.sens = +e.target.value; NC.saveSettings(); });
    $('optVol').addEventListener('input', (e) => { NC.settings.vol = +e.target.value; NC.saveSettings(); NC.Audio && NC.Audio.setVolume(NC.settings.vol); });
    UI.clock = 23 * 60 + 47;
  };

  UI.ready = function () {
    NC.progress(1, 'Pronto. A cidade está acordada.');
    const b = $('enter'); b.disabled = false; b.focus({ preventScroll: true });
  };
  UI.enter = function () {
    if (UI.entered || $('enter').disabled) return;
    UI.entered = true;
    NC.Audio && NC.Audio.init();
    $('intro').classList.add('gone');
    setTimeout(() => { $('intro').style.display = 'none'; }, 1000);
    $('hud').classList.add('on');
    NC.startPlay && NC.startPlay();
    if (!NC.isTouch) { try { const c = NC.renderer.domElement; const r = c.requestPointerLock && c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  };

  // ---------------- overlays ----------------
  UI.isOpen = (id) => $(id).classList.contains('on');
  UI.anyOpen = () => !!document.querySelector('.overlay.on');
  UI.open = function (id) {
    UI.closeAll(true);
    $(id).classList.add('on');
    if (document.pointerLockElement) document.exitPointerLock();
    NC.player.keys = {};
  };
  UI.closeAll = function (silent) {
    document.querySelectorAll('.overlay.on').forEach((o) => o.classList.remove('on'));
  };

  UI.shop = function (title, items, opts = {}) {
    $('shopTitle').textContent = title;
    const box = $('shopItems'); box.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button'); b.className = 'item';
      b.innerHTML = `<b>${esc(it.name)}</b><em>₵${it.price}</em><span>${esc(it.desc || '')}</span>`;
      b.disabled = NC.player.money < it.price;
      b.addEventListener('click', () => { UI.closeAll(); NC.player.buy(it, opts); });
      box.appendChild(b);
    }
    const bal = document.createElement('div'); bal.className = 'sec'; bal.textContent = `Saldo: ₵${NC.player.money}`;
    box.appendChild(bal);
    UI.open('shop');
  };
  UI.read = function (title, lines) {
    $('shopTitle').textContent = title;
    const box = $('shopItems'); box.innerHTML = '';
    const d = document.createElement('div');
    d.style.cssText = 'display:grid;gap:8px;font-family:var(--f-mono);font-size:15px;line-height:1.5;color:var(--cyan);padding:14px;border:1px solid var(--line);background:rgba(94,242,255,.04)';
    d.innerHTML = lines.map((l) => `<div>${esc(l) || '&nbsp;'}</div>`).join('');
    box.appendChild(d);
    UI.open('shop');
  };
  UI.elevator = function (name, floors, cur) {
    $('elevTitle').textContent = name;
    const box = $('elevFloors'); box.innerHTML = '';
    floors.forEach((f, i) => {
      const b = document.createElement('button'); b.className = 'floor' + (i === cur ? ' cur' : '');
      b.innerHTML = `<span>${esc(f.label)}</span><small>${i === cur ? 'você está aqui' : esc(f.sub || '')}</small>`;
      b.addEventListener('click', () => { UI.closeAll(); NC.player.teleport(f.x, f.y, f.z, f.yaw, { ding: true }); UI.toast(`Elevador: <b>${esc(f.label)}</b>`); });
      box.appendChild(b);
    });
    UI.open('elev');
  };

  // ---------------- map ----------------
  const MAPR = { x0: -270, x1: 270, z0: -280, z1: 280 };
  UI.mapXY = (x, z, W, H) => [((x - MAPR.x0) / (MAPR.x1 - MAPR.x0)) * W, ((z - MAPR.z0) / (MAPR.z1 - MAPR.z0)) * H];
  UI.buildMap = function () {
    const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
    x.fillStyle = '#05060c'; x.fillRect(0, 0, 1024, 1024);
    const L = NC.L;
    // roads
    x.fillStyle = '#141826';
    for (const xc of L.XR) { const [a] = UI.mapXY(xc - 7, 0, 1024, 1024), [b] = UI.mapXY(xc + 7, 0, 1024, 1024); x.fillRect(a, 0, b - a, 1024); }
    for (const zc of L.ZR) { const [, a] = UI.mapXY(0, zc - 7, 1024, 1024), [, b] = UI.mapXY(0, zc + 7, 1024, 1024); x.fillRect(0, a, 1024, b - a); }
    // blocks
    for (const b of L.blocks) {
      const [ax, az] = UI.mapXY(b.x0, b.z0, 1024, 1024), [bx, bz] = UI.mapXY(b.x1, b.z1, 1024, 1024);
      x.fillStyle = b.inner ? '#1e2236' : '#151826'; x.fillRect(ax, az, bx - ax, bz - az);
      x.fillStyle = b.inner ? '#2a3050' : '#1c2032'; x.fillRect(ax + 4, az + 4, bx - ax - 8, bz - az - 8);
    }
    // river + promenades
    const [, r0] = UI.mapXY(0, -24, 1024, 1024), [, r1] = UI.mapXY(0, 24, 1024, 1024);
    const g = x.createLinearGradient(0, r0, 0, r1); g.addColorStop(0, '#0a2a40'); g.addColorStop(0.5, '#06182a'); g.addColorStop(1, '#0a2a40');
    x.fillStyle = g; x.fillRect(0, r0, 1024, r1 - r0);
    x.fillStyle = '#5ef2ff'; x.globalAlpha = 0.5; x.fillRect(0, r0 - 1, 1024, 1.5); x.fillRect(0, r1, 1024, 1.5); x.globalAlpha = 1;
    // bridges
    for (const xc of L.XR) {
      const [a, z0] = UI.mapXY(xc - 11, -24, 1024, 1024), [b, z1] = UI.mapXY(xc + 11, 24, 1024, 1024);
      x.fillStyle = xc === 0 ? '#ff2bd6' : '#2a3050'; x.fillRect(a, z0, b - a, z1 - z0);
    }
    // special sites
    const sites = [[81, 113, 52, 84, '#f3e600'], [13, 57, 56, 98, '#ff2bd6'], [-34, -14, 52, 66, '#00c080'], [15, 55, -96, -56, '#5ef2ff'], [-59, -11, -80, -52, '#ff8ac8']];
    for (const [a, b2, c2, d, col] of sites) { const [ax, az] = UI.mapXY(a, c2, 1024, 1024), [bx, bz] = UI.mapXY(b2, d, 1024, 1024); x.fillStyle = col; x.globalAlpha = 0.55; x.fillRect(ax, az, bx - ax, bz - az); x.globalAlpha = 1; }
    x.font = '700 22px "Chakra Petch", sans-serif'; x.fillStyle = 'rgba(160,180,255,.55)'; x.textAlign = 'center';
    x.fillText('CORPO PLAZA', ...UI.mapXY(-140, -76, 1024, 1024)); x.fillText('DISTRITO SHINKAI', ...UI.mapXY(-140, -200, 1024, 1024));
    x.fillText('MARGEM SUL · KABUKI', ...UI.mapXY(-140, 80, 1024, 1024)); x.fillText('BAIRRO HIKARI', ...UI.mapXY(-140, 200, 1024, 1024));
    x.fillStyle = 'rgba(94,242,255,.6)'; x.fillText('RIO KURO · 黒川', ...UI.mapXY(-250, 6, 1024, 1024));
    UI.mapBase = c;
  };
  UI.openMap = function () {
    if (!UI.mapBase) UI.buildMap();
    const c = $('mapc'), x = c.getContext('2d');
    x.drawImage(UI.mapBase, 0, 0);
    x.textAlign = 'left'; x.font = '700 26px "Chakra Petch", sans-serif';
    for (const p of NC.pois) {
      const [px, pz] = UI.mapXY(p.x, p.z, 1024, 1024);
      x.fillStyle = '#f3e600'; x.beginPath(); x.arc(px, pz, 7, 0, 7); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#ffffff'; x.shadowColor = '#000'; x.shadowBlur = 6; x.fillText(p.name, px + 11, pz + 6); x.shadowBlur = 0;
    }
    const P = NC.player, [px, pz] = UI.mapXY(P.pos.x, P.pos.z, 1024, 1024);
    x.save(); x.translate(px, pz); x.rotate(-P.yaw); x.fillStyle = '#5ef2ff'; x.shadowColor = '#5ef2ff'; x.shadowBlur = 14;
    x.beginPath(); x.moveTo(0, -16); x.lineTo(10, 12); x.lineTo(0, 6); x.lineTo(-10, 12); x.closePath(); x.fill(); x.restore();
    const list = $('poiList'); list.innerHTML = '';
    for (const p of NC.pois) {
      const b = document.createElement('button'); b.className = 'poi';
      b.innerHTML = `<i>${esc(p.tag || '')}</i><b>${esc(p.name)}</b><span>${esc(p.desc)}</span>`;
      b.addEventListener('click', () => { UI.closeAll(); NC.player.teleport(p.x, p.y, p.z, p.yaw); UI.toast(`Viagem rápida: <b>${esc(p.name)}</b>`); });
      list.appendChild(b);
    }
    UI.open('mapUI');
  };
  UI.drawMinimap = function () {
    if (!UI.mapBase) UI.buildMap();
    const c = $('minimap'), x = c.getContext('2d'), W = c.width, P = NC.player;
    const span = 200; // metres across
    const k = W / span * ((MAPR.x1 - MAPR.x0) / 1024);
    x.save(); x.clearRect(0, 0, W, W);
    x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 1, 0, 7); x.clip();
    x.fillStyle = '#05060c'; x.fillRect(0, 0, W, W);
    x.translate(W / 2, W / 2); x.rotate(P.yaw); x.scale(k, k);
    const [mx, mz] = UI.mapXY(P.pos.x, P.pos.z, 1024, 1024);
    x.drawImage(UI.mapBase, -mx, -mz);
    for (const p of NC.pois) { const [px, pz] = UI.mapXY(p.x, p.z, 1024, 1024); x.fillStyle = '#f3e600'; x.beginPath(); x.arc(px - mx, pz - mz, 4 / k * 2.2, 0, 7); x.fill(); }
    x.restore();
    x.fillStyle = '#5ef2ff'; x.beginPath(); x.moveTo(W / 2, W / 2 - 12); x.lineTo(W / 2 + 8, W / 2 + 9); x.lineTo(W / 2, W / 2 + 4); x.lineTo(W / 2 - 8, W / 2 + 9); x.closePath(); x.fill();
  };

  // ---------------- toasts / subtitles / prompt ----------------
  UI.toast = function (html, ms = 3800) {
    const box = $('toasts');
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
  };
  let sayT = 0;
  UI.say = function (who, text, ms = 5200) {
    const s = $('subtitle'); s.innerHTML = `<b>${esc(who)}:</b> ${esc(text)}`; s.classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => s.classList.remove('on'), ms);
  };
  UI.fade = (on) => $('fade').classList.toggle('on', on);
  UI.togglePhoto = function () {
    const h = $('hud'); h.classList.toggle('photo');
    const on = h.classList.contains('photo');
    $('touch').style.opacity = on ? '0.15' : '';
    if (on) UI.toast('Modo foto: interface escondida. Toque no ícone da câmera para voltar.', 2600);
  };
  let lastLabel = null;
  UI.prompt = function (target, mode) {
    let label = null;
    if (mode === 'sit') label = 'Levantar';
    else if (mode === 'scope') label = 'Sair do binóculo';
    else if (target) label = target.label;
    if (label === lastLabel) return;
    lastLabel = label;
    const p = $('prompt'), u = $('tUse');
    if (label) { $('promptTxt').textContent = label; p.classList.add('on'); u.textContent = label; u.classList.add('on'); }
    else { p.classList.remove('on'); u.classList.remove('on'); }
  };

  // ---------------- HUD ----------------
  let lastZone = '', hudT = 0, miniT = 0;
  UI.hud = function (force, zoneName, dt = 0) {
    hudT += dt; miniT += dt;
    UI.clock += dt / 8;
    if (zoneName && zoneName !== lastZone) { lastZone = zoneName; $('zone').textContent = zoneName; }
    if (force || hudT > 0.5) {
      hudT = 0;
      const m = Math.floor(UI.clock) % (24 * 60), hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
      const P = NC.player, t = NC.U.time.value;
      $('sub').textContent = `${hh}:${mm} · ${NC.settings.rain ? 'chuva · 14°C' : 'nublado · 16°C'} · ${Math.round(P.pos.y)} m`;
      $('money').innerHTML = `₵ <em>${P.money}</em>`;
      const b = [];
      if (P.buffs.energy > t) b.push(`TURBO ${Math.ceil(P.buffs.energy - t)}s`);
      if (P.buffs.jump > t) b.push(`PULO ${Math.ceil(P.buffs.jump - t)}s`);
      if (P.buffs.drunk > t) b.push(`TONTO ${Math.ceil(P.buffs.drunk - t)}s`);
      $('buffs').textContent = b.join(' · ');
    }
    if (miniT > 0.1) { miniT = 0; UI.drawMinimap(); }
  };
})();
