import * as THREE from 'three';
import type { WorldContext } from './WorldContext';
import type { WorldBuilder } from './Builders';
import { LAYOUT } from './WorldLayout';
import { straightStair } from './ArchKit';
import { bench, bubbleLamp, planterBowl, receptionDesk } from './Furniture';
import { artPanel, bed, bookshelf, desk, fabric, nightstand, pouf, roundBed, roundTable, rugRect, sofa, tableDecor, tubChair, wardrobe } from './Interiors';
import { LampGroup, downlight, floorLamp, lightLine, ringPendant, tableLamp, wallSconce } from './Lamps';
import { Aquarium } from './Aquarium';
import { Curtains, HingedDoor, SlidingDoor, examine } from './Doors';
import { BathroomFixtures } from './BathroomKit';
import { Elevator } from '../systems/Elevator';
import { Telescope, type Landmark } from '../systems/Telescope';
import { UseSpot } from '../systems/Interactables';
import { yawFacing } from '../systems/Seats';
import { roundRect } from '../core/AssetManager';
import { hangingSign } from './Lounge';

const HT = LAYOUT.horizonte.hotel;
const SKY = LAYOUT.horizonte.skywalk;
const F1 = HT.floor1; // 4.6
const C0 = HT.ceil0; // 4.3
const ROOF = HT.roof; // 8.4
const R_BOTTOM = ROOF - 0.4; // 8.0, ceiling of the 1st floor
const FONT = '"Segoe UI", "Frutiger", "Myriad Pro", "Helvetica Neue", Arial, sans-serif';

/** Elevator shaft (round glass, in the double-height atrium) and the room line. */
const SHAFT = { x: -11, z: 92.4, r: 1.0 };
const ATRIUM = { x0: HT.x0, x1: -8, z0: 91, z1: HT.z1 };
const CORRIDOR = { z0: 84.25, z1: 87.2 };
const ROOMS = [
  { n: 101, x0: -8, x1: -1.5, name: 'Suíte Lagoa', door: [-3.6, -2.6] as [number, number], open: true },
  { n: 102, x0: -1.5, x1: 5, name: 'Suíte Coral', door: [-1.1, -0.1] as [number, number], open: true },
  { n: 103, x0: 5, x1: 11.5, name: 'Suíte Brisa', door: [7.0, 8.0] as [number, number], open: false },
  { n: 104, x0: 11.5, x1: 18, name: 'Suíte Aurora', door: [13.5, 14.5] as [number, number], open: false },
];

/**
 * Hotel AQUA: lobby with a curved reception desk and check-in terminal, column aquariums,
 * lounge seating and a double-height atrium with a glass capsule elevator and a stair; on the
 * 1st floor a corridor with wall aquariums, art and room numbers, suites 101 and 102 to explore
 * (103 and 104 are occupied — clearly signed and locked); a rooftop deck with loungers and a
 * telescope. Room doors open after the (free) check-in at the terminal.
 */
export class Hotel {
  checkedIn = false;
  private checkinScreen!: { ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture };
  readonly lampGroups: LampGroup[] = [];

  constructor(
    private readonly ctx: WorldContext,
    private readonly landmarks: Landmark[],
  ) {}

  // ---------------------------------------------------------------------------------------
  // Exterior shell, slabs, stair, elevator, rooftop (visible from afar)
  // ---------------------------------------------------------------------------------------
  shell(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const cx = (HT.x0 + HT.x1) / 2;
    const cz = (HT.z0 + HT.z1) / 2;
    const floor = new THREE.MeshPhysicalMaterial({ name: 'hotelFloor', color: 0xf4f8fb, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08 });
    b.box(floor, cx, -0.07, cz, HT.x1 - HT.x0, 0.1, HT.z1 - HT.z0, { cast: false });
    b.box(m.terrazzo, cx, 0.035, cz, HT.x1 - HT.x0 - 2, 0.006, HT.z1 - HT.z0 - 2, { cast: false });

    // ---- North wall (0.5 thick: holds the corridor aquariums) ---------------------------------------
    const nz = HT.z0;
    const wall = (x0: number, x1: number, y0: number, y1: number, z: number, t: number, mat: THREE.Material = m.whiteCeramic, collide = true) =>
      b.box(mat, (x0 + x1) / 2, y0, z, x1 - x0, y1 - y0, t, { collide: collide ? 'tile' : false });
    wall(HT.x0, SKY.x0, 0, C0, nz, 0.5);
    wall(SKY.x1, HT.x1, 0, C0, nz, 0.5);
    wall(SKY.x0, SKY.x1, 2.8, C0, nz, 0.5);
    wall(HT.x0, HT.x1, C0, F1, nz, 0.5, m.cobaltCeramic);
    for (const [x0, x1] of [
      [HT.x0, 1.7],
      [3.3, 8.7],
      [10.3, HT.x1],
    ]) wall(x0, x1, F1, ROOF - 0.4, nz, 0.5);
    for (const [x0, x1] of [
      [1.7, 3.3],
      [8.7, 10.3],
    ]) {
      wall(x0, x1, F1, F1 + 0.8, nz, 0.5);
      wall(x0, x1, F1 + 1.75, ROOF - 0.4, nz, 0.5);
      b.box(m.whiteCeramic, (x0 + x1) / 2, F1 + 0.8, nz - 0.22, x1 - x0, 0.95, 0.06, { cast: false });
    }
    new SlidingDoor(ctx, b, { id: 'hotel-door-n', x: (SKY.x0 + SKY.x1) / 2, z: nz, width: SKY.x1 - SKY.x0 - 0.2, height: 2.8, axis: 'x', style: 'glass', sensor: 2.6 });
    // ---- West wall (solid), east wall (corridor window up) ----------------------------------------------
    wall(HT.x0 - 0.15, HT.x0 + 0.15, 0, R_BOTTOM, cz, HT.z1 - HT.z0);
    b.box(m.whiteCeramic, HT.x1, 0, cz, 0.3, F1, HT.z1 - HT.z0, { collide: 'tile' });
    b.box(m.whiteCeramic, HT.x1, F1, (CORRIDOR.z1 + 0.2 + HT.z1) / 2, 0.3, R_BOTTOM - F1, HT.z1 - CORRIDOR.z1 - 0.2, { collide: 'tile' });
    b.box(m.glass, HT.x1, F1 + 0.4, (CORRIDOR.z0 + CORRIDOR.z1) / 2, 0.04, R_BOTTOM - F1 - 0.4, CORRIDOR.z1 - CORRIDOR.z0, { cast: false, receive: false });
    b.box(m.cobaltCeramic, HT.x1, F1, (CORRIDOR.z0 + CORRIDOR.z1) / 2, 0.34, 0.4, CORRIDOR.z1 - CORRIDOR.z0, { radius: 0.06 });
    b.collision.addBox({ x: HT.x1, z: (CORRIDOR.z0 + CORRIDOR.z1) / 2, sx: 0.3, sz: CORRIDOR.z1 - CORRIDOR.z0, minY: F1, maxY: R_BOTTOM, surface: 'glass' });
    // ---- South facade: glass (lobby with a garden door, double-height atrium, rooms) ------------------
    const sz = HT.z1;
    this.glass(b, ATRIUM.x0, ATRIUM.x1, sz, 0, R_BOTTOM);
    this.glass(b, ATRIUM.x1, 2, sz, 0, C0);
    this.glass(b, 5, HT.x1, sz, 0, C0);
    b.box(m.glass, 3.5, 2.7, sz, 3, C0 - 2.7, 0.04, { cast: false, receive: false });
    new SlidingDoor(ctx, b, { id: 'hotel-door-s', x: 3.5, z: sz, width: 2.9, height: 2.7, axis: 'x', style: 'glass', sensor: 2.6 });
    b.box(m.cobaltCeramic, (ATRIUM.x1 + HT.x1) / 2, C0, sz, HT.x1 - ATRIUM.x1, F1 - C0, 0.4, { radius: 0.05 });
    b.box(m.emissiveCyan, (ATRIUM.x1 + HT.x1) / 2, C0 + 0.13, sz + 0.205, HT.x1 - ATRIUM.x1, 0.04, 0.01, { cast: false, receive: false });
    this.glass(b, ATRIUM.x1, HT.x1, sz, F1, R_BOTTOM, [ROOMS[1].x0, ROOMS[2].x0, ROOMS[3].x0]);
    // ---- Slabs: lobby ceiling = 1st floor (+ landing over the atrium's north part) --------------------
    b.box(m.whiteCeramic, (ATRIUM.x1 + HT.x1) / 2, C0, cz, HT.x1 - ATRIUM.x1, F1 - C0, HT.z1 - HT.z0, { collide: 'tile' });
    b.box(m.whiteCeramic, (HT.x0 + ATRIUM.x1) / 2, C0, (HT.z0 + ATRIUM.z0) / 2, ATRIUM.x1 - HT.x0, F1 - C0, ATRIUM.z0 - HT.z0, { collide: 'tile' });
    b.box(m.cobaltCeramic, (HT.x0 + ATRIUM.x1) / 2, C0 - 0.02, ATRIUM.z0 + 0.03, ATRIUM.x1 - HT.x0, F1 - C0 + 0.04, 0.08, { cast: false });
    // threshold between the landing and the elevator cabin door (1st floor) and on the roof
    for (const y of [F1, ROOF]) b.collision.addBox({ x: SHAFT.x, z: ATRIUM.z0 + 0.17, sx: 1.2, sz: 0.44, minY: y - 0.3, maxY: y, surface: 'metal' });
    b.box(m.chrome, SHAFT.x, F1 - 0.02, ATRIUM.z0 + 0.17, 1.2, 0.04, 0.44, { cast: false });
    // ---- Roof slab with the shaft opening; colliders around the hole -----------------------------------
    const hole = Array.from({ length: 36 }, (_, i) => [SHAFT.x + Math.cos((i / 36) * Math.PI * 2) * (SHAFT.r + 0.32), SHAFT.z + Math.sin((i / 36) * Math.PI * 2) * (SHAFT.r + 0.32)] as [number, number]);
    const rr: Array<[number, number]> = [
      [HT.x0 - 0.3, HT.z0 - 0.3],
      [HT.x1 + 0.3, HT.z0 - 0.3],
      [HT.x1 + 0.3, HT.z1 + 0.3],
      [HT.x0 - 0.3, HT.z1 + 0.3],
    ];
    b.slab(m.whiteCeramic, rr, [hole], ROOF, 0.4);
    const hx0 = SHAFT.x - SHAFT.r - 0.35;
    const hx1 = SHAFT.x + SHAFT.r + 0.35;
    const hz0 = SHAFT.z - SHAFT.r - 0.35;
    const hz1 = SHAFT.z + SHAFT.r + 0.35;
    const roofBox = (x0: number, x1: number, z0: number, z1: number) => b.collision.addBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, sx: x1 - x0, sz: z1 - z0, minY: R_BOTTOM, maxY: ROOF, surface: 'tile' });
    roofBox(HT.x0 - 0.3, HT.x1 + 0.3, HT.z0 - 0.3, hz0);
    roofBox(HT.x0 - 0.3, HT.x1 + 0.3, hz1, HT.z1 + 0.3);
    roofBox(HT.x0 - 0.3, hx0, hz0, hz1);
    roofBox(hx1, HT.x1 + 0.3, hz0, hz1);
    const deck = new THREE.MeshStandardMaterial({ name: 'roofDeck', color: 0xe9f1f6, roughness: 0.35 });
    b.box(deck, cx, ROOF, cz, HT.x1 - HT.x0 - 0.6, 0.02, HT.z1 - HT.z0 - 0.6, { cast: false });
    b.box(m.cobaltCeramic, cx, ROOF - 0.4, HT.z0 - 0.32, HT.x1 - HT.x0 + 0.7, 0.4, 0.06, { cast: false });
    b.box(m.glossyCyan, cx, ROOF - 0.12, HT.z1 + 0.32, HT.x1 - HT.x0 + 0.7, 0.06, 0.04, { cast: false });
    // rounded corner pods (white cylinders with cyan rings) soften the volume
    for (const [x, z] of [
      [HT.x0 - 0.2, HT.z0 - 0.2],
      [HT.x1 + 0.2, HT.z0 - 0.2],
      [HT.x0 - 0.2, HT.z1 + 0.2],
      [HT.x1 + 0.2, HT.z1 + 0.2],
    ] as Array<[number, number]>) {
      b.cylinder(m.whiteCeramic, x, 0, z, 0.75, 0.8, ROOF + 0.6, { segments: 32, collide: 'tile' });
      for (const y of [C0 + 0.15, ROOF + 0.3]) b.torus(m.glossyCyan, x, y, z, 0.78, 0.04, { rotX: Math.PI / 2, cast: false });
    }
    // name on the north and south facades
    const sign = hotelSign(ctx);
    for (const [z, rot] of [
      [HT.z0 - 0.3, Math.PI],
      [HT.z1 + 0.25, 0],
    ] as Array<[number, number]>) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: sign, transparent: true, toneMapped: false }));
      p.position.set(z < cz ? 4 : -2, ROOF - 1.1, z);
      p.rotation.y = rot;
      b.root.add(p);
    }

    // ---- Stair (atrium, along the west wall) and the glass capsule elevator ----------------------------
    straightStair(b, { x0: HT.x0 + 1.4, z0: ATRIUM.z1 - 0.8, dirX: 0, dirZ: -1, width: 2.2, rise: F1, run: 8.0, rails: [1] });
    // glowing step edges (every few steps), following the 4.6 m over 8 m slope
    for (let i = 0; i < 10; i++) {
      const d = 0.4 + i * 0.8;
      lightLine(b, HT.x0 + 1.4, (d * F1) / 8 + 0.02, ATRIUM.z1 - 0.8 - d, 2.1, 0, m.emissiveCyan, 0.02);
    }
    const elevator = new Elevator(ctx, b, {
      id: 'hotel-elevator',
      x: SHAFT.x,
      z: SHAFT.z,
      r: SHAFT.r,
      face: -Math.PI / 2,
      top: ROOF + 2.75,
      stops: [
        { y: 0, name: 'Térreo · Recepção' },
        { y: F1, name: '1º andar · Suítes' },
        { y: ROOF, name: 'Cobertura · Mirante' },
      ],
    });
    ctx.addMover(elevator);
    // landing railing (gap for the elevator door) and the roof railing (gap at the kiosk)
    b.glassRailing([[HT.x0 + 2.6, ATRIUM.z0], [SHAFT.x - 0.7, ATRIUM.z0]], F1, 1.05);
    b.glassRailing([[SHAFT.x + 0.7, ATRIUM.z0], [ATRIUM.x1, ATRIUM.z0]], F1, 1.05);
    const inset = 0.35;
    b.glassRailing(
      [
        [HT.x0 + inset, HT.z0 + inset],
        [HT.x1 - inset, HT.z0 + inset],
        [HT.x1 - inset, HT.z1 - inset],
        [HT.x0 + inset, HT.z1 - inset],
      ],
      ROOF,
      1.1,
      { closed: true },
    );
    // kiosk canopy on the roof around the shaft top
    b.cylinder(m.whiteCeramic, SHAFT.x, ROOF + 2.9, SHAFT.z, SHAFT.r + 0.9, SHAFT.r + 0.7, 0.18, { segments: 40 });
    b.torus(m.emissiveCyan, SHAFT.x, ROOF + 2.88, SHAFT.z, SHAFT.r + 0.82, 0.03, { rotX: Math.PI / 2, cast: false });

    this.rooftop(b);
  }

  private glass(b: WorldBuilder, x0: number, x1: number, z: number, y0: number, y1: number, extraPosts: number[] = []): void {
    const m = b.mats;
    b.box(m.glass, (x0 + x1) / 2, y0 + 0.3, z, x1 - x0, y1 - y0 - 0.3, 0.04, { cast: false, receive: false });
    b.box(m.cobaltCeramic, (x0 + x1) / 2, y0, z, x1 - x0, 0.3, 0.3, { radius: 0.06 });
    b.collision.addBox({ x: (x0 + x1) / 2, z, sx: x1 - x0, sz: 0.3, minY: y0, maxY: y1, surface: 'glass' });
    const n = Math.max(1, Math.round((x1 - x0) / 2.2));
    const posts = new Set<number>([...Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n), ...extraPosts]);
    for (const x of posts) b.box(m.whiteCeramic, x, y0 + 0.3, z, 0.12, y1 - y0 - 0.3, 0.18, { radius: 0.04, cast: false });
  }

  private rooftop(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const y = ROOF;
    // loungers facing south (the sea and the southern district)
    for (const [i, x] of [-4, -1.4, 1.2, 3.8].entries()) {
      const z = 96.6;
      b.box(m.whiteCeramic, x, y, z, 0.75, 0.3, 2.0, { collide: 'tile', radius: 0.12 });
      b.box(i % 2 ? m.fabricLime : m.fabricCyan, x, y + 0.3, z + 0.2, 0.68, 0.08, 1.4, { radius: 0.04, cast: false });
      b.box(m.whiteCeramic, x, y + 0.25, z - 0.95, 0.75, 0.75, 0.12, { rotX: 0.55, radius: 0.05 });
      ctx.addSeat({ id: `roof-lounger-${i}`, x, y: y + 0.38, z: z - 0.55, yaw: yawFacing(0, 1), label: 'Deitar na espreguiçadeira', eyeHeight: 0.42, back: -0.1, pose: { pitch: 0.12, pitchMin: -0.35, pitchMax: 1.45, yawRange: 1.5 } });
    }
    // pergola of white arches over the loungers
    for (let x = -5.2; x <= 5.2; x += 2.6) b.torus(m.whiteCeramic, x, y, 96.6, 1.6, 0.07, { arc: Math.PI, rotY: Math.PI / 2 });
    for (const zz of [95.2, 98.0]) b.cylinder(m.chrome, 0, y + 1.55, zz, 0.03, 0.03, 10.6, { rotZ: Math.PI / 2, segments: 8, cast: false });
    for (let k = 0; k < 6; k++) ctx.veg.vine(-5 + k * 2, y + 1.55, 95.2 + (k % 2) * 2.8, 0.7);
    // planters with palms, benches facing east and west, lamps
    for (const [x, z] of [
      [-6.5, 86.2],
      [16.2, 86.2],
      [16.2, 98.4],
      [8.5, 91.2],
    ] as Array<[number, number]>) {
      const top = planterBowl(b, x, z, 0.75, m.whiteCeramic, m.cobaltCeramic, y);
      ctx.veg.palm(x, top, z, 0.42);
      ctx.veg.fern(x + 0.4, top, z, 0.6);
    }
    for (const sp of bench(b, 12.5, 86.2, 0, 1, 3.0, m.fabricCobalt, true, y)) ctx.addSeat({ id: `roof-bench-n-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });
    for (const sp of bench(b, 2.0, 86.2, 0, 1, 3.0, m.fabricCyan, true, y)) ctx.addSeat({ id: `roof-bench-m-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });
    const glow = m.frostedGlass.clone();
    glow.name = 'roofLamps';
    glow.emissive = new THREE.Color(0xfff3dc);
    glow.emissiveIntensity = 1.1;
    for (const [x, z] of [
      [-8.5, 99.3],
      [8.5, 99.3],
      [17.4, 92],
    ] as Array<[number, number]>) floorLamp(b, x, z, glow, 1.6, y);
    const scope = new Telescope(ctx, b, 'roof-telescope', 12, y, 99.2, Math.PI, this.landmarks);
    ctx.addInteractable(scope);
    ctx.addModal(scope);
    const scope2 = new Telescope(ctx, b, 'roof-telescope-e', 17.3, y, 88.8, -Math.PI / 2, this.landmarks);
    ctx.addInteractable(scope2);
    ctx.addModal(scope2);
    examine(ctx, 'roof-plaque', new THREE.Vector3(SHAFT.x + 1.6, y + 1.1, SHAFT.z - 1.6), new THREE.Vector3(0.5, 0.4, 0.1), 'Ler placa do mirante', '<b>Mirante do Hotel AQUA · 8,4 m</b><br>Ao sul, o Distrito Sul e suas passarelas suspensas; a leste, as torres da Cidade das Águas; a oeste, o Distrito Oeste sobre o mar. Use as lunetas para ver os nomes de cada lugar.');
    b.box(m.cobaltCeramic, SHAFT.x + 1.6, y, SHAFT.z - 1.6, 0.9, 1.2, 0.08, { radius: 0.04 });
  }

  // ---------------------------------------------------------------------------------------
  // Interiors (lobby, atrium, corridor, rooms)
  // ---------------------------------------------------------------------------------------
  interior(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const lobby = new LampGroup('hotel-lobby', true);
    const corridor = new LampGroup('hotel-corridor', true);
    const atrium = new LampGroup('hotel-atrium', true);
    this.lampGroups.push(lobby, corridor, atrium);
    for (const g of this.lampGroups) ctx.addUpdatable(g);

    // ---- Reception -----------------------------------------------------------------------------------
    const welcome = welcomeScreen(ctx);
    receptionDesk(b, 10, 92, 5.5, -0.32, 0.32, welcome);
    const signTex = hotelSign(ctx);
    b.box(m.cobaltCeramic, HT.x1 - 0.2, 1.3, 92, 0.1, 2.0, 4.6, { radius: 0.06, cast: false });
    b.box(m.emissiveCyan, HT.x1 - 0.26, 1.3, 92, 0.02, 2.0, 4.6, { cast: false, receive: false });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.95), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }));
    sp.position.set(HT.x1 - 0.28, 2.3, 92);
    sp.rotation.y = -Math.PI / 2;
    b.root.add(sp);
    for (const z of [89.2, 94.8]) {
      const top = planterBowl(b, HT.x1 - 0.8, z, 0.42, m.whiteCeramic, m.limeGlossy);
      ctx.veg.sansevieria(HT.x1 - 0.8, top, z, 0.8);
    }
    // service bell
    b.cylinder(m.chrome, 15.25, 1.06, 92.6, 0.06, 0.07, 0.02, { segments: 18, cast: false });
    b.sphere(m.chrome, 15.25, 1.09, 92.6, 0.055, { cast: false });
    ctx.addInteractable(new UseSpot('hotel-bell', new THREE.Vector3(15.25, 1.1, 92.6), new THREE.Vector3(0.1, 0.08, 0.1), 0, () => 'Tocar a campainha', () => {
      ctx.audio.play('elevatorDing', { position: { x: 15.25, y: 1.1, z: 92.6 } });
      ctx.showCard('<b>Recepção · Hotel AQUA</b><br>“Bem-vindo! O check-in é feito no terminal ao lado — é gratuito e leva um segundo. Bom descanso!”', 6);
    }, 2.4));
    // check-in terminal
    const kx = 13.4;
    const kz = 88.4;
    b.cylinder(m.whiteCeramic, kx, 0, kz, 0.22, 0.3, 1.05, { segments: 24, collide: 'tile' });
    b.box(m.cobaltCeramic, kx, 1.02, kz, 0.62, 0.42, 0.06, { rotY: -Math.PI / 2 + 0.35, rotX: -0.35, radius: 0.03 });
    const scr = ctx.assets.dynamicCanvas(384, 256, 'checkin');
    this.checkinScreen = { ctx: scr.ctx, texture: scr.texture };
    this.drawCheckin();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.36), new THREE.MeshBasicMaterial({ map: scr.texture, toneMapped: false }));
    screen.position.set(kx - 0.04, 1.25, kz + 0.02);
    screen.rotation.set(-0.35, -Math.PI / 2 + 0.35, 0, 'YXZ');
    b.root.add(screen);
    ctx.addInteractable(
      new UseSpot('hotel-checkin', new THREE.Vector3(kx, 1.2, kz), new THREE.Vector3(0.35, 0.3, 0.35), 0, () => (this.checkedIn ? 'Ver dados da reserva' : 'Fazer check-in'), () => this.checkin(), 2.4),
    );

    // ---- Lobby lounge (facing the south glass) -------------------------------------------------------
    rugRect(b, 4, 96.4, 7.2, 4.2, 0, m.rug);
    for (const s of sofa(b, 4, 95.0, 0, 2.8, m.whiteCeramic, m.fabricCobalt)) ctx.addSeat({ id: `hotel-sofa-${s.x.toFixed(2)}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(0, 1) });
    for (const [x, f] of [
      [1.0, Math.PI / 2],
      [7.0, -Math.PI / 2],
    ] as Array<[number, number]>) {
      const s = tubChair(b, x, 97.0, f, m.limeGlossy, fabric('pearl'));
      ctx.addSeat({ id: `hotel-tub-${x}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(Math.sin(f), Math.cos(f)) });
    }
    const t = roundTable(b, 4, 97.0, 0.6, 0.42, m.glass);
    tableDecor(b, 4, t, 97.0, 9);
    const lobbyGlow = lobby.material(0xfff1d6, 1.5);
    floorLamp(b, 0.4, 95.0, lobbyGlow);
    floorLamp(b, 7.6, 95.0, lobbyGlow);
    lobby.pool(b.root, 0.4, 0.05, 95.0, 1.2, 0xffe8c2, 0.3);
    lobby.pool(b.root, 7.6, 0.05, 95.0, 1.2, 0xffe8c2, 0.3);
    ringPendant(b, 4, 3.3, 96.4, 1.2, C0, lobbyGlow);
    this.lampSwitch(b, 'hotel-switch-lobby', HT.x1 - 0.17, 97.5, -Math.PI / 2, lobby, 'luzes do lobby');
    // second cluster facing the column aquarium
    for (const [i, z] of [85.6, 87.4].entries()) {
      const s = tubChair(b, -4.4, z, -Math.PI / 2, m.whiteCeramic, fabric('lagoon'));
      ctx.addSeat({ id: `hotel-aqua-chair-${i}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(-1, 0) });
    }
    roundTable(b, -4.4, 86.5, 0.25, 0.5, m.glass);
    // column aquariums framing the atrium
    for (const [i, z] of [86.4, 97.6].entries()) {
      new Aquarium(ctx, b, {
        id: `hotel-column-${i}`,
        kind: 'cylinder',
        x: -6.6,
        z,
        y0: 0.5,
        r: 0.6,
        height: 3.2,
        fishPerSpecies: 2,
        species: i ? [0, 4] : [1, 3],
        fishScale: 0.55,
        kelp: 6,
        corals: 3,
        bubbles: 90,
        info: {
          title: i ? 'Coluna Azul' : 'Coluna Coral',
          html: i
            ? 'Cirurgiões-patela e peixes-anjo. A coluna é abastecida pelo mesmo circuito de água do mar do Salão Maré.'
            : 'Peixes-palhaço e borboletas-amarelas entre corais macios. Os peixes-palhaço vivem em casais — tente achar os dois.',
        },
      });
    }
    // directory totem by the elevator
    b.box(m.whiteCeramic, -8.6, 0, 89.4, 0.7, 1.9, 0.22, { rotY: Math.PI / 2, radius: 0.1, collide: 'tile' });
    const dir = directoryTexture(ctx);
    const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), new THREE.MeshBasicMaterial({ map: dir, toneMapped: false }));
    dp.position.set(-8.72, 1.25, 89.4);
    dp.rotation.y = -Math.PI / 2;
    b.root.add(dp);
    examine(ctx, 'hotel-directory', new THREE.Vector3(-8.75, 1.2, 89.4), new THREE.Vector3(0.1, 0.6, 0.35), 'Ler diretório', '<b>Diretório</b><br>Térreo — recepção, lobby e jardim sul.<br>1º andar — suítes 101 (Lagoa), 102 (Coral), 103 e 104 (ocupadas).<br>Cobertura — Mirante com lunetas e espreguiçadeiras.<br>Elevador panorâmico e escada no átrio.', 0, 2.4);
    for (let x = -6; x < HT.x1 - 1; x += 3.4) for (const z of [86.2, 90.4]) if (!(x > 8 && z < 91)) downlight(b, x, C0, z, lobbyGlow, 0.12);
    for (const [x, z] of [
      [8.8, 85.0],
      [-7.2, 99.2],
      [9.2, 99.2],
    ] as Array<[number, number]>) {
      const top = planterBowl(b, x, z, 0.5, m.whiteCeramic, m.cobaltCeramic);
      ctx.veg.banana(x, top, z, 0.55);
    }
    artPanel(b, -3, 2.5, HT.z0 + 0.28, 0, 2.2, 1.3, 11);

    // ---- Atrium: bubble lamp cascade, vines from the landing -------------------------------------------
    const atriumGlow = atrium.material(0xfff4e4, 1.7);
    for (const [x, z, y, r] of [
      [-9.0, 95.6, 5.6, 0.32],
      [-9.8, 97.4, 4.6, 0.24],
      [-12.6, 97.6, 6.4, 0.38],
      [-9.4, 98.8, 3.8, 0.2],
      [-12.0, 95.4, 5.0, 0.26],
    ] as Array<[number, number, number, number]>) bubbleLamp(b, x, y, z, R_BOTTOM, r, atriumGlow);
    atrium.pool(b.root, -10.8, 0.05, 97, 2.8, 0xfff0d8, 0.2);
    for (const [i, x] of [-13.2, -8.9, -8.2].entries()) ctx.veg.vine(x, F1 - 0.3, ATRIUM.z0 + 0.1, 1.2 + (i % 3) * 0.5);
    this.lampSwitch(b, 'hotel-switch-atrium', -8.47, 89.4, Math.PI / 2, atrium, 'luminárias do átrio');

    // ---- 1st floor: landing ------------------------------------------------------------------------------
    rugRect(b, -12, 87.6, 6.0, 4.6, 0, m.rug, F1);
    for (const s2 of bench(b, -12.6, HT.z0 + 0.9, 0, 1, 2.6, m.fabricCyan, true, F1)) ctx.addSeat({ id: `hotel-landing-bench-${s2.x.toFixed(2)}`, x: s2.x, y: s2.y, z: s2.z, yaw: yawFacing(0, 1) });
    const lt = planterBowl(b, -15.2, 85.0, 0.45, m.whiteCeramic, m.limeGlossy, F1);
    ctx.veg.monstera(-15.2, lt, 85.0, 0.7);
    hangingSign(b, -9.0, 87.2, 'Suítes 101–104', '→', '#1747b5', Math.PI / 2, ctx, F1 + 2.5, R_BOTTOM);

    // ---- Corridor ------------------------------------------------------------------------------------------
    const corrMid = (CORRIDOR.z0 + CORRIDOR.z1) / 2;
    rugRect(b, 5, corrMid, 25, 1.4, 0, fabric('mist'), F1);
    lightLine(b, 5, F1 + 0.05, CORRIDOR.z0 + 0.08, 25.5, 0, m.emissiveCyan);
    lightLine(b, 5, F1 + 0.05, CORRIDOR.z1 - 0.08, 25.5, 0, m.emissiveCyan);
    const sconce = corridor.material(0xfff0d6, 1.5);
    for (const x of [-5.6, 1.6, 9.8, 16.4]) wallSconce(b, x, F1 + 1.9, CORRIDOR.z1 - 0.02, Math.PI, sconce);
    for (const x of [-5.6, 1.6, 9.8, 16.4]) corridor.pool(b.root, x, F1 + 1.9, CORRIDOR.z1 - 0.03, 0.8, 0xffe8c2, 0.25, Math.PI);
    for (let x = -6; x < HT.x1; x += 3) downlight(b, x, R_BOTTOM, corrMid, sconce, 0.1);
    for (const [x, seed] of [
      [-4.2, 21],
      [6, 22],
      [15.2, 23],
    ] as Array<[number, number]>) artPanel(b, x, F1 + 1.75, CORRIDOR.z0 + 0.01, 0, 1.5, 0.9, seed);
    for (const [i, x] of [2.5, 9.5].entries()) {
      new Aquarium(ctx, b, {
        id: `hotel-corridor-tank-${i}`,
        kind: 'box',
        x,
        z: HT.z0 + 0.03,
        y0: F1 + 0.8,
        w: 1.6,
        d: 0.4,
        height: 0.95,
        backdrop: ['-z', '+x', '-x'],
        crown: false,
        fishPerSpecies: 2,
        species: i ? [2, 4] : [1, 2],
        fishScale: 0.35,
        kelp: 4,
        corals: 2,
        bubbles: 30,
        collide: false,
        info: { title: i ? 'Aquário do corredor · Neons' : 'Aquário do corredor · Palhaços', html: 'Pequenos aquários embutidos acompanham o corredor das suítes. A luz deles ajuda a encontrar o caminho à noite.' },
      });
    }
    for (const s3 of bench(b, 9.5, CORRIDOR.z1 - 0.38, 0, -1, 1.8, m.fabricLime, false, F1)) ctx.addSeat({ id: `hotel-corridor-bench-${s3.x.toFixed(2)}`, x: s3.x, y: s3.y, z: s3.z, yaw: yawFacing(0, -1) });
    const nook = tubChair(b, HT.x1 - 0.9, CORRIDOR.z0 + 1.0, Math.PI / 2, m.whiteCeramic, fabric('lagoon'), F1);
    ctx.addSeat({ id: 'hotel-corridor-nook', x: nook.x, y: nook.y, z: nook.z, yaw: yawFacing(1, 0) });
    this.lampSwitch(b, 'hotel-switch-corridor', -7.6, CORRIDOR.z1 - 0.02, Math.PI, corridor, 'luzes do corredor', F1 + 1.2);

    // ---- Room walls + doors ----------------------------------------------------------------------------------
    // suite 101's west wall faces the atrium (above the landing's south edge)
    b.box(m.whiteCeramic, ROOMS[0].x0, F1, (CORRIDOR.z1 + HT.z1) / 2, 0.2, R_BOTTOM - F1, HT.z1 - CORRIDOR.z1, { collide: 'tile' });
    for (const r of ROOMS) {
      b.box(m.whiteCeramic, r.x1, F1, (CORRIDOR.z1 + HT.z1) / 2 + 0.1, 0.2, R_BOTTOM - F1, HT.z1 - CORRIDOR.z1 - 0.2, { collide: 'tile' });
      // corridor wall with the door gap
      b.box(m.whiteCeramic, (r.x0 + r.door[0]) / 2, F1, CORRIDOR.z1 + 0.1, r.door[0] - r.x0, R_BOTTOM - F1, 0.2, { collide: 'tile' });
      b.box(m.whiteCeramic, (r.door[1] + r.x1) / 2, F1, CORRIDOR.z1 + 0.1, r.x1 - r.door[1], R_BOTTOM - F1, 0.2, { collide: 'tile' });
      b.box(m.whiteCeramic, (r.door[0] + r.door[1]) / 2, F1 + 2.25, CORRIDOR.z1 + 0.1, r.door[1] - r.door[0], R_BOTTOM - F1 - 2.25, 0.2);
      b.box(m.cobaltCeramic, (r.door[0] + r.door[1]) / 2, F1 + 2.25, CORRIDOR.z1 - 0.02, r.door[1] - r.door[0] + 0.24, 0.1, 0.06, { radius: 0.02, cast: false });
      const plate = roomPlate(ctx, r.n, r.name, r.open);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.33), new THREE.MeshBasicMaterial({ map: plate, toneMapped: false }));
      const px = r.door[1] + 0.45 < r.x1 - 0.2 ? r.door[1] + 0.45 : r.door[0] - 0.45;
      pm.position.set(px, F1 + 1.55, CORRIDOR.z1 - 0.005);
      pm.rotation.y = Math.PI;
      b.root.add(pm);
      const hinge = r.door[0] < (r.x0 + r.x1) / 2 && r.n === 101 ? r.door[1] : r.door[0];
      const along = hinge === r.door[1] ? Math.PI : 0;
      new HingedDoor(ctx, b, {
        id: `hotel-door-${r.n}`,
        x: hinge,
        z: CORRIDOR.z1 + 0.1,
        y0: F1,
        width: 1.0,
        height: 2.2,
        along,
        swing: along === Math.PI ? 1 : -1,
        style: 'room',
        name: `porta da ${r.n}`,
        locked: () => {
          if (!r.open) return `<b>Suíte ${r.n} · ${r.name}</b><br>Ocupada — <i>não perturbe</i>. Esta suíte não pode ser visitada.`;
          if (!this.checkedIn) return `<b>Suíte ${r.n}</b><br>Faça o check-in no terminal da recepção (térreo) para liberar o cartão do quarto.`;
          return null;
        },
        autoClose: 0,
      });
    }

    // ---- Rooms ------------------------------------------------------------------------------------------------
    this.room101(b);
    this.room102(b);
    for (const r of ROOMS.filter((x) => !x.open)) {
      new Curtains(ctx, b, { id: `hotel-curtain-${r.n}`, x0: r.x0 + 0.15, z0: HT.z1 - 0.15, x1: r.x1 - 0.15, z1: HT.z1 - 0.15, nx: 0, nz: -1, y0: F1 + 0.1, height: R_BOTTOM - F1 - 0.25, open: false, color: r.n === 103 ? 0xdff1ff : 0xeaf8d8 });
      b.box(fabric('pearl'), (r.x0 + r.x1) / 2, F1, (CORRIDOR.z1 + HT.z1) / 2, r.x1 - r.x0 - 0.3, 0.02, HT.z1 - CORRIDOR.z1 - 0.4, { cast: false });
    }
  }

  private room101(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const r = ROOMS[0];
    const x0 = r.x0 + 0.15;
    const x1 = r.x1 - 0.1;
    const z0 = CORRIDOR.z1 + 0.2;
    const z1 = HT.z1 - 0.15;
    const cx = (x0 + x1) / 2;
    const roomLights = new LampGroup('room-101', true);
    const bedside = new LampGroup('room-101-bedside', true);
    ctx.addUpdatable(roomLights);
    ctx.addUpdatable(bedside);
    const carpet = new THREE.MeshStandardMaterial({ name: 'carpet101', color: 0xe7f3fa, roughness: 0.95 });
    b.box(carpet, cx, F1, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, { cast: false });
    b.box(m.glossyCyan, cx, F1 + 0.005, (z0 + z1) / 2, x1 - x0 - 0.6, 0.02, 0.06, { cast: false });
    // entry: wardrobe and an oval mirror (live reflection while inside, on High)
    wardrobe(b, x0 + 0.35, z0 + 1.2, Math.PI / 2, 1.6, F1);
    examine(ctx, 'room101-wardrobe', new THREE.Vector3(x0 + 0.66, F1 + 1.2, z0 + 1.2), new THREE.Vector3(0.05, 1.0, 0.8), 'Abrir armário', '<b>Armário</b><br>Roupões felpudos azul-claro, chinelos, um guarda-chuva transparente e um cartão: “Leve a toalha para a piscina infinita do Terraço!”', Math.PI / 2, 2.2);
    const fx = new BathroomFixtures(ctx, 'room101', new THREE.Vector3(cx, F1 + 1.5, (z0 + z1) / 2), 9);
    const inside = () => {
      const v = ctx.viewer;
      return v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1 && v.y > F1 && v.y < R_BOTTOM;
    };
    const oval = new THREE.Shape();
    oval.absellipse(0, 0, 0.36, 0.85, 0, Math.PI * 2, false, 0);
    const ovalGeo = new THREE.ShapeGeometry(oval, 40);
    fx.mirror(b, ovalGeo, x0 + 0.02, F1 + 1.45, z0 + 2.75, Math.PI / 2, b.root, inside);
    const rim = new THREE.TorusGeometry(1, 0.025, 8, 64).scale(0.38, 0.87, 1).rotateY(Math.PI / 2);
    b.place(rim, m.chrome, x0 + 0.03, F1 + 1.45, z0 + 2.75, { cast: false });
    rim.dispose();
    // bed facing the window, with a padded cobalt headboard
    const bedRes = bed(b, cx - 0.3, z0 + 5.2, 0, { y0: F1, duvet: fabric('lagoon'), accent: m.fabricLime, headboard: m.fabricCobalt });
    for (const [i, s] of bedRes.sit.entries()) ctx.addSeat({ id: `room101-bed-sit-${i}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(i ? -1 : 1, 0), label: 'Sentar na cama' });
    ctx.addSeat({ id: 'room101-bed-lie', x: bedRes.lie.x, y: bedRes.lie.y, z: bedRes.lie.z, yaw: yawFacing(0, 1), label: 'Deitar', eyeHeight: 0.3, back: 0, hitRadius: 0.5, reach: 3.2, pose: { pitch: 0.35, pitchMin: -0.25, pitchMax: 1.45, yawRange: 1.3 } });
    rugRect(b, cx - 0.3, z0 + 5.6, 3.0, 3.4, 0, fabric('mist'), F1);
    const lampGlow = bedside.material(0xfff0d4, 1.7);
    for (const e of [-1, 1]) {
      const nx = cx - 0.3 + e * 1.35;
      const top = nightstand(b, nx, z0 + 4.35, 0, m.whiteCeramic, F1);
      tableLamp(b, nx, top, z0 + 4.35, lampGlow, m.cobaltCeramic);
      bedside.pool(b.root, nx, top + 0.005, z0 + 4.35, 0.45, 0xffe6bd, 0.35);
      bedside.pool(b.root, nx, F1 + 1.4, z0 + 4.05, 0.9, 0xffe6bd, 0.18, 0);
      this.lampToggle(b, `room101-lamp-${e}`, nx, top + 0.3, z0 + 4.35, bedside, 'abajures');
    }
    // window corner: armchair, side table, floor lamp; desk on the east wall
    const chair = tubChair(b, x0 + 0.95, z1 - 1.1, 0.5, m.limeGlossy, fabric('pearl'), F1);
    ctx.addSeat({ id: 'room101-armchair', x: chair.x, y: chair.y, z: chair.z, yaw: yawFacing(Math.sin(0.5), Math.cos(0.5)) });
    const st = roundTable(b, x0 + 1.9, z1 - 0.7, 0.28, 0.5, m.glass, F1);
    tableDecor(b, x0 + 1.9, st, z1 - 0.7, 31);
    const roomGlow = roomLights.material(0xfff3e0, 1.4);
    floorLamp(b, x0 + 0.35, z1 - 0.4, roomGlow, 1.55, F1);
    const deskSeat = desk(b, x1 - 0.4, z0 + 7.0, -Math.PI / 2, 1.4, m.whiteCeramic, fabric('lagoon'), F1);
    ctx.addSeat({ id: 'room101-desk', x: deskSeat.x, y: deskSeat.y, z: deskSeat.z, yaw: yawFacing(1, 0) });
    tableLamp(b, x1 - 0.4, F1 + 0.77, z0 + 6.5, roomGlow, m.limeGlossy);
    artPanel(b, x1 - 0.42, F1 + 1.05, z0 + 7.2, -Math.PI / 2 + 0.3, 0.32, 0.22, 33);
    examine(ctx, 'room101-guide', new THREE.Vector3(x1 - 0.4, F1 + 0.85, z0 + 7.3), new THREE.Vector3(0.4, 0.15, 0.3), 'Ler guia do hotel', '<b>Guia do Hotel AQUA</b><br>Café da manhã com vista no Salão Maré. Lunetas e espreguiçadeiras na cobertura. Para ver o pôr do sol, deite-se e olhe para a janela — as cortinas abrem pelo trilho perto do vidro.', 0, 2.0);
    // ceiling: cove light, ring pendant, downlights
    ringPendant(b, cx - 0.3, R_BOTTOM - 0.6, z0 + 5.2, 0.7, R_BOTTOM, roomGlow);
    for (const z of [z0 + 1.5, z1 - 1.5]) downlight(b, cx, R_BOTTOM, z, roomGlow, 0.1);
    b.box(roomGlow, cx, R_BOTTOM - 0.12, z0 + 0.12, x1 - x0, 0.03, 0.03, { cast: false, receive: false });
    roomLights.pool(b.root, cx - 0.3, F1 + 0.04, z0 + 5.2, 2.6, 0xfff0d8, 0.18);
    this.lampSwitch(b, 'room101-switch', r.door[0] - 0.25, z0 + 0.02, 0, roomLights, 'luzes do quarto', F1 + 1.2);
    // curtains, plant, art
    new Curtains(ctx, b, { id: 'room101-curtains', x0, z0: HT.z1 - 0.15, x1, z1: HT.z1 - 0.15, nx: 0, nz: -1, y0: F1 + 0.1, height: R_BOTTOM - F1 - 0.3, open: true });
    const top = planterBowl(b, x1 - 0.5, z1 - 0.5, 0.38, m.whiteCeramic, m.cobaltCeramic, F1);
    ctx.veg.monstera(x1 - 0.5, top, z1 - 0.5, 0.6);
    artPanel(b, x0 + 0.02, F1 + 1.9, z0 + 6.2, Math.PI / 2, 1.6, 1.0, 12);
  }

  private room102(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const r = ROOMS[1];
    const x0 = r.x0 + 0.1;
    const x1 = r.x1 - 0.1;
    const z0 = CORRIDOR.z1 + 0.2;
    const z1 = HT.z1 - 0.15;
    const cx = (x0 + x1) / 2;
    const roomLights = new LampGroup('room-102', true);
    const bedside = new LampGroup('room-102-bedside', true);
    ctx.addUpdatable(roomLights);
    ctx.addUpdatable(bedside);
    const carpet = new THREE.MeshStandardMaterial({ name: 'carpet102', color: 0xf1f8e6, roughness: 0.95 });
    b.box(carpet, cx, F1, (z0 + z1) / 2, x1 - x0, 0.02, z1 - z0, { cast: false });
    // round bed with a curved lime headboard holding a small aquarium
    const bc = { x: cx + 0.2, z: z0 + 6.0 };
    const rb = roundBed(b, bc.x, bc.z, 0, 1.2, { y0: F1, duvet: fabric('coral'), accent: m.fabricCobalt, headboard: m.limeGlossy });
    b.arcWall(m.limeGlossy, bc.x, bc.z, 1.4, 1.6, -Math.PI + 0.35, -0.35, F1, 1.0, { collide: 'tile', bevel: 0.08 });
    b.arcWall(m.whiteCeramic, bc.x, bc.z, 1.38, 1.62, -Math.PI + 0.33, -0.33, F1 + 1.0, 0.06, { bevel: 0.02 });
    new Aquarium(ctx, b, {
      id: 'room102-headboard',
      kind: 'box',
      x: bc.x,
      z: bc.z - 1.72,
      y0: F1 + 1.06,
      w: 1.5,
      d: 0.32,
      height: 0.7,
      backdrop: ['-z'],
      fishPerSpecies: 2,
      species: [1, 3],
      fishScale: 0.3,
      kelp: 4,
      corals: 2,
      bubbles: 25,
      info: { title: 'Aquário-cabeceira', html: 'Um pequeno recife sobre a cabeceira: peixes-palhaço e borboletas-amarelas. A luz azul se apaga junto com a luz do quarto.' },
    });
    for (const [i, s] of rb.sit.entries()) ctx.addSeat({ id: `room102-bed-sit-${i}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(0, 1), label: 'Sentar na cama' });
    ctx.addSeat({ id: 'room102-bed-lie', x: rb.lie.x, y: rb.lie.y, z: rb.lie.z, yaw: yawFacing(0, 1), label: 'Deitar', eyeHeight: 0.3, back: 0, hitRadius: 0.5, reach: 3.2, pose: { pitch: 0.4, pitchMin: -0.25, pitchMax: 1.45, yawRange: 1.3 } });
    const lampGlow = bedside.material(0xfff4dc, 1.7);
    for (const e of [-1, 1]) {
      const nx = bc.x + e * 1.75;
      const top = nightstand(b, nx, bc.z - 0.6, 0, m.whiteCeramic, F1);
      tableLamp(b, nx, top, bc.z - 0.6, lampGlow, m.limeGlossy);
      bedside.pool(b.root, nx, top + 0.005, bc.z - 0.6, 0.45, 0xffe6bd, 0.35);
      this.lampToggle(b, `room102-lamp-${e}`, nx, top + 0.3, bc.z - 0.6, bedside, 'abajures');
    }
    // sofa corner by the window (on the west wall), coffee table, pouf
    for (const s of sofa(b, x0 + 0.5, z1 - 2.2, Math.PI / 2, 2.4, m.whiteCeramic, m.fabricLime, F1)) ctx.addSeat({ id: `room102-sofa-${s.z.toFixed(2)}`, x: s.x, y: s.y, z: s.z, yaw: yawFacing(1, 0) });
    const tt = roundTable(b, x0 + 1.75, z1 - 2.2, 0.4, 0.4, m.glass, F1);
    tableDecor(b, x0 + 1.75, tt, z1 - 2.2, 44);
    const p = pouf(b, x0 + 2.8, z1 - 2.6, 0.3, m.fabricCyan, F1);
    ctx.addSeat({ id: 'room102-pouf', x: p.x, y: p.y, z: p.z, yaw: yawFacing(-1, 0) });
    // vanity with an oval mirror (east wall) + bookshelf + wardrobe by the entry
    const fx = new BathroomFixtures(ctx, 'room102', new THREE.Vector3(cx, F1 + 1.5, (z0 + z1) / 2), 9);
    const inside = () => {
      const v = ctx.viewer;
      return v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1 && v.y > F1 && v.y < R_BOTTOM;
    };
    const vz = z0 + 2.6;
    b.box(m.whiteCeramic, x1 - 0.3, F1 + 0.72, vz, 0.5, 0.05, 1.2, { radius: 0.02 });
    b.box(m.limeGlossy, x1 - 0.3, F1, vz, 0.42, 0.72, 0.9, { radius: 0.12, collide: 'tile' });
    const oval = new THREE.Shape();
    oval.absellipse(0, 0, 0.42, 0.62, 0, Math.PI * 2, false, 0);
    fx.mirror(b, new THREE.ShapeGeometry(oval, 40), x1 - 0.02, F1 + 1.55, vz, -Math.PI / 2, b.root, inside);
    const rim = new THREE.TorusGeometry(1, 0.03, 8, 64).scale(0.44, 0.64, 1).rotateY(-Math.PI / 2);
    b.place(rim, m.whiteCeramic, x1 - 0.03, F1 + 1.55, vz, { cast: false });
    rim.dispose();
    const pv = pouf(b, x1 - 0.95, vz, 0.26, m.fabricCobalt, F1);
    ctx.addSeat({ id: 'room102-vanity', x: pv.x, y: pv.y, z: pv.z, yaw: yawFacing(1, 0) });
    wardrobe(b, x1 - 0.35, z0 + 1.0, -Math.PI / 2, 1.2, F1, m.whiteCeramic);
    bookshelf(b, x0 + 0.2, z0 + 3.6, Math.PI / 2, 1.4, 1.5, 88, F1);
    examine(ctx, 'room102-books', new THREE.Vector3(x0 + 0.3, F1 + 0.8, z0 + 3.6), new THREE.Vector3(0.2, 0.7, 0.7), 'Ver livros', '<b>Estante da Suíte Coral</b><br><i>Atlas das Correntes Quentes</i>, <i>Arquitetura de Bolhas</i>, <i>Receitas com Algas</i> e um álbum de cartões-postais da Linha 2.', Math.PI / 2, 2.0);
    // lights: bubble cluster, cove; switch
    const roomGlow = roomLights.material(0xfff6e6, 1.4);
    for (const [dx, dz, y, rr] of [
      [-0.6, -0.4, R_BOTTOM - 1.1, 0.18],
      [0.4, 0.3, R_BOTTOM - 0.8, 0.14],
      [0.1, -0.9, R_BOTTOM - 1.4, 0.12],
    ] as Array<[number, number, number, number]>) bubbleLamp(b, bc.x + dx, y, bc.z + dz, R_BOTTOM, rr, roomGlow);
    b.box(roomGlow, cx, R_BOTTOM - 0.12, z0 + 0.12, x1 - x0, 0.03, 0.03, { cast: false, receive: false });
    for (const z of [z0 + 1.5, z1 - 1.2]) downlight(b, cx, R_BOTTOM, z, roomGlow, 0.1);
    roomLights.pool(b.root, bc.x, F1 + 0.04, bc.z, 2.4, 0xfff0d8, 0.18);
    floorLamp(b, x1 - 0.4, z1 - 0.5, roomGlow, 1.5, F1);
    this.lampSwitch(b, 'room102-switch', r.door[1] + 0.3, z0 + 0.02, 0, roomLights, 'luzes do quarto', F1 + 1.2);
    new Curtains(ctx, b, { id: 'room102-curtains', x0, z0: HT.z1 - 0.15, x1, z1: HT.z1 - 0.15, nx: 0, nz: -1, y0: F1 + 0.1, height: R_BOTTOM - F1 - 0.3, open: true, color: 0xeefad8 });
    const top = planterBowl(b, x1 - 0.5, z0 + 4.4, 0.36, m.whiteCeramic, m.limeGlossy, F1);
    ctx.veg.fern(x1 - 0.5, top, z0 + 4.4, 0.6);
    artPanel(b, x1 - 0.02, F1 + 1.9, z0 + 5.2, -Math.PI / 2, 1.2, 0.8, 14);
  }

  // ---------------------------------------------------------------------------------------
  private checkin(): void {
    if (!this.checkedIn) {
      this.checkedIn = true;
      this.ctx.audio.play('card', { position: { x: 13.4, y: 1.2, z: 88.4 } });
      this.drawCheckin();
      this.ctx.showCard('<b>Check-in concluído ✓</b><br>Suíte 101 · Lagoa e Suíte 102 · Coral liberadas no 1º andar.<br>Suba pela escada ou pelo elevador panorâmico do átrio. A cobertura (mirante) também está aberta.', 8);
    } else {
      this.ctx.showCard('<b>Sua reserva</b><br>Suítes 101 e 102 · 1º andar · cortesia do complexo AQUA. Check-out quando quiser.', 5);
    }
  }

  private drawCheckin(): void {
    const c = this.checkinScreen.ctx;
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1d6fe0');
    g.addColorStop(1, '#0d3a8f');
    c.fillStyle = g;
    c.fillRect(0, 0, 384, 256);
    c.fillStyle = '#ffffff';
    c.font = `800 34px ${FONT}`;
    c.textAlign = 'center';
    c.fillText('Hotel AQUA', 192, 56);
    c.font = `600 22px ${FONT}`;
    c.fillStyle = this.checkedIn ? '#b8ffd0' : '#ffffff';
    c.fillText(this.checkedIn ? 'Check-in feito ✓' : 'Toque para fazer check-in', 192, 120);
    c.font = `500 18px ${FONT}`;
    c.fillStyle = '#cfe9f7';
    c.fillText(this.checkedIn ? 'Suítes 101 e 102 · 1º andar' : 'gratuito · sem filas', 192, 170);
    c.fillText('elevador e escada no átrio ←', 192, 210);
    this.checkinScreen.texture.needsUpdate = true;
  }

  private lampSwitch(b: WorldBuilder, id: string, x: number, z: number, rotY: number, group: LampGroup, what: string, y = 1.2): void {
    const m = b.mats;
    b.box(m.whiteCeramic, x, y - 0.1, z, 0.12, 0.2, 0.03, { rotY, radius: 0.015, cast: false });
    b.sphere(m.emissiveCyan, x + Math.sin(rotY) * 0.02, y, z + Math.cos(rotY) * 0.02, 0.022, { cast: false });
    this.ctx.addInteractable(
      new UseSpot(id, new THREE.Vector3(x, y, z), new THREE.Vector3(0.1, 0.14, 0.1), rotY, () => (group.on ? `Apagar ${what}` : `Acender ${what}`), () => {
        group.toggle();
        this.ctx.audio.play('switch', { position: { x, y, z } });
      }, 2.2),
    );
  }

  /** Aim at a lamp itself to switch its group. */
  private lampToggle(b: WorldBuilder, id: string, x: number, y: number, z: number, group: LampGroup, what: string): void {
    void b;
    this.ctx.addInteractable(
      new UseSpot(id, new THREE.Vector3(x, y, z), new THREE.Vector3(0.18, 0.2, 0.18), 0, () => (group.on ? `Apagar ${what}` : `Acender ${what}`), () => {
        group.toggle();
        this.ctx.audio.play('switch', { position: { x, y, z } });
      }, 2.2),
    );
  }
}

// -----------------------------------------------------------------------------------------
// Canvas textures
// -----------------------------------------------------------------------------------------

let hotelSignTex: THREE.CanvasTexture | null = null;
export function resetHotelCache(): void {
  hotelSignTex = null;
}

function hotelSign(ctx: WorldContext): THREE.CanvasTexture {
  if (hotelSignTex) return hotelSignTex;
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(1024, 256, 'hotelSign');
  c.clearRect(0, 0, 1024, 256);
  c.fillStyle = 'rgba(255,255,255,0.97)';
  roundRect(c, 8, 8, 1008, 240, 120);
  c.fill();
  c.strokeStyle = '#28c5df';
  c.lineWidth = 10;
  roundRect(c, 8, 8, 1008, 240, 120);
  c.stroke();
  // emblem: wave in a circle
  c.fillStyle = '#1747b5';
  c.beginPath();
  c.arc(140, 128, 74, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#9be22d';
  c.lineWidth = 12;
  c.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 84 + i * 2.8;
    const y = 132 + Math.sin(i / 40 * Math.PI * 2) * 18;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.stroke();
  c.fillStyle = '#1747b5';
  c.font = `800 108px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText('Hotel AQUA', 250, 116);
  c.fillStyle = '#2a3a5c';
  c.font = `600 38px ${FONT}`;
  c.fillText('hospedagem · mirante · aquários', 256, 196);
  texture.needsUpdate = true;
  hotelSignTex = texture;
  return texture;
}

function welcomeScreen(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(512, 320, 'hotelWelcome');
  const g = c.createLinearGradient(0, 0, 0, 320);
  g.addColorStop(0, '#0d3a8f');
  g.addColorStop(1, '#1d6fe0');
  c.fillStyle = g;
  c.fillRect(0, 0, 512, 320);
  c.fillStyle = '#ffffff';
  c.font = `700 38px ${FONT}`;
  c.fillText('Reservas de hoje', 28, 60);
  c.font = `500 26px ${FONT}`;
  const rows = ['101 · Lagoa — livre', '102 · Coral — livre', '103 · Brisa — ocupada', '104 · Aurora — ocupada'];
  rows.forEach((r, i) => {
    c.fillStyle = r.includes('livre') ? '#b8ffd0' : '#ffd0a0';
    c.fillText(r, 32, 120 + i * 46);
  });
  texture.needsUpdate = true;
  return texture;
}

function roomPlate(ctx: WorldContext, n: number, name: string, open: boolean): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(300, 200, `plate-${n}`);
  c.fillStyle = '#ffffff';
  roundRect(c, 4, 4, 292, 192, 26);
  c.fill();
  c.strokeStyle = '#1747b5';
  c.lineWidth = 6;
  roundRect(c, 4, 4, 292, 192, 26);
  c.stroke();
  c.fillStyle = '#1747b5';
  c.font = `800 74px ${FONT}`;
  c.textAlign = 'center';
  c.fillText(String(n), 150, 92);
  c.font = `600 26px ${FONT}`;
  c.fillStyle = '#2a3a5c';
  c.fillText(name, 150, 132);
  c.fillStyle = open ? '#5fae12' : '#e08a12';
  roundRect(c, 50, 150, 200, 34, 17);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = `700 20px ${FONT}`;
  c.fillText(open ? 'disponível' : 'não perturbe', 150, 174);
  texture.needsUpdate = true;
  return texture;
}

function directoryTexture(ctx: WorldContext): THREE.CanvasTexture {
  const { ctx: c, texture } = ctx.assets.dynamicCanvas(240, 440, 'hotelDirectory');
  c.fillStyle = '#1747b5';
  c.fillRect(0, 0, 240, 440);
  c.fillStyle = '#ffffff';
  c.font = `800 30px ${FONT}`;
  c.fillText('Diretório', 22, 52);
  const rows: Array<[string, string]> = [
    ['C', 'Mirante'],
    ['1', 'Suítes'],
    ['T', 'Recepção'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 120 + i * 100;
    c.fillStyle = '#9be22d';
    c.beginPath();
    c.arc(50, y, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#06173f';
    c.font = `800 30px ${FONT}`;
    c.textAlign = 'center';
    c.fillText(k, 50, y + 11);
    c.textAlign = 'left';
    c.fillStyle = '#ffffff';
    c.font = `600 26px ${FONT}`;
    c.fillText(v, 94, y + 9);
  });
  texture.needsUpdate = true;
  return texture;
}
