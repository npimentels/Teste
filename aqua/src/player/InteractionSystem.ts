import * as THREE from 'three';
import type { CollisionWorld } from '../physics/Collision';
import type { Interactable } from '../systems/Interactables';
import type { ObjectPhysics } from '../systems/ObjectPhysics';
import type { Input } from '../core/Input';
import type { HUD } from '../ui/HUD';

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

  update(input: Input): void {
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
