// Interface: barra de ferramentas, catálogo, editor de visual, ajustes do
// quarto, painel de informações (estilo "infostand" do Habbo) e balões de fala.

import { FURNI, CATEGORIES } from './furniture.js';
import { thumb, furniSprite } from './sprites.js';
import { avatarSprite, petSprite, LOOK_OPTIONS, PET_KINDS } from './characters.js';
import { FLOOR_STYLES, WALL_STYLES, ROOM_SIZES } from './room.js';
import { SAVE_KEY } from './config.js';

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

function scaled(canvas, s) {
  const c = document.createElement('canvas');
  c.width = canvas.width * s;
  c.height = canvas.height * s;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(canvas, 0, 0, c.width, c.height);
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

export class UI {
  constructor(game) {
    this.game = game;
    this.bubbles = [];
    this.root = document.getElementById('ui');
    this.buildToolbar();
    this.buildChat();
    this.buildCatalog();
    this.buildLook();
    this.buildRoom();
    this.buildHelp();
    this.card = h('section', { id: 'card', class: 'win card hidden' });
    this.root.append(this.card);
    this.tag = h('div', { id: 'nametag', class: 'hidden' });
    this.hintEl = h('div', { id: 'hint', class: 'hidden' });
    this.toastEl = h('div', { id: 'toast' });
    this.bubbleLayer = h('div', { id: 'bubbles' });
    this.root.append(this.tag, this.hintEl, this.toastEl, this.bubbleLayer,
      h('div', { id: 'title' }, h('span', { class: 'logo' }, 'Cantinho'), h('span', { class: 'sub' }, 'meu quartinho pixelado')));
    this.buildAsk();
    let fresh = true;
    try { fresh = !localStorage.getItem(SAVE_KEY); } catch { /* sem armazenamento */ }
    if (fresh) setTimeout(() => this.open('help'), 1600);
  }

  // ------------------------------------------------------------ util
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
    if (id === 'look') this.renderLook();
    if (id === 'room') this.renderRoom();
    if (id === 'catalog') this.renderCatalog();
  }

  close(id) { $('#win-' + id)?.classList.add('hidden'); }

  toggle(id) {
    const w = $('#win-' + id);
    if (w.classList.contains('hidden')) this.open(id);
    else this.close(id);
  }

  closeWindows() { for (const w of document.querySelectorAll('.win:not(.card)')) w.classList.add('hidden'); }

  hint(text) {
    this.hintEl.textContent = text;
    this.hintEl.classList.toggle('hidden', !text);
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('show'), 1800);
  }

  // --------------------------------------------------------- toolbar
  buildToolbar() {
    const g = this.game;
    const btn = (label, icon, onclick, cls = '') => h('button', { class: 'tool ' + cls, title: label, onclick }, icon, h('span', {}, label));
    this.envIcon = h('span', { class: 'icon' });
    const head = h('span', { class: 'icon' });
    this.headIcon = head;
    const bar = h('nav', { id: 'toolbar' },
      btn('Catálogo', h('span', { class: 'icon' }, thumb(FURNI.sofa, 0, 40)), () => this.toggle('catalog')),
      btn('Visual', head, () => this.toggle('look')),
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
    const c = avatarSprite(this.game.look, 'stand', 'front');
    const crop = document.createElement('canvas');
    crop.width = 20;
    crop.height = 20;
    crop.getContext('2d').drawImage(c, 0, -4);
    this.headIcon.replaceChildren(scaled(crop, 2));
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

  // ------------------------------------------------------------ chat
  buildChat() {
    this.chatInput = h('input', { id: 'chat-input', maxlength: 90, placeholder: 'Diga algo… (Enter)  ·  o/  :dançar  :sentar', autocomplete: 'off' });
    const form = h('form', {
      id: 'chat', onsubmit: (e) => {
        e.preventDefault();
        this.game.say(this.chatInput.value);
        this.chatInput.value = '';
      },
    }, this.chatInput, h('button', { class: 'btn', type: 'submit' }, 'Falar'));
    this.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.blurChat(); });
    this.root.append(form);
  }

  focusChat() { this.chatInput.focus(); }
  blurChat() { this.chatInput.blur(); }

  bubble(entity, text, small) {
    const isAv = entity === this.game.avatar;
    const name = isAv ? this.game.look.name : entity.name;
    const color = isAv ? this.game.look.shirt : '#8f7bc2';
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
      const isAv = e === this.game.avatar;
      const [x, y] = R.worldToClient(e.x, e.y, e.z + (isAv ? (e.pose === 'lay' ? 14 : 36) : 16));
      const n = stacks.get(e) || 0;
      stacks.set(e, n + b.el.offsetHeight + 4);
      b.el.style.transform = `translate(${Math.round(x - b.el.offsetWidth / 2)}px, ${Math.round(y - b.el.offsetHeight - 8 - n)}px)`;
      b.el.style.opacity = age > b.life - 600 ? (b.life - age) / 600 : 1;
    }
    if (this.tagEntity) {
      const e = this.tagEntity;
      const isAv = e === this.game.avatar;
      const [x, y] = R.worldToClient(e.x, e.y, e.z + (isAv ? 36 : 16));
      this.tag.style.transform = `translate(${Math.round(x - this.tag.offsetWidth / 2)}px, ${Math.round(y - 30 - (stacks.get(e) || 0))}px)`;
    }
  }

  // --------------------------------------------------------- catálogo
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
      const icon = en.type === 'pet' ? scaled(petSprite(en.kind, 0, 'sit'), 2) : thumb(en.def, 0, 52);
      const on = this.catSel && (en.type === 'pet' ? this.catSel.kind === en.kind : this.catSel.def === en.def);
      return h('button', {
        class: 'cat-item' + (on ? ' on' : ''), title: en.type === 'pet' ? PET_KINDS[en.kind].name : en.def.name,
        onclick: () => { this.catSel = en; this.catVariant = 0; this.catRot = 0; this.renderCatalog(); },
        ondblclick: () => this.placeFromCatalog(),
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
      preview = scaled(petSprite(en.kind, this.catVariant, 'stand'), 4);
      name = K.name;
      desc = en.kind === 'gato' ? 'Independente, dorminhoco e fofo. Vai explorar o quarto, comer e tirar sonecas.' : 'Leal e brincalhão. Segue você pelo quarto, pede carinho e come na tigela.';
      variants = K.colors.map((c) => c.a);
      action = h('button', { class: 'btn primary', onclick: () => { this.game.adoptPet(en.kind, this.catVariant); } }, 'Adotar');
    } else {
      const d = en.def;
      const spr = furniSprite(d, { rot: d.wall ? 0 : this.catRot, variant: this.catVariant, state: d.states && d.light ? 1 : 0, time: { h: 10, m: 10 } });
      preview = scaled(spr.canvas, spr.w > 70 || spr.h > 80 ? 1 : 2);
      name = d.name;
      desc = d.desc || '';
      variants = d.variants;
      const tags = [];
      if (d.sit) tags.push('sentável');
      if (d.lay) tags.push('deitável');
      if (d.states) tags.push(d.states.length + ' estados');
      if (d.stack) tags.push('empilhável');
      if (d.walk) tags.push('dá p/ pisar');
      if (d.light) tags.push('ilumina');
      if (d.wall) tags.push('de parede');
      desc = [desc, h('div', { class: 'tags' }, ...tags.map((t) => h('span', {}, t)))];
      action = h('div', { class: 'row' },
        !d.wall && (d.rots || 4) > 1 ? h('button', { class: 'btn', onclick: () => { this.catRot = (this.catRot + 1) % (d.rots || 4); this.renderCatDetail(); } }, '↻ Girar') : null,
        h('button', { class: 'btn primary', onclick: () => this.placeFromCatalog() }, 'Colocar no quarto'));
    }
    const sw = h('div', { class: 'swatches' }, ...(variants || []).map((c, i) => h('button', {
      class: 'swatch' + (i === this.catVariant ? ' on' : ''), style: `background:${c}`, title: 'Cor ' + (i + 1),
      onclick: () => { this.catVariant = i; this.renderCatDetail(); },
    })));
    this.catDetail.replaceChildren(h('div', { class: 'preview' }, preview), h('div', { class: 'info' }, h('h3', {}, name), h('div', { class: 'desc' }, desc), variants && variants.length > 1 ? sw : null, action));
  }

  placeFromCatalog() {
    const en = this.catSel;
    if (!en) return;
    if (en.type === 'pet') { this.game.adoptPet(en.kind, this.catVariant); return; }
    this.game.startPlacing({ id: en.def.id, variant: this.catVariant, rot: en.def.wall ? 0 : this.catRot });
    if (window.innerWidth < 760) this.close('catalog');
  }

  // ------------------------------------------------------------ visual
  buildLook() {
    this.lookBody = h('div', { class: 'look-body' });
    this.window('look', 'Meu Visual', this.lookBody, { cls: 'look' });
  }

  renderLook() {
    const g = this.game, L = g.look;
    const set = (k, v) => { g.setLook({ [k]: v }); this.updateHeadIcon(); this.renderLook(); };
    const sw = (k, list) => h('div', { class: 'swatches' }, ...list.map((c) => h('button', { class: 'swatch' + (L[k] === c ? ' on' : ''), style: `background:${c}`, onclick: () => set(k, c) })));
    const opts = (k, list, labels) => h('div', { class: 'opts' }, ...list.map((v, i) => h('button', { class: 'btn small' + (L[k] === v ? ' on' : ''), onclick: () => set(k, v) }, labels ? labels[i] : v)));
    const views = ['front', 'back'];
    const pv = h('div', { class: 'look-preview' }, ...views.map((v) => scaled(avatarSprite(L, 'stand', v), 4)), scaled(avatarSprite(L, 'wave0', 'front'), 4));
    const name = h('input', { value: L.name, maxlength: 16, onchange: (e) => set('name', e.target.value || 'Você') });
    this.lookBody.replaceChildren(pv, h('div', { class: 'look-opts' },
      h('label', {}, 'Nome'), name,
      h('label', {}, 'Pele'), sw('skin', LOOK_OPTIONS.skin),
      h('label', {}, 'Cabelo'), opts('hairStyle', LOOK_OPTIONS.hairStyle, ['Curto', 'Longo', 'Coque', 'Cacheado']),
      h('label', {}, 'Cor do cabelo'), sw('hair', LOOK_OPTIONS.hair),
      h('label', {}, 'Camisa'), sw('shirt', LOOK_OPTIONS.shirt),
      h('label', {}, 'Calça'), sw('pants', LOOK_OPTIONS.pants),
      h('label', {}, 'Chapéu'), opts('hat', LOOK_OPTIONS.hat, ['Nenhum', 'Bruxa', 'Gorro', 'Flor']),
      L.hat !== 'nenhum' && L.hat !== 'flor' ? [h('label', {}, 'Cor do chapéu'), sw('hatColor', LOOK_OPTIONS.hatColor)] : null,
    ));
  }

  // ------------------------------------------------------------ quarto
  buildRoom() {
    this.roomBody = h('div', { class: 'room-body' });
    this.window('room', 'Ajustes do Quarto', this.roomBody, { cls: 'roomwin' });
  }

  renderRoom() {
    const g = this.game, r = g.room;
    const upd = () => { r.touch(); g.save(); this.renderRoom(); };
    const styleRow = (list, cur, onPick) => h('div', { class: 'opts' }, ...list.map((s) => h('button', { class: 'btn small' + (cur.style === s.id ? ' on' : ''), onclick: () => onPick(s) }, s.name)));
    const colorRow = (list, cur, onPick) => h('div', { class: 'swatches' }, ...list.colors.map((c, i) => h('button', { class: 'swatch' + (cur.color === i ? ' on' : ''), style: `background:${c}`, onclick: () => onPick(i) })));
    const fs = FLOOR_STYLES.find((s) => s.id === r.floor.style) || FLOOR_STYLES[0];
    const ws = WALL_STYLES.find((s) => s.id === r.wall.style) || WALL_STYLES[0];
    const envs = ['auto', 'day', 'dusk', 'night'];
    this.roomBody.replaceChildren(
      h('label', {}, 'Piso'), styleRow(FLOOR_STYLES, r.floor, (s) => { r.floor = { style: s.id, color: 0 }; upd(); }),
      colorRow(fs, r.floor, (i) => { r.floor.color = i; upd(); }),
      h('label', {}, 'Parede'), styleRow(WALL_STYLES, r.wall, (s) => { r.wall = { style: s.id, color: 0 }; upd(); }),
      colorRow(ws, r.wall, (i) => { r.wall.color = i; upd(); }),
      h('label', {}, 'Tamanho'), h('div', { class: 'opts' }, ...ROOM_SIZES.map(([w, d]) => h('button', {
        class: 'btn small' + (r.w === w && r.d === d ? ' on' : ''),
        onclick: () => {
          const apply = () => {
          r.resize(w, d);
          const a = g.avatar;
          if (!r.inside(a.tx, a.ty)) { a.standUp(); [a.tx, a.ty] = r.doorTile; a.x = a.tx * 16 + 8; a.y = a.ty * 16 + 8; a.path = []; }
          for (const p of g.pets) if (!r.inside(p.tx, p.ty)) { [p.tx, p.ty] = r.doorTile; p.x = p.tx * 16 + 8; p.y = p.ty * 16 + 8; p.path = []; }
          g.onResize(); upd();
          };
          if (w < r.w || d < r.d) this.ask('Diminuir o quarto remove as mobílias que ficarem de fora. Continuar?', 'Diminuir', apply);
          else apply();
        },
      }, `${w}×${d}`))),
      h('label', {}, 'Ambiente'), h('div', { class: 'opts' }, ...envs.map((e) => h('button', { class: 'btn small' + (g.envMode === e ? ' on' : ''), onclick: () => { g.envMode = e; this.updateEnvIcon(); g.save(); this.renderRoom(); } }, ENV_LABEL[e].split(' ')[0]))),
      h('label', {}, 'Salvar'), h('div', { class: 'opts' },
        h('button', {
          class: 'btn small', onclick: () => this.askText('Código do quarto', JSON.stringify(g.toData()), () => {}, {
            multiline: true, copy: true, select: true, okLabel: 'Fechar', text: 'Copie este código para guardar ou compartilhar seu quarto.',
          }),
        }, 'Exportar'),
        h('button', {
          class: 'btn small', onclick: () => this.askText('Importar quarto', '', (txt) => {
            try { g.reset(JSON.parse(txt)); this.toast('Quarto importado!'); } catch { this.toast('Código inválido: cole o texto exportado.'); }
          }, { multiline: true, okLabel: 'Carregar', text: 'Cole aqui um código exportado.' }),
        }, 'Importar'),
        h('button', {
          class: 'btn small danger', onclick: () => this.ask('Recomeçar com o quarto inicial? O quarto atual será perdido.', 'Recomeçar', () => {
            try { localStorage.removeItem(SAVE_KEY); } catch { /* ok */ }
            g.reset(null);
          }),
        }, 'Recomeçar')),
      h('p', { class: 'note' }, 'Tudo é salvo automaticamente neste navegador. Use Exportar para levar o quarto para outro lugar.'),
    );
  }

  // ------------------------------------------------- diálogos próprios
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
    const field = opts.multiline
      ? h('textarea', { id: 'ask-text', spellcheck: 'false' })
      : h('input', { id: 'ask-text', maxlength: opts.max || 16 });
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
    try {
      navigator.clipboard.writeText(field.value).then(() => this.toast('Código copiado!'), fallback);
    } catch { fallback(); }
  }

  // ------------------------------------------------------------ ajuda
  buildHelp() {
    const rows = [
      ['Clique no chão', 'andar até lá'],
      ['WASD / setas', 'andar com o teclado'],
      ['Clique num sofá/cama', 'sentar ou deitar'],
      ['Duplo clique', 'usar mobi (luz, porta, TV…)'],
      ['Catálogo', 'escolher e colocar mobílias'],
      ['R / botão direito', 'girar mobi'],
      ['M  ·  Delete', 'mover  ·  guardar mobi'],
      ['Enter', 'conversar (o/ acena, :dançar)'],
      ['Arrastar', 'mover a câmera  ·  roda = zoom'],
    ];
    const body = h('div', { class: 'help-body' },
      h('p', {}, 'Bem-vindo ao seu ', h('b', {}, 'Cantinho'), '! Decore, construa, cuide dos pets e deixe o quarto com a sua cara.'),
      h('table', {}, ...rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b)))),
      h('p', { class: 'note' }, 'Dica: mesas, criados e balcões aceitam objetos empilhados em cima. Portas fechadas bloqueiam a passagem!'),
      h('button', { class: 'btn primary', onclick: () => this.close('help') }, 'Vamos lá!'));
    this.window('help', 'Como jogar', body, { cls: 'help' });
  }

  // ---------------------------------------------------- painel de info
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
      title = g.look.name;
      preview = scaled(avatarSprite(g.look, 'stand', 'front'), 3);
      info = 'É você! Personalize seu visual a qualquer momento.';
      actions = [btn('Acenar', () => g.emote('wave')), btn('Dançar', () => g.emote('dance')), btn('Sentar', () => g.emote('sit')), btn('Visual', () => this.open('look'))];
    } else if (sel.kind === 'pet') {
      const p = sel.ref;
      title = p.name;
      preview = scaled(petSprite(p.kind, p.color, 'sit'), 3);
      const bar = (label, v, color) => h('div', { class: 'bar' }, h('span', {}, label), h('i', {}, h('b', { style: `width:${Math.round(v)}%;background:${color}` })));
      const moods = { sleep: 'dormindo', eat: 'comendo', happy: 'feliz!', walk: 'passeando', sit: 'de boa', idle: 'de boa' };
      info = [h('div', {}, `${PET_KINDS[p.kind].name} · ${moods[p.state] || 'de boa'}`),
        bar('Fome', p.hunger, '#e2683c'), bar('Energia', p.energy, '#6fd3a0'), bar('Carinho', Math.min(100, p.love * 10), '#ff6b8a')];
      actions = [btn('Carinho', () => g.petAction(p, 'pet')), btn('Petisco', () => g.petAction(p, 'treat')), btn('Chamar', () => g.petAction(p, 'call')),
        btn('Renomear', () => this.askText('Novo nome', p.name, (n) => { if (n.trim()) { p.name = n.trim().slice(0, 16); g.save(); this.refreshCard(); } }, { select: true })),
        btn('Devolver', () => this.ask(`Devolver ${p.name} para o abrigo?`, 'Devolver', () => g.petAction(p, 'remove')), 'danger')];
    } else {
      const it = sel.ref, def = FURNI[it.id];
      title = def.name;
      const spr = furniSprite(def, { rot: it.rot, state: it.state, variant: it.variant, env: g.env, time: { h: 10, m: 10 } });
      preview = scaled(spr.canvas, spr.w > 64 || spr.h > 64 ? 1 : 2);
      info = [def.desc || '', def.states ? h('div', { class: 'state' }, 'Estado: ', h('b', {}, def.states[it.state])) : null];
      if (def.states) actions.push(btn(def.states.length === 2 ? (it.state ? 'Desfazer' : 'Usar') : 'Usar', () => g.use(it), 'primary'));
      if (def.states && def.id === 'porta_entrada') actions[0] = btn(it.state ? 'Fechar' : 'Abrir', () => g.use(it), 'primary');
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
