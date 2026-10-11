// Estado do quarto: planta de piso editável, paredes automáticas, mobílias de
// chão e de parede, regras de posicionamento e empilhamento (estilo Habbo).

import { FURNI, isWalkable } from './furniture.js';
import { TILE, WALL_H } from './config.js';

export const FLOOR_STYLES = [
  { id: 'madeira', name: 'Madeira', colors: ['#b98455', '#8a5a3c', '#d8bf98', '#5a3b2b', '#c9b59a'] },
  { id: 'porcelanato', name: 'Porcelanato', colors: ['#e8e6e2', '#d8d0c4', '#c9c9cc', '#f2efe9', '#3a3a40'] },
  { id: 'taco', name: 'Taco', colors: ['#b98455', '#a8744c', '#c9a27a', '#8a5a40'] },
  { id: 'xadrez', name: 'Xadrez', colors: ['#e9d8c0', '#e8c2c8', '#c9dbe8', '#d6e3c4', '#3c3546'] },
  { id: 'carpete', name: 'Carpete', colors: ['#8f7bc2', '#c96b80', '#4a9a92', '#9fa6b3', '#d8cfc0'] },
  { id: 'pedra', name: 'Pedra', colors: ['#a59c8f', '#6a6670', '#b8a58a'] },
  { id: 'grama', name: 'Grama', colors: ['#6fae4a', '#5d9b4c'] },
];

export const WALL_STYLES = [
  { id: 'lisa', name: 'Lisa', colors: ['#f2efe9', '#e9d3b0', '#c9dbe8', '#d6e3c4', '#e8c2c8', '#5c6a7a', '#3a3a40', '#c9b6ee'] },
  { id: 'lambri', name: 'Lambri', colors: ['#e9d3b0', '#c9dbe8', '#e8c2c8', '#d6e3c4', '#f1e4c6'] },
  { id: 'ripada', name: 'Ripada', colors: ['#7a4a34', '#a8734a', '#3a3a40', '#e8e2d8'] },
  { id: 'marmore', name: 'Mármore', colors: ['#eceae6', '#e8dce8', '#d8d0c4'] },
  { id: 'listras', name: 'Listras', colors: ['#e8c2c8', '#c9dbe8', '#f1e4c6', '#d6e3c4'] },
  { id: 'floral', name: 'Floral', colors: ['#d6e3c4', '#e8c2c8', '#c9dbe8', '#3f5a6b'] },
  { id: 'tijolo', name: 'Tijolo', colors: ['#b25a42', '#a59c8f', '#e8e2d8'] },
];

export const ROOM_SIZES = [[8, 8], [12, 10], [16, 12], [20, 16]];
export const PLANS = [
  { id: 'retangulo', name: 'Retângulo' },
  { id: 'L', name: 'Em L' },
  { id: 'degrau', name: 'Com recuo' },
  { id: 'T', name: 'Em T' },
];

export function planTiles(plan, w, d) {
  const t = new Array(w * d).fill(1);
  for (let y = 0; y < d; y++)
    for (let x = 0; x < w; x++) {
      let on = true;
      if (plan === 'L') on = !(x >= Math.ceil(w * 0.58) && y >= Math.ceil(d * 0.55));
      if (plan === 'degrau') on = !(x >= Math.ceil(w * 0.62) && y < Math.floor(d * 0.3)) && !(x < Math.floor(w * 0.25) && y >= Math.ceil(d * 0.75));
      if (plan === 'T') on = y < Math.ceil(d * 0.45) || (x >= Math.floor(w * 0.3) && x < Math.ceil(w * 0.7));
      t[y * w + x] = on ? 1 : 0;
    }
  return t;
}

export class Room {
  constructor(data = {}) {
    this.w = data.w ?? 12;
    this.d = data.d ?? 10;
    this.tiles = data.tiles && data.tiles.length === this.w * this.d ? data.tiles.slice() : new Array(this.w * this.d).fill(1);
    this.floor = data.floor ?? { style: 'madeira', color: 0 };
    this.wall = data.wall ?? { style: 'lisa', color: 0 };
    this.doorY = data.doorY ?? Math.floor(this.d * 0.6);
    this.items = (data.items || []).filter((i) => FURNI[i.id]).map((i) => ({ ...i, occupied: false }));
    this.wallItems = (data.wallItems || []).filter((i) => FURNI[i.id]).map((i) => ({ ...i }));
    this.nextUid = Math.max(1, ...this.items.map((i) => i.uid + 1), ...this.wallItems.map((i) => i.uid + 1));
    this.version = 0;
    this.ensureDoor();
    this.reindex();
  }

  toJSON() {
    const items = this.items.map(({ occupied, ...rest }) => rest);
    return { w: this.w, d: this.d, tiles: this.tiles, floor: this.floor, wall: this.wall, doorY: this.doorY, items, wallItems: this.wallItems };
  }

  // ------------------------------------------------------------- planta
  hasTile(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.d && this.tiles[y * this.w + x] === 1; }
  inside(x, y) { return this.hasTile(x, y); }

  rowMin(y) { for (let x = 0; x < this.w; x++) if (this.hasTile(x, y)) return x; return -1; }
  colMin(x) { for (let y = 0; y < this.d; y++) if (this.hasTile(x, y)) return y; return -1; }

  // Segmentos de parede: oeste no primeiro tile de cada linha, norte no
  // primeiro tile de cada coluna (o fundo do quarto, como no Habbo)
  walls() {
    if (this._wallsV === this.version) return this._walls;
    // agrupa tiles consecutivos no mesmo plano num único trecho (sem emendas)
    const segs = [];
    let cur = null;
    for (let y = 0; y < this.d; y++) {
      const x = this.rowMin(y);
      if (x >= 0 && cur && cur.x === x && cur.y1 === y) cur.y1 = y + 1;
      else if (x >= 0) { cur = { side: 'L', x, y, y1: y + 1, plane: x * TILE }; segs.push(cur); } else cur = null;
    }
    cur = null;
    for (let x = 0; x < this.w; x++) {
      const y = this.colMin(x);
      if (y >= 0 && cur && cur.y === y && cur.x1 === x) cur.x1 = x + 1;
      else if (y >= 0) { cur = { side: 'R', x, y, x1: x + 1, plane: y * TILE }; segs.push(cur); } else cur = null;
    }
    this._walls = segs;
    this._wallsV = this.version;
    return segs;
  }

  // Plano da parede para um item: todos os tiles cobertos precisam estar no mesmo plano
  wallPlane(side, pos, w) {
    const a = Math.floor(pos / TILE), b = Math.floor((pos + w - 0.01) / TILE);
    let plane = null;
    for (let i = a; i <= b; i++) {
      const m = side === 'L' ? this.rowMin(i) : this.colMin(i);
      if (m < 0) return null;
      if (plane == null) plane = m;
      else if (plane !== m) return null;
    }
    return plane == null ? null : plane * TILE;
  }

  setTile(x, y, on) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.d) return false;
    this.tiles[y * this.w + x] = on ? 1 : 0;
    this.touch();
    return true;
  }

  ensureDoor() {
    let door = this.wallItems.find((i) => i.id === 'porta_entrada');
    if (!door) {
      door = { uid: this.nextUid++, id: 'porta_entrada', wall: 'L', pos: 0, z: 0, state: 0, variant: 0 };
      this.wallItems.push(door);
    }
    if (this.rowMin(this.doorY) < 0) {
      for (let y = 0; y < this.d; y++) if (this.rowMin(y) >= 0) { this.doorY = y; break; }
    }
    this.doorY = Math.max(0, Math.min(this.doorY, this.d - 1));
    door.wall = 'L';
    door.pos = this.doorY * TILE - 5;
    door.z = 0;
    this.door = door;
  }

  get doorTile() { return [this.rowMin(this.doorY), this.doorY]; }

  def(item) { return FURNI[item.id]; }

  footprint(item) {
    const d = this.def(item);
    const [w, h] = d.size;
    return item.rot & 1 ? [h, w] : [w, h];
  }

  touch() { this.version++; this.reindex(); }

  reindex() {
    this.grid = Array.from({ length: this.w * this.d }, () => []);
    for (const it of this.items) {
      const [fw, fd] = this.footprint(it);
      for (let x = it.x; x < it.x + fw; x++)
        for (let y = it.y; y < it.y + fd; y++)
          if (x >= 0 && y >= 0 && x < this.w && y < this.d) this.grid[y * this.w + x].push(it);
    }
  }

  at(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.d ? this.grid[y * this.w + x] : []; }

  itemTop(it) {
    const d = this.def(it);
    return it.z + (d.top ?? d.h);
  }

  canPlace(id, x, y, rot, ignoreUid = -1, blockers = []) {
    const def = FURNI[id];
    const [w, h] = def.size;
    const [fw, fd] = rot & 1 ? [h, w] : [w, h];
    let z = 0;
    for (let tx = x; tx < x + fw; tx++)
      for (let ty = y; ty < y + fd; ty++) {
        if (!this.hasTile(tx, ty)) return { ok: false, z, why: 'Fora do quarto' };
        if (def.flat) continue;
        const [dx, dy] = this.doorTile;
        if (tx === dx && ty === dy && !isWalkable(def, 0)) return { ok: false, z, why: 'Deixe a entrada livre!' };
        if (blockers.some(([bx, by]) => bx === tx && by === ty) && !isWalkable(def, 0)) return { ok: false, z, why: 'Tem alguém aí!' };
        for (const o of this.at(tx, ty)) {
          if (o.uid === ignoreUid) continue;
          const od = this.def(o);
          if (od.flat) continue;
          if (!od.stack) return { ok: false, z, why: 'Não dá para empilhar aqui' };
          z = Math.max(z, this.itemTop(o));
        }
      }
    if (z > 120) return { ok: false, z, why: 'Muito alto!' };
    return { ok: true, z };
  }

  add(id, x, y, rot, variant = 0, state = 0) {
    const r = this.canPlace(id, x, y, rot);
    if (!r.ok) return null;
    const it = { uid: this.nextUid++, id, x, y, z: r.z, rot, variant, state };
    if (FURNI[id].flat) {
      // pisos ficam por baixo de tapetes; a água por baixo de tudo
      const rank = (d) => (d.pool ? 0 : d.floorTile ? 1 : 2);
      const r0 = rank(FURNI[id]);
      let i = 0;
      while (i < this.items.length && FURNI[this.items[i].id].flat && rank(FURNI[this.items[i].id]) <= r0) i++;
      this.items.splice(i, 0, it);
    } else this.items.push(it);
    this.touch();
    return it;
  }

  remove(uid) {
    const it = this.items.find((i) => i.uid === uid) || this.wallItems.find((i) => i.uid === uid);
    if (!it || FURNI[it.id].fixed) return null;
    this.items = this.items.filter((i) => i.uid !== uid);
    this.wallItems = this.wallItems.filter((i) => i.uid !== uid);
    this.settle();
    this.touch();
    return it;
  }

  settle() {
    this.reindex();
    const sorted = this.items.slice().sort((a, b) => a.z - b.z);
    for (const it of sorted) {
      if (this.def(it).flat) { it.z = 0; continue; }
      const [fw, fd] = this.footprint(it);
      let z = 0;
      for (let tx = it.x; tx < it.x + fw; tx++)
        for (let ty = it.y; ty < it.y + fd; ty++)
          for (const o of this.at(tx, ty))
            if (o !== it && !this.def(o).flat && this.def(o).stack && sorted.indexOf(o) < sorted.indexOf(it))
              z = Math.max(z, this.itemTop(o));
      it.z = z;
    }
  }

  walkable(x, y, opt = {}) {
    if (!this.hasTile(x, y)) return false;
    for (const it of this.at(x, y)) {
      const d = this.def(it);
      if (d.flat || isWalkable(d, it.state) || (opt.pet && d.pet)) continue;
      return false;
    }
    return true;
  }

  // nadando? (água sem pedra de passagem por cima)
  swimAt(x, y) {
    let water = false;
    for (const it of this.at(x, y)) {
      const d = this.def(it);
      if (d.stepping) return false;
      if (d.pool) water = true;
    }
    return water;
  }

  poolMask(x, y) {
    const has = (a, b) => this.at(a, b).some((i) => this.def(i).pool);
    return (has(x - 1, y) ? 1 : 0) | (has(x, y - 1) ? 2 : 0) | (has(x + 1, y) ? 4 : 0) | (has(x, y + 1) ? 8 : 0);
  }

  seatAt(x, y) {
    let best = null;
    for (const it of this.at(x, y)) {
      const d = this.def(it);
      if ((d.sit || d.lay) && (!best || it.z > best.z)) best = it;
    }
    return best;
  }

  findAll(pred) { return this.items.filter((i) => pred(this.def(i), i)); }

  // ------------------------------------------------------------ parede
  wallLen(side) { return (side === 'L' ? this.d : this.w) * TILE; }

  canPlaceWall(id, side, pos, z, ignoreUid = -1) {
    const def = FURNI[id];
    const [w, h] = def.size;
    if (pos < 1 || pos + w > this.wallLen(side) - 1) return { ok: false, why: 'Fora da parede' };
    if (z < (def.floor ? 0 : 2) || z + h > WALL_H - 2) return { ok: false, why: 'Fora da parede' };
    if (this.wallPlane(side, pos, w) == null) return { ok: false, why: 'Precisa ficar numa parede reta' };
    for (const o of this.wallItems) {
      if (o.uid === ignoreUid || o.wall !== side) continue;
      const [ow, oh] = FURNI[o.id].size;
      const pad = o.id === 'porta_entrada' ? 4 : 0;
      if (pos < o.pos + ow + pad && pos + w > o.pos - pad && z < o.z + oh + pad && z + h > o.z) return { ok: false, why: 'Já tem algo aqui' };
    }
    return { ok: true };
  }

  addWall(id, side, pos, z, variant = 0, state = 0) {
    if (!this.canPlaceWall(id, side, pos, z).ok) return null;
    const it = { uid: this.nextUid++, id, wall: side, pos, z, variant, state };
    this.wallItems.push(it);
    this.touch();
    return it;
  }

  // Mobis que deixaram de caber (após mudar a planta); devolve as removidas
  prune() {
    const out = [];
    this.items = this.items.filter((it) => {
      const [fw, fd] = this.footprint(it);
      for (let x = it.x; x < it.x + fw; x++) for (let y = it.y; y < it.y + fd; y++) if (!this.hasTile(x, y)) { out.push(it); return false; }
      return true;
    });
    this.wallItems = this.wallItems.filter((it) => {
      if (FURNI[it.id].fixed) return true;
      const ok = this.wallPlane(it.wall, it.pos, FURNI[it.id].size[0]) != null && it.pos + FURNI[it.id].size[0] <= this.wallLen(it.wall) - 1;
      if (!ok) out.push(it);
      return ok;
    });
    this.ensureDoor();
    this.settle();
    this.touch();
    return out;
  }

  resize(w, d, plan = 'retangulo') {
    const old = { w: this.w, d: this.d, tiles: this.tiles };
    this.w = w;
    this.d = d;
    this.tiles = planTiles(plan, w, d);
    void old;
    this.doorY = Math.min(this.doorY, d - 1);
    return this.prune();
  }
}
