// Avatar e pets: movimento por caminho (8 direções), poses, itens na mão,
// natação e a IA dos bichinhos.

import { TILE, WALK_SPEED, PET_SPEED, SIT_OFFSET } from './config.js';
import { findPath } from './path.js';
import { PET_KINDS } from './pets.js';
import { dirFromVec, HAND_ITEMS } from './avatar.js';
import { POOL } from './furni_jardim.js';

const center = (t) => t * TILE + TILE / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

class Walker {
  constructor(x, y) {
    this.tx = x;
    this.ty = y;
    this.x = center(x);
    this.y = center(y);
    this.z = 0;
    this.path = [];
    this.onArrive = null;
    this.dir = 0;
    this.anim = 0;
  }

  get moving() { return this.path.length > 0; }

  face(dx, dy) { if (dx || dy) this.dir = dirFromVec(dx, dy); }

  goTo(game, tx, ty, opt = {}) {
    const room = game.room;
    const pass = (x, y) => room.walkable(x, y, { pet: opt.pet }) && !(opt.avoid && opt.avoid(x, y));
    const p = findPath(room.w, room.d, pass, [this.tx, this.ty], [tx, ty]);
    if (!p) return false;
    if (p.length && !opt.allowGoal && !pass(tx, ty)) p.pop();
    this.path = p;
    this.onArrive = opt.then || null;
    if (!p.length && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
    return true;
  }

  stepMove(dt, speed, game) {
    if (!this.path.length) return false;
    const [nx, ny] = this.path[0];
    const gx = center(nx), gy = center(ny);
    const dx = gx - this.x, dy = gy - this.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist > 0.01) this.face(Math.sign(Math.round(dx)), Math.sign(Math.round(dy)));
    if (dist <= step) {
      this.x = gx;
      this.y = gy;
      this.tx = nx;
      this.ty = ny;
      this.path.shift();
      if (this.onTile) this.onTile(game);
      if (!this.path.length && this.onArrive) {
        const f = this.onArrive;
        this.onArrive = null;
        f();
      }
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    this.anim += dt;
    return true;
  }

  box(h = 70, r = 7) {
    return { x0: this.x - r, x1: this.x + r, y0: this.y - r, y1: this.y + r, z0: this.z, z1: this.z + h };
  }
}

function nearestFree(room, tx, ty) {
  if (room.walkable(tx, ty)) return [tx, ty];
  const seen = new Set([tx + ',' + ty]);
  let frontier = [[tx, ty]];
  for (let step = 0; step < 8 && frontier.length; step++) {
    const next = [];
    for (const [x, y] of frontier)
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || nx < 0 || ny < 0 || nx >= room.w || ny >= room.d) continue;
        seen.add(k);
        if (room.walkable(nx, ny)) return [nx, ny];
        next.push([nx, ny]);
      }
    frontier = next;
  }
  return null;
}

// Rotaciona um ponto local (unidades) da pegada de uma mobi
export function rotPoint([x, y], size, rot) {
  const fw = size[0] * TILE, fd = size[1] * TILE;
  switch (rot & 3) {
    case 1: return [y, x];
    case 2: return [fw - x, fd - y];
    case 3: return [fd - y, fw - x];
    default: return [x, y];
  }
}
const FRONT = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// ------------------------------------------------------------------ avatar
export class Avatar extends Walker {
  constructor(x, y, look) {
    super(x, y);
    this.look = look;
    this.pose = 'stand'; // stand | sit | lay | wave | dance | swim
    this.seat = null;
    this.poseTimer = 0;
    this.blinkT = rnd(2, 5);
    this.blink = false;
    this.hand = null; // { item, left, t, sip }
    this.swimming = false;
    this.onTile = (game) => this.checkWater(game);
  }

  checkWater(game) {
    const sw = game.room.swimAt(this.tx, this.ty);
    if (sw !== this.swimming) {
      this.swimming = sw;
      if (sw) game.fx.splash(this.x, this.y);
    }
    this.z = sw ? POOL.surface - 30 : 0;
  }

  standUp() {
    if (this.seat) {
      this.seat.item.occupied = false;
      this.seat = null;
      const room = this.game && this.game.room;
      const spot = room && nearestFree(room, this.tx, this.ty);
      if (spot) { [this.tx, this.ty] = spot; this.x = center(spot[0]); this.y = center(spot[1]); }
    }
    this.pose = 'stand';
    this.cut = null;
    if (this.game) this.checkWater(this.game); else this.z = 0;
  }

  walkTo(game, tx, ty, then) {
    const seated = this.seat;
    if (this.pose !== 'stand') this.standUp();
    if (seated && seated.def.lay) game.room.version++;
    return this.goTo(game, tx, ty, { then, allowGoal: !!then });
  }

  sitOn(game, item, tx, ty) {
    const def = game.room.def(item);
    this.standUp();
    this.tx = tx;
    this.ty = ty;
    this.x = center(tx);
    this.y = center(ty);
    const f = FRONT[item.rot & 3];
    this.face(f[0], f[1]);
    this.seat = { uid: item.uid, def, item };
    this.swimming = false;
    if (def.lay) {
      this.pose = 'lay';
      item.occupied = true;
      const [hx, hy] = rotPoint(def.lay.head, def.size, item.rot);
      this.x = item.x * TILE + hx;
      this.y = item.y * TILE + hy;
      this.z = item.z + def.lay.z - 52;
      game.room.version++;
    } else {
      this.pose = 'sit';
      this.z = item.z + def.sit.z - SIT_OFFSET;
      this.cut = def.sit.cut != null ? item.z + def.sit.cut - this.z : null;
    }
  }

  give(game, itemId) {
    const info = HAND_ITEMS[itemId];
    if (!info) return;
    this.hand = { item: itemId, left: info.sips, t: 1.2, sip: 0 };
    game.ui.bubble(this, `*pega ${info.name.toLowerCase()}*`, true);
  }

  drop() { this.hand = null; }

  update(dt, game) {
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = !this.blink;
      this.blinkT = this.blink ? 0.12 : rnd(2, 5);
    }
    if (this.seat && !game.room.items.includes(this.seat.item)) this.standUp();
    // goles / mordidas
    if (this.hand) {
      const h = this.hand;
      if (h.sip > 0) h.sip -= dt;
      else {
        h.t -= dt;
        if (h.t <= 0) {
          h.sip = 0.9;
          h.left--;
          h.t = rnd(3, 5);
          const food = ['bolo', 'pizza', 'maca', 'cookie', 'pipoca', 'rosquinha'].includes(h.item);
          for (let i = 0; i < 3; i++) game.fx.spawn(food ? 'crumb' : 'drop', this.x, this.y, this.z + 52);
          if (h.left <= 0) {
            setTimeout(() => { this.hand = null; game.ui.bubble(this, food ? 'Hmm, que delícia!' : 'Ahh, refrescante!', true); }, 900);
          }
        }
      }
    }
    const moved = this.stepMove(dt, this.swimming ? WALK_SPEED * 0.6 : WALK_SPEED, game);
    if (moved) return;
    this.anim += dt;
    if (this.pose === 'wave' || this.pose === 'dance') {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0 && this.pose === 'wave') this.pose = 'stand';
    }
    if (this.swimming && Math.random() < dt * 0.8) game.fx.splash(this.x, this.y, true);
  }

  // [pose, frame]
  spritePose() {
    if (this.swimming && this.pose !== 'sit' && this.pose !== 'lay') return ['swim', Math.floor(this.anim * (this.moving ? 6 : 2)) % 4];
    if (this.moving) return ['walk', Math.floor(this.anim * 8) % 4];
    if (this.pose === 'wave') return ['wave', Math.floor(this.anim * 4) % 2];
    if (this.pose === 'dance') return ['dance', Math.floor(this.anim * 5) % 4];
    if (this.hand && this.hand.sip > 0 && this.pose !== 'lay') return [this.pose === 'sit' ? 'sitsip' : 'sip', 0];
    if (this.hand && this.pose !== 'lay') return [this.pose === 'sit' ? 'sithold' : 'hold', 0];
    return [this.pose, 0];
  }
}

// -------------------------------------------------------------------- pets
export class Pet extends Walker {
  constructor(data) {
    super(data.tx ?? 5, data.ty ?? 5);
    this.uid = data.uid;
    this.kind = data.kind;
    this.color = data.color ?? 0;
    this.name = data.name ?? pick(PET_KINDS[data.kind].names);
    this.hunger = data.hunger ?? rnd(10, 40);
    this.energy = data.energy ?? rnd(60, 100);
    this.love = data.love ?? 0;
    this.state = 'idle';
    this.timer = rnd(1, 3);
    this.dir = Math.floor(Math.random() * 8);
  }

  toJSON() {
    return { uid: this.uid, kind: this.kind, color: this.color, name: this.name, tx: this.tx, ty: this.ty, hunger: this.hunger, energy: this.energy, love: this.love };
  }

  get info() { return PET_KINDS[this.kind]; }

  say(game, text) { game.ui.bubble(this, text ?? pick(this.info.sound), true); }

  setState(s, t) { this.state = s; this.timer = t; }

  go(game, tx, ty, then) {
    this.z = 0;
    const ok = this.goTo(game, tx, ty, { pet: true, then, allowGoal: true, avoid: (x, y) => game.room.swimAt(x, y) });
    if (ok) this.state = 'walk';
    return ok;
  }

  near(game, tx, ty) {
    const opts = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const x = tx + dx, y = ty + dy;
        if (game.room.walkable(x, y, { pet: true }) && !game.room.swimAt(x, y)) opts.push([x, y]);
      }
    return opts.length ? pick(opts) : null;
  }

  update(dt, game) {
    this.hunger = Math.min(100, this.hunger + dt * 0.9);
    if (this.state === 'sleep') this.energy = Math.min(100, this.energy + dt * 6);
    else this.energy = Math.max(0, this.energy - dt * 0.7);
    if (this.stepMove(dt, PET_SPEED, game)) return;
    if (this.state === 'walk') this.setState('idle', rnd(0.5, 2));
    this.timer -= dt;
    this.anim += dt;
    if (this.state === 'sleep' && Math.random() < dt * 0.8) game.fx.spawn('zzz', this.x, this.y, this.z + 18);
    if (this.state === 'happy' && Math.random() < dt * 3) game.fx.spawn('heart', this.x, this.y, this.z + 28);
    if (this.state === 'eat' && Math.random() < dt * 2) game.fx.spawn('crumb', this.x, this.y, this.z + 10);
    if (this.timer > 0) return;
    this.think(game);
  }

  think(game) {
    const room = game.room;
    if (this.state === 'sleep') this.energy = 100;
    if (this.state === 'eat') this.hunger = 0;
    this.z = 0;
    if (this.hunger > 75) {
      const bowl = room.findAll((d) => d.pet === 'bowl')[0];
      if (bowl) {
        const spot = this.near(game, bowl.x, bowl.y);
        if (spot && this.go(game, spot[0], spot[1], () => {
          this.face(Math.sign(bowl.x - this.tx), Math.sign(bowl.y - this.ty));
          this.setState('eat', 4);
          this.say(game, this.kind === 'gato' ? 'Nham nham~' : 'Nhac nhac!');
        })) return;
      }
    }
    if (this.energy < 25 || (this.kind === 'gato' && Math.random() < 0.08)) {
      const bed = room.findAll((d) => d.pet === 'bed').find((b) => !game.pets.some((p) => p !== this && p.tx === b.x && p.ty === b.y));
      const target = bed ? [bed.x, bed.y] : [this.tx, this.ty];
      if (this.go(game, target[0], target[1], () => {
        if (bed) { this.z = bed.z + (room.def(bed).petZ || 3); const [fw, fd] = room.footprint(bed); this.x = (bed.x + fw / 2) * TILE; this.y = (bed.y + fd / 2) * TILE; }
        this.setState('sleep', rnd(12, 22));
      })) return;
    }
    const r = Math.random();
    const av = game.avatar;
    const followChance = this.kind === 'cachorro' ? 0.4 : 0.15;
    if (r < followChance) {
      const spot = this.near(game, av.tx, av.ty);
      if (spot && this.go(game, spot[0], spot[1], () => {
        this.face(Math.sign(av.tx - this.tx), Math.sign(av.ty - this.ty));
        this.setState('sit', rnd(2, 5));
        if (Math.random() < 0.35) this.say(game);
      })) return;
    }
    if (r < 0.75) {
      for (let tries = 0; tries < 8; tries++) {
        const x = this.tx + Math.round(rnd(-5, 5)), y = this.ty + Math.round(rnd(-5, 5));
        if (room.walkable(x, y, { pet: true }) && !room.swimAt(x, y) && this.go(game, x, y)) return;
      }
    }
    this.setState(Math.random() < 0.6 ? 'sit' : 'idle', rnd(2, 5));
    if (Math.random() < 0.15) this.say(game);
  }

  pet(game) {
    this.love++;
    this.path = [];
    this.setState('happy', 2.5);
    this.say(game, this.kind === 'gato' ? 'Prrrrr ♥' : 'Au! ♥');
  }

  treat(game) {
    this.hunger = Math.max(0, this.hunger - 40);
    this.love++;
    this.setState('happy', 2.5);
    this.say(game, this.kind === 'gato' ? 'Miau!! ♥' : 'AU AU! ♥');
  }

  call(game) {
    const av = game.avatar;
    const spot = this.near(game, av.tx, av.ty);
    if (spot) this.go(game, spot[0], spot[1], () => {
      this.face(Math.sign(av.tx - this.tx), Math.sign(av.ty - this.ty));
      this.setState('happy', 2);
    });
    this.say(game, this.kind === 'gato' ? 'Mrrr?' : 'Au?');
  }

  // [pose, frame]
  spritePose() {
    if (this.moving) return ['walk', Math.floor(this.anim * 8) % 4];
    if (this.state === 'sleep') return ['sleep', 0];
    if (this.state === 'sit' || this.state === 'eat') return ['sit', 0];
    if (this.state === 'happy') return ['happy', Math.floor(this.anim * 6) % 4];
    return ['stand', 0];
  }
}
