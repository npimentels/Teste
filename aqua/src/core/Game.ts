import * as THREE from 'three';
import { World } from './World';
import { Input } from './Input';
import { SettingsStore, type GameSettings } from './Config';
import type { ZoneId } from './types';
import { PlayerController, type FootSurface } from '../player/PlayerController';
import { InteractionSystem } from '../player/InteractionSystem';
import { AudioManager, type SfxName } from '../systems/AudioManager';
import { PerformanceManager } from '../systems/PerformanceManager';
import { sharedTime } from '../environment/ShaderPatches';
import { setParticlePixelRatio } from '../environment/ParticleSystem';
import { HUD } from '../ui/HUD';
import { MainMenu } from '../ui/MainMenu';
import { PauseMenu } from '../ui/PauseMenu';
import { SettingsPanel } from '../ui/Settings';
import { Credits } from '../ui/Credits';
import type { UiSounds } from '../ui/dom';
import { LAYOUT, ZONE_INFO, surfaceAt, zoneAt } from '../world/WorldLayout';
import { AMBIENCE } from '../world/Palette';
import { SeatController } from '../systems/Seats';

export type GameState = 'loading' | 'menu' | 'playing' | 'paused';

/** Which lighting rules apply in each zone (see Palette.AMBIENCE). */
const ZONE_AMBIENCE: Record<ZoneId, keyof typeof AMBIENCE> = {
  atrium: 'hall',
  gallery: 'aquarium',
  gardens: 'garden',
  terrace: 'terrace',
  exterior: 'open',
  metro: 'hall',
  park: 'garden',
  market: 'hall',
  lounge: 'suite',
  hotel: 'suite',
  isle: 'garden',
};

const FOOTSTEP_SFX: Record<FootSurface, SfxName> = {
  tile: 'stepTile',
  grass: 'stepGrass',
  metal: 'stepMetal',
  water: 'stepWater',
};

/**
 * Top-level orchestrator: renderer, main loop, state machine (loading → menu ⇄ playing ⇄
 * paused), pointer lock, focus handling and the wiring between settings, UI and systems.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly settings = new SettingsStore();
  readonly input = new Input();
  readonly audio = new AudioManager();
  readonly perf: PerformanceManager;
  readonly world: World;
  readonly player: PlayerController;
  readonly hud: HUD;
  private interaction!: InteractionSystem;
  readonly seats: SeatController;
  private readonly menu: MainMenu;
  private readonly pause: PauseMenu;
  private readonly settingsPanel: SettingsPanel;
  private readonly credits: Credits;
  state: GameState = 'loading';
  private time = 0;
  private last = performance.now();
  private zone: ZoneId | null = null;
  private pausedAt = 0;
  private hintsShown = false;
  /** Test hook: lets automated runs play without pointer lock (only with ?debug). */
  debugNoLock = false;
  private readonly forward = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly seatEye = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.tabIndex = 0;
    container.prepend(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 6500);
    this.perf = new PerformanceManager(this.renderer, container);
    this.world = new World(this.renderer, this.audio, this.perf);
    this.hud = new HUD(container);

    this.player = new PlayerController(
      this.camera,
      {
        collision: this.world.collision,
        waterSurfaceAt: (x, z) => this.world.water.surfaceAt(x, z),
        surfaceAt,
      },
      {
        onFootstep: (surface, x, y, z, running) => {
          this.audio.play(FOOTSTEP_SFX[surface], { volume: running ? 1 : 0.75 });
          if (surface === 'water') {
            const s = this.world.water.surfaceAt(x, z) ?? y;
            this.world.splash.emit(x, s, z, running ? 10 : 6, running ? 0.8 : 0.55);
            this.world.water.addRipple(x, z, running ? 0.9 : 0.6);
          }
        },
        onLand: (speed, surface) => {
          this.audio.play(surface === 'water' ? 'splash' : 'land', { volume: Math.min(1, speed / 9) });
          if (surface === 'water') {
            const p = this.player.position;
            this.world.splash.emit(p.x, this.world.water.surfaceAt(p.x, p.z) ?? p.y, p.z, 24, 1);
            this.world.water.addRipple(p.x, p.z, 1.4);
          }
        },
        onJump: () => this.audio.play('jump', { volume: 0.6 }),
      },
    );
    this.player.setSpawn(LAYOUT.spawn.x, LAYOUT.spawn.y, LAYOUT.spawn.z, LAYOUT.spawn.yaw);
    this.seats = new SeatController(this.player);
    this.seats.onSit = (seat) => this.audio.play('sit', { position: seat.position, volume: 0.7 });
    this.seats.onStand = (seat) => this.audio.play('stand', { position: seat.position, volume: 0.6 });
    this.world.onCard = (html, seconds) => this.hud.showCard(html, seconds);
    this.world.onZoom = (fov) => (this.player.zoomFov = fov);

    const sounds: UiSounds = {
      click: () => this.audio.play('click'),
      hover: () => this.audio.play('hover'),
    };
    this.menu = new MainMenu(
      container,
      {
        start: () => this.startExploration(),
        settings: () => this.openSettings('menu'),
        credits: () => {
          this.menu.hide();
          this.credits.show();
        },
      },
      sounds,
    );
    this.pause = new PauseMenu(
      container,
      {
        resume: () => this.resume(),
        settings: () => this.openSettings('pause'),
        quitToMenu: () => this.toMenu(),
      },
      sounds,
    );
    this.settingsPanel = new SettingsPanel(container, this.settings, sounds);
    this.credits = new Credits(
      container,
      () => {
        this.credits.hide();
        this.menu.show();
      },
      sounds,
    );
    // Any first click on the page unlocks audio (browser autoplay policy).
    const unlockAudio = () => void this.audio.init().then(() => this.applySettings(this.settings.get()));
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }

  async init(onProgress: (fraction: number, label: string) => void): Promise<void> {
    this.input.attach();
    const progress = async (f: number, label: string) => {
      onProgress(f, label);
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    };
    await this.world.build(progress, this.seats);
    this.interaction = new InteractionSystem(this.camera, this.world.collision, this.world.physics, this.hud, {
      onInteract: (target) => {
        if (target.kind === 'carry') return;
        if (target.kind === 'toggle') {
          const on = (target as unknown as { on: boolean }).on;
          this.audio.play(on ? 'toggleOn' : 'toggleOff', { position: target.position });
          if (target.id.includes('sluice')) this.audio.play('valve', { position: target.position });
        }
      },
      onDrop: () => undefined,
    });
    for (const i of this.world.interactables) this.interaction.register(i);
    this.interaction.addModal(this.seats);
    for (const m of this.world.modals) this.interaction.addModal(m);
    this.interaction.blocked = () => this.player.busy;
    this.world.zones.metro?.bindPlayer(this.player, this.seats);
    for (const mv of this.world.movers) mv.bindPlayer(this.player);

    this.settings.subscribe((s, changed) => this.applySettings(s, changed));
    this.applySettings(this.settings.get());
    this.bindWindowEvents();

    // Warm up: compile shaders and render shadow maps once before showing the menu.
    this.updateMenuCamera(0);
    this.renderer.compile(this.world.scene, this.camera);
    await progress(1, 'Pronto');
    this.state = 'menu';
    this.menu.show();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------------------

  private applySettings(s: Readonly<GameSettings>, changed?: ReadonlyArray<keyof GameSettings>): void {
    const has = (k: keyof GameSettings) => !changed || changed.includes(k);
    this.player.sensitivity = s.sensitivity;
    this.player.invertY = s.invertY;
    this.player.headBob = s.headBob;
    this.player.baseFov = s.fov;
    if (has('fov')) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
    this.audio.setVolumes(s.musicVolume, s.ambientVolume, s.sfxVolume);
    if (has('quality') || has('resolutionScale')) {
      this.perf.setQuality(s.quality, s.resolutionScale);
      setParticlePixelRatio(this.renderer.getPixelRatio());
    }
    this.perf.setVisible(s.showFps);
  }

  // ---------------------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------------------

  private startExploration(): void {
    void this.audio.init().then(() => this.applySettings(this.settings.get()));
    this.world.reset();
    this.interaction.cancelModals();
    this.player.zoomFov = null;
    this.player.respawn();
    this.zone = null;
    this.menu.hide();
    this.hud.setVisible(true);
    this.state = 'playing';
    this.audio.setPaused(false);
    if (!this.hintsShown) {
      this.hintsShown = true;
      this.hud.queueHints([
        '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para andar · mova o <kbd>mouse</kbd> para olhar',
        '<kbd>Shift</kbd> para correr · <kbd>Espaço</kbd> para pular',
        'Mire nos painéis e pressione <kbd>E</kbd> para interagir',
        'Pegue as esferas com <kbd>E</kbd> · solte com <kbd>G</kbd> · arremesse com um <kbd>clique</kbd>',
        '<kbd>Esc</kbd> pausa o jogo e libera o mouse',
      ]);
    }
    this.requestLock();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.pause.hide();
    this.state = 'playing';
    this.hud.setVisible(true);
    this.audio.setPaused(false);
    this.requestLock();
  }

  private pauseGame(message = ''): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.input.clear();
    this.interaction.clearFocus();
    this.hud.setCaptureMessage(false);
    this.audio.setPaused(true);
    this.exitLock();
    this.pause.show(message);
  }

  private toMenu(): void {
    this.pause.hide();
    this.settingsPanel.hide();
    this.hud.setVisible(false);
    this.hud.clearHints();
    if (this.world.physics.carried) this.world.physics.drop(false);
    this.interaction.cancelModals();
    this.player.zoomFov = null;
    this.state = 'menu';
    this.audio.setPaused(false);
    this.audio.setZone('atrium');
    this.exitLock();
    this.menu.show();
  }

  private openSettings(from: 'menu' | 'pause'): void {
    if (from === 'menu') this.menu.hide();
    else this.pause.hide();
    this.settingsPanel.show(() => {
      this.settingsPanel.hide();
      if (from === 'menu') this.menu.show();
      else this.pause.show();
    });
  }

  // ---------------------------------------------------------------------------------------
  // Pointer lock & focus
  // ---------------------------------------------------------------------------------------

  private get locked(): boolean {
    return document.pointerLockElement === this.renderer.domElement;
  }

  private requestLock(): void {
    if (this.debugNoLock) {
      this.hud.setCaptureMessage(false);
      return;
    }
    const canvas = this.renderer.domElement;
    try {
      const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (result && typeof result.catch === 'function') {
        result.catch(() => this.onLockFailed());
      }
    } catch {
      this.onLockFailed();
    }
  }

  private onLockFailed(): void {
    if (this.state === 'playing' && !this.locked) this.hud.setCaptureMessage(true);
  }

  private exitLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  private bindWindowEvents(): void {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      const locked = this.locked;
      this.input.pointerLocked = locked;
      if (locked) {
        this.hud.setCaptureMessage(false);
        if (this.state === 'paused') {
          this.pause.hide();
          this.state = 'playing';
          this.audio.setPaused(false);
        }
      } else if (this.state === 'playing' && !this.debugNoLock) {
        this.pauseGame();
      }
    });
    document.addEventListener('pointerlockerror', () => this.onLockFailed());
    canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.locked) this.requestLock();
    });
    this.hud.root.addEventListener('click', () => {
      if (this.state === 'playing' && !this.locked) this.requestLock();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'paused' && !this.settingsPanel.root.classList.contains('visible') && performance.now() - this.pausedAt > 400) {
        // Browsers release the lock on Esc themselves; a second Esc resumes.
        this.resume();
      } else if (e.code === 'Escape' && this.state === 'playing' && this.debugNoLock) {
        this.pauseGame();
      }
    });
    window.addEventListener('blur', () => {
      this.input.clear();
      if (this.state === 'playing') this.pauseGame('O jogo foi pausado porque a janela perdeu o foco.');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pauseGame('O jogo foi pausado porque a aba ficou oculta.');
        void this.audio.setSuspended(true);
      } else {
        void this.audio.setSuspended(false);
        this.last = performance.now();
      }
    });
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.hud.showToast('O contexto gráfico foi perdido. Recarregue a página se a imagem não voltar.', 8);
    });
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.perf.applyPixelRatio();
    setParticlePixelRatio(this.renderer.getPixelRatio());
  }

  // ---------------------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------------------

  private frame(): void {
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    this.last = now;
    // Clamp huge gaps (tab switch, breakpoint) so physics never explodes.
    const dt = Math.min(Math.max(raw, 0), 0.05);
    this.time += dt;
    sharedTime.value = this.time;

    const active = this.state === 'playing' && (this.locked || this.debugNoLock);
    // the metro runs on its own clock (also behind the menu); it is frozen while paused
    if (this.state !== 'paused') {
      this.world.zones.metro?.step(dt, active);
      for (const mv of this.world.movers) mv.step(dt, active);
    }
    if (active) {
      const modal = this.interaction.activeModal;
      this.player.locked = (!!modal && modal.locksMovement === true) || this.world.movers.some((mv) => mv.locksPlayer);
      // seated in a moving train: keep the eye attached to the seat
      const seat = this.seats.current;
      if (seat) this.player.updateSeatEye(seat.eye(this.seatEye));
      this.player.update(dt, this.input);
      this.interaction.update(this.input);
      this.world.physics.updateWithPlayer(dt, this.camera, {
        position: this.player.position,
        velocity: this.player.velocity,
        radius: this.player.tuning.radius,
        height: this.player.tuning.height,
      });
      this.trackZone();
    } else if (this.state === 'menu') {
      this.updateMenuCamera(this.time);
      this.world.physics.update(dt);
    } else if (this.state === 'playing') {
      // waiting for the pointer to be captured: keep the camera where it is
      this.input.consumeClicks();
    }

    this.world.viewer.copy(this.camera.position);
    this.camera.getWorldDirection(this.world.viewerDir);
    this.world.update(dt, this.time);
    const amb = this.state === 'menu' || this.zone === null ? 'hall' : ZONE_AMBIENCE[this.zone];
    this.world.lighting.setAmbience(AMBIENCE[amb]);
    this.world.lighting.updateAmbience(dt);
    this.renderer.toneMappingExposure = this.world.lighting.ambience.exposure;
    this.focus.copy(this.state === 'menu' ? this.world.scene.position : this.player.position);
    this.world.lighting.follow(this.focus);
    this.world.sky.follow(this.camera);
    this.camera.getWorldDirection(this.forward);
    this.audio.updateListener(this.camera, this.forward);
    this.hud.update(dt);
    this.renderer.render(this.world.scene, this.camera);
    this.input.endFrame();
    this.perf.frame(raw);
  }

  private trackZone(): void {
    const p = this.player.position;
    const z = zoneAt(p.x, p.y, p.z);
    if (z === this.zone) return;
    const first = this.zone === null;
    this.zone = z;
    const info = ZONE_INFO[z];
    this.hud.showZone(info.title, info.subtitle);
    this.audio.setZone(z);
    if (!first) this.audio.play('zone', { volume: 0.8 });
  }

  private updateMenuCamera(t: number): void {
    const a = t * 0.045 + 0.6;
    this.camera.position.set(Math.cos(a) * 9.5, 2.4 + Math.sin(t * 0.12) * 0.35, Math.sin(a) * 9.5);
    this.camera.lookAt(0, 3.4, 0);
  }

  /** Debug / automated-test helpers (exposed on window only with ?debug in the URL). */
  debugApi(): Record<string, unknown> {
    return {
      game: this,
      THREE,
      play: () => {
        this.debugNoLock = true;
        if (this.state === 'menu') this.startExploration();
        else if (this.state === 'paused') this.resume();
      },
      teleport: (x: number, y: number, z: number, yaw = 0, pitch = 0) => this.player.teleport(x, y, z, yaw, pitch),
      look: (yaw: number, pitch: number) => {
        this.player.yaw = yaw;
        this.player.pitch = pitch;
        this.player.syncCamera(0);
      },
      state: () => ({
        state: this.state,
        zone: this.zone,
        position: this.player.position.toArray().map((v) => +v.toFixed(3)),
        grounded: this.player.grounded,
        inWater: this.player.inWater,
        focus: this.interaction?.focus?.id ?? null,
        carrying: this.world.physics.carried?.id ?? null,
        fps: +this.perf.fps.toFixed(1),
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      }),
      /** Points the camera at a world point (yaw/pitch), for scripted interaction tests. */
      aimAt: (x: number, y: number, z: number) => {
        this.player.syncCamera(0);
        const c = this.camera.position;
        const dx = x - c.x;
        const dy = y - c.y;
        const dz = z - c.z;
        this.player.yaw = Math.atan2(-dx, -dz);
        this.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
        this.player.syncCamera(0);
        return [+this.player.yaw.toFixed(3), +this.player.pitch.toFixed(3)];
      },
      /** What the crosshair ray hits: nearest interactables and the first blocking collider. */
      probe: () => {
        const o = this.camera.position.clone();
        const d = new THREE.Vector3();
        this.camera.getWorldDirection(d);
        const hits = this.world.interactables
          .map((i) => ({ id: i.id, t: i.hitTest(o, d), reach: i.reach }))
          .filter((h) => h.t >= 0 && h.t < 6)
          .sort((a, b) => a.t - b.t)
          .slice(0, 5)
          .map((h) => ({ ...h, t: +h.t.toFixed(2) }));
        return { hits, wall: +this.world.collision.raycast(o, d, 6).toFixed(2) };
      },
      /** Renders one frame now and returns its draw calls / triangles. */
      measure: () => {
        this.world.viewer.copy(this.camera.position);
        this.world.update(0, this.time);
        // accumulate over the whole frame (mirror / transmission passes call render() again)
        const info = this.renderer.info;
        info.autoReset = false;
        info.reset();
        this.renderer.render(this.world.scene, this.camera);
        const out = { calls: info.render.calls, triangles: info.render.triangles };
        info.autoReset = true;
        return out;
      },
      train: () => {
        const m = this.world.zones.metro;
        if (!m) return null;
        const s = m.service;
        return { phase: s.phase, z: +s.z.toFixed(2), v: +s.v.toFixed(2), doors: +s.doors.toFixed(2), stop: s.stop.id, aboard: m.playerAboard(), seated: this.seats.current?.id ?? null };
      },
      /** Fast-forwards the world (metro service + player carried) by `seconds` at 30 Hz. */
      stepWorld: (seconds: number) => {
        const n = Math.round(seconds * 30);
        const idle = { isDown: () => false, wasPressed: () => false, consumeMouse: (o: { x: number; y: number }) => ((o.x = 0), (o.y = 0)) };
        for (let i = 0; i < n; i++) {
          this.world.zones.metro?.step(1 / 30, true);
          for (const mv of this.world.movers) mv.step(1 / 30, true);
          const seat = this.seats.current;
          if (seat) this.player.updateSeatEye(seat.eye(this.seatEye));
          this.player.update(1 / 30, idle);
          this.world.viewer.copy(this.camera.position);
          this.world.update(1 / 30, (this.time += 1 / 30));
        }
        return this.player.position.toArray().map((v) => +v.toFixed(2));
      },
      /** Presses a key once through the interaction system (modal menus, E…). */
      press: (code: string) => {
        this.interaction.update({ ...this.input, wasPressed: (c: string) => c === code, consumeClicks: () => 0 } as unknown as Input);
        return { focus: this.interaction.focus?.id ?? null, modal: this.interaction.activeModal ? this.interaction.activeModal.constructor.name : null };
      },
      interactables: () => this.world.interactables.map((i) => ({ id: i.id, kind: i.kind, position: i.position.toArray() })),
      /** Steps the player synchronously at 60 Hz with the given keys held (no rendering). */
      simulate: (keys: string[], seconds: number, jumpAtFrame = -1) => {
        const down = new Set(keys);
        const pressed = new Set<string>();
        const fake = {
          isDown: (c: string) => down.has(c),
          wasPressed: (c: string) => pressed.has(c),
          consumeMouse: (o: { x: number; y: number }) => {
            o.x = 0;
            o.y = 0;
          },
        };
        const frames = Math.round(seconds * 60);
        for (let i = 0; i < frames; i++) {
          if (i === jumpAtFrame) pressed.add('Space');
          this.player.update(1 / 60, fake);
          pressed.clear();
        }
        const p = this.player.position;
        return { position: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)], grounded: this.player.grounded, inWater: this.player.inWater, zone: zoneAt(p.x, p.y, p.z) };
      },
      /** Uses whatever the crosshair currently targets (same path as pressing E). */
      interact: () => {
        this.interaction.update({ ...this.input, wasPressed: (c: string) => c === 'KeyE', consumeClicks: () => 0 } as unknown as Input);
        return this.interaction.focus?.id ?? null;
      },
    };
  }
}
