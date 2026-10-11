// Avatar e pets: movimento por caminho, animação e IA simples dos bichinhos.

import { TILE, WALK_SPEED, PET_SPEED } from './config.js';
import { findPath } from './path.js';
import { PET_KINDS } from './characters.js';

const center = (t) => t * TILE + TILE / 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Vista a partir de um vetor de grade (dx, dy)
export function viewFor(dx, dy) {
  const sx = dx - dy, sy = dx + dy;
  return { view: sy < 0 ? 'back' : 'front', flip: sx < 0 };
}

class Walker {
  constructor(x, y) {
    this.tx = x;
    this.ty = y;
    this.x = center(x);
    this.y = center(y);
    this.z = 0;
    this.path = [];
    this.onArrive = null;
    this.face = { view: 'front', flip: false };
    this.anim = 0;
  }

  get moving() { return this.path.length > 0; }

  goTo(game, tx, ty, opt = {}) {
    const room = game.room;
    const pass = (x, y) => room.walkable(x, y, { pet: opt.pet }) && !(opt.avoid && opt.avoid(x, y));
    const p = findPath(room.w, room.d, pass, [this.tx, this.ty], [tx, ty]);
    if (!p) return false;
    // destino precisa ser andável, a não ser que seja assento/cama
    if (p.length && !opt.allowGoal && !pass(tx, ty)) p.pop();
    this.path = p;
    this.onArrive = opt.then || null;
    if (!p.length && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
    return true;
  }

  stepMove(dt, speed) {
    if (!this.path.length) return false;
    const [nx, ny] = this.path[0];
    const gx = center(nx), gy = center(ny);
    const dx = gx - this.x, dy = gy - this.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    if (dist > 0.01) this.face = viewFor(Math.sign(Math.round(dx)), Math.sign(Math.round(dy)));
    if (dist <= step) {
      this.x = gx;
      this.y = gy;
      this.tx = nx;
      this.ty = ny;
      this.path.shift();
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

  // Caixa 3D para ordenação de profundidade
  box(h = 30, r = 4) {
    return { x0: this.x - r, x1: this.x + r, y0: this.y - r, y1: this.y + r, z0: this.z, z1: this.z + h };
  }
}

// ------------------------------------------------------------------ avatar
export class Avatar extends Walker {
  constructor(x, y, look) {
    super(x, y);
    this.look = look;
    this.pose = 'stand'; // stand | sit | lay | wave | dance
    this.seat = null;
    this.poseTimer = 0;
    this.blinkT = rnd(2, 5);
    this.blink = false;
  }

  standUp() {
    if (this.seat) {
      this.seat.item.occupied = false;
      this.seat = null;
      // desce do móvel para o tile livre mais próximo
      const room = this.game && this.game.room;
      const spot = room && nearestFree(room, this.tx, this.ty);
      if (spot) {
        [this.tx, this.ty] = spot;
        this.x = center(spot[0]);
        this.y = center(spot[1]);
      }
    }
    this.pose = 'stand';
    this.z = 0;
  }

  walkTo(game, tx, ty, then) {
    const wasSeated = this.seat;
    if (this.pose !== 'stand') this.standUp();
    if (wasSeated && wasSeated.def.lay) game.room.touch();
    return this.goTo(game, tx, ty, { then, allowGoal: !!then });
  }

  sitOn(game, item, tx, ty) {
    const def = game.room.def(item);
    this.standUp();
    this.tx = tx;
    this.ty = ty;
    this.x = center(tx);
    this.y = center(ty);
    const f = [[0, 1], [1, 0], [0, -1], [-1, 0]][item.rot & 3];
    this.face = viewFor(f[0], f[1]);
    this.seat = { uid: item.uid, def, item };
    if (def.lay) {
      this.pose = 'lay';
      item.occupied = true;
      const [hx, hy] = rotPoint(def.lay.head, def.size, item.rot);
      this.x = item.x * TILE + hx;
      this.y = item.y * TILE + hy;
      this.z = item.z + def.lay.z;
      this.face = { view: 'front', flip: false };
    } else {
      this.pose = 'sit';
      this.z = item.z + def.sit.z;
    }
  }

  update(dt, game) {
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = !this.blink;
      this.blinkT = this.blink ? 0.12 : rnd(2, 5);
    }
    if (this.seat) {
      const it = game.room.items.find((i) => i.uid === this.seat.uid);
      if (!it) this.standUp();
    }
    const moved = this.stepMove(dt, WALK_SPEED);
    if (moved) return;
    this.anim += dt;
    if (this.pose === 'wave' || this.pose === 'dance') {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0 && this.pose === 'wave') this.pose = 'stand';
    }
  }

  spritePose() {
    if (this.moving) return 'walk' + (Math.floor(this.anim * 8) % 4);
    if (this.pose === 'wave') return 'wave' + (Math.floor(this.anim * 4) % 2);
    if (this.pose === 'dance') return 'dance' + (Math.floor(this.anim * 5) % 4);
    return this.pose;
  }
}

function nearestFree(room, tx, ty) {
  if (room.walkable(tx, ty)) return [tx, ty];
  const seen = new Set([tx + ',' + ty]);
  let frontier = [[tx, ty]];
  for (let step = 0; step < 6 && frontier.length; step++) {
    const next = [];
    for (const [x, y] of frontier)
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !room.inside(nx, ny)) continue;
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
    this.face = { view: 'front', flip: Math.random() < 0.5 };
  }

  toJSON() {
    return { uid: this.uid, kind: this.kind, color: this.color, name: this.name, tx: this.tx, ty: this.ty, hunger: this.hunger, energy: this.energy, love: this.love };
  }

  get info() { return PET_KINDS[this.kind]; }

  say(game, text) { game.ui.bubble(this, text ?? pick(this.info.sound), true); }

  setState(s, t) {
    this.state = s;
    this.timer = t;
  }

  go(game, tx, ty, then) {
    const ok = this.goTo(game, tx, ty, { pet: true, then, allowGoal: true });
    if (ok) this.state = 'walk';
    return ok;
  }

  near(game, tx, ty) {
    // tile livre ao lado de (tx, ty)
    const opts = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        const x = tx + dx, y = ty + dy;
        if (game.room.walkable(x, y, { pet: true })) opts.push([x, y]);
      }
    return opts.length ? pick(opts) : null;
  }

  update(dt, game) {
    this.hunger = Math.min(100, this.hunger + dt * 0.9);
    if (this.state === 'sleep') this.energy = Math.min(100, this.energy + dt * 6);
    else this.energy = Math.max(0, this.energy - dt * 0.7);

    if (this.stepMove(dt, PET_SPEED)) return;
    if (this.state === 'walk') this.setState('idle', rnd(0.5, 2));

    this.timer -= dt;
    this.anim += dt;
    if (this.state === 'sleep' && Math.random() < dt * 0.8) game.fx.spawn('zzz', this.x, this.y, this.z + 10);
    if (this.state === 'happy' && Math.random() < dt * 3) game.fx.spawn('heart', this.x, this.y, this.z + 14);
    if (this.state === 'eat' && Math.random() < dt * 2) game.fx.spawn('sparkle', this.x, this.y, this.z + 6);
    if (this.timer > 0) return;
    this.think(game);
  }

  think(game) {
    const room = game.room;
    this.z = 0;
    if (this.state === 'sleep') this.energy = 100;
    if (this.state === 'eat') this.hunger = 0;

    if (this.hunger > 75) {
      const bowl = room.findAll((d) => d.pet === 'bowl')[0];
      if (bowl) {
        const spot = this.near(game, bowl.x, bowl.y);
        if (spot && this.go(game, spot[0], spot[1], () => {
          this.face = viewFor(Math.sign(bowl.x - this.tx), Math.sign(bowl.y - this.ty));
          this.setState('eat', 4);
          this.say(game, this.kind === 'gato' ? 'Nham nham~' : 'Nhac nhac!');
        })) return;
      }
    }
    if (this.energy < 25 || (this.kind === 'gato' && Math.random() < 0.08)) {
      const bed = room.findAll((d) => d.pet === 'bed').find((b) => !game.pets.some((p) => p !== this && p.tx === b.x && p.ty === b.y));
      const target = bed ? [bed.x, bed.y] : [this.tx, this.ty];
      if (this.go(game, target[0], target[1], () => {
        if (bed) this.z = 3;
        this.setState('sleep', rnd(12, 22));
      })) return;
    }
    const r = Math.random();
    const av = game.avatar;
    const followChance = this.kind === 'cachorro' ? 0.4 : 0.15;
    if (r < followChance) {
      const spot = this.near(game, av.tx, av.ty);
      if (spot && this.go(game, spot[0], spot[1], () => {
        this.face = viewFor(Math.sign(av.tx - this.tx), Math.sign(av.ty - this.ty));
        this.setState('sit', rnd(2, 5));
        if (Math.random() < 0.35) this.say(game);
      })) return;
    }
    if (r < 0.75) {
      for (let tries = 0; tries < 8; tries++) {
        const x = this.tx + Math.round(rnd(-4, 4)), y = this.ty + Math.round(rnd(-4, 4));
        if (room.walkable(x, y, { pet: true }) && this.go(game, x, y)) return;
      }
    }
    this.setState(Math.random() < 0.6 ? 'sit' : 'idle', rnd(2, 5));
    if (Math.random() < 0.15) this.say(game);
  }

  // Interações vindas do jogador
  pet(game) {
    this.love++;
    this.setState('happy', 2.5);
    this.path = [];
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
      this.face = viewFor(Math.sign(av.tx - this.tx), Math.sign(av.ty - this.ty));
      this.setState('happy', 2);
    });
    this.say(game, this.kind === 'gato' ? 'Mrrr?' : 'Au?');
  }

  spritePose() {
    if (this.moving) return Math.floor(this.anim * 7) % 2 ? 'walk' : 'stand';
    if (this.state === 'sleep') return 'sleep';
    if (this.state === 'sit' || this.state === 'eat') return 'sit';
    if (this.state === 'happy') return Math.floor(this.anim * 6) % 2 ? 'sit' : 'stand';
    return 'stand';
  }
}
