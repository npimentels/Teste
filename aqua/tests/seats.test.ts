import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from '../src/physics/Collision';
import { Terrain } from '../src/physics/Terrain';
import { PlayerController } from '../src/player/PlayerController';
import { SeatController, yawFacing } from '../src/systems/Seats';

const idle = (pressed: string[] = []) => ({
  isDown: () => false,
  wasPressed: (c: string) => pressed.includes(c),
  consumeMouse: (o: { x: number; y: number }) => {
    o.x = 0;
    o.y = 0;
  },
});

function setup() {
  const world = new CollisionWorld(new Terrain(0));
  const camera = new THREE.PerspectiveCamera();
  const player = new PlayerController(camera, { collision: world, waterSurfaceAt: () => null, surfaceAt: () => 'tile' });
  player.teleport(0, 0, 0, 0, 0);
  const seats = new SeatController(player);
  return { player, camera, seats };
}

function run(player: PlayerController, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) player.update(1 / 60, idle());
}

describe('seats', () => {
  it('sits, looks from the seat, then stands back where the body was', () => {
    const { player, camera, seats } = setup();
    const seat = seats.add({ id: 's', x: 1, y: 0.47, z: -1, yaw: yawFacing(1, 0) });
    seat.interact();
    expect(seats.active).toBe(true);
    expect(player.busy).toBe(true);
    run(player, 1.5);
    expect(camera.position.x).toBeCloseTo(1 - 0.12, 1); // eye sits back towards the backrest
    expect(camera.position.y).toBeCloseTo(0.47 + 0.8, 1);
    expect(player.position.x).toBeCloseTo(0, 5); // body did not move
    seats.update(idle(['KeyE']) as never);
    expect(seats.active).toBe(false);
    run(player, 1.5);
    expect(player.busy).toBe(false);
    expect(camera.position.y).toBeGreaterThan(1.4);
    expect(player.position.x).toBeCloseTo(0, 5);
  });

  it('refuses seats that are out of reach and seats already occupied', () => {
    const { seats } = setup();
    const far = seats.add({ id: 'far', x: 6, y: 0.47, z: 0, yaw: 0 });
    far.interact();
    expect(seats.active).toBe(false);
    const near = seats.add({ id: 'near', x: 1, y: 0.47, z: 0, yaw: 0 });
    near.interact();
    expect(seats.current?.id).toBe('near');
    const o = new THREE.Vector3(0, 1.6, 0);
    expect(near.hitTest(o, new THREE.Vector3(1, -1, 0).normalize())).toBe(-1);
  });

  it('a seat on a moving parent follows it (train seats)', () => {
    const { seats } = setup();
    const car = new THREE.Group();
    const seat = seats.add({ id: 'train', x: 1, y: 0.5, z: 0, yaw: 0, parent: car });
    car.position.z = -50;
    car.updateMatrixWorld(true);
    expect(seat.refresh().z).toBeCloseTo(-50);
    const eye = seat.eye(new THREE.Vector3());
    expect(eye.y).toBeCloseTo(1.3);
  });

  it('yawFacing matches the camera convention (yaw 0 looks towards −Z)', () => {
    expect(yawFacing(0, -1)).toBeCloseTo(0);
    expect(Math.abs(yawFacing(0, 1))).toBeCloseTo(Math.PI);
    expect(yawFacing(-1, 0)).toBeCloseTo(Math.PI / 2);
  });
});
