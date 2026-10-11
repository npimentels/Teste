import * as THREE from 'three';
import type { Interactable } from './Interactables';
import { rayOBB } from './Interactables';
import type { InteractionModal } from '../player/InteractionSystem';
import type { WorldContext } from '../world/WorldContext';
import type { WorldBuilder } from '../world/Builders';

/**
 * Coin-free observation telescope. Using it zooms the view (FOV ≈ 14°) and names whatever
 * landmark of the distant city is under the crosshair. The body stays put; E / Q / Space leave.
 */

export interface Landmark {
  name: string;
  /** World point of the landmark (its top, roughly). */
  at: THREE.Vector3;
  note: string;
}

const tmp = new THREE.Vector3();

export class Telescope implements Interactable, InteractionModal {
  readonly kind = 'use' as const;
  readonly reach = 2.2;
  readonly position: THREE.Vector3;
  readonly locksMovement = true;
  private using = false;
  private readonly half = new THREE.Vector3(0.25, 0.7, 0.25);
  private readonly center: THREE.Vector3;
  private current: Landmark | null = null;

  constructor(
    private readonly ctx: WorldContext,
    b: WorldBuilder,
    readonly id: string,
    x: number,
    y0: number,
    z: number,
    /** Yaw the telescope points to (0 = −Z, like the camera). */
    yaw: number,
    private readonly landmarks: Landmark[],
  ) {
    const m = b.mats;
    this.position = new THREE.Vector3(x, y0 + 1.25, z);
    this.center = new THREE.Vector3(x, y0 + 0.75, z);
    b.cylinder(m.cobaltCeramic, x, y0, z, 0.2, 0.26, 0.08, { segments: 24 });
    b.cylinder(m.chrome, x, y0 + 0.08, z, 0.05, 0.07, 1.0, { segments: 12, collide: 'metal' });
    // body: a glossy capsule with a lime eyepiece, aimed along `yaw`, tilted slightly up
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const body = new THREE.CapsuleGeometry(0.11, 0.55, 6, 16).rotateX(Math.PI / 2 - 0.12).rotateY(yaw + Math.PI);
    b.place(body, m.whiteCeramic, x, y0 + 1.2, z, { cast: true });
    body.dispose();
    b.sphere(m.limeGlossy, x - fx * 0.36, y0 + 1.17, z - fz * 0.36, 0.06, { cast: false });
    b.sphere(m.glossyCyan, x + fx * 0.38, y0 + 1.25, z + fz * 0.38, 0.1, { cast: false });
  }

  hitTest(origin: THREE.Vector3, dir: THREE.Vector3): number {
    if (this.using) return -1;
    return rayOBB(origin, dir, this.center, this.half, 0);
  }

  prompt(): string {
    if (this.using) return 'Sair da luneta';
    return 'Usar luneta';
  }

  interact(): void {
    this.using = true;
    this.ctx.setZoom(14);
    this.ctx.audio.play('toggleOn', { position: this.position, volume: 0.5 });
  }

  get active(): boolean {
    return this.using;
  }

  hint(): string {
    const name = this.current ? `<b>${this.current.name}</b> — ${this.current.note}` : 'Mova o <kbd>mouse</kbd> para procurar pontos da cidade';
    return `${name} · <kbd>E</kbd> ou <kbd>Q</kbd> para sair`;
  }

  update(input: { wasPressed(code: string): boolean }): void {
    // landmark under the crosshair (within ~4°)
    const v = this.ctx.viewer;
    const d = this.ctx.viewerDir;
    let best: Landmark | null = null;
    let bestCos = Math.cos(THREE.MathUtils.degToRad(4));
    for (const l of this.landmarks) {
      tmp.subVectors(l.at, v).normalize();
      const c = tmp.dot(d);
      if (c > bestCos) {
        bestCos = c;
        best = l;
      }
    }
    this.current = best;
    if (input.wasPressed('KeyE') || input.wasPressed('KeyQ') || input.wasPressed('Space')) this.leave();
  }

  cancel(): void {
    this.leave();
  }

  leave(): void {
    if (!this.using) return;
    this.using = false;
    this.current = null;
    this.ctx.setZoom(null);
    this.ctx.audio.play('toggleOff', { position: this.position, volume: 0.5 });
  }
}
