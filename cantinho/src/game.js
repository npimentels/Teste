// Controlador principal: liga quarto, personagens, renderizador e interface.

import { TILE, WALL_H, SAVE_KEY } from './config.js';
import { Room, starterRoom } from './room.js';
import { FURNI } from './furniture.js';
import { Avatar, Pet, viewFor } from './entities.js';
import { Renderer } from './renderer.js';
import { DEFAULT_LOOK, PET_KINDS } from './characters.js';
import { UI } from './ui.js';

class Fx {
  constructor() { this.list = []; }
  spawn(icon, x, y, z) {
    this.list.push({ icon, x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, z, vz: 10 + Math.random() * 6, life: 1.4 });
  }
  update(dt) {
    for (const p of this.list) { p.z += p.vz * dt; p.life -= dt; p.x += Math.sin(p.life * 6) * 0.15; }
    this.list = this.list.filter((p) => p.life > 0);
  }
}

const KEYDIR = {
  ArrowUp: [-1, -1], KeyW: [-1, -1], ArrowDown: [1, 1], KeyS: [1, 1],
  ArrowLeft: [-1, 1], KeyA: [-1, 1], ArrowRight: [1, -1], KeyD: [1, -1],
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.fx = new Fx();
    this.keys = new Set();
    this.placing = null;
    this.selected = null;
    this.hovered = null;
    this.hoverTile = null;
    this.envMode = 'auto';
    this.load();
    this.ui = new UI(this);
    this.bindInput();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    this.enter();
  }

  // ------------------------------------------------------------ salvar
  load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
    this.fromData(data);
  }

  fromData(data) {
    if (data && data.room) {
      this.room = new Room(data.room);
      this.look = { ...DEFAULT_LOOK, ...data.look };
      this.envMode = data.envMode || 'auto';
      this.renderer.zoomBias = data.zoomBias || 0;
      this.petData = data.pets || [];
    } else {
      this.room = starterRoom();
      this.look = { ...DEFAULT_LOOK };
      this.petData = [
        { uid: 1, kind: 'cachorro', color: 0, name: 'Paçoca', tx: 6, ty: 4 },
        { uid: 2, kind: 'gato', color: 0, name: 'Mingau', tx: 8, ty: 6 },
      ];
    }
    const [dx, dy] = this.room.doorTile;
    this.avatar = new Avatar(dx, dy, this.look);
    this.avatar.game = this;
    this.pets = this.petData.map((p) => new Pet(p));
    for (const p of this.pets) if (!this.room.walkable(p.tx, p.ty, { pet: true })) { p.tx = dx + 1; p.ty = dy; p.x = p.tx * TILE + 8; p.y = p.ty * TILE + 8; }
  }

  toData() {
    return { v: 1, room: this.room.toJSON(), look: this.look, pets: this.pets.map((p) => p.toJSON()), envMode: this.envMode, zoomBias: this.renderer.zoomBias };
  }

  save() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.toData())); } catch { /* sem armazenamento */ }
    }, 400);
  }

  reset(data) {
    this.placing = null;
    this.selected = null;
    this.ui.closeCard();
    this.fromData(data);
    this.onResize();
    this.save();
    this.enter();
  }

  // Entrada em cena: a porta abre, você entra, a porta fecha.
  enter() {
    const door = this.room.door;
    door.state = 1;
    const [dx, dy] = this.room.doorTile;
    this.avatar.face = viewFor(1, 0);
    setTimeout(() => {
      if (this.room.walkable(dx + 1, dy)) this.avatar.walkTo(this, dx + 1, dy);
      setTimeout(() => { door.state = 0; }, 900);
    }, 500);
  }

  get env() {
    if (this.envMode !== 'auto') return this.envMode;
    const h = new Date().getHours();
    return h >= 6 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night';
  }

  // ----------------------------------------------------------- laço
  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt, now / 1000);
      this.renderer.render(this, now / 1000);
      this.ui.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.keyboardWalk();
    this.avatar.update(dt, this);
    for (const p of this.pets) p.update(dt, this);
    this.fx.update(dt);
    if (this.avatar.pose === 'dance' && Math.random() < dt * 2) this.fx.spawn('note', this.avatar.x, this.avatar.y, 36);
    if (this.avatar.pose === 'lay' && Math.random() < dt * 0.7) this.fx.spawn('zzz', this.avatar.x, this.avatar.y, this.avatar.z + 14);
  }

  keyboardWalk() {
    const a = this.avatar;
    if (a.moving || this.ui.typing()) return;
    let dx = 0, dy = 0;
    for (const k of this.keys) if (KEYDIR[k]) { dx += KEYDIR[k][0]; dy += KEYDIR[k][1]; }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!dx && !dy) return;
    const nx = a.tx + dx, ny = a.ty + dy;
    const r = this.room;
    if (r.walkable(nx, ny) && (!dx || !dy || (r.walkable(a.tx + dx, a.ty) && r.walkable(a.tx, a.ty + dy)))) a.walkTo(this, nx, ny);
    else a.face = viewFor(dx, dy);
  }

  onResize() { this.renderer.resize(this.room); }

  setZoom(delta) {
    this.renderer.zoomBias = Math.max(-3, Math.min(4, this.renderer.zoomBias + delta));
    this.onResize();
    this.save();
  }

  // ---------------------------------------------------------- entrada
  bindInput() {
    const c = this.canvas;
    let down = null;
    c.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, pan: [...this.renderer.pan], moved: false, id: e.pointerId };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved && !this.placing) {
          const z = this.renderer.zoom / this.renderer.dpr;
          this.renderer.pan = [down.pan[0] + dx / z, down.pan[1] + dy / z];
        }
      }
      this.hover(e.clientX, e.clientY);
    });
    c.addEventListener('pointerup', (e) => {
      const d = down;
      down = null;
      if (d && !d.moved) this.click(e.clientX, e.clientY, e.shiftKey);
      else if (d && this.placing) this.click(e.clientX, e.clientY, e.shiftKey);
    });
    c.addEventListener('pointerleave', () => { this.hovered = null; this.hoverTile = null; this.ui.nameTag(null); });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.placing) this.rotatePlacing(); });
    window.addEventListener('keydown', (e) => {
      if (this.ui.typing()) {
        if (e.key === 'Escape') this.ui.blurChat();
        return;
      }
      this.keys.add(e.code);
      if (e.key === 'Enter') { e.preventDefault(); this.ui.focusChat(); }
      else if (e.key === 'Escape') { if (this.placing) this.cancelPlacing(); else this.select(null); this.ui.closeWindows(); }
      else if (e.key === 'r' || e.key === 'R') { if (this.placing) this.rotatePlacing(); else if (this.selected?.kind === 'furni') this.rotate(this.selected.ref); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected && (this.selected.kind === 'furni' || this.selected.kind === 'wall')) this.pickUp(this.selected.ref);
      else if (e.key === 'm' || e.key === 'M') { if (this.selected && (this.selected.kind === 'furni' || this.selected.kind === 'wall')) this.move(this.selected.ref); }
      else if (e.key === 'c' || e.key === 'C') this.ui.toggle('catalog');
      else if (e.key === '+' || e.key === '=') this.setZoom(1);
      else if (e.key === '-') this.setZoom(-1);
      if (KEYDIR[e.code]) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  hover(cx, cy) {
    const R = this.renderer;
    if (!R.o) return;
    const [bx, by] = R.clientToBuf(cx, cy);
    if (this.placing) { this.updatePlacing(bx, by); return; }
    const hit = R.pick(bx, by);
    this.hovered = hit && hit.kind !== 'ghost' ? hit.ref : null;
    const [ux, uy] = R.bufToWorld(bx, by, 0);
    const tx = Math.floor(ux / TILE), ty = Math.floor(uy / TILE);
    this.hoverTile = this.room.inside(tx, ty) && (!hit || hit.flat) ? [tx, ty] : null;
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
    this.ui.nameTag(hit && (hit.kind === 'avatar' || hit.kind === 'pet') ? hit.ref : null);
  }

  tileAt(bx, by, z = 0) {
    const [ux, uy] = this.renderer.bufToWorld(bx, by, z);
    return [Math.floor(ux / TILE), Math.floor(uy / TILE)];
  }

  click(cx, cy, shift) {
    const R = this.renderer;
    const [bx, by] = R.clientToBuf(cx, cy);
    if (this.placing) {
      this.updatePlacing(bx, by);
      this.confirmPlacing(shift);
      return;
    }
    const hit = R.pick(bx, by);
    const av = this.avatar;
    // duplo clique / duplo toque (funciona também no celular)
    const now = performance.now();
    const dbl = hit && this._lastTap && this._lastTap.ref === hit.ref && now - this._lastTap.t < 380;
    this._lastTap = { ref: hit && hit.ref, t: now };
    if (dbl) { this._lastTap = null; this.dblclick(hit); return; }
    if (!hit) {
      const [tx, ty] = this.tileAt(bx, by);
      this.select(null);
      if (this.room.inside(tx, ty)) {
        if (this.room.walkable(tx, ty)) av.walkTo(this, tx, ty);
      }
      return;
    }
    this.select(hit);
    if (hit.kind === 'furni') {
      const it = hit.ref, def = FURNI[it.id];
      if (def.sit || def.lay) {
        const z = def.sit ? it.z + def.sit.z : it.z + def.lay.z;
        let [tx, ty] = this.tileAt(bx, by, z);
        const [fw, fd] = this.room.footprint(it);
        tx = Math.max(it.x, Math.min(it.x + fw - 1, tx));
        ty = Math.max(it.y, Math.min(it.y + fd - 1, ty));
        if (av.seat && av.seat.uid === it.uid) return;
        if (!av.walkTo(this, tx, ty, () => av.sitOn(this, it, tx, ty))) this.ui.toast('Não consigo chegar até lá!');
      } else if (def.flat || def.pet) {
        const [tx, ty] = this.tileAt(bx, by, 0);
        if (this.room.walkable(tx, ty)) av.walkTo(this, tx, ty);
      }
    }
  }

  dblclick(hit) {
    if (hit.kind === 'furni' || hit.kind === 'wall') this.use(hit.ref);
    else if (hit.kind === 'pet') this.petAction(hit.ref, 'pet');
    else if (hit.kind === 'avatar') this.emote('wave');
  }

  select(hit) {
    this.selected = hit && hit.kind !== 'ghost' ? { kind: hit.kind, ref: hit.ref } : null;
    this.ui.showCard(this.selected);
  }

  // --------------------------------------------------------- ações
  isWall(it) { return this.room.wallItems.includes(it); }

  use(it) {
    const def = FURNI[it.id];
    if (!def.states) return;
    const next = (it.state + 1) % def.states.length;
    if (def.walk && typeof def.walk === 'function' && !def.walk(next)) {
      const busy = [this.avatar, ...this.pets].some((e) => e.tx === it.x && e.ty === it.y);
      if (busy) { this.ui.toast('Tem alguém na passagem!'); return; }
    }
    it.state = next;
    this.room.version++;
    if (def.light && next) this.fx.spawn('sparkle', ...this.itemCenter(it));
    this.ui.refreshCard();
    this.save();
  }

  itemCenter(it) {
    const def = FURNI[it.id];
    if (this.isWall(it)) {
      const m = it.pos + def.size[0] / 2;
      return it.wall === 'L' ? [4, m, it.z + def.size[1]] : [m, 4, it.z + def.size[1]];
    }
    const [fw, fd] = this.room.footprint(it);
    return [(it.x + fw / 2) * TILE, (it.y + fd / 2) * TILE, it.z + def.h];
  }

  rotate(it) {
    const def = FURNI[it.id];
    const n = def.rots || 4;
    if (n < 2 || def.wall) return;
    for (let k = 1; k < 4; k++) {
      const rot = (it.rot + k) % 4;
      if (n === 2 && rot > 1) continue;
      const r = this.room.canPlace(it.id, it.x, it.y, rot, it.uid, this.blockers(it));
      if (r.ok) {
        it.rot = rot;
        it.z = r.z;
        this.room.settle();
        this.room.touch();
        if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
        this.save();
        return;
      }
    }
    this.ui.toast('Não tem espaço para girar.');
  }

  recolor(it) {
    const def = FURNI[it.id];
    if (!def.variants || def.variants.length < 2) return;
    it.variant = (it.variant + 1) % def.variants.length;
    this.room.version++;
    this.ui.refreshCard();
    this.save();
  }

  pickUp(it) {
    if (FURNI[it.id].fixed) return;
    if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
    this.room.remove(it.uid);
    this.select(null);
    this.save();
  }

  move(it) {
    const def = FURNI[it.id];
    if (def.fixed) return;
    if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
    this.startPlacing({ id: it.id, variant: it.variant, rot: it.rot, state: it.state, uid: it.uid });
  }

  // Tiles ocupados por personagens (não dá para pôr móvel em cima deles)
  blockers() {
    return [this.avatar, ...this.pets].map((e) => [e.tx, e.ty]);
  }

  startPlacing(p) {
    const def = FURNI[p.id];
    this.select(null);
    this.placing = { rot: def.wall ? 0 : 0, state: 0, ...p, target: null, valid: false };
    if (def.states && def.light && p.uid == null) this.placing.state = 1;
    this.ui.hint(def.wall ? 'Aponte para uma parede · clique para pendurar · Esc cancela' : 'Clique para colocar · R ou botão direito gira · Shift mantém · Esc cancela');
  }

  rotatePlacing() {
    const pl = this.placing, def = FURNI[pl.id];
    if (def.wall) return;
    const n = def.rots || 4;
    pl.rot = (pl.rot + 1) % Math.max(1, n);
    if (this._lastBuf) this.updatePlacing(...this._lastBuf);
  }

  updatePlacing(bx, by) {
    this._lastBuf = [bx, by];
    const pl = this.placing, def = FURNI[pl.id], room = this.room;
    const [ox, oy] = this.renderer.o;
    const sx = bx - ox, sy = by - oy;
    if (def.wall) {
      const [w, h] = def.size;
      let wall, along, z;
      if (sx >= 0) { wall = 'R'; along = sx; z = sx / 2 - sy; }
      else { wall = 'L'; along = -sx; z = -sx / 2 - sy; }
      const pos = Math.round((along - w / 2) / 2) * 2, zz = Math.round((z - h / 2) / 2) * 2;
      if (along < 0 || along > room.wallLen(wall) || z < -10 || z > WALL_H + 20) { pl.target = null; pl.valid = false; return; }
      pl.target = [wall, pos, zz];
      const r = room.canPlaceWall(pl.id, wall, pos, zz, pl.uid ?? -1);
      pl.valid = r.ok;
      pl.why = r.why;
      return;
    }
    const [fw, fd] = pl.rot & 1 ? [def.size[1], def.size[0]] : def.size;
    const [ux, uy] = this.renderer.bufToWorld(bx, by, 0);
    const tx = Math.round(ux / TILE - fw / 2), ty = Math.round(uy / TILE - fd / 2);
    pl.target = [tx, ty];
    const r = room.canPlace(pl.id, tx, ty, pl.rot, pl.uid ?? -1, this.blockers());
    pl.valid = r.ok;
    pl.z = r.z;
    pl.why = r.why;
  }

  confirmPlacing(keep) {
    const pl = this.placing;
    if (!pl || !pl.target) return;
    if (!pl.valid) { this.ui.toast(pl.why || 'Não cabe aqui!'); return; }
    const def = FURNI[pl.id], room = this.room;
    let it;
    if (pl.uid != null) {
      it = def.wall ? room.wallItems.find((i) => i.uid === pl.uid) : room.items.find((i) => i.uid === pl.uid);
      if (def.wall) { [it.wall, it.pos, it.z] = pl.target; it.rot = it.wall === 'L' ? 1 : 0; }
      else { [it.x, it.y] = pl.target; it.rot = pl.rot; it.z = pl.z; }
      room.settle();
      room.touch();
    } else if (def.wall) {
      it = room.addWall(pl.id, ...pl.target, pl.variant);
      if (it) it.state = pl.state || 0;
    } else {
      it = room.add(pl.id, pl.target[0], pl.target[1], pl.rot, pl.variant, pl.state || 0);
    }
    if (it) {
      this.fx.spawn('sparkle', ...this.itemCenter(it));
      this.save();
    }
    if (keep && pl.uid == null) return;
    this.placing = null;
    this.ui.hint('');
    if (it) this.select({ kind: def.wall ? 'wall' : 'furni', ref: it });
  }

  cancelPlacing() {
    this.placing = null;
    this.ui.hint('');
  }

  // ----------------------------------------------------------- pets
  adoptPet(kind, color) {
    if (this.pets.length >= 6) { this.ui.toast('Já tem bichinho demais aqui!'); return; }
    const [dx, dy] = this.room.doorTile;
    const uid = Math.max(0, ...this.pets.map((p) => p.uid)) + 1;
    const p = new Pet({ uid, kind, color, tx: dx, ty: dy });
    this.pets.push(p);
    this.room.door.state = 1;
    setTimeout(() => {
      p.go(this, Math.min(this.room.w - 1, dx + 2), dy);
      setTimeout(() => { this.room.door.state = 0; }, 1200);
    }, 300);
    setTimeout(() => p.say(this, `Oi! Eu sou ${p.name}!`), 900);
    this.save();
    return p;
  }

  petAction(p, act) {
    const av = this.avatar;
    if (act === 'pet' || act === 'treat') {
      const go = () => {
        av.face = viewFor(Math.sign(p.tx - av.tx), Math.sign(p.ty - av.ty));
        if (act === 'pet') p.pet(this); else p.treat(this);
        this.save();
      };
      if (Math.max(Math.abs(av.tx - p.tx), Math.abs(av.ty - p.ty)) <= 1) go();
      else {
        p.path = [];
        p.setState('sit', 6);
        const spot = p.near(this, p.tx, p.ty);
        if (!spot || !av.walkTo(this, spot[0], spot[1], go)) go();
      }
    } else if (act === 'call') p.call(this);
    else if (act === 'remove') {
      this.pets = this.pets.filter((x) => x !== p);
      this.select(null);
      this.save();
    }
    this.ui.refreshCard();
  }

  // ------------------------------------------------------------ chat
  say(text) {
    text = text.trim();
    if (!text) return;
    const cmd = text.toLowerCase();
    if (cmd === 'o/' || cmd === ':acenar') return this.emote('wave');
    if (cmd === ':dancar' || cmd === ':dançar') return this.emote('dance');
    if (cmd === ':sentar') return this.emote('sit');
    if (cmd === ':levantar' || cmd === ':parar') return this.emote('stand');
    this.ui.bubble(this.avatar, text);
    // pets reagem ao próprio nome
    for (const p of this.pets) if (cmd.includes(p.name.toLowerCase())) setTimeout(() => p.call(this), 400);
  }

  emote(kind) {
    const a = this.avatar;
    if (a.moving) a.path = [];
    if (kind === 'stand') { a.standUp(); return; }
    if (kind === 'sit') { a.standUp(); a.pose = 'sit'; return; }
    a.standUp();
    a.pose = kind;
    a.poseTimer = kind === 'wave' ? 2 : 999;
    if (kind === 'wave') this.ui.bubble(a, 'o/');
  }

  setLook(look) {
    Object.assign(this.look, look);
    this.avatar.look = { ...this.look };
    this.save();
  }
}

export { PET_KINDS };
