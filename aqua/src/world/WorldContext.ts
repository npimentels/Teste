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
  addUpdatable(u: Updatable): void;
  addQuality(q: QualityAware): void;
  addInteractable(i: Interactable): void;
  /** Registers a hero glass material whose transmission depends on quality. */
  addHeroGlass(m: THREE.MeshPhysicalMaterial): void;
  /** Adds a carriable glossy sphere. */
  addBall(id: string, label: string, material: THREE.Material, x: number, y: number, z: number, radius?: number): void;
}
