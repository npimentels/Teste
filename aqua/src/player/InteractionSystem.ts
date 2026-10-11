import * as THREE from 'three';
import type { CollisionWorld } from '../physics/Collision';
import type { Interactable } from '../systems/Interactables';
import type { ObjectPhysics } from '../systems/ObjectPhysics';
import type { Input } from '../core/Input';
import type { HUD } from '../ui/HUD';

/**
 * A modal interaction temporarily owns the E key and the HUD prompt (sitting, vending machine
 * menu…). While active, world interactables are not targeted.
 */
export interface InteractionModal {
  readonly active: boolean;
  /** While active, the body does not walk (mouse look still works). */
  readonly locksMovement?: boolean;
  prompt(): string | null;
  hint?(): string | null;
  update(input: Input): void;
  /** Leaves the modal state immediately (back to menu, respawn…). */
  cancel?(): void;
}

export interface InteractionFeedback {
  onInteract(target: Interactable): void;
  onDrop(thrown: boolean): void;
}

/**
 * Center-screen raycast against registered interactables. The nearest hit within reach wins,
 * unless a solid (wall, glass…) is in between. Shows the HUD prompt and handles E / G / click.
 */
export class InteractionSystem {
  private readonly items: Interactable[] = [];
  focus: Interactable | null = null;
  private readonly modals: InteractionModal[] = [];
  /** When this returns true no interaction is possible (e.g. scripted boarding). */
  blocked: () => boolean = () => false;
  private readonly origin = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly collision: CollisionWorld,
    private readonly physics: ObjectPhysics,
    private readonly hud: HUD,
    private readonly feedback: InteractionFeedback,
  ) {}

  register(item: Interactable): void {
    this.items.push(item);
  }

  get all(): readonly Interactable[] {
    return this.items;
  }

  addModal(modal: InteractionModal): void {
    this.modals.push(modal);
  }

  cancelModals(): void {
    for (const m of this.modals) if (m.active) m.cancel?.();
  }

  get activeModal(): InteractionModal | null {
    return this.modals.find((m) => m.active) ?? null;
  }

  update(input: Input): void {
    const modal = this.activeModal;
    if (modal) {
      this.focus = null;
      this.hud.setPrompt(modal.prompt());
      this.hud.setModalHint(modal.hint?.() ?? null);
      this.hud.setCarrying(null);
      modal.update(input);
      return;
    }
    this.hud.setModalHint(null);
    if (this.blocked()) {
      this.focus = null;
      this.hud.setPrompt(null);
      return;
    }
    this.origin.copy(this.camera.position);
    this.camera.getWorldDirection(this.dir);
    let best: Interactable | null = null;
    let bestT = Infinity;
    for (const item of this.items) {
      const t = item.hitTest(this.origin, this.dir);
      if (t < 0 || t > item.reach || t >= bestT) continue;
      best = item;
      bestT = t;
    }
    if (best) {
      const blocked = this.collision.raycast(this.origin, this.dir, bestT, best.id);
      if (blocked < bestT - 0.05) best = null;
    }
    this.focus = best;

    const carried = this.physics.carried;
    this.hud.setPrompt(best ? best.prompt() : null);
    this.hud.setCarrying(carried ? carried.label : null);

    if (input.wasPressed('KeyE') && best) {
      best.interact();
      this.feedback.onInteract(best);
    }
    if (carried && input.wasPressed('KeyG')) {
      this.physics.drop(false);
      this.feedback.onDrop(false);
    }
    if (input.consumeClicks() > 0 && this.physics.carried) {
      this.physics.drop(true, this.camera);
      this.feedback.onDrop(true);
    }
  }

  clearFocus(): void {
    this.focus = null;
    this.hud.setPrompt(null);
  }
}
