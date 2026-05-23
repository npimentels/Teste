'use strict';

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const API_BASE = '';  // same origin; set to 'http://localhost:5000' for dev with separate servers
const NODE_RADIUS = 5;
const VISIBILITY_RADIUS = 340;      // px from viewport center to trigger appearance
const CONNECTION_MAX_DIST = 220;    // px between nodes to draw a line
const TYPEWRITER_DELAY = 30;        // ms per character
const FADE_DURATION = 600;          // ms
const MAX_CONNECTIONS_PER_NODE = 4;

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
const state = {
  token: localStorage.getItem('mente_token') || null,
  thoughts: [],        // raw data from API
  nodes: [],           // Node objects on canvas
  camera: { x: 0, y: 0 },
  drag: { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 },
  touch: { active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0, dist: 0 },
  mouse: { x: 0, y: 0 },
  filterFrom: null,
  filterTo: null,
  idleTimer: null,
  idleCursorVisible: true,
  writeOpen: false,
  searchOpen: false,
  filterOpen: false,
  authOpen: false,
  searchDebounce: null,
};

/* ─────────────────────────────────────────────
   DOM
───────────────────────────────────────────── */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const idleCursor = document.getElementById('idle-cursor');
const writeOverlay = document.getElementById('write-overlay');
const thoughtInput = document.getElementById('thought-input');
const btnRelease = document.getElementById('btn-release');
const authOverlay = document.getElementById('auth-overlay');
const passwordInput = document.getElementById('password-input');
const btnAuth = document.getElementById('btn-auth');
const authError = document.getElementById('auth-error');
const searchOverlay = document.getElementById('search-overlay');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const filterOverlay = document.getElementById('filter-overlay');
const filterFrom = document.getElementById('filter-from');
const filterTo = document.getElementById('filter-to');
const toast = document.getElementById('toast');
const btnWrite = document.getElementById('btn-write');
const btnSearch = document.getElementById('btn-search');
const btnFilter = document.getElementById('btn-filter');
const btnApplyFilter = document.getElementById('btn-apply-filter');
const btnClearFilter = document.getElementById('btn-clear-filter');

// custom cursor
const cursor = document.createElement('div');
cursor.id = 'custom-cursor';
document.body.appendChild(cursor);

/* ─────────────────────────────────────────────
   NODE CLASS
───────────────────────────────────────────── */
class Node {
  constructor(thought, x, y) {
    this.thought = thought;
    this.x = x;
    this.y = y;
    this.alpha = 0;           // 0 → 1
    this.lineAlpha = 0;
    this.textProgress = 0;    // chars revealed
    this.visible = false;     // currently in range
    this.typewriterTimer = null;
    this.connections = [];    // indices of connected nodes
  }

  get displayText() {
    const full = this.thought.content;
    return full.slice(0, Math.round(this.textProgress));
  }

  startTypewriter() {
    if (this.typewriterTimer) return;
    const full = this.thought.content;
    const tick = () => {
      if (!this.visible) { this.typewriterTimer = null; return; }
      if (this.textProgress < full.length) {
        this.textProgress += 1;
        this.typewriterTimer = setTimeout(tick, TYPEWRITER_DELAY);
      } else {
        this.typewriterTimer = null;
      }
    };
    this.typewriterTimer = setTimeout(tick, TYPEWRITER_DELAY);
  }

  stopTypewriter() {
    if (this.typewriterTimer) {
      clearTimeout(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    this.textProgress = 0;
  }
}

/* ─────────────────────────────────────────────
   CANVAS SIZING
───────────────────────────────────────────── */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ─────────────────────────────────────────────
   LAYOUT: distribute nodes in a loose grid
───────────────────────────────────────────── */
function layoutNodes(thoughts) {
  const spacing = 380;
  const cols = Math.ceil(Math.sqrt(thoughts.length * 1.6));
  return thoughts.map((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitterX = (Math.random() - 0.5) * spacing * 0.55;
    const jitterY = (Math.random() - 0.5) * spacing * 0.55;
    const x = (col - cols / 2) * spacing + jitterX;
    const y = (row - Math.ceil(thoughts.length / cols) / 2) * spacing + jitterY;
    return new Node(t, x, y);
  });
}

/* ─────────────────────────────────────────────
   BUILD CONNECTIONS
───────────────────────────────────────────── */
function buildConnections(nodes) {
  nodes.forEach(n => { n.connections = []; });
  for (let i = 0; i < nodes.length; i++) {
    const distances = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < CONNECTION_MAX_DIST) distances.push({ j, d });
    }
    distances.sort((a, b) => a.d - b.d);
    distances.slice(0, MAX_CONNECTIONS_PER_NODE).forEach(({ j }) => {
      if (!nodes[i].connections.includes(j)) nodes[i].connections.push(j);
      if (!nodes[j].connections.includes(i)) nodes[j].connections.push(i);
    });
  }
}

/* ─────────────────────────────────────────────
   FETCH THOUGHTS
───────────────────────────────────────────── */
async function fetchThoughts() {
  let url = `${API_BASE}/api/thoughts`;
  const params = new URLSearchParams();
  if (state.filterFrom) params.set('from', state.filterFrom);
  if (state.filterTo) params.set('to', state.filterTo);
  if ([...params].length) url += '?' + params.toString();

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    state.thoughts = await res.json();
    state.nodes = layoutNodes(state.thoughts);
    buildConnections(state.nodes);
  } catch (e) {
    showToast('erro ao carregar pensamentos');
  }
}

/* ─────────────────────────────────────────────
   WORLD → SCREEN TRANSFORM
───────────────────────────────────────────── */
function worldToScreen(wx, wy) {
  return {
    x: wx - state.camera.x + canvas.width / 2,
    y: wy - state.camera.y + canvas.height / 2,
  };
}

/* ─────────────────────────────────────────────
   VISIBILITY UPDATE
───────────────────────────────────────────── */
function updateVisibility() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  state.nodes.forEach(node => {
    const sx = node.x - state.camera.x + cx;
    const sy = node.y - state.camera.y + cy;
    const dx = sx - cx;
    const dy = sy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inRange = dist < VISIBILITY_RADIUS + NODE_RADIUS * 4;

    if (inRange && !node.visible) {
      node.visible = true;
      node.startTypewriter();
    } else if (!inRange && node.visible) {
      node.visible = false;
      node.stopTypewriter();
    }
  });
}

/* ─────────────────────────────────────────────
   DRAW LOOP
───────────────────────────────────────────── */
let lastTime = 0;
function draw(ts) {
  const dt = Math.min(ts - lastTime, 100);
  lastTime = ts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateVisibility();

  const fadeStep = dt / FADE_DURATION;

  // Update alphas
  state.nodes.forEach(node => {
    if (node.visible) {
      node.alpha = Math.min(1, node.alpha + fadeStep);
      node.lineAlpha = Math.min(0.5, node.lineAlpha + fadeStep * 0.6);
    } else {
      node.alpha = Math.max(0, node.alpha - fadeStep * 0.7);
      node.lineAlpha = Math.max(0, node.lineAlpha - fadeStep * 0.7);
    }
  });

  // Draw connections
  const drawn = new Set();
  state.nodes.forEach((node, i) => {
    if (node.alpha < 0.01) return;
    const sp = worldToScreen(node.x, node.y);

    node.connections.forEach(j => {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (drawn.has(key)) return;
      drawn.add(key);

      const other = state.nodes[j];
      if (other.alpha < 0.01) return;

      const sother = worldToScreen(other.x, other.y);
      const lineAlpha = Math.min(node.lineAlpha, other.lineAlpha);

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sother.x, sother.y);
      ctx.strokeStyle = `rgba(120,120,120,${lineAlpha * 0.35})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });
  });

  // Draw nodes and text
  state.nodes.forEach(node => {
    if (node.alpha < 0.01) return;
    const { x: sx, y: sy } = worldToScreen(node.x, node.y);

    // node circle
    ctx.beginPath();
    ctx.arc(sx, sy, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,200,200,${node.alpha * 0.8})`;
    ctx.fill();

    // glow
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, NODE_RADIUS * 4);
    grad.addColorStop(0, `rgba(200,200,200,${node.alpha * 0.06})`);
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(sx, sy, NODE_RADIUS * 4, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // text
    if (node.alpha > 0.15 && node.displayText.length > 0) {
      drawNodeText(ctx, node.displayText, sx + 14, sy, node.alpha);
    }
  });

  requestAnimationFrame(draw);
}

/* ─────────────────────────────────────────────
   DRAW TEXT (word-wrapped, max width, fade)
───────────────────────────────────────────── */
function drawNodeText(ctx, text, x, y, alpha) {
  const maxWidth = 200;
  const lineHeight = 16;
  const fontSize = 11;
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = `rgba(180,180,180,${alpha * 0.75})`;
  ctx.textBaseline = 'middle';

  const words = text.split(' ');
  const lines = [];
  let current = '';

  words.forEach(word => {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);

  const maxLines = 5;
  const visibleLines = lines.slice(0, maxLines);
  const totalH = visibleLines.length * lineHeight;
  const startY = y - totalH / 2;

  visibleLines.forEach((line, i) => {
    let displayLine = line;
    if (i === maxLines - 1 && lines.length > maxLines) {
      displayLine = line.slice(0, -2) + '…';
    }
    ctx.fillText(displayLine, x, startY + i * lineHeight);
  });
}

/* ─────────────────────────────────────────────
   CAMERA / DRAG / TOUCH
───────────────────────────────────────────── */
canvas.addEventListener('mousedown', e => {
  if (state.writeOpen || state.authOpen) return;
  state.drag.active = true;
  state.drag.startX = e.clientX;
  state.drag.startY = e.clientY;
  state.drag.camStartX = state.camera.x;
  state.drag.camStartY = state.camera.y;
});

window.addEventListener('mousemove', e => {
  // custom cursor
  cursor.style.left = e.clientX + 'px';
  cursor.style.top = e.clientY + 'px';
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;

  resetIdle();

  if (!state.drag.active) return;
  state.camera.x = state.drag.camStartX - (e.clientX - state.drag.startX);
  state.camera.y = state.drag.camStartY - (e.clientY - state.drag.startY);
});

window.addEventListener('mouseup', () => { state.drag.active = false; });
window.addEventListener('mouseleave', () => { state.drag.active = false; });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  state.camera.x += e.deltaX * 0.8;
  state.camera.y += e.deltaY * 0.8;
  resetIdle();
}, { passive: false });

// touch
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    state.touch.active = true;
    state.touch.startX = e.touches[0].clientX;
    state.touch.startY = e.touches[0].clientY;
    state.touch.camStartX = state.camera.x;
    state.touch.camStartY = state.camera.y;
  }
}, { passive: true });

canvas.addEventListener('touchmove', e => {
  if (state.touch.active && e.touches.length === 1) {
    const dx = e.touches[0].clientX - state.touch.startX;
    const dy = e.touches[0].clientY - state.touch.startY;
    state.camera.x = state.touch.camStartX - dx;
    state.camera.y = state.touch.camStartY - dy;
    resetIdle();
  }
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => { state.touch.active = false; });

/* ─────────────────────────────────────────────
   IDLE CURSOR
───────────────────────────────────────────── */
function resetIdle() {
  idleCursor.style.opacity = '0';
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    idleCursor.style.opacity = '1';
  }, 3000);
}
resetIdle();

/* ─────────────────────────────────────────────
   WRITE OVERLAY
───────────────────────────────────────────── */
function openWrite() {
  if (!state.token) {
    openAuth(() => openWrite());
    return;
  }
  state.writeOpen = true;
  writeOverlay.classList.remove('hidden');
  thoughtInput.value = '';
  setTimeout(() => thoughtInput.focus(), 50);
}

function closeWrite() {
  state.writeOpen = false;
  writeOverlay.classList.add('hidden');
}

btnWrite.addEventListener('click', openWrite);

thoughtInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeWrite();
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    releaseThought();
  }
});

btnRelease.addEventListener('click', releaseThought);

async function releaseThought() {
  const content = thoughtInput.value.trim();
  if (!content) return;
  try {
    const res = await fetch(`${API_BASE}/api/thoughts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`,
      },
      body: JSON.stringify({ content }),
    });
    if (res.status === 401) {
      state.token = null;
      localStorage.removeItem('mente_token');
      closeWrite();
      showToast('sessão expirada');
      return;
    }
    if (!res.ok) throw new Error('post failed');
    const thought = await res.json();
    closeWrite();
    showToast('pensamento solto');
    // add to canvas
    const angle = Math.random() * Math.PI * 2;
    const r = 200 + Math.random() * 150;
    const node = new Node(thought, state.camera.x + Math.cos(angle) * r, state.camera.y + Math.sin(angle) * r);
    state.thoughts.push(thought);
    state.nodes.push(node);
    buildConnections(state.nodes);
  } catch (e) {
    showToast('erro ao salvar pensamento');
  }
}

/* ─────────────────────────────────────────────
   AUTH OVERLAY
───────────────────────────────────────────── */
let authCallback = null;

function openAuth(cb) {
  authCallback = cb || null;
  state.authOpen = true;
  authOverlay.classList.remove('hidden');
  authError.textContent = '';
  passwordInput.value = '';
  setTimeout(() => passwordInput.focus(), 50);
}

function closeAuth() {
  state.authOpen = false;
  authOverlay.classList.add('hidden');
}

btnAuth.addEventListener('click', doAuth);
passwordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doAuth();
  if (e.key === 'Escape') closeAuth();
});

async function doAuth() {
  const password = passwordInput.value;
  try {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.status === 403) {
      authError.textContent = 'senha incorreta';
      return;
    }
    if (!res.ok) throw new Error('auth failed');
    const { token } = await res.json();
    state.token = token;
    localStorage.setItem('mente_token', token);
    closeAuth();
    if (authCallback) { authCallback(); authCallback = null; }
  } catch (e) {
    authError.textContent = 'erro de conexão';
  }
}

/* ─────────────────────────────────────────────
   SEARCH
───────────────────────────────────────────── */
function openSearch() {
  state.searchOpen = true;
  searchOverlay.classList.remove('hidden');
  searchInput.value = '';
  searchResults.innerHTML = '';
  setTimeout(() => searchInput.focus(), 50);
}

function closeSearch() {
  state.searchOpen = false;
  searchOverlay.classList.add('hidden');
}

btnSearch.addEventListener('click', () => state.searchOpen ? closeSearch() : openSearch());

searchInput.addEventListener('input', () => {
  clearTimeout(state.searchDebounce);
  state.searchDebounce = setTimeout(doSearch, 280);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSearch();
});

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) { searchResults.innerHTML = ''; return; }
  try {
    const res = await fetch(`${API_BASE}/api/thoughts/search?q=${encodeURIComponent(q)}`);
    const results = await res.json();
    searchResults.innerHTML = '';
    if (!results.length) {
      searchResults.innerHTML = '<p class="search-item" style="color:#333">nenhum resultado</p>';
      return;
    }
    results.forEach(t => {
      const div = document.createElement('div');
      div.className = 'search-item';
      const date = new Date(t.created_at).toLocaleDateString('pt-BR');
      div.innerHTML = `<div class="search-date">${date}</div>${escapeHtml(t.content.slice(0, 200))}${t.content.length > 200 ? '…' : ''}`;
      div.addEventListener('click', () => {
        navigateToThought(t.id);
        closeSearch();
      });
      searchResults.appendChild(div);
    });
  } catch (e) {
    // silent
  }
}

function navigateToThought(id) {
  const node = state.nodes.find(n => n.thought.id === id);
  if (!node) return;
  state.camera.x = node.x;
  state.camera.y = node.y;
}

/* ─────────────────────────────────────────────
   FILTER
───────────────────────────────────────────── */
btnFilter.addEventListener('click', () => state.filterOpen ? closeFilter() : openFilter());

function openFilter() {
  state.filterOpen = true;
  filterOverlay.classList.remove('hidden');
}

function closeFilter() {
  state.filterOpen = false;
  filterOverlay.classList.add('hidden');
}

btnApplyFilter.addEventListener('click', async () => {
  state.filterFrom = filterFrom.value || null;
  state.filterTo = filterTo.value || null;
  closeFilter();
  await fetchThoughts();
  showToast('filtro aplicado');
});

btnClearFilter.addEventListener('click', async () => {
  state.filterFrom = null;
  state.filterTo = null;
  filterFrom.value = '';
  filterTo.value = '';
  closeFilter();
  await fetchThoughts();
  showToast('filtro removido');
});

/* ─────────────────────────────────────────────
   KEYBOARD SHORTCUTS
───────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    if (state.writeOpen) closeWrite();
    else openWrite();
    return;
  }
  if (e.key === '/' && !state.writeOpen && !state.authOpen) {
    e.preventDefault();
    if (state.searchOpen) closeSearch();
    else openSearch();
    return;
  }
  if (e.key === 'Escape') {
    if (state.writeOpen) closeWrite();
    if (state.searchOpen) closeSearch();
    if (state.filterOpen) closeFilter();
    if (state.authOpen) closeAuth();
  }
});

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
async function init() {
  await fetchThoughts();
  requestAnimationFrame(draw);
}

init();
