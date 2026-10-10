import { describe, expect, it } from 'vitest';
import { DEFAULT_TRAIN_CONFIG, TrainService, type TrainPhase } from '../src/systems/TrainService';

const make = (events = {}) =>
  new TrainService(
    {
      ...DEFAULT_TRAIN_CONFIG,
      stops: [
        { id: 'a', name: 'A', z: -38, dwell: 10 },
        { id: 'b', name: 'B', z: -422, dwell: 8 },
      ],
    },
    events,
  );

function runFor(t: TrainService, seconds: number, dt = 1 / 60): void {
  for (let i = 0; i < seconds / dt; i++) t.update(dt);
}

describe('TrainService', () => {
  it('runs the full cycle in order and stops exactly at the platform', () => {
    const phases: TrainPhase[] = [];
    const arrivals: string[] = [];
    const t = make({ onPhase: (p: TrainPhase) => phases.push(p), onArrive: (s: { id: string }) => arrivals.push(s.id) });
    let maxV = 0;
    for (let i = 0; i < 60 * 80; i++) {
      t.update(1 / 60);
      maxV = Math.max(maxV, Math.abs(t.v));
      if (arrivals.length) break;
    }
    expect(phases.slice(0, 4)).toEqual(['closing', 'waiting', 'running', 'opening']);
    expect(arrivals).toEqual(['b']);
    expect(t.z).toBe(-422);
    expect(t.v).toBe(0);
    expect(maxV).toBeLessThanOrEqual(DEFAULT_TRAIN_CONFIG.maxSpeed + 1e-6);
    runFor(t, 3);
    expect(t.phase).toBe('dwell');
    expect(t.doors).toBe(1);
  });

  it('never moves with the doors open', () => {
    const t = make();
    for (let i = 0; i < 60 * 200; i++) {
      t.update(1 / 60);
      if (t.phase === 'running') expect(t.doors).toBe(0);
      if (t.doors > 0) expect(t.v).toBe(0);
    }
  });

  it('shuttles back to the first stop', () => {
    const arrivals: string[] = [];
    const t = make({ onArrive: (s: { id: string }) => arrivals.push(s.id) });
    runFor(t, 160);
    expect(arrivals.slice(0, 2)).toEqual(['b', 'a']);
  });

  it('holds and re-opens when the doorway is obstructed, then forces it clear', () => {
    let blocked = true;
    let holds = 0;
    let forced = 0;
    const t = make({ onDoorHold: () => holds++, onForceClear: () => ((forced += 1), (blocked = false)) });
    t.doorwayBlocked = () => blocked;
    runFor(t, 30);
    expect(holds).toBe(DEFAULT_TRAIN_CONFIG.maxHolds);
    expect(forced).toBe(1);
    runFor(t, 10);
    expect(['waiting', 'running']).toContain(t.phase);
  });

  it('warns once before closing and reports a sensible ETA', () => {
    let warnings = 0;
    const t = make({ onWarning: () => warnings++ });
    expect(t.eta('a')).toBe(0);
    const eta = t.eta('b');
    expect(eta).toBeGreaterThan(30);
    expect(eta).toBeLessThan(70);
    runFor(t, 12);
    expect(warnings).toBe(1);
  });
});
