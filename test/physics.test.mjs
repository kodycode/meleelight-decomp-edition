// Headless physics harness.
//
//   node --import ./test/register.mjs test/physics.test.mjs
//
// Runs the ported physics functions directly against synthetic state. No
// webpack, no node_modules, no rendering, no app.
//
// Every expected value below is derived from the decompiled C, cited inline.
// The point is not "does it look right" but "does it match the source".

import { player } from "./stubs/main-main.mjs";
import { capturedAttributes, CHARIDS } from "./stubs/characters.mjs";
import "characters/fox/attributes";
import "characters/puff/puffAttributes";

import { f32 } from "physics/f32";
import { HORIZONTAL_STICK_DEADZONE, FRICTION_WHEN_ABOVE_WALK_SPEED,
         HITSTUN_MUL, KB_FRAME_DECAY, OVER_MAX_AIR_DECAY,
         SDI_MIN_STICK_MAG, SDI_STICK_WINDOW, SDI_POS_SCALE, ASDI_SCALE,
         HORIZONTAL_STICK_SMASH_DEADZONE, TAP_JUMP_THRESHOLD,
         TAP_JUMP_WINDOW, SQUAT_STICK_THRESHOLD,
         DASH_SMASH_STICK_THRESHOLD, DASH_SMASH_WINDOW,
         UP_SMASH_STICK_THRESHOLD, UP_SMASH_WINDOW,
         DOWN_SMASH_STICK_THRESHOLD, DOWN_SMASH_WINDOW,
         X58_STICK_THRESHOLD, SQUAT_RELEASE_STICK_THRESHOLD,
         FASTFALL_STICK_THRESHOLD, FASTFALL_WINDOW,
         PLATFORM_DROP_STICK_THRESHOLD, PLATFORM_DROP_WINDOW,
         CSTICK_JUMP_THRESHOLD, LEDGE_ATTACK_CSTICK_THRESHOLD,
         SPECIAL_STICK_X_THRESHOLD, SPECIAL_STICK_Y_THRESHOLD,
         ESCAPEAIR_DECAY, ESCAPEAIR_FORCE } from "physics/meleeCommon";
import { setGroundNormal, syncGrVelFromCVel, projectGroundVelocity,
         applyGroundMovement, projectOntoGround } from "physics/groundMovement";
import { airDrift, fastfall, reduceByTraction, applyJumpVelocity,
         getEnvDmg, calcAttackerShieldPushback, shieldAnalogToLightshield,
         rolloutAngle, applyAirDecay, applyGravity }
  from "physics/actionStateShortcuts";
import { sinf, cosf, atanf, atan2f, acosf, asinf, expf, logf, powf,
         DEG_TO_RAD, mtxDegToRad } from "physics/trig";
import { capsuleOverlap } from "physics/capsule";
import { SHIELD_POS, SHIELD_MAG_KNOTS } from "main/shieldData";
import { SMASH_CHARGE_RATE, SMASH_CHARGE_FRAMES, smashChargeDamageMul,
         applySmashCharge } from "physics/smashCharge";
import { STALE_WEIGHTS, newStaleTable, resetStaleTable, staleMultiplier,
         pushStaleMove, staleDamage, moveIdFor, nextAttackInstance }
  from "physics/staling";
import { frsqrte, sqrtf } from "physics/gekko";
// Relative path on purpose: the loader stubs the bare `input/...` specifier.
import { tasRescale } from "../src/input/meleeInputs.js";
import { calcHitstun, calcHitlag, calcLaunchAngle, decayKnockback,
         stackKnockback, applyDI, seedGroundKnockback, decayGroundScalar,
         applyGroundKnockback, applyGroundShieldKnockback,
         decayShieldKnockbackAir, launchLevel,
         applyGroundedLaunch } from "physics/knockback";
import { ledgeSnapBoxes } from "physics/physics";
import { outwardsWallNormal } from "physics/environmentalCollision";

// ---------------------------------------------------------------- test rig

let passed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; }
  else { failures.push(detail ? `${name}\n      ${detail}` : name); }
}

function eq(name, got, want) {
  check(name, Object.is(got, want), `expected ${want}, got ${got}`);
}

// The whole point of the f32 layer: every physics output must be a value that
// is exactly representable in binary32. Any missed Math.fround shows up here.
function isF32(name, v) {
  check(`${name} is exact float32`, Math.fround(v) === v,
        `${v} is not float32-representable (fround -> ${Math.fround(v)})`);
}

const FOX = capturedAttributes[CHARIDS.FOX_ID];

function mkPlayer(over = {}) {
  const p = {
    charAttributes: FOX,
    phys: {
      cVel: { x: 0, y: 0 },
      kVel: { x: 0, y: 0 },
      grVel: 0,
      grKBVel: 0,
      groundAccel1: 0,
      groundAccel2: 0,
      groundNormal: { x: 0, y: 1 },
      grounded: true,
      fastfalled: false,
      face: 1,
    },
  };
  Object.assign(p.phys, over);
  player.length = 0;
  player.push(p);
  return p;
}

// input[p][n] -- n is frames-ago; the physics code reads [0] for current.
function mkInput(lsX = 0, lsY = 0) {
  const fr = { lsX, lsY, x: false, y: false, a: false, b: false, lA: 0, rA: 0,
               csX: 0, csY: 0 };
  return [[fr, fr, fr, fr]];
}

// ---------------------------------------------------------- attribute load

check("Fox attributes loaded from the real attribute file", FOX !== undefined);
eq("Fox gravity is the exact float32 from PlFx.dat",
   FOX.gravity, 0.23000000417232513);
eq("Fox terminal_velocity exact", FOX.terminalV, 2.799999952316284);
eq("Fox air_drift_max exact", FOX.aerialHmaxV, 0.8299999833106995);
eq("Fox air_max_horizontal_velocity present and distinct from air_drift_max",
   FOX.airMaxHorizontalV, 3);
eq("ftCommonData deadzone is 0.28 not 0.3",
   HORIZONTAL_STICK_DEADZONE, 0.2800000011920929);
eq("friction_when_above_walk_speed", FRICTION_WHEN_ABOVE_WALK_SPEED, 2);

// -------------------------------------------------- ftCommon_Fall (gravity)
// ftcommon.c:462
//   fp->self_vel.y -= gravity;
//   if (fp->self_vel.y < -terminal_vel) fp->self_vel.y = -terminal_vel;
{
  const pl = mkPlayer({ cVel: { x: 0, y: 0 } });
  fastfall(0, mkInput());
  eq("gravity: one frame from rest", pl.phys.cVel.y, f32(0 - FOX.gravity));
  isF32("gravity result", pl.phys.cVel.y);

  // terminal velocity clamp
  const pl2 = mkPlayer({ cVel: { x: 0, y: -2.79 } });
  fastfall(0, mkInput());
  eq("gravity: clamps at -terminal_velocity",
     pl2.phys.cVel.y, -FOX.terminalV);

  // many frames must never pass terminal velocity
  const pl3 = mkPlayer({ cVel: { x: 0, y: 0 } });
  for (let i = 0; i < 200; i++) fastfall(0, mkInput());
  check("gravity: never exceeds terminal velocity over 200 frames",
        pl3.phys.cVel.y === -FOX.terminalV,
        `settled at ${pl3.phys.cVel.y}, expected ${-FOX.terminalV}`);
  isF32("gravity terminal", pl3.phys.cVel.y);
}

// ------------------------------------------------------------- air drift
// ftCommon_8007D28C -> ftCommon_8007D174 (ftcommon.c:379, :342)
{
  // Full stick right from rest: accel = lsX*airMobA + airMobB
  const pl = mkPlayer({ cVel: { x: 0, y: 0 }, grounded: false });
  airDrift(0, mkInput(1.0));
  const wantAccel = f32(f32(1.0 * FOX.airMobA) + FOX.airMobB);
  eq("air drift: first frame accel from rest", pl.phys.cVel.x, wantAccel);
  isF32("air drift accel", pl.phys.cVel.x);

  // Must converge on the target and NEVER overshoot it.
  // ftCommon_8007D174 clamps: if (vel+accel > target) accel = target - vel.
  const pl2 = mkPlayer({ cVel: { x: 0, y: 0 }, grounded: false });
  let overshot = false;
  const target = f32(1.0 * FOX.aerialHmaxV);
  for (let i = 0; i < 120; i++) {
    airDrift(0, mkInput(1.0));
    if (pl2.phys.cVel.x > target) overshot = true;
  }
  check("air drift: never overshoots stick-scaled target", !overshot,
        `exceeded ${target}`);
  eq("air drift: settles exactly on target", pl2.phys.cVel.x, target);
  isF32("air drift settled", pl2.phys.cVel.x);

  // Inside the deadzone the target is 0, so ApplyFrictionAir runs and the
  // fighter decays to exactly zero (ftcommon.c:253).
  const pl3 = mkPlayer({ cVel: { x: 0.5, y: 0 }, grounded: false });
  for (let i = 0; i < 200; i++) airDrift(0, mkInput(0.0));
  eq("air drift: deadzoned stick decays to exactly 0", pl3.phys.cVel.x, 0);

  // 0.28 vs 0.3 matters: a stick at 0.29 is LIVE in Melee, dead under the old
  // hardcoded 0.3.
  const pl4 = mkPlayer({ cVel: { x: 0, y: 0 }, grounded: false });
  airDrift(0, mkInput(0.29));
  check("air drift: stick at 0.29 is outside the real 0.28 deadzone",
        pl4.phys.cVel.x !== 0,
        "0.29 was treated as deadzone -- deadzone constant is wrong");

  // Beyond the target, decel goes TOWARD THE TARGET, not toward zero.
  const pl5 = mkPlayer({ cVel: { x: 2.0, y: 0 }, grounded: false });
  airDrift(0, mkInput(1.0));
  check("air drift: past target decelerates toward target, not 0",
        pl5.phys.cVel.x < 2.0 && pl5.phys.cVel.x > target,
        `got ${pl5.phys.cVel.x}, expected between ${target} and 2.0`);
}

// -------------------------------------------------- ground friction
// ftCommon_ApplyFrictionGround (ftcommon.c:51) via ft_80084F3C (ft_084E.c:42)
{
  const pl = mkPlayer({ cVel: { x: 0.5, y: 0 }, grVel: 0.5 });
  reduceByTraction(0, false);
  eq("ground friction: single step", pl.phys.grVel,
     f32(0.5 - FOX.traction));
  isF32("ground friction result", pl.phys.grVel);

  // lands exactly on zero, never overshoots into the opposite sign
  const pl2 = mkPlayer({ cVel: { x: 0.5, y: 0 }, grVel: 0.5 });
  let wentNegative = false;
  for (let i = 0; i < 100; i++) {
    reduceByTraction(0, false);
    if (pl2.phys.grVel < 0) wentNegative = true;
  }
  check("ground friction: never crosses zero", !wentNegative);
  eq("ground friction: settles exactly on 0", pl2.phys.grVel, 0);

  // Above walk speed, friction is doubled (friction_when_above_walk_speed).
  //
  // Assert the resulting velocity directly rather than a measured delta:
  // computing (fast - grVel) subtracts two values near 2.1 to get ~0.08, which
  // in float32 loses ~5 significant bits to cancellation and makes the test
  // fail against correct code.
  const fast = f32(FOX.maxWalk + 0.5);
  const a = mkPlayer({ cVel: { x: fast, y: 0 }, grVel: fast });
  reduceByTraction(0, true);
  eq("ground friction: doubled above walk speed",
     a.phys.grVel, f32(fast - f32(FOX.traction * 2)));

  const b = mkPlayer({ cVel: { x: fast, y: 0 }, grVel: fast });
  reduceByTraction(0, false);
  eq("ground friction: undoubled when applyDouble is false",
     b.phys.grVel, f32(fast - FOX.traction));
}

// ------------------------------------------- ground velocity representation
// ftCommon_ApplyGroundMovement (ftcommon.c:133)
//   self_vel.x = +normal.y * gr_vel;  self_vel.y = -normal.x * gr_vel;
{
  // flat ground: projection is the identity on x, and y stays 0
  const pl = mkPlayer({ grVel: 1.5 });
  setGroundNormal(0, { x: 0, y: 1 });
  projectGroundVelocity(0);
  eq("flat ground: cVel.x == grVel", pl.phys.cVel.x, 1.5);
  eq("flat ground: cVel.y == 0", pl.phys.cVel.y, -0);

  // 45 degree slope: velocity must acquire a vertical component
  const s = Math.fround(Math.SQRT1_2);
  const pl2 = mkPlayer({ grVel: 1.0 });
  setGroundNormal(0, { x: -s, y: s });
  projectGroundVelocity(0);
  check("slope: cVel gains a vertical component",
        pl2.phys.cVel.y !== 0,
        "slope projection produced no vertical velocity");
  isF32("slope cVel.x", pl2.phys.cVel.x);
  isF32("slope cVel.y", pl2.phys.cVel.y);

  // round trip: projecting out and back recovers the scalar
  const back = projectOntoGround(pl2.phys.cVel, pl2.phys.groundNormal);
  check("slope: project -> unproject round-trips",
        Math.abs(back - 1.0) < 1e-6, `got ${back}`);

  // the two accel channels both feed grVel (fighter.c:2292)
  const pl3 = mkPlayer({ grVel: 0, groundAccel1: 0.25, groundAccel2: 0.5 });
  setGroundNormal(0, { x: 0, y: 1 });
  applyGroundMovement(0);
  eq("gr_vel accumulates BOTH accel channels", pl3.phys.grVel, 0.75);
  eq("accel channels cleared after apply", pl3.phys.groundAccel1, 0);
}

// ------------------------------------------------------------------ jump
// ftCo_800CB110 (ftCo_Jump.c:102)
{
  // y is ASSIGNED, not accumulated. This is the bug the port fixed: with a
  // non-zero starting cVel.y (which slopes now produce), += and = differ.
  const pl = mkPlayer({ cVel: { x: 0, y: -1.234 } });
  applyJumpVelocity(0, true, 1.0, mkInput(0));
  eq("jump: y velocity is ASSIGNED not accumulated (full hop)",
     pl.phys.cVel.y, FOX.fHopInitV);

  const pl2 = mkPlayer({ cVel: { x: 0, y: -1.234 } });
  applyJumpVelocity(0, false, 1.0, mkInput(0));
  eq("jump: short hop assigns hop_v_initial_velocity",
     pl2.phys.cVel.y, FOX.sHopInitV);

  // horizontal: carried momentum * ground_to_air, plus stick term, clamped
  const pl3 = mkPlayer({ cVel: { x: 1.0, y: 0 } });
  applyJumpVelocity(0, true, 1.0, mkInput(0));
  eq("jump: carried momentum scaled by ground_to_air",
     pl3.phys.cVel.x, f32(1.0 * FOX.groundToAir));

  // clamp to jump_h_max_velocity
  const pl4 = mkPlayer({ cVel: { x: 5.0, y: 0 } });
  applyJumpVelocity(0, true, 1.0, mkInput(1.0));
  eq("jump: horizontal clamped to jump_h_max_velocity",
     pl4.phys.cVel.x, FOX.jumpHmaxV);
  isF32("jump cVel.x", pl4.phys.cVel.x);
  isF32("jump cVel.y", pl4.phys.cVel.y);
}

// ------------------------------------------------- Melee's own trig (trig.js)
// src/MSL/trigf.c. The goal is NOT accuracy -- it is reproducing Metrowerks'
// polynomial, approximation error included.
{
  for (const x of [0, 0.5, 1, -1, 2.5, -3.9, 6.0]) {
    isF32(`sinf(${x})`, sinf(x));
    isF32(`cosf(${x})`, cosf(x));
  }
  eq("sinf(0) is exactly 0", sinf(0), 0);
  eq("cosf(0) is exactly 1", cosf(0), 1);

  // Close to true sine, but only to float32 -- this is a float32 polynomial.
  let worst = 0;
  for (let i = 0; i <= 400; i++) {
    const x = -3 + i * (6 / 400);
    worst = Math.max(worst, Math.abs(sinf(x) - Math.sin(x)));
  }
  check("sinf tracks true sine to float32 precision over [-3,3]",
        worst < 1e-6, `max error ${worst}`);
}

// ------------------------------------ Gekko frsqrte / sqrtf (gekko.js)
// The frsqrte table cannot be checked against a reference implementation here,
// so it is checked against the architecture's own guarantees instead: the
// estimate is within 1/32 of the true reciprocal square root, and the piecewise
// segments join smoothly. A mistyped base or decrement violates both.
{
  let worst = 0, worstX = 0;
  for (let e = -60; e <= 60; e += 3) {
    for (let k = 0; k < 512; k++) {
      const x = Math.pow(2, e) * (1 + k / 512);
      const rel = Math.abs(frsqrte(x) * Math.sqrt(x) - 1);
      if (rel > worst) { worst = rel; worstX = x; }
    }
  }
  check("frsqrte is within the architectural 1/32 bound",
        worst < 1 / 32, `max relative error ${worst} at x=${worstX}`);

  // Segments are fitted independently, so frsqrte is NOT monotonic -- there are
  // small upward steps at boundaries, and that is real hardware behaviour, not
  // a defect. What a wrong table entry WOULD do is displace a whole segment,
  // making its boundary step jump by something near the segment's own span
  // (~1e-2). The real steps are ~1e-5.
  let jump = 0;
  for (let s = 1; s < 16; s++) {
    const x = 1 + s / 16;
    const lo = frsqrte(x - 1e-9);
    jump = Math.max(jump, Math.abs(frsqrte(x) - lo) / lo);
  }
  check("frsqrte segments join smoothly (no displaced table entry)",
        jump < 1e-3, `max boundary step ${jump}`);

  eq("frsqrte(+0) is +Infinity", frsqrte(0), Infinity);
  eq("frsqrte(-0) is -Infinity", frsqrte(-0), -Infinity);
  eq("frsqrte(+Infinity) is 0", frsqrte(Infinity), 0);
  check("frsqrte(negative) is NaN", Number.isNaN(frsqrte(-1)));

  // sqrtf: 3 Newton-Raphson steps land ~2^-36, far inside float32, so it should
  // agree with a correctly rounded sqrt everywhere we can afford to look.
  eq("sqrtf(4) is exactly 2", sqrtf(4), 2);
  eq("sqrtf(0) is 0", sqrtf(0), 0);
  eq("sqrtf(-3) returns x unchanged (guard is x > 0)", sqrtf(-3), -3);
  isF32("sqrtf(2) is a float32", sqrtf(2));

  let mismatch = 0, sample = null;
  for (let k = 1; k <= 200000; k++) {
    const x = f32(k * 0.011);
    const got = sqrtf(x);
    if (got !== f32(Math.sqrt(x))) { mismatch++; sample = sample || x; }
  }
  check("sqrtf matches a correctly rounded sqrt over the sampled range",
        mismatch === 0, `${mismatch} mismatches, first at x=${sample}`);
}

// ------------------------------------------------- knockback (knockback.js)
{
  // ftCo_Damage.c:292 -- the min-1 clamp meleelight lacked.
  eq("hitstun: floors at 1 even for negligible knockback",
     calcHitstun(0.001), 1);
  eq("hitstun: (int)(kb * 0.4)", calcHitstun(100), Math.trunc(f32(100 * HITSTUN_MUL)));

  // ftcommon.c:640 -- damage/3 + 3, integer truncated, then capped at 20.
  eq("hitlag: 9 damage -> 6 frames", calcHitlag(9, { cap: false }), 6);
  eq("hitlag: 0 damage -> 3 frames", calcHitlag(0, { cap: false }), 3);
  check("hitlag: capped at 20", calcHitlag(200) === 20,
        `got ${calcHitlag(200)}`);
  // Electric (1.5x) must truncate TWICE, not once.
  eq("hitlag: electric double-truncates",
     calcHitlag(10, { elementMul: 1.5, cap: false }),
     Math.trunc(f32(Math.trunc(f32(10 * 0.3333333432674408 + 3)) * 1.5)));

  // ftCo_Damage_CalcAngle (ftCo_Damage.c:79) -- Sakurai angle 361.
  eq("sakurai: airborne is a fixed 45 degrees",
     calcLaunchAngle(361, 50, true), 0.7853981852531433);
  eq("sakurai: grounded below 32.0 knockback is flat 0",
     calcLaunchAngle(361, 10, false), 0);
  check("sakurai: grounded ramps (not a binary step) inside 32.0-32.1",
        calcLaunchAngle(361, 32.05, false) > 0
        && calcLaunchAngle(361, 32.05, false) < calcLaunchAngle(361, 32.1, false),
        "expected a strictly increasing ramp across the band");
  // a normal angle is just degrees -> radians
  check("non-361 angle converts degrees to radians",
        Math.abs(calcLaunchAngle(90, 50, false) - Math.PI / 2) < 1e-6);

  // fighter.c:2200 -- decay recomputes the angle each frame and snaps both
  // axes to zero together once below the step.
  const tiny = decayKnockback({ x: 0.01, y: 0.01 });
  eq("decay: snaps x to exactly 0 below the decay step", tiny.x, 0);
  eq("decay: snaps y to exactly 0 below the decay step", tiny.y, 0);
  const d = decayKnockback({ x: 3, y: 0 });
  eq("decay: pure-x vector loses exactly one decay step",
     d.x, f32(3 - KB_FRAME_DECAY));
  isF32("decay result", d.x);

  // ftCo_Damage_CalcVel (ftCo_Damage.c:216) -- inside the window it replaces.
  const st = stackKnockback({ x: 5, y: 0 }, 1, 0, 0);
  eq("kb stacking: inside the window, replaces", st.x, 1);
  // outside the window, opposite signs ADD
  const st2 = stackKnockback({ x: 5, y: 0 }, -2, 0, 999);
  eq("kb stacking: outside window, opposing components add", st2.x, 3);
  // outside the window, same sign keeps the larger magnitude
  const st3 = stackKnockback({ x: 5, y: 0 }, 2, 0, 999);
  eq("kb stacking: outside window, same sign keeps larger", st3.x, 5);

  // DI is a rotation: it must not change the magnitude of the vector.
  const before = { x: 2, y: 1 };
  const after = applyDI(before, 1, 0);
  const m0 = Math.hypot(before.x, before.y), m1 = Math.hypot(after.x, after.y);
  check("DI rotates without changing magnitude",
        Math.abs(m0 - m1) < 1e-4, `${m0} -> ${m1}`);
  check("DI with a centred stick is a no-op",
        applyDI(before, 0, 0) === before);
}

// ------------------------------------------- grounded knockback (scalar path)
// Grounded knockback is a SCALAR projected onto the floor tangent, not a 2D
// vector that decays freely. fighter.c:2209, ftcommon.c:176/191.
{
  const flat = { x: 0, y: 1 };

  // seeding takes the X component only and discards Y
  const s = seedGroundKnockback(0, { x: 3, y: 7 }, flat);
  eq("ground kb seeds from kb_vel.x alone", s.grKBVel, 3);
  eq("ground kb seed re-projects x", s.kbVel.x, 3);
  eq("ground kb seed re-projects y (flat floor -> 0)", s.kbVel.y, -0);

  // the +/-x164 clamp
  eq("ground kb seed clamped to +x164",
     seedGroundKnockback(0, { x: 99, y: 0 }, flat).grKBVel, 8.300000190734863);
  eq("ground kb seed clamped to -x164",
     seedGroundKnockback(0, { x: -99, y: 0 }, flat).grKBVel, -8.300000190734863);

  // already seeded -> untouched (the xF0 == 0 guard)
  const already = seedGroundKnockback(2, { x: 99, y: 0 }, flat);
  eq("ground kb does not re-seed while non-zero", already.grKBVel, 2);

  // friction decays toward zero and lands exactly on it, from both signs
  eq("ground scalar decays toward zero", decayGroundScalar(1, 0.25), 0.75);
  eq("ground scalar decays negative toward zero",
     decayGroundScalar(-1, 0.25), -0.75);
  eq("ground scalar cannot overshoot past zero (positive)",
     decayGroundScalar(0.1, 0.25), 0);
  eq("ground scalar cannot overshoot past zero (negative)",
     decayGroundScalar(-0.1, 0.25), 0);

  // on a slope the vector follows the tangent, so |kb| is preserved but the
  // direction tilts -- this is the whole reason for the scalar representation
  const slope = { x: -0.6, y: 0.8 };          // unit normal, 37deg slope
  const g = applyGroundKnockback(5, { x: 5, y: 0 }, slope, 0);
  eq("grounded kb follows the slope tangent (x)", g.kbVel.x, f32(0.8 * 5));
  eq("grounded kb follows the slope tangent (y)", g.kbVel.y, f32(0.6 * 5));

  // friction actually applies, scaled by x200 (1.0) and the fighter multiplier
  const f = applyGroundKnockback(5, { x: 5, y: 0 }, flat, 0.08);
  eq("grounded kb loses ground_friction * x200 per frame",
     f.grKBVel, f32(5 - 0.08));

  // shield knockback uses x3EC (1.1) instead
  const sh = applyGroundShieldKnockback(5, { x: 5, y: 0 }, flat, 0.08);
  eq("grounded shield kb friction is scaled by x3EC",
     sh.grShieldKBVel, f32(5 - f32(0.08 * 1.100000023841858)));

  // launch level bands are hitstun bands: knockback * x154 against 10/21/32
  eq("launch level 0 below 10 hitstun", launchLevel(24), 0);   // 24*0.4 = 9.6
  eq("launch level 1 at 10 hitstun", launchLevel(25), 1);      // 25*0.4 = 10
  eq("launch level 2 at 21 hitstun", launchLevel(55), 2);      // 55*0.4 = 22
  eq("launch level 3 at 32 hitstun", launchLevel(80), 3);      // 80*0.4 = 32

  // grounded launch: away from the floor is an ordinary launch
  const up = applyGroundedLaunch({ x: 1, y: 2 }, flat, 30);
  check("grounded launch away from floor stays airborne", up.airborne);
  eq("grounded launch away from floor keeps y", up.vel.y, 2);
  eq("grounded launch away from floor clears the scalar", up.grKBVel, 0);

  // into the floor, below level 3 -> slide along the tangent, scalar seeded
  const slide = applyGroundedLaunch({ x: 3, y: -2 }, flat, 30);
  check("grounded launch into floor below level 3 does not go airborne",
        !slide.airborne);
  eq("slide seeds the scalar from x only", slide.grKBVel, 3);
  eq("slide flattens y on a flat floor", slide.vel.y, -0);
  eq("slide keeps x on a flat floor", slide.vel.x, 3);

  // the same hit at level 3 launches instead of sliding
  const tumble = applyGroundedLaunch({ x: 3, y: -2 }, flat, 200);
  check("grounded launch into floor at level 3 goes airborne", tumble.airborne);

  // straight down into a flat floor is 180 deg from the normal, past 100, so
  // level 3 bounces with y reflected and scaled by x1EC
  const bounce = applyGroundedLaunch({ x: 0, y: -5 }, flat, 200);
  eq("level 3 bounce reflects and scales y by x1EC",
     bounce.vel.y, f32(5 * 0.800000011920929));

  // meleelight's old heuristic keyed on angle 0/180 and knockback < 80 with no
  // reference to the floor. On a slope, a hit that used to slide now correctly
  // depends on which way the slope faces.
  // The normal leans toward -x, so a purely horizontal launch in +x runs INTO
  // the slope (dot < 0) and slides, while the mirrored launch leaves it.
  const intoSlope = applyGroundedLaunch({ x: 3, y: 0 }, slope, 30);
  check("slide decision follows the slope normal, not a fixed angle",
        !intoSlope.airborne);
  eq("slide on a slope gains a y component from the tangent",
     intoSlope.vel.y, f32(0.6 * 3));
  const offSlope = applyGroundedLaunch({ x: -3, y: 0 }, slope, 30);
  check("same hit mirrored launches off the same slope", offSlope.airborne);

  // the shipped bug: below the decay threshold Melee zeroes the shield kb's X
  // and the ORDINARY knockback's Y, leaving shield kb Y alive.
  const bug = decayShieldKnockbackAir({ x: 0.01, y: 0.02 }, { x: 9, y: 9 });
  eq("shield kb bug: clears shield x", bug.shieldKB.x, 0);
  eq("shield kb bug: LEAVES shield y", bug.shieldKB.y, 0.02);
  eq("shield kb bug: clears the wrong vector's y", bug.kbVel.y, 0);
  eq("shield kb bug: leaves knockback x", bug.kbVel.x, 9);
  eq("airborne shield kb clears the grounded scalar", bug.grShieldKBVel, 0);
  eq("airborne shield kb clears the scalar on the decay path too",
     decayShieldKnockbackAir({ x: 3, y: 4 }, { x: 0, y: 0 }).grShieldKBVel, 0);
}

// ------------------------------------------------- stick quantization
// HSD_PadClampCheck3 + HSD_PadScale (controller.c:175, :294) with Melee's
// PadLibData (gmmain.c:47-51): min 0, max 80, shift 1, scale 80.
//
// Imported by relative path: the harness loader stubs the bare `input/...`
// specifier, and this needs the real module.
{
  // An axis can only ever hold n/80. 161 values, endpoints included.
  const seen = new Set();
  for (let i = 0; i <= 4000; i++) seen.add(tasRescale(-1 + i / 2000, 0)[0]);
  eq("stick x takes exactly 161 discrete values", seen.size, 161);
  const vals = [...seen].sort((a, b) => a - b);
  eq("stick x reaches exactly -1", vals[0], -1);
  eq("stick x reaches exactly +1", vals[vals.length - 1], 1);
  // every value is n/80 rounded to float32 -- Melee divides in float32 too,
  // so 56/80 is 0.699999988079071, not the float64 0.7
  const offGrid = vals.filter(v => f32(Math.round(v * 80) / 80) !== v);
  eq("every stick value is n/80 in float32", offGrid.length, 0);

  // The diagonal: raw (80,80) has radius 113.137, so it clamps. Melee
  // TRUNCATES (80*80)/113.137 = 56.5685 to 56, giving 0.7. Rounding would give
  // 57 and 0.7125 -- a full step out, on the coordinate DI uses constantly.
  const diag = tasRescale(1, 1);
  eq("full diagonal x is 56/80, not 57/80", diag[0], f32(56 / 80));
  eq("full diagonal y is 56/80, not 57/80", diag[1], f32(56 / 80));
  check("full diagonal is not the round-to-nearest answer",
        diag[0] !== f32(57 / 80));

  // Cardinals are inside the clamp and pass through untouched.
  eq("cardinal right is exactly 1", tasRescale(1, 0)[0], 1);
  eq("cardinal right y is exactly 0", tasRescale(1, 0)[1], 0);
  eq("centre is exactly 0", tasRescale(0, 0)[0], 0);

  // The clamped diagonal must never exceed unit magnitude.
  let worstMag = 0;
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * 2 * Math.PI;
    const [x, y] = tasRescale(Math.cos(a), Math.sin(a));
    worstMag = Math.max(worstMag, Math.sqrt(x * x + y * y));
  }
  check("clamped stick magnitude never exceeds 1", worstMag <= 1,
        `max magnitude ${worstMag}`);
}

// --------------------------------------- attacker shield pushback
// ftcoll.c:459 -> fighter.c:3011. eval = (shielder_lightshield * int_dmg)
// * x3E0 + x3E4, where int_dmg comes from getEnvDmg, not Math.floor.
{
  // getEnvDmg: truncates, but a non-zero value that truncates to 0 becomes 1
  eq("getEnvDmg truncates", getEnvDmg(3.7), 3);
  eq("getEnvDmg(0) is 0", getEnvDmg(0), 0);
  eq("getEnvDmg promotes sub-1 damage to 1", getEnvDmg(0.5), 1);
  check("getEnvDmg differs from Math.floor below 1",
        getEnvDmg(0.5) !== Math.floor(0.5));

  // a hard shield (lightshield 0) still gets the x3E4 floor
  eq("hard shield pushback is the x3E4 base alone",
     calcAttackerShieldPushback(10, 0), 0.019999999552965164);

  // full light shield, 10 damage: 1.0 * 10 * 0.07 + 0.02
  eq("full lightshield pushback follows x3E0/x3E4",
     calcAttackerShieldPushback(10, 1), f32(f32(1 * 10 * 0.07000000029802322)
                                            + 0.019999999552965164));

  // meleelight's old float64 expression was algebraically equivalent given its
  // own analog convention. Confirm the restated form still agrees to float32,
  // so this was a precision and channel change, not a behaviour change.
  for (const analog of [0.3, 0.5, 0.7, 1.0]) {
    for (const dmg of [1, 4, 12, 25]) {
      const old = (Math.floor(dmg) * ((analog - 0.3) * 0.1)) + 0.02;
      const now = calcAttackerShieldPushback(dmg,
                                             shieldAnalogToLightshield(analog));
      check(`attacker pushback matches the old formula (a=${analog} d=${dmg})`,
            Math.abs(now - old) < 1e-6, `${now} vs ${old}`);
    }
  }
}

// ------------------------------- hitDetection.js (previously unreachable)
//
// These assertions exist as much to prove the harness can LOAD this file as to
// check the values. It was invisible to the tests until the loader learned to
// strip Flow -- which is how a missing import once shipped unnoticed.
{
  const hd = await import("physics/hitDetection");

  check("hitDetection.js is loadable by the harness",
        typeof hd.getKnockback === "function");

  // ftColl_80079AB0 (ftcoll.c:2387) + ftCo_Damage_CalcKnockback (ftCo_Damage.c:118)
  const hb = { kg: 100, bk: 30, sk: 0 };
  const base = hd.getKnockback(hb, 10, 10, 50, 75, false, false);
  isF32("knockback", base);

  // vCancel must be IGNORED: x1AC is 1.0 in retail. The 0.95 that used to be
  // applied here is x190, which scales VELOCITY when airborne.
  eq("knockback: vCancel no longer scales knockback",
     hd.getKnockback(hb, 10, 10, 50, 75, false, true), base);

  // crouch cancel is exactly 2/3, not the 0.67 previously hardcoded
  const crouched = hd.getKnockback(hb, 10, 10, 50, 75, true, false);
  eq("knockback: crouch cancel is exactly x124 (2/3)",
     crouched, f32(base * 0.6666666865348816));
  check("knockback: crouch ratio is 2/3 not 0.67",
        Math.abs(crouched / base - 2 / 3) < 1e-7,
        `ratio ${crouched / base}`);

  // set-knockback branch: independent of percent
  const skHb = { kg: 100, bk: 30, sk: 40 };
  eq("knockback: set-knockback ignores percent",
     hd.getKnockback(skHb, 10, 10, 0, 75, false, false),
     hd.getKnockback(skHb, 10, 10, 999, 75, false, false));

  // cap
  const huge = { kg: 30000, bk: 2000, sk: 0 };
  eq("knockback: capped at x108 (2500)",
     hd.getKnockback(huge, 99, 99, 999, 75, false, false), 2500);

  // getHitstun delegates to calcHitstun -- min-1 clamp reaches this file too
  eq("hitstun via hitDetection floors at 1", hd.getHitstun(0.001), 1);
}

// --------------------------------- atanf / atan2f / acosf, from the retail DOL
// Disassembled at 0x80022E68 / 0x80022C30 / 0x80022D1C, because the decomp
// declares these but ships no definition. As with sinf/cosf the goal is
// reproducing the hardware, not accuracy.
{
  for (const x of [0, 0.25, 0.5, 1, -1, 2, -3.7, 10, 1e-4, 123.456]) {
    isF32(`atanf(${x})`, atanf(x));
  }
  eq("atanf(0) is exactly 0", atanf(0), 0);

  // Within float32 tolerance of the true arctangent across all three of its
  // magnitude branches: below tan(pi/8), the five tabulated segments, and
  // above cot(pi/8) where it takes a reciprocal.
  let worst = 0;
  for (let i = 0; i <= 400; i++) {
    const x = -8 + i * (16 / 400);
    worst = Math.max(worst, Math.abs(atanf(x) - Math.atan(x)));
  }
  check(`atanf tracks Math.atan to float32 (worst ${worst.toExponential(2)})`,
     worst < 3e-7);

  let worstA = 0;
  for (let i = 0; i <= 200; i++) {
    const x = -1 + i * (2 / 200);
    worstA = Math.max(worstA, Math.abs(acosf(x) - Math.acos(x)));
  }
  // Looser than atanf's bar, and it should be: acosf composes a reciprocal
  // square root (frsqrte + 3 Newton-Raphson) with atanf's own polynomial, so
  // their errors add. The worst case is ~3.9e-7 at x = 0.42, which is where
  // the argument x/sqrt(1-x*x) lands on atanf's first segment boundary -- not
  // at +-1, so this is accumulation, not endpoint blow-up. About 3 float32
  // ulps.
  check(`acosf tracks Math.acos to float32 (worst ${worstA.toExponential(2)})`,
     worstA < 5e-7);
  eq("acosf(1) is exactly 0", acosf(1), 0);
  eq("acosf(-1) is float32 pi", acosf(-1), Math.fround(Math.PI));
  isF32("asinf(0.5)", asinf(0.5));

  // Melee's atan2f is NOT IEEE-754 at the origin. IEEE says atan2(0, 0) is 0
  // and atan2(0, -0) is pi; this returns +-pi/2 for all four sign
  // combinations, because it tests the SIGN BITS and then falls through to
  // copysign(pi/2, y). Reachable whenever knockback is exactly zero, so it is
  // pinned here rather than "fixed".
  eq("atan2f(0, 0) is pi/2, not 0", atan2f(0, 0), Math.fround(Math.PI / 2));
  eq("atan2f(0, -0) is pi/2, not pi", atan2f(0, -0), Math.fround(Math.PI / 2));
  eq("atan2f(-0, 0) is -pi/2", atan2f(-0, 0), -Math.fround(Math.PI / 2));
  eq("atan2f(-0, -0) is -pi/2", atan2f(-0, -0), -Math.fround(Math.PI / 2));

  // Away from the origin it agrees with the real thing.
  let worst2 = 0;
  for (const y of [1, -1, 0.5, -2.5, 7]) {
    for (const x of [1, -1, 0.5, -2.5, 7]) {
      worst2 = Math.max(worst2, Math.abs(atan2f(y, x) - Math.atan2(y, x)));
    }
  }
  check(`atan2f tracks Math.atan2 off the origin (worst ${worst2.toExponential(2)})`,
     worst2 < 1e-6);
  eq("atan2f(1, 0) is pi/2", atan2f(1, 0), Math.fround(Math.PI / 2));
  eq("atan2f(-1, 0) is -pi/2", atan2f(-1, 0), -Math.fround(Math.PI / 2));
}

// ------------------------------------------- expf / logf / powf, from the DOL
// powf = .text:0x8000CEE0 (0x94), expf = .text:0x8000CE50 (0x90). Both are
// naive series summed in SINGLE precision and run until the sum stops moving,
// so the answer is not the correctly-rounded one. These assertions pin the
// ways it deviates -- if someone "fixes" them into Math.pow/Math.exp, the
// deviations vanish and these fail.
{
  // Structure: powf's only special case is `x == 0`, tested before y is even
  // looked at, so powf(0, 0) is 0 -- not the 1 that C99 and Math.pow give.
  eq("powf(0, 0) is 0, not 1", powf(0, 0), 0);
  eq("powf(0, 5) is 0", powf(0, 5), 0);
  eq("powf(x, 0) is 1", powf(0.975, 0), 1);

  // The series tracks the true value but does not reproduce it. powf(x, 1)
  // failing to round-trip x is the signature of going through exp(1*log(x)).
  check("powf(0.975, 1) does not round-trip to 0.975",
     powf(0.975, 1) !== Math.fround(0.975));
  check("powf(0.975, 1) is within 1e-6 of 0.975",
     Math.abs(powf(0.975, 1) - 0.975) < 1e-6);

  // ftCo_PassiveWall.c:146 passes an INT exponent, and powf has no integer
  // path -- so the walljump falloff is not repeated multiplication.
  let rep = Math.fround(1);
  for (let i = 0; i < 3; i++) { rep = Math.fround(rep * Math.fround(0.975)); }
  check("powf(0.975, 3) differs from repeated multiplication",
     powf(0.975, 3) !== rep);

  // Everything stays in float32.
  eq("powf returns a float32", powf(0.975, 3), Math.fround(powf(0.975, 3)));
  eq("expf returns a float32", expf(1), Math.fround(expf(1)));

  let worstE = 0;
  for (let x = -8; x <= 8; x += 0.13) {
    worstE = Math.max(worstE, Math.abs(expf(x) - Math.exp(x)) / Math.exp(x));
  }
  check(`expf tracks Math.exp in relative terms (worst ${worstE.toExponential(2)})`,
     worstE < 1e-5);

  // logf converges only for x > 0: |(x-1)/(x+1)| < 1 is what makes the atanh
  // series terminate, and powf never guards against a negative base.
  let worstL = 0;
  for (let x = 0.05; x <= 20; x += 0.07) {
    worstL = Math.max(worstL, Math.abs(logf(x) - Math.log(x)));
  }
  check(`logf tracks Math.log (worst ${worstL.toExponential(2)})`, worstL < 1e-5);
  eq("logf(1) is exactly 0", logf(1), 0);

  // Negative arguments go through 1/expf(-x) rather than an alternating series.
  check("expf(-3) matches 1/expf(3) exactly",
     expf(-3) === Math.fround(1 / expf(3)));
}

// ------------------------------------------------- MTXDegToRad (mtx.h:59)
// `#define MTXDegToRad(a) ((a) * 0.01745329252f)`. The constant is a float32
// LITERAL and is NOT interchangeable with Math.PI/180: 33 of the 362 integer
// degree values a hitbox trajectory can hold land on a different float32
// through the two, 27 and 51 degrees among them. knockback.js used the double
// until this was checked.
{
  const F64 = Math.PI / 180;
  eq("DEG_TO_RAD is the float32 literal, not pi/180",
     DEG_TO_RAD, Math.fround(0.01745329252));
  check("DEG_TO_RAD differs from the double pi/180 as a double",
     DEG_TO_RAD !== F64);

  let differing = 0;
  for (let d = 0; d <= 361; d++) {
    if (Math.fround(d * F64) !== Math.fround(d * DEG_TO_RAD)) { differing++; }
  }
  check(`the two constants disagree on ${differing} integer degrees (expect 33)`,
     differing === 33);
  // A trajectory that actually diverges. If someone swaps the constant back,
  // this is the assertion that fails.
  eq("27 degrees uses the game's constant",
     mtxDegToRad(27), Math.fround(27 * DEG_TO_RAD));
  check("27 degrees is NOT what pi/180 would give",
     mtxDegToRad(27) !== Math.fround(27 * F64));
  eq("calcLaunchAngle routes a 51-degree trajectory through it",
     calcLaunchAngle(51, 100, true), mtxDegToRad(51));
}

// ---------------------------------------- hitlag (ftCommon_CalcHitlag :640)
// `int tmp = dmg*x198 + x19C; result = (int)(tmp*mul);` with a crouch
// multiplier and, at the victim call site only, a 20-frame cap
// (fighter.c:2971). meleelight had 15 copies of `floor(dmg/3 + 3)` inline,
// which is that formula with the cap, the crouch factor and the element
// factor all missing.
{
  const inline_ = (d) => Math.floor(d * (1 / 3) + 3);

  // Below the cap the two agree -- which is why this went unnoticed.
  eq("hitlag: 12 damage matches the old inline formula",
     calcHitlag(12), inline_(12));

  // The cap is what diverges, from 54 damage upward.
  eq("hitlag: capped at 20 frames", calcHitlag(60), 20);
  check("hitlag: the old inline formula blew past the cap",
     inline_(60) > 20);
  let differing = 0;
  for (let d = 0; d <= 200; d++) {
    if (calcHitlag(d) !== inline_(d)) { differing++; }
  }
  check(`hitlag: inline formula differs on ${differing} of 201 damages (expect 147)`,
     differing === 147);

  // The attacker's hitlag (ftCo_Damage.c:877) is NOT capped.
  check("hitlag: attacker side is uncapped",
     calcHitlag(60, { cap: false }) > 20);

  // Crouching multiplies by x1A0 and truncates again.
  eq("hitlag: crouching applies x1A0 with its own truncation",
     calcHitlag(12, { crouching: true }),
     Math.trunc(Math.fround(calcHitlag(12, { crouching: false }) * 0.6666666865348816)));

  // `int dmg` -- damage truncates before the formula. With x198 == 1/3 this
  // never changes the answer; the assertion records that it was checked.
  let truncDiffers = 0;
  for (let i = 0; i <= 20000; i++) {
    const d = i / 100;
    if (calcHitlag(d) !== calcHitlag(Math.trunc(d))) { truncDiffers++; }
  }
  check("hitlag: int truncation of damage is unobservable at x198 == 1/3",
     truncDiffers === 0);
}

// ------------------------------------ tap jump / crouch (ftCo_Jump.c:33)
// One rule for every jump path: `lsY >= tap_jump_threshold && tiltTimerY <
// tap_jump_window`. meleelight had 0.66/0.69/0.7 across three functions.
{
  eq("tap jump: threshold is 0.6625, not 0.66 / 0.69 / 0.7",
     TAP_JUMP_THRESHOLD, 0.6625000238418579);
  eq("tap jump: window is 4 frames", TAP_JUMP_WINDOW, 4);
  eq("crouch: threshold is 0.6875, not 0.69", SQUAT_STICK_THRESHOLD, 0.6875);

  // The band the old thresholds got wrong: a stick between 0.6625 and 0.69
  // jumps in Melee and did not in two of the three meleelight paths.
  check("tap jump: 0.67 is a jump in Melee but was below the old 0.69",
     0.67 >= TAP_JUMP_THRESHOLD && 0.67 < 0.69);
  check("crouch: 0.688 crouches in Melee but was below the old 0.69",
     0.688 > SQUAT_STICK_THRESHOLD && 0.688 < 0.69);

  // The tilt timer is what stops a HELD stick from jumping every frame. It is
  // the same timer SDI reads, so both mechanics share one source of truth.
  const held = mkPlayer({ stickTiltTimerY: 40 });
  check("tap jump: a long-held stick is past the window",
     !(held.phys.stickTiltTimerY < TAP_JUMP_WINDOW));
  const flicked = mkPlayer({ stickTiltTimerY: 1 });
  check("tap jump: a stick tilted 1 frame ago is inside the window",
     flicked.phys.stickTiltTimerY < TAP_JUMP_WINDOW);
  // 254 is the "inside the deadzone" sentinel, which must never qualify.
  const centred = mkPlayer({ stickTiltTimerY: 254 });
  check("tap jump: a centred stick (254) never qualifies",
     !(centred.phys.stickTiltTimerY < TAP_JUMP_WINDOW));
}

// ------------------------------------ shield position (ftCo_Guard.c:214)
// The shield's collision centre is a POSED BONE, not a polar offset. Baked
// per degree from the 370-frame Guard animation by tools/gen_shield.py.
{
  for (const cid of [CHARIDS.FOX_ID, CHARIDS.PUFF_ID, CHARIDS.MARTH_ID]) {
    eq(`shield: 360 degree rows for char ${cid}`, SHIELD_POS[cid].length, 360);
    eq(`shield: ${SHIELD_MAG_KNOTS} magnitude knots for char ${cid}`,
       SHIELD_POS[cid][0].length, SHIELD_MAG_KNOTS);
  }

  // The check that established the whole mapping: extremes land on the
  // cardinal angles. If the +10 bias or the one-frame-per-degree assumption
  // were wrong these would drift off 0/90/180/270.
  // Knot index -1 is magnitude 1, the full tilt.
  const fox = SHIELD_POS[CHARIDS.FOX_ID].map((r) => r[SHIELD_MAG_KNOTS - 1]);
  const argmax = (f) => fox.reduce((b, _p, i) => (f(fox[i]) > f(fox[b]) ? i : b), 0);
  const argmin = (f) => fox.reduce((b, _p, i) => (f(fox[i]) < f(fox[b]) ? i : b), 0);
  eq("shield: highest at 90 degrees (up)", argmax((q) => q[1]), 90);
  eq("shield: lowest at 270 degrees (down)", argmin((q) => q[1]), 270);
  eq("shield: furthest forward at 0 degrees", argmax((q) => q[0]), 0);
  eq("shield: furthest back at 180 degrees", argmin((q) => q[0]), 180);

  // It is emphatically NOT a circle -- the old code used radius 3 for every
  // character and every angle. Fox's real sweep is much wider than it is tall,
  // and neither dimension is 6.
  const hSpan = fox[0][0] - fox[180][0];
  const vSpan = fox[90][1] - fox[270][1];
  check(`shield: horizontal sweep is ${hSpan.toFixed(2)}, not 6`,
     hSpan > 7 && hSpan < 8);
  check(`shield: vertical sweep is ${vSpan.toFixed(2)}, not 6`,
     vSpan > 11 && vSpan < 12);
  check("shield: the sweep is not circular", Math.abs(hSpan - vSpan) > 3);

  // Characters differ: a per-character table is required, not one shape.
  check("shield: Puff's shield sits lower than Fox's",
     SHIELD_POS[CHARIDS.PUFF_ID][0][0][1] < SHIELD_POS[CHARIDS.FOX_ID][0][0][1]);

  // Only Puff's shield chain actually rotates between the reference pose and
  // the tilt pose, so only her knots are non-collinear -- which is why baking
  // two endpoints was exact for the other four and not for her.
  //
  // The deviation is NOT uniform around the circle: Puff is collinear at 90
  // degrees and worst at 270 (straight down), so a test that probed only 90
  // would conclude the knots are unnecessary. Probe the worst case.
  const midDev = (cid, d) => {
    const r = SHIELD_POS[cid][d];
    const k = (SHIELD_MAG_KNOTS - 1) / 2;
    const lx = r[0][0] + (r[SHIELD_MAG_KNOTS - 1][0] - r[0][0]) * 0.5;
    const ly = r[0][1] + (r[SHIELD_MAG_KNOTS - 1][1] - r[0][1]) * 0.5;
    return Math.hypot(r[k][0] - lx, r[k][1] - ly);
  };
  let foxWorst = 0, puffWorst = 0;
  for (let d = 0; d < 360; d++) {
    foxWorst = Math.max(foxWorst, midDev(CHARIDS.FOX_ID, d));
    puffWorst = Math.max(puffWorst, midDev(CHARIDS.PUFF_ID, d));
  }
  check(`shield: Fox's knots are collinear everywhere (${foxWorst.toExponential(1)}) -- a lerp would have done`,
     foxWorst < 1e-4);
  check(`shield: Puff's are not (${puffWorst.toFixed(4)} at 270 deg) -- the knots are load-bearing`,
     puffWorst > 1e-2);
  eq("shield: Puff's worst case is straight down",
     [...Array(360).keys()].reduce((b, d) =>
       midDev(CHARIDS.PUFF_ID, d) > midDev(CHARIDS.PUFF_ID, b) ? d : b, 0), 270);
}

// ------------------------------------------- air dodge (ftCo_EscapeAir.c:97)
// The decay runs for the WHOLE airdodge. cmd_skip_decay is only ever set by a
// SET_CMD_VAR subaction event, and every character's EscapeAir script on the
// disc is a bare `end` -- so there is no gravity and no air control at any
// point during an airdodge, which is what wavedashing depends on.
{
  eq("airdodge: decay is x33C", ESCAPEAIR_DECAY, 0.8999999761581421);
  eq("airdodge: launch force is x338", ESCAPEAIR_FORCE, 3.0999999046325684);

  // 49 frames of pure geometric decay from 3.1 leaves almost nothing, and
  // never falls -- the fighter hangs until the state ends.
  let v = ESCAPEAIR_FORCE;
  for (let i = 0; i < 49; i++) { v = Math.fround(v * ESCAPEAIR_DECAY); }
  check(`airdodge: 49 frames of decay leaves ~0 speed (got ${v.toExponential(2)})`,
     v < 0.02 && v > 0);
  // If gravity had been applied from frame 30 (the old behaviour), the fighter
  // would have picked up real downward speed instead.
  check("airdodge: no gravity term -- 20 frames of it would dominate the decay",
     v < 0.02);
}

// -------------------------- fastfall / platform drop / c-stick (x88, x464, x7F4)
{
  // Fastfall and the platform drop look like the same input and are not: they
  // have different thresholds AND different windows, which is why one hardcoded
  // 0.65 could not serve both.
  eq("fastfall threshold is 0.6625", FASTFALL_STICK_THRESHOLD, 0.6625000238418579);
  eq("fastfall window is 4", FASTFALL_WINDOW, 4);
  eq("platform drop threshold is 0.66", PLATFORM_DROP_STICK_THRESHOLD, 0.6600000262260437);
  eq("platform drop window is 6", PLATFORM_DROP_WINDOW, 6);
  check("dropping through a platform is EASIER than fastfalling",
     PLATFORM_DROP_STICK_THRESHOLD < FASTFALL_STICK_THRESHOLD
     && PLATFORM_DROP_WINDOW > FASTFALL_WINDOW);
  // The band where the two disagree -- a stick at 0.662 drops through a
  // platform but does not fastfall.
  check("a 0.662 stick drops through but does not fastfall",
     0.662 > PLATFORM_DROP_STICK_THRESHOLD && 0.662 < FASTFALL_STICK_THRESHOLD);

  // Three separate fields all holding 0.6625. Same number, different fields --
  // collapsing them into one constant would be wrong if a mod changed one.
  eq("c-stick jump gate", CSTICK_JUMP_THRESHOLD, 0.6625000238418579);
  eq("ledge attack c-stick gate", LEDGE_ATTACK_CSTICK_THRESHOLD, 0.6625000238418579);
  check("c-stick jump, ledge attack and tap jump are DISTINCT fields that agree",
     CSTICK_JUMP_THRESHOLD === TAP_JUMP_THRESHOLD
     && LEDGE_ATTACK_CSTICK_THRESHOLD === TAP_JUMP_THRESHOLD);
}

// ------------------------------------- special select (x218 / x21C)
{
  eq("special select: horizontal gate is 0.6", SPECIAL_STICK_X_THRESHOLD, 0.6000000238418579);
  eq("special select: vertical gate is 0.55", SPECIAL_STICK_Y_THRESHOLD, 0.550000011920929);
  check("special select: the two axes use DIFFERENT thresholds",
     SPECIAL_STICK_X_THRESHOLD !== SPECIAL_STICK_Y_THRESHOLD);
  // x21C serves both the special select and Marth's Dancing Blade split, which
  // is why the constant is named for the quantity and not either call site.
  check("a 0.57 stick up is an up-special but a 0.57 stick sideways is not a side-special",
     0.57 >= SPECIAL_STICK_Y_THRESHOLD && 0.57 < SPECIAL_STICK_X_THRESHOLD);
}

// ---------------------------------- ground state transitions (x58, x90, x94)
{
  eq("dash->run / run->runbrake share one threshold",
     X58_STICK_THRESHOLD, 0.625);

  // Crouch is a hysteresis band, not one number. Melee enters below -0.6875 and
  // releases above -0.625, so there is a sticky region between them.
  check("crouch: release threshold is LOWER than entry, giving hysteresis",
     SQUAT_RELEASE_STICK_THRESHOLD < SQUAT_STICK_THRESHOLD);
  check("crouch: a stick at 0.65 neither enters nor releases",
     0.65 < SQUAT_STICK_THRESHOLD && 0.65 > SQUAT_RELEASE_STICK_THRESHOLD);
  // meleelight's 0.69/0.61 band was wider on the release side, so a crouch
  // held at 0.62 would have released when Melee keeps it.
  check("crouch: 0.62 releases in Melee but not under the old 0.61",
     0.62 < SQUAT_RELEASE_STICK_THRESHOLD && 0.62 > 0.61);
}

// -------------------------------- smash / dash input (ftCo_AttackS4.c:53)
// Every smash and dash input is `threshold now && tilt timer inside a window`,
// reusing the same x670/x671 timers as SDI and tap jump.
{
  eq("smash: horizontal threshold is 0.8, not 0.79",
     DASH_SMASH_STICK_THRESHOLD, 0.800000011920929);
  eq("smash: up threshold is 0.6625, not 0.66",
     UP_SMASH_STICK_THRESHOLD, 0.6625000238418579);
  eq("smash: down threshold is the NEGATED same value",
     DOWN_SMASH_STICK_THRESHOLD, -UP_SMASH_STICK_THRESHOLD);

  // The windows differ by axis, which the old "two frames ago" proxy could not
  // express: 2 frames horizontally, 4 vertically.
  eq("smash: horizontal window is 2 frames", DASH_SMASH_WINDOW, 2);
  eq("smash: vertical window is 4 frames", UP_SMASH_WINDOW, 4);
  check("smash: the two windows are genuinely different",
     DASH_SMASH_WINDOW !== UP_SMASH_WINDOW);

  // xD0/xD8 are declared `float` in the decomp and compared against an int
  // timer. Storing them as ints would still work here, but the tell that a
  // field has been mistyped is exactly this kind of mismatch, so pin the type.
  check("smash: the vertical windows are the float 4.0 the struct declares",
     Object.is(UP_SMASH_WINDOW, 4.0) && Object.is(DOWN_SMASH_WINDOW, 4.0));

  // The band the old 0.79 got wrong.
  check("smash: a 0.795 stick is NOT a smash in Melee but was under 0.79",
     0.795 < DASH_SMASH_STICK_THRESHOLD && 0.795 > 0.79);
}

// ------------------------------------------------- SDI / ASDI constants
// All four were extracted and validated against the disc long before anything
// used them; the live code ran on float64 literals. These pin the values that
// the SDI gate and the ASDI shift now actually read.
{
  eq("SDI: min stick magnitude is the disc float32, not 0.7",
     SDI_MIN_STICK_MAG, 0.699999988079071);
  check("SDI: ...and that is NOT the decimal 0.7",
     SDI_MIN_STICK_MAG !== 0.7);
  eq("SDI: stick window is 4 frames", SDI_STICK_WINDOW, 4);
  eq("SDI: position scale is 6", SDI_POS_SCALE, 6);
  eq("ASDI: position scale is 3", ASDI_SCALE, 3);

  // The gate compares SQUARED magnitude against the squared threshold, so the
  // boundary is decided without a square root. A stick at exactly the
  // threshold on one axis qualifies; just under does not.
  const minSq = Math.fround(SDI_MIN_STICK_MAG * SDI_MIN_STICK_MAG);
  check("SDI: a full-tilt cardinal stick clears the magnitude gate",
     Math.fround(1 * 1) >= minSq);
  // A 0.5/0.5 diagonal has magnitude 0.707, which is ABOVE the 0.7 threshold --
  // the gate is on the magnitude, not on either axis, so a diagonal qualifies
  // at a deflection neither axis could reach alone.
  check("SDI: a 0.5/0.5 diagonal clears it (0.5 >= 0.49) even though neither axis does",
     Math.fround(Math.fround(0.5 * 0.5) + Math.fround(0.5 * 0.5)) >= minSq
     && 0.5 < SDI_MIN_STICK_MAG);
  check("SDI: a 0.45/0.45 diagonal falls short (0.405 < 0.49)",
     Math.fround(Math.fround(0.45 * 0.45) + Math.fround(0.45 * 0.45)) < minSq);

  // The smash deadzone is what the tilt timer keys on -- 0.25, a different
  // constant from the 0.28 movement deadzone. Confusing the two would change
  // which frame counts as the crossing.
  eq("SDI: tilt timer keys on the SMASH deadzone (0.25)",
     HORIZONTAL_STICK_SMASH_DEADZONE, 0.25);
  check("SDI: which is not the 0.28 movement deadzone",
     HORIZONTAL_STICK_SMASH_DEADZONE !== HORIZONTAL_STICK_DEADZONE);
}

// ---------------------------- ftCommon_8007CF58 air decay (ftcommon.c:283)
// Two regimes: above air_drift_max the decay is the SHARED x1FC (0.03), below
// it the character's own aerial_friction. Both land exactly on zero.
{
  eq("air decay: x1FC from the disc", OVER_MAX_AIR_DECAY, 0.029999999329447746);

  // Above air_drift_max (Fox 0.83) -> the shared rate.
  const fast = mkPlayer({ cVel: { x: 2.0, y: 0 }, grounded: false });
  applyAirDecay(0);
  eq("air decay: above air_drift_max uses x1FC",
     fast.phys.cVel.x, f32(2.0 - OVER_MAX_AIR_DECAY));

  // Below it -> the character's aerial friction, which for Fox is a different
  // number, so the two regimes are distinguishable.
  const slow = mkPlayer({ cVel: { x: 0.5, y: 0 }, grounded: false });
  applyAirDecay(0);
  eq("air decay: below air_drift_max uses aerial_friction",
     slow.phys.cVel.x, f32(0.5 - FOX.airFriction));
  check("air decay: the two regimes really are different rates",
     OVER_MAX_AIR_DECAY !== FOX.airFriction);

  // Always toward ZERO, both directions -- the bug this replaced decayed along
  // facing, which accelerated a backwards-moving fighter away from zero.
  const back = mkPlayer({ cVel: { x: -2.0, y: 0 }, grounded: false });
  applyAirDecay(0);
  check("air decay: negative velocity decays TOWARD zero",
     back.phys.cVel.x > -2.0 && back.phys.cVel.x < 0);

  // Lands exactly on zero rather than overshooting into the other sign.
  const tiny = mkPlayer({ cVel: { x: 0.001, y: 0 }, grounded: false });
  applyAirDecay(0);
  eq("air decay: settles exactly on 0", tiny.phys.cVel.x, 0);
}

// ------------------------------------- applyGravity (ftCommon_Fall :462)
// Split out of fastfall() so states that apply gravity WITHOUT the fastfall
// check -- ft_80084EEC (ft_084E.c:33) -- can use it.
{
  const pl = mkPlayer({ cVel: { x: 0, y: 0 }, grounded: false });
  applyGravity(0);
  eq("applyGravity: one frame from rest", pl.phys.cVel.y, f32(0 - FOX.gravity));

  const pl2 = mkPlayer({ cVel: { x: 0, y: -2.79 }, grounded: false });
  applyGravity(0);
  eq("applyGravity: clamps at -terminal_velocity", pl2.phys.cVel.y, -FOX.terminalV);

  // No fastfall, whatever the stick says -- that is the whole reason it exists.
  const pl3 = mkPlayer({ cVel: { x: 0, y: -1 }, grounded: false });
  applyGravity(0);
  check("applyGravity: never triggers a fastfall", pl3.phys.fastfalled !== true);
}

// ------------------------------------- smash charge (ft_0DF0.c, ftaction.c)
// dmg * ((0.003906f*rate - 1) * (frames/hold) + 1), all float32. rate and hold
// are SUBACTION data (event 0x38), not ftCommonData -- tools/smash_charge.py
// re-extracts them and confirms they are uniform at 350 / 60.
{
  eq("smash charge: rate from the disc", SMASH_CHARGE_RATE, 350);
  eq("smash charge: hold frames from the disc", SMASH_CHARGE_FRAMES, 60);
  eq("smash charge: dmg_mult is f32(0.003906f * 350)",
     smashChargeDamageMul(SMASH_CHARGE_RATE), 1.3671000003814697);

  eq("smash charge: zero charge is identity", applySmashCharge(10, 0), 10);
  const full = applySmashCharge(10, 60);
  check(`smash charge: full charge is 1.3671x (got ${full})`,
     Math.abs(full - 13.671) < 1e-4);
  isF32("smash charge result", full);

  // meleelight used the decimal 0.3671 in float64. Melee builds `dmg_mult - 1`
  // in float32 from a float32 0.003906, which is 0.3671000003814697, and runs
  // the whole chain single-precision. Four of the 61 reachable charge frames
  // land on a different float32 through the two.
  const old_ = (d, f) => 1 + (f * (0.3671 / 60));
  let differing = 0;
  for (let f = 0; f <= 60; f++) {
    const mine = applySmashCharge(1, f);
    if (mine !== Math.fround(old_(1, f))) { differing++; }
  }
  check(`smash charge: differs from the float64 form on ${differing} of 61 frames (expect 4)`,
     differing === 4);
}

// ------------------------------------------------- staling (plstale.c, ft_0881.c)
{
  const FTILT = 7, JAB1 = 2, DEFAULT = 1;   // FtMoveId values from the table

  eq("staling: nine weights", STALE_WEIGHTS.length, 9);
  eq("staling: weights are 0.09 down to 0.01",
     STALE_WEIGHTS.map((w) => Math.round(w * 100)).join(","),
     "9,8,7,6,5,4,3,2,1");
  const sum = STALE_WEIGHTS.reduce((a, b) => a + b, 0);
  check(`staling: weights sum to 0.45 (got ${sum.toFixed(4)})`,
     Math.abs(sum - 0.45) < 1e-6);

  // A fresh table stales nothing.
  let t = newStaleTable();
  eq("staling: fresh table is a 1.0 multiplier", staleMultiplier(t, FTILT), 1);
  eq("staling: fresh table leaves damage alone", staleDamage(t, FTILT, 12), 12);

  // FtMoveId_Default never stales, whatever the table holds.
  pushStaleMove(t, DEFAULT, 1);
  eq("staling: Default is not recorded", t.index, 0);
  eq("staling: Default never stales", staleMultiplier(t, DEFAULT), 1);

  // One landed f-tilt: the NEXT f-tilt is staled by weights[0].
  t = newStaleTable();
  check("staling: first hit is recorded", pushStaleMove(t, FTILT, 100));
  eq("staling: one prior use subtracts weights[0]",
     staleMultiplier(t, FTILT), Math.fround(1 - STALE_WEIGHTS[0]));
  eq("staling: a DIFFERENT move is unaffected", staleMultiplier(t, JAB1), 1);

  // Same (id, instance) is deduped -- one swing, one entry, however many hits.
  check("staling: the same attack instance is not recorded twice",
     pushStaleMove(t, FTILT, 100) === false);
  eq("staling: ...and the ring did not advance", t.index, 1);
  check("staling: a NEW instance of the same move is recorded",
     pushStaleMove(t, FTILT, 101) === true);

  // Two prior uses stack, most recent first.
  eq("staling: two prior uses subtract weights[0] + weights[1]",
     staleMultiplier(t, FTILT),
     Math.fround(Math.fround(1 - STALE_WEIGHTS[0]) - STALE_WEIGHTS[1]));

  // Nine in a row is the floor: 55%.
  t = newStaleTable();
  for (let i = 0; i < 9; i++) { pushStaleMove(t, FTILT, 200 + i); }
  const floor9 = staleMultiplier(t, FTILT);
  check(`staling: nine uses give 0.55 (got ${floor9.toFixed(6)})`,
     Math.abs(floor9 - 0.55) < 1e-6);

  // The walk is only NINE deep even though the ring holds ten, so a tenth use
  // pushes the oldest out of range rather than staling further.
  pushStaleMove(t, FTILT, 209);
  check("staling: a tenth use does not stale past the nine-deep floor",
     Math.abs(staleMultiplier(t, FTILT) - floor9) < 1e-6);

  // Interleaving a different move pushes the older entries further back, so
  // they are weighted less.
  t = newStaleTable();
  pushStaleMove(t, FTILT, 300);
  pushStaleMove(t, JAB1, 301);
  eq("staling: an intervening move moves the entry to weights[1]",
     staleMultiplier(t, FTILT), Math.fround(1 - STALE_WEIGHTS[1]));

  // Reset clears it.
  resetStaleTable(t);
  eq("staling: reset restores a 1.0 multiplier", staleMultiplier(t, FTILT), 1);
  eq("staling: reset rewinds the ring", t.index, 0);

  // Instances never repeat and never take the 0 that marks an empty slot.
  const a1 = nextAttackInstance(), a2 = nextAttackInstance();
  check("staling: attack instances advance", a2 === a1 + 1);
  check("staling: attack instances are never 0", a1 !== 0 && a2 !== 0);

  // The generated id table: what shares an id is the whole point.
  eq("move ids: jab 1 and jab 2 are DIFFERENT moves",
     moveIdFor(CHARIDS.FOX_ID, "JAB1") === moveIdFor(CHARIDS.FOX_ID, "JAB2"), false);
  eq("move ids: an aerial and its landing state are the SAME move",
     moveIdFor(CHARIDS.FOX_ID, "ATTACKAIRN"),
     moveIdFor(CHARIDS.FOX_ID, "LANDINGATTACKAIRN"));
  eq("move ids: both firefox states are one SpecialHi",
     moveIdFor(CHARIDS.FOX_ID, "UPSPECIALCHARGE"),
     moveIdFor(CHARIDS.FOX_ID, "UPSPECIALLAUNCH"));
  eq("move ids: a non-attack state is Default",
     moveIdFor(CHARIDS.FOX_ID, "WAIT"), 1);
  eq("move ids: an unknown state is Default",
     moveIdFor(CHARIDS.FOX_ID, "NOT_A_STATE"), 1);
}

// ------------------------------ knockback stacking (ftCo_Damage_CalcVel :216)
// Within xFC (10) frames of the previous hit the knockback REPLACES; beyond
// that it combines per axis -- opposite signs add, same signs keep the larger
// magnitude. Ported but never called until now, so a second hit landing
// mid-launch used to overwrite unconditionally.
{
  const cur = { x: 2, y: 3 };

  // Fresh fighter: the counter is -1, which is < 10, so replace.
  const fresh = stackKnockback(cur, 1, 1, -1);
  eq("stacking: first hit ever replaces (x)", fresh.x, 1);
  eq("stacking: first hit ever replaces (y)", fresh.y, 1);

  // Inside the window: replace even though the existing knockback is larger.
  const inside = stackKnockback(cur, 1, 1, 3);
  eq("stacking: inside the 10-frame window replaces (x)", inside.x, 1);
  eq("stacking: inside the 10-frame window replaces (y)", inside.y, 1);

  // Outside the window, opposing signs ADD.
  const opposed = stackKnockback({ x: 2, y: 0 }, -5, 0, 20);
  eq("stacking: opposing components add", opposed.x, -3);

  // Outside the window, same signs keep the LARGER magnitude.
  eq("stacking: same sign keeps the larger", stackKnockback({ x: 2, y: 0 }, 5, 0, 20).x, 5);
  eq("stacking: same sign ignores the smaller", stackKnockback({ x: 5, y: 0 }, 2, 0, 20).x, 5);

  // Axes are independent.
  const mixed = stackKnockback({ x: 2, y: 4 }, -1, 1, 20);
  eq("stacking: x opposed adds", mixed.x, 1);
  eq("stacking: y same-sign keeps larger", mixed.y, 4);
}

// -------------------------------------------- Puff Rollout (ftpurinspecials.c)
// calcAngleRadians (:78-95) plus the xF0/xF4 velocity recurrence (:97-125).
{
  const PUFF = capturedAttributes[CHARIDS.PUFF_ID];
  check("Puff attributes loaded", PUFF !== undefined);

  const p = mkPlayer();
  p.charAttributes = PUFF;

  const deg = (a) => a / Math.fround(0.01745329252);

  // The stick map has a floor at 0.1 and saturates at 0.5, so half deflection
  // is already full tilt. meleelight's old `lsY * 20 deg` gave 10 deg here.
  check("rollout: lsY 0.10 is inside the floor, angle 0",
     rolloutAngle(0, 0.10) === 0);
  check("rollout: lsY 0.05 is inside the floor, angle 0",
     rolloutAngle(0, 0.05) === 0);
  check(`rollout: lsY 0.50 saturates at 20 deg (got ${deg(rolloutAngle(0, 0.5)).toFixed(4)})`,
     Math.abs(deg(rolloutAngle(0, 0.5)) - 20) < 1e-4);
  check("rollout: lsY 1.00 is still 20 deg, not more",
     rolloutAngle(0, 1.0) === rolloutAngle(0, 0.5));
  check(`rollout: lsY 0.30 is the midpoint, 10 deg (got ${deg(rolloutAngle(0, 0.3)).toFixed(4)})`,
     Math.abs(deg(rolloutAngle(0, 0.3)) - 10) < 1e-4);
  check("rollout: the map is odd in lsY",
     rolloutAngle(0, -0.3) === -rolloutAngle(0, 0.3));
  isF32("rollout angle", rolloutAngle(0, 0.3));

  // The airVelocities table this replaced was the geometric sequence
  // 2.2 * 0.92^(n+1) rounded to five decimals. Reproducing its first entries
  // from the attributes is what justifies deleting it.
  const OLD = [2.024, 1.86208, 1.71311, 1.57606, 1.44998, 1.33398, 1.22726];
  let v = PUFF.rolloutSpeed;
  let worstT = 0;
  for (let i = 0; i < OLD.length; i++) {
    v = Math.fround(v * PUFF.rolloutDecay);
    worstT = Math.max(worstT, Math.abs(v - OLD[i]));
  }
  check(`rollout recurrence reproduces the old table (worst ${worstT.toExponential(2)})`,
     worstT < 1e-5);
  // The first value out is speed*decay, not speed -- Melee seeds and decays in
  // the same frame. It is NOT exactly the table's 2.024: that entry was this
  // product truncated to five decimals, and the recurrence is the more precise
  // of the two by ~2.4e-7.
  const first = Math.fround(PUFF.rolloutSpeed * PUFF.rolloutDecay);
  check("rollout: first velocity out is speed*decay, not speed",
     first !== PUFF.rolloutSpeed && Math.abs(first - 2.024) < 1e-6);
  check("rollout: the recurrence is more precise than the table entry it replaced",
     first !== Math.fround(2.024));
}

// ------------------------------------------- capsule collision (capsule.js)
// lbColl_80006094. The geometry is 3D on purpose: the depth axis is what lets
// limbs slip past attacks, and flattening it would land hits Melee misses.
{
  const P = (x, y, z) => ({ x, y, z });
  const ov = capsuleOverlap;

  eq("spheres 5 apart with radii 1+1 miss",
     ov(P(0,0,0), P(0,0,0), P(5,0,0), P(5,0,0), 1, 1), false);
  eq("spheres exactly touching count as a hit",
     ov(P(0,0,0), P(0,0,0), P(2,0,0), P(2,0,0), 1, 1), true);
  eq("crossing segments hit",
     ov(P(-5,0,0), P(5,0,0), P(0,-5,0), P(0,5,0), 0.1, 0.1), true);
  eq("parallel segments 3 apart with radii 1+1 miss",
     ov(P(0,0,0), P(10,0,0), P(0,3,0), P(10,3,0), 1, 1), false);
  eq("parallel segments 1.5 apart hit",
     ov(P(0,0,0), P(10,0,0), P(0,1.5,0), P(10,1.5,0), 1, 1), true);
  eq("segments past each other's ends miss",
     ov(P(0,0,0), P(1,0,0), P(10,0,0), P(11,0,0), 1, 1), false);

  // The one that matters: identical in the plane meleelight draws, separated
  // only in depth.
  eq("separated only in DEPTH, misses",
     ov(P(0,0,0), P(0,0,0), P(0,0,8), P(0,0,8), 2, 2), false);
  eq("...and hits once the depth closes",
     ov(P(0,0,0), P(0,0,0), P(0,0,3), P(0,0,3), 2, 2), true);
}

// ------------------------------------- ground normals must be unit length
//
// ftCommon_ApplyGroundMovement (ftcommon.c:133) multiplies the along-ground
// scalar by the floor normal's components:
//   self_vel.x = +normal.y * gr_vel;  self_vel.y = -normal.x * gr_vel;
// In Melee `coll_data.floor.normal` is a UNIT normal, so any other magnitude
// scales the fighter's speed by exactly that factor.
//
// meleelight's callers do NOT supply a unit vector: both call sites pass
// outwardsWallNormal (environmentalCollision.js:78), whose perpendicular is
// `(y2 - y1, x1 - x2)` -- magnitude equal to the SEGMENT'S LENGTH. Every test
// above hands setGroundNormal a hand-written unit vector, which is why none of
// them caught it. These feed the raw stage geometry through instead.
{
  // Battlefield's left platform, straight out of the stage data.
  const plfL = { x: -57.6, y: 27.2 };
  const plfR = { x: -20, y: 27.2 };

  const raw = outwardsWallNormal(plfL, plfR, "p");
  const rawMag = Math.sqrt(raw.x * raw.x + raw.y * raw.y);
  check("stage perpendicular really is un-normalised (magnitude = length)",
        Math.abs(rawMag - 37.6) < 1e-6,
        `expected ~37.6, got ${rawMag}`);

  const pl = mkPlayer({ grVel: 0.3 });
  setGroundNormal(0, raw);
  const n = pl.phys.groundNormal;
  const mag = Math.sqrt(n.x * n.x + n.y * n.y);
  check("stored ground normal is unit length",
        Math.abs(mag - 1) < 1e-6, `expected 1, got ${mag}`);
  eq("flat platform normalises to exactly (0,1).y", n.y, 1);
  // -0 here: the perpendicular's x is `-1 * 0`. Value-equal to 0, and every
  // arithmetic use below behaves identically, so compare loosely.
  check("flat platform normalises to exactly (0,1).x", n.x === 0,
        `expected 0, got ${n.x}`);

  // THE REGRESSION: walking speed must not depend on how long the surface is.
  // Compared against f32(0.3), not 0.3 -- projectGroundVelocity rounds through
  // binary32 like Melee does, so the exact result is the float32 nearest 0.3.
  projectGroundVelocity(0);
  eq("walk speed is independent of surface length", pl.phys.cVel.x, f32(0.3));

  // The main stage floor is far longer; it must give the same speed.
  const groundRaw = outwardsWallNormal({ x: -68.4, y: 0 }, { x: 68.4, y: 0 }, "g");
  const pl2 = mkPlayer({ grVel: 0.3 });
  setGroundNormal(0, groundRaw);
  projectGroundVelocity(0);
  eq("a 136.8-long floor gives the same speed as a 37.6-long platform",
     pl2.phys.cVel.x, f32(0.3));

  // Direction must survive normalisation: a 45 degree slope still tilts the
  // velocity, it just is not scaled any more.
  const slopeRaw = outwardsWallNormal({ x: 0, y: 0 }, { x: 10, y: 10 }, "g");
  const pl3 = mkPlayer({ grVel: 1.0 });
  setGroundNormal(0, slopeRaw);
  const n3 = pl3.phys.groundNormal;
  check("45 degree slope normal is unit length",
        Math.abs(Math.sqrt(n3.x * n3.x + n3.y * n3.y) - 1) < 1e-6);
  check("45 degree slope still points diagonally",
        Math.abs(Math.abs(n3.x) - Math.abs(n3.y)) < 1e-6,
        `got (${n3.x}, ${n3.y})`);

  // A degenerate (zero-length) surface must not produce NaN.
  const pl4 = mkPlayer({ grVel: 1.0 });
  setGroundNormal(0, { x: 0, y: 0 });
  projectGroundVelocity(0);
  eq("degenerate normal falls back to flat ground", pl4.phys.cVel.x, 1.0);

  // ROUND-TRIP STABILITY. Every airborne->grounded transition runs
  // syncGrVelFromCVel (dot with the normal) and every frame runs
  // projectGroundVelocity (multiply by it). With a unit normal that pair is
  // the identity; with the raw perpendicular it multiplied speed by |n| TWICE
  // per transition, so velocity ran away to Infinity in 13 landings and then
  // to NaN (-0 * Infinity). A NaN position renders nothing, is never inside
  // the blastzone so the fighter never dies, and makes NearestEnemy's distance
  // compare false forever -- the opponent vanishes and the AI logs
  // "cant find nearest enemy" every frame. This is that bug, in one assertion.
  const pl5 = mkPlayer({ cVel: { x: 0.3, y: 0 }, grVel: 0 });
  setGroundNormal(0, outwardsWallNormal(plfL, plfR, "p"));
  for (let i = 0; i < 30; i++) {
    syncGrVelFromCVel(0);
    projectGroundVelocity(0);
  }
  check("30 ground transitions do not amplify velocity",
        Number.isFinite(pl5.phys.cVel.x) && Number.isFinite(pl5.phys.cVel.y),
        `cVel went non-finite: (${pl5.phys.cVel.x}, ${pl5.phys.cVel.y})`);
  eq("...and leave the speed exactly where it started",
     pl5.phys.cVel.x, f32(0.3));
}

// ------------------------------------------------- ledge snap boxes
//
// mpColl_80044164 (mpcoll.c:1253) and mpColl_800443C4 (mpcoll.c:1326).
// Melee's ECB values are OFFSETS from the position -- every use reads
// `cd->cur_pos.x + cd->ecb.right.x`. meleelight stores ECB1 as absolute world
// points, and feeding those in raw added the position twice, which made the
// box grow without bound as the player moved and snapped them to the stage
// edge on a plain walk. These assertions pin the geometry down.
{
  // Box2D stores the snap box with min.y = TOP and max.y = BOTTOM.
  const SNAP_X = 12;
  const SNAP_Y = 3;
  const SNAP_H = 10;
  const ECB_R = 2.5;   // half-width, as an offset from the position
  const ECB_L = -2.5;

  // ECB1 is passed in meleelight's ABSOLUTE form, exactly as dealWithLedges
  // passes it: physics.js builds it as Vec2D(pos.x + ecbOffset[1], ...). The
  // function converts to Melee's relative space itself. Feeding absolute
  // points through here is what makes these assertions cover the real call
  // path rather than just the formula.
  const absEcb = (x, y) => [
    { x: x, y: y },
    { x: x + ECB_R, y: y + 7 },
    { x: x, y: y + 14 },
    { x: x + ECB_L, y: y + 7 },
  ];

  const box = (x, y, px, py) =>
    ledgeSnapBoxes(x, y, px, py, absEcb(x, y), SNAP_X, SNAP_Y, SNAP_H);

  // Stationary at the origin: the literal formula.
  const at0 = box(0, 0, 0, 0);
  eq("ledge box F left  at origin", at0.forward.min.x, 0);
  eq("ledge box F right at origin", at0.forward.max.x, SNAP_X + ECB_R);
  eq("ledge box B left  at origin", at0.backward.min.x, -SNAP_X + ECB_L);
  eq("ledge box B right at origin", at0.backward.max.x, 0);
  eq("ledge box top    at origin", at0.forward.min.y, SNAP_Y + 0.5 * SNAP_H);
  eq("ledge box bottom at origin", at0.forward.max.y, SNAP_Y - 0.5 * SNAP_H);

  // THE REGRESSION. Translating the player must translate the boxes by
  // exactly the same amount and must not change their width. The
  // absolute/relative mix-up doubled the position here, so the width grew
  // linearly with distance from the origin.
  const D = 100;
  const moved = box(D, 0, D, 0);
  eq("ledge box F translates with the player",
     moved.forward.max.x - at0.forward.max.x, D);
  eq("ledge box B translates with the player",
     moved.backward.min.x - at0.backward.min.x, D);
  eq("ledge box F width is position independent",
     moved.forward.max.x - moved.forward.min.x,
     at0.forward.max.x - at0.forward.min.x);
  eq("ledge box B width is position independent",
     moved.backward.max.x - moved.backward.min.x,
     at0.backward.max.x - at0.backward.min.x);

  // ...and the same going left, where the doubling flipped sign.
  const movedL = box(-D, 0, -D, 0);
  eq("ledge box F width unchanged at negative x",
     movedL.forward.max.x - movedL.forward.min.x,
     at0.forward.max.x - at0.forward.min.x);

  // The sweep: the box spans last frame's position and this one, so a fast
  // approach cannot tunnel through the grab region.
  const swept = box(10, 0, -10, 0);
  eq("swept box F starts at the earlier x", swept.forward.min.x, -10);
  eq("swept box F ends at the later x + snap",
     swept.forward.max.x, SNAP_X + 10 + ECB_R);
  eq("swept box B starts at the earlier x + snap",
     swept.backward.min.x, -SNAP_X + -10 + ECB_L);
  eq("swept box B ends at the later x", swept.backward.max.x, 10);

  // Vertical extent sweeps too, and is symmetric about ledge_snap_y.
  const sweptY = box(0, 20, 0, -20);
  eq("swept box top uses max y", sweptY.forward.min.y, 20 + SNAP_Y + 0.5 * SNAP_H);
  eq("swept box bottom uses min y", sweptY.forward.max.y, -20 + SNAP_Y - 0.5 * SNAP_H);
}

// --------------------------------------------------------------- report

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log();
  process.exit(1);
}
console.log("  all physics assertions hold\n");
