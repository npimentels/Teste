import * as THREE from 'three';
import { CollisionWorld } from '../physics/Collision';
import { Terrain } from '../physics/Terrain';
import { AssetManager } from './AssetManager';
import { Materials } from '../world/Materials';
import { WorldBuilder } from '../world/Builders';
import { WaterSystem } from '../environment/WaterSystem';
import { Vegetation } from '../environment/Vegetation';
import { LightingSystem } from '../environment/LightingSystem';
import { SkyDome } from '../environment/Sky';
import { SplashPool } from '../environment/ParticleSystem';
import { ObjectPhysics } from '../systems/ObjectPhysics';
import type { AudioManager } from '../systems/AudioManager';
import type { Interactable } from '../systems/Interactables';
import type { PerformanceManager } from '../systems/PerformanceManager';
import type { QualityAware, QualityProfile, Updatable } from './types';
import type { WorldContext } from '../world/WorldContext';
import { Atrium } from '../world/Atrium';
import { Surroundings } from '../world/Surroundings';
import { HydraulicGardens } from '../world/HydraulicGardens';
import { AquariumGallery } from '../world/AquariumGallery';
import { HorizonTerrace } from '../world/HorizonTerrace';
import { disposeFurnitureCache } from '../world/Furniture';
import { AquaMetro } from '../world/AquaMetro';
import { LAYOUT } from '../world/WorldLayout';
import { MercadoAqua } from '../world/Market';
import type { SeatController } from '../systems/Seats';
import type { InteractionModal } from '../player/InteractionSystem';

export type ProgressFn = (fraction: number, label: string) => Promise<void>;

/**
 * Owns the scene graph and every world system. Zones are built step by step so the loading
 * screen can report progress; afterwards `update` animates everything that lives in the world.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly collision = new CollisionWorld(new Terrain(0, -60));
  readonly assets = new AssetManager();
  readonly mats: Materials;
  readonly water: WaterSystem;
  readonly veg: Vegetation;
  readonly lighting: LightingSystem;
  readonly sky: SkyDome;
  readonly splash = new SplashPool();
  readonly physics: ObjectPhysics;
  readonly interactables: Interactable[] = [];
  readonly modals: InteractionModal[] = [];
  /** Camera position, copied by the game every frame (mirrors, proximity doors…). */
  readonly viewer = new THREE.Vector3();
  /** Set by the game: shows an information card on the HUD. */
  onCard: (html: string, seconds: number) => void = () => undefined;
  readonly root = new THREE.Group();
  private readonly updatables: Updatable[] = [];
  private readonly heroGlass: THREE.MeshPhysicalMaterial[] = [];
  private glassNear = true;
  private glassOn = false;
  private readonly ballGeometries = new Map<number, THREE.SphereGeometry>();
  private environment: { dispose(): void } | null = null;
  private readonly probes: Array<{ dispose(): void }> = [];
  private builder!: WorldBuilder;
  /** Aqua Metro (both stations, viaduct, train, skyline) and Mercado Aqua. */
  private readonly metroGroup = new THREE.Group();
  private readonly marketGroup = new THREE.Group();
  zones: {
    atrium?: Atrium;
    gardens?: HydraulicGardens;
    gallery?: AquariumGallery;
    terrace?: HorizonTerrace;
    surroundings?: Surroundings;
    metro?: AquaMetro;
    market?: MercadoAqua;
  } = {};

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly audio: AudioManager,
    private readonly perf: PerformanceManager,
  ) {
    this.assets.setRenderer(renderer);
    this.mats = new Materials(this.assets);
    this.root.name = 'WorldRoot';
    this.metroGroup.name = 'MetroZone';
    this.marketGroup.name = 'MarketZone';
    this.scene.add(this.root);
    this.lighting = new LightingSystem(this.scene);
    const zenith = new THREE.Color(0x1d7fd8);
    const horizon = new THREE.Color(0xc4ecf8);
    this.sky = new SkyDome(this.lighting.sunDir, {
      zenith,
      horizon,
      ground: new THREE.Color(0x7cc4dc),
      sunColor: new THREE.Color(1.0, 0.94, 0.82),
    });
    this.scene.add(this.sky.mesh);
    this.scene.fog = new THREE.Fog(horizon.clone(), 260, 2100);
    this.water = new WaterSystem(this.lighting.sunDir, this.lighting.sunColor, horizon, zenith);
    this.scene.add(this.water.group);
    this.veg = new Vegetation(this.collision);
    this.scene.add(this.veg.group);
    this.scene.add(this.splash.points);
    this.physics = new ObjectPhysics(this.collision, this.water, {
      onImpact: (ball, speed) => this.audio.play('impact', { position: ball.position, volume: Math.min(1, speed / 6) }),
      onSplash: (ball, speed, surfaceY) => {
        this.splash.emit(ball.position.x, surfaceY, ball.position.z, Math.min(40, 10 + Math.round(speed * 6)), Math.min(1.4, 0.5 + speed * 0.15));
        this.water.addRipple(ball.position.x, ball.position.z, Math.min(2, 0.6 + speed * 0.25));
        this.audio.play('splash', { position: ball.position, volume: Math.min(1, 0.3 + speed / 8) });
      },
      onPickup: (ball) => this.audio.play('pickup', { position: ball.position }),
      onDrop: (ball, thrown) => this.audio.play(thrown ? 'throw' : 'drop', { position: ball.position }),
    });
    this.updatables.push(this.water, this.splash);
    perf.register(this.water);
    perf.register(this.lighting);
    perf.register(this.veg);
    perf.register({ applyQuality: (p) => this.applyGlassQuality(p) });
    perf.register({ applyQuality: (p) => this.sky.setOctaves(p.cloudOctaves) });
  }

  async build(progress: ProgressFn, seats: SeatController): Promise<void> {
    this.builder = new WorldBuilder(this.root, this.collision, this.mats, this.assets);
    const ctx: WorldContext = {
      scene: this.scene,
      builder: this.builder,
      collision: this.collision,
      mats: this.mats,
      assets: this.assets,
      water: this.water,
      veg: this.veg,
      physics: this.physics,
      audio: this.audio,
      lighting: this.lighting,
      viewer: this.viewer,
      showCard: (html, seconds = 6) => this.onCard(html, seconds),
      quality: () => this.perf.profile,
      addUpdatable: (u) => this.updatables.push(u),
      addQuality: (q: QualityAware) => this.perf.register(q),
      addInteractable: (i) => this.interactables.push(i),
      addHeroGlass: (m) => {
        this.heroGlass.push(m);
        this.applyGlassQuality(this.perf.profile);
      },
      addBall: (id, label, material, x, y, z, radius = 0.22) => this.addBall(id, label, material, x, y, z, radius),
      addSeat: (spec) => {
        const seat = seats.add(spec);
        this.interactables.push(seat);
        return seat;
      },
      addModal: (m) => this.modals.push(m),
    };
    await progress(0.1, 'Erguendo o platô e o horizonte…');
    this.zones.surroundings = new Surroundings(ctx);
    this.updatables.push(this.zones.surroundings);
    await progress(0.3, 'Polindo o Átrio Azul…');
    this.zones.atrium = new Atrium(ctx);
    this.updatables.push(this.zones.atrium);
    await progress(0.45, 'Abrindo as comportas dos Jardins Hidráulicos…');
    this.zones.gardens = new HydraulicGardens(ctx);
    this.updatables.push(this.zones.gardens);
    await progress(0.6, 'Enchendo os aquários da Galeria…');
    this.zones.gallery = new AquariumGallery(ctx);
    this.updatables.push(this.zones.gallery);
    await progress(0.72, 'Nivelando a piscina infinita…');
    this.zones.terrace = new HorizonTerrace(ctx);
    this.updatables.push(this.zones.terrace);
    await progress(0.76, 'Ligando a Linha 2 do Aqua Metro…');
    this.zones.metro = this.inGroup(this.metroGroup, () => new AquaMetro(ctx));
    this.updatables.push(this.zones.metro);
    await progress(0.8, 'Abastecendo o Mercado Aqua…');
    this.zones.market = this.inGroup(this.marketGroup, () => new MercadoAqua(ctx));
    this.updatables.push(this.zones.market);
    await progress(0.84, 'Plantando palmeiras…');
    this.veg.build();
    this.veg.applyQuality(this.perf.profile);
    this.builder.disposeCache();
    await progress(0.9, 'Pintando o céu…');
    const env = this.sky.bakeEnvironment(this.renderer);
    this.environment = env;
    this.scene.environment = env.env;
    this.scene.environmentIntensity = 0.55;
    this.water.setEnvironment(env.cube);
    await progress(0.93, 'Refletindo o átrio na água…');
    if (this.zones.atrium) this.probes.push(this.zones.atrium.bakeReflections(this.renderer, this.scene, this.water));
    this.lighting.applyQuality(this.perf.profile);
    await progress(0.96, 'Compilando shaders…');
  }

  /** Builds a zone into its own group (so it can be hidden as a whole). */
  private inGroup<T>(group: THREE.Group, build: () => T): T {
    const prev = this.builder.root;
    this.root.add(group);
    this.builder.root = group;
    try {
      return build();
    } finally {
      this.builder.root = prev;
    }
  }

  private addBall(id: string, label: string, material: THREE.Material, x: number, y: number, z: number, radius: number): void {
    let geo = this.ballGeometries.get(radius);
    if (!geo) {
      geo = new THREE.SphereGeometry(radius, 32, 20);
      this.ballGeometries.set(radius, geo);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `Ball:${id}`;
    this.root.add(mesh);
    const ball = this.physics.addBall(id, label, mesh, radius);
    if (this.water.surfaceAt(x, z) !== null) ball.wake();
    this.interactables.push(ball);
  }

  /**
   * Physical transmission makes three.js render every opaque object a second time (the
   * transmission pass) whenever a transmissive mesh is in view — even far away. The hero
   * glass of the Átrio is therefore only transmissive when the viewer is near it.
   */
  private applyGlassQuality(profile: QualityProfile): void {
    const on = profile.transmission && this.glassNear;
    this.glassOn = on;
    for (const m of this.heroGlass) {
      m.transmission = on ? 1 : 0;
      m.opacity = on ? 1 : 0.42;
      m.depthWrite = on;
      m.needsUpdate = true;
    }
  }

  update(dt: number, time: number): void {
    // Cheap occlusion: from inside the closed Átrio (walls + oculus) the metro and the market
    // cannot be seen, but they sit inside the view frustum. Skip them (and their shadows).
    const a = LAYOUT.atrium;
    const v = this.viewer;
    const hidden = Math.hypot(v.x - a.x, v.z - a.z) < a.rIn - 0.6 && v.y < a.wallH;
    this.metroGroup.visible = !hidden;
    this.glassNear = Math.hypot(v.x - a.x, v.z - a.z) < 48;
    if (this.glassNear !== this.glassOn && this.perf.profile.transmission) this.applyGlassQuality(this.perf.profile);
    this.marketGroup.visible = !hidden;
    for (const u of this.updatables) u.update(dt, time);
  }

  /** Puts interactive state back to its initial configuration (new exploration). */
  reset(): void {
    this.physics.reset();
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.water.dispose();
    this.veg.dispose();
    this.sky.dispose();
    this.splash.dispose();
    this.zones.surroundings?.dispose();
    this.mats.dispose();
    this.assets.dispose();
    this.environment?.dispose();
    for (const p of this.probes) p.dispose();
    disposeFurnitureCache();
    this.lighting.dispose();
    for (const g of this.ballGeometries.values()) g.dispose();
    this.scene.clear();
  }
}
