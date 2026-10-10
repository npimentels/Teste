import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { teardropLamp } from './Furniture';
import { UseSpot } from '../systems/Interactables';
import { WaterStream } from '../environment/ParticleSystem';
import type { Collider } from '../physics/Collision';
import type { Updatable } from '../core/types';
import { damp } from '../core/math';

export interface RestroomRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  ceiling: number;
}

/**
 * Station restroom (reference: cobalt glossy walls, pill mirrors, glass vessel sinks on a lit
 * acrylic vanity, teardrop lamps, porthole window). The west and south walls belong to the
 * station shell; this builds the north wall (automatic frosted door), the east wall (porthole),
 * cladding, vanity, three stalls and every fixture, all interactive:
 *  faucets (water + sound), soap dispensers, hand dryer, stall doors, flush buttons.
 * Mirrors: one planar Reflector behind a cobalt panel with three pill cut-outs; it renders
 * only while the camera is inside the room on High quality, otherwise a polished-metal
 * fallback (environment reflections) is shown.
 */
export function buildRestroom(ctx: WorldContext, b: WorldBuilder, r: RestroomRect): void {
  const room = new Restroom(ctx, b, r);
  ctx.addUpdatable(room);
}

class Restroom implements Updatable {
  private readonly faucets: Array<{ stream: WaterStream; sound: ReturnType<WorldContext['audio']['addWaterSource']>; timer: number; pos: THREE.Vector3 }> = [];
  private readonly foam: Array<{ mesh: THREE.Mesh; timer: number }> = [];
  private readonly pumps: Array<{ mesh: THREE.Object3D; t: number }> = [];
  private readonly stalls: Array<{ leaf: THREE.Object3D; open: boolean; angle: number; collider: Collider; hinge: THREE.Vector3; dir: number }> = [];
  private readonly flushes: Array<{ water: THREE.Mesh; timer: number }> = [];
  private dryer = { timer: 0, led: null as THREE.MeshStandardMaterial | null, pos: new THREE.Vector3() };
  private readonly door: { leaves: THREE.Object3D[]; open: number; collider: Collider; x: number; z: number };
  private readonly mirror: { reflector: Reflector; fallback: THREE.Mesh };

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    private readonly r: RestroomRect,
  ) {
    const m = b.mats;
    const H = r.ceiling;
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    const doorX0 = r.x1 - 1.7;
    const doorX1 = r.x1 - 0.5;

    // ---- Floor, cladding, cove light -----------------------------------------------------
    b.box(m.floorTile, cx, -0.08, cz, r.x1 - r.x0, 0.1, r.z1 - r.z0, { cast: false });
    // north wall (station side white, cobalt mosaic inside) with the door opening
    const nz = r.z0 - 0.1;
    for (const [a, c] of [
      [r.x0 - 0.3, doorX0],
      [doorX1, r.x1 + 0.2],
    ]) {
      b.box(m.whiteCeramic, (a + c) / 2, 0, nz, c - a, H, 0.2, { collide: 'tile' });
      b.box(m.cobaltCeramic, (a + c) / 2, 0, r.z0 + 0.012, c - a - 0.02, H, 0.02, { cast: false });
      b.box(m.cobaltMosaic, (a + c) / 2, 0, r.z0 + 0.026, c - a - 0.02, 1.1, 0.01, { cast: false });
    }
    b.box(m.whiteCeramic, (doorX0 + doorX1) / 2, 2.3, nz, doorX1 - doorX0, H - 2.3, 0.2);
    b.box(m.cobaltCeramic, (doorX0 + doorX1) / 2, 2.3, nz - 0.12, doorX1 - doorX0 + 0.3, 0.12, 0.06, { radius: 0.02 });
    // east wall with a porthole (extruded so the hole is real)
    const east = new THREE.Shape([new THREE.Vector2(-r.z1, 0), new THREE.Vector2(-r.z0 + 0.2, 0), new THREE.Vector2(-r.z0 + 0.2, H), new THREE.Vector2(-r.z1, H)]);
    const portZ = cz + 0.6;
    const hole = new THREE.Path();
    hole.absarc(-portZ, 1.6, 0.42, 0, Math.PI * 2, true);
    east.holes.push(hole);
    for (const [mat, x, d] of [
      [m.whiteCeramic, r.x1, 0.2],
      [m.cobaltCeramic, r.x1 - 0.02, 0.02],
    ] as Array<[THREE.Material, number, number]>) {
      const g = new THREE.ExtrudeGeometry(east, { depth: d, bevelEnabled: false, curveSegments: 32 });
      g.rotateY(Math.PI / 2);
      b.place(g, mat, x, 0, 0, { cast: mat === m.whiteCeramic });
      g.dispose();
    }
    b.collision.addBox({ x: r.x1 + 0.1, z: cz - 0.1, sx: 0.2, sz: r.z1 - r.z0 + 0.2, minY: 0, maxY: H, surface: 'tile' });
    b.torus(m.chrome, r.x1 + 0.1, 1.6, portZ, 0.44, 0.05, { rotY: Math.PI / 2 });
    b.torus(m.cobaltCeramic, r.x1 - 0.03, 1.6, portZ, 0.47, 0.04, { rotY: Math.PI / 2, cast: false });
    b.cylinder(m.frostedGlass, r.x1 + 0.1, 1.6, portZ, 0.42, 0.42, 0.02, { rotZ: Math.PI / 2, cast: false, receive: false, segments: 40 });
    // west / south cladding over the station shell walls
    // deep cobalt glossy walls with a mosaic wainscot
    b.box(m.cobaltCeramic, r.x0 + 0.012, 0, cz, 0.02, H, r.z1 - r.z0, { cast: false });
    b.box(m.cobaltCeramic, cx, 0, r.z1 - 0.012, r.x1 - r.x0, H, 0.02, { cast: false });
    b.box(m.cobaltMosaic, r.x0 + 0.026, 0, cz, 0.01, 1.1, r.z1 - r.z0, { cast: false });
    b.box(m.cobaltMosaic, cx, 0, r.z1 - 0.026, r.x1 - r.x0, 1.1, 0.01, { cast: false });
    b.box(m.cobaltMosaic, r.x1 - 0.026, 0, cz, 0.01, 1.1, r.z1 - r.z0, { cast: false });
    // white skirting and the warm cove light under the ceiling
    for (const [x, z, sx, sz] of [
      [cx, r.z0 + 0.04, r.x1 - r.x0, 0.04],
      [cx, r.z1 - 0.04, r.x1 - r.x0, 0.04],
      [r.x0 + 0.04, cz, 0.04, r.z1 - r.z0],
      [r.x1 - 0.04, cz, 0.04, r.z1 - r.z0],
    ] as Array<[number, number, number, number]>) {
      b.box(m.whiteCeramic, x, 0, z, sx, 0.12, sz, { cast: false });
      b.box(m.emissiveWarm, x, H - 0.1, z, sx, 0.05, sz, { cast: false, receive: false });
    }
    b.box(m.whiteCeramic, cx, H - 0.06, cz, r.x1 - r.x0, 0.06, r.z1 - r.z0, { cast: false });

    // ---- Vanity: lit cyan acrylic counter, white/lime base, glass vessel sinks ------------
    const vz = r.z0 + 0.32;
    const v0 = r.x0 + 0.15;
    const v1 = doorX0 - 0.35;
    const vx = (v0 + v1) / 2;
    b.box(m.whiteCeramic, vx, 0, vz, v1 - v0, 0.72, 0.5, { radius: 0.06, collide: 'tile' });
    b.box(m.limeGlossy, vx, 0.08, vz + 0.252, v1 - v0 - 0.2, 0.06, 0.01, { cast: false });
    b.box(m.cyanAcrylic, vx, 0.72, vz + 0.02, v1 - v0 + 0.06, 0.08, 0.6, { radius: 0.03 });
    b.box(m.emissiveCyan, vx, 0.705, vz + 0.31, v1 - v0, 0.02, 0.01, { cast: false, receive: false });
    const sinkGeo = new THREE.LatheGeometry(
      [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.1, 0.005), new THREE.Vector2(0.18, 0.05), new THREE.Vector2(0.21, 0.13), new THREE.Vector2(0.22, 0.16), new THREE.Vector2(0.205, 0.16), new THREE.Vector2(0.19, 0.13), new THREE.Vector2(0.165, 0.06), new THREE.Vector2(0.09, 0.02), new THREE.Vector2(0.001, 0.018)],
      40,
    );
    const sinkGlass = new THREE.MeshPhysicalMaterial({ name: 'sinkGlass', color: 0x9fdcff, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 1.4 });
    const sinks = [0, 1, 2].map((i) => v0 + ((v1 - v0) * (i + 0.5)) / 3);
    for (const [i, sx] of sinks.entries()) {
      b.place(sinkGeo, sinkGlass, sx, 0.8, vz, { cast: false });
      b.cylinder(m.chrome, sx, 0.8, vz, 0.03, 0.03, 0.012, { cast: false, segments: 12 });
      // wall-mounted curved chrome spout
      const spoutEnd = new THREE.Vector3(sx, 1.12, vz - 0.02);
      b.pipe([new THREE.Vector3(sx, 1.2, r.z0 + 0.03), new THREE.Vector3(sx, 1.2, vz - 0.1), spoutEnd], 0.018, m.chrome, 0.08);
      b.cylinder(m.chrome, sx + 0.12, 1.16, r.z0 + 0.05, 0.03, 0.03, 0.06, { rotX: Math.PI / 2, cast: false });
      const stream = WaterStream.tube([spoutEnd.clone().setY(1.105), new THREE.Vector3(sx, 0.98, vz - 0.02), new THREE.Vector3(sx, 0.83, vz - 0.02)], 0.009, { speed: -2.5, opacity: 0.75, travelTime: 0.25 });
      stream.setActive(false, true);
      b.root.add(stream.mesh);
      ctx.addUpdatable(stream);
      const sound = ctx.audio.addWaterSource('stream', { x: sx, y: 0.95, z: vz }, 0.22, false);
      const faucet = { stream, sound, timer: 0, pos: new THREE.Vector3(sx, 1.0, vz) };
      this.faucets.push(faucet);
      ctx.addInteractable(
        new UseSpot(`restroom-faucet-${i}`, new THREE.Vector3(sx, 1.0, vz - 0.02), new THREE.Vector3(0.2, 0.22, 0.2), 0, () => (faucet.timer > 0 ? 'Fechar torneira' : 'Abrir torneira'), () => this.toggleFaucet(faucet)),
      );
      const foam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.9 }));
      foam.scale.set(1.2, 0.4, 1);
      foam.position.set(sx, 0.83, vz);
      foam.visible = false;
      b.root.add(foam);
      this.foam.push({ mesh: foam, timer: 0 });
    }
    // soap dispensers between the sinks (chrome pump bottles)
    for (const [i, sx] of [(sinks[0] + sinks[1]) / 2, (sinks[1] + sinks[2]) / 2].entries()) {
      b.cylinder(m.frostedGlass, sx, 0.8, vz - 0.05, 0.04, 0.045, 0.15, { segments: 16, cast: false });
      const pump = new THREE.Group();
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), m.chrome);
      head.position.y = 0.025;
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.06), m.chrome);
      nozzle.position.set(0, 0.045, 0.03);
      pump.add(head, nozzle);
      pump.position.set(sx, 0.95, vz - 0.05);
      b.root.add(pump);
      const entry = { mesh: pump, t: 0 };
      this.pumps.push(entry);
      ctx.addInteractable(
        new UseSpot(`restroom-soap-${i}`, new THREE.Vector3(sx, 0.9, vz - 0.05), new THREE.Vector3(0.07, 0.12, 0.07), 0, () => 'Usar sabonete', () => this.useSoap(entry, i)),
      );
    }
    // towels rolled on a little shelf, and a niche with bottles on the west wall
    b.box(m.whiteCeramic, v1 + 0.15, 0.95, r.z0 + 0.15, 0.3, 0.04, 0.28, { cast: false });
    for (let k = 0; k < 3; k++) b.cylinder(m.whiteMatte, v1 + 0.15, 0.99 + k * 0.075, r.z0 + 0.15, 0.035, 0.035, 0.24, { rotX: Math.PI / 2, rotY: Math.PI / 2, segments: 12, cast: false });
    const nicheZ = cz - 0.4;
    b.box(m.whiteCeramic, r.x0 + 0.08, 1.15, nicheZ, 0.12, 0.05, 1.0, { cast: false });
    b.box(m.whiteCeramic, r.x0 + 0.08, 1.65, nicheZ, 0.12, 0.05, 1.0, { cast: false });
    for (const [k, mat] of [m.glossyCyan, m.limeGlossy, m.cobaltCeramic, m.glossyCyan].entries()) {
      b.cylinder(mat, r.x0 + 0.08, 1.2, nicheZ - 0.36 + k * 0.24, 0.035, 0.04, 0.18 + (k % 2) * 0.06, { segments: 14, cast: false });
    }
    ctx.veg.fern(r.x0 + 0.35, 0, nicheZ + 1.0, 0.55);
    b.cylinder(m.whiteCeramic, r.x0 + 0.35, 0, nicheZ + 1.0, 0.22, 0.18, 0.4, { collide: 'stone', segments: 24 });

    // ---- Mirrors: cobalt panel with pill cut-outs over one reflector ------------------------
    const mirrorY = 1.72;
    const pillH = 0.86;
    const pillW = 0.5;
    const panel = new THREE.Shape([new THREE.Vector2(v0 - 0.05, 1.12), new THREE.Vector2(v1 + 0.05, 1.12), new THREE.Vector2(v1 + 0.05, 2.36), new THREE.Vector2(v0 - 0.05, 2.36)]);
    for (const sx of sinks) {
      const p = new THREE.Path();
      const rr = pillW / 2;
      p.absarc(sx, mirrorY + pillH / 2 - rr, rr, 0, Math.PI, false);
      p.absarc(sx, mirrorY - pillH / 2 + rr, rr, Math.PI, Math.PI * 2, false);
      p.closePath();
      panel.holes.push(p);
    }
    const panelGeo = new THREE.ExtrudeGeometry(panel, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 24 });
    b.place(panelGeo, m.cobaltCeramic, 0, 0, r.z0 + 0.03, { cast: false });
    panelGeo.dispose();
    for (const sx of sinks) {
      b.torus(m.chrome, sx, mirrorY + pillH / 2 - pillW / 2, r.z0 + 0.075, pillW / 2 + 0.005, 0.012, { arc: Math.PI, cast: false });
      b.torus(m.chrome, sx, mirrorY - pillH / 2 + pillW / 2, r.z0 + 0.075, pillW / 2 + 0.005, 0.012, { arc: Math.PI, rotZ: Math.PI, cast: false });
      for (const e of [-1, 1]) b.box(m.chrome, sx + e * (pillW / 2 + 0.005), mirrorY - pillH / 2 + pillW / 2, r.z0 + 0.075, 0.024, pillH - pillW, 0.024, { cast: false });
    }
    const mirrorGeo = new THREE.PlaneGeometry(v1 - v0 - 0.1, 1.1);
    const reflector = new Reflector(mirrorGeo, { textureWidth: 768, textureHeight: 384, color: 0xc8d8e8, clipBias: 0.003, multisample: 0 });
    reflector.position.set(vx, mirrorY, r.z0 + 0.025);
    b.root.add(reflector);
    this.limitReflection(reflector, b.root);
    const fallback = new THREE.Mesh(mirrorGeo, new THREE.MeshStandardMaterial({ name: 'mirrorFallback', color: 0xdfeaf4, metalness: 1, roughness: 0.04, envMapIntensity: 1.2 }));
    fallback.position.copy(reflector.position);
    b.root.add(fallback);
    this.mirror = { reflector, fallback };

    // ---- Lights: teardrop lamps between the mirrors --------------------------------------------
    const glow = m.frostedGlass.clone();
    glow.name = 'restroomLamps';
    glow.emissive = new THREE.Color(0xfff1d6);
    glow.emissiveIntensity = 1.4;
    for (const sx of [v0 + 0.05, (sinks[0] + sinks[1]) / 2, (sinks[1] + sinks[2]) / 2, v1 - 0.05]) teardropLamp(b, sx, 2.25, r.z0 + 0.35, H - 0.06, glow, 0.1);
    for (const [x, z] of [
      [cx - 1.4, cz + 0.5],
      [cx + 1.6, cz + 0.5],
    ] as Array<[number, number]>) teardropLamp(b, x, 2.5, z, H - 0.06, glow, 0.16);

    // ---- Stalls along the south wall ------------------------------------------------------------
    const depth = 1.75;
    const front = r.z1 - depth;
    const stallW = 1.45;
    const n = 3;
    const sx0 = r.x0;
    for (let i = 0; i <= n; i++) {
      const px = sx0 + i * stallW;
      if (i > 0) {
        // partition: cobalt panel lifted off the floor (2000s style)
        b.box(m.cobaltCeramic, px, 0.15, r.z1 - depth / 2, 0.05, 1.95, depth, { radius: 0.02 });
        b.collision.addBox({ x: px, z: r.z1 - depth / 2, sx: 0.08, sz: depth, minY: 0, maxY: 2.1, surface: 'tile' });
        b.cylinder(m.chrome, px, 0, front + 0.06, 0.025, 0.025, 2.1, { segments: 10, cast: false });
      }
    }
    // headrail over the stall fronts
    b.box(m.chrome, sx0 + (n * stallW) / 2, 2.08, front, n * stallW, 0.04, 0.05, { cast: false });
    for (let i = 0; i < n; i++) {
      const a = sx0 + i * stallW;
      const c = a + stallW;
      const mid = (a + c) / 2;
      const dw = 0.78;
      const hingeX = c - 0.04;
      // fixed frosted panel left of the door
      const fixedW = c - a - dw - 0.06;
      b.box(m.frostedGlass, a + 0.03 + fixedW / 2, 0.15, front, fixedW, 1.95, 0.03, { cast: false, receive: false });
      b.box(m.cobaltCeramic, a + 0.03 + fixedW / 2, 0.12, front, fixedW, 0.06, 0.05, { cast: false });
      b.collision.addBox({ x: a + 0.03 + fixedW / 2, z: front, sx: fixedW, sz: 0.08, minY: 0, maxY: 2.1, surface: 'glass' });
      // door leaf: frosted glass in a cobalt frame, hinged on its east edge
      const leaf = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.04, 1.85, 0.025), m.frostedGlass);
      glass.position.set(-dw / 2, 1.1, 0);
      const frameT = new THREE.Mesh(new THREE.BoxGeometry(dw, 0.05, 0.04), m.cobaltCeramic);
      frameT.position.set(-dw / 2, 2.04, 0);
      const frameB = frameT.clone();
      frameB.position.y = 0.17;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.05), m.chrome);
      handle.position.set(-dw + 0.08, 1.05, 0.03);
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 12), m.limeGlossy);
      lock.rotation.x = Math.PI / 2;
      lock.position.set(-dw + 0.08, 1.2, 0.03);
      leaf.add(glass, frameT, frameB, handle, lock);
      leaf.position.set(hingeX, 0, front);
      b.root.add(leaf);
      const collider = b.collision.addBox({ x: hingeX - dw / 2, z: front, sx: dw, sz: 0.08, minY: 0, maxY: 2.1, surface: 'glass' });
      const stall = { leaf, open: false, angle: 0, collider, hinge: new THREE.Vector3(hingeX, 0, front), dir: 1 };
      this.stalls.push(stall);
      ctx.addInteractable(
        new UseSpot(`restroom-stall-${i}`, new THREE.Vector3(hingeX - dw / 2, 1.1, front), new THREE.Vector3(dw / 2, 0.9, 0.12), 0, () => (stall.open ? 'Fechar porta' : 'Abrir porta'), () => this.toggleStall(stall), 2.4),
      );
      // wall-hung toilet facing the door + flush plate
      this.toilet(b, mid, r.z1, i);
    }

    // ---- Hand dryer, bins ---------------------------------------------------------------------
    const dz = cz - 1.2;
    const dx = r.x1 - 0.13;
    b.box(m.whiteCeramic, dx, 1.0, dz, 0.2, 0.32, 0.36, { radius: 0.09, cast: false });
    b.box(m.chrome, dx - 0.1, 1.0, dz, 0.02, 0.05, 0.22, { cast: false });
    const led = new THREE.MeshStandardMaterial({ name: 'dryerLed', color: 0x16314f, emissive: 0x28c5df, emissiveIntensity: 0 });
    const ledMesh = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), led);
    ledMesh.rotation.y = -Math.PI / 2;
    ledMesh.position.set(dx - 0.101, 1.22, dz);
    b.root.add(ledMesh);
    this.dryer.led = led;
    this.dryer.pos.set(dx, 1.1, dz);
    ctx.addInteractable(
      new UseSpot('restroom-dryer', new THREE.Vector3(dx, 1.12, dz), new THREE.Vector3(0.12, 0.2, 0.2), 0, () => (this.dryer.timer > 0 ? 'Secador ligado' : 'Ligar secador de mãos'), () => this.useDryer()),
    );
    for (const z of [dz + 0.6, dz + 1.05]) {
      b.cylinder(m.chrome, r.x1 - 0.28, 0, z, 0.17, 0.15, 0.62, { collide: 'metal', segments: 24 });
      b.cylinder(z === dz + 0.6 ? m.limeGlossy : m.glossyCyan, r.x1 - 0.28, 0.62, z, 0.175, 0.175, 0.05, { segments: 24, cast: false });
    }

    // ---- Automatic sliding frosted door at the entrance ---------------------------------------
    const leaves: THREE.Object3D[] = [];
    const leafW = (doorX1 - doorX0) / 2;
    for (const e of [-1, 1]) {
      const leaf = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.BoxGeometry(leafW, 2.25, 0.03), m.frostedGlass);
      glass.position.y = 1.15;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.12, 0.035), m.cobaltCeramic);
      stripe.position.y = 1.1;
      leaf.add(glass, stripe);
      leaf.userData.closedX = (doorX0 + doorX1) / 2 + (e * leafW) / 2;
      leaf.userData.dir = e;
      leaf.position.set(leaf.userData.closedX as number, 0, nz);
      b.root.add(leaf);
      leaves.push(leaf);
    }
    const doorCollider = b.collision.addBox({ x: (doorX0 + doorX1) / 2, z: nz, sx: doorX1 - doorX0, sz: 0.1, minY: 0, maxY: 2.3, surface: 'glass' });
    this.door = { leaves, open: 0, collider: doorCollider, x: (doorX0 + doorX1) / 2, z: nz };
  }

  /**
   * The mirror only needs the station around it: while its virtual camera renders, everything
   * outside the zone group (gardens, sea, vegetation, other zones) is hidden. Lights stay.
   */
  private limitReflection(reflector: Reflector, zone: THREE.Object3D): void {
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
        const worldRoot = zone.parent;
        for (const c of scene.children) if (c !== worldRoot && !hasLight(c)) hide.push(c);
        if (worldRoot) for (const c of worldRoot.children) if (c !== zone && !hasLight(c)) hide.push(c);
      }
      const prev = hide.map((o) => o.visible);
      for (const o of hide) o.visible = false;
      render.call(reflector, renderer, scene, camera, geometry, material, group);
      hide.forEach((o, i) => (o.visible = prev[i]));
    };
  }

  private toilet(b: WorldBuilder, x: number, wallZ: number, i: number): void {
    const m = b.mats;
    const bowl = new THREE.LatheGeometry(
      [new THREE.Vector2(0.001, 0), new THREE.Vector2(0.12, 0.0), new THREE.Vector2(0.19, 0.12), new THREE.Vector2(0.2, 0.22), new THREE.Vector2(0.17, 0.22), new THREE.Vector2(0.15, 0.14), new THREE.Vector2(0.001, 0.12)],
      28,
    );
    bowl.scale(1, 1, 1.35);
    const z = wallZ - 0.36;
    b.place(bowl, m.whiteCeramic, x, 0.2, z);
    bowl.dispose();
    b.box(m.whiteCeramic, x, 0.12, wallZ - 0.11, 0.38, 0.5, 0.22, { radius: 0.08 });
    b.torus(m.whiteCeramic, x, 0.43, z, 0.18, 0.025, { rotX: Math.PI / 2, cast: false });
    b.collision.addBox({ x, z: wallZ - 0.3, sx: 0.42, sz: 0.6, minY: 0, maxY: 0.45, surface: 'tile' });
    // flush plate on the wall
    b.box(m.whiteCeramic, x, 0.95, wallZ - 0.025, 0.26, 0.18, 0.02, { radius: 0.01, cast: false });
    b.box(m.chrome, x - 0.055, 0.98, wallZ - 0.04, 0.09, 0.12, 0.012, { cast: false });
    b.box(m.chrome, x + 0.055, 0.98, wallZ - 0.04, 0.09, 0.12, 0.012, { cast: false });
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshPhysicalMaterial({ color: 0x7fd8ff, roughness: 0.05, transparent: true, opacity: 0.7, clearcoat: 1 }));
    water.rotation.x = -Math.PI / 2;
    water.scale.set(1, 1.3, 1);
    water.position.set(x, 0.36, z);
    b.root.add(water);
    const entry = { water, timer: 0 };
    this.flushes.push(entry);
    this.ctx.addInteractable(
      new UseSpot(`restroom-flush-${i}`, new THREE.Vector3(x, 1.04, wallZ - 0.04), new THREE.Vector3(0.14, 0.1, 0.05), 0, () => 'Dar descarga', () => this.flush(entry), 2.0, () => entry.timer <= 0),
    );
  }

  // ---- Actions ------------------------------------------------------------------------------
  private toggleFaucet(f: Restroom['faucets'][number]): void {
    const on = f.timer <= 0;
    f.timer = on ? 7 : 0;
    f.stream.setActive(on);
    f.sound.setActive(on);
    if (on) this.ctx.audio.play('faucet', { position: f.pos, volume: 0.6 });
  }

  private useSoap(p: Restroom['pumps'][number], i: number): void {
    p.t = 0.35;
    this.ctx.audio.play('soap', { position: p.mesh.position });
    const foam = this.foam[i + 1] ?? this.foam[i];
    foam.timer = 4;
    foam.mesh.visible = true;
  }

  private useDryer(): void {
    if (this.dryer.timer > 0) return;
    this.dryer.timer = 3.2;
    this.ctx.audio.play('dryer', { position: this.dryer.pos });
  }

  private toggleStall(s: Restroom['stalls'][number]): void {
    if (s.open) {
      // never close the door onto someone standing in the doorway
      const v = this.ctx.viewer;
      if (Math.abs(v.z - s.hinge.z) < 0.55 && v.x < s.hinge.x + 0.1 && v.x > s.hinge.x - 0.9) {
        this.ctx.audio.play('error', { position: s.hinge });
        return;
      }
    }
    s.open = !s.open;
    this.ctx.audio.play('stallDoor', { position: s.hinge });
  }

  private flush(f: Restroom['flushes'][number]): void {
    if (f.timer > 0) return;
    f.timer = 3;
    this.ctx.audio.play('flush', { position: f.water.position });
  }

  update(dt: number, time: number): void {
    const v = this.ctx.viewer;
    const r = this.r;
    const inside = v.x > r.x0 && v.x < r.x1 && v.z > r.z0 - 0.3 && v.z < r.z1;
    const nearby = inside || (Math.abs(v.x - this.door.x) < 5 && Math.abs(v.z - this.door.z) < 8);
    // the reflector costs a scene render: only inside, on High quality
    const live = inside && this.ctx.quality().level === 'high';
    this.mirror.reflector.visible = live;
    this.mirror.fallback.visible = !live;
    if (!nearby && this.door.open === 0) return;
    for (const f of this.faucets) {
      if (f.timer <= 0) continue;
      f.timer -= dt;
      if (f.timer <= 0) {
        f.stream.setActive(false);
        f.sound.setActive(false);
      }
    }
    for (const fm of this.foam) {
      if (fm.timer <= 0) continue;
      fm.timer -= dt;
      (fm.mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(0.9, fm.timer);
      if (fm.timer <= 0) fm.mesh.visible = false;
    }
    for (const p of this.pumps) {
      if (p.t <= 0) continue;
      p.t -= dt;
      p.mesh.position.y = 0.95 - Math.sin(Math.max(0, p.t / 0.35) * Math.PI) * 0.02;
    }
    for (const s of this.stalls) {
      const target = s.open ? -1.45 : 0;
      s.angle = damp(s.angle, target, 7, dt);
      s.leaf.rotation.y = s.angle;
      s.collider.enabled = Math.abs(s.angle) < 0.25;
    }
    for (const f of this.flushes) {
      if (f.timer <= 0) continue;
      f.timer -= dt;
      f.water.rotation.z += dt * 9 * Math.min(1, f.timer);
      f.water.position.y = 0.36 - Math.sin(Math.min(1, (3 - f.timer) / 1.5) * Math.PI) * 0.04;
    }
    if (this.dryer.timer > 0) {
      this.dryer.timer -= dt;
      if (this.dryer.led) this.dryer.led.emissiveIntensity = this.dryer.timer > 0 ? 2 + Math.sin(time * 20) * 0.4 : 0;
    }
    // automatic entrance door
    const dx = v.x - this.door.x;
    const dz = v.z - this.door.z;
    const want = Math.hypot(dx, dz) < 2.4 ? 1 : 0;
    this.door.open = damp(this.door.open, want, want ? 6 : 3, dt);
    if (Math.abs(this.door.open - want) < 0.002) this.door.open = want;
    for (const leaf of this.door.leaves) {
      const e = leaf.userData.dir as number;
      leaf.position.x = (leaf.userData.closedX as number) + e * 0.58 * this.door.open;
    }
    this.door.collider.enabled = this.door.open < 0.7;
  }
}
