import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldContext } from './WorldContext';
import { LAYOUT } from './WorldLayout';
import { CAR_HALF_WIDTH, DOOR_OFFSETS, MetroTrain, TRAIN_HALF_LENGTH } from './MetroTrain';
import { DEFAULT_TRAIN_CONFIG, TrainService, type TrainStop } from '../systems/TrainService';
import { DepartureBoard, DigitalClock, metroSign, networkMap, tactileTexture, waveFloorTexture, type MetroSignOptions } from './MetroSignage';
import { straightStair, treeColumn } from './ArchKit';
import { bench, eggChair, lilyPads, planterBowl, teardropLamp } from './Furniture';
import { WATER_LOOKS, type WaterBody } from '../environment/WaterSystem';
import type { Interactable } from '../systems/Interactables';
import { rayOBB } from '../systems/Interactables';
import type { PlayerController } from '../player/PlayerController';
import type { SeatController } from '../systems/Seats';
import { yawFacing } from '../systems/Seats';
import type { Collider } from '../physics/Collision';
import type { Updatable } from '../core/types';
import { createRng, randRange } from '../core/math';
import type { WorldBuilder } from './Builders';
import { buildRestroom } from './Restroom';
import { VendingMachine } from '../systems/VendingMachine';

const M = LAYOUT.metro;
const ROOF_Y = M.station.roofY;

/** Platform screen doors along x = psdX, with sliding leaves aligned to the train doors. */
class PlatformDoors {
  private readonly leaves: Array<{ mesh: THREE.Object3D; closedZ: number; dir: number }> = [];
  private readonly doorColliders: Collider[] = [];
  private state = -1;
  readonly doorZ: number[];

  constructor(b: WorldBuilder, readonly stopZ: number, z0: number, z1: number) {
    const m = b.mats;
    const x = M.psdX;
    this.doorZ = DOOR_OFFSETS.map((d) => stopZ + d);
    const openings = this.doorZ.map((z) => [z - 0.85, z + 0.85] as [number, number]).sort((a, c) => a[0] - c[0]);
    // fixed glass panels between openings
    let cursor = z0;
    const fixed: Array<[number, number]> = [];
    for (const [a, c] of openings) {
      if (a > cursor) fixed.push([cursor, a]);
      cursor = c;
    }
    if (cursor < z1) fixed.push([cursor, z1]);
    for (const [a, c] of fixed) {
      const len = c - a;
      b.box(m.glass, x, 0.05, (a + c) / 2, 0.04, 2.0, len, { cast: false, receive: false });
      b.collision.addBox({ x, z: (a + c) / 2, sx: 0.16, sz: len, minY: -0.5, maxY: 2.6, surface: 'glass' });
      const posts = Math.max(1, Math.round(len / 1.8));
      for (let i = 0; i <= posts; i++) {
        const pz = a + (len * i) / posts;
        b.box(m.cobaltCeramic, x, 0, pz, 0.2, 2.25, 0.16, { radius: 0.05 });
      }
    }
    // header band with a cyan light line, on top of everything
    b.box(m.cobaltCeramic, x, 2.25, (z0 + z1) / 2, 0.26, 0.32, z1 - z0, { radius: 0.06 });
    b.box(m.cyanAcrylic, x - 0.14, 2.32, (z0 + z1) / 2, 0.02, 0.06, z1 - z0, { cast: false, receive: false });
    for (const dz of this.doorZ) {
      // door posts with the lime "cross" marking from the reference
      for (const e of [-1, 1]) {
        const pz = dz + e * 0.92;
        b.box(m.cobaltCeramic, x, 0, pz, 0.24, 2.25, 0.18, { radius: 0.05 });
        b.box(m.limeGlossy, x - 0.125, 1.25, pz, 0.01, 0.16, 0.05, { cast: false });
        b.box(m.limeGlossy, x - 0.125, 1.305, pz, 0.01, 0.05, 0.16, { cast: false });
      }
      for (const e of [-1, 1]) {
        const leaf = new THREE.Group();
        const glassPane = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.95, 0.78), m.glass);
        glassPane.position.y = 1.02;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.8), m.cobaltCeramic);
        frame.position.y = 0.06;
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.95, 0.05), m.cobaltCeramic);
        edge.position.set(0, 1.02, -e * 0.37);
        leaf.add(glassPane, frame, edge);
        const closedZ = dz + e * 0.41;
        leaf.position.set(x - 0.06, 0.02, closedZ);
        b.root.add(leaf);
        this.leaves.push({ mesh: leaf, closedZ, dir: e });
      }
      this.doorColliders.push(b.collision.addBox({ x, z: dz, sx: 0.16, sz: 1.7, minY: -0.5, maxY: 2.6, surface: 'glass' }));
    }
  }

  setOpen(t: number): void {
    if (Math.abs(t - this.state) < 1e-4) return;
    this.state = t;
    const k = t * t * (3 - 2 * t);
    for (const l of this.leaves) l.mesh.position.z = l.closedZ + l.dir * 0.78 * k;
    for (const c of this.doorColliders) c.enabled = t < 0.85;
  }
}

/** "E — Entrar no trem" / "Sair do trem" at each platform door. */
class TrainDoorway implements Interactable {
  readonly kind = 'use' as const;
  readonly reach = 2.6;
  readonly position: THREE.Vector3;
  private readonly half = new THREE.Vector3(0.9, 1.1, 0.75);
  constructor(
    readonly id: string,
    private readonly metro: AquaMetro,
    readonly stop: TrainStop,
    readonly z: number,
  ) {
    this.position = new THREE.Vector3(M.psdX + 0.5, 1.1, z);
  }
  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (!this.metro.doorsUsableAt(this.stop)) return -1;
    return rayOBB(origin, dir, this.position, this.half, 0);
  }
  prompt(): string {
    return this.metro.playerAboard() ? 'Sair do trem' : 'Entrar no trem';
  }
  interact(): void {
    this.metro.useDoor(this.z);
  }
}

/**
 * Aqua Metro — Line 2 between "AQUA Central" (on the east cliff of the complex) and "Parque
 * Flutuante" (island terminus). Owns both stations, the viaduct, the train, the service
 * state machine and everything synchronised with it (doors, boards, sounds, passengers).
 */
export class AquaMetro implements Updatable {
  readonly train: MetroTrain;
  readonly service: TrainService;
  readonly stops: TrainStop[];
  private readonly psd = new Map<string, PlatformDoors>();
  private readonly boards: Array<{ board: DepartureBoard; stop: string }> = [];
  private readonly clocks: DigitalClock[] = [];
  private player: PlayerController | null = null;
  private seats: SeatController | null = null;
  private readonly hum: { update(x: number, y: number, z: number, speed: number): void } | null;
  private boardTimer = 0;
  private gameMinutes = 9 * 60 + 41;
  private readonly boats: THREE.Object3D[] = [];
  private announcedFor = '';

  constructor(private readonly ctx: WorldContext) {
    const { builder: b } = ctx;
    this.stops = [
      { id: 'central', name: 'AQUA Central', z: M.stopCentral, dwell: 22 },
      { id: 'park', name: 'Parque Flutuante', z: M.stopPark, dwell: 20 },
    ];
    const audio = ctx.audio;
    this.service = new TrainService(
      { ...DEFAULT_TRAIN_CONFIG, stops: this.stops },
      {
        onPhase: (phase) => {
          const pos = { x: M.trackX, y: 1.5, z: this.service.z };
          if (phase === 'opening') audio.play('doorOpen', { position: pos });
          if (phase === 'closing') audio.play('doorClose', { position: pos });
          if (phase === 'running') audio.play('trainDepart', { position: pos });
        },
        onWarning: (stop, next) => {
          audio.play('metroChime', { position: { x: M.trackX - 3, y: 3, z: stop.z } });
          this.announce(stop, `Atenção: as portas vão fechar. Próxima estação: ${next.name}.`);
        },
        onArrive: (stop) => {
          audio.play('metroChime', { position: { x: M.trackX - 3, y: 3, z: stop.z } });
          this.announce(stop, `Estação ${stop.name}. Desembarque pelo lado esquerdo.`);
          this.train.setNextStop(this.stops.find((s) => s.id !== stop.id)!.name);
        },
        onDoorHold: () => audio.play('doorHold', { position: { x: M.trackX, y: 1.5, z: this.service.z } }),
        onForceClear: () => this.clearDoorway(),
      },
      0,
    );
    this.service.doorwayBlocked = () => this.doorwayBlocked();
    const trainSeats: Array<[number, number, number, number]> = [];
    this.train = new MetroTrain(ctx, M.trackX, M.stopCentral, ctx.collision, (lx, ly, lz, yaw) => trainSeats.push([lx, ly, lz, yaw]));
    // seats live in the train's local space: they ride along with it
    for (const [lx, ly, lz, yaw] of trainSeats) ctx.addSeat({ id: `train-seat-${lx.toFixed(2)}-${lz.toFixed(2)}`, x: lx, y: ly, z: lz, yaw, parent: this.train.group });
    this.hum = audio.addTrainSound();

    this.buildCentral(b);
    this.buildViaduct(b);
    this.buildPark(b);
    for (const stop of this.stops) {
      for (const [i, z] of this.psd.get(stop.id)!.doorZ.entries()) ctx.addInteractable(new TrainDoorway(`metro-door-${stop.id}-${i}`, this, stop, z));
    }
    b.flush('metro');
    this.syncDoors();
  }

  bindPlayer(player: PlayerController, seats: SeatController): void {
    this.player = player;
    this.seats = seats;
  }

  // ---------------------------------------------------------------------------------------
  // Service / passengers
  // ---------------------------------------------------------------------------------------

  playerAboard(): boolean {
    const p = this.player?.position;
    return !!p && this.train.contains(p.x, p.y, p.z);
  }

  doorsUsableAt(stop: TrainStop): boolean {
    return this.service.phase === 'dwell' && this.service.stop.id === stop.id && this.service.doors >= 0.99;
  }

  /** Someone standing between the platform screen doors and the train. */
  private doorwayBlocked(): boolean {
    const p = this.player?.position;
    if (!p) return false;
    if (p.x < M.psdX - 0.45 || p.x > M.trackX - CAR_HALF_WIDTH + 0.55) return false;
    return Math.abs(p.z - this.service.z) < TRAIN_HALF_LENGTH;
  }

  private clearDoorway(): void {
    const p = this.player;
    if (!p) return;
    const inside = p.position.x > M.psdX + 0.55;
    p.scriptedMove(new THREE.Vector3(inside ? M.trackX - 0.4 : M.psdX - 1.4, inside ? 0.05 : 0, p.position.z), 0.6);
    this.ctx.audio.play('doorHold', { position: { x: M.trackX, y: 1.5, z: this.service.z } });
  }

  /** Boarding / alighting through a door (smooth scripted walk, never through walls). */
  useDoor(z: number): void {
    const p = this.player;
    if (!p || p.busy) return;
    if (this.playerAboard()) p.scriptedMove(new THREE.Vector3(M.psdX - 1.3, 0, z), 0.8);
    else p.scriptedMove(new THREE.Vector3(M.trackX - 0.35, 0.05, z), 0.8);
  }

  private announce(stop: TrainStop, text: string): void {
    const p = this.player?.position;
    if (!p) return;
    const near = Math.abs(p.z - stop.z) < 60 && Math.abs(p.x - M.trackX) < 25;
    if (!near && !this.playerAboard()) return;
    const key = `${stop.id}:${text}`;
    if (key === this.announcedFor) return;
    this.announcedFor = key;
    this.ctx.audio.announce(text);
  }

  private syncDoors(): void {
    const s = this.service;
    this.train.setDoors(s.doors);
    for (const stop of this.stops) this.psd.get(stop.id)!.setOpen(s.phase !== 'running' && s.stop.id === stop.id ? s.doors : 0);
  }

  /**
   * Advances the service and moves the train; carries an aboard player with it. Call before
   * the player update each frame (and also while in the menu, without a player).
   */
  step(dt: number, carryPlayer: boolean): void {
    const aboard = carryPlayer && this.playerAboard();
    this.service.update(dt);
    const dz = this.train.setPosition(this.service.z);
    if (aboard && dz !== 0) this.player!.carry(0, 0, dz);
    this.syncDoors();
    this.hum?.update(M.trackX, 0.5, this.service.z, Math.abs(this.service.v));
    void this.seats;
  }

  update(dt: number, time: number): void {
    this.gameMinutes += dt / 6; // 10 game-minutes per real minute
    for (const [i, b] of this.boats.entries()) {
      b.position.y = 0.32 + Math.sin(time * 1.3 + i) * 0.025;
      b.rotation.z = Math.sin(time * 0.9 + i * 2) * 0.03;
    }
    this.boardTimer -= dt;
    if (this.boardTimer > 0) return;
    this.boardTimer = 0.5;
    const hh = Math.floor(this.gameMinutes / 60) % 24;
    const mm = Math.floor(this.gameMinutes % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    for (const c of this.clocks) c.draw(clock);
    const s = this.service;
    const fmt = (sec: number) => {
      const t = Math.max(0, Math.round(sec));
      return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    };
    for (const { board, stop } of this.boards) {
      const other = this.stops.find((x) => x.id !== stop)!;
      const here = this.stops.find((x) => x.id === stop)!;
      let status: string;
      let highlight = false;
      if (s.phase !== 'running' && s.stop.id === stop) {
        if (s.phase === 'dwell' && s.dwellLeft > 4) {
          status = `Embarque · ${fmt(s.dwellLeft)}`;
          highlight = true;
        } else if (s.phase === 'opening') status = 'Chegando';
        else status = 'Partindo';
      } else {
        const eta = s.eta(stop);
        status = eta < 25 ? 'Aproximando' : `${Math.ceil(eta / 60)} min`;
      }
      board.draw(clock, [
        { dest: other.name, info: `Linha 2 · plataforma 1 · ${here.name}`, status, highlight },
        { dest: 'Cidade das Águas', info: 'Linha 2 · extensão planejada', status: 'Em breve' },
      ]);
    }
  }

  // ---------------------------------------------------------------------------------------
  // AQUA Central
  // ---------------------------------------------------------------------------------------

  private buildCentral(b: WorldBuilder): WaterBody {
    const ctx = this.ctx;
    const m = b.mats;
    const S = M.station;
    const assets = ctx.assets;
    const floorTex = waveFloorTexture(assets);
    floorTex.repeat.set(1 / 14, 1 / 14);
    const floor = new THREE.MeshStandardMaterial({ name: 'metroFloor', map: floorTex, roughness: 0.16, envMapIntensity: 0.9 });
    floor.userData.worldUV = true;
    const tactile = tactileTexture(assets);
    tactile.repeat.set(1.6, 1.6);
    const tactileMat = new THREE.MeshStandardMaterial({ name: 'tactile', map: tactile, roughness: 0.6 });
    tactileMat.userData.worldUV = true;
    const lampGlow = m.frostedGlass.clone();
    lampGlow.name = 'metroLamps';
    const canal = { x0: 52.6, x1: 57.6, z0: -58, z1: -38 };
    const rest = { x0: S.x0, x1: 58, z0: -20, z1: S.z1 };

    // ---- Floor & platform edge ----------------------------------------------------------
    const rect = (x0: number, z0: number, x1: number, z1: number): Array<[number, number]> => [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    b.slab(floor, rect(S.x0, S.z0, M.psdX, S.z1), [rect(canal.x0, canal.z0, canal.x1, canal.z1), rect(rest.x0 + 0.01, rest.z0, rest.x1, rest.z1 - 0.01)], 0.02, 0.1, { cast: false });
    b.box(tactileMat, M.psdX - 0.85, 0.02, (S.z0 + S.z1) / 2, 0.6, 0.006, S.z1 - S.z0, { cast: false });
    // edge slab bridging to the train (over the void, beyond the plateau)
    b.box(m.cobaltCeramic, M.psdX + 0.45, -0.6, (S.z0 + S.z1) / 2, 0.95, 0.6, S.z1 - S.z0, { radius: 0.04 });
    b.collision.addBox({ x: M.psdX + 0.48, z: (S.z0 + S.z1) / 2, sx: 0.96, sz: S.z1 - S.z0, minY: -0.6, maxY: 0, surface: 'tile' });
    this.psd.set('central', new PlatformDoors(b, M.stopCentral, S.z0 + 0.4, S.z1 - 0.4));
    this.trackBed(b, S.z0 - 0.2, S.z1 - 0.2);
    // buffer stop at the south end of the track
    b.box(m.cobaltCeramic, M.trackX, -1.3, S.z1 - 1.0, 2.6, 1.3, 0.6, { radius: 0.2 });
    b.cylinder(m.emissiveCyan, M.trackX - 0.8, 0, S.z1 - 1.35, 0.1, 0.1, 0.05, { rotX: Math.PI / 2, cast: false });

    // ---- Walls -----------------------------------------------------------------------------
    const curtain = (x0: number, z0: number, x1: number, z1: number, gaps: Array<[number, number]> = []) => {
      // straight glass curtain with white mullions, a cobalt sill and optional door gaps (along the wall)
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      let t = 0;
      const pieces: Array<[number, number]> = [];
      for (const [g0, g1] of gaps.sort((a, c) => a[0] - c[0])) {
        if (g0 > t) pieces.push([t, g0]);
        t = g1;
      }
      if (t < len) pieces.push([t, len]);
      const rot = Math.atan2(-uz, ux);
      for (const [a, c] of pieces) {
        const cx = x0 + ux * ((a + c) / 2);
        const cz = z0 + uz * ((a + c) / 2);
        b.box(m.glass, cx, 0.4, cz, c - a, ROOF_Y - 0.4, 0.04, { rotY: rot, cast: false, receive: false });
        b.box(m.cobaltCeramic, cx, 0, cz, c - a, 0.4, 0.3, { rotY: rot, radius: 0.06 });
        b.collision.addSegment(x0 + ux * a, z0 + uz * a, x0 + ux * c, z0 + uz * c, 0.3, 0, ROOF_Y, 'glass');
        const n = Math.max(1, Math.round((c - a) / 2.4));
        for (let i = 0; i <= n; i++) {
          const d = a + ((c - a) * i) / n;
          b.box(m.whiteCeramic, x0 + ux * d, 0.4, z0 + uz * d, 0.14, ROOF_Y - 0.4, 0.2, { rotY: rot, radius: 0.04, cast: false });
        }
        b.box(m.whiteCeramic, cx, 3.4, cz, c - a, 0.1, 0.16, { rotY: rot, cast: false });
      }
    };
    curtain(S.x0, S.z0, S.x0, rest.z0, [[17.8, 20.2]]); // west, with the canal footbridge entrance (z −46.2…−43.8)
    curtain(S.x0, S.z0, M.psdX, S.z0); // north
    // solid restroom block walls (south-west corner) + south facade with the main entrance
    b.box(m.flutedWall, S.x0 - 0.15, 0, (rest.z0 + rest.z1) / 2, 0.3, ROOF_Y, rest.z1 - rest.z0, { collide: 'tile' });
    b.box(m.flutedWall, (S.x0 + 58.2) / 2, 0, S.z1 + 0.15, 58.2 - S.x0, ROOF_Y, 0.3, { collide: 'tile' });
    curtain(63.6, S.z1, M.psdX + 0.2, S.z1);
    b.box(m.cobaltCeramic, 60.9, 3.3, S.z1 + 0.15, 5.6, 0.5, 0.5, { radius: 0.1 });
    b.box(m.flutedWall, 60.9, 3.8, S.z1 + 0.15, 5.6, ROOF_Y - 3.8, 0.3);
    for (const x of [58.0, 63.7]) b.box(m.cobaltCeramic, x, 0, S.z1 + 0.15, 0.4, 3.3, 0.5, { radius: 0.12, collide: 'tile' });

    // ---- Roof with skylights, soffit and lights ------------------------------------------
    const skylights: Array<[number, number, number]> = [
      [55.2, -50, 2.0],
      [55.2, -29, 2.0],
      [M.trackX, -50, 1.7],
      [M.trackX, -27, 1.7],
      [61.0, -15.5, 1.3],
    ];
    const circle = (cx: number, cz: number, r: number): Array<[number, number]> =>
      Array.from({ length: 32 }, (_, i) => [cx + Math.cos((i / 32) * Math.PI * 2) * r, cz + Math.sin((i / 32) * Math.PI * 2) * r] as [number, number]);
    b.slab(m.whiteCeramic, rect(S.x0 - 0.4, S.z0 - 0.4, S.x1 + 0.4, S.z1 + 0.4), skylights.map(([x, z, r]) => circle(x, z, r)), ROOF_Y + 0.45, 0.45);
    for (const [x, z, r] of skylights) {
      b.torus(m.cobaltCeramic, x, ROOF_Y, z, r + 0.05, 0.12, { rotX: Math.PI / 2 });
      b.torus(m.chrome, x, ROOF_Y + 0.45, z, r + 0.05, 0.05, { rotX: Math.PI / 2, cast: false });
      b.cylinder(m.glass, x, ROOF_Y + 0.42, z, r, r, 0.03, { segments: 32, cast: false, receive: false });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + x;
        ctx.veg.vine(x + Math.cos(a) * (r + 0.18), ROOF_Y, z + Math.sin(a) * (r + 0.18), 0.9 + (i % 3) * 0.35);
      }
    }
    // roof edge fascia with a cyan line (outside)
    b.box(m.whiteCeramic, (S.x0 + S.x1) / 2, ROOF_Y + 0.45, S.z0 - 0.45, S.x1 - S.x0 + 0.9, 0.35, 0.12, { cast: false });
    b.box(m.glossyCyan, S.x1 + 0.42, ROOF_Y + 0.5, (S.z0 + S.z1) / 2, 0.06, 0.12, S.z1 - S.z0 + 0.8, { cast: false });
    // cobalt soffit over the platform edge (reference: blue ceiling band) with downlights
    b.box(m.cobaltCeramic, M.psdX - 0.2, ROOF_Y - 0.75, (S.z0 + S.z1) / 2, 1.3, 0.75, S.z1 - S.z0, { radius: 0.2 });
    for (let z = S.z0 + 2; z < S.z1 - 1; z += 3.2) b.cylinder(m.emissiveWarm, M.psdX - 0.2, ROOF_Y - 0.77, z, 0.13, 0.13, 0.02, { cast: false, segments: 16 });
    for (let z = S.z0 + 3; z < S.z1; z += 6) for (const x of [54.5, 59]) b.cylinder(m.emissiveWarm, x, ROOF_Y - 0.02, z, 0.16, 0.16, 0.02, { cast: false, segments: 16 });
    // station name on the soffit, facing the platform
    const nameTex = metroSign(ctx.assets, 'central-name', { title: 'AQUA Central', titleEn: 'Linha 2 · Line 2', icon: 'train' });
    this.signPlane(nameTex, M.psdX - 0.86, ROOF_Y - 0.4, -47, -Math.PI / 2, 2.4);
    this.signPlane(nameTex, M.psdX - 0.86, ROOF_Y - 0.4, -27, -Math.PI / 2, 2.4);
    // tree columns
    for (const z of [-55, -40, -23]) treeColumn(b, 59.6, z, ROOF_Y, 2.6);
    // roof supports on the viaduct side
    for (let z = S.z0 + 4; z < S.z1; z += 13) b.cylinder(m.chrome, S.x1 - 0.3, -1.3, z, 0.12, 0.16, ROOF_Y + 1.3, { segments: 16 });

    // ---- Canal with planted islands, lilies, boats and a footbridge ------------------------
    const rim = 0.45;
    for (const [x, z, w, d] of [
      [(canal.x0 + canal.x1) / 2, canal.z0 - 0.15, canal.x1 - canal.x0 + 0.6, 0.3],
      [(canal.x0 + canal.x1) / 2, canal.z1 + 0.15, canal.x1 - canal.x0 + 0.6, 0.3],
      [canal.x0 - 0.15, -51.7, 0.3, 12.6],
      [canal.x0 - 0.15, -40.7, 0.3, 5.4],
      [canal.x1 + 0.15, -51.7, 0.3, 12.6],
      [canal.x1 + 0.15, -40.7, 0.3, 5.4],
    ] as Array<[number, number, number, number]>) {
      b.box(m.whiteCeramic, x, 0, z, w, rim, d, { collide: 'stone', radius: 0.08 });
    }
    b.box(m.poolTileAt(0.32, { value: 0.45 }, 'metroCanal', 'cobalt'), (canal.x0 + canal.x1) / 2, -0.05, (canal.z0 + canal.z1) / 2, canal.x1 - canal.x0, 0.08, canal.z1 - canal.z0, { cast: false });
    const water = ctx.water.add({
      name: 'metroCanal',
      shape: { kind: 'rect', x: (canal.x0 + canal.x1) / 2, z: (canal.z0 + canal.z1) / 2, hx: (canal.x1 - canal.x0) / 2, hz: (canal.z1 - canal.z0) / 2 },
      surfaceY: 0.32,
      look: WATER_LOOKS.pool,
      segments: 40,
      flow: new THREE.Vector2(0, 0.06),
    });
    for (const [x, z, len] of [
      [55.1, -53.2, 3.0],
      [55.1, -40.4, 2.0],
    ] as Array<[number, number, number]>) {
      b.box(m.whiteCeramic, x, 0, z, 1.5, 0.55, len, { radius: 0.35, collide: 'stone' });
      b.box(m.soil, x, 0.52, z, 1.2, 0.05, len - 0.3, { radius: 0.15, cast: false });
      ctx.veg.palm(x, 0.55, z, 0.62);
      ctx.veg.fern(x, 0.55, z - len * 0.3, 0.7);
      ctx.veg.fern(x, 0.55, z + len * 0.3, 0.65);
    }
    lilyPads(b, (canal.x0 + canal.x1) / 2, -48.5, 0.3, 1.9, 0.33, 9, 3);
    for (const [x, z, rot] of [
      [53.7, -48.5, 0.4],
      [56.4, -56.0, -0.3],
    ] as Array<[number, number, number]>) this.boats.push(this.boat(b, x, z, rot));
    // footbridge over the canal from the west entrance
    b.box(m.whiteCeramic, (S.x0 + canal.x1 + 0.4) / 2, 0, -44.2, canal.x1 + 0.4 - S.x0, 0.48, 2.4, { radius: 0.06, collide: 'tile' });
    b.glassRailing([[canal.x0 - 0.3, -45.35], [canal.x1 + 0.3, -45.35]], 0.48, 1.0);
    b.glassRailing([[canal.x0 - 0.3, -43.05], [canal.x1 + 0.3, -43.05]], 0.48, 1.0);
    ctx.audio.addWaterSource('stream', { x: 55, y: 0.5, z: -48 }, 0.4, true);

    // ---- Seating: benches by the water, pods by the platform -------------------------------
    for (const z of [-53, -39.6]) {
      for (const sp of bench(b, 58.35, z, -1, 0, 2.6, m.fabricCyan)) ctx.addSeat({ id: `metro-bench-${z}-${sp.z.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(-1, 0) });
    }
    for (const [z, shell] of [
      [-50.5, m.cobaltCeramic],
      [-48.7, m.limeGlossy],
      [-31.5, m.cobaltCeramic],
      [-29.7, m.cobaltCeramic],
    ] as Array<[number, THREE.Material]>) {
      eggChair(b, 61.4, z, Math.PI / 2, shell, m.fabricCyan);
      ctx.addSeat({ id: `metro-pod-${z}`, x: 61.45, y: 0.46, z, yaw: yawFacing(1, 0) });
    }
    for (const [x, z] of [
      [61.4, -44.5],
      [61.4, -35],
      [58.6, -14],
    ] as Array<[number, number]>) {
      const top = planterBowl(b, x, z, 0.55, m.limeGlossy, m.cobaltCeramic);
      ctx.veg.fern(x, top, z, 0.85);
    }

    // ---- Mezzanine over the restroom, reached by a straight stair -----------------------------
    const mz = { x0: S.x0, x1: 58.6, z0: -31, z1: S.z1, y: 3.6 };
    b.box(m.whiteCeramic, (mz.x0 + mz.x1) / 2, mz.y - 0.3, (mz.z0 + mz.z1) / 2, mz.x1 - mz.x0, 0.3, mz.z1 - mz.z0, { collide: 'tile' });
    b.box(floor, (mz.x0 + mz.x1) / 2, mz.y - 0.01, (mz.z0 + mz.z1) / 2, mz.x1 - mz.x0 - 0.05, 0.02, mz.z1 - mz.z0 - 0.05, { cast: false });
    b.box(m.cobaltCeramic, mz.x1 + 0.02, mz.y - 0.45, (mz.z0 + mz.z1) / 2, 0.12, 0.5, mz.z1 - mz.z0, { radius: 0.04 });
    b.box(m.cobaltCeramic, (mz.x0 + mz.x1) / 2 + 0.75, mz.y - 0.45, mz.z0 - 0.02, mz.x1 - mz.x0 - 1.5, 0.5, 0.12, { radius: 0.04 });
    b.box(m.emissiveCyan, mz.x1 - 0.1, mz.y - 0.33, (mz.z0 + mz.z1) / 2, 0.04, 0.03, mz.z1 - mz.z0, { cast: false, receive: false });
    for (const [x, z] of [
      [58.3, -30.6],
      [58.3, -20.6],
    ] as Array<[number, number]>) b.cylinder(m.chrome, x, 0, z, 0.1, 0.12, mz.y - 0.3, { collide: 'metal', segments: 14 });
    // stair along the mezzanine's north edge, climbing westwards
    straightStair(b, { x0: 58.4, z0: -32.15, dirX: -1, dirZ: 0, width: 2.3, rise: mz.y, run: 6.0, rails: [-1] });
    b.box(m.whiteCeramic, (mz.x0 + 52.4) / 2, 0, -32.15, 52.4 - mz.x0, mz.y, 2.3, { collide: 'tile' });
    b.glassRailing([[mz.x0, -33.3], [52.4, -33.3]], mz.y, 1.0);
    b.glassRailing([[53.2, mz.z0], [mz.x1, mz.z0], [mz.x1, mz.z1 - 0.1]], mz.y, 1.05);
    // observation lounge on the mezzanine, facing the platform
    for (const z of [-28.2, -24.8, -21.4]) {
      eggChair(b, 57.3, z, Math.PI / 2, z === -24.8 ? m.limeGlossy : m.cobaltCeramic, m.fabricCyan);
      ctx.addSeat({ id: `metro-mezz-${z}`, x: 57.35, y: mz.y + 0.46, z, yaw: yawFacing(1, 0) });
    }
    for (const sp of bench(b, 52.2, -17.0, 1, 0, 3.2, m.fabricCobalt, true, mz.y)) ctx.addSeat({ id: `metro-mezz-bench-${sp.z.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(1, 0) });

    // ---- Services under the mezzanine: vending machines, map ------------------------------
    for (const [z, i] of [
      [-28.4, 0],
      [-26.6, 1],
    ] as Array<[number, number]>) {
      const vm = new VendingMachine(ctx, `metro-vending-${i}`, S.x0 + 0.55, z, -Math.PI / 2 + Math.PI);
      ctx.addInteractable(vm);
      ctx.addModal(vm);
      ctx.addUpdatable(vm);
    }
    this.mapTotem(b, 60.6, -14.6, Math.PI, 'central');
    this.mapTotem(b, 53.4, -42.4, Math.PI / 2, 'central');

    // ---- Hanging signs, boards, clock --------------------------------------------------------
    const signs: Array<[number, number, number, MetroSignOptions, string]> = [
      [62.4, -52, 0, { arrow: '↓', line: true, title: 'Parque Flutuante', titleEn: 'Floating Park', footer: 'Próxima: Parque Flutuante', icon: 'train' }, 'plat-n'],
      [62.4, -22.5, Math.PI, { arrow: '↓', line: true, title: 'Parque Flutuante', titleEn: 'Floating Park', footer: 'Próxima: Parque Flutuante', icon: 'train' }, 'plat-s'],
      [60.9, -13.0, Math.PI, { arrow: '↑', title: 'Plataforma 1', titleEn: 'Platform 1 · Linha 2', footer: 'Saída · Exit', footerRight: 'Galeria →', icon: 'train' }, 'entry-s'],
      [56.4, -44.2, -Math.PI / 2, { arrow: '→', title: 'Plataforma 1', titleEn: 'Platform 1 · Linha 2', icon: 'train' }, 'entry-w'],
      [56.4, -20.6, Math.PI, { arrow: '↓', title: 'Sanitários', titleEn: 'Restrooms', icon: 'wc' }, 'wc'],
      [59.4, -33.6, 0, { arrow: '←', title: 'Mezanino', titleEn: 'Mezzanine · lounge', footer: 'Saída · Exit', footerRight: 'Jardins ↑', icon: 'exit' }, 'mezz'],
    ];
    for (const [x, z, rot, o, key] of signs) {
      const tex = metroSign(ctx.assets, key, o);
      this.hangingSign(b, x, z, rot, tex, o.footer ? 3.1 : 3.3);
    }
    for (const z of [-46, -30]) {
      const board = new DepartureBoard(ctx.assets, `central-${z}`);
      this.boards.push({ board, stop: 'central' });
      this.hangingBoard(b, 62.6, z, board.texture);
    }
    const clock = new DigitalClock(ctx.assets, 'central');
    this.clocks.push(clock);
    this.hangingBoard(b, 62.6, -38, clock.texture, 1.2, 0.45, 3.6);
    // teardrop lamps over the seating
    for (const [x, z, y] of [
      [58.2, -53, 4.3],
      [58.2, -39.6, 4.6],
      [61.4, -49.6, 4.0],
      [61.4, -30.6, 4.2],
      [55.2, -46.4, 5.0],
      [55.2, -33.5, 5.2],
    ] as Array<[number, number, number]>) teardropLamp(b, x, y, z, ROOF_Y, lampGlow, 0.3);

    // ---- Restroom block (under the mezzanine) ---------------------------------------------------
    buildRestroom(ctx, b, { x0: rest.x0, x1: rest.x1, z0: rest.z0, z1: rest.z1, ceiling: mz.y - 0.3 });

    // ---- Exterior: entrance pylons and approach paving --------------------------------------------
    this.pylon(b, 55.6, -8.4, Math.PI);
    this.pylon(b, 48.6, -44.2, -Math.PI / 2);
    b.box(m.paving, 60.8, -0.08, -9.8, 6.4, 0.1, 4.4, { cast: false });
    b.box(m.paving, 49.4, -0.08, -44.2, 4.2, 0.1, 3.2, { cast: false });
    ctx.audio.addWaterSource('hum', { x: 58, y: 3, z: -38 }, 0.35, true);
    return water;
  }

  private trackBed(b: WorldBuilder, z0: number, z1: number): void {
    const m = b.mats;
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    b.box(m.lightGrey, M.trackX, -2.3, mid, 4.8, 1.0, len, { cast: false });
    for (const rx of [-0.72, 0.72]) b.box(m.brushedMetal, M.trackX + rx, -1.3, mid, 0.08, 0.25, len, { cast: false });
    const sleepers = Math.floor(len / 0.9);
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < sleepers; i++) parts.push(new THREE.BoxGeometry(2.4, 0.12, 0.26).translate(M.trackX, -1.36, z0 + (i + 0.5) * (len / sleepers)));
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    b.place(merged, m.rubber, 0, 0, 0, { cast: false });
    merged.dispose();
    // guidance light strip along the track
    b.box(this.ctx.mats.emissiveCyan, M.trackX - 2.3, -1.32, mid, 0.05, 0.04, len, { cast: false, receive: false });
  }

  private boat(b: WorldBuilder, x: number, z: number, rot: number): THREE.Object3D {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.LatheGeometry(
        [new THREE.Vector2(0.001, -0.18), new THREE.Vector2(0.45, -0.15), new THREE.Vector2(0.62, 0.0), new THREE.Vector2(0.64, 0.08), new THREE.Vector2(0.58, 0.1)],
        28,
      ),
      b.mats.whiteCeramic,
    );
    hull.scale.set(1, 1, 1.9);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 40), b.mats.glossyCyan);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 1.9, 1);
    band.position.y = 0.05;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.3), b.mats.cobaltCeramic);
    seat.position.y = 0.05;
    g.add(hull, band, seat);
    g.position.set(x, 0.32, z);
    g.rotation.y = rot;
    b.root.add(g);
    return g;
  }

  private signPlane(tex: THREE.Texture, x: number, y: number, z: number, rotY: number, w: number): void {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * 3) / 8), mat);
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    p.renderOrder = 8;
    this.ctx.builder.root.add(p);
  }

  /** Double-sided hanging sign (reference style) on chrome rods. */
  private hangingSign(b: WorldBuilder, x: number, z: number, rotY: number, tex: THREE.Texture, y: number): void {
    const w = 2.4;
    const h = (w * 3) / 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x + Math.sin(rotY + side) * 0.035, y + h / 2, z + Math.cos(rotY + side) * 0.035);
      p.rotation.y = rotY + side;
      p.renderOrder = 8;
      b.root.add(p);
    }
    b.box(b.mats.cobaltDeep, x, y + 0.04, z, w - 0.35, h - 0.08, 0.05, { rotY, radius: 0.02, cast: false });
    for (const e of [-0.8, 0.8]) {
      const cx = x + Math.cos(rotY) * e;
      const cz = z - Math.sin(rotY) * e;
      b.cylinder(b.mats.chrome, cx, y + h, cz, 0.015, 0.015, ROOF_Y - y - h, { segments: 6, cast: false });
    }
  }

  private hangingBoard(b: WorldBuilder, x: number, z: number, tex: THREE.Texture, w = 2.2, aspect = 3 / 8, y = 3.2): void {
    const h = w * aspect;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x, y + h / 2, z + Math.cos(side) * 0.07);
      p.rotation.y = side;
      b.root.add(p);
    }
    b.box(b.mats.whiteCeramic, x, y - 0.05, z, w + 0.14, h + 0.1, 0.12, { radius: 0.05, cast: false });
    b.cylinder(b.mats.chrome, x, y + h, z, 0.02, 0.02, ROOF_Y - y - h, { segments: 6, cast: false });
  }

  private mapTotem(b: WorldBuilder, x: number, z: number, rotY: number, here: 'central' | 'park'): void {
    const m = b.mats;
    b.box(m.whiteCeramic, x, 0, z, 1.25, 2.2, 0.24, { rotY, radius: 0.1, collide: 'tile' });
    b.box(m.cobaltCeramic, x, 2.05, z, 1.31, 0.26, 0.28, { rotY, radius: 0.08 });
    const tex = networkMap(this.ctx.assets, here);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), mat);
      p.position.set(x + Math.sin(rotY + side) * 0.125, 1.35, z + Math.cos(rotY + side) * 0.125);
      p.rotation.y = rotY + side;
      b.root.add(p);
    }
  }

  /** Tall exterior pylon announcing the station (seen from the lawns). */
  private pylon(b: WorldBuilder, x: number, z: number, rotY: number): void {
    const m = b.mats;
    b.box(m.cobaltCeramic, x, 0, z, 1.0, 4.6, 0.5, { rotY, radius: 0.22, collide: 'metal' });
    b.box(m.cyanAcrylic, x, 4.5, z, 0.8, 0.12, 0.4, { rotY, radius: 0.05, cast: false });
    const tex = metroSign(this.ctx.assets, `pylon-${x}`, { title: 'Aqua Metro', titleEn: 'Linha 2', icon: 'train' });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), mat);
      p.position.set(x + Math.sin(rotY + side) * 0.27, 3.5, z + Math.cos(rotY + side) * 0.27);
      p.rotation.y = rotY + side;
      b.root.add(p);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Viaduct
  // ---------------------------------------------------------------------------------------

  private buildViaduct(b: WorldBuilder): void {
    const m = b.mats;
    const z0 = M.island.z1;
    const z1 = M.station.z0;
    this.trackBed(b, z0 - 0.2, z1 + 0.2);
    const len = z1 - z0;
    const mid = (z0 + z1) / 2;
    b.box(m.whiteCeramic, M.trackX, -3.4, mid, 5.4, 1.1, len, { cast: false });
    b.box(m.cobaltCeramic, M.trackX + 2.72, -3.2, mid, 0.06, 0.4, len, { cast: false });
    b.box(m.cobaltCeramic, M.trackX - 2.72, -3.2, mid, 0.06, 0.4, len, { cast: false });
    for (const side of [-1, 1]) b.box(m.glass, M.trackX + side * 2.55, -1.3, mid, 0.04, 1.0, len, { cast: false, receive: false });
    const pier = new THREE.LatheGeometry(
      [new THREE.Vector2(0.001, 0), new THREE.Vector2(1.6, 0), new THREE.Vector2(1.1, 1.2), new THREE.Vector2(0.9, 20), new THREE.Vector2(1.4, 27.5), new THREE.Vector2(2.4, 29.6), new THREE.Vector2(0.001, 29.6)],
      28,
    );
    for (let z = z1 - 20; z > z0 + 5; z -= 32) b.place(pier, m.whiteCeramic, M.trackX, -33.5, z, { cast: false });
    // piers under the station and island decks too
    for (const z of [-58, -44, -30, -16]) b.place(pier, m.whiteCeramic, M.trackX, -33.5, z, { cast: false });
    pier.dispose();
  }

  // ---------------------------------------------------------------------------------------
  // Parque Flutuante (island terminus)
  // ---------------------------------------------------------------------------------------

  private buildPark(b: WorldBuilder): void {
    const ctx = this.ctx;
    const m = b.mats;
    const I = M.island;
    const outline = roundedRect(I.x0, I.z0, I.x1, I.z1, 6);
    ctx.collision.terrain.islands.push(outline);
    // land, cliff and paving
    b.slab(m.lawn, outline, [], 0, 0.6, { cast: false });
    const cliff = new THREE.ExtrudeGeometry(new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: 33, steps: 4, bevelEnabled: false });
    cliff.rotateX(-Math.PI / 2);
    cliff.translate(0, -33.1, 0);
    b.place(cliff, m.cliff, 0, 0, 0, { cast: false });
    cliff.dispose();
    const floorTex = waveFloorTexture(ctx.assets);
    const floor = new THREE.MeshStandardMaterial({ name: 'parkFloor', map: floorTex, roughness: 0.2 });
    floor.userData.worldUV = true;
    floorTex.repeat.set(1 / 14, 1 / 14);
    b.box(floor, 61.5, -0.08, (I.z0 + I.z1) / 2, 5, 0.1, I.z1 - I.z0 - 4, { cast: false });
    b.box(m.paving, 53, -0.08, -398.5, 20, 0.1, 3.6, { cast: false });
    // platform edge, doors, track
    const pz0 = I.z0 + 2;
    const pz1 = I.z1 - 2;
    b.box(m.cobaltCeramic, M.psdX + 0.45, -0.6, (pz0 + pz1) / 2, 0.95, 0.6, pz1 - pz0, { radius: 0.04 });
    b.collision.addBox({ x: M.psdX + 0.48, z: (pz0 + pz1) / 2, sx: 0.96, sz: pz1 - pz0, minY: -0.6, maxY: 0, surface: 'tile' });
    const tactile = tactileTexture(ctx.assets);
    const tm = new THREE.MeshStandardMaterial({ name: 'tactilePark', map: tactile, roughness: 0.6 });
    tm.userData.worldUV = true;
    tactile.repeat.set(1.6, 1.6);
    b.box(tm, M.psdX - 0.85, 0.02, (pz0 + pz1) / 2, 0.6, 0.006, pz1 - pz0, { cast: false });
    this.psd.set('park', new PlatformDoors(b, M.stopPark, pz0, pz1));
    this.trackBed(b, I.z0 - 1, I.z1 + 0.2);
    b.box(m.cobaltCeramic, M.trackX, -1.3, I.z0 + 1.0, 2.6, 1.3, 0.6, { radius: 0.2 });
    for (let z = I.z1 - 10; z > I.z0; z -= 22) {
      const pier = new THREE.CylinderGeometry(1.0, 1.4, 31, 20);
      b.place(pier, m.whiteCeramic, M.trackX, -18.4, z, { cast: false });
      pier.dispose();
    }
    // canopy: roof slab with an oculus on two tree columns
    const roofY = 6.0;
    const rect: Array<[number, number]> = [
      [58.2, pz0],
      [69.4, pz0],
      [69.4, pz1],
      [58.2, pz1],
    ];
    const oc = (cx: number, cz: number, r: number): Array<[number, number]> =>
      Array.from({ length: 28 }, (_, i) => [cx + Math.cos((i / 28) * Math.PI * 2) * r, cz + Math.sin((i / 28) * Math.PI * 2) * r] as [number, number]);
    b.slab(m.whiteCeramic, rect, [oc(62.5, -422, 1.8)], roofY + 0.4, 0.4);
    b.torus(m.cobaltCeramic, 62.5, roofY, -422, 1.85, 0.12, { rotX: Math.PI / 2 });
    for (let i = 0; i < 7; i++) ctx.veg.vine(62.5 + Math.cos(i) * 2.0, roofY, -422 + Math.sin(i) * 2.0, 1.1);
    for (const z of [-436, -408]) treeColumn(b, 60.6, z, roofY, 2.4);
    b.box(m.cobaltCeramic, M.psdX - 0.2, roofY - 0.7, (pz0 + pz1) / 2, 1.3, 0.7, pz1 - pz0, { radius: 0.2 });
    for (let z = pz0 + 2; z < pz1 - 1; z += 3.2) b.cylinder(m.emissiveWarm, M.psdX - 0.2, roofY - 0.72, z, 0.13, 0.13, 0.02, { cast: false, segments: 16 });
    for (let z = pz0 + 4; z < pz1; z += 12) b.cylinder(m.chrome, 69.1, -1.3, z, 0.12, 0.15, roofY + 1.3, { segments: 14 });
    const nameTex = metroSign(ctx.assets, 'park-name', { title: 'Parque Flutuante', titleEn: 'Floating Park · Linha 2', icon: 'train' });
    this.signPlane(nameTex, M.psdX - 0.86, roofY - 0.35, -430, -Math.PI / 2, 2.4);
    this.signPlane(nameTex, M.psdX - 0.86, roofY - 0.35, -414, -Math.PI / 2, 2.4);
    const board = new DepartureBoard(ctx.assets, 'park');
    this.boards.push({ board, stop: 'park' });
    this.hangingBoardAt(b, 62.6, -422, board.texture, roofY);
    this.mapTotem(b, 58.8, -400.5, Math.PI, 'park');
    // end of the line: the viaduct visibly continues, but the extension is not open
    const endTex = metroSign(ctx.assets, 'park-end', { arrow: '↓', title: 'Fim da linha', titleEn: 'End of line · Linha 2', footer: 'Extensão p/ Cidade das Águas: em obras', icon: 'train' });
    this.hangingSignAt(b, 62.4, I.z0 + 3.2, 0, endTex, 3.0, roofY);
    const exitTex = metroSign(ctx.assets, 'park-exit', { arrow: '←', title: 'Jardim da Ilha', titleEn: 'Island Garden · Mirante', icon: 'exit' });
    this.hangingSignAt(b, 59.4, -426, -Math.PI / 2, exitTex, 3.0, roofY);
    for (const z of [-440, -404]) {
      for (const sp of bench(b, 59.2, z, 1, 0, 2.6, m.fabricCyan)) ctx.addSeat({ id: `park-bench-${z}-${sp.z.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(1, 0) });
    }
    const vm = new VendingMachine(ctx, 'park-vending', 58.6, -416.5, -Math.PI / 2);
    ctx.addInteractable(vm);
    ctx.addModal(vm);
    ctx.addUpdatable(vm);

    // garden: pond with planted islands, palms, benches facing the view home
    const pond = { x: 50, z: -423, hx: 4.2, hz: 9 };
    for (const [x, z, w, d] of [
      [pond.x, pond.z - pond.hz - 0.15, pond.hx * 2 + 0.6, 0.3],
      [pond.x, pond.z + pond.hz + 0.15, pond.hx * 2 + 0.6, 0.3],
      [pond.x - pond.hx - 0.15, pond.z, 0.3, pond.hz * 2],
      [pond.x + pond.hx + 0.15, pond.z, 0.3, pond.hz * 2],
    ] as Array<[number, number, number, number]>) b.box(m.whiteCeramic, x, 0, z, w, 0.45, d, { collide: 'stone', radius: 0.08 });
    b.box(m.poolTileAt(0.32, { value: 0.5 }, 'parkPond', 'cobalt'), pond.x, -0.05, pond.z, pond.hx * 2, 0.08, pond.hz * 2, { cast: false });
    ctx.water.add({ name: 'parkPond', shape: { kind: 'rect', x: pond.x, z: pond.z, hx: pond.hx, hz: pond.hz }, surfaceY: 0.32, look: WATER_LOOKS.pool, segments: 24 });
    for (const [x, z] of [
      [49, -427],
      [51.4, -418],
    ] as Array<[number, number]>) {
      b.cylinder(m.whiteCeramic, x, 0, z, 1.0, 1.1, 0.55, { collide: 'stone', segments: 32 });
      b.cylinder(m.soil, x, 0.52, z, 0.9, 0.9, 0.05, { cast: false, segments: 24 });
      ctx.veg.palm(x, 0.55, z, 0.7);
      ctx.veg.fern(x + 0.4, 0.55, z + 0.3, 0.7);
    }
    lilyPads(b, pond.x, pond.z, 0.6, 3.4, 0.33, 12, 11);
    ctx.audio.addWaterSource('fountain', { x: pond.x, y: 0.6, z: pond.z }, 0.35, true);
    const rng = createRng(4242);
    for (let i = 0; i < 14; i++) {
      const x = randRange(rng, I.x0 + 2.5, 56);
      const z = randRange(rng, I.z0 + 3, I.z1 - 3);
      if (Math.abs(x - pond.x) < pond.hx + 1.6 && Math.abs(z - pond.z) < pond.hz + 1.6) continue;
      ctx.veg.palm(x, 0, z, randRange(rng, 0.8, 1.1));
      ctx.veg.bush(x + 1.1, 0, z - 0.6, 0.7);
    }
    ctx.veg.grass(I.x0 + 1, I.z0 + 1, 57, I.z1 - 1, 520, 0, (x, z) => !(Math.abs(x - pond.x) < pond.hx + 0.8 && Math.abs(z - pond.z) < pond.hz + 0.8) && Terrain_inside(outline, x, z));
    ctx.veg.flowers(I.x0 + 1, I.z0 + 1, 57, I.z1 - 1, 140, 0, (x, z) => !(Math.abs(x - pond.x) < pond.hx + 0.8 && Math.abs(z - pond.z) < pond.hz + 0.8) && Terrain_inside(outline, x, z));
    // viewpoint looking back at the complex
    for (const sp of bench(b, 50, -396.6, 0, 1, 3.0, m.fabricCobalt)) ctx.addSeat({ id: `park-view-${sp.x.toFixed(2)}`, x: sp.x, y: sp.y, z: sp.z, yaw: yawFacing(0, 1) });
    // island balustrade (east edge is the platform: doors instead of railings)
    const inset = roundedRect(I.x0 + 0.6, I.z0 + 0.6, I.x1 - 0.2, I.z1 - 0.6, 5.4);
    const keep: Array<Array<[number, number]>> = [];
    let cur: Array<[number, number]> = [];
    for (let i = 0; i <= inset.length; i++) {
      const p = inset[i % inset.length];
      const onPlatform = p[0] > M.psdX - 1 && p[1] > pz0 - 0.5 && p[1] < pz1 + 0.5;
      if (onPlatform) {
        if (cur.length > 1) keep.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 1) keep.push(cur);
    for (const line of keep) b.glassRailing(line, 0, 1.1);
  }

  private hangingBoardAt(b: WorldBuilder, x: number, z: number, tex: THREE.Texture, roofY: number): void {
    const w = 2.2;
    const h = (w * 3) / 8;
    const y = roofY - 2.6;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x, y + h / 2, z + Math.cos(side) * 0.07);
      p.rotation.y = side;
      b.root.add(p);
    }
    b.box(b.mats.whiteCeramic, x, y - 0.05, z, w + 0.14, h + 0.1, 0.12, { radius: 0.05, cast: false });
    b.cylinder(b.mats.chrome, x, y + h, z, 0.02, 0.02, roofY - y - h, { segments: 6, cast: false });
  }

  private hangingSignAt(b: WorldBuilder, x: number, z: number, rotY: number, tex: THREE.Texture, y: number, roofY: number): void {
    const w = 2.4;
    const h = (w * 3) / 8;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    for (const side of [0, Math.PI]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      p.position.set(x + Math.sin(rotY + side) * 0.035, y + h / 2, z + Math.cos(rotY + side) * 0.035);
      p.rotation.y = rotY + side;
      p.renderOrder = 8;
      b.root.add(p);
    }
    b.cylinder(b.mats.chrome, x, y + h, z, 0.015, 0.015, roofY - y - h, { segments: 6, cast: false });
  }

}

function roundedRect(x0: number, z0: number, x1: number, z1: number, r: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [x1 - r, z1 - r, 0],
    [x0 + r, z1 - r, Math.PI / 2],
    [x0 + r, z0 + r, Math.PI],
    [x1 - r, z0 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= 6; i++) {
    const a = a0 + (i / 6) * (Math.PI / 2);
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

function Terrain_inside(poly: Array<[number, number]>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
