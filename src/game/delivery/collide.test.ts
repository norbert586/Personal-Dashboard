import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAVEMENT, driveCar, newCar, speedMph } from './car.ts';
import { collide, fence } from './collide.ts';
import { SegGrid } from './grid.ts';

const gas = { gas: 1, back: 0, steer: 0, handbrake: false };

test('a wall straight ahead stops the car, nose against it', () => {
  const walls = new SegGrid(24);
  walls.add(-20, 40, 20, 40, 1);
  const car = newCar(0, 0, 0);
  let hardest = 0;
  for (let i = 0; i < 60 * 8; i++) {
    driveCar(car, gas, PAVEMENT, 1 / 60);
    hardest = Math.max(hardest, collide(car, walls));
  }
  assert.ok(hardest > 8, `hit at ${hardest.toFixed(1)} m/s`);
  // The front circle (1.1 m ahead of the centre of mass, 0.95 m wide) rests on the wall.
  assert.ok(car.y < 40 - 1.95 && car.y > 40 - 2.3, `stopped at ${car.y.toFixed(2)}`);
  assert.ok(speedMph(car) < 4);
});

test('clipping a wall at a shallow angle scrapes along it', () => {
  const walls = new SegGrid(24);
  walls.add(3, -50, 3, 400, 1);
  const car = newCar(0, 0, 0.12);
  for (let i = 0; i < 60 * 5; i++) {
    driveCar(car, gas, PAVEMENT, 1 / 60);
    collide(car, walls);
  }
  assert.ok(car.x < 3 - 0.9, 'never through the wall');
  assert.ok(car.y > 40 && speedMph(car) > 20, 'still moving along it');
});

test("the zone's edge turns the car back", () => {
  const car = newCar(0, 99, 0);
  car.vy = 20;
  car.y = 101;
  assert.equal(fence(car, 100), true);
  assert.deepEqual([car.y, car.vy], [100, 0]);
  assert.equal(fence(car, 100), false);
});
