/* Nox City — procedural audio: rain, city hum, sirens, footsteps, UI sfx, club synthwave, lo-fi radio, ambient pad. */
(function () {
  'use strict';
  const NC = window.NC;
  const A = (NC.Audio = { ready: false });
  let ctx, master, comp, amb, sfx;

  function noiseBuffer(sec, type = 'white') {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  const now = () => ctx.currentTime;
  function env(g, t, a, peak, d, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  function src(buf, loop) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
  function filt(type, f, Q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
  function gain(v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  A.init = function () {
    if (A.ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    A.ctx = ctx;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = gain(NC.settings.vol); master.connect(comp); comp.connect(ctx.destination);
    amb = gain(1); amb.connect(master);
    sfx = gain(0.9); sfx.connect(master);
    A.white = noiseBuffer(2.5); A.brown = noiseBuffer(4, 'brown');
    // rain: two layers
    const r1 = src(A.white, true), r2 = src(A.white, true);
    A.rainLP = filt('lowpass', 7000); A.rainGain = gain(0);
    chain(r1, filt('highpass', 500), A.rainLP, A.rainGain, amb);
    A.roarGain = gain(0); chain(r2, filt('lowpass', 900), A.roarGain, amb);
    r1.start(); r2.start(0, 1.1);
    // city rumble
    const c1 = src(A.brown, true); A.cityGain = gain(0); A.cityLP = filt('lowpass', 220);
    chain(c1, A.cityLP, A.cityGain, amb); c1.start();
    // wind at heights
    const w1 = src(A.white, true); A.windBP = filt('bandpass', 400, 0.6); A.windGain = gain(0);
    chain(w1, A.windBP, A.windGain, amb); w1.start(0, 0.5);
    // music buses
    A.clubBus = gain(0); A.clubLP = filt('lowpass', 18000); chain(A.clubBus, A.clubLP, master);
    A.lofiBus = gain(0); A.lofiLP = filt('lowpass', 5200); chain(A.lofiBus, A.lofiLP, master);
    A.padBus = gain(0); chain(A.padBus, master);
    // shared delay for leads
    A.delay = ctx.createDelay(1); A.delay.delayTime.value = 0.36; const fb = gain(0.35);
    A.delay.connect(fb); fb.connect(A.delay); A.delayOut = gain(0.35); A.delay.connect(A.delayOut); A.delayOut.connect(A.clubBus);
    A.ready = true;
    A.nextSiren = now() + 12;
    A.startPad();
    setInterval(A.schedule, 25);
  };
  A.setVolume = (v) => { if (master) master.gain.setTargetAtTime(v, now(), 0.1); };

  // ---------------- one-shots ----------------
  function blip(f, t, d, type = 'sine', vol = 0.2, dest = sfx) {
    const o = ctx.createOscillator(), g = gain(0); o.type = type; o.frequency.value = f;
    chain(o, g, dest); env(g, t, 0.005, vol, d); o.start(t); o.stop(t + d + 0.05);
  }
  function burst(t, d, f, type = 'bandpass', vol = 0.3, Q = 1, dest = sfx) {
    const s = src(A.white), g = gain(0); chain(s, filt(type, f, Q), g, dest); env(g, t, 0.003, vol, d); s.start(t, Math.random() * 2); s.stop(t + d + 0.05);
  }
  A.step = function (wet, hard) {
    if (!A.ready) return; const t = now();
    burst(t, 0.06, hard ? 900 : 600, 'bandpass', 0.12, 1.2);
    blip(70 + Math.random() * 20, t, 0.07, 'sine', 0.12);
    if (wet) burst(t + 0.01, 0.12, 2600, 'highpass', 0.05, 0.5);
  };
  A.land = function () { if (!A.ready) return; const t = now(); blip(60, t, 0.18, 'sine', 0.35); burst(t, 0.15, 400, 'lowpass', 0.25); };
  A.clunk = function () {
    if (!A.ready) return; const t = now();
    blip(90, t + 0.25, 0.2, 'sine', 0.45); burst(t + 0.25, 0.12, 300, 'lowpass', 0.35);
    blip(140, t + 0.55, 0.12, 'triangle', 0.2); burst(t + 0.6, 0.08, 2000, 'bandpass', 0.08, 3);
    burst(t + 1.05, 0.35, 5000, 'highpass', 0.12, 0.4);
  };
  A.buy = function () { if (!A.ready) return; const t = now(); blip(880, t, 0.09, 'square', 0.06); blip(1320, t + 0.08, 0.14, 'square', 0.06); };
  A.ui = function () { if (!A.ready) return; blip(1200, now(), 0.04, 'triangle', 0.05); };
  A.ding = function () { if (!A.ready) return; const t = now(); blip(1046, t, 1.2, 'sine', 0.22); blip(1318, t + 0.18, 1.4, 'sine', 0.2); };
  A.chime = function () {
    if (!A.ready) return; const t = now();
    [76, 72, 67, 72, 74, 79, 0, 74, 76, 74, 67, 72].forEach((m, i) => { if (m) blip(mtof(m), t + i * 0.16, 0.5, 'sine', 0.09); });
  };
  A.door = function () { if (!A.ready) return; const t = now(); burst(t, 0.5, 1500, 'bandpass', 0.05, 0.6); };
  A.whoosh = function (vol = 0.15) {
    if (!A.ready) return; const t = now(); const s = src(A.white), f = filt('bandpass', 300, 1.5), g = gain(0);
    chain(s, f, g, amb); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 1.2); f.frequency.exponentialRampToValueAtTime(250, t + 2.6);
    env(g, t, 1.0, vol, 1.6); s.start(t); s.stop(t + 3);
  };
  A.splash = function () { if (!A.ready) return; const t = now(); burst(t, 0.9, 900, 'lowpass', 0.6); burst(t + 0.05, 0.6, 3000, 'highpass', 0.2); };
  A.piano = function () {
    if (!A.ready) return; const t = now();
    const chords = [[50, 57, 60, 64, 69], [55, 59, 62, 65, 69], [48, 55, 59, 64, 67], [45, 52, 55, 60, 64]];
    const c = chords[Math.floor(Math.random() * chords.length)];
    c.forEach((m, i) => { blip(mtof(m), t + i * 0.035, 2.4, 'triangle', 0.08); blip(mtof(m) * 2, t + i * 0.035, 1.2, 'sine', 0.025); });
  };
  function siren() {
    const t = now(), d = 7, o = ctx.createOscillator(), g = gain(0), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    o.type = 'sawtooth';
    const lfo = ctx.createOscillator(), lg = gain(180); lfo.frequency.value = 0.55; chain(lfo, lg, o.frequency); o.frequency.value = 820;
    const bp = filt('bandpass', 900, 2);
    if (p) { p.pan.value = Math.random() * 2 - 1; chain(o, bp, g, p, amb); } else chain(o, bp, g, amb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); lfo.start(t); o.stop(t + d); lfo.stop(t + d);
  }

  // ---------------- ambient pad ----------------
  A.startPad = function () {
    const voices = [];
    for (let i = 0; i < 4; i++) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = o2.type = 'sawtooth';
      const f = filt('lowpass', 700, 0.8), g = gain(0.05);
      o2.detune.value = 9; o1.detune.value = -7;
      o1.connect(f); o2.connect(f); chain(f, g, A.padBus); o1.start(); o2.start();
      const lfo = ctx.createOscillator(), lg = gain(260); lfo.frequency.value = 0.05 + i * 0.013; chain(lfo, lg, f.frequency); lfo.start();
      voices.push([o1, o2]);
    }
    const chords = [[38, 50, 57, 64], [34, 46, 53, 62], [41, 48, 57, 65], [36, 48, 55, 62]];
    let k = 0;
    const next = () => {
      const c = chords[k++ % chords.length], t = now();
      voices.forEach((v, i) => v.forEach((o) => o.frequency.setTargetAtTime(mtof(c[i]), t, 1.5)));
      setTimeout(next, 9000);
    };
    next();
  };

  // ---------------- sequencers ----------------
  const club = { bpm: 122, step: 0, next: 0, on: false };
  const lofi = { bpm: 78, step: 0, next: 0, on: false };
  A.club = club; A.lofi = lofi;
  NC.music = { bpm: club.bpm };
  const CLUB_PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const LOFI_PROG = [[50, 53, 57, 60, 64], [55, 59, 62, 65, 69], [48, 52, 55, 59, 62], [45, 48, 52, 55, 60]]; // Dm9 G13 Cmaj9 Am9

  function kick(t, dest, v = 0.9) { const o = ctx.createOscillator(), g = gain(0); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); chain(o, g, dest); env(g, t, 0.002, v, 0.32); o.start(t); o.stop(t + 0.4); }
  function snare(t, dest, v = 0.35, f = 1600) { const s = src(A.white), g = gain(0); chain(s, filt('bandpass', f, 0.9), g, dest); env(g, t, 0.002, v, 0.16); s.start(t, Math.random()); s.stop(t + 0.25); }
  function hat(t, dest, v = 0.12, d = 0.04) { const s = src(A.white), g = gain(0); chain(s, filt('highpass', 7500), g, dest); env(g, t, 0.001, v, d); s.start(t, Math.random()); s.stop(t + d + 0.05); }
  function bass(t, m, dest, d = 0.2, v = 0.35) {
    const o = ctx.createOscillator(), f = filt('lowpass', 300, 6), g = gain(0); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(180, t + d);
    chain(o, f, g, dest); env(g, t, 0.004, v, d); o.start(t); o.stop(t + d + 0.05);
  }
  function pluck(t, m, dest, d = 0.25, v = 0.08, type = 'square') {
    const o = ctx.createOscillator(), f = filt('lowpass', 2600, 2), g = gain(0); o.type = type; o.frequency.value = mtof(m);
    chain(o, f, g, dest); env(g, t, 0.003, v, d); o.start(t); o.stop(t + d + 0.05);
    const sendG = gain(0.5); g.connect(sendG); sendG.connect(A.delay);
  }
  function pad(t, notes, dest, d, v = 0.03) {
    for (const m of notes) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = filt('lowpass', 1400), g = gain(0); o.type = o2.type = 'sawtooth';
      o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 1.004;
      o.connect(f); o2.connect(f); chain(f, g, dest);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.4); g.gain.setValueAtTime(v, t + d - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    }
  }
  function ep(t, m, dest, d = 1.6, v = 0.05) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = gain(0); o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 2.001; const g2 = gain(0.25);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest); env(g, t, 0.01, v, d); o.start(t); o2.start(t); o.stop(t + d + 0.1); o2.stop(t + d + 0.1);
  }

  function schedClub(t, s) {
    const bar = Math.floor(s / 16), st = s % 16, chord = CLUB_PROG[bar % 4];
    const sec = Math.floor(bar / 8) % 4;
    const B = A.clubBus;
    if (st % 4 === 0) kick(t, B);
    if (st === 4 || st === 12) snare(t, B, 0.3);
    if (st % 2 === 1) hat(t, B, 0.09); else if (sec > 0) hat(t, B, 0.04, 0.02);
    if (st % 4 === 2) bass(t, chord[0] - 24, B, 0.22, 0.32);
    if (st % 4 === 3 && sec !== 2) bass(t, chord[0] - 12, B, 0.12, 0.18);
    if (st === 0) pad(t, chord, B, (60 / club.bpm) * 4, 0.022);
    if (sec >= 1) { const arp = [0, 1, 2, 1, 2, 0, 2, 1]; if (st % 2 === 0) pluck(t, chord[arp[(st / 2) % 8]] + 12, B, 0.18, 0.05); }
  }
  function schedLofi(t, s) {
    const bar = Math.floor(s / 16), st = s % 16, chord = LOFI_PROG[bar % 4], B = A.lofiBus;
    const sw = st % 2 === 1 ? (60 / lofi.bpm / 4) * 0.28 : 0;
    if (st === 0 || st === 10) kick(t, B, 0.5);
    if (st === 4 || st === 12) snare(t, B, 0.18, 1100);
    if (st % 2 === 0) hat(t + sw, B, 0.04, 0.03);
    if (st === 0) chord.forEach((m, i) => ep(t + i * 0.02, m, B, 2.6, 0.035));
    if (st === 8 && Math.random() < 0.6) ep(t, chord[chord.length - 1] + 12, B, 1.2, 0.03);
    if (st === 0 || st === 6 || st === 12) bass(t, chord[0] - 12, B, 0.4, 0.14);
    if (Math.random() < 0.3) burst(t, 0.01, 6000, 'highpass', 0.02, 0.5, B);
  }
  A.schedule = function () {
    if (!A.ready) return;
    const ahead = now() + 0.12;
    for (const seq of [club, lofi]) {
      if (!seq.on) { seq.next = now() + 0.05; continue; }
      const dur = 60 / seq.bpm / 4;
      while (seq.next < ahead) { (seq === club ? schedClub : schedLofi)(seq.next, seq.step); seq.step++; seq.next += dur; }
    }
    if (now() > A.nextSiren) { siren(); A.nextSiren = now() + 30 + Math.random() * 50; }
  };

  // ---------------- radio ----------------
  A.radio = { on: false, x: 0, y: 0, z: 0 };
  A.toggleRadio = function (x, y, z) {
    A.radio.on = !A.radio.on; Object.assign(A.radio, { x, y, z });
    NC.UI.toast(A.radio.on ? 'Rádio ligado: <b>NOX FM 77.7</b> · lo-fi para noites chuvosas' : 'Rádio desligado.');
  };

  // ---------------- per-frame mix ----------------
  A.update = function (p, zone, dt) {
    if (!A.ready) return;
    const t = now();
    const indoor = zone && zone.indoor;
    const rainOn = NC.settings.rain;
    const high = Math.max(0, (p.y - 20) / 180);
    A.rainGain.gain.setTargetAtTime(rainOn ? (indoor ? 0.05 : 0.2) : 0, t, 0.3);
    A.roarGain.gain.setTargetAtTime(rainOn ? (indoor ? 0.06 : 0.14) : 0, t, 0.3);
    A.rainLP.frequency.setTargetAtTime(indoor ? 700 : 7000, t, 0.2);
    A.cityGain.gain.setTargetAtTime((indoor ? 0.12 : 0.32) * (1 - Math.min(0.7, high)), t, 0.4);
    A.windGain.gain.setTargetAtTime(indoor ? 0 : Math.min(0.3, high * 0.35), t, 0.5);
    A.windBP.frequency.setTargetAtTime(300 + Math.sin(t * 0.3) * 120, t, 0.5);
    A.padBus.gain.setTargetAtTime(NC.settings.music && !(zone && zone.music) ? 0.5 : 0, t, 1.0);
    // club
    const cc = NC.Interiors.clubCenter;
    const dClub = cc ? Math.hypot(p.x - cc.x, p.z - cc.z) : 1e9;
    const inClub = zone && zone.music === 'club';
    club.on = dClub < 110;
    A.clubBus.gain.setTargetAtTime(inClub ? 0.55 : Math.max(0, 0.32 * (1 - dClub / 90)), t, 0.25);
    A.clubLP.frequency.setTargetAtTime(inClub ? 18000 : 420, t, 0.2);
    // lofi: radio on the rooftop or the lounge
    const inLounge = zone && zone.music === 'lounge';
    const dr = A.radio.on ? Math.hypot(p.x - A.radio.x, p.y - A.radio.y, p.z - A.radio.z) : 1e9;
    lofi.on = inLounge || dr < 45;
    A.lofiBus.gain.setTargetAtTime(inLounge ? 0.5 : Math.max(0, 0.6 * (1 - dr / 40)), t, 0.3);
    A.lofiLP.frequency.setTargetAtTime(inLounge ? 9000 : 3800, t, 0.3);
  };
  // beat clock for visuals (works without audio too)
  A.beat = function (time) {
    if (A.ready && club.on) {
      const spb = 60 / club.bpm, s = (club.step / 4) - (club.next - now()) / spb;
      return s;
    }
    return time * club.bpm / 60;
  };
})();
