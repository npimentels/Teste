import type * as THREE from 'three';
import type { ZoneId } from '../core/types';

/**
 * Fully procedural audio (Web Audio API). No recorded samples are shipped: water, birds, UI
 * chimes and the ambient music are synthesized at runtime, so every sound is original.
 *
 * Bus layout:  sources → {music | ambient | sfx} bus → master → compressor → destination
 *              (+ a shared convolution reverb send)
 * The AudioContext is only created inside a user gesture (browser autoplay policy).
 */

export type SfxName =
  | 'click'
  | 'hover'
  | 'toggleOn'
  | 'toggleOff'
  | 'pickup'
  | 'drop'
  | 'throw'
  | 'stepTile'
  | 'stepGrass'
  | 'stepMetal'
  | 'stepWater'
  | 'jump'
  | 'land'
  | 'splash'
  | 'impact'
  | 'valve'
  | 'zone'
  | 'error';

export type WaterSoundKind = 'fountain' | 'stream' | 'waterfall' | 'bubbles' | 'hum';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SoundHandle {
  setActive(on: boolean): void;
  readonly active: boolean;
}

class SpatialWaterSource implements SoundHandle {
  active: boolean;
  gain: GainNode | null = null;
  panner: PannerNode | null = null;
  nextBlip = 0;

  constructor(
    readonly kind: WaterSoundKind,
    readonly pos: Vec3,
    readonly volume: number,
    active: boolean,
    private readonly manager: AudioManager,
  ) {
    this.active = active;
  }

  setActive(on: boolean): void {
    this.active = on;
    this.manager.refreshSource(this);
  }
}

const MUSIC_CHORDS: number[][] = [
  [48, 55, 59, 62, 64], // Cmaj9
  [45, 52, 55, 59, 60], // Am9
  [41, 48, 52, 55, 57], // Fmaj9
  [43, 50, 57, 59, 64], // G6/9
  [40, 47, 55, 59, 62], // Em7(add11)
  [41, 48, 55, 57, 64], // Fmaj7(9)
];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioManager {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambientBus!: GainNode;
  private sfxBus!: GainNode;
  private duck!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  private readonly sources: SpatialWaterSource[] = [];
  private readonly zoneBeds = new Map<ZoneId, GainNode>();
  private zone: ZoneId = 'atrium';
  private volumes = { music: 0.55, ambient: 0.8, sfx: 0.8 };
  private scheduler: number | null = null;
  private musicTime = 0;
  private chordIndex = 0;
  private nextBell = 0;
  private nextBird = 0;
  private nextChime = 0;
  private paused = false;
  private listenerPos: Vec3 = { x: 0, y: 0, z: 0 };
  private lastHover = 0;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture handler. Safe to call repeatedly. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => undefined);
      return;
    }
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    this.musicBus = ctx.createGain();
    this.ambientBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.ambientBus.connect(this.duck);
    this.sfxBus.connect(this.duck);
    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(3.2, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.9;
    this.reverbSend.connect(reverb);
    reverb.connect(this.master);
    this.noise = this.makeNoise(false);
    this.brown = this.makeNoise(true);
    this.applyVolumes();
    for (const s of this.sources) this.attachSource(s);
    this.buildZoneBeds();
    this.setZone(this.zone, true);
    this.musicTime = ctx.currentTime + 0.5;
    this.scheduler = window.setInterval(() => this.tick(), 120);
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  }

  setVolumes(music: number, ambient: number, sfx: number): void {
    this.volumes = { music, ambient, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Perceptual curve: slider² feels linear in loudness.
    this.musicBus.gain.setTargetAtTime(this.volumes.music ** 2 * 0.8, t, 0.08);
    this.ambientBus.gain.setTargetAtTime(this.volumes.ambient ** 2, t, 0.08);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx ** 2, t, 0.05);
  }

  /** While paused, gameplay sounds are ducked; music keeps playing softly. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.ctx) return;
    this.duck.gain.setTargetAtTime(paused ? 0.25 : 1, this.ctx.currentTime, 0.15);
  }

  /** Called when the tab is hidden / shown. */
  async setSuspended(suspended: boolean): Promise<void> {
    if (!this.ctx) return;
    try {
      if (suspended && this.ctx.state === 'running') await this.ctx.suspend();
      else if (!suspended && this.ctx.state === 'suspended') await this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  updateListener(camera: THREE.Camera, forward: THREE.Vector3): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const p = camera.position;
    this.listenerPos = { x: p.x, y: p.y, z: p.z };
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(p.x, t, 0.02);
      l.positionY.setTargetAtTime(p.y, t, 0.02);
      l.positionZ.setTargetAtTime(p.z, t, 0.02);
      l.forwardX.setTargetAtTime(forward.x, t, 0.02);
      l.forwardY.setTargetAtTime(forward.y, t, 0.02);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  // ---------------------------------------------------------------------------------------
  // Spatial water sources
  // ---------------------------------------------------------------------------------------

  /** Registers a looping positional water sound. Works before init (attached later). */
  addWaterSource(kind: WaterSoundKind, pos: Vec3, volume = 1, active = true): SoundHandle {
    const s = new SpatialWaterSource(kind, { ...pos }, volume, active, this);
    this.sources.push(s);
    if (this.ctx) this.attachSource(s);
    return s;
  }

  refreshSource(s: SpatialWaterSource): void {
    if (!this.ctx || !s.gain) return;
    s.gain.gain.setTargetAtTime(s.active ? s.volume : 0, this.ctx.currentTime, s.kind === 'waterfall' ? 0.6 : 0.35);
  }

  private makePanner(pos: Vec3, ref = 2, rolloff = 1.1, max = 60): PannerNode {
    const ctx = this.ctx!;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = max;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = pos.y;
      p.positionZ.value = pos.z;
    } else {
      p.setPosition(pos.x, pos.y, pos.z);
    }
    return p;
  }

  private attachSource(s: SpatialWaterSource): void {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = this.makePanner(s.pos, s.kind === 'waterfall' ? 3 : s.kind === 'hum' ? 4 : 1.6, s.kind === 'hum' ? 0.8 : 1.2);
    gain.connect(panner);
    panner.connect(this.ambientBus);
    s.gain = gain;
    s.panner = panner;
    if (s.kind !== 'bubbles') {
      const src = ctx.createBufferSource();
      src.buffer = s.kind === 'hum' ? this.brown : this.noise;
      src.loop = true;
      src.loopStart = Math.random();
      const chain: AudioNode[] = [];
      if (s.kind === 'fountain') {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2200;
        bp.Q.value = 0.5;
        const hs = ctx.createBiquadFilter();
        hs.type = 'highshelf';
        hs.frequency.value = 5000;
        hs.gain.value = -6;
        chain.push(bp, hs);
      } else if (s.kind === 'stream') {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1100;
        const pk = ctx.createBiquadFilter();
        pk.type = 'peaking';
        pk.frequency.value = 450;
        pk.gain.value = 5;
        chain.push(lp, pk);
      } else if (s.kind === 'waterfall') {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        const ls = ctx.createBiquadFilter();
        ls.type = 'lowshelf';
        ls.frequency.value = 300;
        ls.gain.value = 6;
        chain.push(lp, ls);
      } else {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        chain.push(lp);
      }
      // Slow random-ish amplitude wobble so loops never sound static.
      const wobble = ctx.createGain();
      wobble.gain.value = 0.8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13 + Math.random() * 0.2;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain).connect(wobble.gain);
      lfo.start();
      let node: AudioNode = src;
      for (const n of chain) {
        node.connect(n);
        node = n;
      }
      node.connect(wobble).connect(gain);
      src.start();
    }
    this.refreshSource(s);
  }

  // ---------------------------------------------------------------------------------------
  // Zone ambience
  // ---------------------------------------------------------------------------------------

  private buildZoneBeds(): void {
    const ctx = this.ctx!;
    const bed = (zone: ZoneId, build: (out: GainNode) => void) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.ambientBus);
      build(g);
      this.zoneBeds.set(zone, g);
    };
    const loopNoise = (brown: boolean, filters: Array<[BiquadFilterType, number, number]>, level: number, out: AudioNode, lfoRate = 0, lfoDepth = 0) => {
      const src = ctx.createBufferSource();
      src.buffer = brown ? this.brown : this.noise;
      src.loop = true;
      let node: AudioNode = src;
      let first: BiquadFilterNode | null = null;
      for (const [type, f, q] of filters) {
        const b = ctx.createBiquadFilter();
        b.type = type;
        b.frequency.value = f;
        b.Q.value = q;
        node.connect(b);
        node = b;
        first ??= b;
      }
      const g = ctx.createGain();
      g.gain.value = level;
      node.connect(g).connect(out);
      if (lfoRate > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = lfoRate;
        const lg = ctx.createGain();
        lg.gain.value = lfoDepth;
        lfo.connect(lg).connect(g.gain);
        lfo.start();
      }
      src.start(ctx.currentTime, Math.random() * 2);
    };
    bed('atrium', (out) => {
      loopNoise(false, [['bandpass', 3200, 0.4]], 0.012, out, 0.05, 0.006);
      loopNoise(true, [['lowpass', 160, 0.7]], 0.05, out);
    });
    bed('gardens', (out) => {
      loopNoise(false, [['lowpass', 700, 0.5]], 0.05, out, 0.09, 0.035);
    });
    bed('exterior', (out) => {
      loopNoise(false, [['lowpass', 650, 0.5]], 0.06, out, 0.08, 0.04);
    });
    bed('gallery', (out) => {
      loopNoise(true, [['lowpass', 260, 1.2]], 0.22, out, 0.07, 0.08);
      loopNoise(false, [['bandpass', 900, 3]], 0.004, out, 0.2, 0.003);
    });
    bed('terrace', (out) => {
      loopNoise(true, [['lowpass', 520, 0.6]], 0.18, out, 0.12, 0.14); // distant surf swells
      loopNoise(false, [['bandpass', 550, 0.8]], 0.035, out, 0.06, 0.025); // wind
    });
  }

  setZone(zone: ZoneId, instant = false): void {
    this.zone = zone;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [z, g] of this.zoneBeds) g.gain.setTargetAtTime(z === zone ? 1 : 0, t, instant ? 0.01 : 1.2);
  }

  // ---------------------------------------------------------------------------------------
  // Scheduler: music, birds, chimes, bubbles
  // ---------------------------------------------------------------------------------------

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const ahead = now + 0.4;
    if (this.volumes.music > 0.001) {
      if (this.musicTime < now) this.musicTime = now + 0.05;
      while (this.musicTime < ahead) {
        this.playChord(this.musicTime, MUSIC_CHORDS[this.chordIndex % MUSIC_CHORDS.length]);
        this.chordIndex++;
        this.musicTime += 9.6;
      }
      if (this.nextBell < now) this.nextBell = now + 1;
      while (this.nextBell < ahead) {
        const chord = MUSIC_CHORDS[(this.chordIndex + MUSIC_CHORDS.length - 1) % MUSIC_CHORDS.length];
        const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + (Math.random() < 0.6 ? 24 : 12);
        this.playBell(this.nextBell, midiHz(note), 0.045 + Math.random() * 0.03);
        this.nextBell += 1.2 + Math.random() * 2.4;
      }
    }
    if (this.volumes.ambient > 0.001 && !this.paused) {
      if ((this.zone === 'gardens' || this.zone === 'exterior' || this.zone === 'terrace') && now > this.nextBird) {
        this.playBird(now + 0.05);
        this.nextBird = now + 2 + Math.random() * 6;
      }
      if (this.zone === 'atrium' && now > this.nextChime) {
        this.playBell(now + 0.05, midiHz(84 + [0, 4, 7, 11, 14][Math.floor(Math.random() * 5)]), 0.012, this.ambientBus);
        this.nextChime = now + 5 + Math.random() * 9;
      }
      for (const s of this.sources) {
        if (s.kind !== 'bubbles' || !s.active || !s.gain) continue;
        if (this.distanceTo(s.pos) > 25) continue;
        if (s.nextBlip < now) s.nextBlip = now;
        while (s.nextBlip < ahead) {
          this.blip(s.nextBlip, s.gain);
          s.nextBlip += 0.06 + Math.random() * 0.3;
        }
      }
    }
  }

  private distanceTo(p: Vec3): number {
    const l = this.listenerPos;
    return Math.hypot(p.x - l.x, p.y - l.y, p.z - l.z);
  }

  private playChord(t: number, notes: number[]): void {
    const ctx = this.ctx!;
    const dur = 11.5;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(800, t + dur);
    filter.Q.value = 0.6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.09, t + 3.2);
    env.gain.setValueAtTime(0.09, t + dur - 4);
    env.gain.linearRampToValueAtTime(0, t + dur);
    filter.connect(env);
    env.connect(this.musicBus);
    const send = ctx.createGain();
    send.gain.value = 0.7;
    env.connect(send).connect(this.reverbSend);
    for (const n of notes) {
      for (const [type, detune, level] of [
        ['triangle', -7, 0.5],
        ['sawtooth', 6, 0.12],
        ['sine', 0, 0.4],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midiHz(n);
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = level / notes.length;
        o.connect(g).connect(filter);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  private playBell(t: number, freq: number, level: number, bus: AudioNode = this.musicBus): void {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(level, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.01;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o1.connect(env);
    o2.connect(g2).connect(env);
    env.connect(bus);
    // echo
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    env.connect(delay);
    delay.connect(fb).connect(delay);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    delay.connect(wet).connect(bus);
    env.connect(this.reverbSend);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 3.1);
    o2.stop(t + 3.1);
    window.setTimeout(() => {
      wet.disconnect();
      delay.disconnect();
    }, (t - ctx.currentTime + 5) * 1000);
  }

  private playBird(t: number): void {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.ambientBus);
    const base = 2600 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    let tt = t;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      const g = ctx.createGain();
      const len = 0.06 + Math.random() * 0.08;
      const f0 = base * (0.9 + Math.random() * 0.3);
      o.frequency.setValueAtTime(f0, tt);
      o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.5 : 0.7), tt + len);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.025, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + len);
      o.connect(g).connect(pan);
      o.start(tt);
      o.stop(tt + len + 0.02);
      tt += len + 0.03 + Math.random() * 0.06;
    }
  }

  private blip(t: number, out: AudioNode, level = 0.05): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const f = 300 + Math.random() * 900;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }

  // ---------------------------------------------------------------------------------------
  // One-shot effects
  // ---------------------------------------------------------------------------------------

  play(name: SfxName, opts: { position?: Vec3; volume?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.005;
    const vol = opts.volume ?? 1;
    let out: AudioNode = this.sfxBus;
    if (opts.position) {
      const p = this.makePanner(opts.position, 1.5, 1.3, 40);
      p.connect(this.sfxBus);
      out = p;
    }
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(out);
    switch (name) {
      case 'click':
        this.tone(t, 1320, 0.08, 0.11, g, 'sine');
        this.tone(t, 1980, 0.06, 0.05, g, 'sine');
        break;
      case 'hover':
        if (t - this.lastHover < 0.05) return;
        this.lastHover = t;
        this.tone(t, 2640, 0.03, 0.03, g, 'sine');
        break;
      case 'toggleOn':
        [72, 76, 79, 84].forEach((m, i) => this.tone(t + i * 0.07, midiHz(m), 0.35, 0.09, g, 'triangle', true));
        break;
      case 'toggleOff':
        [79, 76, 72].forEach((m, i) => this.tone(t + i * 0.08, midiHz(m), 0.3, 0.08, g, 'triangle', true));
        break;
      case 'pickup':
        this.sweep(t, 320, 980, 0.14, 0.08, g);
        this.tone(t + 0.12, 1560, 0.08, 0.05, g, 'sine');
        break;
      case 'drop':
        this.sweep(t, 760, 300, 0.16, 0.06, g);
        break;
      case 'throw':
        this.noiseBurst(t, 0.22, 0.12, g, 'bandpass', 1800, 900);
        break;
      case 'stepTile':
        this.noiseBurst(t, 0.035, 0.07 * (0.8 + Math.random() * 0.4), g, 'bandpass', 2600 + Math.random() * 600, 2000);
        this.tone(t, 110 + Math.random() * 20, 0.05, 0.05, g, 'sine');
        break;
      case 'stepGrass':
        this.noiseBurst(t, 0.07, 0.05 * (0.8 + Math.random() * 0.4), g, 'lowpass', 1900, 900);
        break;
      case 'stepMetal':
        this.noiseBurst(t, 0.03, 0.05, g, 'bandpass', 4200, 3000);
        this.tone(t, 880 + Math.random() * 80, 0.12, 0.025, g, 'triangle');
        break;
      case 'stepWater':
        this.noiseBurst(t, 0.16, 0.09, g, 'bandpass', 900 + Math.random() * 300, 500);
        for (let i = 0; i < 3; i++) this.blip(t + 0.03 + Math.random() * 0.12, g, 0.03);
        break;
      case 'jump':
        this.noiseBurst(t, 0.08, 0.03, g, 'lowpass', 900, 600);
        break;
      case 'land':
        this.tone(t, 90, 0.12, 0.12 * vol, g, 'sine');
        this.noiseBurst(t, 0.06, 0.06, g, 'lowpass', 1200, 600);
        break;
      case 'splash':
        this.noiseBurst(t, 0.5, 0.2, g, 'lowpass', 3500, 500);
        for (let i = 0; i < 6; i++) this.blip(t + 0.05 + Math.random() * 0.35, g, 0.05);
        break;
      case 'impact':
        this.tone(t, 160 + Math.random() * 40, 0.1, 0.14, g, 'sine');
        this.tone(t, 1700 + Math.random() * 300, 0.18, 0.04, g, 'sine');
        break;
      case 'valve':
        this.noiseBurst(t, 0.25, 0.12, g, 'lowpass', 400, 200);
        this.tone(t + 0.05, 220, 0.6, 0.05, g, 'triangle', true);
        this.tone(t + 0.25, 330, 0.6, 0.04, g, 'triangle', true);
        break;
      case 'zone':
        this.tone(t, midiHz(79), 1.2, 0.05, g, 'sine', true);
        this.tone(t + 0.18, midiHz(86), 1.4, 0.045, g, 'sine', true);
        break;
      case 'error':
        this.tone(t, 330, 0.12, 0.06, g, 'triangle');
        this.tone(t + 0.1, 262, 0.16, 0.06, g, 'triangle');
        break;
    }
  }

  private tone(t: number, freq: number, dur: number, level: number, out: AudioNode, type: OscillatorType, reverb = false): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    if (reverb) {
      const s = ctx.createGain();
      s.gain.value = 0.5;
      g.connect(s).connect(this.reverbSend);
    }
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sweep(t: number, f0: number, f1: number, dur: number, level: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(t: number, dur: number, level: number, out: AudioNode, type: BiquadFilterType, f0: number, f1: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    f.Q.value = type === 'bandpass' ? 1.2 : 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + Math.min(0.008, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  // ---------------------------------------------------------------------------------------

  private makeNoise(brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    // Crossfade the loop seam.
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
    }
    return buf;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  dispose(): void {
    if (this.scheduler !== null) window.clearInterval(this.scheduler);
    this.scheduler = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
