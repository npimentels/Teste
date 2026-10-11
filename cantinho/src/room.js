// Estado do quarto: grade, mobílias de chão e de parede, regras de
// posicionamento, empilhamento ("stack" estilo Habbo) e caminhabilidade.

import { FURNI, isWalkable } from './furniture.js';
import { TILE, WALL_H } from './config.js';

export const FLOOR_STYLES = [
  { id: 'tabuas', name: 'Tábuas', colors: ['#b98455', '#9c6b48', '#d1a272', '#7d5a48', '#c9b59a'] },
  { id: 'taco', name: 'Taco', colors: ['#b98455', '#a8744c', '#c9a27a', '#8a5a40'] },
  { id: 'xadrez', name: 'Xadrez', colors: ['#e9d8c0', '#e8c2c8', '#c9dbe8', '#d6e3c4', '#3c3546'] },
  { id: 'carpete', name: 'Carpete', colors: ['#8f7bc2', '#c96b80', '#4a9a92', '#d9a23b', '#7a8a9a'] },
  { id: 'pedra', name: 'Pedra', colors: ['#a59c8f', '#8a8fa3', '#b8a58a'] },
];

export const WALL_STYLES = [
  { id: 'lambri', name: 'Lambri', colors: ['#e9d3b0', '#c9dbe8', '#e8c2c8', '#d6e3c4', '#c9b6ee', '#f1e4c6'] },
  { id: 'listras', name: 'Listras', colors: ['#e8c2c8', '#c9dbe8', '#f1e4c6', '#d6e3c4', '#c9b6ee'] },
  { id: 'floral', name: 'Floral', colors: ['#d6e3c4', '#e8c2c8', '#c9dbe8', '#f1e4c6', '#3f5a6b'] },
  { id: 'liso', name: 'Liso', colors: ['#f1e4c6', '#e9d3b0', '#c9dbe8', '#4b5a7a', '#5c4c6b', '#d9a23b'] },
  { id: 'tijolo', name: 'Tijolo', colors: ['#b25a42', '#a59c8f', '#e8e2d8'] },
];

export const ROOM_SIZES = [[6, 6], [8, 7], [10, 8], [12, 10]];

export class Room {
  constructor(data = {}) {
    this.w = data.w ?? 10;
    this.d = data.d ?? 8;
    this.floor = data.floor ?? { style: 'tabuas', color: 0 };
    this.wall = data.wall ?? { style: 'lambri', color: 0 };
    this.doorY = data.doorY ?? 6;
    this.items = (data.items || []).filter((i) => FURNI[i.id]).map((i) => ({ ...i, occupied: false }));
    this.wallItems = (data.wallItems || []).filter((i) => FURNI[i.id]).map((i) => ({ ...i }));
    this.nextUid = Math.max(1, ...this.items.map((i) => i.uid + 1), ...this.wallItems.map((i) => i.uid + 1));
    this.version = 0;
    this.ensureDoor();
    this.reindex();
  }

  toJSON() {
    const items = this.items.map(({ occupied, ...rest }) => rest);
    return { w: this.w, d: this.d, floor: this.floor, wall: this.wall, doorY: this.doorY, items, wallItems: this.wallItems };
  }

  ensureDoor() {
    let door = this.wallItems.find((i) => i.id === 'porta_entrada');
    if (!door) {
      door = { uid: this.nextUid++, id: 'porta_entrada', wall: 'L', pos: 0, z: 0, state: 0, variant: 0 };
      this.wallItems.push(door);
    }
    this.doorY = Math.min(this.doorY, this.d - 1);
    door.pos = this.doorY * TILE - 2;
    door.z = 0;
    this.door = door;
  }

  get doorTile() { return [0, this.doorY]; }

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
          if (this.inside(x, y)) this.grid[y * this.w + x].push(it);
    }
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.d; }

  at(x, y) { return this.inside(x, y) ? this.grid[y * this.w + x] : []; }

  itemTop(it) {
    const d = this.def(it);
    return it.z + (d.top ?? d.h);
  }

  // Altura e validade de posicionamento de uma mobi de chão.
  canPlace(id, x, y, rot, ignoreUid = -1, blockers = []) {
    const def = FURNI[id];
    const [w, h] = def.size;
    const [fw, fd] = rot & 1 ? [h, w] : [w, h];
    let z = 0;
    for (let tx = x; tx < x + fw; tx++)
      for (let ty = y; ty < y + fd; ty++) {
        if (!this.inside(tx, ty)) return { ok: false, z, why: 'Fora do quarto' };
        if (def.flat) continue;
        if (tx === this.doorTile[0] && ty === this.doorTile[1] && !isWalkable(def, 0))
          return { ok: false, z, why: 'Deixe a entrada livre!' };
        if (blockers.some(([bx, by]) => bx === tx && by === ty) && !isWalkable(def, 0))
          return { ok: false, z, why: 'Tem alguém aí!' };
        for (const o of this.at(tx, ty)) {
          if (o.uid === ignoreUid) continue;
          const od = this.def(o);
          if (od.flat) continue;
          if (!od.stack) return { ok: false, z, why: 'Não dá para empilhar aqui' };
          z = Math.max(z, this.itemTop(o));
        }
      }
    if (z > 64) return { ok: false, z, why: 'Muito alto!' };
    return { ok: true, z };
  }

  add(id, x, y, rot, variant = 0, state = 0) {
    const r = this.canPlace(id, x, y, rot);
    if (!r.ok) return null;
    const it = { uid: this.nextUid++, id, x, y, z: r.z, rot, variant, state };
    if (FURNI[id].flat) this.items.unshift(it);
    else this.items.push(it);
    this.touch();
    return it;
  }

  remove(uid) {
    this.items = this.items.filter((i) => i.uid !== uid);
    this.wallItems = this.wallItems.filter((i) => i.uid !== uid || FURNI[i.id].fixed);
    this.settle();
    this.touch();
  }

  // "Gravidade": recalcula alturas após remover/mover algo de baixo.
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
            if (o !== it && o.z < it.z + 0.5 && !this.def(o).flat && this.def(o).stack && sorted.indexOf(o) < sorted.indexOf(it))
              z = Math.max(z, this.itemTop(o));
      it.z = z;
    }
  }

  // Tile andável? (seats=true permite tiles de assento/cama como destino)
  walkable(x, y, opt = {}) {
    if (!this.inside(x, y)) return false;
    for (const it of this.at(x, y)) {
      const d = this.def(it);
      if (d.flat || isWalkable(d, it.state) || (opt.pet && d.pet)) continue;
      return false;
    }
    return true;
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
  wallLen(wall) { return (wall === 'L' ? this.d : this.w) * TILE; }

  canPlaceWall(id, wall, pos, z, ignoreUid = -1) {
    const def = FURNI[id];
    const [w, h] = def.size;
    if (pos < 2 || pos + w > this.wallLen(wall) - 1) return { ok: false, why: 'Fora da parede' };
    if (z < 2 || z + h > WALL_H - 4) return { ok: false, why: 'Fora da parede' };
    for (const o of this.wallItems) {
      if (o.uid === ignoreUid || o.wall !== wall) continue;
      const [ow, oh] = FURNI[o.id].size;
      const pad = o.id === 'porta_entrada' ? 3 : 0;
      if (pos < o.pos + ow + pad && pos + w > o.pos - pad && z < o.z + oh + pad && z + h > o.z) return { ok: false, why: 'Já tem algo aqui' };
    }
    return { ok: true };
  }

  addWall(id, wall, pos, z, variant = 0) {
    if (!this.canPlaceWall(id, wall, pos, z).ok) return null;
    const it = { uid: this.nextUid++, id, wall, pos, z, variant, state: 0, rot: wall === 'L' ? 1 : 0 };
    this.wallItems.push(it);
    this.touch();
    return it;
  }

  resize(w, d) {
    this.w = w;
    this.d = d;
    this.doorY = Math.min(this.doorY, d - 1);
    this.items = this.items.filter((it) => {
      const [fw, fd] = this.footprint(it);
      return it.x + fw <= w && it.y + fd <= d;
    });
    this.wallItems = this.wallItems.filter((it) => FURNI[it.id].fixed || it.pos + FURNI[it.id].size[0] <= this.wallLen(it.wall) - 1);
    this.ensureDoor();
    this.settle();
    this.touch();
  }
}

// Quarto inicial já decorado — primeira impressão importa!
export function starterRoom() {
  const r = new Room({ w: 10, d: 8, floor: { style: 'tabuas', color: 0 }, wall: { style: 'lambri', color: 0 }, doorY: 6 });
  const put = (id, x, y, rot = 0, variant = 0, state = 0) => r.add(id, x, y, rot, variant, state);
  put('tapete', 3, 3, 1, 0);
  put('tapete_redondo', 1, 3, 0, 2);
  put('cama', 1, 0, 0, 0);
  put('criado', 3, 0, 0, 0);
  put('abajur', 3, 0, 0, 0, 1);
  put('planta', 0, 0, 0, 0);
  put('poltrona', 4, 0, 0, 1);
  put('caldeirao', 5, 0, 0, 0, 1);
  put('samambaia', 6, 0, 0, 0);
  put('estante', 7, 0, 0, 0);
  put('relogio', 9, 0, 0, 0);
  put('lareira', 0, 2, 1, 0, 1);
  put('sofa', 4, 5, 2, 0);
  put('mesa_centro', 4, 4, 0, 0);
  put('vela', 4, 4, 0, 0, 1);
  put('flores', 5, 4, 0, 1);
  put('luminaria', 9, 4, 0, 0, 1);
  put('caminha', 8, 6, 0, 0);
  put('pote_racao', 9, 7, 0, 0);
  put('bau', 9, 1, 3, 0);
  r.addWall('janela', 'R', 66, 28, 0);
  r.addWall('varal_luzes', 'R', 12, 52, 0);
  r.addWall('quadro', 'L', 66, 34, 0);
  r.addWall('relogio_parede', 'L', 10, 46, 0);
  for (const it of r.wallItems) if (it.id === 'varal_luzes') it.state = 1;
  return r;
}
