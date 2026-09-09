//
// Knockback, hitstun, hitlag and DI, ported from the decompilation.
//
// EXACTNESS STATUS
// ----------------
// All +,-,*,/ here is exact float32 via the f32 layer, as elsewhere.
//
// The transcendental calls were initially assumed to be an unavoidable ceiling.
// They are not. Melee does not call a correctly-rounded libm -- it runs
// Metrowerks' own float32 polynomial approximations, and those are in the
// decomp. sinf and cosf are therefore ported exactly in physics/trig.js and
// used here; matching the console means running that polynomial, INCLUDING its
// approximation error, not computing a more accurate sine.
//
// sqrtf is now exact too: physics/gekko.js implements the Gekko `frsqrte`
// estimate table and the three Newton-Raphson steps of src/MSL/math_ppc.h:11.
// Over an exhaustive scan of 8M consecutive float32 values it agrees with a
// correctly rounded square root, so this closed a gap that turned out to be
// empty in practice -- but it is now closed by construction rather than by
// assumption, and it holds outside the range anyone happened to test.
//
// Everything here is now bit-exact. atan2f and acosf were long marked NOT
// BIT-EXACT, because src/MSL/math.h declares them and no definition appears in
// the decompiled MSL sources -- but the retail DOL has the compiled functions
// and the decomp's symbol map gives their addresses, so they were disassembled
// instead. See the header in physics/trig.js.

import { f32, add, sub, mul, div, neg } from "physics/f32";
import { sinf, cosf, atan2f, acosf, mtxDegToRad } from "physics/trig";
import { sqrtf } from "physics/gekko";
import {
  WEIGHT_PRESCALE, WEIGHT_CURVE_NUM, KB_CAP, KB_MIN,
  PERCENT_LINEAR, PERCENT_X_DAMAGE, SETKB_PSEUDO_PERCENT,
  KB_OUTER_MUL, KB_OUTER_ADD, KB_SQUAT_MUL,
  LAUNCH_SPEED_MUL, AIRBORNE_KB_RESCALE,
  SAKURAI_AIR_RADIANS, SAKURAI_MAX_DEG, SAKURAI_LO, SAKURAI_HI,
  HITSTUN_MUL, HITLAG_CAP, HITLAG_SLOPE, HITLAG_ADD, HITLAG_CROUCH_MUL,
  MAX_DI_DEGREES, KB_FRAME_DECAY, KB_STACK_WINDOW,
  GROUND_KB_SEED_CAP, SHIELD_KB_FRAME_DECAY,
  KNOCKBACK_GROUND_FRICTION_MULTIPLIER, SHIELD_GROUND_FRICTION_MULTIPLIER,
  LAUNCH_LEVEL_1, LAUNCH_LEVEL_2, LAUNCH_LEVEL_3,
  GROUND_LAUNCH_BOUNCE_RADIANS, GROUND_LAUNCH_BOUNCE_YMUL,
} from "physics/meleeCommon";

// MTXDegToRad's constant is a float32 LITERAL, 0.01745329252f -- not Math.PI/180.
// The two are not the same number: as a double, pi/180 is 0.017453292519943295,
// and the float32 the game multiplies by is 0.01745329238474369. Every degrees
// -> radians conversion below goes through mtxDegToRad so it uses the game's.

// Port of ftColl_80079AB0 (decomp: src/melee/ft/ftcoll.c:2387) and its
// KNOCKBACK macro (ftcoll.c:2377).
//
//   w          = weight * xF4
//   inner_expr = x11C * ((xF8 - (w*xF8)/(1+w)) * inner) + x120
//   term       = 0.01 * kb_growth * inner_expr + base_kb
//   result     = defense * (attack * (stage * term))
//   if (result >= x108) result = x108
//
// `inner` differs by hit type:
//   weight-dependent SET knockback (hit->x28 != 0):
//       x118*x110 + x114*(x118 * set_kb)
//   normal:
//       x110*(percent + percentTemp) + x114*(unstaled_dmg * (percent + percentTemp))
//
// CRITICAL: the damage term in `inner` is the UNSTALED damage
// (hit->unk_count, ftcoll.c:2989), while the percent term uses the STALED
// damage. Melee stales the percent you take but not the knockback you take.
export function calcKnockback(o) {
  const {
    percent = 0,            // fp->dmg.x1830_percent (int) + x1838_percentTemp
    unstaledDamage = 0,     // hit->unk_count -- NOT the staled damage
    weight = 100,
    kbGrowth = 0,           // hit->x24
    baseKb = 0,             // hit->x2C
    setKb = 0,              // hit->x28, 0 when not weight-dependent-set
    defenseRatio = 1, attackRatio = 1, stageRatio = 1,
  } = o;

  const w = mul(weight, WEIGHT_PRESCALE);

  let inner;
  if (setKb !== 0) {
    inner = add(mul(SETKB_PSEUDO_PERCENT, PERCENT_LINEAR),
                mul(PERCENT_X_DAMAGE, mul(SETKB_PSEUDO_PERCENT, setKb)));
  } else {
    inner = add(mul(PERCENT_LINEAR, percent),
                mul(PERCENT_X_DAMAGE, mul(unstaledDamage, percent)));
  }

  // (xF8 - (w*xF8)/(1+w)) * inner
  const weightCurve = sub(WEIGHT_CURVE_NUM,
                          div(mul(w, WEIGHT_CURVE_NUM), add(1, w)));
  const innerExpr = add(mul(KB_OUTER_MUL, mul(weightCurve, inner)), KB_OUTER_ADD);
  const term = add(mul(mul(f32(0.01), kbGrowth), innerExpr), baseKb);
  let result = mul(defenseRatio, mul(attackRatio, mul(stageRatio, term)));

  if (result >= KB_CAP) { result = KB_CAP; }
  return result;
}

// Port of ftCo_Damage_CalcKnockback (decomp: ftCo_Damage.c:118).
// Post-formula modifiers. Order matters: crouch/ice/charge multipliers first,
// then armour subtraction, then the KB_MIN floor.
export function applyKnockbackModifiers(kb, o = {}) {
  const { crouching = false, armor = 0 } = o;
  if (!kb) { return kb; }
  let k = kb;
  if (crouching) { k = mul(k, KB_SQUAT_MUL); }   // crouch cancel, x124 == 2/3
  if (armor) {
    k = sub(k, armor);
    if (k < KB_MIN) { k = KB_MIN; }
  }
  return k;
}

// Port of the hitstun assignment in ftCo_8008DCE0 (decomp: ftCo_Damage.c:292).
//
//   fp->mv.co.damage.x0 = (int)(kb_applied * x154);
//   if (!fp->mv.co.damage.x0) fp->mv.co.damage.x0 = 1;
//
// The MINIMUM OF 1 is the part meleelight lacked: any connecting hit produces
// at least one frame of hitstun even when the knockback rounds to zero.
export function calcHitstun(kbApplied) {
  let h = Math.trunc(mul(kbApplied, HITSTUN_MUL));
  if (!h) { h = 1; }
  return h;
}

// Port of ftCommon_CalcHitlag (decomp: src/melee/ft/ftcommon.c:640).
//
//   int tmp = dmg * x198 + x19C;
//   float result = (int)(tmp * mul);
//   if (crouching) result = (int)(result * x1A0);
//
// Note the DOUBLE integer truncation -- once into `tmp`, once after scaling by
// the element multiplier. Reproducing only one of them gives the wrong answer
// on electric hits. The cap is applied by the caller (fighter.c:2971).
export function calcHitlag(damage, o = {}) {
  const { elementMul = 1, crouching = false, cap = true } = o;
  // The parameter is `int dmg`, so a fractional damage (staling, a smash
  // charge) truncates BEFORE the formula, not after. With x198 == 1/3 this
  // happens to be unobservable -- a scan of every damage 0..600 at 0.01
  // granularity finds no case where it changes the answer -- but that is a
  // property of the constant, not of the code, so the truncation is written
  // where the original has it.
  const dmgInt = Math.trunc(damage);
  const tmp = Math.trunc(add(mul(dmgInt, HITLAG_SLOPE), HITLAG_ADD));
  let result = Math.trunc(mul(tmp, elementMul));
  if (crouching) { result = Math.trunc(mul(result, HITLAG_CROUCH_MUL)); }
  if (cap && result > HITLAG_CAP) { result = HITLAG_CAP; }
  return result;
}

// Port of ftCo_Damage_CalcAngle (decomp: ftCo_Damage.c:79).
//
// Angle 361 is the "Sakurai angle". Airborne it is a fixed 45 degrees.
// Grounded it is a LINEAR RAMP:
//   kb <  x14C            -> 0
//   otherwise             -> x148 * (kb - x14C)/(x150 - x14C) + 1 degrees,
//                            clamped to x148
//
// meleelight used a binary 0 / 44 degree step at kb 32.1. The real transition
// interpolates across the narrow band 32.0 -> 32.1.
export function calcLaunchAngle(kbAngleDeg, kbApplied, airborne) {
  if (kbAngleDeg !== 361) {
    return mtxDegToRad(kbAngleDeg);
  }
  if (airborne) { return SAKURAI_AIR_RADIANS; }
  if (kbApplied < SAKURAI_LO) { return 0; }

  const t = div(sub(kbApplied, SAKURAI_LO), sub(SAKURAI_HI, SAKURAI_LO));
  let r = mtxDegToRad(add(mul(SAKURAI_MAX_DEG, t), 1));
  const capR = mtxDegToRad(SAKURAI_MAX_DEG);
  if (r > capR) { r = capR; }
  return r;
}

// Port of ftCo_8008DCE0's velocity derivation (decomp: ftCo_Damage.c:324-348).
//
//   speed = kb_applied * x100;
//   x = speed * cosf(angle);  y = speed * sinf(angle);
//   if (airborne && CheckAirMotion) magnitude *= x190;   // 0.95
//
// The 0.95 here is AIRBORNE_KB_RESCALE. meleelight applied 0.95 to the
// KNOCKBACK as a "vCancel" modifier -- the right number in the wrong place and
// on the wrong quantity.
export function knockbackToVelocity(kbApplied, angleRad, o = {}) {
  const { airborne = false, airMotion = false } = o;
  let speed = mul(kbApplied, LAUNCH_SPEED_MUL);
  if (airborne && airMotion) { speed = mul(speed, AIRBORNE_KB_RESCALE); }
  return { x: mul(speed, cosf(angleRad)),
           y: mul(speed, sinf(angleRad)) };
}

// Port of ftCo_8008E5A4 (decomp: ftCo_Damage.c:591).
//
// Rotates the knockback vector by up to MAX_DI_DEGREES, proportional to the
// squared perpendicular component of the stick against the knockback vector.
//
// TIMING, and this is the important part: Melee calls this EXACTLY ONCE, from
// ftCo_Damage_OnExitHitlag (ftCo_Damage.c:654) -- on the frame hitlag ends.
// meleelight applied DI every frame from physics.js, which lets a player keep
// steering their trajectory for the whole launch. Call this once, on hitlag
// exit, and never again for that hit.
//
// There is NO stick deadzone in the original; the clamp is implicit because
// the projection factor cannot exceed |stick|^2 <= 1.
export function applyDI(kbVel, stickX, stickY) {
  if (!stickX && !stickY) { return kbVel; }

  const kbX = kbVel.x, kbY = kbVel.y;
  const negX = neg(kbX);
  const kbMagSq = add(mul(negX, negX), mul(kbY, kbY));
  if (kbMagSq < 0.00001) { return kbVel; }

  const f3 = add(mul(kbY, stickX), mul(negX, stickY));
  let f30 = div(mul(f3, f3), kbMagSq);

  // PSVECCrossProduct(kb_vel, lstick).z < 0 -> negate
  const crossZ = sub(mul(kbX, stickY), mul(kbY, stickX));
  if (crossZ < 0) { f30 = neg(f30); }

  // atan2f, disassembled from the retail DOL at 0x80022C30 -- see trig.js.
  // Bit-exact, including its non-IEEE result for (0, 0).
  const angle = atan2f(kbY, kbX);
  // sqrtf per src/MSL/math_ppc.h:11 -- frsqrte estimate + 3 Newton-Raphson
  // steps in double, one rounding at the end. Its argument is built with the
  // f32 layer because the squares and the sum are single-precision on hardware;
  // only sqrtf's own internals run in double.
  const mag = sqrtf(add(mul(kbX, kbX), mul(kbY, kbY)));
  // ftCo_Damage.c:616 -- `scale = MTXDegToRad(x1A8); angle += scale * f30;`
  // in float32, not a float64 accumulation.
  const scaled = add(angle, mul(mtxDegToRad(MAX_DI_DEGREES), f30));
  return { x: mul(mag, cosf(scaled)), y: mul(mag, sinf(scaled)) };
}

// Port of the airborne knockback decay in Fighter_procUpdate
// (decomp: src/melee/ft/fighter.c:2196-2208).
//
//   angle = atan2f(kb_y, kb_x);
//   if (sqrtf(kb_x^2 + kb_y^2) < x204) { kb_x = kb_y = 0; }
//   else { kb_x -= x204*cosf(angle); kb_y -= x204*sinf(angle); }
//
// The angle is RECOMPUTED FROM THE CURRENT VECTOR EVERY FRAME, and both axes
// snap to zero together once the magnitude drops below the decay step.
// meleelight froze a per-axis decay at launch time instead, which drifts as
// soon as the vector's direction changes (e.g. after DI or a second hit).
export function decayKnockback(kbVel) {
  const { x, y } = kbVel;
  if (!x && !y) { return { x: 0, y: 0 }; }
  // sqrtf(kb_vel_x * kb_vel_x + kb_vel_y * kb_vel_y) -- both multiplies and the
  // add are float operands, so MWCC emits fmuls/fadds and the argument is
  // single precision before sqrtf ever sees it.
  const mag = sqrtf(add(mul(x, x), mul(y, y)));
  if (mag < KB_FRAME_DECAY) { return { x: 0, y: 0 }; }
  const angle = atan2f(y, x);
  return { x: sub(x, mul(KB_FRAME_DECAY, cosf(angle))),
           y: sub(y, mul(KB_FRAME_DECAY, sinf(angle))) };
}

// --------------------------------------------------------------------------
// Grounded knockback.
//
// While airborne, knockback is a 2D vector that decays along its own direction
// (decayKnockback above). On the ground it is NOT. Melee collapses it to a
// single SCALAR, fp->xF0_ground_kb_vel, decays that scalar by friction, and
// re-derives the 2D vector each frame by projecting the scalar onto the floor
// tangent. This is the same representation as ordinary ground movement's
// gr_vel (see physics/groundMovement.js), and it is why knockback along a
// slope follows the slope instead of driving into or off it.
//
// decomp: fighter.c:2209-2231, ftcommon.c:176 (decay), ftcommon.c:191 (seed).

// ftCommon_8007CCE8 (ftcommon.c:191). Called when knockback is handed to the
// ground. Seeds the scalar from the X COMPONENT ALONE -- the Y component is
// discarded, not folded in -- clamps it to +/-x164, and immediately rewrites
// the vector from the clamped scalar.
//
// The `xF0 == 0` guard means this runs once per grounded knockback episode:
// after seeding, the scalar is non-zero and later calls do nothing until
// friction has driven it back to exactly zero.
export function seedGroundKnockback (grKBVel, kbVel, normal) {
  if (grKBVel !== 0) { return { grKBVel, kbVel }; }
  let seed = kbVel.x;
  if (seed > GROUND_KB_SEED_CAP) { seed = GROUND_KB_SEED_CAP; }
  if (seed < -GROUND_KB_SEED_CAP) { seed = -GROUND_KB_SEED_CAP; }
  return {
    grKBVel: seed,
    kbVel: { x: mul(normal.y, seed), y: mul(neg(normal.x), seed) },
  };
}

// ftCommon_8007CCA0 (ftcommon.c:176) and its shield twin ftCommon_8007CE4C
// (ftcommon.c:238) are the same function: move the scalar toward zero by
// `amount` and clamp so it cannot cross. Note the clamp is on the SIGN change,
// not on magnitude, so a large friction step lands exactly on 0.
export function decayGroundScalar (v, amount) {
  if (v < 0) {
    const next = add(v, amount);
    return next > 0 ? 0 : next;
  }
  const next = sub(v, amount);
  return next < 0 ? 0 : next;
}

// One frame of grounded knockback: seed if needed, apply friction to the
// scalar, then re-project. fighter.c:2213-2229.
//
//   effective friction = ft_GetGroundFrictionMultiplier(fp)
//                      * co_attrs.ground_friction
//                      * x200
//
// x200 is 1.0 in retail, and the per-fighter multiplier is 1.0 outside special
// states, but both are kept explicit so a state that changes them stays honest.
export function applyGroundKnockback (grKBVel, kbVel, normal, groundFriction,
                                      frictionMultiplier = 1.0) {
  const seeded = seedGroundKnockback(grKBVel, kbVel, normal);
  const friction = mul(mul(frictionMultiplier, groundFriction),
                       KNOCKBACK_GROUND_FRICTION_MULTIPLIER);
  const scalar = decayGroundScalar(seeded.grKBVel, friction);
  return {
    grKBVel: scalar,
    kbVel: { x: mul(normal.y, scalar), y: mul(neg(normal.x), scalar) },
  };
}

// The attacker's shield knockback, grounded. Identical shape, but the friction
// multiplier is x3EC (1.1) rather than x200 (1.0) -- fighter.c:2274.
export function applyGroundShieldKnockback (grShieldKBVel, shieldKB, normal,
                                            groundFriction,
                                            frictionMultiplier = 1.0) {
  let scalar = grShieldKBVel;
  if (scalar === 0) { scalar = shieldKB.x; }
  const friction = mul(mul(frictionMultiplier, groundFriction),
                       SHIELD_GROUND_FRICTION_MULTIPLIER);
  scalar = decayGroundScalar(scalar, friction);
  return {
    grShieldKBVel: scalar,
    shieldKB: { x: mul(normal.y, scalar), y: mul(neg(normal.x), scalar) },
  };
}

// Launch ("reaction") level from applied knockback -- ftCo_Damage.c:298-316.
// The thresholds are compared against knockback * x154, which is the same
// product that produces hitstun frames, so the bands are hitstun bands.
export function launchLevel (knockback) {
  const scaled = mul(knockback, HITSTUN_MUL);
  if (scaled < LAUNCH_LEVEL_1) { return 0; }
  if (scaled < LAUNCH_LEVEL_2) { return 1; }
  if (scaled < LAUNCH_LEVEL_3) { return 2; }
  return 3;
}

// What a launch does to a GROUNDED victim -- ftCo_Damage.c:354-391.
//
// meleelight approximated this as "knockback < 80 and the angle is 0 or 180
// means flatten Y". The real rule is geometric and depends on the floor:
//
//   floorAngle = angle between the floor normal and the launch vector
//   floorAngle <  90 deg                  -> launched normally (away from floor)
//   floorAngle >= 90 deg, level != 3      -> SLIDE: collapse to the scalar
//                                            grKBVel = vel.x and project onto
//                                            the floor tangent
//   floorAngle >= 90 deg, level == 3      -> launched anyway (tumble), and if
//                                            also beyond 90+x1E8 deg, the Y is
//                                            reflected and scaled by x1EC
//
// The first branch is exact: acosf is monotonically decreasing and acosf(0) is
// M_PI_2_F, so `floorAngle < PI/2` is precisely `dot > 0` and needs no inverse
// trig at all. Only the level-3 bounce test needs the angle itself.
export function applyGroundedLaunch (vel, normal, knockback) {
  const dot = add(mul(normal.x, vel.x), mul(normal.y, vel.y));
  if (dot > 0) {
    // Away from the floor: ordinary launch, scalar cleared.
    return { vel, grKBVel: 0, airborne: true };
  }

  if (launchLevel(knockback) !== 3) {
    // Slide along the ground. Note the scalar is seeded from X ONLY, exactly
    // as in block_27 -- the vertical component of the launch is discarded
    // rather than folded into the tangent.
    const scalar = vel.x;
    return {
      vel: { x: mul(normal.y, scalar), y: mul(neg(normal.x), scalar) },
      grKBVel: scalar,
      airborne: false,
    };
  }

  // Level 3 launches even into the floor. Past 90 + x1E8 degrees it bounces.
  //
  // NOT BIT-EXACT: lbVector_Angle (lbvector.c:86) is acosf of the clamped
  // cosine, and acosf is declared at src/MSL/math.h:73 with no definition in
  // the decompiled MSL sources -- the same gap as atan2f. The comparison
  // itself is done in double, as in the original, because M_PI_2 there is the
  // double constant and the float angle is promoted to meet it.
  const lenN = sqrtf(add(mul(normal.x, normal.x), mul(normal.y, normal.y)));
  const lenV = sqrtf(add(mul(vel.x, vel.x), mul(vel.y, vel.y)));
  const denom = mul(lenN, lenV);
  let floorAngle = 0;
  if (denom > 1e-10) {
    let cosine = div(dot, denom);
    if (cosine > 1) { cosine = 1; }
    if (cosine < -1) { cosine = -1; }
    // acosf from the DOL at 0x80022D1C: pi/2 - atanf(x / sqrt(1 - x*x)) with
    // the reciprocal square root by frsqrte + 3 Newton-Raphson. NOT the same
    // number as rounding Math.acos.
    floorAngle = acosf(cosine);
  }

  if (floorAngle > Math.PI / 2 + GROUND_LAUNCH_BOUNCE_RADIANS) {
    return {
      vel: { x: vel.x, y: mul(neg(vel.y), GROUND_LAUNCH_BOUNCE_YMUL) },
      grKBVel: 0,
      airborne: true,
    };
  }
  return { vel, grKBVel: 0, airborne: true };
}

// The attacker's shield knockback, airborne (fighter.c:2233-2258).
//
// REPRODUCES A MELEE BUG ON PURPOSE. When the magnitude falls below x3E8 the
// code should zero the shield knockback's own Y. It instead writes
//
//     pAtkShieldKB->x = p_kb_vel->y = 0;
//
// zeroing the shield knockback's X and the ORDINARY KNOCKBACK's Y, and leaving
// the shield knockback's Y untouched. The decomp flags this as the cause of the
// invisible ceiling glitch. Fixing it here would be a divergence, so this
// returns both vectors and the caller must write both back.
//
// The grounded scalar xF4 is cleared on EVERY airborne frame, outside the
// if/else (fighter.c:2258), so it is returned here rather than left to the
// caller to remember.
export function decayShieldKnockbackAir (shieldKB, kbVel) {
  const { x, y } = shieldKB;
  if (!x && !y) { return { shieldKB, kbVel, grShieldKBVel: 0 }; }
  const mag = sqrtf(add(mul(x, x), mul(y, y)));
  if (mag < SHIELD_KB_FRAME_DECAY) {
    return {
      shieldKB: { x: 0, y },                 // y deliberately NOT cleared
      kbVel: { x: kbVel.x, y: 0 },           // the wrong vector, as shipped
      grShieldKBVel: 0,
    };
  }
  const angle = atan2f(y, x);
  return {
    shieldKB: { x: sub(x, mul(SHIELD_KB_FRAME_DECAY, cosf(angle))),
                y: sub(y, mul(SHIELD_KB_FRAME_DECAY, sinf(angle))) },
    kbVel,
    grShieldKBVel: 0,
  };
}

// Port of ftCo_Damage_CalcVel (decomp: ftCo_Damage.c:216).
//
// How a second hit within KB_STACK_WINDOW frames combines with existing
// knockback: opposite-signed components ADD, same-signed components take
// whichever has the larger magnitude. Outside the window it simply replaces.
export function stackKnockback(cur, x, y, timeSinceHit) {
  if (timeSinceHit < KB_STACK_WINDOW) {
    return { x, y };
  }
  const out = { x: cur.x, y: cur.y };
  if (mul(cur.x, x) < 0) { out.x = add(cur.x, x); }
  else if (Math.abs(x) > Math.abs(cur.x)) { out.x = x; }
  if (mul(cur.y, y) < 0) { out.y = add(cur.y, y); }
  else if (Math.abs(y) > Math.abs(cur.y)) { out.y = y; }
  return out;
}
