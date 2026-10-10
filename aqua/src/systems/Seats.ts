import * as THREE from 'three';
import type { Interactable } from './Interactables';
import { raySphere } from './Interactables';
import type { PlayerController } from '../player/PlayerController';
import type { InteractionModal } from '../player/InteractionSystem';
import type { ControlInput } from '../player/PlayerController';

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
}

/** Converts a facing direction (dx, dz) into the camera yaw convention. */
export const yawFacing = (dx: number, dz: number): number => Math.atan2(-dx, -dz);

const tmp = new THREE.Vector3();

export class Seat implements Interactable {
  readonly kind = 'use' as const;
  readonly reach = 2.4;
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
    return out.set(this.position.x - fx * 0.12, this.position.y + 0.8, this.position.z - fz * 0.12);
  }

  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (this.occupied || this.controller.current) return -1;
    this.refresh();
    tmp.copy(this.position);
    tmp.y += 0.15;
    return raySphere(origin, dir, tmp, 0.5);
  }

  prompt(): string {
    return 'Sentar';
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
    if (Math.hypot(p.x - seat.position.x, p.z - seat.position.z) > 2.6) return;
    this.current = seat;
    seat.occupied = true;
    this.player.sit(seat.eye(this.eyeTmp), seat.yaw);
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
    return 'Sentado · mova o <kbd>mouse</kbd> para observar · <kbd>E</kbd> ou <kbd>Espaço</kbd> para levantar';
  }

  update(input: ControlInput & { wasPressed(code: string): boolean }): void {
    if (input.wasPressed('KeyE') || input.wasPressed('Space')) this.stand();
  }
}
