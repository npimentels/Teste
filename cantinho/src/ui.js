// Interface: barra de ferramentas, catálogo, inventário, guarda-roupa,
// ajustes do quarto, painel de informações e balões de fala (estilo Habbo).

import { FURNI, CATEGORIES } from './furniture.js';
import { thumb, furniSprite } from './sprites.js';
import { avatarSprite, WARDROBE, SKIN, HAIR_COLORS, CLOTH, DEFAULT_LOOK, DEFAULT_LOOK_M, HAND_ITEMS } from './avatar.js';
import { petSprite, PET_KINDS } from './pets.js';
import { FLOOR_STYLES, WALL_STYLES, ROOM_SIZES, PLANS, planTiles } from './room.js';
import { SAVE_KEY, TILE } from './config.js';

const $ = (s, root = document) => root.querySelector(s);

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

function scaled(canvas, s, smooth = false) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(canvas.width * s));
  c.height = Math.max(1, Math.round(canvas.height * s));
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = smooth;
  x.imageSmoothingQuality = 'high';
  x.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

// Recorte de um sprite (ex.: só a cabeça do avatar)
function crop(spr, x0, y0, w, h, s = 1) {
  const c = document.createElement('canvas');
  c.width = w * s;
  c.height = h * s;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(spr.canvas, spr.ax + x0, spr.ay + y0, w, h, 0, 0, w * s, h * s);
  return c;
}

const ICON_MAPS = {
  sun: ['...y...', '.y.y.y.', '..yyy..', 'yyyoyyy', '..yyy..', '.y.y.y.', '...y...'],
  dusk: ['.......', '...o...', '.ooooo.', 'ooooooo', 'ppppppp', '.......', 'ppppppp'],
  moon: ['..mmm..', '.mm....', 'mm.....', 'mm.....', 'mm.....', '.mm....', '..mmm..'],
  auto: ['.yy.mm.', 'yyy.mmm', 'yyy..mm', '.yy.mm.', '.......', 'p.p.p.p', '.p.p.p.'],
};
const ICON_PAL = { y: '#ffd35a', o: '#ff9a4a', p: '#c96a86', m: '#e8eaff' };
function pixIcon(rows, s = 4) {
  const c = document.createElement('canvas');
  c.width = rows[0].length * s;
  c.height = rows.length * s;
  const x = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ICON_PAL[ch]) { x.fillStyle = ICON_PAL[ch]; x.fillRect(i * s, j * s, s, s); } }));
  return c;
}

const ENV_LABEL = { auto: 'Automático (relógio)', day: 'Dia', dusk: 'Entardecer', night: 'Noite' };

// Abas do guarda-roupa: parte do look, paleta e recorte da miniatura
const WARD_TABS = [
  { id: 'body', name: 'Corpo' },
  { id: 'hair', name: 'Cabelo', colorKey: 'hairColor', pal: HAIR_COLORS, crop: [-22, -92, 44, 44] },
  { id: 'hat', name: 'Chapéus', colorKey: 'hatColor', pal: CLOTH, crop: [-24, -106, 48, 56] },
  { id: 'top', name: 'Blusas', colorKey: 'topColor', pal: CLOTH, crop: [-20, -54, 40, 32] },
  { id: 'bottom', name: 'Calças', colorKey: 'bottomColor', pal: CLOTH, crop: [-16, -34, 32, 34] },
  { id: 'shoes', name: 'Sapatos', colorKey: 'shoesColor', pal: CLOTH, crop: [-16, -16, 32, 18] },
  { id: 'acc', name: 'Acessórios', colorKey: 'accColor', pal: CLOTH, crop: [-22, -76, 44, 40] },
];

export class UI {
  constructor(game) {
    this.game = game;
    this.bubbles = [];
    this.root = document.getElementById('ui');
    this.buildToolbar();
    this.buildChat();
    this.buildCatalog();
    this.buildInventory();
    this.buildWardrobe();
    this.buildRoom();
    this.buildHelp();
    this.buildAsk();
    this.card = h('section', { id: 'card', class: 'win card hidden' });
    this.root.append(this.card);
    this.tag = h('div', { id: 'nametag', class: 'hidden' });
    this.hintEl = h('div', { id: 'hint', class: 'hidden' });
    this.toastEl = h('div', { id: 'toast' });
    this.bubbleLayer = h('div', { id: 'bubbles' });
    this.root.append(this.tag, this.hintEl, this.toastEl, this.bubbleLayer,
      h('div', { id: 'title' }, h('span', { class: 'logo' }, 'Cantinho'), h('span', { class: 'sub' }, 'meu apê pixelado')));
    let fresh = true;
    try { fresh = !localStorage.getItem(SAVE_KEY); } catch { /* sem armazenamento */ }
    if (fresh) setTimeout(() => this.open('help'), 1600);
  }

  // --------------------------------------------------------------- util
  typing() {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
  }

  window(id, title, body, opts = {}) {
    const close = h('button', { class: 'x', title: 'Fechar', onclick: () => this.close(id) }, '×');
    const head = h('header', { class: 'win-title' }, h('span', {}, title), close);
    const w = h('section', { id: 'win-' + id, class: 'win hidden ' + (opts.cls || '') }, head, body);
    this.draggable(w, head);
    this.root.append(w);
    return w;
  }

  draggable(win, handle) {
    let d = null;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const r = win.getBoundingClientRect();
      d = { x: e.clientX - r.left, y: e.clientY - r.top };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!d) return;
      win.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - d.x)) + 'px';
      win.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - d.y)) + 'px';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      win.style.transform = 'none';
    });
    handle.addEventListener('pointerup', () => { d = null; });
  }

  open(id) {
    const w = $('#win-' + id);
    if (!w) return;
    w.classList.remove('hidden');
    this.root.append(w);
    if (id === 'wardrobe') this.openWardrobe();
    if (id === 'room') this.renderRoom();
    if (id === 'catalog') this.renderCatalog();
    if (id === 'inventory') this.renderInventory();
  }

  close(id) { $('#win-' + id)?.classList.add('hidden'); }

  isOpen(id) { const w = $('#win-' + id); return w && !w.classList.contains('hidden'); }

  toggle(id) { if (this.isOpen(id)) this.close(id); else this.open(id); }

  closeWindows() { for (const w of document.querySelectorAll('.win:not(.card)')) w.classList.add('hidden'); }

  refreshAll() { this.updateHeadIcon(); this.updateEnvIcon(); this.refreshInventory(); if (this.isOpen('room')) this.renderRoom(); }

  hint(text) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('hidden', !text);
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 2000);
  }

  // ------------------------------------------------------------ toolbar
  buildToolbar() {
    const g = this.game;
    const btn = (label, icon, onclick) => h('button', { class: 'tool', title: label, onclick }, icon, h('span', {}, label));
    this.envIcon = h('span', { class: 'icon' });
    this.headIcon = h('span', { class: 'icon' });
    this.invBadge = h('b', { class: 'badge hidden' });
    const bar = h('nav', { id: 'toolbar' },
      btn('Catálogo', h('span', { class: 'icon' }, thumb(FURNI.sofa_moderno, 0, 44)), () => this.toggle('catalog')),
      btn('Inventário', h('span', { class: 'icon' }, thumb(FURNI.bau, 0, 40), this.invBadge), () => this.toggle('inventory')),
      btn('Visual', this.headIcon, () => this.toggle('wardrobe')),
      btn('Quarto', h('span', { class: 'icon' }, thumb(FURNI.janela, 0, 40)), () => this.toggle('room')),
      btn('Ambiente', this.envIcon, () => this.cycleEnv()),
      btn('Ajuda', h('span', { class: 'icon q' }, '?'), () => this.toggle('help')),
      h('div', { class: 'zoom' },
        h('button', { class: 'tool small', title: 'Afastar (-)', onclick: () => g.setZoom(-1) }, '−'),
        h('button', { class: 'tool small', title: 'Aproximar (+)', onclick: () => g.setZoom(1) }, '+')),
    );
    this.root.append(bar);
    this.updateHeadIcon();
    this.updateEnvIcon();
  }

  updateHeadIcon() {
    const spr = avatarSprite(this.game.look, 'stand', 0, 0, { headOnly: true });
    this.headIcon.replaceChildren(crop(spr, -16, -86, 32, 34, 1));
  }

  updateEnvIcon() {
    const m = this.game.envMode;
    this.envIcon.replaceChildren(pixIcon(ICON_MAPS[m === 'day' ? 'sun' : m === 'dusk' ? 'dusk' : m === 'night' ? 'moon' : 'auto']));
    this.envIcon.parentElement.title = 'Ambiente: ' + ENV_LABEL[m];
  }

  cycleEnv() {
    const order = ['auto', 'day', 'dusk', 'night'];
    const g = this.game;
    g.envMode = order[(order.indexOf(g.envMode) + 1) % order.length];
    this.updateEnvIcon();
    this.toast('Ambiente: ' + ENV_LABEL[g.envMode]);
    g.save();
  }

  // --------------------------------------------------------------- chat
  buildChat() {
    this.chatInput = h('input', { id: 'chat-input', maxlength: 90, placeholder: 'Diga algo… (Enter)  ·  o/  :dançar  :sentar', autocomplete: 'off' });
    const form = h('form', {
      id: 'chat', onsubmit: (e) => { e.preventDefault(); this.game.say(this.chatInput.value); this.chatInput.value = ''; },
    }, this.chatInput, h('button', { class: 'btn', type: 'submit' }, 'Falar'));
    this.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.blurChat(); });
    this.root.append(form);
  }

  focusChat() { this.chatInput.focus(); }
  blurChat() { this.chatInput.blur(); }

  bubble(entity, text, small) {
    const isAv = entity === this.game.avatar;
    const name = isAv ? this.game.look.name : entity.name;
    const color = isAv ? this.game.look.topColor : '#8f7bc2';
    const el = h('div', { class: 'bubble' + (small ? ' small' : '') }, h('b', { style: `color:${color}` }, name + ': '), text);
    this.bubbleLayer.append(el);
    this.bubbles.push({ el, entity, born: performance.now(), life: small ? 3500 : 7000 });
    if (this.bubbles.length > 14) this.bubbles.shift().el.remove();
  }

  nameTag(entity) {
    this.tagEntity = entity;
    if (!entity) { this.tag.classList.add('hidden'); return; }
    const isAv = entity === this.game.avatar;
    this.tag.textContent = isAv ? this.game.look.name : `${entity.name} · ${PET_KINDS[entity.kind].name}`;
    this.tag.classList.remove('hidden');
  }

  headZ(e) {
    const isAv = e === this.game.avatar;
    if (!isAv) return e.z + 30;
    if (e.pose === 'lay') return e.z + 74;
    return e.z + (e.pose === 'sit' ? 78 : 86);
  }

  frame() {
    const R = this.game.renderer;
    if (!R.o) return;
    const now = performance.now();
    const stacks = new Map();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      const age = now - b.born;
      if (age > b.life) { b.el.remove(); this.bubbles.splice(i, 1); continue; }
      const e = b.entity;
      const [x, y] = R.worldToClient(e.x, e.y, this.headZ(e));
      const n = stacks.get(e) || 0;
      stacks.set(e, n + b.el.offsetHeight + 4);
      b.el.style.transform = `translate(${Math.round(x - b.el.offsetWidth / 2)}px, ${Math.round(y - b.el.offsetHeight - 8 - n)}px)`;
      b.el.style.opacity = age > b.life - 600 ? (b.life - age) / 600 : 1;
    }
    if (this.tagEntity) {
      const e = this.tagEntity;
      const [x, y] = R.worldToClient(e.x, e.y, this.headZ(e));
      this.tag.style.transform = `translate(${Math.round(x - this.tag.offsetWidth / 2)}px, ${Math.round(y - 26 - (stacks.get(e) || 0))}px)`;
    }
  }

  // ------------------------------------------------------------ catálogo
  buildCatalog() {
    this.catTab = 'sala';
    this.catSel = null;
    this.catVariant = 0;
    this.catRot = 0;
    const tabs = h('nav', { class: 'cat-tabs' });
    for (const c of CATEGORIES) tabs.append(h('button', { 'data-cat': c.id, onclick: () => { this.catTab = c.id; this.catSel = null; this.renderCatalog(); } }, c.name));
    this.catGrid = h('div', { class: 'cat-grid' });
    this.catDetail = h('div', { class: 'cat-detail' });
    const body = h('div', { class: 'cat-body' }, tabs, h('div', { class: 'cat-main' }, this.catGrid, this.catDetail));
    this.catWin = this.window('catalog', 'Catálogo de Mobis', body, { cls: 'catalog' });
  }

  catalogEntries() {
    const list = Object.values(FURNI).filter((d) => d.cat === this.catTab).map((d) => ({ type: 'furni', def: d }));
    if (this.catTab === 'pets') for (const k of Object.keys(PET_KINDS)) list.unshift({ type: 'pet', kind: k });
    return list;
  }

  renderCatalog() {
    for (const b of this.catWin.querySelectorAll('.cat-tabs button')) b.classList.toggle('on', b.dataset.cat === this.catTab);
    const entries = this.catalogEntries();
    if (!this.catSel) { this.catSel = entries[0]; this.catVariant = 0; this.catRot = 0; }
    this.catGrid.replaceChildren(...entries.map((en) => {
      const icon = en.type === 'pet' ? scaled(petSprite(en.kind, 0, 'sit', 0, 1).canvas, 1) : thumb(en.def, 0, 56);
      const on = this.catSel && (en.type === 'pet' ? this.catSel.kind === en.kind : this.catSel.def === en.def);
      return h('button', {
        class: 'cat-item' + (on ? ' on' : ''), title: en.type === 'pet' ? PET_KINDS[en.kind].name : en.def.name,
        onclick: () => { this.catSel = en; this.catVariant = 0; this.catRot = 0; this.renderCatalog(); },
        ondblclick: () => this.buyFromCatalog(true),
      }, icon);
    }));
    this.renderCatDetail();
  }

  renderCatDetail() {
    const en = this.catSel;
    if (!en) { this.catDetail.replaceChildren(); return; }
    let preview, name, desc, variants, action;
    if (en.type === 'pet') {
      const K = PET_KINDS[en.kind];
      preview = scaled(petSprite(en.kind, this.catVariant, 'stand', 0, 1).canvas, 2);
      name = K.name;
      desc = en.kind === 'gato' ? 'Independente, dorminhoco e fofo. Vai explorar o quarto, comer e tirar sonecas.' : 'Leal e brincalhão. Segue você pelo quarto, pede carinho e come na tigela.';
      variants = K.colors.map((c) => c.a);
      action = h('button', { class: 'btn primary', onclick: () => this.game.adoptPet(en.kind, this.catVariant) }, 'Adotar');
    } else {
      const d = en.def;
      const spr = furniSprite(d, { rot: d.wall ? 0 : this.catRot, variant: this.catVariant, state: d.states && d.light && !d.food ? 1 : 0, time: { h: 10, m: 10 } });
      preview = scaled(spr.canvas, spr.w > 120 || spr.h > 150 ? 0.5 : spr.w > 64 || spr.h > 76 ? 1 : 2, spr.w > 120 || spr.h > 150);
      name = d.name;
      const tags = [];
      if (d.sit) tags.push('sentável');
      if (d.lay) tags.push('deitável');
      if (d.food) tags.push(`${d.food.portions} porções`);
      if (d.dispenser) tags.push('serve ' + d.dispenser.map((i) => HAND_ITEMS[i].name.toLowerCase()).join(', '));
      if (d.states && !d.food) tags.push(d.states.length + ' estados');
      if (d.stack) tags.push('empilhável');
      if (d.walk) tags.push('dá p/ pisar');
      if (d.pool) tags.push('dá p/ nadar');
      if (d.light) tags.push('ilumina');
      if (d.wall) tags.push('de parede');
      desc = [d.desc || '', h('div', { class: 'tags' }, ...tags.map((t) => h('span', {}, t)))];
      variants = d.variants;
      action = h('div', { class: 'row' },
        !d.wall && (d.rots || 4) > 1 ? h('button', { class: 'btn', onclick: () => { this.catRot = (this.catRot + 1) % (d.rots || 4); this.renderCatDetail(); } }, '↻ Girar') : null,
        h('button', { class: 'btn', onclick: () => this.buyFromCatalog(false) }, 'Comprar'),
        h('button', { class: 'btn primary', onclick: () => this.buyFromCatalog(true) }, 'Comprar e colocar'));
    }
    const sw = h('div', { class: 'swatches' }, ...(variants || []).map((c, i) => h('button', {
      class: 'swatch' + (i === this.catVariant ? ' on' : ''), style: `background:${c}`, title: 'Cor ' + (i + 1),
      onclick: () => { this.catVariant = i; this.renderCatDetail(); },
    })));
    this.catDetail.replaceChildren(h('div', { class: 'preview' }, preview), h('div', { class: 'info' }, h('h3', {}, name), h('div', { class: 'desc' }, desc), variants && variants.length > 1 ? sw : null, action));
  }

  buyFromCatalog(place) {
    const en = this.catSel;
    if (!en) return;
    if (en.type === 'pet') { this.game.adoptPet(en.kind, this.catVariant); return; }
    this.game.buy(en.def.id, this.catVariant, place);
    if (place) {
      this.game.placing.rot = en.def.wall ? 0 : this.catRot;
      if (window.innerWidth < 860) this.close('catalog');
    }
  }

  // ---------------------------------------------------------- inventário
  buildInventory() {
    this.invTab = 'mobis';
    this.invSel = null;
    this.invTabs = h('nav', { class: 'inv-tabs' },
      h('button', { 'data-tab': 'mobis', onclick: () => { this.invTab = 'mobis'; this.renderInventory(); } }, 'Mobis'),
      h('button', { 'data-tab': 'pets', onclick: () => { this.invTab = 'pets'; this.renderInventory(); } }, 'Pets'));
    this.invGrid = h('div', { class: 'inv-grid' });
    this.invDetail = h('div', { class: 'inv-detail' });
    this.window('inventory', 'Inventário', h('div', { class: 'inv-body' }, this.invTabs, this.invGrid, this.invDetail), { cls: 'inventory' });
  }

  refreshInventory() {
    const n = this.game.inventory.reduce((a, b) => a + b.n, 0);
    if (this.invBadge) { this.invBadge.textContent = n; this.invBadge.classList.toggle('hidden', !n); }
    if (this.isOpen('inventory')) this.renderInventory();
  }

  renderInventory() {
    const g = this.game;
    for (const b of this.invTabs.querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === this.invTab);
    if (this.invTab === 'pets') {
      const list = g.storedPets;
      this.invGrid.replaceChildren(...(list.length ? list.map((p) => h('button', { class: 'cat-item' + (this.invSel === p ? ' on' : ''), title: p.name, onclick: () => { this.invSel = p; this.renderInventory(); } }, scaled(petSprite(p.kind, p.color, 'sit', 0, 1).canvas, 1))) : [h('p', { class: 'empty' }, 'Nenhum pet guardado. Pets guardados descansam aqui.')]));
      const p = list.includes(this.invSel) ? this.invSel : null;
      this.invDetail.replaceChildren(...(p ? [h('b', {}, p.name), h('button', { class: 'btn primary', onclick: () => { g.releasePet(p); this.invSel = null; } }, 'Soltar no quarto')] : []));
      return;
    }
    const list = g.inventory;
    this.invGrid.replaceChildren(...(list.length ? list.map((e) => h('button', {
      class: 'cat-item' + (this.invSel === e ? ' on' : ''), title: FURNI[e.id].name,
      onclick: () => { this.invSel = e; this.renderInventory(); }, ondblclick: () => { g.placeFromInventory(e.id, e.variant); },
    }, thumb(FURNI[e.id], e.variant, 56), e.n > 1 ? h('b', { class: 'count' }, '' + e.n) : null)) : [h('p', { class: 'empty' }, 'Inventário vazio. Compre no catálogo ou guarde mobis do quarto.')]));
    const e = list.includes(this.invSel) ? this.invSel : null;
    this.invDetail.replaceChildren(...(e ? [
      h('b', {}, FURNI[e.id].name + (e.n > 1 ? ` (${e.n})` : '')),
      h('button', { class: 'btn primary', onclick: () => g.placeFromInventory(e.id, e.variant) }, 'Colocar no quarto'),
    ] : [h('span', { class: 'note' }, 'Selecione um item para colocar no quarto.')]));
  }

  // -------------------------------------------------------- guarda-roupa
  buildWardrobe() {
    this.wardTab = 'body';
    this.wardDir = 1;
    this.wardTabs = h('nav', { class: 'ward-tabs' });
    this.wardOpts = h('div', { class: 'ward-opts' });
    this.wardPrev = h('div', { class: 'ward-preview' });
    this.wardSlots = h('div', { class: 'ward-slots' });
    const body = h('div', { class: 'ward-body' },
      h('div', { class: 'ward-left' }, this.wardTabs, this.wardOpts),
      h('div', { class: 'ward-mid' }, this.wardPrev),
      h('div', { class: 'ward-right' }, h('div', { class: 'ward-rtitle' }, 'Meu Guarda-Roupa'), this.wardSlots));
    this.window('wardrobe', 'Guarda-roupa', body, { cls: 'wardrobe' });
  }

  openWardrobe() {
    this.draft = { ...this.game.look };
    this.renderWardrobe();
  }

  renderWardrobe() {
    const d = this.draft;
    // abas com ícones recortados do próprio avatar
    const bare = { ...d, hat: 'nenhum' };
    const base = avatarSprite(bare, 'stand', 0, 1);
    this.wardTabs.replaceChildren(...WARD_TABS.map((t) => {
      const icon = t.id === 'body' ? crop(avatarSprite({ ...bare, hair: 'careca' }, 'stand', 0, 1, { headOnly: true }), -14, -84, 28, 28)
        : t.id === 'hat' ? crop(avatarSprite(d.hat === 'nenhum' ? { ...d, hat: 'gorro' } : d, 'stand', 0, 1), ...t.crop) : crop(base, ...t.crop);
      const c = document.createElement('canvas');
      c.width = 30; c.height = 30;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = true;
      const s = Math.min(30 / icon.width, 30 / icon.height);
      x.drawImage(icon, (30 - icon.width * s) / 2, (30 - icon.height * s) / 2, icon.width * s, icon.height * s);
      return h('button', { class: 'ward-tab' + (this.wardTab === t.id ? ' on' : ''), title: t.name, onclick: () => { this.wardTab = t.id; this.renderWardrobe(); } }, c);
    }));
    const set = (patch) => { Object.assign(this.draft, patch); this.renderWardrobe(); };
    const tab = WARD_TABS.find((t) => t.id === this.wardTab);
    if (tab.id === 'body') {
      const gender = (gd) => {
        if (d.gender === gd) return;
        const def = gd === 'M' ? DEFAULT_LOOK_M : DEFAULT_LOOK;
        const patch = { gender: gd };
        for (const k of ['hair', 'hat', 'top', 'bottom', 'shoes', 'acc']) {
          const item = WARDROBE[k].find((i) => i.id === d[k]);
          if (item && item.g !== 'U' && item.g !== gd) patch[k] = def[k];
        }
        set(patch);
      };
      this.wardOpts.replaceChildren(
        h('div', { class: 'genders' },
          h('button', { class: 'gender' + (d.gender === 'M' ? ' on' : ''), onclick: () => gender('M') }, h('span', { class: 'sym m' }, '♂'), 'Menino'),
          h('button', { class: 'gender' + (d.gender === 'F' ? ' on' : ''), onclick: () => gender('F') }, h('span', { class: 'sym f' }, '♀'), 'Menina')),
        h('label', {}, 'Cor da pele'),
        h('div', { class: 'palette' }, ...SKIN.map((c) => h('button', { class: 'pcolor' + (d.skin === c ? ' on' : ''), style: `background:${c}`, onclick: () => set({ skin: c }) }))),
        h('label', {}, 'Nome'),
        h('input', { id: 'look-name', value: d.name, maxlength: 16, oninput: (e) => { this.draft.name = e.target.value || 'Você'; } }),
      );
    } else {
      const items = WARDROBE[tab.id].filter((i) => i.g === 'U' || i.g === d.gender);
      const grid = h('div', { class: 'styles' });
      this.wardOpts.replaceChildren(grid, h('label', {}, 'Cores'),
        h('div', { class: 'palette' }, ...tab.pal.map((c) => h('button', { class: 'pcolor' + (d[tab.colorKey] === c ? ' on' : ''), style: `background:${c}`, onclick: () => set({ [tab.colorKey]: c }) }))));
      // miniaturas geradas aos poucos para não travar
      const cells = items.map((it) => {
        const b = h('button', { class: 'style' + (d[tab.id] === it.id ? ' on' : ''), title: it.name, onclick: () => set({ [tab.id]: it.id }) });
        grid.append(b);
        return [b, it];
      });
      let i = 0;
      const step = () => {
        if (this.wardTab !== tab.id) return;
        const t0 = performance.now();
        while (i < cells.length && performance.now() - t0 < 24) {
          const [b, it] = cells[i++];
          const spr = avatarSprite({ ...d, ...(tab.id === 'hair' ? { hat: 'nenhum' } : {}), [tab.id]: it.id }, 'stand', 0, 1);
          b.append(crop(spr, ...tab.crop));
        }
        if (i < cells.length) requestAnimationFrame(step);
      };
      step();
    }
    // preview grande
    const big = avatarSprite(d, 'stand', 0, this.wardDir);
    this.wardPrev.replaceChildren(
      h('div', { class: 'stage' }, scaled(big.canvas, 2)),
      h('div', { class: 'row center' },
        h('button', { class: 'btn small', title: 'Girar', onclick: () => { this.wardDir = (this.wardDir + 7) % 8; this.renderWardrobe(); } }, '⟲'),
        h('button', { class: 'btn small', title: 'Girar', onclick: () => { this.wardDir = (this.wardDir + 1) % 8; this.renderWardrobe(); } }, '⟳')),
      h('button', { class: 'btn primary', onclick: () => { this.game.setLook(this.draft); this.updateHeadIcon(); this.toast('Visual salvo!'); this.close('wardrobe'); } }, 'Salvar mudanças'));
    // looks salvos
    const outfits = this.game.outfits;
    this.wardSlots.replaceChildren(...Array.from({ length: 6 }, (_, k) => {
      const o = outfits[k];
      return h('div', { class: 'slot' },
        h('button', { class: 'slot-prev', title: o ? 'Vestir este look' : 'Vazio', onclick: () => { if (o) { this.draft = { ...o, name: this.draft.name }; this.renderWardrobe(); } } }, o ? crop(avatarSprite(o, 'stand', 0, 1), -18, -96, 36, 98) : ''),
        h('button', { class: 'btn small', title: 'Guardar o look atual aqui', onclick: () => { this.game.outfits[k] = { ...this.draft }; this.game.save(); this.renderWardrobe(); } }, 'Guardar'));
    }));
  }

  // ------------------------------------------------------------ quarto
  buildRoom() {
    this.roomBody = h('div', { class: 'room-body' });
    this.window('room', 'Ajustes do Quarto', this.roomBody, { cls: 'roomwin' });
  }

  refreshRoom() { if (this.isOpen('room')) this.renderRoom(); }

  renderRoom() {
    const g = this.game, r = g.room;
    const upd = () => { r.touch(); g.save(); this.renderRoom(); };
    const styleRow = (list, cur, onPick) => h('div', { class: 'opts' }, ...list.map((s) => h('button', { class: 'btn small' + (cur.style === s.id ? ' on' : ''), onclick: () => onPick(s) }, s.name)));
    const colorRow = (list, cur, onPick) => h('div', { class: 'swatches' }, ...list.colors.map((c, i) => h('button', { class: 'swatch' + (cur.color === i ? ' on' : ''), style: `background:${c}`, onclick: () => onPick(i) })));
    const fs = FLOOR_STYLES.find((s) => s.id === r.floor.style) || FLOOR_STYLES[0];
    const ws = WALL_STYLES.find((s) => s.id === r.wall.style) || WALL_STYLES[0];
    this.planSel = this.planSel || 'retangulo';
    const applySize = (w, d, plan) => {
      const run = () => {
        const removed = r.resize(w, d, plan);
        for (const it of removed) g.invAdd(it.id, it.variant || 0);
        const fix = (e) => { if (!r.walkable(e.tx, e.ty)) { [e.tx, e.ty] = r.doorTile; e.x = e.tx * TILE + 16; e.y = e.ty * TILE + 16; e.path = []; } };
        g.avatar.standUp(); fix(g.avatar); g.pets.forEach(fix);
        g.onResize(); upd();
        if (removed.length) this.toast(`${removed.length} mobi(s) foram para o inventário`);
      };
      const shrink = w < r.w || d < r.d || plan !== 'retangulo';
      if (shrink) this.ask('Mobílias que ficarem fora da nova planta vão para o seu inventário. Continuar?', 'Aplicar', run, false);
      else run();
    };
    this.roomBody.replaceChildren(
      h('label', {}, 'Piso'), styleRow(FLOOR_STYLES, r.floor, (s) => { r.floor = { style: s.id, color: 0 }; upd(); }),
      colorRow(fs, r.floor, (i) => { r.floor.color = i; upd(); }),
      h('label', {}, 'Parede'), styleRow(WALL_STYLES, r.wall, (s) => { r.wall = { style: s.id, color: 0 }; upd(); }),
      colorRow(ws, r.wall, (i) => { r.wall.color = i; upd(); }),
      h('label', {}, 'Formato da planta'),
      h('div', { class: 'opts' }, ...PLANS.map((p) => h('button', { class: 'btn small' + (this.planSel === p.id ? ' on' : ''), onclick: () => { this.planSel = p.id; this.renderRoom(); } }, p.name))),
      h('div', { class: 'opts' }, ...ROOM_SIZES.map(([w, d]) => h('button', { class: 'btn small' + (r.w === w && r.d === d ? ' on' : ''), onclick: () => applySize(w, d, this.planSel) }, `${w}×${d}`))),
      h('div', { class: 'opts' },
        h('button', { class: 'btn small' + (g.editPlan ? ' on' : ''), onclick: () => g.toggleEditPlan() }, g.editPlan ? 'Terminar edição' : 'Editar piso a piso'),
        h('span', { class: 'note' }, `${r.tiles.filter((t) => t).length} pisos`)),
      h('label', {}, 'Ambiente'), h('div', { class: 'opts' }, ...['auto', 'day', 'dusk', 'night'].map((e) => h('button', { class: 'btn small' + (g.envMode === e ? ' on' : ''), onclick: () => { g.envMode = e; this.updateEnvIcon(); g.save(); this.renderRoom(); } }, ENV_LABEL[e].split(' ')[0]))),
      h('label', {}, 'Salvar'), h('div', { class: 'opts' },
        h('button', { class: 'btn small', onclick: () => this.askText('Código do quarto', JSON.stringify(g.toData()), () => {}, { multiline: true, copy: true, select: true, okLabel: 'Fechar', text: 'Copie este código para guardar ou compartilhar seu quarto.' }) }, 'Exportar'),
        h('button', { class: 'btn small', onclick: () => this.askText('Importar quarto', '', (txt) => { try { g.reset(JSON.parse(txt)); this.toast('Quarto importado!'); } catch { this.toast('Código inválido: cole o texto exportado.'); } }, { multiline: true, okLabel: 'Carregar', text: 'Cole aqui um código exportado.' }) }, 'Importar'),
        h('button', { class: 'btn small danger', onclick: () => this.ask('Recomeçar com o apartamento inicial? O quarto atual será perdido.', 'Recomeçar', () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ok */ } g.reset(null); }) }, 'Recomeçar')),
      h('p', { class: 'note' }, 'Tudo é salvo automaticamente neste navegador. Use Exportar para levar o quarto para outro lugar.'),
    );
    void planTiles;
  }

  // ------------------------------------------------------------- ajuda
  buildHelp() {
    const rows = [
      ['Clique no chão', 'andar até lá'],
      ['WASD / setas', 'andar com o teclado'],
      ['Clique num sofá/cama', 'sentar ou deitar'],
      ['Duplo clique', 'usar mobi: luz, porta, TV, comida…'],
      ['Comidas', 'o avatar pega uma porção e come'],
      ['Catálogo  ·  C', 'comprar mobílias'],
      ['Inventário  ·  I', 'mobis guardadas'],
      ['R / botão direito', 'girar mobi'],
      ['M  ·  Delete', 'mover  ·  guardar mobi'],
      ['Enter', 'conversar (o/ acena, :dançar)'],
      ['Arrastar  ·  roda', 'mover a câmera  ·  zoom'],
    ];
    const body = h('div', { class: 'help-body' },
      h('p', {}, 'Bem-vindo ao seu ', h('b', {}, 'Cantinho'), '! Decore, construa, mergulhe na piscina, cozinhe, coma bolo e cuide dos pets.'),
      h('table', {}, ...rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))),
      h('p', { class: 'note' }, 'Dica: em Quarto você muda o formato da planta e edita o piso tile a tile. O interruptor na parede apaga todas as luzes!'),
      h('button', { class: 'btn primary', onclick: () => this.close('help') }, 'Vamos lá!'));
    this.window('help', 'Como jogar', body, { cls: 'help' });
  }

  // --------------------------------------------------- diálogos próprios
  buildAsk() {
    this.askBody = h('div', { class: 'ask-body' });
    this.askWin = this.window('ask', 'Confirmar', this.askBody);
  }

  ask(text, yesLabel, onYes, danger = true) {
    this.askWin.querySelector('.win-title span').textContent = 'Confirmar';
    this.askBody.replaceChildren(h('p', {}, text), h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => this.close('ask') }, 'Cancelar'),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { this.close('ask'); onYes(); } }, yesLabel)));
    this.open('ask');
  }

  askText(title, value, onOk, opts = {}) {
    this.askWin.querySelector('.win-title span').textContent = title;
    const field = opts.multiline ? h('textarea', { id: 'ask-text', spellcheck: 'false' }) : h('input', { id: 'ask-text', maxlength: opts.max || 16 });
    field.value = value;
    const ok = () => { this.close('ask'); onOk(field.value); };
    if (!opts.multiline) field.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    this.askBody.replaceChildren(opts.text ? h('p', {}, opts.text) : null, field, h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => this.close('ask') }, 'Cancelar'),
      opts.copy ? h('button', { class: 'btn', onclick: () => this.copy(field) }, 'Copiar') : null,
      h('button', { class: 'btn primary', onclick: ok }, opts.okLabel || 'OK')));
    this.open('ask');
    setTimeout(() => { field.focus(); if (opts.select) field.select(); }, 30);
  }

  copy(field) {
    const fallback = () => { field.focus(); field.select(); this.toast('Selecionado: use Ctrl+C'); };
    try { navigator.clipboard.writeText(field.value).then(() => this.toast('Código copiado!'), fallback); } catch { fallback(); }
  }

  // --------------------------------------------------- painel de info
  closeCard() { this.card.classList.add('hidden'); this.cardSel = null; }

  showCard(sel) {
    this.cardSel = sel;
    if (!sel) { this.closeCard(); return; }
    this.refreshCard();
  }

  refreshCard() {
    const sel = this.cardSel, g = this.game;
    if (!sel) return;
    const btn = (label, fn, cls = '') => h('button', { class: 'btn small ' + cls, onclick: fn }, label);
    let title, preview, info, actions = [];
    if (sel.kind === 'avatar') {
      const a = g.avatar;
      title = g.look.name;
      preview = scaled(avatarSprite(g.look, 'stand', 0, 1).canvas, 1);
      info = a.hand ? `Segurando: ${HAND_ITEMS[a.hand.item].name.toLowerCase()}.` : 'É você! Troque de roupa no guarda-roupa.';
      actions = [btn('Acenar', () => g.emote('wave')), btn('Dançar', () => g.emote('dance')), btn('Sentar', () => g.emote('sit')), btn('Guarda-roupa', () => this.open('wardrobe'))];
      if (a.hand) actions.unshift(btn('Comer/Beber', () => g.emote('sip'), 'primary'), btn('Largar', () => { a.drop(); this.refreshCard(); }));
    } else if (sel.kind === 'pet') {
      const p = sel.ref;
      title = p.name;
      preview = scaled(petSprite(p.kind, p.color, 'sit', 0, 1).canvas, 1.5);
      const bar = (label, v, color) => h('div', { class: 'bar' }, h('span', {}, label), h('i', {}, h('b', { style: `width:${Math.round(v)}%;background:${color}` })));
      const moods = { sleep: 'dormindo', eat: 'comendo', happy: 'feliz!', walk: 'passeando', sit: 'de boa', idle: 'de boa' };
      info = [h('div', {}, `${PET_KINDS[p.kind].name} · ${moods[p.state] || 'de boa'}`),
        bar('Fome', p.hunger, '#e2683c'), bar('Energia', p.energy, '#6fd3a0'), bar('Carinho', Math.min(100, p.love * 10), '#ff6b8a')];
      actions = [btn('Carinho', () => g.petAction(p, 'pet')), btn('Petisco', () => g.petAction(p, 'treat')), btn('Chamar', () => g.petAction(p, 'call')),
        btn('Renomear', () => this.askText('Novo nome', p.name, (n) => { if (n.trim()) { p.name = n.trim().slice(0, 16); g.save(); this.refreshCard(); } }, { select: true })),
        btn('Guardar', () => g.storePet(p), 'danger')];
    } else {
      const it = sel.ref, def = FURNI[it.id];
      title = def.name;
      const spr = furniSprite(def, { rot: it.rot ?? (it.wall === 'L' ? 1 : 0), state: it.state, variant: it.variant, env: g.env, time: { h: 10, m: 10 }, nb: def.autotile ? g.room.poolMask(it.x, it.y) : 0 });
      preview = scaled(spr.canvas, spr.w > 180 || spr.h > 180 ? 0.4 : spr.w > 90 || spr.h > 110 ? 0.75 : 1, spr.w > 90 || spr.h > 110);
      info = [def.desc || ''];
      if (def.food) {
        const left = def.food.portions - it.state;
        info.push(h('div', { class: 'state' }, left > 0 ? `Restam ${left} de ${def.food.portions}` : 'Acabou!'));
        actions.push(left > 0 ? btn(['cafe', 'cha', 'suco'].includes(def.food.item) ? 'Beber' : 'Comer', () => g.use(it), 'primary') : btn('Repor', () => g.refill(it), 'primary'));
      } else if (def.dispenser) {
        actions.push(btn('Pegar ' + HAND_ITEMS[def.dispenser[0]].name.toLowerCase() + (def.dispenser.length > 1 ? '…' : ''), () => g.use(it), 'primary'));
        if (def.states) info.push(h('div', { class: 'state' }, 'Estado: ', h('b', {}, def.states[it.state])));
      } else if (def.states) {
        info.push(h('div', { class: 'state' }, 'Estado: ', h('b', {}, def.states[it.state])));
        actions.push(btn(def.id === 'porta_entrada' ? (it.state ? 'Fechar' : 'Abrir') : 'Usar', () => g.use(it), 'primary'));
      }
      if (def.sit || def.lay) actions.push(btn(def.lay ? 'Deitar' : 'Sentar', () => {
        const [fw, fd] = g.room.footprint(it);
        const tx = it.x + Math.floor((fw - 1) / 2), ty = it.y + Math.floor((fd - 1) / 2);
        g.avatar.walkTo(g, tx, ty, () => g.avatar.sitOn(g, it, tx, ty));
      }));
      if (!def.fixed) {
        if (!def.wall && (def.rots || 4) > 1) actions.push(btn('Girar', () => g.rotate(it)));
        actions.push(btn('Mover', () => g.move(it)));
        if (def.variants && def.variants.length > 1) actions.push(btn('Pintar', () => g.recolor(it)));
        actions.push(btn('Guardar', () => g.pickUp(it), 'danger'));
      }
    }
    this.card.replaceChildren(
      h('header', { class: 'win-title' }, h('span', {}, title), h('button', { class: 'x', onclick: () => g.select(null) }, '×')),
      h('div', { class: 'card-body' }, h('div', { class: 'preview' }, preview), h('div', { class: 'info' }, info)),
      h('div', { class: 'card-actions' }, ...actions));
    this.card.classList.remove('hidden');
  }
}
