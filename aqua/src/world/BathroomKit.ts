import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { UseSpot } from '../systems/Interactables';
import { WaterStream } from '../environment/ParticleSystem';
import type { SoundHandle } from '../systems/AudioManager';
import type { Updatable } from '../core/types';
import { HingedDoor } from './Doors';

/**
 * Bathroom fixtures shared by every restroom: vessel sinks with working faucets, soap pumps,
 * hand dryers, paper-towel dispensers, flushing toilets, stalls with real doors, hooks,
 * ventilation grilles and the (cheap) reflective mirror wall. One `BathroomFixtures` instance
 * animates a room's fixtures, and only while the viewer is near.
 */

interface Faucet {
  stream: WaterStream;
  sound: SoundHandle;
  timer: number;
  pos: THREE.Vector3;
  foam: THREE.Mesh;
  foamTimer: number;
}

export class BathroomFixtures implements Updatable {
  private readonly faucets: Faucet[] = [];
  private readonly pumps: Array<{ mesh: THREE.Object3D; t: number; y: number; faucet: Faucet | null }> = [];
  private readonly dryers: Array<{ timer: number; led: THREE.MeshStandardMaterial; pos: THREE.Vector3; air: THREE.Mesh }> = [];
  private readonly papers: Array<{ sheet: THREE.Mesh; t: number; pos: THREE.Vector3 }> = [];
  private readonly flushes: Array<{ water: THREE.Mesh; timer: number; y: number }> = [];
  private readonly mirrors: Array<{ reflector: Reflector; fallback: THREE.Mesh; inside: () => boolean }> = [];
  private readonly glass: THREE.MeshPhysicalMaterial;
  private readonly foamMat: THREE.MeshStandardMaterial;

  constructor(
    private readonly ctx: WorldContext,
    private readonly id: string,
    /** Centre of the room and the radius within which fixtures animate. */
    private readonly center: THREE.Vector3,
    private readonly radius = 14,
  ) {
    this.glass = new THREE.MeshPhysicalMaterial({ name: 'sinkGlass', color: 0xa8e4ff, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.5, envMapIntensity: 1.5 });
    this.foamMat = new THREE.MeshStandardMaterial({ name: 'foam', color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.9 });
    ctx.addUpdatable(this);
  }

  /**
   * Glass vessel sink on a counter top at `counterY`, with a deck-mounted chrome faucet behind
   * it (towards −facing) and a drain. `facing` is the yaw the user faces when using it
   * (0 = looking −Z). Returns the faucet so a soap pump can rinse into it.
   */
  sink(b: WorldBuilder, x: number, z: number, counterY: number, facing: number, i: number, bowlR = 0.24): Faucet {
    const m = b.mats;
    const fx = -Math.sin(facing);
    const fz = -Math.cos(facing);
    const bowl = new THREE.LatheGeometry(
      [
        [0.001, 0],
        [bowlR * 0.4, 0.004],
        [bowlR * 0.78, 0.05],
        [bowlR * 0.96, 0.13],
        [bowlR, 0.17],
        [bowlR * 0.93, 0.17],
        [bowlR * 0.88, 0.13],
        [bowlR * 0.7, 0.06],
        [bowlR * 0.35, 0.02],
        [0.001, 0.018],
      ].map(([a, c]) => new THREE.Vector2(a, c)),
      44,
    );
    b.place(bowl, this.glass, x, counterY, z, { cast: false });
    bowl.dispose();
    b.cylinder(m.chrome, x, counterY + 0.019, z, 0.032, 0.032, 0.006, { cast: false, segments: 14 }); // drain
    b.torus(m.glossBlack, x, counterY + 0.024, z, 0.018, 0.004, { rotX: Math.PI / 2, cast: false });
    // faucet: chrome column on the far side (where the user looks) + spout reaching over the bowl
    const bx = x + fx * (bowlR + 0.1);
    const bz = z + fz * (bowlR + 0.1);
    b.cylinder(m.chrome, bx, counterY, bz, 0.03, 0.035, 0.32, { segments: 14, cast: false });
    const tip = new THREE.Vector3(x + fx * 0.03, counterY + 0.3, z + fz * 0.03);
    b.pipe([new THREE.Vector3(bx, counterY + 0.3, bz), new THREE.Vector3(bx, counterY + 0.38, bz), new THREE.Vector3(tip.x, counterY + 0.38, tip.z), tip], 0.016, m.chrome, 0.07, { cast: false });
    b.box(m.chrome, bx - fz * 0.06, counterY + 0.26, bz + fx * 0.06, 0.08, 0.02, 0.02, { rotY: facing, cast: false }); // lever
    const stream = WaterStream.tube([tip.clone().setY(tip.y - 0.01), new THREE.Vector3(x + fx * 0.02, counterY + 0.17, z + fz * 0.02), new THREE.Vector3(x, counterY + 0.03, z)], 0.008, { speed: -2.5, opacity: 0.75, travelTime: 0.22 });
    stream.setActive(false, true);
    b.root.add(stream.mesh);
    this.ctx.addUpdatable(stream);
    const pos = new THREE.Vector3(x, counterY + 0.2, z);
    const sound = this.ctx.audio.addWaterSource('stream', { x, y: counterY + 0.2, z }, 0.22, false);
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), this.foamMat);
    foam.scale.set(1.3, 0.35, 1.1);
    foam.position.set(x, counterY + 0.035, z);
    foam.visible = false;
    b.root.add(foam);
    const f: Faucet = { stream, sound, timer: 0, pos, foam, foamTimer: 0 };
    this.faucets.push(f);
    this.ctx.addInteractable(
      new UseSpot(`${this.id}-faucet-${i}`, new THREE.Vector3(x, counterY + 0.2, z), new THREE.Vector3(bowlR, 0.22, bowlR), 0, () => (f.timer > 0 ? 'Fechar torneira' : 'Abrir torneira'), () => this.toggleFaucet(f)),
    );
    return f;
  }

  private toggleFaucet(f: Faucet): void {
    const on = f.timer <= 0;
    f.timer = on ? 7 : 0;
    f.stream.setActive(on);
    f.sound.setActive(on);
    if (on) this.ctx.audio.play('faucet', { position: f.pos, volume: 0.6 });
    if (on && f.foamTimer > 0) f.foamTimer = Math.min(f.foamTimer, 1.2); // rinsing washes the foam away
  }

  /** Pump soap dispenser standing on a counter (frosted bottle, chrome pump). */
  soap(b: WorldBuilder, x: number, y: number, z: number, i: number, body: THREE.Material, faucet: Faucet | null = null): void {
    const m = b.mats;
    const bottle = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.045, 0), new THREE.Vector2(0.05, 0.02), new THREE.Vector2(0.05, 0.13), new THREE.Vector2(0.03, 0.16), new THREE.Vector2(0.015, 0.17), new THREE.Vector2(0.001, 0.17)], 18);
    b.place(bottle, body, x, y, z, { cast: false });
    bottle.dispose();
    const pump = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), m.chrome);
    head.position.y = 0.025;
    const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.06), m.chrome);
    nozzle.position.set(0, 0.045, 0.03);
    pump.add(head, nozzle);
    pump.position.set(x, y + 0.17, z);
    b.root.add(pump);
    const entry = { mesh: pump, t: 0, y: y + 0.17, faucet };
    this.pumps.push(entry);
    this.ctx.addInteractable(
      new UseSpot(`${this.id}-soap-${i}`, new THREE.Vector3(x, y + 0.12, z), new THREE.Vector3(0.07, 0.13, 0.07), 0, () => 'Usar sabonete', () => {
        entry.t = 0.35;
        this.ctx.audio.play('soap', { position: pump.position });
        if (faucet) {
          faucet.foamTimer = 5;
          faucet.foam.visible = true;
        }
      }),
    );
  }

  /** Wall hand dryer facing `rotY` (0 = +Z): white capsule with a cyan status ring. */
  dryer(b: WorldBuilder, x: number, y: number, z: number, rotY: number, i: number): void {
    const m = b.mats;
    const fx = Math.sin(rotY);
    const fz = Math.cos(rotY);
    const body = new THREE.CapsuleGeometry(0.13, 0.2, 6, 18).rotateZ(Math.PI / 2).scale(1, 1, 0.8);
    b.place(body, m.whiteCeramic, x + fx * 0.11, y, z + fz * 0.11, { rotY, cast: false });
    body.dispose();
    b.box(m.chrome, x + fx * 0.14, y - 0.13, z + fz * 0.14, 0.2, 0.03, 0.12, { rotY, cast: false });
    const led = new THREE.MeshStandardMaterial({ name: 'dryerLed', color: 0x16314f, emissive: 0x28c5df, emissiveIntensity: 0 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 20), led);
    ring.position.set(x + fx * 0.235, y + 0.03, z + fz * 0.235);
    ring.rotation.y = rotY;
    b.root.add(ring);
    const air = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
    air.position.set(x + fx * 0.15, y - 0.32, z + fz * 0.15);
    air.rotation.x = Math.PI;
    air.visible = false;
    b.root.add(air);
    const d = { timer: 0, led, pos: new THREE.Vector3(x, y, z), air };
    this.dryers.push(d);
    this.ctx.addInteractable(
      new UseSpot(`${this.id}-dryer-${i}`, new THREE.Vector3(x + fx * 0.12, y - 0.05, z + fz * 0.12), new THREE.Vector3(0.22, 0.2, 0.14), rotY, () => (d.timer > 0 ? 'Secador ligado' : 'Ligar secador de mãos'), () => {
        if (d.timer > 0) return;
        d.timer = 3.2;
        this.ctx.audio.play('dryer', { position: d.pos });
      }),
    );
  }

  /** Paper-towel dispenser: a sheet slides out when used. */
  paper(b: WorldBuilder, x: number, y: number, z: number, rotY: number, i: number): void {
    const m = b.mats;
    const fx = Math.sin(rotY);
    const fz = Math.cos(rotY);
    b.box(m.whiteCeramic, x + fx * 0.08, y, z + fz * 0.08, 0.3, 0.36, 0.14, { rotY, radius: 0.05, cast: false });
    b.box(m.cyanAcrylic, x + fx * 0.15, y + 0.2, z + fz * 0.15, 0.22, 0.1, 0.01, { rotY, cast: false });
    b.box(m.glossBlack, x + fx * 0.153, y + 0.02, z + fz * 0.153, 0.2, 0.012, 0.01, { rotY, cast: false });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }));
    sheet.geometry.translate(0, -0.1, 0);
    sheet.position.set(x + fx * 0.16, y + 0.02, z + fz * 0.16);
    sheet.rotation.y = rotY;
    sheet.scale.y = 0.001;
    sheet.visible = false;
    b.root.add(sheet);
    const p = { sheet, t: 0, pos: new THREE.Vector3(x, y, z) };
    this.papers.push(p);
    this.ctx.addInteractable(
      new UseSpot(`${this.id}-paper-${i}`, new THREE.Vector3(x + fx * 0.1, y + 0.18, z + fz * 0.1), new THREE.Vector3(0.17, 0.2, 0.1), rotY, () => 'Pegar papel-toalha', () => {
        if (p.t > 0) return;
        p.t = 2.6;
        p.sheet.visible = true;
        this.ctx.audio.play('paper', { position: p.pos });
      }),
    );
  }

  /** Wall-hung toilet against a wall; `rotY` is the direction it faces (0 = +Z). Flush plate above. */
  toilet(b: WorldBuilder, x: number, z: number, rotY: number, i: number, y0 = 0): void {
    const m = b.mats;
    const fx = Math.sin(rotY);
    const fz = Math.cos(rotY);
    const bowl = new THREE.LatheGeometry(
      [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.12, 0.0), new THREE.Vector2(0.19, 0.12), new THREE.Vector2(0.2, 0.22), new THREE.Vector2(0.17, 0.22), new THREE.Vector2(0.15, 0.14), new THREE.Vector2(0.001, 0.12)],
      28,
    );
    bowl.scale(1, 1, 1.35);
    const cx = x + fx * 0.36;
    const cz = z + fz * 0.36;
    b.place(bowl, m.whiteCeramic, cx, y0 + 0.2, cz, { rotY });
    bowl.dispose();
    b.box(m.whiteCeramic, x + fx * 0.11, y0 + 0.12, z + fz * 0.11, 0.38, 0.5, 0.22, { rotY, radius: 0.08 });
    b.torus(m.whiteCeramic, cx, y0 + 0.43, cz, 0.18, 0.025, { rotX: Math.PI / 2, cast: false });
    b.collision.addBox({ x: x + fx * 0.3, z: z + fz * 0.3, sx: 0.42, sz: 0.6, rotY, minY: y0, maxY: y0 + 0.45, surface: 'tile' });
    b.box(m.whiteCeramic, x + fx * 0.025, y0 + 0.95, z + fz * 0.025, 0.26, 0.18, 0.02, { rotY, radius: 0.01, cast: false });
    for (const e of [-1, 1]) b.box(m.chrome, x + fx * 0.04 + fz * e * 0.055, y0 + 0.98, z + fz * 0.04 - fx * e * 0.055, 0.09, 0.12, 0.012, { rotY, cast: false });
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshPhysicalMaterial({ color: 0x7fd8ff, roughness: 0.05, transparent: true, opacity: 0.7, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1, 1.3, 1);
    water.position.set(cx, y0 + 0.36, cz);
    b.root.add(water);
    const entry = { water, timer: 0, y: y0 + 0.36 };
    this.flushes.push(entry);
    this.ctx.addInteractable(
      new UseSpot(`${this.id}-flush-${i}`, new THREE.Vector3(x + fx * 0.04, y0 + 1.04, z + fz * 0.04), new THREE.Vector3(0.14, 0.1, 0.06), rotY, () => 'Dar descarga', () => {
        if (entry.timer > 0) return;
        entry.timer = 3;
        this.ctx.audio.play('flush', { position: water.position });
      }, 2.0, () => entry.timer <= 0),
    );
  }

  /**
   * Row of stalls along a wall. `wall` is the back wall line at z = wallZ (stalls extend
   * towards +dirZ), from x0, each `width` wide. Frosted doors with locks and coat hooks.
   */
  stalls(b: WorldBuilder, x0: number, wallZ: number, dirZ: number, count: number, width: number, depth: number, y0 = 0, firstIndex = 0): void {
    const m = b.mats;
    const front = wallZ + dirZ * depth;
    for (let i = 0; i <= count; i++) {
      const px = x0 + i * width;
      if (i > 0 && i < count) {
        b.box(m.cobaltCeramic, px, y0 + 0.15, wallZ + (dirZ * depth) / 2, 0.05, 1.95, depth, { radius: 0.02 });
        b.collision.addBox({ x: px, z: wallZ + (dirZ * depth) / 2, sx: 0.08, sz: depth, minY: y0, maxY: y0 + 2.1, surface: 'tile' });
      }
      b.cylinder(m.chrome, px, y0, front, 0.025, 0.025, 2.1, { segments: 10, cast: false });
    }
    b.box(m.chrome, x0 + (count * width) / 2, y0 + 2.08, front, count * width, 0.04, 0.05, { cast: false });
    for (let i = 0; i < count; i++) {
      const a = x0 + i * width;
      const c = a + width;
      const dw = 0.78;
      const fixedW = c - a - dw - 0.06;
      b.box(m.frostedGlass, a + 0.03 + fixedW / 2, y0 + 0.15, front, fixedW, 1.95, 0.03, { cast: false, receive: false });
      b.collision.addBox({ x: a + 0.03 + fixedW / 2, z: front, sx: fixedW, sz: 0.08, minY: y0, maxY: y0 + 2.1, surface: 'glass' });
      // door hinged on the stall's east post, leaf extends west, swings outwards
      new HingedDoor(this.ctx, b, {
        id: `${this.id}-stall-${firstIndex + i}`,
        x: c - 0.04,
        z: front,
        y0: y0 + 0.12,
        width: dw,
        height: 1.95,
        along: Math.PI,
        swing: dirZ > 0 ? 1 : -1,
        style: 'frosted',
        name: 'porta da cabine',
        decorate: (leaf, w, h) => {
          const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), m.limeGlossy);
          lock.rotation.x = Math.PI / 2;
          lock.position.set(w - 0.12, h * 0.56, 0.03);
          const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI), m.chrome);
          hook.position.set(w / 2, h * 0.85, -dirZ * 0.05);
          leaf.add(lock, hook);
        },
      });
      this.toilet(b, (a + c) / 2, wallZ, dirZ > 0 ? 0 : Math.PI, firstIndex + i, y0);
      // coat hook on the back wall and a small vent grille above
      b.torus(m.chrome, (a + c) / 2 + 0.45, y0 + 1.6, wallZ + dirZ * 0.02, 0.03, 0.007, { arc: Math.PI, cast: false });
    }
  }

  /** Slotted ventilation grille on a ceiling at height y. */
  vent(b: WorldBuilder, x: number, y: number, z: number): void {
    const m = b.mats;
    b.box(m.whiteCeramic, x, y - 0.02, z, 0.5, 0.02, 0.5, { radius: 0.01, cast: false });
    for (let i = -3; i <= 3; i++) b.box(m.glossBlack, x + i * 0.06, y - 0.025, z, 0.02, 0.006, 0.4, { cast: false });
  }

  /**
   * Mirror wall: one planar Reflector behind a decorative panel with cut-outs, live only while
   * `inside()` and on High quality; a polished-metal fallback otherwise. The reflection pass
   * renders only `zone` (other world groups are hidden for it).
   */
  mirror(b: WorldBuilder, geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotY: number, zone: THREE.Object3D, inside: () => boolean): void {
    const reflector = new Reflector(geometry, { textureWidth: 768, textureHeight: 512, color: 0xc8d8e8, clipBias: 0.003, multisample: 0 });
    reflector.position.set(x, y, z);
    reflector.rotation.y = rotY;
    b.root.add(reflector);
    limitReflection(reflector, zone);
    const fallback = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: 'mirrorFallback', color: 0xdfeaf4, metalness: 1, roughness: 0.04, envMapIntensity: 1.2 }));
    fallback.position.copy(reflector.position);
    fallback.rotation.y = rotY;
    b.root.add(fallback);
    this.mirrors.push({ reflector, fallback, inside });
  }

  update(dt: number, time: number): void {
    const near = this.ctx.viewer.distanceTo(this.center) < this.radius;
    const high = this.ctx.quality().level === 'high';
    for (const mr of this.mirrors) {
      const live = near && high && mr.inside();
      mr.reflector.visible = live;
      mr.fallback.visible = !live;
    }
    if (!near) return;
    for (const f of this.faucets) {
      if (f.timer > 0) {
        f.timer -= dt;
        if (f.timer <= 0) {
          f.stream.setActive(false);
          f.sound.setActive(false);
        }
      }
      if (f.foamTimer > 0) {
        f.foamTimer -= dt;
        f.foam.scale.x = 1.3 * Math.min(1, f.foamTimer + 0.2);
        if (f.foamTimer <= 0) f.foam.visible = false;
      }
    }
    for (const p of this.pumps) {
      if (p.t <= 0) continue;
      p.t -= dt;
      p.mesh.position.y = p.y - Math.sin(Math.max(0, p.t / 0.35) * Math.PI) * 0.02;
    }
    for (const d of this.dryers) {
      if (d.timer <= 0) continue;
      d.timer -= dt;
      const on = d.timer > 0;
      d.led.emissiveIntensity = on ? 2 + Math.sin(time * 20) * 0.4 : 0;
      d.air.visible = on;
      (d.air.material as THREE.MeshBasicMaterial).opacity = on ? 0.12 + Math.sin(time * 30) * 0.03 : 0;
    }
    for (const p of this.papers) {
      if (p.t <= 0) continue;
      p.t -= dt;
      const k = p.t > 2.0 ? (2.6 - p.t) / 0.6 : p.t > 0.4 ? 1 : p.t / 0.4;
      p.sheet.scale.y = Math.max(0.001, k);
      if (p.t <= 0) p.sheet.visible = false;
    }
    for (const f of this.flushes) {
      if (f.timer <= 0) continue;
      f.timer -= dt;
      f.water.rotation.z += dt * 9 * Math.min(1, f.timer);
      f.water.position.y = f.y - Math.sin(Math.min(1, (3 - f.timer) / 1.5) * Math.PI) * 0.04;
    }
  }
}

/** While the reflector renders, everything outside `zone` (and not a light) is hidden. */
export function limitReflection(reflector: Reflector, zone: THREE.Object3D): void {
  const render = reflector.onBeforeRender;
  let hide: THREE.Object3D[] | null = null;
  const hasLight = (o: THREE.Object3D): boolean => {
    let found = false;
    o.traverse((c) => {
      if ((c as THREE.Light).isLight) found = true;
    });
    return found;
  };
  reflector.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
    if (!hide) {
      hide = [];
      let worldRoot: THREE.Object3D | null = zone;
      while (worldRoot && worldRoot.parent && worldRoot.parent !== scene) worldRoot = worldRoot.parent;
      for (const c of scene.children) if (c !== worldRoot && !hasLight(c)) hide.push(c);
      if (worldRoot && worldRoot !== zone) for (const c of worldRoot.children) if (c !== zone && !c.getObjectById(zone.id) && !hasLight(c)) hide.push(c);
      // other interiors of the same zone (e.g. the hotel while in the lounge's restroom)
      worldRoot?.traverse((o) => {
        if (o !== zone && o.name.endsWith('Interior') && !o.getObjectById(zone.id) && !zone.getObjectById(o.id)) hide!.push(o);
      });
    }
    const prev = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false;
    render.call(reflector, renderer, scene, camera, geometry, material, group);
    hide.forEach((o, i) => (o.visible = prev[i]));
  };
}

/** Pill / oval outline (centre cx, cy; w × h) as a THREE.Path or Shape. */
export function pillPath<T extends THREE.Path>(p: T, cx: number, cy: number, w: number, h: number, oval = false): T {
  if (oval) {
    p.absellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 2, false, 0);
    return p;
  }
  const r = w / 2;
  p.moveTo(cx + r, cy - h / 2 + r);
  p.absarc(cx, cy + h / 2 - r, r, 0, Math.PI, false);
  p.absarc(cx, cy - h / 2 + r, r, Math.PI, Math.PI * 2, false);
  return p;
}
