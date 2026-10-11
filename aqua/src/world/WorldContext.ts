import type * as THREE from 'three';
import type { WorldBuilder } from './Builders';
import type { CollisionWorld } from '../physics/Collision';
import type { Materials } from './Materials';
import type { AssetManager } from '../core/AssetManager';
import type { WaterSystem } from '../environment/WaterSystem';
import type { Vegetation } from '../environment/Vegetation';
import type { ObjectPhysics } from '../systems/ObjectPhysics';
import type { AudioManager } from '../systems/AudioManager';
import type { LightingSystem } from '../environment/LightingSystem';
import type { Interactable } from '../systems/Interactables';
import type { QualityAware, Updatable } from '../core/types';
import type { Seat, SeatSpec } from '../systems/Seats';
import type { InteractionModal } from '../player/InteractionSystem';

/** Something that moves the player (elevator cabin): stepped before the player update. */
export interface Mover {
  step(dt: number, carry: boolean): void;
  bindPlayer(player: import('../player/PlayerController').PlayerController): void;
  readonly locksPlayer: boolean;
}

/** Everything a zone builder needs to add geometry, collisions, water, plants and systems. */
export interface WorldContext {
  scene: THREE.Scene;
  builder: WorldBuilder;
  collision: CollisionWorld;
  mats: Materials;
  assets: AssetManager;
  water: WaterSystem;
  veg: Vegetation;
  physics: ObjectPhysics;
  audio: AudioManager;
  lighting: LightingSystem;
  /** Current camera position and look direction (updated by the game every frame). */
  viewer: THREE.Vector3;
  viewerDir: THREE.Vector3;
  /** Telescope zoom: target field of view, or null to restore. */
  setZoom(fov: number | null): void;
  /** Moving platforms (elevators…) stepped before the player each frame. */
  addMover(m: Mover): void;
  /** Current quality profile. */
  quality(): import('../core/types').QualityProfile;
  /** Shows an information card on the HUD (product details, notices). */
  showCard(html: string, seconds?: number): void;
  addUpdatable(u: Updatable): void;
  addQuality(q: QualityAware): void;
  addInteractable(i: Interactable): void;
  /** Registers a hero glass material whose transmission depends on quality. */
  addHeroGlass(m: THREE.MeshPhysicalMaterial): void;
  /** Adds a carriable glossy sphere. */
  addBall(id: string, label: string, material: THREE.Material, x: number, y: number, z: number, radius?: number): void;
  /** Registers a seat with the shared sit / stand system (one implementation for every seat). */
  addSeat(spec: SeatSpec): Seat;
  /** Registers a modal interaction (vending machine menu…) with the interaction system. */
  addModal(modal: InteractionModal): void;
}
