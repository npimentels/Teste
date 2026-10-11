import * as THREE from 'three';
import type { Interactable } from './Interactables';
import { raySphere } from './Interactables';
import type { PlayerController } from '../player/PlayerController';
import type { InteractionModal } from '../player/InteractionSystem';
import type { ControlInput, SeatPose } from '../player/PlayerController';

/**
 * Reusable sit / stand system. Any bench, sofa, chair or train seat registers a `Seat`
 * (position of the seat surface + the direction it faces); there is no per-bench code.
 */
export interface SeatSpec {
  id: string;
  /** Seat surface centre (local to `parent` when given, otherwise world). */
  x: number;
  y: number;
  z: number;
  /** Direction the sitter faces, as a camera yaw (0 = looking towards −Z). */
  yaw: number;
  /** Optional moving parent (e.g. a train car). */
  parent?: THREE.Object3D;
  /** HUD verb (default "Sentar"), e.g. "Deitar", "Sentar na cama". */
  label?: string;
  /** Eye height above the surface (default 0.8 sitting; ~0.32 lying with the head on a pillow). */
  eyeHeight?: number;
  /** How far behind the surface centre the eye sits, along the facing direction (default 0.12). */
  back?: number;
  /** Initial pitch and look limits (lying: look up towards the ceiling…). */
  pose?: SeatPose;
  /** Aim radius of the seat (default 0.5). */
  hitRadius?: number;
  /** Interaction reach (default 2.4; beds are bigger). */
  reach?: number;
}

/** Converts a facing direction (dx, dz) into the camera yaw convention. */
export const yawFacing = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

const tmp = new THREE.Vector3();

export class Seat implements Interactable {
  readonly kind = 'use' as const;
  readonly reach: number;
  readonly id: string;
  readonly position = new THREE.Vector3();
  private readonly local: THREE.Vector3;
  readonly yaw: number;
  occupied = false;

  constructor(
    private readonly spec: SeatSpec,
    private readonly controller: SeatController,
  ) {
    this.id = spec.id;
    this.reach = spec.reach ?? 2.4;
    this.local = new THREE.Vector3(spec.x, spec.y, spec.z);
    this.yaw = spec.yaw;
    this.refresh();
  }

  /** World position of the seat surface. */
  refresh(): THREE.Vector3 {
    this.position.copy(this.local);
    if (this.spec.parent) this.spec.parent.localToWorld(this.position);
    return this.position;
  }

  /** Where the eyes go when seated: above the surface, slightly back from its front edge. */
  eye(out: THREE.Vector3): THREE.Vector3 {
    this.refresh();
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const back = this.spec.back ?? 0.12;
    return out.set(this.position.x - fx * back, this.position.y + (this.spec.eyeHeight ?? 0.8), this.position.z - fz * back);
  }

  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (this.occupied || this.controller.current) return -1;
    this.refresh();
    tmp.copy(this.position);
    tmp.y += 0.15;
    return raySphere(origin, dir, tmp, this.spec.hitRadius ?? 0.5);
  }

  prompt(): string {
    return this.spec.label ?? 'Sentar';
  }

  get lying(): boolean {
    return (this.spec.eyeHeight ?? 0.8) < 0.5;
  }

  get pose(): SeatPose | undefined {
    return this.spec.pose;
  }

  interact(): void {
    this.controller.sit(this);
  }
}

/** Owns the seated state and acts as the interaction modal while seated. */
export class SeatController implements InteractionModal {
  current: Seat | null = null;
  readonly seats: Seat[] = [];
  private readonly eyeTmp = new THREE.Vector3();
  onSit?: (seat: Seat) => void;
  onStand?: (seat: Seat) => void;

  constructor(private readonly player: PlayerController) {}

  add(spec: SeatSpec): Seat {
    const s = new Seat(spec, this);
    this.seats.push(s);
    return s;
  }

  sit(seat: Seat): void {
    if (this.current) return;
    // Only sit when the body is close enough (no sitting through walls / across rooms).
    const p = this.player.position;
    seat.refresh();
    if (Math.hypot(p.x - seat.position.x, p.z - seat.position.z) > Math.max(2.6, seat.reach + 0.3)) return;
    this.current = seat;
    seat.occupied = true;
    this.player.sit(seat.eye(this.eyeTmp), seat.yaw, seat.pose);
    this.onSit?.(seat);
  }

  stand(): void {
    const seat = this.current;
    if (!seat) return;
    seat.occupied = false;
    this.current = null;
    this.player.stand();
    this.onStand?.(seat);
  }

  // ---- InteractionModal ----------------------------------------------------------------
  get active(): boolean {
    return this.current !== null;
  }

  prompt(): string {
    return 'Levantar';
  }

  hint(): string {
    const what = this.current?.lying ? 'Deitado' : 'Sentado';
    return `${what} · mova o <kbd>mouse</kbd> para observar · <kbd>E</kbd> ou <kbd>Espaço</kbd> para levantar`;
  }

  cancel(): void {
    this.stand();
  }

  update(input: ControlInput & { wasPressed(code: string): boolean }): void {
    if (input.wasPressed('KeyE') || input.wasPressed('Space')) this.stand();
  }
}
