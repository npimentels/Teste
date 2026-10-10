import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics/Collision';
import { Terrain } from '../src/physics/Terrain';
import { PlayerController, type ControlInput } from '../src/player/PlayerController';

function makeInput(keys: string[] = []) {
  const down = new Set(keys);
  const pressed = new Set<string>();
  const input: ControlInput & { press(code: string): void; clearPressed(): void; hold(keys: string[]): void } = {
    isDown: (c: string) => down.has(c),
    wasPressed: (c: string) => pressed.has(c),
    consumeMouse: (o: { x: number; y: number }) => {
      o.x = 0;
      o.y = 0;
    },
    press: (c: string) => pressed.add(c),
    clearPressed: () => pressed.clear(),
    hold: (k: string[]) => {
      down.clear();
      k.forEach((c) => down.add(c));
    },
  };
  return input;
}

function setup(water: (x: number, z: number) => number | null = () => null) {
  const world = new CollisionWorld(new Terrain(0));
  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, { collision: world, waterSurfaceAt: water, surfaceAt: () => 'tile' });
  player.teleport(0, 0, 0, 0, 0);
  return { world, player, camera };
}

function run(player: PlayerController, input: ReturnType<typeof makeInput>, seconds: number, jumpFrame = -1) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    if (i === jumpFrame) input.press('Space');
    player.update(1 / 60, input);
    input.clearPressed();
  }
}

describe('PlayerController', () => {
  it('walks forward (−Z at yaw 0) at roughly walking speed', () => {
    const { player } = setup();
    run(player, makeInput(['KeyW']), 2);
    expect(player.position.z).toBeLessThan(-7);
    expect(player.position.z).toBeGreaterThan(-8.6);
    expect(player.grounded).toBe(true);
  });

  it('runs faster with Shift', () => {
    const a = setup();
    run(a.player, makeInput(['KeyW']), 2);
    const b = setup();
    run(b.player, makeInput(['KeyW', 'ShiftLeft']), 2);
    expect(Math.abs(b.player.position.z)).toBeGreaterThan(Math.abs(a.player.position.z) * 1.5);
  });

  it('is stopped by walls and slides along them', () => {
    const { world, player } = setup();
    world.addBox({ x: 0, z: -3, sx: 20, sz: 0.4, minY: 0, maxY: 3 });
    player.yaw = Math.PI / 8; // walk diagonally into the wall
    run(player, makeInput(['KeyW']), 3);
    expect(player.position.z).toBeGreaterThan(-3 + 0.2 + 0.3);
    expect(player.position.x).toBeLessThan(-0.5); // slid sideways along the wall
  });

  it('does not tunnel through a thin wall even when sprinting with a large frame time', () => {
    const { world, player } = setup();
    world.addBox({ x: 0, z: -2, sx: 20, sz: 0.1, minY: 0, maxY: 3 });
    const input = makeInput(['KeyW', 'ShiftLeft']);
    for (let i = 0; i < 40; i++) player.update(0.05, input);
    expect(player.position.z).toBeGreaterThan(-2);
  });

  it('steps up low obstacles but not tall ones', () => {
    const low = setup();
    low.world.addBox({ x: 0, z: -3, sx: 4, sz: 2, minY: 0, maxY: 0.3 });
    run(low.player, makeInput(['KeyW']), 0.9);
    expect(low.player.position.y).toBeCloseTo(0.3, 2);

    const tall = setup();
    tall.world.addBox({ x: 0, z: -3, sx: 4, sz: 2, minY: 0, maxY: 0.8 });
    run(tall.player, makeInput(['KeyW']), 1.5);
    expect(tall.player.position.y).toBeCloseTo(0, 3);
    expect(tall.player.position.z).toBeGreaterThan(-2 - 0.001);
  });

  it('jumps onto a ledge it cannot step onto', () => {
    const { world, player } = setup();
    world.addBox({ x: 0, z: -4, sx: 4, sz: 4, minY: 0, maxY: 0.8 });
    const input = makeInput(['KeyW']);
    run(player, input, 0.45);
    run(player, input, 0.6, 0);
    input.hold([]);
    run(player, input, 0.6);
    expect(player.position.y).toBeCloseTo(0.8, 2);
    expect(player.grounded).toBe(true);
  });

  it('only jumps when grounded', () => {
    const { player } = setup();
    const input = makeInput();
    run(player, input, 0.1, 0);
    const vy = player.velocity.y;
    expect(vy).toBeGreaterThan(0);
    input.press('Space');
    player.update(1 / 60, input);
    expect(player.velocity.y).toBeLessThan(vy); // second press mid-air did nothing
  });

  it('climbs ramps and stays glued when walking down', () => {
    const { world, player } = setup();
    world.addRamp({ x: 0, z: -10, sx: 3, sz: 16, minY: 0, y0: 4, y1: 0 }); // rises towards −Z
    run(player, makeInput(['KeyW']), 3.6);
    expect(player.position.y).toBeGreaterThan(2.8);
    expect(player.grounded).toBe(true);
    const back = makeInput(['KeyS']);
    let airborneFrames = 0;
    for (let i = 0; i < 180; i++) {
      player.update(1 / 60, back);
      if (!player.grounded) airborneFrames++;
    }
    expect(airborneFrames).toBeLessThan(5);
  });

  it('wades slower in shallow water', () => {
    const dry = setup();
    run(dry.player, makeInput(['KeyW']), 1.5);
    const wet = setup(() => 0.3);
    run(wet.player, makeInput(['KeyW']), 1.5);
    expect(wet.player.inWater).toBe(true);
    expect(Math.abs(wet.player.position.z)).toBeLessThan(Math.abs(dry.player.position.z) * 0.75);
  });

  it('respawns after falling out of the world', () => {
    const { world, player } = setup();
    world.terrain.outline = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    player.setSpawn(0, 0, 0, 0);
    run(player, makeInput(['KeyW']), 4);
    expect(player.position.y).toBeGreaterThanOrEqual(-25);
  });

  it('keeps the camera at eye height and clamps pitch', () => {
    const { player, camera } = setup();
    player.teleport(0, 0, 0, 0, 3);
    expect(player.pitch).toBeLessThan(Math.PI / 2);
    expect(camera.position.y).toBeCloseTo(player.tuning.eyeHeight, 2);
  });
});
