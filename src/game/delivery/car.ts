/**
 * The car (ADR-036): our own model, pure and stepped at a fixed rate, so tests can drive it. It's
 * meant to be light and fun rather than a hard sim: an engine with a torque curve, an automatic
 * gearbox that cuts power for a moment on each shift, and two axles of tyres that grip, slide when
 * pushed and come back. Nothing steers, brakes or corrects for you.
 *
 * Headings are compass headings in radians: 0 is north, clockwise. Positions are zone metres.
 */

/**
 * Every tuning value in one place, to adjust by feel. The car is Norbert's: a 2006 Chevrolet HHR
 * with the 2.4 litre engine and the four-speed automatic. Its size, weight, tyres and gearing are
 * the real car's; grip, the engine's pull and the steering are set by feel, a little livelier
 * than the real car: about six and a half seconds to 60, and a tighter turning circle.
 */
export const CAR = {
  /** The car and its driver, in kg. */
  mass: 1510,
  /** Resistance to turning, in kg·m². Lower is more eager to rotate. */
  inertia: 2000,
  /** Centre of mass to the front and rear axles, in metres: the engine sits over the front. */
  front: 1.05,
  rear: 1.58,
  /** How high the centre of mass sits: more height shifts more weight under braking. */
  height: 0.58,
  wheelRadius: 0.32,
  /** Tyre grip on dry pavement, and how sharply the tyres answer a slip angle. */
  grip: 1.15,
  stiffnessFront: 9.5,
  stiffnessRear: 11.5,
  /**
   * Past the limit a sliding tyre keeps this share of its grip. The rear keeps more than the
   * front, so a slide straightens itself out instead of going on round.
   */
  slideFront: 0.8,
  slideRear: 0.97,
  /**
   * The rear tyres' grip next to the front's. A little over 1 makes the nose push wide before
   * the tail steps out, as a front-heavy wagon does.
   */
  rearGrip: 1.12,
  /** The rear tyres' grip with the handbrake on. */
  handbrakeGrip: 0.6,
  /** Engine: peak torque (N·m) at `peakRpm`, falling away either side over `torqueSpan` rpm. */
  torque: 320,
  peakRpm: 4800,
  torqueSpan: 6200,
  idleRpm: 800,
  redline: 6500,
  /** How far the torque converter lets the engine rev at a standstill. */
  stallRpm: 2400,
  gears: [2.96, 1.62, 1, 0.68],
  reverse: 2.14,
  /** The fastest the car will back up, in metres a second. */
  reverseTop: 9,
  finalDrive: 3.91,
  efficiency: 0.9,
  /** Seconds a gear change takes, and the share of power that still gets through during it. */
  shiftTime: 0.3,
  shiftPower: 0.12,
  /** Upshift at this many rpm on a light throttle, and this many with your foot down. */
  shiftUpLight: 2400,
  shiftUpHard: 6400,
  shiftDownLight: 1150,
  shiftDownHard: 3300,
  /** Seconds a new gear is held before the gearbox thinks again, so it never hunts. */
  shiftHold: 0.55,
  brakeForce: 15500,
  /** The share of braking done by the front wheels. */
  brakeBias: 0.74,
  /**
   * The most of its tyres' grip each axle's brakes may use. The rear is held well back, as a
   * proportioning valve does, so the tail stays planted when the weight pitches forward.
   */
  brakeCapFront: 0.96,
  brakeCapRear: 0.55,
  /**
   * How much of a tyre's cornering grip is taken away by driving it hard, and by braking the
   * front hard. The rear's brakes count as driving: they take less.
   */
  driveSteals: 0.5,
  brakeSteals: 0.93,
  drag: 0.62,
  rolling: 190,
  engineBraking: 0.38,
  /** The most the front wheels turn, in radians: a 31 foot turning circle (the real car's is 36). */
  steerLock: 0.68,
  /**
   * At speed, full lock asks for this many times the grip the tyres have: a little over 1 puts
   * the front right at its limit without pushing it wide.
   */
  steerOver: 1.1,
  /** How fast the wheel goes to full lock and back to centre, in locks a second. */
  steerRate: 6,
  steerReturn: 8,
  /** How quickly the gas and the brake come on and off, per second. */
  pedalRate: 7,
  brakeRate: 6,
} as const;

const G = 9.81;
const STEP = 1 / 120;
const MPH = 2.236936;

export interface CarState {
  x: number;
  y: number;
  heading: number;
  /** Velocity over the ground, east and north, in metres a second. */
  vx: number;
  vy: number;
  /** Turning speed in radians a second, clockwise. */
  yawRate: number;
  /** Front wheel angle in radians, right positive. */
  steer: number;
  /** How far the steering wheel is turned, -1 full left to 1 full right. */
  wheel: number;
  rpm: number;
  /** -1 is reverse, 1 and up are the forward gears. */
  gear: number;
  /** Seconds left in a gear change. */
  shifting: number;
  /** Seconds since the last gear change finished. */
  sinceShift: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  /** 0 to 1: how hard the tyres are sliding, for the squeal and the skid. */
  slip: number;
  /** Acceleration felt in the car, forward and to the right, in m/s²: the body leans on these. */
  ax: number;
  ay: number;
  /** Whether each pedal was down a moment ago: reverse wants a fresh press, not a held brake. */
  wasGas: boolean;
  wasBack: boolean;
  /** Counts gear changes, so the sound and the body can react to each one. */
  shifts: number;
  /** Seconds the leftover time from the last frame, carried into the next. */
  carry: number;
}

export interface CarInput {
  /** The forward pedal, 0 to 1. In reverse it brakes. */
  gas: number;
  /** The back pedal, 0 to 1: the brake, and reverse when pressed again from a stop. */
  back: number;
  /** -1 full left to 1 full right. */
  steer: number;
  handbrake: boolean;
}

export interface Surface {
  /** Grip compared with dry pavement: 1 on the road, less on grass. */
  grip: number;
  /** Extra rolling drag compared with pavement: 1 on the road. */
  drag: number;
}

export const PAVEMENT: Surface = { grip: 1, drag: 1 };
export const GRASS: Surface = { grip: 0.62, drag: 7 };

export function newCar(x: number, y: number, heading: number): CarState {
  return {
    x,
    y,
    heading,
    vx: 0,
    vy: 0,
    yawRate: 0,
    steer: 0,
    wheel: 0,
    rpm: CAR.idleRpm,
    gear: 1,
    shifting: 0,
    sinceShift: 1,
    throttle: 0,
    brake: 0,
    handbrake: false,
    slip: 0,
    ax: 0,
    ay: 0,
    wasGas: false,
    wasBack: false,
    shifts: 0,
    carry: 0,
  };
}

/** Speed along the car's nose, in metres a second: negative when rolling backwards. */
export function forwardSpeed(car: CarState): number {
  return car.vx * Math.sin(car.heading) + car.vy * Math.cos(car.heading);
}

export const speedMph = (car: CarState): number => Math.hypot(car.vx, car.vy) * MPH;

/** What the gear indicator shows. */
export function gearLabel(car: CarState): string {
  if (car.gear < 0) return 'R';
  return Math.hypot(car.vx, car.vy) < 0.15 && car.throttle < 0.05 ? 'P' : String(car.gear);
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const toward = (v: number, target: number, step: number) =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step);

const ratioOf = (gear: number) => (gear < 0 ? CAR.reverse : CAR.gears[gear - 1]!) * CAR.finalDrive;
/** Engine speed for a road speed in a gear, as if the clutch were locked. */
const rpmAt = (speed: number, gear: number) =>
  (Math.abs(speed) / (2 * Math.PI * CAR.wheelRadius)) * 60 * ratioOf(gear);

function torqueAt(rpm: number): number {
  const off = (rpm - CAR.peakRpm) / CAR.torqueSpan;
  return CAR.torque * Math.max(0.3, 1 - off * off) * (rpm > CAR.redline ? 0.2 : 1);
}

/** A tyre's sideways force for a slip angle: it builds, peaks at the limit, then gives a little. */
function tyre(slipAngle: number, stiffness: number, limit: number, slide: number): number {
  const wanted = -stiffness * slipAngle * limit;
  const over = Math.abs(wanted) / limit;
  if (over <= 1) return wanted;
  const kept = slide + (1 - slide) / over;
  return Math.sign(wanted) * limit * kept;
}

function shiftTo(car: CarState, gear: number): void {
  car.gear = gear;
  car.shifting = CAR.shiftTime;
  car.sinceShift = 0;
  car.shifts++;
}

/** The automatic: when to change gear, from the revs and how hard you're asking. */
function gearbox(car: CarState, speed: number, dt: number): void {
  if (car.shifting > 0) {
    car.shifting = Math.max(0, car.shifting - dt);
    return;
  }
  car.sinceShift += dt;
  if (car.gear < 1) return;
  // Nearly stopped: it's in first by the time you pull away.
  if (Math.abs(speed) < 2 && car.gear > 1) car.gear = 1;
  if (car.sinceShift < CAR.shiftHold) return;
  const ask = Math.pow(car.throttle, 1.3);
  const locked = rpmAt(speed, car.gear);
  const up = CAR.shiftUpLight + (CAR.shiftUpHard - CAR.shiftUpLight) * ask;
  const down = CAR.shiftDownLight + (CAR.shiftDownHard - CAR.shiftDownLight) * ask;
  if (locked > up && car.gear < CAR.gears.length) shiftTo(car, car.gear + 1);
  else if (locked < down && car.gear > 1 && rpmAt(speed, car.gear - 1) < CAR.shiftUpHard - 400)
    shiftTo(car, car.gear - 1);
}

/** One fixed step of the model. */
function step(car: CarState, input: CarInput, surface: Surface, dt: number): void {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  // Velocity in the car's own frame: along its nose, and out its right side.
  let vf = car.vx * sin + car.vy * cos;
  let vr = car.vx * cos - car.vy * sin;
  const speed = Math.hypot(vf, vr);

  // ---- Pedals: forward and back swap jobs in reverse. Changing direction takes a fresh press
  // from a stop, so holding the brake at a light holds the car instead of backing it up.
  const still = Math.abs(vf) < 0.6;
  const gasDown = input.gas > 0.1;
  const backDown = input.back > 0.1;
  if (car.gear > 0 && still && backDown && !car.wasBack && !gasDown) {
    car.gear = -1;
    car.shifts++;
  } else if (car.gear < 0 && still && gasDown && !car.wasGas && !backDown) {
    car.gear = 1;
    car.shifts++;
  }
  car.wasGas = gasDown;
  car.wasBack = backDown;
  const reversing = car.gear < 0;
  car.throttle = toward(car.throttle, reversing ? input.back : input.gas, CAR.pedalRate * dt);
  const brakeAsk = reversing ? input.gas : input.back;
  // The brake comes on over a moment, so a tapped key is a dab; it lets go at once.
  car.brake = toward(car.brake, brakeAsk, (brakeAsk < car.brake ? 12 : CAR.brakeRate) * dt);
  car.handbrake = input.handbrake;

  // ---- Steering: the wheel takes the same moment to reach full lock at any speed, and full
  // lock is less the faster you go, so a tap on the motorway is a nudge, not a swerve.
  const lock = Math.min(
    CAR.steerLock,
    CAR.steerOver * Math.atan(((CAR.front + CAR.rear) * CAR.grip * G) / Math.max(1, speed * speed)),
  );
  const want = clamp(input.steer, -1, 1);
  const rate = Math.abs(want) < Math.abs(car.wheel) ? CAR.steerReturn : CAR.steerRate;
  car.wheel = toward(car.wheel, want, rate * dt);
  car.steer = car.wheel * lock;

  gearbox(car, vf, dt);

  // ---- Engine: revs follow the wheels, with the converter slipping at low speed.
  const locked = rpmAt(vf, car.gear);
  const slipping = CAR.idleRpm + (CAR.stallRpm - CAR.idleRpm) * car.throttle;
  const target = Math.min(CAR.redline + 150, Math.max(locked, slipping));
  car.rpm += (target - car.rpm) * Math.min(1, dt * (car.shifting > 0 ? 14 : 9));
  const direction = reversing ? -1 : 1;
  // Reverse runs out of push at a brisk jog.
  const power = car.shifting > 0 ? CAR.shiftPower : reversing && vf < -CAR.reverseTop ? 0 : 1;
  let drive =
    ((torqueAt(car.rpm) * car.throttle * power * ratioOf(car.gear) * CAR.efficiency) /
      CAR.wheelRadius) *
    direction;
  // Lifting off slows the car through the engine, more in the low gears.
  if (car.throttle < 0.05 && speed > 0.5)
    drive -= Math.sign(vf) * CAR.engineBraking * ratioOf(car.gear) * 28;

  // ---- Weight on each axle: braking loads the front, accelerating the rear.
  const base = CAR.front + CAR.rear;
  const most = CAR.mass * G * 0.17;
  const shift = clamp((CAR.mass * car.ax * CAR.height) / base, -most, most);
  const loadFront = Math.max(800, (CAR.mass * G * CAR.rear) / base - shift);
  const loadRear = Math.max(800, (CAR.mass * G * CAR.front) / base + shift);
  const mu = CAR.grip * surface.grip;
  const limitFront = mu * loadFront;
  const limitRear = mu * CAR.rearGrip * loadRear * (car.handbrake ? CAR.handbrakeGrip : 1);

  // ---- Along the car: drive at the front wheels, brakes at all four, drag and rolling.
  const braking = car.brake * CAR.brakeForce;
  const brakeFront = Math.min(braking * CAR.brakeBias, limitFront * CAR.brakeCapFront);
  let brakeRear = Math.min(braking * (1 - CAR.brakeBias), limitRear * CAR.brakeCapRear);
  if (car.handbrake) brakeRear = Math.max(brakeRear, limitRear * 0.95);
  drive = clamp(drive, -limitFront, limitFront);
  const rolling = CAR.rolling * surface.drag;
  const resist = (brakeFront + brakeRear + rolling) * (speed > 0.05 ? 1 : 0);
  // Brakes and rolling drag act against whichever way the car is moving.
  const along = drive * Math.cos(car.steer) - CAR.drag * vf * Math.abs(vf);
  const stopping = resist * (Math.abs(vf) > 0.02 ? Math.sign(vf) : 0);

  // ---- Across the car: each axle's tyres push back against sliding sideways. A tyre that's
  // driving or braking hard has less left over for cornering.
  const left = (limit: number, driving: number, stopping: number) => {
    const d = Math.min(1, driving / Math.max(1, limit));
    const b = Math.min(1, stopping / Math.max(1, limit));
    return limit * Math.sqrt(Math.max(0.1, 1 - d * d * CAR.driveSteals - b * b * CAR.brakeSteals));
  };
  // Below a jog the tyres aren't slipping, they're rolling where they point: the forces fade
  // out there and the car follows its wheels (below), so it turns tightly at any throttle.
  const bite = smooth(1.2, 4.5, speed);
  const reach = Math.max(Math.abs(vf), 2.2);
  const slipFront =
    Math.atan2(vr + CAR.front * car.yawRate, reach) - car.steer * Math.sign(vf || 1);
  const slipRear = Math.atan2(vr - CAR.rear * car.yawRate, reach);
  const sideFront =
    tyre(
      slipFront,
      CAR.stiffnessFront,
      left(limitFront, Math.abs(drive), brakeFront),
      CAR.slideFront,
    ) * bite;
  const sideRear =
    tyre(slipRear, CAR.stiffnessRear, left(limitRear, brakeRear, 0), CAR.slideRear) * bite;

  // ---- Put it together.
  // The front wheels push along and across their own direction, so the drive pulls the nose
  // into a turn and cornering scrubs off a little speed.
  const steerSin = Math.sin(car.steer);
  const acrossFront = sideFront * Math.cos(car.steer) + drive * steerSin;
  let af = (along - sideFront * steerSin) / CAR.mass;
  const ar = (acrossFront + sideRear) / CAR.mass;
  const turn = (acrossFront * CAR.front - sideRear * CAR.rear) / CAR.inertia;

  // Brakes can stop the car but never push it backwards.
  const brakeStep = (stopping / CAR.mass) * dt;
  const before = vf + af * dt;
  vf =
    Math.abs(brakeStep) > Math.abs(before) && Math.sign(brakeStep) === Math.sign(before)
      ? 0
      : before - brakeStep;
  af = (vf - (car.vx * sin + car.vy * cos)) / dt;
  vr += ar * dt;
  car.yawRate += turn * dt;

  if (Math.abs(vf) < 0.08 && car.throttle < 0.02 && Math.abs(vr) < 0.3) {
    vf = 0;
    vr = 0;
    car.yawRate = 0;
  }
  // The forces acted along the car as it was pointing; only then does it turn.
  car.vx = vf * sin + vr * cos;
  car.vy = vf * cos - vr * sin;

  // At a crawl the tyre model has nothing to hold on to: there the car just follows its wheels,
  // turning about the point its rear axle rolls round.
  const crawl = 1 - bite;
  if (crawl > 0) car.yawRate += ((vf * Math.tan(car.steer)) / base - car.yawRate) * crawl;
  car.heading += car.yawRate * dt;
  if (crawl > 0) {
    const s2 = Math.sin(car.heading);
    const c2 = Math.cos(car.heading);
    const across = CAR.rear * car.yawRate;
    car.vx += (vf * s2 + across * c2 - car.vx) * crawl;
    car.vy += (vf * c2 - across * s2 - car.vy) * crawl;
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  const k = Math.min(1, dt * 10);
  car.ax += (af - car.ax) * k;
  car.ay += (ar - car.ay) * k;
  const sliding = Math.max(
    Math.abs(slipFront) * CAR.stiffnessFront,
    Math.abs(slipRear) * CAR.stiffnessRear,
  );
  const want2 = clamp((sliding - 0.9) / 1.2, 0, 1) * bite;
  car.slip += (want2 - car.slip) * Math.min(1, dt * 12);
}

/**
 * Drive the car for `dt` seconds of real time, in fixed steps. Leftover time carries into the
 * next call, so the car behaves the same at any frame rate. `solid` runs after every step (the
 * walls, `collide.ts`), so a hit is the same at any frame rate too; it returns how hard the car
 * hit something, and this returns the hardest hit of the frame.
 */
export function driveCar(
  car: CarState,
  input: CarInput,
  surface: Surface,
  dt: number,
  solid?: (car: CarState) => number,
): number {
  let hardest = 0;
  car.carry += Math.min(dt, 0.1);
  while (car.carry >= STEP) {
    step(car, input, surface, STEP);
    if (solid) hardest = Math.max(hardest, solid(car));
    car.carry -= STEP;
  }
  return hardest;
}
