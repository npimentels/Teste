/* Nox City — procedural canvas textures: ads, sign atlas, vending fronts, env map, sprites. */
(function () {
  'use strict';
  const NC = window.NC;
  const T = (NC.T = {});
  const JP = '"Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif';
  const DISP = '"Chakra Petch","Arial Narrow",Arial,sans-serif';
  T.JP = JP; T.DISP = DISP;

  T.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  T.tex = (c, o = {}) => {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = o.aniso || 4;
    if (o.repeat) { t.wrapS = THREE.RepeatWrapping; }
    if (o.nomip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
    t.needsUpdate = true;
    return t;
  };
  const rnd = NC.mulberry32(77);
  const rr = (a, b) => a + (b - a) * rnd();

  // neon text with glow
  T.neon = (ctx, text, x, y, font, color, glow = 18, core = '#ffffff', coreAlpha = 0.55) => {
    ctx.save();
    ctx.font = font; ctx.textAlign = ctx.textAlign || 'center';
    ctx.shadowColor = color; ctx.fillStyle = color;
    ctx.shadowBlur = glow; ctx.fillText(text, x, y);
    ctx.shadowBlur = glow * 0.4; ctx.fillText(text, x, y);
    ctx.shadowBlur = 0; ctx.globalAlpha = coreAlpha; ctx.fillStyle = core; ctx.fillText(text, x, y);
    ctx.restore();
  };
  const scanlines = (ctx, w, h, a = 0.09, step = 4) => {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, step / 2);
    ctx.restore();
  };
  const glitchSlices = (ctx, w, h, n = 6) => {
    for (let i = 0; i < n; i++) {
      const y = rr(0, h), hh = rr(3, 18), dx = rr(-30, 30);
      try { const img = ctx.getImageData(0, y, w, hh); ctx.putImageData(img, dx, y); } catch (e) {}
    }
  };

  // ---------- sprites ----------
  T.glow = (() => {
    const c = T.canvas(64, 64), x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return T.tex(c);
  })();
  T.pool = (() => {
    const c = T.canvas(128, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return T.tex(c);
  })();
  T.smoke = (() => {
    const c = T.canvas(64, 64), x = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const px = 32 + rr(-10, 10), py = 32 + rr(-10, 10), r = rr(10, 22);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    }
    return T.tex(c);
  })();
  // vertical gradient used for beams and streaks
  T.beam = (() => {
    const c = T.canvas(8, 128), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.2, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.fillRect(0, 0, 8, 128);
    return T.tex(c, { nomip: true });
  })();

  // ---------- environment (equirect) for wet reflections fallback ----------
  T.env = (() => {
    const W = 512, H = 256, c = T.canvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05050c'); g.addColorStop(0.32, '#140a2a'); g.addColorStop(0.47, '#4a1650'); g.addColorStop(0.5, '#2a0c33'); g.addColorStop(1, '#040308');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const cols = ['#ff2bd6', '#5ef2ff', '#f3e600', '#ff6a3d', '#8a5cff', '#ffffff', '#ff3b4e'];
    for (let i = 0; i < 160; i++) {
      const cx = rr(0, W), w = rr(2, 14), top = rr(H * 0.22, H * 0.47), h = H * 0.5 - top;
      x.fillStyle = cols[Math.floor(rr(0, cols.length))]; x.globalAlpha = rr(0.25, 0.9);
      x.fillRect(cx, top, w, h * rr(0.15, 0.6));
    }
    x.globalAlpha = 1;
    // soften: the env is only used for blurry wet reflections
    const b = T.canvas(W, H), bx = b.getContext('2d');
    bx.filter = 'blur(10px)'; bx.drawImage(c, 0, 0); bx.drawImage(c, -W, 0); bx.drawImage(c, W, 0); bx.filter = 'none';
    bx.globalAlpha = 0.35; bx.fillStyle = '#1a0c2a'; bx.fillRect(0, 0, W, H); bx.globalAlpha = 1;
    const t = T.tex(b, { repeat: true });
    return t;
  })();

  // ---------- noise texture (for misc surfaces) ----------
  T.noise = (() => {
    const N = 128, c = T.canvas(N, N), x = c.getContext('2d'), d = x.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { const v = 90 + rr(0, 165); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    const t = T.tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();

  // ---------- ADS ----------
  function bgGrad(x, w, h, stops) {
    const g = x.createLinearGradient(0, 0, 0, h);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  function rings(x, cx, cy, r0, n, color, a = 0.5) {
    x.save(); x.strokeStyle = color; x.globalAlpha = a; x.lineWidth = 2; x.shadowColor = color; x.shadowBlur = 10;
    for (let i = 0; i < n; i++) { x.beginPath(); x.arc(cx, cy, r0 + i * 26, rr(0, 3), rr(3.5, 6.28)); x.stroke(); }
    x.restore();
  }
  function circuits(x, cx, cy, n, color) {
    x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = 2; x.shadowColor = color; x.shadowBlur = 8;
    for (let i = 0; i < n; i++) {
      let px = cx + rr(-40, 40), py = cy + rr(-40, 40);
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 3; k++) { if (rnd() < 0.5) px += rr(-40, 40); else py += rr(-40, 40); x.lineTo(px, py); }
      x.stroke(); x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill();
    }
    x.restore();
  }
  function face(x, cx, cy, s, skinA, skinB, hair, accent) {
    // shoulders
    x.save();
    const sg = x.createLinearGradient(cx - 220 * s, 0, cx + 220 * s, 0);
    sg.addColorStop(0, '#120624'); sg.addColorStop(0.5, '#2b0e46'); sg.addColorStop(1, '#0a0418');
    x.fillStyle = sg;
    x.beginPath(); x.moveTo(cx - 250 * s, cy + 480 * s);
    x.bezierCurveTo(cx - 230 * s, cy + 290 * s, cx - 120 * s, cy + 250 * s, cx - 50 * s, cy + 230 * s);
    x.lineTo(cx + 50 * s, cy + 230 * s);
    x.bezierCurveTo(cx + 120 * s, cy + 250 * s, cx + 230 * s, cy + 290 * s, cx + 250 * s, cy + 480 * s);
    x.closePath(); x.fill();
    x.strokeStyle = accent; x.lineWidth = 3 * s; x.shadowColor = accent; x.shadowBlur = 14;
    x.beginPath(); x.moveTo(cx - 200 * s, cy + 330 * s); x.quadraticCurveTo(cx - 90 * s, cy + 280 * s, cx - 30 * s, cy + 320 * s); x.stroke();
    x.beginPath(); x.moveTo(cx + 200 * s, cy + 330 * s); x.quadraticCurveTo(cx + 90 * s, cy + 280 * s, cx + 30 * s, cy + 320 * s); x.stroke();
    x.shadowBlur = 0;
    // neck
    const ng = x.createLinearGradient(cx - 40 * s, 0, cx + 40 * s, 0); ng.addColorStop(0, skinB); ng.addColorStop(0.6, skinA); ng.addColorStop(1, skinB);
    x.fillStyle = ng; x.fillRect(cx - 38 * s, cy + 110 * s, 76 * s, 140 * s);
    // hair back
    x.fillStyle = hair;
    x.beginPath(); x.ellipse(cx, cy - 20 * s, 150 * s, 175 * s, 0, 0, 7); x.fill();
    x.beginPath(); x.moveTo(cx - 150 * s, cy - 10 * s); x.bezierCurveTo(cx - 190 * s, cy + 160 * s, cx - 170 * s, cy + 300 * s, cx - 110 * s, cy + 330 * s);
    x.lineTo(cx + 110 * s, cy + 330 * s); x.bezierCurveTo(cx + 170 * s, cy + 300 * s, cx + 190 * s, cy + 160 * s, cx + 150 * s, cy - 10 * s); x.fill();
    // face
    const fg = x.createLinearGradient(cx - 110 * s, 0, cx + 110 * s, 0);
    fg.addColorStop(0, skinA); fg.addColorStop(0.55, skinA); fg.addColorStop(1, skinB);
    x.fillStyle = fg;
    x.beginPath(); x.moveTo(cx, cy - 150 * s);
    x.bezierCurveTo(cx + 95 * s, cy - 150 * s, cx + 112 * s, cy - 40 * s, cx + 100 * s, cy + 40 * s);
    x.bezierCurveTo(cx + 85 * s, cy + 120 * s, cx + 35 * s, cy + 165 * s, cx, cy + 168 * s);
    x.bezierCurveTo(cx - 35 * s, cy + 165 * s, cx - 85 * s, cy + 120 * s, cx - 100 * s, cy + 40 * s);
    x.bezierCurveTo(cx - 112 * s, cy - 40 * s, cx - 95 * s, cy - 150 * s, cx, cy - 150 * s); x.fill();
    // fringe
    x.fillStyle = hair;
    x.beginPath(); x.moveTo(cx - 120 * s, cy - 40 * s); x.bezierCurveTo(cx - 110 * s, cy - 190 * s, cx + 60 * s, cy - 210 * s, cx + 125 * s, cy - 70 * s);
    x.bezierCurveTo(cx + 40 * s, cy - 120 * s, cx - 30 * s, cy - 90 * s, cx - 120 * s, cy - 40 * s); x.fill();
    // hair strands highlights
    x.strokeStyle = accent; x.globalAlpha = 0.6; x.lineWidth = 2 * s;
    for (let i = 0; i < 14; i++) {
      const sx = cx + rr(-150, 150) * s; x.beginPath(); x.moveTo(sx, cy - 140 * s);
      x.bezierCurveTo(sx + rr(-40, 40) * s, cy, sx + rr(-50, 50) * s, cy + 150 * s, sx + rr(-30, 30) * s, cy + 320 * s); x.stroke();
    }
    x.globalAlpha = 1;
    // eyes
    for (const sgn of [-1, 1]) {
      const ex = cx + sgn * 42 * s, ey = cy - 5 * s;
      x.fillStyle = '#0a0612';
      x.beginPath(); x.moveTo(ex - 30 * s, ey); x.quadraticCurveTo(ex, ey - 20 * s, ex + 30 * s, ey - 2 * s); x.quadraticCurveTo(ex, ey + 14 * s, ex - 30 * s, ey); x.fill();
      x.fillStyle = accent; x.shadowColor = accent; x.shadowBlur = 16;
      x.beginPath(); x.arc(ex + 2 * s, ey - 2 * s, 8 * s, 0, 7); x.fill();
      x.shadowBlur = 0; x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 4 * s, ey - 5 * s, 2.5 * s, 0, 7); x.fill();
      x.strokeStyle = '#1a0a22'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(ex - 34 * s, ey - 26 * s); x.quadraticCurveTo(ex, ey - 40 * s, ex + 32 * s, ey - 28 * s); x.stroke();
    }
    // nose & lips
    x.strokeStyle = 'rgba(40,10,50,.5)'; x.lineWidth = 2 * s;
    x.beginPath(); x.moveTo(cx + 4 * s, cy + 10 * s); x.quadraticCurveTo(cx + 12 * s, cy + 55 * s, cx - 6 * s, cy + 62 * s); x.stroke();
    const lg = x.createLinearGradient(0, cy + 85 * s, 0, cy + 115 * s); lg.addColorStop(0, '#ff2a8a'); lg.addColorStop(1, '#a0105a');
    x.fillStyle = lg;
    x.beginPath(); x.moveTo(cx - 34 * s, cy + 98 * s); x.quadraticCurveTo(cx, cy + 82 * s, cx + 34 * s, cy + 98 * s); x.quadraticCurveTo(cx, cy + 122 * s, cx - 34 * s, cy + 98 * s); x.fill();
    // cyberware lines on cheek
    x.strokeStyle = accent; x.lineWidth = 2 * s; x.shadowColor = accent; x.shadowBlur = 10;
    x.beginPath(); x.moveTo(cx + 60 * s, cy + 20 * s); x.lineTo(cx + 80 * s, cy + 50 * s); x.lineTo(cx + 80 * s, cy + 100 * s); x.stroke();
    x.beginPath(); x.arc(cx + 80 * s, cy + 104 * s, 4 * s, 0, 7); x.stroke();
    x.restore();
  }

  const ADS = [];
  function ad(name, w, h, draw) { const c = T.canvas(w, h), x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; draw(x, w, h); ADS.push({ name, canvas: c, aspect: w / h }); }

  T.buildAds = function () {
    ADS.length = 0;
    // 0: Hyperion portrait — BETTER TOMORROW
    ad('hyperion', 512, 1280, (x, w, h) => {
      bgGrad(x, w, h, ['#160626', '#3a0b4a', '#7a1066', '#ff2bd6']);
      const rg = x.createRadialGradient(256, 450, 30, 256, 450, 330); rg.addColorStop(0, 'rgba(255,90,220,.55)'); rg.addColorStop(1, 'rgba(255,90,220,0)');
      x.fillStyle = rg; x.fillRect(0, 0, w, h);
      rings(x, 256, 440, 210, 4, '#5ef2ff', 0.45);
      face(x, 256, 430, 1, '#ffc0ee', '#8a2fa8', '#1a0830', '#5ef2ff');
      circuits(x, 120, 300, 5, '#5ef2ff');
      T.neon(x, 'BETTER', 256, 905, `700 108px ${DISP}`, '#ff4fd8', 24);
      T.neon(x, 'TOMORROW', 256, 1005, `700 84px ${DISP}`, '#ff4fd8', 24);
      x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(256, 1140, 34, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(256, 1106); x.lineTo(256, 1174); x.moveTo(226, 1124); x.lineTo(286, 1158); x.moveTo(286, 1124); x.lineTo(226, 1158); x.stroke();
      T.neon(x, 'HYPERION', 256, 1220, `700 46px ${DISP}`, '#ffffff', 12);
      scanlines(x, w, h, 0.12);
      glitchSlices(x, w, h, 5);
    });
    // 1: Vanta optics
    ad('vanta', 512, 1280, (x, w, h) => {
      bgGrad(x, w, h, ['#05081e', '#1a1060', '#4a1a9a', '#160830']);
      const rg = x.createRadialGradient(256, 520, 40, 256, 520, 380); rg.addColorStop(0, 'rgba(120,90,255,.6)'); rg.addColorStop(1, 'rgba(60,20,180,0)');
      x.fillStyle = rg; x.fillRect(0, 0, w, h);
      // armored figure
      x.fillStyle = '#0b0b24';
      x.beginPath(); x.moveTo(40, 1050); x.bezierCurveTo(60, 760, 160, 700, 256, 690); x.bezierCurveTo(352, 700, 452, 760, 472, 1050); x.fill();
      x.beginPath(); x.ellipse(256, 520, 120, 150, 0, 0, 7); x.fill();
      x.strokeStyle = '#7ad8ff'; x.lineWidth = 3; x.shadowColor = '#7ad8ff'; x.shadowBlur = 18;
      x.beginPath(); x.ellipse(256, 520, 120, 150, 0, 0, 7); x.stroke();
      x.fillStyle = '#9ff0ff'; x.beginPath(); x.moveTo(150, 500); x.lineTo(362, 500); x.lineTo(340, 545); x.lineTo(172, 545); x.closePath(); x.fill();
      x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(120 + i * 18, 760 + i * 30); x.lineTo(392 - i * 18, 760 + i * 30); x.stroke(); }
      x.shadowBlur = 0;
      x.save(); x.translate(70, 160); x.textAlign = 'center';
      for (const [i, ch] of ['ヴ', 'ァ', 'ン', 'タ'].entries()) T.neon(x, ch, 0, i * 70, `900 60px ${JP}`, '#c78bff', 14);
      x.restore();
      T.neon(x, 'VANTA', 256, 1110, `700 104px ${DISP}`, '#8fd8ff', 20);
      T.neon(x, 'SEE FURTHER', 256, 1200, `600 50px ${DISP}`, '#ffffff', 10);
      scanlines(x, w, h, 0.12);
      glitchSlices(x, w, h, 4);
    });
    // 2: Kurogane — yellow arms
    ad('kurogane', 512, 768, (x, w, h) => {
      x.fillStyle = '#0c0b05'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#f3e600'; x.lineWidth = 10; x.strokeRect(18, 18, w - 36, h - 36);
      x.fillStyle = '#f3e600'; x.shadowColor = '#f3e600'; x.shadowBlur = 20;
      x.beginPath(); x.moveTo(256, 110); x.lineTo(380, 330); x.lineTo(256, 290); x.lineTo(132, 330); x.closePath(); x.fill();
      x.fillRect(196, 340, 120, 20);
      x.shadowBlur = 0;
      T.neon(x, 'KUROGANE', 256, 450, `700 78px ${DISP}`, '#f3e600', 16);
      x.fillStyle = '#f3e600';
      x.font = `600 40px ${DISP}`; x.fillText('STRONGER', 256, 545); x.fillText('SAFER', 256, 595); x.fillText('BRIGHTER', 256, 645);
      scanlines(x, w, h, 0.1);
    });
    // 3: NEO 77
    ad('neo77', 512, 768, (x, w, h) => {
      bgGrad(x, w, h, ['#1a0208', '#3a0414', '#140106']);
      T.neon(x, 'NEO', 256, 230, `700 170px ${DISP}`, '#ff3b4e', 30);
      T.neon(x, '77', 256, 450, `700 260px ${DISP}`, '#ff2bd6', 34);
      T.neon(x, 'ネオ七十七', 256, 640, `900 62px ${JP}`, '#ff8aa0', 12);
      scanlines(x, w, h, 0.12);
    });
    // 4: Skull — BIGGER FASTER STRONGER
    ad('skull', 512, 1024, (x, w, h) => {
      bgGrad(x, w, h, ['#22062e', '#46104e', '#1a0420']);
      x.strokeStyle = '#ff59d6'; x.fillStyle = 'rgba(255,89,214,.18)'; x.lineWidth = 7; x.shadowColor = '#ff59d6'; x.shadowBlur = 26;
      x.beginPath(); x.arc(256, 330, 160, Math.PI * 0.9, Math.PI * 2.1); x.lineTo(380, 470); x.lineTo(330, 520); x.lineTo(182, 520); x.lineTo(132, 470); x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#12021a';
      x.beginPath(); x.ellipse(196, 360, 46, 40, 0.2, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.ellipse(316, 360, 46, 40, -0.2, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(256, 410); x.lineTo(236, 455); x.lineTo(276, 455); x.closePath(); x.fill(); x.stroke();
      for (let i = 0; i < 6; i++) x.strokeRect(190 + i * 22, 520, 20, 44);
      x.fillStyle = '#5ef2ff'; x.beginPath(); x.arc(196, 360, 10, 0, 7); x.arc(316, 360, 10, 0, 7); x.fill();
      x.shadowBlur = 0;
      T.neon(x, 'BIGGER', 256, 690, `700 96px ${DISP}`, '#ff59d6', 22);
      T.neon(x, 'FASTER', 256, 790, `700 96px ${DISP}`, '#ff59d6', 22);
      T.neon(x, 'STRONGER', 256, 890, `700 84px ${DISP}`, '#ff59d6', 22);
      scanlines(x, w, h, 0.12); glitchSlices(x, w, h, 4);
    });
    // 5: Jinguji — orange monk
    ad('jinguji', 512, 1024, (x, w, h) => {
      bgGrad(x, w, h, ['#140802', '#2a1004', '#140602']);
      x.strokeStyle = '#ff9a2a'; x.lineWidth = 6; x.shadowColor = '#ff9a2a'; x.shadowBlur = 22;
      x.strokeRect(30, 30, w - 60, h - 60);
      x.beginPath(); x.arc(256, 260, 70, 0, 7); x.stroke();
      x.beginPath(); x.moveTo(140, 600); x.bezierCurveTo(150, 380, 362, 380, 372, 600); x.stroke();
      x.beginPath(); x.moveTo(110, 640); x.quadraticCurveTo(256, 560, 402, 640); x.stroke();
      x.beginPath(); x.moveTo(200, 430); x.lineTo(150, 520); x.lineTo(256, 560); x.lineTo(362, 520); x.lineTo(312, 430); x.stroke();
      x.shadowBlur = 0;
      T.neon(x, 'JINGUJI', 256, 760, `700 90px ${DISP}`, '#ffb24a', 20);
      T.neon(x, '神宮寺', 256, 880, `900 100px ${JP}`, '#ff8a1a', 20);
      scanlines(x, w, h, 0.1);
    });
    // 6: Synth Cola
    ad('cola', 768, 512, (x, w, h) => {
      bgGrad(x, w, h, ['#3a0006', '#8a0010', '#2a0004']);
      x.save(); x.translate(560, 260); x.rotate(0.18);
      const cg = x.createLinearGradient(-70, 0, 70, 0); cg.addColorStop(0, '#5a0008'); cg.addColorStop(0.4, '#ff3a3a'); cg.addColorStop(0.6, '#ffd0d0'); cg.addColorStop(1, '#600008');
      x.fillStyle = cg; x.fillRect(-70, -170, 140, 340);
      x.fillStyle = '#ddd'; x.fillRect(-60, -186, 120, 18); x.fillRect(-60, 168, 120, 14);
      x.fillStyle = '#fff'; x.font = `700 44px ${DISP}`; x.save(); x.rotate(-Math.PI / 2); x.fillText('SYNTH', 0, -10); x.restore();
      x.restore();
      x.textAlign = 'left';
      T.neon(x, 'SYNTH', 40, 150, `700 120px ${DISP}`, '#ffffff', 16);
      T.neon(x, 'COLA', 40, 270, `700 120px ${DISP}`, '#ff4a5a', 22);
      x.fillStyle = '#ffd0d0'; x.font = `600 34px ${DISP}`; x.fillText('o sabor do amanhã', 44, 360);
      T.neon(x, 'シンセ・コーラ', 40, 430, `900 40px ${JP}`, '#ffb0b0', 8);
      x.textAlign = 'center';
      scanlines(x, w, h, 0.08);
    });
    // 7: Zenkai energy
    ad('zenkai', 768, 512, (x, w, h) => {
      bgGrad(x, w, h, ['#011a10', '#023a1c', '#000d06']);
      x.fillStyle = '#7dff4a'; x.shadowColor = '#7dff4a'; x.shadowBlur = 30;
      x.beginPath(); x.moveTo(600, 40); x.lineTo(500, 260); x.lineTo(590, 260); x.lineTo(520, 470); x.lineTo(700, 210); x.lineTo(610, 210); x.lineTo(680, 40); x.closePath(); x.fill();
      x.shadowBlur = 0; x.textAlign = 'left';
      T.neon(x, 'ZENKAI', 40, 190, `700 130px ${DISP}`, '#9dff6a', 22);
      T.neon(x, 'ENERGY', 46, 300, `700 70px ${DISP}`, '#ffffff', 10);
      T.neon(x, '全開', 46, 410, `900 80px ${JP}`, '#7dff4a', 16);
      x.textAlign = 'center';
      scanlines(x, w, h, 0.08);
    });
    // 8: Club Voltage
    ad('voltage', 768, 512, (x, w, h) => {
      bgGrad(x, w, h, ['#0a0420', '#24085a', '#08021a']);
      x.strokeStyle = '#5ef2ff'; x.lineWidth = 4; x.shadowColor = '#5ef2ff'; x.shadowBlur = 16;
      x.beginPath(); for (let i = 0; i <= 96; i++) { const px = 40 + i * 7.1, py = 400 + Math.sin(i * 0.5) * 40 * Math.sin(i * 0.07); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
      x.shadowBlur = 0;
      T.neon(x, 'VOLTAGE', 384, 200, `700 150px ${DISP}`, '#ff2bd6', 30);
      T.neon(x, 'CLUB · ABERTO ATÉ O SOL NASCER', 384, 300, `600 34px ${DISP}`, '#5ef2ff', 10);
      scanlines(x, w, h, 0.1);
    });
    // 9: Mirai Bank
    ad('mirai', 512, 1024, (x, w, h) => {
      bgGrad(x, w, h, ['#001018', '#002838', '#00080e']);
      x.strokeStyle = '#3ff0ff'; x.lineWidth = 5; x.shadowColor = '#3ff0ff'; x.shadowBlur = 20;
      for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(256, 330, 60 + i * 34, -Math.PI * 0.8 + i * 0.3, Math.PI * 0.2 + i * 0.3); x.stroke(); }
      x.shadowBlur = 0;
      T.neon(x, 'MIRAI', 256, 640, `700 120px ${DISP}`, '#9ff8ff', 22);
      T.neon(x, 'BANK', 256, 740, `600 60px ${DISP}`, '#ffffff', 8);
      T.neon(x, '未来銀行', 256, 860, `900 70px ${JP}`, '#3ff0ff', 14);
      scanlines(x, w, h, 0.1);
    });
    // 10: Oni mask (red neon) — rooftop sign
    ad('oni', 512, 640, (x, w, h) => {
      x.fillStyle = '#080204'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#ff2030'; x.lineWidth = 7; x.shadowColor = '#ff2030'; x.shadowBlur = 24; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(150, 180); x.lineTo(110, 60); x.lineTo(200, 150); x.stroke();
      x.beginPath(); x.moveTo(362, 180); x.lineTo(402, 60); x.lineTo(312, 150); x.stroke();
      x.beginPath(); x.moveTo(256, 120); x.bezierCurveTo(400, 120, 420, 260, 400, 330); x.bezierCurveTo(380, 430, 320, 480, 256, 480); x.bezierCurveTo(192, 480, 132, 430, 112, 330); x.bezierCurveTo(92, 260, 112, 120, 256, 120); x.stroke();
      x.beginPath(); x.moveTo(150, 270); x.lineTo(230, 300); x.lineTo(160, 320); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(362, 270); x.lineTo(282, 300); x.lineTo(352, 320); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(170, 390); x.quadraticCurveTo(256, 450, 342, 390); x.stroke();
      x.beginPath(); x.moveTo(200, 400); x.lineTo(210, 440); x.lineTo(222, 408); x.moveTo(312, 400); x.lineTo(302, 440); x.lineTo(290, 408); x.stroke();
      x.beginPath(); x.moveTo(170, 200); x.quadraticCurveTo(256, 170, 342, 200); x.stroke();
      x.shadowBlur = 0;
      T.neon(x, 'RONIN', 256, 570, `700 92px ${DISP}`, '#ff2030', 26, '#ffd0d0', 0.4);
    });
    // 11: Ramen ad
    ad('ramenad', 768, 512, (x, w, h) => {
      bgGrad(x, w, h, ['#200800', '#3a1000', '#100400']);
      x.strokeStyle = '#ffcf6a'; x.lineWidth = 6; x.shadowColor = '#ffb030'; x.shadowBlur = 20;
      x.beginPath(); x.arc(560, 300, 140, 0, Math.PI); x.closePath(); x.stroke();
      for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(520 + i * 40, 140); x.bezierCurveTo(500 + i * 40, 100, 560 + i * 40, 80, 530 + i * 40, 40); x.stroke(); }
      x.beginPath(); x.moveTo(480, 120); x.lineTo(700, 250); x.moveTo(500, 100); x.lineTo(710, 235); x.stroke();
      x.shadowBlur = 0; x.textAlign = 'left';
      T.neon(x, '月', 50, 200, `900 170px ${JP}`, '#ffcf6a', 22);
      T.neon(x, 'TSUKI', 230, 170, `700 90px ${DISP}`, '#ffffff', 10);
      T.neon(x, 'RAMEN', 230, 260, `700 90px ${DISP}`, '#ff8a3a', 18);
      x.fillStyle = '#ffcf9a'; x.font = `600 30px ${DISP}`; x.fillText('na beira do rio · 24h', 56, 400);
      x.textAlign = 'center';
      scanlines(x, w, h, 0.08);
    });
    return ADS;
  };
  T.ads = ADS;
  T.adByName = (n) => ADS.find((a) => a.name === n);

  // ---------- scrolling LED band ----------
  T.ledBand = function (text, color = '#ff2bd6') {
    const c = T.canvas(2048, 128), x = c.getContext('2d');
    x.fillStyle = '#0a0210'; x.fillRect(0, 0, 2048, 128);
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.font = `900 76px ${JP}`;
    x.shadowColor = color; x.shadowBlur = 18; x.fillStyle = color;
    let px = 20;
    while (px < 2048) { x.fillText(text, px, 66); px += x.measureText(text).width + 60; }
    // dot-matrix mask
    x.shadowBlur = 0; x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 0; i < 2048; i += 6) x.fillRect(i, 0, 2, 128);
    for (let j = 0; j < 128; j += 6) x.fillRect(0, j, 2048, 2);
    x.globalCompositeOperation = 'source-over';
    return T.tex(c, { repeat: true });
  };

  // ---------- sign atlas ----------
  T.buildSignAtlas = function () {
    const S = 2048, c = T.canvas(S, S), x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const COLS = ['#ff2bd6', '#5ef2ff', '#f3e600', '#ff6a3d', '#9d6bff', '#ff3b4e', '#7dff4a', '#ffffff', '#ffb24a'];
    const vert = ['ラーメン', '居酒屋', 'カラオケ', 'ホテル', '薬局', '寿司', '麻雀', '電脳', '診療所', 'バー', '酒場', '整体', '焼鳥', '質屋', '銭湯', 'ゲーム'];
    const horiz = ['RAMEN', 'BAR', 'HOTEL', '24H', 'CLINIC', 'NOODLES', 'KARAOKE', 'PACHINKO', 'SUSHI', 'TATTOO', 'ARCADE', 'LIQUOR', 'CYBERWARE', 'DOLLS', 'NOODLE BAR', 'OPEN', 'LOVE HOTEL', 'IMPLANTS', 'PAWN', 'DINER', 'BRAINDANCE', 'MOTEL', 'SAKE', 'TAXI'];
    const rects = [];
    const uv = (px, py, pw, ph) => [px / S, 1 - (py + ph) / S, (px + pw) / S, 1 - py / S];
    // vertical: 16 cells 128x512 (two rows)
    for (let i = 0; i < 16; i++) {
      const cx = (i % 16) * 128, cy = Math.floor(i / 16) * 512;
      const col = COLS[i % COLS.length], bg = rnd() < 0.5;
      x.save();
      x.fillStyle = bg ? col : '#07040c'; x.globalAlpha = bg ? 0.92 : 1; x.fillRect(cx + 6, cy + 6, 116, 500); x.globalAlpha = 1;
      x.strokeStyle = col; x.lineWidth = 5; x.shadowColor = col; x.shadowBlur = 14; x.strokeRect(cx + 10, cy + 10, 108, 492);
      x.shadowBlur = 0;
      const chars = [...vert[i]], n = chars.length, step = Math.min(110, 470 / n);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k < n; k++) {
        const yy = cy + 256 - (n - 1) * step / 2 + k * step;
        if (bg) { x.fillStyle = '#0a0410'; x.font = `900 ${Math.floor(step * 0.82)}px ${JP}`; x.fillText(chars[k], cx + 64, yy); }
        else T.neon(x, chars[k], cx + 64, yy, `900 ${Math.floor(step * 0.82)}px ${JP}`, col, 14);
      }
      x.restore();
      rects.push({ kind: 'v', uv: uv(cx, cy, 128, 512), aspect: 128 / 512, color: col });
    }
    // second row of vertical cells reuse with different colours (cells 16..31)
    for (let i = 0; i < 16; i++) {
      const cx = i * 128, cy = 512;
      const col = COLS[(i + 4) % COLS.length];
      x.save(); x.fillStyle = '#07040c'; x.fillRect(cx + 6, cy + 6, 116, 500);
      x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 12; x.strokeRect(cx + 12, cy + 12, 104, 488); x.shadowBlur = 0;
      const chars = [...vert[(i + 7) % vert.length]], n = chars.length, step = Math.min(110, 470 / n);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let k = 0; k < n; k++) T.neon(x, chars[k], cx + 64, cy + 256 - (n - 1) * step / 2 + k * step, `900 ${Math.floor(step * 0.8)}px ${JP}`, col, 16);
      x.restore();
      rects.push({ kind: 'v', uv: uv(cx, cy, 128, 512), aspect: 128 / 512, color: col });
    }
    // horizontal: 512x128, 4 per row, rows from y=1024
    for (let i = 0; i < 32; i++) {
      const cx = (i % 4) * 512, cy = 1024 + Math.floor(i / 4) * 128;
      const col = COLS[(i * 3) % COLS.length], word = horiz[i % horiz.length];
      x.save(); x.fillStyle = '#06030a'; x.fillRect(cx + 4, cy + 4, 504, 120);
      if (i % 3 === 0) { x.strokeStyle = col; x.lineWidth = 4; x.shadowColor = col; x.shadowBlur = 12; x.strokeRect(cx + 10, cy + 10, 492, 108); x.shadowBlur = 0; }
      x.textAlign = 'center'; x.textBaseline = 'middle';
      let fs = 86; x.font = `700 ${fs}px ${DISP}`;
      while (x.measureText(word).width > 460 && fs > 30) { fs -= 4; x.font = `700 ${fs}px ${DISP}`; }
      T.neon(x, word, cx + 256, cy + 68, `700 ${fs}px ${DISP}`, col, 18);
      x.restore();
      rects.push({ kind: 'h', uv: uv(cx, cy, 512, 128), aspect: 4, color: col });
    }
    const tex = T.tex(c, { aniso: 8 });
    return { tex, rects, vert: rects.filter((r) => r.kind === 'v'), horiz: rects.filter((r) => r.kind === 'h') };
  };

  // ---------- vending machine fronts ----------
  T.vending = function (kind) {
    const w = 256, h = 512, c = T.canvas(w, h), x = c.getContext('2d');
    const theme = {
      cola: { bg: '#b0001a', hi: '#ff3a4a', name: 'SYNTH COLA', jp: 'シンセ' },
      zenkai: { bg: '#0a5a1a', hi: '#7dff4a', name: 'ZENKAI', jp: '全開' },
      noodle: { bg: '#a85a00', hi: '#ffcf6a', name: 'NOODLE BOX', jp: '麺' },
      blue: { bg: '#0a2a8a', hi: '#5ef2ff', name: 'AQUA+', jp: '水' },
    }[kind];
    x.fillStyle = '#d8dce8'; x.fillRect(0, 0, w, h);
    x.fillStyle = theme.bg; x.fillRect(8, 8, w - 16, 96);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    T.neon(x, theme.name, w / 2, 46, `700 34px ${DISP}`, '#ffffff', 8);
    x.fillStyle = theme.hi; x.font = `900 30px ${JP}`; x.fillText(theme.jp, w / 2, 84);
    // product window
    x.fillStyle = '#e8f6ff'; x.fillRect(14, 112, w - 70, 270);
    const pc = [theme.hi, '#ff2bd6', '#5ef2ff', '#f3e600', '#ffffff', '#ff6a3d'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
      const px = 22 + k * 34, py = 122 + r * 66;
      x.fillStyle = pc[(r * 2 + k) % pc.length]; x.fillRect(px, py, 26, 44);
      x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(px + 4, py + 4, 5, 36);
      x.fillStyle = '#222'; x.fillRect(px, py + 48, 26, 8);
      x.fillStyle = '#ff3b4e'; x.fillRect(px + 8, py + 50, 10, 4);
    }
    // buttons / slot
    x.fillStyle = '#2a2e3a'; x.fillRect(w - 50, 112, 38, 270);
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#5ef2ff' : '#7dff4a'; x.fillRect(w - 42, 124 + i * 40, 22, 14); }
    x.fillStyle = '#111'; x.fillRect(w - 44, 360, 26, 10);
    // dispenser
    x.fillStyle = '#1a1c24'; x.fillRect(30, 410, w - 60, 70);
    x.fillStyle = '#05060a'; x.fillRect(40, 420, w - 80, 50);
    x.fillStyle = theme.bg; x.fillRect(8, 488, w - 16, 16);
    return T.tex(c);
  };

  // ---------- helipad ----------
  T.helipad = (() => {
    const c = T.canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#16171d'; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = '#f3e600'; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 104, 0, 7); x.stroke();
    x.fillStyle = '#f3e600'; x.font = `700 140px ${DISP}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', 128, 134);
    return T.tex(c);
  })();

  // ---------- generic screen texture (news / terminals) ----------
  T.screen = function (lines, color = '#5ef2ff', w = 512, h = 288, title) {
    const c = T.canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#04101c'); g.addColorStop(1, '#0a0420');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = color; x.font = `700 30px ${DISP}`; x.textAlign = 'left'; x.textBaseline = 'top';
    if (title) { x.fillRect(0, 0, w, 44); x.fillStyle = '#04060c'; x.fillText(title, 16, 6); }
    x.fillStyle = color; x.font = `400 22px ${DISP}`;
    lines.forEach((l, i) => x.fillText(l, 16, (title ? 60 : 16) + i * 30));
    scanlines(x, w, h, 0.12, 3);
    return T.tex(c);
  };
})();
