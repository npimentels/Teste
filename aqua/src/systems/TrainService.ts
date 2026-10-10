/**
 * Aqua Metro service logic (no rendering): a shuttle that dwells at each stop with doors open,
 * warns, closes its doors (re-opening if the doorway is obstructed), accelerates, cruises,
 * brakes and stops exactly at the next platform, then opens again. All durations configurable.
 *
 * Track runs along the world Z axis; positions are the Z of the train centre.
 */
export type TrainPhase = 'dwell' | 'closing' | 'waiting' | 'running' | 'opening';

export interface TrainStop {
  id: string;
  name: string;
  z: number;
  /** Seconds with doors open at this stop. */
  dwell: number;
}

export interface TrainConfig {
  stops: TrainStop[];
  /** Seconds for the doors to open or close. */
  doorTime: number;
  /** Warning (chime + announcement) this many seconds before the doors close. */
  warnTime: number;
  /** Pause between doors closed and departure. */
  departDelay: number;
  maxSpeed: number;
  accel: number;
  decel: number;
  /** Extra seconds granted each time the doorway is obstructed. */
  holdTime: number;
  /** After this many holds the obstruction is cleared (the passenger is guided out). */
  maxHolds: number;
}

export const DEFAULT_TRAIN_CONFIG: Omit<TrainConfig, 'stops'> = {
  doorTime: 2.2,
  warnTime: 4,
  departDelay: 1.2,
  maxSpeed: 22,
  accel: 1.25,
  decel: 1.15,
  holdTime: 2.5,
  maxHolds: 2,
};

export interface TrainEvents {
  onPhase?(phase: TrainPhase, stop: TrainStop): void;
  onWarning?(stop: TrainStop, next: TrainStop): void;
  onArrive?(stop: TrainStop): void;
  onDepart?(from: TrainStop, to: TrainStop): void;
  onDoorHold?(): void;
  /** The doorway stayed blocked too long: whoever is there must be moved to a safe side. */
  onForceClear?(): void;
}

export class TrainService {
  readonly config: TrainConfig;
  z: number;
  /** Signed velocity along Z (m/s). */
  v = 0;
  /** 0 = closed, 1 = fully open. */
  doors = 1;
  phase: TrainPhase = 'dwell';
  /** Index of the stop the train is at (or last left). */
  stopIndex = 0;
  /** Index of the stop it is heading to while running. */
  targetIndex = 0;
  private timer: number;
  private warned = false;
  private holds = 0;
  /** Returns true while someone stands in a doorway. */
  doorwayBlocked: () => boolean = () => false;

  constructor(config: TrainConfig, private readonly events: TrainEvents = {}, startStop = 0) {
    if (config.stops.length < 2) throw new Error('A metro line needs at least two stops');
    this.config = config;
    this.stopIndex = startStop;
    this.targetIndex = startStop;
    this.z = config.stops[startStop].z;
    this.timer = config.stops[startStop].dwell;
  }

  get stop(): TrainStop {
    return this.config.stops[this.stopIndex];
  }

  get nextStop(): TrainStop {
    return this.config.stops[this.phase === 'running' ? this.targetIndex : (this.stopIndex + 1) % this.config.stops.length];
  }

  get atStation(): boolean {
    return this.phase !== 'running';
  }

  /** Seconds left in the current dwell (0 when not dwelling). */
  get dwellLeft(): number {
    return this.phase === 'dwell' ? Math.max(0, this.timer) : 0;
  }

  /** Rough seconds until arrival at `stopId` (0 if there now with doors opening/open). */
  eta(stopId: string): number {
    const c = this.config;
    const target = c.stops.find((s) => s.id === stopId);
    if (!target) return Infinity;
    const travel = (from: number, to: number) => {
      const d = Math.abs(to - from);
      const accelDist = (c.maxSpeed * c.maxSpeed) / (2 * c.accel) + (c.maxSpeed * c.maxSpeed) / (2 * c.decel);
      if (d >= accelDist) return c.maxSpeed / c.accel + c.maxSpeed / c.decel + (d - accelDist) / c.maxSpeed;
      const vPeak = Math.sqrt((2 * d * c.accel * c.decel) / (c.accel + c.decel));
      return vPeak / c.accel + vPeak / c.decel;
    };
    if (this.phase === 'running') {
      const remaining = Math.abs(c.stops[this.targetIndex].z - this.z);
      const toTarget = remaining / Math.max(4, Math.abs(this.v) * 0.75);
      if (c.stops[this.targetIndex].id === stopId) return toTarget;
      const t2 = c.stops[this.targetIndex];
      return toTarget + c.doorTime * 2 + t2.dwell + c.departDelay + travel(t2.z, target.z);
    }
    if (this.stop.id === stopId) return 0;
    const before = this.phase === 'dwell' ? this.timer + c.doorTime + c.departDelay : this.phase === 'closing' ? this.doors * c.doorTime + c.departDelay : this.phase === 'waiting' ? this.timer : c.doorTime;
    return before + travel(this.stop.z, target.z);
  }

  update(dt: number): void {
    const c = this.config;
    switch (this.phase) {
      case 'dwell': {
        this.doors = 1;
        this.timer -= dt;
        if (!this.warned && this.timer <= c.warnTime) {
          this.warned = true;
          this.events.onWarning?.(this.stop, this.nextStop);
        }
        if (this.timer <= 0) {
          if (this.doorwayBlocked()) this.hold();
          else this.setPhase('closing');
        }
        break;
      }
      case 'closing': {
        if (this.doorwayBlocked()) {
          this.hold();
          this.setPhase('opening');
          break;
        }
        this.doors = Math.max(0, this.doors - dt / c.doorTime);
        if (this.doors <= 0) {
          this.timer = c.departDelay;
          this.setPhase('waiting');
        }
        break;
      }
      case 'waiting': {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.targetIndex = (this.stopIndex + 1) % c.stops.length;
          this.events.onDepart?.(this.stop, c.stops[this.targetIndex]);
          this.setPhase('running');
        }
        break;
      }
      case 'running':
        this.run(dt);
        break;
      case 'opening': {
        this.doors = Math.min(1, this.doors + dt / c.doorTime);
        if (this.doors >= 1) {
          if (this.timer <= 0) this.timer = c.holdTime;
          this.setPhase('dwell');
        }
        break;
      }
    }
  }

  private hold(): void {
    const c = this.config;
    if (this.holds >= c.maxHolds) {
      this.events.onForceClear?.();
      this.holds = 0;
      this.timer = 0.6;
      return;
    }
    this.holds++;
    this.timer = c.holdTime;
    this.events.onDoorHold?.();
  }

  private run(dt: number): void {
    const c = this.config;
    const target = c.stops[this.targetIndex].z;
    const remaining = target - this.z;
    const dir = Math.sign(remaining) || 1;
    let speed = Math.abs(this.v);
    const brakingDistance = (speed * speed) / (2 * c.decel);
    if (brakingDistance >= Math.abs(remaining) - 0.05) speed = Math.max(0.35, speed - c.decel * dt);
    else speed = Math.min(c.maxSpeed, speed + c.accel * dt);
    let step = speed * dt;
    if (step >= Math.abs(remaining)) {
      // exact stop at the platform mark
      step = Math.abs(remaining);
      this.z = target;
      this.v = 0;
      this.stopIndex = this.targetIndex;
      this.events.onArrive?.(this.stop);
      this.timer = this.stop.dwell;
      this.warned = false;
      this.holds = 0;
      this.setPhase('opening');
      return;
    }
    this.z += dir * step;
    this.v = dir * speed;
  }

  private setPhase(p: TrainPhase): void {
    if (p === 'closing' || p === 'dwell') {
      /* keep timers */
    }
    this.phase = p;
    this.events.onPhase?.(p, this.stop);
  }
}
