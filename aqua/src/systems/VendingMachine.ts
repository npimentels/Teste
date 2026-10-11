import * as THREE from 'three';
import type { Interactable } from './Interactables';
import { rayOBB } from './Interactables';
import type { InteractionModal } from '../player/InteractionSystem';
import type { Updatable } from '../core/types';
import type { WorldContext } from '../world/WorldContext';
import type { PhysicsBall } from './ObjectPhysics';
import { roundRect } from '../core/AssetManager';
import { BRANDS, ProductBatch, singleProductMesh, type ProductShape } from '../world/Products';

/**
 * 2000s drinks vending machine: glossy white body, cobalt front, lit display window with
 * spiral coils, an LCD menu, a keypad and a delivery tray.
 *
 * Sequence: approach → E opens the menu (in-world LCD + HUD) → choose (A/D, W/S or 1–6) →
 * E confirms (keypad lights, LCD feedback) → coil motor sound and the bottle walks off its
 * coil → it drops (thud) → completion jingle → the bottle waits in the tray as a carriable
 * object and the menu closes. Q leaves the menu at any time before confirming.
 */

interface Item {
  brand: number;
  shape: ProductShape;
  name: string;
}

const ITEMS: Item[] = [
  { brand: 0, shape: 'bottle', name: 'Água AQUA' },
  { brand: 1, shape: 'bottle', name: 'Bolha com gás' },
  { brand: 2, shape: 'bottle', name: 'Chá Lima' },
  { brand: 3, shape: 'can', name: 'Maré isotônico' },
  { brand: 4, shape: 'can', name: 'Suco Sol' },
  { brand: 1, shape: 'can', name: 'Bolha limão' },
];

const COLS = 3;
const FONT = '"Segoe UI", "Frutiger", "Helvetica Neue", Arial, sans-serif';

type State = 'idle' | 'menu' | 'motor' | 'drop' | 'done';

export class VendingMachine implements Interactable, InteractionModal, Updatable {
  readonly kind = 'use' as const;
  readonly reach = 2.4;
  readonly position: THREE.Vector3;
  readonly locksMovement = true;
  // the tray (below 0.55 m) is left out so the dispensed drink can be aimed at
  private readonly half = new THREE.Vector3(0.5, 0.71, 0.42);
  private readonly center: THREE.Vector3;
  private state: State = 'idle';
  private selected = 0;
  private timer = 0;
  private readonly screen: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private readonly keys: THREE.Mesh[] = [];
  private readonly keyOff: THREE.Material;
  private readonly keyOn: THREE.Material;
  private readonly coils: THREE.Mesh[] = [];
  private readonly flap: THREE.Mesh;
  private readonly glow: THREE.MeshBasicMaterial;
  private readonly falling: THREE.Mesh[];
  private readonly pool: PhysicsBall[][] = [];
  private poolCursor = 0;
  private message = '';
  private messageTimer = 0;
  private dirty = true;
  /** Drink waiting in the tray (aiming at the machine then offers to take it). */
  private waiting: { ball: PhysicsBall; name: string } | null = null;
  private readonly trayPos: THREE.Vector3;
  readonly group = new THREE.Group();

  constructor(
    private readonly ctx: WorldContext,
    readonly id: string,
    readonly x: number,
    readonly z: number,
    /** Direction the front faces (0 = +Z). */
    readonly rotY: number,
  ) {
    const b = ctx.builder;
    const m = ctx.mats;
    const g = this.group;
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    ctx.builder.root.add(g);
    this.center = new THREE.Vector3(x, 1.26, z);
    this.position = this.toWorld(0.3, 1.2, 0.42);
    this.trayPos = this.toWorld(-0.2, 0.3, 0.52);
    const W = (lx: number, lz: number) => this.toWorld(lx, 0, lz);

    // ---- Body (batched into the world) -------------------------------------------------
    const P = (lx: number, y0: number, lz: number, sx: number, sy: number, sz: number, mat: THREE.Material, radius = 0, cast = true) => {
      const p = W(lx, lz);
      b.box(mat, p.x, y0, p.z, sx, sy, sz, { rotY, radius, cast, receive: true });
    };
    P(0, 0.06, -0.02, 1.0, 1.9, 0.78, m.whiteCeramic, 0.07);
    P(0, 0, 0, 0.94, 0.08, 0.7, m.chrome, 0.02, false); // plinth
    // cobalt front frame around the window and the control column
    P(0, 0.06, 0.39, 1.0, 0.56, 0.06, m.cobaltCeramic, 0.03);
    P(0, 1.78, 0.39, 1.0, 0.18, 0.06, m.cobaltCeramic, 0.03);
    P(-0.485, 0.62, 0.39, 0.03, 1.16, 0.06, m.cobaltCeramic, 0.01);
    P(0.29, 0.62, 0.39, 0.42, 1.16, 0.06, m.cobaltCeramic, 0.02);
    P(0.08, 0.62, 0.39, 0.02, 1.16, 0.06, m.chrome, 0, false);
    // header logo strip (lit) + rounded top cap in lime
    P(0, 1.84, 0.425, 0.86, 0.08, 0.01, m.emissiveCyan, 0, false);
    P(0, 1.96, -0.02, 0.98, 0.06, 0.74, m.limeGlossy, 0.03);
    // display window: glass, shelves, backlight
    P(-0.2, 0.62, 0.41, 0.56, 1.16, 0.015, m.glass, 0, false);
    for (const y of [0.66, 1.2]) P(-0.2, y, 0.06, 0.56, 0.02, 0.6, m.chrome, 0, false);
    this.glow = new THREE.MeshBasicMaterial({ color: 0xd9f6ff, toneMapped: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), this.glow);
    back.position.set(-0.2, 1.2, -0.26);
    g.add(back);
    // coin slot, bill acceptor, return lever
    P(0.29, 0.98, 0.425, 0.14, 0.06, 0.02, m.chrome, 0.01, false);
    P(0.29, 0.86, 0.425, 0.2, 0.05, 0.02, m.glossBlack, 0.01, false);
    // delivery tray: dark recess + chrome lip that holds the bottle
    P(-0.2, 0.16, 0.42, 0.5, 0.3, 0.02, m.glossBlack, 0.02, false);
    P(-0.2, 0.14, 0.5, 0.52, 0.06, 0.2, m.chrome, 0.02, false);
    P(-0.2, 0.2, 0.6, 0.52, 0.12, 0.02, m.chrome, 0.01, false);
    const lip = W(-0.2, 0.5);
    ctx.collision.addBox({ x: lip.x, z: lip.z, sx: 0.52, sz: 0.2, minY: 0, maxY: 0.2, rotY, surface: 'metal' });
    // body collider
    const c = W(0, 0);
    ctx.collision.addBox({ x: c.x, z: c.z, sx: 1.0, sz: 0.84, minY: 0, maxY: 2.0, rotY, surface: 'metal' });

    // ---- Products on spiral coils (instanced) ------------------------------------------
    const batch = new ProductBatch();
    const coilGeo = coilGeometry();
    for (const [i, item] of ITEMS.entries()) {
      const { lx, ly } = slot(i);
      for (const lz of [0.24, 0.08, -0.08, -0.22]) {
        const p = this.toWorld(lx, ly, lz);
        batch.add(item.shape, p.x, ly, p.z, rotY, item.brand);
      }
      const coil = new THREE.Mesh(coilGeo, m.chrome);
      coil.position.set(lx, ly + 0.05, 0.02);
      g.add(coil);
      this.coils.push(coil);
    }
    batch.build(ctx.builder.root, ctx.assets, `${id}:products`);

    // ---- LCD and keypad (dynamic) ----------------------------------------------------------
    const scr = ctx.assets.dynamicCanvas(512, 384, `vend-${id}`);
    this.screen = { ctx: scr.ctx, texture: scr.texture };
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), new THREE.MeshBasicMaterial({ map: scr.texture, toneMapped: false }));
    lcd.position.set(0.29, 1.45, 0.4255);
    g.add(lcd);
    this.keyOff = m.whiteCeramic;
    this.keyOn = m.emissiveCyan;
    const keyGeo = new THREE.BoxGeometry(0.075, 0.05, 0.02);
    for (let i = 0; i < ITEMS.length; i++) {
      const k = new THREE.Mesh(keyGeo, this.keyOff);
      k.position.set(0.29 + ((i % COLS) - 1) * 0.1, 1.24 - Math.floor(i / COLS) * 0.07, 0.43);
      g.add(k);
      this.keys.push(k);
    }
    // tinted acrylic flap over the tray
    this.flap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.012), m.cyanAcrylic);
    this.flap.geometry.translate(0, -0.12, 0);
    this.flap.position.set(-0.2, 0.44, 0.44);
    g.add(this.flap);

    // ---- Falling products (one per item, hidden) and the carriable pool ------------------
    this.falling = ITEMS.map((item) => {
      const mesh = singleProductMesh(ctx.assets, item.shape, item.brand);
      mesh.visible = false;
      g.add(mesh);
      return mesh;
    });
    for (const [i, item] of ITEMS.entries()) {
      const list: PhysicsBall[] = [];
      for (let k = 0; k < 2; k++) {
        const mesh = singleProductMesh(ctx.assets, item.shape, item.brand);
        mesh.castShadow = true;
        mesh.visible = false;
        ctx.scene.add(mesh);
        const radius = item.shape === 'can' ? 0.07 : 0.1;
        const ball = ctx.physics.addBall(`${id}-item-${i}-${k}`, item.name, mesh, radius);
        ball.pooled = true;
        ball.upright = true;
        ball.deactivate();
        ctx.addInteractable(ball);
        list.push(ball);
      }
      this.pool.push(list);
    }
    this.drawScreen();
  }

  private toWorld(lx: number, ly: number, lz: number): THREE.Vector3 {
    const c = Math.cos(this.rotY);
    const s = Math.sin(this.rotY);
    return new THREE.Vector3(this.x + lx * c + lz * s, ly, this.z - lx * s + lz * c);
  }

  // ---- Interactable ------------------------------------------------------------------------
  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (this.state !== 'idle') return -1;
    return rayOBB(origin, dir, this.center, this.half, this.rotY);
  }

  /** HUD prompt: the world prompt when idle, the current choice while the menu is open. */
  prompt(): string {
    if (this.state === 'menu') return `Confirmar · ${this.selected + 1} ${ITEMS[this.selected].name}`;
    if (this.state === 'motor' || this.state === 'drop') return 'Liberando…';
    if (this.waiting) return `Retirar ${this.waiting.name}`;
    return 'Usar máquina de bebidas';
  }

  interact(): void {
    if (this.state !== 'idle') return;
    if (this.waiting) {
      const ball = this.waiting.ball;
      this.waiting = null;
      this.ctx.physics.pickUp(ball);
      return;
    }
    this.state = 'menu';
    this.dirty = true;
    this.ctx.audio.play('vendSelect', { position: this.position });
  }

  // ---- InteractionModal ------------------------------------------------------------------------
  get active(): boolean {
    return this.state === 'menu' || this.state === 'motor' || this.state === 'drop';
  }

  get menuOpen(): boolean {
    return this.state === 'menu';
  }

  get selection(): number {
    return this.selected;
  }

  hint(): string | null {
    if (this.state !== 'menu') return 'Preparando sua bebida…';
    return '<kbd>A</kbd>/<kbd>D</kbd> ou <kbd>1</kbd>–<kbd>6</kbd> escolher · <kbd>E</kbd> confirmar · <kbd>Q</kbd> sair';
  }

  update(dtOrInput: number | { wasPressed(code: string): boolean }, time?: number): void {
    if (typeof dtOrInput === 'number') this.tick(dtOrInput, time ?? 0);
    else this.handleInput(dtOrInput);
  }

  private handleInput(input: { wasPressed(code: string): boolean }): void {
    if (this.state !== 'menu') return;
    const prev = this.selected;
    if (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft')) this.selected = (this.selected + ITEMS.length - 1) % ITEMS.length;
    if (input.wasPressed('KeyD') || input.wasPressed('ArrowRight')) this.selected = (this.selected + 1) % ITEMS.length;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) this.selected = (this.selected + ITEMS.length - COLS) % ITEMS.length;
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) this.selected = (this.selected + COLS) % ITEMS.length;
    for (let i = 0; i < ITEMS.length; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) this.selected = i;
    if (prev !== this.selected) {
      this.ctx.audio.play('vendSelect', { position: this.position, volume: 0.7 });
      this.dirty = true;
    }
    if (input.wasPressed('KeyQ') || input.wasPressed('Backspace')) {
      this.close('');
      return;
    }
    if (input.wasPressed('KeyE') || input.wasPressed('Enter')) this.confirm();
  }

  /** Starts dispensing the selected item (also used by automated tests). */
  confirm(index = this.selected): void {
    if (this.state !== 'menu') return;
    this.selected = index;
    this.state = 'motor';
    this.timer = 0;
    this.dirty = true;
    this.ctx.audio.play('vendSelect', { position: this.position });
    this.ctx.audio.play('vendMotor', { position: this.position });
  }

  cancel(): void {
    if (this.state === 'menu') this.close('');
  }

  private close(message: string): void {
    this.state = 'idle';
    this.message = message;
    this.messageTimer = message ? 6 : 0;
    this.dirty = true;
    for (const c of this.coils) c.rotation.z = 0;
  }

  private tick(dt: number, time: number): void {
    // key lights and window glow
    for (const [i, k] of this.keys.entries()) k.material = this.active && i === this.selected ? this.keyOn : this.keyOff;
    const pulse = this.state === 'motor' || this.state === 'drop' ? 0.9 + Math.sin(time * 14) * 0.1 : 1;
    this.glow.color.setRGB(0.85 * pulse, 0.96 * pulse, 1);
    this.flap.rotation.x = Math.max(0, this.flap.rotation.x - dt * 2.4);
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.message = '';
        this.dirty = true;
      }
    }
    const item = this.selected;
    const { lx, ly } = slot(item);
    const fall = this.falling[item];
    if (this.state === 'motor') {
      this.timer += dt;
      const k = Math.min(1, this.timer / 0.8);
      this.coils[item].rotation.z = -k * Math.PI * 2;
      fall.visible = true;
      fall.position.set(lx, ly + productHalf(ITEMS[item].shape), 0.24 + k * 0.1);
      if (this.timer >= 0.8) {
        this.state = 'drop';
        this.timer = 0;
      }
    } else if (this.state === 'drop') {
      this.timer += dt;
      const y0 = ly + productHalf(ITEMS[item].shape);
      const y = y0 - 0.5 * 9.8 * this.timer * this.timer;
      fall.position.y = Math.max(0.3, y);
      fall.rotation.x = Math.min(1.2, this.timer * 3);
      if (y <= 0.3) {
        fall.visible = false;
        fall.rotation.x = 0;
        this.flap.rotation.x = 0.9;
        this.ctx.audio.play('vendDrop', { position: this.position });
        this.deliver(item);
        window.setTimeout(() => this.ctx.audio.play('vendDone', { position: this.position }), 350);
        this.close(`Retire: ${ITEMS[item].name}`);
      }
    }
    if (this.waiting) {
      const b = this.waiting.ball;
      if (!b.active || b.carried || b.position.distanceTo(this.trayPos) > 0.6) this.waiting = null;
    }
    if (this.dirty) this.drawScreen();
  }

  private deliver(item: number): void {
    const list = this.pool[item];
    // reuse a free one, otherwise the oldest one that is not being carried
    let ball = list.find((b) => !b.active);
    if (!ball) {
      ball = list[this.poolCursor % list.length];
      this.poolCursor++;
      if (ball.carried) ball = list.find((b) => !b.carried) ?? ball;
      if (ball.carried) this.ctx.physics.drop(false);
    }
    const p = this.toWorld(-0.2, 0, 0.52);
    ball.activate(p.x, 0.2 + ball.radius + 0.02, p.z);
    ball.mesh.rotation.y = this.rotY;
    this.waiting = { ball, name: ITEMS[item].name };
  }

  private drawScreen(): void {
    this.dirty = false;
    const c = this.screen.ctx;
    const W = 512;
    const H = 384;
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0d2f7a');
    bg.addColorStop(1, '#06173f');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#7cf2ff';
    c.font = `700 30px ${FONT}`;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('AQUA Drinks', 20, 30);
    c.textAlign = 'right';
    c.font = `600 20px ${FONT}`;
    c.fillStyle = '#b8ffd0';
    c.fillText('cortesia · free', W - 20, 30);
    for (const [i, item] of ITEMS.entries()) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = 14 + col * 164;
      const y = 62 + row * 118;
      const sel = this.state !== 'idle' && i === this.selected;
      c.fillStyle = sel ? '#28c5df' : 'rgba(255,255,255,0.08)';
      roundRect(c, x, y, 156, 108, 14);
      c.fill();
      c.fillStyle = BRANDS[item.brand].color;
      roundRect(c, x + 12, y + 14, 30, item.shape === 'can' ? 50 : 70, 8);
      c.fill();
      c.fillStyle = sel ? '#06173f' : '#ffffff';
      c.textAlign = 'left';
      c.font = `800 28px ${FONT}`;
      c.fillText(String(i + 1), x + 54, y + 30);
      c.font = `600 18px ${FONT}`;
      const words = item.name.split(' ');
      c.fillText(words[0], x + 54, y + 62);
      if (words[1]) c.fillText(words.slice(1).join(' '), x + 54, y + 86);
    }
    c.textAlign = 'center';
    c.font = `600 22px ${FONT}`;
    let status: string;
    if (this.state === 'menu') status = `Selecione e pressione E · ${ITEMS[this.selected].name}`;
    else if (this.state === 'motor' || this.state === 'drop') status = 'Liberando…';
    else status = this.message || 'Pressione E para escolher';
    c.fillStyle = this.state === 'motor' || this.state === 'drop' ? '#fff27a' : '#b8ffd0';
    c.fillText(status, W / 2, H - 22);
    this.screen.texture.needsUpdate = true;
  }
}

function slot(i: number): { lx: number; ly: number } {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { lx: -0.38 + col * 0.18, ly: row === 0 ? 1.22 : 0.68 };
}

function productHalf(shape: ProductShape): number {
  return shape === 'can' ? 0.06 : 0.13;
}

let coilCache: THREE.BufferGeometry | null = null;
function coilGeometry(): THREE.BufferGeometry {
  if (coilCache) return coilCache;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const a = t * Math.PI * 2 * 5;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.28 - t * 0.56));
  }
  coilCache = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.005, 5, false);
  return coilCache;
}
