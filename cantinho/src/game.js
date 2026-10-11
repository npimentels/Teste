// Controlador principal: liga quarto, personagens, renderizador e interface.

import { TILE, WALL_H, SAVE_KEY } from './config.js';
import { Room } from './room.js';
import { FURNI } from './furniture.js';
import { Avatar, Pet } from './entities.js';
import { Renderer } from './renderer.js';
import { DEFAULT_LOOK, HAND_ITEMS, dirFromVec } from './avatar.js';
import { UI } from './ui.js';
import { starterData } from './starter.js';

class Fx {
  constructor() { this.list = []; }
  spawn(icon, x, y, z) {
    this.list.push({ icon, x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, z, vz: 18 + Math.random() * 10, life: 1.4 });
  }
  splash(x, y, small) {
    for (let i = 0; i < (small ? 2 : 6); i++) this.list.push({ icon: 'drop', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, z: -2, vz: 20 + Math.random() * 20, life: 0.6 });
  }
  update(dt) {
    for (const p of this.list) { p.z += p.vz * dt; p.life -= dt; p.x += Math.sin(p.life * 6) * 0.25; if (p.icon === 'crumb' || p.icon === 'drop') p.vz -= 60 * dt; }
    this.list = this.list.filter((p) => p.life > 0);
  }
}

// o interruptor controla só luminárias (não fogão, lareira, TV...)
const NOT_LAMPS = new Set(['fogao', 'fogueira', 'lareira', 'caldeirao', 'geladeira', 'tv_tela', 'tv_parede', 'notebook', 'bola_cristal', 'cristais', 'abobora', 'grimorio', 'aquario', 'velas']);

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
    this.editPlan = false;
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
    if (!data || !data.room) data = starterData();
    this.room = new Room(data.room);
    this.look = { ...DEFAULT_LOOK, ...data.look };
    this.outfits = data.outfits || [];
    this.inventory = data.inventory || [];
    this.storedPets = data.storedPets || [];
    this.envMode = data.envMode || 'auto';
    this.renderer.zoomBias = data.zoomBias || 0;
    const [dx, dy] = this.room.doorTile;
    this.avatar = new Avatar(dx, dy, this.look);
    this.avatar.game = this;
    this.pets = (data.pets || []).map((p) => new Pet(p));
    for (const p of this.pets) if (!this.room.walkable(p.tx, p.ty, { pet: true })) { p.tx = dx + 1; p.ty = dy; p.x = p.tx * TILE + 16; p.y = p.ty * TILE + 16; }
  }

  toData() {
    return {
      v: 2, room: this.room.toJSON(), look: this.look, outfits: this.outfits, inventory: this.inventory,
      pets: this.pets.map((p) => p.toJSON()), storedPets: this.storedPets, envMode: this.envMode, zoomBias: this.renderer.zoomBias,
    };
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
    this.editPlan = false;
    this.ui.closeCard();
    this.fromData(data);
    this.onResize();
    this.save();
    this.enter();
    this.ui.refreshAll();
  }

  enter() {
    const door = this.room.door;
    door.state = 1;
    const [dx, dy] = this.room.doorTile;
    this.avatar.face(1, 0);
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

  // ------------------------------------------------------------- laço
  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
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
    const a = this.avatar;
    if (a.pose === 'dance' && Math.random() < dt * 2) this.fx.spawn('note', a.x, a.y, a.z + 70);
    if (a.pose === 'lay' && Math.random() < dt * 0.7) this.fx.spawn('zzz', a.x, a.y, a.z + 72);
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
    else a.face(dx, dy);
  }

  onResize() { this.renderer.resize(this.room); }

  setZoom(delta) {
    this.renderer.zoomBias = Math.max(-2, Math.min(4, this.renderer.zoomBias + delta));
    this.onResize();
    this.save();
  }

  // ------------------------------------------------------------ entrada
  bindInput() {
    const c = this.canvas;
    let down = null;
    c.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, pan: [...this.renderer.pan], moved: false };
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
      if (d && (!d.moved || this.placing)) this.click(e.clientX, e.clientY, e.shiftKey);
    });
    c.addEventListener('pointerleave', () => { this.hovered = null; this.hoverTile = null; this.ui.nameTag(null); });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.setZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.placing) this.rotatePlacing(); });
    window.addEventListener('keydown', (e) => {
      if (this.ui.typing()) { if (e.key === 'Escape') this.ui.blurChat(); return; }
      this.keys.add(e.code);
      const sel = this.selected;
      const isItem = sel && (sel.kind === 'furni' || sel.kind === 'wall');
      if (e.key === 'Enter') { e.preventDefault(); this.ui.focusChat(); }
      else if (e.key === 'Escape') { if (this.placing) this.cancelPlacing(); else if (this.editPlan) this.toggleEditPlan(false); else this.select(null); this.ui.closeWindows(); }
      else if (e.key === 'r' || e.key === 'R') { if (this.placing) this.rotatePlacing(); else if (sel?.kind === 'furni') this.rotate(sel.ref); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && isItem) this.pickUp(sel.ref);
      else if ((e.key === 'm' || e.key === 'M') && isItem) this.move(sel.ref);
      else if (e.key === 'c' || e.key === 'C') this.ui.toggle('catalog');
      else if (e.key === 'i' || e.key === 'I') this.ui.toggle('inventory');
      else if (e.key === '+' || e.key === '=') this.setZoom(1);
      else if (e.key === '-') this.setZoom(-1);
      if (KEYDIR[e.code]) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  tileAt(bx, by, z = 0) {
    const [ux, uy] = this.renderer.bufToWorld(bx, by, z);
    return [Math.floor(ux / TILE), Math.floor(uy / TILE)];
  }

  hover(cx, cy) {
    const R = this.renderer;
    if (!R.o) return;
    const [bx, by] = R.clientToBuf(cx, cy);
    if (this.placing) { this.updatePlacing(bx, by); return; }
    const [tx, ty] = this.tileAt(bx, by);
    if (this.editPlan) { this.hovered = null; this.hoverTile = tx >= 0 && ty >= 0 && tx < this.room.w && ty < this.room.d ? [tx, ty] : null; return; }
    const hit = R.pick(bx, by);
    this.hovered = hit ? hit.ref : null;
    this.hoverTile = this.room.hasTile(tx, ty) && (!hit || hit.flat) ? [tx, ty] : null;
    this.canvas.style.cursor = hit ? 'pointer' : 'default';
    this.ui.nameTag(hit && (hit.kind === 'avatar' || hit.kind === 'pet') ? hit.ref : null);
  }

  click(cx, cy, shift) {
    const R = this.renderer;
    const [bx, by] = R.clientToBuf(cx, cy);
    if (this.placing) { this.updatePlacing(bx, by); this.confirmPlacing(shift); return; }
    if (this.editPlan) { this.editTile(...this.tileAt(bx, by)); return; }
    const hit = R.pick(bx, by);
    const av = this.avatar;
    const now = performance.now();
    const dbl = hit && this._lastTap && this._lastTap.ref === hit.ref && now - this._lastTap.t < 380;
    this._lastTap = { ref: hit && hit.ref, t: now };
    if (dbl) { this._lastTap = null; this.dblclick(hit); return; }
    if (!hit) {
      const [tx, ty] = this.tileAt(bx, by);
      this.select(null);
      if (this.room.walkable(tx, ty)) av.walkTo(this, tx, ty);
      return;
    }
    this.select(hit);
    if (hit.kind === 'furni') {
      const it = hit.ref, def = FURNI[it.id];
      if (def.sit || def.lay) {
        const z = it.z + (def.sit ? def.sit.z : def.lay.z);
        let [tx, ty] = this.tileAt(bx, by, z);
        const [fw, fd] = this.room.footprint(it);
        tx = Math.max(it.x, Math.min(it.x + fw - 1, tx));
        ty = Math.max(it.y, Math.min(it.y + fd - 1, ty));
        if (av.seat && av.seat.uid === it.uid) return;
        if (!av.walkTo(this, tx, ty, () => av.sitOn(this, it, tx, ty))) this.ui.toast('Não consigo chegar até lá!');
      } else if (def.flat || (def.walk && !def.states)) {
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

  // ------------------------------------------------------------- ações
  isWall(it) { return this.room.wallItems.includes(it); }

  // Vai até ao lado de uma mobi e executa algo
  reach(it, then) {
    const av = this.avatar;
    if (this.isWall(it)) { then(); return; }
    const [fw, fd] = this.room.footprint(it);
    const near = (x, y) => x >= it.x - 1 && x <= it.x + fw && y >= it.y - 1 && y <= it.y + fd;
    if (near(av.tx, av.ty) && !av.moving) { then(); return; }
    let best = null, bd = Infinity;
    for (let x = it.x - 1; x <= it.x + fw; x++)
      for (let y = it.y - 1; y <= it.y + fd; y++) {
        if (!this.room.walkable(x, y)) continue;
        const d = Math.hypot(x - av.tx, y - av.ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    if (!best || !av.walkTo(this, best[0], best[1], () => { av.face(Math.sign(it.x + fw / 2 - 0.5 - av.tx), Math.sign(it.y + fd / 2 - 0.5 - av.ty)); then(); })) {
      this.ui.toast('Não consigo chegar até lá!');
    }
  }

  use(it) {
    const def = FURNI[it.id];
    if (def.food) return this.eat(it);
    if (def.dispenser) return this.serve(it);
    if (!def.states) return;
    const next = (it.state + 1) % def.states.length;
    if (def.walk && typeof def.walk === 'function' && !def.walk(next)) {
      const busy = [this.avatar, ...this.pets].some((e) => e.tx === it.x && e.ty === it.y);
      if (busy) { this.ui.toast('Tem alguém na passagem!'); return; }
    }
    it.state = next;
    if (def.switch) {
      // interruptor: liga/desliga todas as luzes do quarto
      for (const o of [...this.room.items, ...this.room.wallItems]) {
        const d = FURNI[o.id];
        if (d.light && d.states && !d.food && !d.dispenser && !NOT_LAMPS.has(d.id)) o.state = next ? 1 : 0;
      }
      this.ui.toast(next ? 'Luzes acesas!' : 'Luzes apagadas');
    }
    this.room.version++;
    if (def.light && next) this.fx.spawn('sparkle', ...this.itemCenter(it));
    this.ui.refreshCard();
    this.save();
  }

  eat(it) {
    const def = FURNI[it.id], f = def.food;
    if (it.state >= f.portions) { this.ui.toast('Acabou! Use "Repor" para servir de novo.'); return; }
    this.reach(it, () => {
      it.state++;
      this.room.version++;
      this.avatar.give(this, f.item);
      this.fx.spawn('sparkle', ...this.itemCenter(it));
      this.ui.refreshCard();
      this.save();
    });
  }

  serve(it) {
    const def = FURNI[it.id];
    this.reach(it, () => {
      const item = def.dispenser[Math.floor(Math.random() * def.dispenser.length)];
      if (def.states) { it.state = 1; this.room.version++; setTimeout(() => { it.state = 0; this.room.version++; }, 1600); }
      this.avatar.give(this, item);
    });
  }

  refill(it) {
    it.state = 0;
    this.room.version++;
    this.ui.refreshCard();
    this.save();
  }

  itemCenter(it) {
    const def = FURNI[it.id];
    if (this.isWall(it)) {
      const plane = this.room.wallPlane(it.wall, it.pos, def.size[0]) ?? 0;
      const m = it.pos + def.size[0] / 2;
      return it.wall === 'L' ? [plane + 8, m, it.z + def.size[1]] : [m, plane + 8, it.z + def.size[1]];
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
      const r = this.room.canPlace(it.id, it.x, it.y, rot, it.uid, this.blockers());
      if (r.ok) {
        if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
        it.rot = rot;
        it.z = r.z;
        this.room.settle();
        this.room.touch();
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

  // ------------------------------------------------------------ inventário
  invAdd(id, variant = 0, n = 1) {
    const e = this.inventory.find((i) => i.id === id && i.variant === variant);
    if (e) e.n += n;
    else this.inventory.push({ id, variant, n });
    this.ui.refreshInventory();
    this.save();
  }

  invTake(id, variant) {
    const e = this.inventory.find((i) => i.id === id && i.variant === variant);
    if (!e) return false;
    e.n--;
    if (e.n <= 0) this.inventory.splice(this.inventory.indexOf(e), 1);
    this.ui.refreshInventory();
    return true;
  }

  pickUp(it) {
    if (FURNI[it.id].fixed) return;
    if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
    const removed = this.room.remove(it.uid);
    if (removed) {
      this.invAdd(removed.id, removed.variant || 0);
      this.ui.toast(`${FURNI[removed.id].name} foi para o inventário`);
    }
    this.select(null);
    this.save();
  }

  buy(id, variant, place) {
    this.invAdd(id, variant);
    if (place) this.placeFromInventory(id, variant);
    else this.ui.toast('Comprado! Está no seu inventário.');
  }

  placeFromInventory(id, variant) {
    const def = FURNI[id];
    this.startPlacing({ id, variant, rot: 0, fromInv: true });
    void def;
  }

  move(it) {
    if (FURNI[it.id].fixed) return;
    if (this.avatar.seat?.uid === it.uid) this.avatar.standUp();
    this.startPlacing({ id: it.id, variant: it.variant, rot: it.rot ?? 0, state: it.state, uid: it.uid });
  }

  blockers() { return [this.avatar, ...this.pets].map((e) => [e.tx, e.ty]); }

  startPlacing(p) {
    const def = FURNI[p.id];
    this.select(null);
    this.toggleEditPlan(false);
    this.placing = { rot: 0, state: 0, ...p, target: null, valid: false };
    if (def.states && def.light && p.uid == null && !def.food) this.placing.state = 1;
    this.ui.hint(def.wall ? 'Aponte para uma parede e clique para pendurar · Esc cancela' : 'Clique para colocar · R ou botão direito gira · Shift coloca vários · Esc cancela');
    if (this._lastBuf) this.updatePlacing(...this._lastBuf);
  }

  rotatePlacing() {
    const pl = this.placing, def = FURNI[pl.id];
    if (def.wall) return;
    pl.rot = (pl.rot + 1) % Math.max(1, def.rots || 4);
    if (this._lastBuf) this.updatePlacing(...this._lastBuf);
  }

  updatePlacing(bx, by) {
    this._lastBuf = [bx, by];
    const pl = this.placing, def = FURNI[pl.id], room = this.room;
    if (def.wall) {
      const hit = this.renderer.wallAt(room, bx, by);
      const [w, h] = def.size;
      if (!hit) { pl.target = null; pl.valid = false; return; }
      const pos = Math.round((hit.along - w / 2) / 2) * 2;
      const zz = def.floor ? 0 : Math.round((hit.z - h / 2) / 2) * 2;
      pl.target = [hit.side, pos, zz];
      const r = room.canPlaceWall(pl.id, hit.side, pos, zz, pl.uid ?? -1);
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
      if (def.wall) [it.wall, it.pos, it.z] = pl.target;
      else { [it.x, it.y] = pl.target; it.rot = pl.rot; it.z = pl.z; }
      room.settle();
      room.touch();
    } else {
      if (pl.fromInv && !this.invTake(pl.id, pl.variant)) { this.cancelPlacing(); return; }
      it = def.wall ? room.addWall(pl.id, ...pl.target, pl.variant, pl.state || 0) : room.add(pl.id, pl.target[0], pl.target[1], pl.rot, pl.variant, pl.state || 0);
      if (!it && pl.fromInv) this.invAdd(pl.id, pl.variant);
    }
    if (it) { this.fx.spawn('sparkle', ...this.itemCenter(it)); this.save(); }
    const more = pl.fromInv && this.inventory.some((i) => i.id === pl.id && i.variant === pl.variant);
    if (keep && pl.uid == null && more) return;
    this.placing = null;
    this.ui.hint('');
    if (it) this.select({ kind: def.wall ? 'wall' : 'furni', ref: it });
  }

  cancelPlacing() { this.placing = null; this.ui.hint(''); }

  // ------------------------------------------------------- editor de planta
  toggleEditPlan(on = !this.editPlan) {
    this.editPlan = on;
    if (on) { this.select(null); this.placing = null; }
    this.ui.hint(on ? 'Editando a planta: clique nos losangos para criar ou remover piso · Esc termina' : '');
    this.ui.refreshRoom();
  }

  editTile(x, y) {
    const r = this.room;
    if (x < 0 || y < 0 || x >= r.w || y >= r.d) return;
    const on = r.hasTile(x, y);
    if (on) {
      if (r.at(x, y).length) { this.ui.toast('Tire as mobílias deste piso antes.'); return; }
      const [dx, dy] = r.doorTile;
      if (x === dx && y === dy) { this.ui.toast('Aqui fica a entrada!'); return; }
      if ([this.avatar, ...this.pets].some((e) => e.tx === x && e.ty === y)) { this.ui.toast('Tem alguém aqui!'); return; }
      if (r.tiles.filter((t) => t).length <= 4) return;
    }
    r.setTile(x, y, !on);
    for (const it of r.prune()) this.invAdd(it.id, it.variant || 0);
    this.save();
  }

  // ------------------------------------------------------------ pets
  adoptPet(kind, color, data) {
    if (this.pets.length >= 6) { this.ui.toast('Já tem bichinho demais aqui!'); return null; }
    const [dx, dy] = this.room.doorTile;
    const uid = Math.max(0, ...this.pets.map((p) => p.uid), ...this.storedPets.map((p) => p.uid)) + 1;
    const p = new Pet({ ...(data || {}), uid: data?.uid ?? uid, kind, color, tx: dx, ty: dy });
    this.pets.push(p);
    this.room.door.state = 1;
    setTimeout(() => {
      p.go(this, Math.min(this.room.w - 1, dx + 2), dy);
      setTimeout(() => { this.room.door.state = 0; }, 1200);
    }, 300);
    setTimeout(() => p.say(this, data ? 'Voltei!' : `Oi! Eu sou ${p.name}!`), 900);
    this.save();
    return p;
  }

  storePet(p) {
    this.pets = this.pets.filter((x) => x !== p);
    this.storedPets.push(p.toJSON());
    this.select(null);
    this.ui.refreshInventory();
    this.ui.toast(`${p.name} está descansando no inventário.`);
    this.save();
  }

  releasePet(data) {
    this.storedPets = this.storedPets.filter((x) => x !== data);
    this.adoptPet(data.kind, data.color, data);
    this.ui.refreshInventory();
  }

  petAction(p, act) {
    const av = this.avatar;
    if (act === 'pet' || act === 'treat') {
      const go = () => {
        av.face(Math.sign(p.tx - av.tx), Math.sign(p.ty - av.ty));
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
    this.ui.refreshCard();
  }

  // ------------------------------------------------------------- chat
  say(text) {
    text = text.trim();
    if (!text) return;
    const cmd = text.toLowerCase();
    if (cmd === 'o/' || cmd === ':acenar') return this.emote('wave');
    if (cmd === ':dancar' || cmd === ':dançar') return this.emote('dance');
    if (cmd === ':sentar') return this.emote('sit');
    if (cmd === ':levantar' || cmd === ':parar') return this.emote('stand');
    this.ui.bubble(this.avatar, text);
    for (const p of this.pets) if (cmd.includes(p.name.toLowerCase())) setTimeout(() => p.call(this), 400);
  }

  emote(kind) {
    const a = this.avatar;
    if (a.moving) a.path = [];
    if (kind === 'stand') { a.standUp(); return; }
    if (kind === 'sit') { if (a.swimming) return; a.standUp(); a.pose = 'sit'; a.z = -9; return; }
    if (kind === 'sip') { if (a.hand) { a.hand.t = 0; } return; }
    a.standUp();
    a.pose = kind;
    a.poseTimer = kind === 'wave' ? 2 : 999;
    if (kind === 'wave') this.ui.bubble(a, 'o/');
  }

  setLook(look) {
    this.look = { ...this.look, ...look };
    this.avatar.look = this.look;
    this.save();
  }
}

export { HAND_ITEMS, dirFromVec, WALL_H };
