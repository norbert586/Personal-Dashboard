import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CAR,
  GRASS,
  PAVEMENT,
  driveCar,
  forwardSpeed,
  gearLabel,
  newCar,
  speedMph,
  type CarInput,
  type CarState,
} from './car.ts';

const idle: CarInput = { gas: 0, back: 0, steer: 0, handbrake: false };
const floored: CarInput = { ...idle, gas: 1 };
const FRAME = 1 / 60;

/** Drive for some seconds, or until `until` says stop; returns the seconds driven. */
function drive(
  car: CarState,
  input: CarInput,
  seconds: number,
  until?: (car: CarState) => boolean,
  surface = PAVEMENT,
): number {
  let t = 0;
  while (t < seconds) {
    driveCar(car, input, surface, FRAME);
    t += FRAME;
    if (until?.(car)) break;
  }
  return t;
}

const finite = (car: CarState) =>
  [car.x, car.y, car.vx, car.vy, car.heading, car.yawRate, car.rpm].every(Number.isFinite);

test('at rest it stays put, in park, at idle', () => {
  const car = newCar(10, 20, 1);
  drive(car, idle, 2);
  assert.deepEqual([car.x, car.y, car.heading], [10, 20, 1]);
  assert.equal(gearLabel(car), 'P');
  assert.ok(Math.abs(car.rpm - CAR.idleRpm) < 20);
  assert.ok(finite(car));
});

test('it reaches 60 mph in about six and a half seconds, changing up through the gears', () => {
  const car = newCar(0, 0, 0);
  const gears: number[] = [];
  const t = drive(car, floored, 20, (c) => {
    if (gears.at(-1) !== c.gear) gears.push(c.gear);
    return speedMph(c) >= 60;
  });
  assert.ok(t > 6 && t < 6.7, `0 to 60 took ${t.toFixed(1)} s`);
  // Second runs to 77 mph, as the real four-speed's does.
  assert.deepEqual(gears, [1, 2]);
  // Straight north, with no wander.
  assert.ok(Math.abs(car.x) < 0.01 && car.y > 80);
});

test('each upshift cuts power for a moment and drops the revs', () => {
  const car = newCar(0, 0, 0);
  drive(car, floored, 20, (c) => c.gear === 2);
  const before = car.rpm;
  assert.ok(car.shifting > 0, 'the change takes time');
  const speed = forwardSpeed(car);
  drive(car, floored, CAR.shiftTime * 0.8);
  // Barely any push while the gear goes in.
  assert.ok(forwardSpeed(car) - speed < 0.25);
  drive(car, floored, 0.4);
  assert.ok(car.rpm < before - 1500, `${before.toFixed(0)} to ${car.rpm.toFixed(0)} rpm`);
  assert.equal(car.shifts, 1);
});

test('a light foot changes up early, and flooring it kicks down', () => {
  const car = newCar(0, 0, 0);
  let peak = 0;
  drive(car, { ...idle, gas: 0.3 }, 30, (c) => {
    peak = Math.max(peak, c.rpm);
    return c.gear === 3;
  });
  assert.equal(car.gear, 3);
  assert.ok(peak < 3600, `revved to ${peak.toFixed(0)} on a light throttle`);
  drive(car, floored, 1.2);
  assert.ok(car.gear < 3, 'kicked down');
  // Cruising, it settles into the overdrive top gear.
  drive(car, { ...idle, gas: 0.5 }, 60);
  assert.equal(car.gear, CAR.gears.length);
});

test('it tops out between 110 and 135 mph', () => {
  const car = newCar(0, 0, 0);
  drive(car, floored, 90);
  assert.ok(speedMph(car) > 110 && speedMph(car) < 135, `${speedMph(car).toFixed(0)} mph`);
  // Top gear is an overdrive: flat out, it may hold the one below.
  assert.ok(car.gear >= CAR.gears.length - 1);
});

test('it stops from 60 mph in 35 to 50 metres, and the brakes never push it backwards', () => {
  const car = newCar(0, 0, 0);
  drive(car, floored, 20, (c) => speedMph(c) >= 60);
  const from = car.y;
  drive(car, { ...idle, back: 1 }, 10, (c) => speedMph(c) < 0.2);
  const distance = car.y - from;
  assert.ok(distance > 35 && distance < 50, `stopped in ${distance.toFixed(1)} m`);
  // Still holding the brake, as at a red light: it holds, and doesn't back up.
  const stopped = car.y;
  drive(car, { ...idle, back: 1 }, 3);
  assert.equal(car.y, stopped);
  assert.ok(car.gear >= 1 && forwardSpeed(car) === 0);
});

test('from a stop, the brake pedal pressed again is reverse, and the gas is forward again', () => {
  const car = newCar(0, 0, 0);
  drive(car, { ...idle, back: 1 }, 2);
  assert.equal(gearLabel(car), 'R');
  assert.ok(forwardSpeed(car) < -2 && car.y < -1);
  // Reverse tops out at about 20 mph.
  drive(car, { ...idle, back: 1 }, 12);
  assert.ok(speedMph(car) > 15 && speedMph(car) < 24, `${speedMph(car).toFixed(0)} mph backwards`);
  // The gas is the brake in reverse; a fresh press from the stop pulls forward.
  drive(car, floored, 6, (c) => speedMph(c) < 0.1);
  drive(car, idle, 0.2);
  drive(car, floored, 3);
  assert.ok(car.gear >= 1 && forwardSpeed(car) > 2);
});

test('it turns the way you steer, tighter at low speed than at high', () => {
  const radius = (mph: number) => {
    const car = newCar(0, 0, 0);
    drive(car, floored, 30, (c) => speedMph(c) >= mph);
    drive(car, { ...idle, gas: 0.35, steer: 1 }, 2.5);
    assert.ok(car.yawRate > 0, 'steering right turns clockwise');
    return Math.hypot(car.vx, car.vy) / car.yawRate;
  };
  const slow = radius(15);
  const fast = radius(50);
  assert.ok(slow > 3 && slow < 25, `${slow.toFixed(1)} m at low speed`);
  assert.ok(fast > slow * 2, `${fast.toFixed(1)} m at speed`);
  // Left is the mirror of right.
  const car = newCar(0, 0, 0);
  drive(car, floored, 3);
  drive(car, { ...idle, gas: 0.3, steer: -1 }, 1);
  assert.ok(car.yawRate < 0 && car.heading < 0);
});

test('from a stop at full lock it turns in about 31 feet, tighter than the real car, on any throttle', () => {
  for (const gas of [0.1, 0.18]) {
    const car = newCar(0, 0, 0);
    let west = 0;
    let east = 0;
    drive(car, { ...idle, gas, steer: 1 }, 30, (c) => {
      // The outside front wheel, which draws the kerb-to-kerb circle.
      const x = c.x + Math.sin(c.heading) * CAR.front - Math.cos(c.heading) * 0.745;
      west = Math.min(west, x);
      east = Math.max(east, x);
      return c.heading > Math.PI * 2;
    });
    assert.ok(car.heading > Math.PI * 2, `went all the way round at ${gas} throttle`);
    const feet = (east - west) * 3.281;
    assert.ok(feet > 28 && feet < 34, `${feet.toFixed(0)} ft circle at ${gas} throttle`);
  }
});

test('braking hard while steering slows and turns the car without swinging the tail out', () => {
  for (const [mph, brake, steer] of [
    [40, 1, 0.3],
    [40, 0.5, 0.3],
    [30, 1, -0.6],
  ] as const) {
    const car = newCar(0, 0, 0);
    drive(car, floored, 30, (c) => speedMph(c) >= mph);
    let slid = 0;
    drive(car, { ...idle, back: brake, steer }, 8, (c) => {
      const speed = Math.hypot(c.vx, c.vy);
      // Above a jog: slower than that, a car on full lock points well inside its own path.
      if (speed > 6) {
        const off = Math.atan2(c.vx, c.vy) - c.heading;
        slid = Math.max(slid, Math.abs(Math.atan2(Math.sin(off), Math.cos(off))));
      }
      return speed < 0.1;
    });
    assert.ok(slid < 0.2, `slid ${slid.toFixed(2)} rad braking ${brake} from ${mph} mph`);
    assert.ok(Math.sign(car.heading) === Math.sign(steer), 'and it still turned');
  }
});

test('a tap of the wheel at speed is a nudge, and the wheel is quick to answer', () => {
  const car = newCar(0, 0, 0);
  drive(car, floored, 30, (c) => speedMph(c) >= 60);
  drive(car, { ...idle, gas: 0.5, steer: 1 }, 0.1);
  // Full lock in about a sixth of a second: quick, but still not a switch.
  assert.ok(car.wheel > 0.45 && car.wheel < 0.8, `wheel at ${car.wheel.toFixed(2)}`);
  drive(car, { ...idle, gas: 0.5 }, 1.5);
  assert.ok(car.heading > 0 && car.heading < 0.06, `turned ${car.heading.toFixed(3)} rad`);
  assert.ok(Math.abs(car.yawRate) < 0.01, 'and settled');
});

test('the handbrake swings the tail out in a corner, and letting go straightens it up', () => {
  const car = newCar(0, 0, 0);
  drive(car, floored, 30, (c) => speedMph(c) >= 35);
  drive(car, { ...idle, steer: 1, handbrake: true }, 0.8);
  // Sliding: the car points further round than it's travelling.
  const travel = Math.atan2(car.vx, car.vy);
  assert.ok(car.heading - travel > 0.25, `slid ${(car.heading - travel).toFixed(2)} rad`);
  assert.ok(car.slip > 0.3);
  drive(car, { ...idle, gas: 0.4 }, 4);
  const settled = Math.abs(Math.atan2(car.vx, car.vy) - car.heading);
  assert.ok(Math.min(settled, Math.PI * 2 - settled) < 0.05, 'pointing where it goes again');
  assert.ok(finite(car));
});

test('grass is slower and looser than the road', () => {
  const road = newCar(0, 0, 0);
  const grass = newCar(0, 0, 0);
  drive(road, floored, 6);
  drive(grass, floored, 6, undefined, GRASS);
  assert.ok(speedMph(grass) < speedMph(road) * 0.8);
  // Lifting off on grass slows you much sooner.
  const roadSpeed = speedMph(road);
  const grassSpeed = speedMph(grass);
  drive(road, idle, 2);
  drive(grass, idle, 2, undefined, GRASS);
  assert.ok(grassSpeed - speedMph(grass) > (roadSpeed - speedMph(road)) * 1.5);
});

test('it behaves the same at 30 frames a second as at 144', () => {
  const run = (frame: number) => {
    const car = newCar(0, 0, 0);
    for (let t = 0; t < 6 - 1e-9; t += frame)
      driveCar(car, { ...idle, gas: 1, steer: t > 3 ? 0.5 : 0 }, PAVEMENT, frame);
    return car;
  };
  const a = run(1 / 30);
  const b = run(1 / 144);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1.5, 'within a car length after six seconds');
  assert.ok(Math.abs(speedMph(a) - speedMph(b)) < 1);
});

test('wild inputs never break the numbers', () => {
  const car = newCar(0, 0, 0);
  for (let i = 0; i < 3000; i++) {
    const k = Math.sin(i * 12.9898) * 43758.5453;
    const r = k - Math.floor(k);
    driveCar(
      car,
      {
        gas: r > 0.3 ? 1 : 0,
        back: r < 0.2 ? 1 : 0,
        steer: Math.sin(i / 7) * 2,
        handbrake: r > 0.9,
      },
      i % 400 < 200 ? PAVEMENT : GRASS,
      FRAME,
    );
  }
  assert.ok(finite(car));
  assert.ok(speedMph(car) < 140);
});
