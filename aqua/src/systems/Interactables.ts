import * as THREE from 'three';
import type { WorldBuilder } from '../world/Builders';
import { roundRect } from '../core/AssetManager';
import type { Updatable } from '../core/types';
import { damp } from '../core/math';

/** Contract shared by everything the player can aim at and use with E. */
export interface Interactable {
  readonly id: string;
  readonly kind: 'toggle' | 'carry';
  /** World position used for spatial audio feedback. */
  readonly position: THREE.Vector3;
  /** Distance along the (normalized) ray to this object, or −1 when missed / unavailable. */
  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number;
  /** Action label shown in the HUD, e.g. "Ligar fontes do átrio". */
  prompt(): string;
  interact(): void;
  /** Max reach from the camera in metres. */
  readonly reach: number;
}

const tmpO = new THREE.Vector3();
const tmpD = new THREE.Vector3();

/** Ray vs oriented box (rotated about Y around `center`). */
export function rayOBB(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, half: THREE.Vector3, rotY: number): number {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const rx = origin.x - center.x;
  const rz = origin.z - center.z;
  tmpO.set(rx * c - rz * s, origin.y - center.y, rx * s + rz * c);
  tmpD.set(dir.x * c - dir.z * s, dir.y, dir.x * s + dir.z * c);
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z'] as const) {
    const o = tmpO[axis];
    const d = tmpD[axis];
    const h = half[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < -h || o > h) return -1;
      continue;
    }
    let t1 = (-h - o) / d;
    let t2 = (h - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return Math.max(tmin, 0);
}

export function raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, r: number): number {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : c <= 0 ? 0 : -1;
}

export type PanelIcon = 'fountain' | 'light' | 'valve' | 'bubbles';

export interface ControlPanelOptions {
  id: string;
  title: string;
  icon: PanelIcon;
  x: number;
  y?: number;
  z: number;
  /** Direction the screen faces (radians about Y; 0 = +Z). */
  rotY: number;
  initial: boolean;
  /** HUD prompt when currently off / on. */
  promptOn: string;
  promptOff: string;
  stateOn?: string;
  stateOff?: string;
  /** Adds a hand wheel that turns when operated (hydraulic valves). */
  wheel?: boolean;
  onChange(on: boolean): void;
}

/**
 * Free-standing control console with a live digital screen (canvas texture) and a glossy
 * push button. Toggling it calls `onChange`, which must change the world (fountains, lights…).
 */
export class ControlPanel implements Interactable, Updatable {
  readonly kind = 'toggle' as const;
  readonly id: string;
  readonly position = new THREE.Vector3();
  readonly reach = 2.8;
  readonly group = new THREE.Group();
  on: boolean;
  private readonly screen: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  private readonly button: THREE.Mesh;
  private readonly wheel: THREE.Group | null = null;
  private readonly led: THREE.MeshStandardMaterial;
  private press = 0;
  private wheelAngle = 0;
  private wheelTarget = 0;
  private readonly hitCenter = new THREE.Vector3();
  private readonly half = new THREE.Vector3(0.56, 0.42, 0.32);
  private readonly rotY: number;
  private pulse = 0;

  constructor(private readonly opts: ControlPanelOptions, b: WorldBuilder) {
    this.id = opts.id;
    this.on = opts.initial;
    this.rotY = opts.rotY;
    const y0 = opts.y ?? 0;
    const g = this.group;
    g.position.set(opts.x, y0, opts.z);
    g.rotation.y = opts.rotY;
    g.name = `Panel:${opts.id}`;
    const m = b.mats;

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.95, 24), m.whiteCeramic);
    pedestal.position.y = 0.475;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.06, 32), m.chrome);
    base.position.y = 0.03;
    const head = new THREE.Group();
    head.position.set(0, 1.05, 0);
    head.rotation.x = -0.6;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.56, 0.1), m.whiteCeramic);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.46, 0.02), m.rubber);
    bezel.position.set(-0.09, 0, 0.055);
    this.screen = b.assets.dynamicCanvas(512, 320, `panel:${opts.id}`);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.screen.texture, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), screenMat);
    screen.position.set(-0.09, 0, 0.067);
    this.led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3ce07a, emissiveIntensity: 2, roughness: 0.3 });
    const ledMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.02), this.led);
    ledMesh.position.set(0, -0.3, 0.04);
    ledMesh.scale.x = 1.6;
    this.button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.glossyCyan);
    this.button.rotation.x = Math.PI / 2;
    this.button.position.set(0.39, 0.05, 0.05);
    const buttonRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 24), m.chrome);
    buttonRing.position.set(0.39, 0.05, 0.052);
    head.add(shell, bezel, screen, ledMesh, this.button, buttonRing);
    g.add(pedestal, base, head);
    const staticParts: THREE.Mesh[] = [pedestal, base, shell, bezel, buttonRing];

    if (opts.wheel) {
      const wheel = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 10, 32), m.chrome);
      wheel.add(rim);
      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.56, 8), m.chrome);
        spoke.rotation.z = (i * Math.PI) / 4;
        wheel.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), m.glossyCyan);
      wheel.add(hub);
      wheel.position.set(0.62, 0.95, 0);
      wheel.rotation.y = Math.PI / 2;
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 10), m.chrome);
      axle.rotation.z = Math.PI / 2;
      axle.position.set(0.42, 0.95, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.95, 12), m.chrome);
      post.position.set(0.62, 0.475, 0.0);
      g.add(wheel, axle, post);
      staticParts.push(axle, post);
      this.wheel = wheel;
    }

    b.root.add(g);
    g.updateMatrixWorld(true);
    // Static housing goes into the zone's merged batch; only animated parts stay as meshes.
    for (const mesh of staticParts) {
      b.batcher.add(mesh.geometry, mesh.matrixWorld, mesh.material as THREE.Material, true, true);
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    head.getWorldPosition(this.hitCenter);
    this.hitCenter.y += 0.05;
    this.position.copy(this.hitCenter);
    if (opts.wheel) this.half.x = 0.9;
    b.collision.addCylinder({ x: opts.x, z: opts.z, r: 0.3, minY: y0, maxY: y0 + 1.0, surface: 'metal', owner: opts.id });
    if (opts.wheel) {
      const wx = opts.x + Math.cos(opts.rotY) * 0.62;
      const wz = opts.z - Math.sin(opts.rotY) * 0.62;
      b.collision.addCylinder({ x: wx, z: wz, r: 0.12, minY: y0, maxY: y0 + 1.2, surface: 'metal', owner: opts.id });
    }
    this.redraw();
  }

  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    return rayOBB(origin, dir, this.hitCenter, this.half, this.rotY);
  }

  prompt(): string {
    return this.on ? this.opts.promptOn : this.opts.promptOff;
  }

  interact(): void {
    this.setState(!this.on);
  }

  setState(on: boolean, silent = false): void {
    if (on === this.on) return;
    this.on = on;
    this.press = 1;
    this.pulse = 1;
    this.wheelTarget += on ? Math.PI * 2 : -Math.PI * 2;
    this.redraw();
    if (!silent) this.opts.onChange(on);
  }

  update(dt: number, time: number): void {
    if (this.press > 0) {
      this.press = Math.max(0, this.press - dt * 4);
    }
    this.button.position.z = 0.05 - Math.sin(this.press * Math.PI) * 0.03;
    if (this.wheel) {
      this.wheelAngle = damp(this.wheelAngle, this.wheelTarget, 2.2, dt);
      this.wheel.rotation.x = this.wheelAngle;
    }
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    this.led.emissive.setHex(this.on ? 0x3ce07a : 0x8aa0aa);
    this.led.emissiveIntensity = this.on ? 1.6 + Math.sin(time * 3) * 0.4 + this.pulse * 3 : 0.25 + this.pulse * 2;
  }

  private redraw(): void {
    const { ctx, canvas, texture } = this.screen;
    const w = canvas.width;
    const h = canvas.height;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#e9fbff');
    bg.addColorStop(0.5, '#bdeef8');
    bg.addColorStop(1, '#7fd3ea');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // glossy top reflection
    const gloss = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    gloss.addColorStop(0, 'rgba(255,255,255,0.85)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = gloss;
    roundRect(ctx, 10, 8, w - 20, h * 0.42, 26);
    ctx.fill();
    // header
    ctx.fillStyle = '#087dae';
    ctx.font = '600 34px "Segoe UI", "Frutiger", "Myriad Pro", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(this.opts.title, 150, 70);
    ctx.fillStyle = 'rgba(8,125,174,0.6)';
    ctx.font = '400 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('AQUA · sistema ambiental', 150, 108);
    drawIcon(ctx, this.opts.icon, 78, 88, this.on);
    // status pill
    const pillX = 40;
    const pillY = 170;
    const pillW = w - 80;
    const pillH = 74;
    const pill = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
    if (this.on) {
      pill.addColorStop(0, '#9ff59a');
      pill.addColorStop(0.5, '#3fc76a');
      pill.addColorStop(1, '#2aa955');
    } else {
      pill.addColorStop(0, '#f2f6f8');
      pill.addColorStop(0.5, '#c8d3d9');
      pill.addColorStop(1, '#aebcc4');
    }
    ctx.fillStyle = pill;
    roundRect(ctx, pillX, pillY, pillW, pillH, 37);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, pillX + 8, pillY + 5, pillW - 16, pillH * 0.42, 22);
    ctx.fill();
    ctx.fillStyle = this.on ? '#ffffff' : '#56707c';
    ctx.font = '700 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.on ? (this.opts.stateOn ?? 'LIGADO') : (this.opts.stateOff ?? 'DESLIGADO'), w / 2, pillY + pillH / 2 + 2);
    ctx.fillStyle = 'rgba(8,80,110,0.65)';
    ctx.font = '400 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Pressione  E  para alternar', w / 2, 284);
    texture.needsUpdate = true;
  }
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: PanelIcon, cx: number, cy: number, on: boolean): void {
  const grad = ctx.createRadialGradient(cx - 14, cy - 18, 6, cx, cy, 52);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, on ? '#5fe0f2' : '#c7d7de');
  grad.addColorStop(1, on ? '#087dae' : '#7d929c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (icon) {
    case 'fountain':
      ctx.moveTo(cx, cy + 22);
      ctx.lineTo(cx, cy - 18);
      ctx.moveTo(cx, cy - 18);
      ctx.quadraticCurveTo(cx - 22, cy - 26, cx - 26, cy + 6);
      ctx.moveTo(cx, cy - 18);
      ctx.quadraticCurveTo(cx + 22, cy - 26, cx + 26, cy + 6);
      ctx.moveTo(cx - 30, cy + 24);
      ctx.lineTo(cx + 30, cy + 24);
      break;
    case 'light':
      ctx.arc(cx, cy - 6, 18, Math.PI * 0.8, Math.PI * 2.2);
      ctx.moveTo(cx - 9, cy + 18);
      ctx.lineTo(cx + 9, cy + 18);
      ctx.moveTo(cx - 7, cy + 27);
      ctx.lineTo(cx + 7, cy + 27);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        ctx.moveTo(cx + Math.cos(a) * 26, cy - 6 + Math.sin(a) * 26);
        ctx.lineTo(cx + Math.cos(a) * 34, cy - 6 + Math.sin(a) * 34);
      }
      break;
    case 'valve':
      ctx.arc(cx, cy, 24, 0, Math.PI * 2);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      }
      break;
    case 'bubbles':
      ctx.arc(cx - 10, cy + 12, 10, 0, Math.PI * 2);
      ctx.moveTo(cx + 18, cy - 4);
      ctx.arc(cx + 10, cy - 4, 8, 0, Math.PI * 2);
      ctx.moveTo(cx + 2, cy - 24);
      ctx.arc(cx - 4, cy - 24, 6, 0, Math.PI * 2);
      break;
  }
  ctx.stroke();
}
