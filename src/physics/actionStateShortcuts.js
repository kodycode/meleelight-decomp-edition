import {characterSelections, player, gameMode, versusMode, playerType} from "main/main";
import FOXMOVES from "characters/fox/moves/index";
import PUFFMOVES from "characters/puff/moves/index";
import MARTHMOVES from "characters/marth/moves/index";
import JUMPAERIALB from "characters/shared/moves/JUMPAERIALB";
import JUMPAERIALF from "characters/shared/moves/JUMPAERIALF";
import {sounds} from "main/sfx";
import {intangibility, actionSounds} from "main/characters";
import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../main/util/Vec2D";
import {gameSettings} from "settings";
import {deepCopyObject} from "../main/util/deepCopy";
import {f32, add, sub, mul, div, neg} from "physics/f32";
import {HORIZONTAL_STICK_DEADZONE, FRICTION_WHEN_ABOVE_WALK_SPEED,
        WALK_ACCEL_TAPER_GAIN, RUN_ACCEL_TAPER_GAIN,
        RUN_DASH_TURN_FRICTION_MULTIPLIER, X54_DASH_GRVEL_DECAY,
        SHIELDSTUN_SLOPE, SHIELDSTUN_OFFSET,
        LIGHTSHIELD_STUN_LO, LIGHTSHIELD_STUN_HI,
        SHIELD_PUSHBACK_PER_FRAME, SHIELD_PUSHBACK_CAP,
        SHIELD_PUSHBACK_NONPOWERSHIELD_MUL,
        ATTACKER_SHIELD_PUSHBACK_SLOPE, ATTACKER_SHIELD_PUSHBACK_BASE,
        SHIELD_TILT_SMOOTHING, SHIELD_START_HEALTH, OVER_MAX_AIR_DECAY,
        TAP_JUMP_THRESHOLD, TAP_JUMP_WINDOW, SQUAT_STICK_THRESHOLD,
        SPECIAL_STICK_X_THRESHOLD, SPECIAL_STICK_Y_THRESHOLD,
        FASTFALL_STICK_THRESHOLD, FASTFALL_WINDOW,
        DASH_SMASH_STICK_THRESHOLD, DASH_SMASH_WINDOW,
        UP_SMASH_STICK_THRESHOLD, UP_SMASH_WINDOW,
        DOWN_SMASH_STICK_THRESHOLD, DOWN_SMASH_WINDOW,
        SHIELD_SIZE_FLOOR, SHIELD_SIZE_HARD, SHIELD_SIZE_LIGHT}
  from "physics/meleeCommon";
import {meleeAtan2, mtxDegToRad} from "physics/trig";
import {SHIELD_POS, SHIELD_MAG_KNOTS} from "main/shieldData";
import {rootVel, rootVelXY} from "physics/rootMotion";
import {applyGroundMovement, setGroundVelocity, syncGrVelFromCVel,
        applyFrictionGround, applyGroundAccel, getGroundVelocity} from "physics/groundMovement";
/* eslint-disable */
export function randomShout (char){
  //playSfx("shout"+Math.round(0.5+Math.random()*5.99));
  switch (char) {
    case 0:
      var shout = Math.round(0.5 + Math.random() * 5.99);
      switch (shout) {
        case 1:
          sounds.shout1.play();
          break;
        case 2:
          sounds.shout2.play();
          break;
        case 3:
          sounds.shout3.play();
          break;
        case 4:
          sounds.shout4.play();
          break;
        case 5:
          sounds.shout5.play();
          break;
        case 6:
          sounds.shout6.play();
          break;
        default:
          break;
      }
      break;
    case 1:
      var shout = Math.round(0.5 + Math.random() * 4.99);
      switch (shout) {
        case 1:
          sounds.puffshout1.play();
          break;
        case 2:
          sounds.puffshout2.play();
          break;
        case 3:
          sounds.puffshout3.play();
          break;
        case 4:
          sounds.puffshout4.play();
          break;
        case 5:
          sounds.puffshout5.play();
          break;
        default:
          break;
      }
      break;
    case 2:
      var shout = Math.round(0.5 + Math.random() * 4.99);
      switch (shout) {
        case 1:
          sounds.foxshout1.play();
          break;
        case 2:
          sounds.foxshout2.play();
          break;
        case 3:
          sounds.foxshout3.play();
          break;
        case 4:
          sounds.foxshout4.play();
          break;
        case 5:
          sounds.foxshout5.play();
          break;
        default:
          break;
      }
      break;
    case 3:
      var shout = Math.round(0.5 + Math.random() * 4.99);
      switch (shout) {
        case 1:
          sounds.falcoshout1.play();
          break;
        case 2:
          sounds.falcoshout2.play();
          break;
        case 3:
          sounds.falcoshout3.play();
          break;
        case 4:
          sounds.falcoshout4.play();
          break;
        case 5:
          sounds.falcoshout5.play();
          break;
        default:
          break;
      }
      break;
    case 4:
      var shout = Math.round(0.5 + Math.random() * 5.99);
      switch (shout) {
        case 1:
          sounds.falconshout1.play();
          break;
        case 2:
          sounds.falconshout2.play();
          break;
        case 3:
          sounds.falconshout3.play();
          break;
        case 4:
          sounds.falconshout4.play();
          break;
        case 5:
          sounds.falconshout5.play();
          break;
        case 6:
          sounds.falconshout6.play();
          break;
        default:
          break;
      }
    default:
      break;
  }
}

export function executeIntangibility (actionStateName,p){
  if (player[p].timer == intangibility[characterSelections[p]][actionStateName][0]) {
    player[p].phys.intangibleTimer = intangibility[characterSelections[p]][actionStateName][1];
    player[p].phys.hurtBoxState = 1;
  }
}

export function playSounds (actionStateName,p){
  for (var i = 0; i < actionSounds[characterSelections[p]][actionStateName].length; i++) {
    if (player[p].timer == actionSounds[characterSelections[p]][actionStateName][i][0]) {
      sounds[actionSounds[characterSelections[p]][actionStateName][i][1]].play();
    }
  }
}

export function isFinalDeath (){
  if (gameMode == 5){
    return true;
  } else if (versusMode) {
    return false;
  } else {
    let finalDeaths = 0;
    let totalPlayers = 0;
    for (let j = 0; j < 4; j++) {
      if (playerType[j] > -1) {
        totalPlayers++;
        if (player[j].stocks == 0) {
          finalDeaths++;
        }
      }
    }
    return (finalDeaths >= Math.max(1,totalPlayers - 1));
  }
}

// REMOVED: getAngle(x, y). Its last caller was ESCAPEAIR, which now uses the
// atan2f port directly the way ftCommon_8007D9D4 (ftcommon.c:615) does. The
// `x != 0 || y != 0` guard it carried was the wrong shape anyway: Melee's
// atan2f returns pi/2 at the origin rather than 0.

/**
 * calcAngleRadians for Puff's Rollout (ftpurinspecials.c:78-95):
 *
 *   s = |lsY|;  if (s > ceiling) s = ceiling;
 *   s -= floor;  if (s < 0) s = 0;
 *   if (lsY < 0) s = -s;
 *   return MTXDegToRad(s * maxDeg / (ceiling - floor));
 *
 * Note what this is not. meleelight had `lsY * 20 degrees`, a straight ramp
 * over the full stick range. The real map ignores the first 0.1 of deflection
 * and saturates at 0.5, so it reaches full tilt at HALF stick and is two and a
 * half times steeper in between. The two agree only at 0 and at full tilt.
 */
export function rolloutAngle (p, lsY) {
  const attr = player[p].charAttributes;
  const y = f32(lsY);
  let s = Math.abs(y);                                 // stickGetDir(y, 0)
  if (s > attr.rolloutStickCeiling) { s = attr.rolloutStickCeiling; }
  s = sub(s, attr.rolloutStickFloor);
  if (s < 0) { s = 0; }
  if (y < 0) { s = neg(s); }
  return mtxDegToRad(div(mul(s, attr.rolloutMaxAngleDeg),
                         sub(attr.rolloutStickCeiling, attr.rolloutStickFloor)));
}
//aC = 180/Math.PI;
export function turnOffHitboxes (p){
  player[p].hitboxes.active = [false,false,false,false];
  player[p].hitboxes.hitList = [];
}

// Port of ftCo_80091BC4 (ftCo_Guard.c:130).
//
// Melee does not smooth a POSITION. It keeps a tilt ANGLE in degrees and a
// MAGNITUDE in 0..1, moves each a fixed fraction of the way to the stick every
// frame, and then poses the shield from them. The angle is smoothed the short
// way round the circle, which a position lerp cannot express -- tilting from
// 350 degrees to 10 crosses zero rather than sweeping back through 180.
//
// What was here smoothed the position by `/5 + 0.01`. The `+ 0.01` is the part
// that gives it away: it is an unconditional drift that never settles, so a
// shield held on a fixed stick position kept creeping. Neither the fifth nor
// the drift is in the game.
//
// The last step -- turning (angle, magnitude) into an offset -- is NOT Melee's.
// Melee indexes a 360-frame animation by the angle and blends it by the
// magnitude (ftAnim_80070710 at ftCo_Guard.c:222), so the shield's real
// position comes out of the posed skeleton. Reproducing that needs the same
// pose pipeline the hurtboxes use. Until then the angle and magnitude are
// exact and only their mapping to a 2D offset is meleelight's.
export function shieldTilt (p,shieldstun,input){
  if (!shieldstun && !player[p].inCSS){
    const x = input[p][0].lsX;
    const y = input[p][0].lsY;

    // Melee reads the stick with the x mirrored by facing, so the tilt angle
    // is in the fighter's own frame.
    let stickRad = meleeAtan2(y, x * player[p].phys.face);
    if (stickRad < 0) { stickRad += 2 * Math.PI; }
    let stickDeg = stickRad * 180 / Math.PI;
    if (stickDeg < 0) { stickDeg = 0; }
    if (stickDeg > 359) { stickDeg = 359; }

    // guard.x8 is stored with a constant 10 added; the working value is
    // without it.
    let guardDeg = player[p].phys.shieldTiltAngle - 10;
    let delta = stickDeg - guardDeg;
    if (delta > 180) { delta -= 360; }
    else if (delta < -180) { delta += 360; }

    let smoothed = delta * SHIELD_TILT_SMOOTHING + guardDeg;
    if (smoothed > 360) {
      guardDeg = smoothed - 360;
    } else {
      guardDeg = smoothed;
      if (guardDeg < 0) { guardDeg += 360; }
    }
    player[p].phys.shieldTiltAngle = 10 + guardDeg;

    let mag = Math.sqrt(x * x + y * y);
    if (mag > 1) { mag = 1; }
    player[p].phys.shieldTiltMag +=
      SHIELD_TILT_SMOOTHING * (mag - player[p].phys.shieldTiltMag);

    // The shield's position is not a polar offset at all. Melee poses it with
    // a dedicated 370-frame `Guard` animation seeked to the tilt angle
    // (ftCo_80091E78, ftCo_Guard.c:222) and takes the world position of one
    // bone with a ZERO offset as the collision centre (ftColl_8007B1B8,
    // ftcoll.c:3183). tools/gen_shield.py bakes that pose per degree; the
    // baked extremes land on exactly 90 / 270 / 0 / 180 degrees for up / down
    // / forward / back, which is what confirms the one-frame-per-degree
    // mapping and the +10 bias.
    //
    // What this replaces was a circle of radius 3 around a hand-measured
    // shieldOffset -- the right general idea, but the real shield does not
    // travel on a circle: Fox's sweeps 7.7 units horizontally and 11.5
    // vertically, because it is a posed bone rather than an offset.
    const cid = characterSelections[p];
    const grid = SHIELD_POS[cid];
    if (grid !== undefined) {
      // shieldTiltAngle carries Melee's +10 bias; strip it to get degrees.
      let deg = Math.round(player[p].phys.shieldTiltAngle - 10) % 360;
      if (deg < 0) { deg += 360; }
      let m = player[p].phys.shieldTiltMag;
      if (m < 0) { m = 0; } else if (m > 1) { m = 1; }

      // Melee's blend is in JOINT space (ftAnim_80070108 -> lb_8000C868), and
      // slerped rotations do not interpolate as positions do -- so the table
      // holds magnitude KNOTS sampled from the real blend rather than just its
      // two endpoints, and reading linearly between adjacent knots follows the
      // true curve. Residual: exact for Fox, Falco, Falcon and Marth, and
      // 0.00099 units for Puff, whose shield chain actually rotates.
      const row = grid[deg];
      const last = SHIELD_MAG_KNOTS - 1;
      const t = m * last;
      let k = Math.floor(t);
      if (k > last - 1) { k = last - 1; }
      const f = t - k;
      const lo = row[k];
      const hi = row[k + 1];
      player[p].phys.shieldPosition = new Vec2D(
        (lo[0] + (hi[0] - lo[0]) * f) * player[p].phys.face,
        lo[1] + (hi[1] - lo[1]) * f);
    }
  }
  // The baked offsets are already measured from TransN, so the fighter's own
  // position is the only thing left to add -- the hand-measured shieldOffset
  // and its /4.5 scale factor are gone.
  player[p].phys.shieldPositionReal = new Vec2D(
    player[p].phys.pos.x + player[p].phys.shieldPosition.x,
    player[p].phys.pos.y + player[p].phys.shieldPosition.y);
}

// Port of ft_80084F3C (decomp: src/melee/ft/ft_084E.c:42).
//
//   f32 friction = co->ground_friction;
//   if (ABS(fp->gr_vel) > co->walk_max_vel)
//       friction *= p_ftCommonData->friction_when_above_walk_speed;
//   ftCommon_ApplyFrictionGround(fp, friction);
//
// `applyDouble` selects between that function and the states that call
// ftCommon_ApplyFrictionGround with plain ground_friction (e.g. ft_80085004,
// ft_084E.c:69). The multiplier is 2.0, read from PlCo.dat -- meleelight's
// original hardcoded `traction * 2` was correct.
/**
 * Melee's animation-driven ground velocity, for the states whose physics
 * callback reads it:
 *
 *     gr_vel = x6A4_transNOffset.z * facing_dir      ft_084E.c:83, 113
 *
 * reached by ftCo_AttackDash_Phys and ftCo_CatchDash_Phys through
 * ft_80085030, and by ftCo_Escape_Phys through ft_80085004. The per-frame
 * values come straight off the disc (tools/gen_root_motion.py) rather than
 * from a hand-recorded table, which matters because the hand tables were
 * copied between characters: Falco's dash attack was using Fox's numbers and
 * travelled 5.6 units short, and Falcon's had no table at all.
 *
 * Returns false when this character/state carries no root motion, so the
 * caller can fall back to whatever it did before.
 */
export function applyRootMotion (p, state) {
  const v = rootVel(characterSelections[p], state, player[p].timer);
  if (v === null || v === undefined) { return false; }
  setGroundVelocity(p, mul(f32(v), player[p].phys.face));
  return true;
}

/**
 * The two-axis form of the above, for states whose physics is ft_80085134
 * (ft_084E.c:119): self_vel.x AND self_vel.y both come from the animation, so
 * gravity and air friction do not apply for the state's duration.
 *
 * Returns false when this character/state carries no data.
 */
export function applyRootMotionAir (p, state) {
  const v = rootVelXY(characterSelections[p], state, player[p].timer);
  if (v === null || v === undefined) { return false; }
  player[p].phys.cVel.x = mul(f32(v[0]), player[p].phys.face);
  player[p].phys.cVel.y = f32(v[1]);
  return true;
}

export function reduceByTraction (p,applyDouble){
  // Re-derive the along-ground scalar from cVel on entry. meleelight still has
  // ~330 unported sites that assign cVel.x directly; syncing here means those
  // keep working unchanged while this function operates in Melee's actual
  // representation. As more ground states are ported, the pipeline stays in
  // grVel space for longer and these syncs can be dropped.
  syncGrVelFromCVel(p);

  const attr = player[p].charAttributes;
  let friction = attr.traction;
  if (applyDouble && Math.abs(player[p].phys.grVel) > attr.maxWalk) {
    friction = mul(friction, FRICTION_WHEN_ABOVE_WALK_SPEED);
  }
  applyFrictionGround(p, friction);
  applyGroundMovement(p);
}

// Port of ftWalkCommon_800E0060 (decomp: src/melee/ft/ftwalkcommon.c:178)
// together with its helper getWalkAccel (ftwalkcommon.c:172).
//
//   accel  = lstick.x * walk_accel_mul * accel_mul;
//   accel += lstick.x > 0 ? accel_mul * +walk_accel_base
//                         : accel_mul * -walk_accel_base;
//   target_vel = lstick.x * walk_max_vel * accel_mul;
//   if (target_vel) {
//     mult = gr_vel / target_vel;
//     if (mult > 0 && mult < 1) accel *= (1 - mult) * walk_accel_taper_gain;
//   }
//   ftCommon_8007C98C(fp, accel, target_vel, ground_friction);
//   ftCommon_ApplyGroundMovement(gobj);
//
// This replaces meleelight's previous proportional-controller approximation
// `(target - v) * (1/(walkMaxV*2)) * (walkInitV + walkAcc)`, in which the gain
// and the `*2` were invented and walk_accel_mul / walk_accel_base were lumped
// into one constant. Melee's accel is open-loop plus a taper, and the taper
// engages ONLY when gr_vel/target is strictly between 0 and 1 -- so it does
// not apply when velocity opposes the target or is already past it.
//
// THREE FIXES over the old implementation:
//  1. Friction here is RAW ground_friction. The old code called
//     reduceByTraction(p, true), which applies friction_when_above_walk_speed
//     (2.0). That multiplier belongs to ft_80084F3C (wait/turn) and is NOT in
//     the walk path -- it was a straight 2x friction error.
//  2. Over-target handling now goes through ftCommon_8007C98C, which
//     substitutes friction, clamps to land exactly on target, and then clamps
//     to ground_max_horizontal_velocity. The old code hard-snapped to target.
//  3. getWalkAccel branches on `lsX > 0`, so lsX == 0 takes the NEGATIVE
//     branch. That asymmetry is in the original; it is reproduced here.
//
// accel_mul is Melee's metal/size/knockback scaling from ftCo_Walk_Enter
// (ftCo_Walk.c:54). It is 1.0 in all normal play; meleelight models none of
// those states, so it is fixed at 1.0 here.
export function walkPhysics (p, input) {
  syncGrVelFromCVel(p);

  const attr = player[p].charAttributes;
  const lsX = f32(input[p][0].lsX);
  const accelMul = 1.0;

  let accel = mul(mul(lsX, attr.walkAccelMul), accelMul);
  accel = add(accel, lsX > 0 ? mul(accelMul, attr.walkAccelBase)
                             : mul(accelMul, neg(attr.walkAccelBase)));

  const targetVel = mul(mul(lsX, attr.walkMaxV), accelMul);

  if (targetVel !== 0) {
    const mult = div(player[p].phys.grVel, targetVel);
    if (mult > 0 && mult < 1) {
      accel = mul(accel, mul(sub(1, mult), WALK_ACCEL_TAPER_GAIN));
    }
  }

  applyGroundAccel(p, accel, targetVel, attr.traction);
  applyGroundMovement(p);
}

// Port of getAccelAndTarget (decomp: src/melee/ft/inlines.h:132).
// Shared by DASH, RUN and RUNTURN.
//
//   *accel  = lstick.x * dash_accel_mul;
//   *accel += lstick.x > 0 ? +dash_accel_base : -dash_accel_base;
//   *target = lstick.x * dash_max_velocity;
//
// Same two-term shape as walk, but with no accel_mul scaling and no taper --
// RUN applies its taper in the caller; DASH applies none at all.
// As in getWalkAccel, `lsX > 0` means lsX == 0 takes the NEGATIVE branch.
function getAccelAndTarget (p, input) {
  const attr = player[p].charAttributes;
  const lsX = f32(input[p][0].lsX);
  let accel = mul(lsX, attr.dAccA);
  accel = add(accel, lsX > 0 ? attr.dAccB : neg(attr.dAccB));
  return { accel, targetVel: mul(lsX, attr.dMaxV), lsX };
}

// Friction used by DASH / RUN / RUNTURN / RUNBRAKE. WALK is the only ground
// state that uses raw ground_friction (ftwalkcommon.c:208). The multiplier is
// 1.0 in retail so this is numerically identical, but it is in the original.
function runDashTurnFriction (p) {
  return mul(player[p].charAttributes.traction,
             RUN_DASH_TURN_FRICTION_MULTIPLIER);
}

// Port of ftCo_Dash_Enter's velocity half (decomp:
// src/melee/ft/kinds/ftCommon/ftCo_Dash.c:49) plus ftCommon_800804A0
// (ftcommon.c:1771).
//
//   init_vel = facing_dir * dash_initial_velocity;
//   if ((gr_vel * facing_dir) < 0) mv.dash.x0 = init_vel;
//   else                           mv.dash.x0 = init_vel - gr_vel;
//   ftCommon_800804A0(fp, mv.dash.x0);   // -> xE8_ground_accel_2
//
// CRITICAL: dash.x0 is a DELTA, not a velocity. Dashing while already at or
// above dash speed contributes nothing (or subtracts). meleelight previously
// did `cVel.x += dInitV * face` then clamped to dMaxV -- wrong formula, wrong
// clamp (the real clamp is ground_max_horizontal_velocity, applied later
// inside ftCommon_8007C98C), and on the wrong frame.
//
// The impulse goes into the SECOND accel channel (xE8), not xE4.
export function dashEnterImpulse (p) {
  syncGrVelFromCVel(p);
  const phys = player[p].phys;
  const initVel = mul(phys.face, player[p].charAttributes.dTInitV);
  phys.dashImpulsePending = mul(phys.grVel, phys.face) < 0
    ? initVel
    : sub(initVel, phys.grVel);
  // NB: the delta is NOT written to groundAccel2 here. syncGrVelFromCVel at the
  // top of dashPhysics clears the accel channels, so writing it now would lose
  // it. dashPhysics writes it on the frame it consumes the pending flag, which
  // is the same frame Melee's ftCo_Dash_Phys runs after ftCo_Dash_Enter.
}

// Port of ftCo_Dash_Phys (decomp: ftCo_Dash.c:145).
//
//   if (mv.dash.x0) { mv.dash.x0 = 0; }
//   else { getAccelAndTarget(...); ftCommon_8007C98C(...); }
//   ftCommon_ApplyGroundMovement(gobj);
//
// On the frame the dash impulse is pending, NO stick acceleration is applied
// at all -- the flag is simply cleared and normal dash accel begins next frame.
export function dashPhysics (p, input) {
  syncGrVelFromCVel(p);
  const phys = player[p].phys;
  if (phys.dashImpulsePending) {
    // ftCommon_800804A0 (ftcommon.c:1771) puts the dash delta in the SECOND
    // accel channel, xE8_ground_accel_2 -- not xE4. ftCo_Dash_Phys clears x0
    // and applies NO stick acceleration on this frame.
    phys.groundAccel2 = phys.dashImpulsePending;
    phys.dashImpulsePending = 0;
  } else {
    const { accel, targetVel } = getAccelAndTarget(p, input);
    applyGroundAccel(p, accel, targetVel, runDashTurnFriction(p));
  }
  applyGroundMovement(p);
}

// Port of the gr_vel decay at the tail of ftCo_Dash_IASA (ftCo_Dash.c:138).
//
//   friction = ft_GetGroundFrictionMultiplier(fp);   // 1.0 normally
//   temp     = gr_vel * x54;
//   gr_vel  += -temp * friction;
//
// A MULTIPLICATIVE decay applied directly to gr_vel, bypassing both accel
// channels. Separate from the ftCommon_8007C98C path and easy to miss.
// meleelight had no counterpart.
export function dashIASADecay (p) {
  syncGrVelFromCVel(p);
  const phys = player[p].phys;
  const temp = mul(phys.grVel, X54_DASH_GRVEL_DECAY);
  setGroundVelocity(p, add(phys.grVel, neg(temp)));
}

// Port of ftCo_Run_Phys (decomp: ftCo_Run.c:130).
// Structurally identical to walk, with dash_* attributes, run_accel_taper_gain,
// no accel_mul, and the run/dash/turn friction multiplier.
export function runPhysics (p, input) {
  syncGrVelFromCVel(p);
  let { accel, targetVel } = getAccelAndTarget(p, input);

  if (targetVel !== 0) {
    const grFrac = div(player[p].phys.grVel, targetVel);
    if (grFrac > 0 && grFrac < 1) {
      accel = mul(accel, mul(sub(1, grFrac), RUN_ACCEL_TAPER_GAIN));
    }
  }

  applyGroundAccel(p, accel, targetVel, runDashTurnFriction(p));
  applyGroundMovement(p);
}

// Port of ftCo_TurnRun_Phys (decomp: ftCo_TurnRun.c:84).
//
// NOT a call to ftCommon_8007C98C. It is an inlined variant with three
// differences that matter:
//   1. It gates on `mv.turnrun.accel_mul * accel < 0` -- the stick must oppose
//      the facing LATCHED AT TURN ENTRY (ftCo_TurnRun.c:48), which does not
//      change when facing_dir flips mid-state.
//   2. It ADDS/SUBTRACTS friction to the accel (`accel -= friction`) rather
//      than REPLACING it (`accel = -friction`) as the shared core does.
//   3. There is NO ground_max_horizontal_velocity clamp.
// Anything else is pure friction.
//
// FIX: meleelight's fallback called reduceByTraction(p, true), applying the
// 2.0 friction_when_above_walk_speed multiplier. Melee uses plain
// ground_friction * run_dash_turn_friction_multiplier here -- a 2x error in
// the no-input case.
export function turnRunPhysics (p, input) {
  syncGrVelFromCVel(p);
  const phys = player[p].phys;
  const friction = runDashTurnFriction(p);
  let { accel, targetVel } = getAccelAndTarget(p, input);

  if (targetVel === 0) {
    applyFrictionGround(p, friction);
  } else if (mul(phys.turnRunAccelMul, accel) < 0) {
    const vel = phys.grVel;
    if (accel > 0) {
      if (add(vel, accel) > targetVel) {
        accel = sub(accel, friction);
        if (add(vel, accel) < targetVel) { accel = sub(targetVel, vel); }
      }
    } else {
      if (add(vel, accel) < targetVel) {
        accel = add(accel, friction);
        if (add(vel, accel) > targetVel) { accel = sub(targetVel, vel); }
      }
    }
    phys.groundAccel1 = accel;
  } else {
    applyFrictionGround(p, friction);
  }
  applyGroundMovement(p);
}

// Port of the shieldstun half of ftCo_80092F2C (decomp: ftCo_Guard.c:661);
// the same expression exists standalone as ftCo_80092ED8 (ftCo_Guard.c:652).
//
//   f = x28C * (dmg * (1 - ((lightshield_amount * (x2E8 - x2E4)) + x2E4))) + x290
//
// `damage` is an int in the original (fp->x19A4 / int_dmg), hence the floor.
// `lightshieldAmount` is 0 for a full hard shield, 1 for a full light shield.
//
// meleelight's previous inline expression was ALGEBRAICALLY EQUIVALENT to this
// -- its `(shieldAnalog - 0.3) / 0.7` is exactly lightshield_amount. It is
// restated in the decomp's own form here so the constants come from PlCo.dat
// and the arithmetic is exact float32 rather than float64 literals.
export function calcShieldstun (damage, lightshieldAmount) {
  const lerp = add(mul(lightshieldAmount,
                       sub(LIGHTSHIELD_STUN_HI, LIGHTSHIELD_STUN_LO)),
                   LIGHTSHIELD_STUN_LO);
  return add(mul(SHIELDSTUN_SLOPE,
                 mul(Math.floor(damage), sub(1, lerp))),
             SHIELDSTUN_OFFSET);
}

// Port of the pushback half of ftCo_80092F2C (decomp: ftCo_Guard.c:688).
//
//   guard_vel = f * x294;
//   if (!powershielding) guard_vel *= x2BC;
//   if (guard_vel > x298) guard_vel = x298;
//
// Pushback is derived FROM the stun frames, not recomputed from damage.
// meleelight previously used an independent expression with different
// coefficients and an extra +0.4 constant term, which does not reduce to this.
export function calcShieldPushback (stunFrames, powershielding) {
  let v = mul(stunFrames, SHIELD_PUSHBACK_PER_FRAME);
  if (!powershielding) {
    v = mul(v, SHIELD_PUSHBACK_NONPOWERSHIELD_MUL);
  }
  if (v > SHIELD_PUSHBACK_CAP) { v = SHIELD_PUSHBACK_CAP; }
  return v;
}

// meleelight stores the shoulder value as `shieldAnalog`; Melee's
// lightshield_amount is the 0..1 lerp position between hard and full light
// shield. This is the mapping implied by meleelight's own original formula.
export function shieldAnalogToLightshield (shieldAnalog) {
  return div(sub(shieldAnalog, f32(0.3)), f32(0.7));
}

// getEnvDmg (decomp: ftcoll.c:205). Truncates damage toward zero, EXCEPT that
// a non-zero damage which truncates to 0 becomes 1:
//
//     if (dmg) { if ((int) dmg) return dmg; return 1; }  return 0;
//
// meleelight used Math.floor, which sends a 0.5-damage hit to 0 and drops its
// shield interaction entirely. Only 0 damage yields 0 here.
export function getEnvDmg (damage) {
  if (!damage) { return 0; }
  const truncated = Math.trunc(damage);
  return truncated === 0 ? 1 : truncated;
}

// The ATTACKER's pushback when their attack hits a shield.
//
//   ftcoll.c:459   x1928 = shielder.lightshield_amount * int_dmg
//   fighter.c:3011 eval  = x1928 * x3E0 + x3E4
//
// Note whose lightshield amount this is: the SHIELDER's, not the attacker's.
//
// meleelight's inline expression was algebraically equivalent given its own
// analog convention -- `(analog - 0.3) * 0.1` is `lightshield * 0.07` once
// lightshield is `(analog - 0.3) / 0.7` -- but it was computed in float64 with
// its own literals. Restated in the decomp's form so the constants come from
// PlCo.dat and the arithmetic is exact float32.
export function calcAttackerShieldPushback (damage, lightshieldAmount) {
  const scaled = mul(lightshieldAmount, getEnvDmg(damage));
  return add(mul(scaled, ATTACKER_SHIELD_PUSHBACK_SLOPE),
             ATTACKER_SHIELD_PUSHBACK_BASE);
}

// Port of ftCommon_ApplyFrictionAir (decomp: src/melee/ft/ftcommon.c).
// Single friction step toward zero that lands exactly on zero rather than
// overshooting it.
export function applyFrictionAir (p, friction) {
  const vel = player[p].phys.cVel.x;
  let accel;
  // NB: the air variant tests >=, the ground variant tests > (ftcommon.c:53).
  // That asymmetry is in the original; do not "normalize" it.
  if (Math.abs(friction) >= Math.abs(vel)) {
    accel = neg(vel);
  } else if (vel > 0) {
    accel = neg(friction);
  } else {
    accel = friction;
  }
  player[p].phys.cVel.x = add(vel, accel);
}

// Port of ftCommon_8007D28C -> ftCommon_8007D174 (decomp: src/melee/ft/ftcommon.c).
//
// Differs from the previous implementation in four ways, all of which the
// decomp does and this now mirrors:
//   1. Acceleration is clamped so velocity lands exactly on targetVel instead
//      of overshooting it by up to one frame of drift accel.
//   2. When already past the target, the game decelerates toward targetVel and
//      stops there -- not toward zero.
//   3. The whole clamping block is skipped when velocity and acceleration have
//      opposite signs (drifting back against your own momentum applies full
//      acceleration, unclamped).
//   4. A separate hard bound, airMaxHorizontalV (air_max_horizontal_velocity,
//      3.0 for the whole cast), bounds the result. This is a distinct attribute
//      from aerialHmaxV (air_drift_max) and was previously absent.
export function airDrift (p,input){
  const attr = player[p].charAttributes;
  const vel = player[p].phys.cVel.x;
  const friction = attr.airFriction;

  // Melee's input layer deadzones the stick before drift ever sees it; meleelight
  // models that here so a stick inside the deadzone yields zero accel and zero target.
  // Melee deadzones the stick in its input layer, before movement code runs.
  // The real threshold is ftCommonData.horizontal_stick_deadzone = 0.28, not
  // the 0.3 previously hardcoded here. Applying it locally is still an
  // approximation of where the game does it -- see meleeCommon.js.
  const rawX = f32(input[p][0].lsX);
  const lsX = Math.abs(rawX) < HORIZONTAL_STICK_DEADZONE ? 0 : rawX;

  // ftCommon_8007D28C (ftcommon.c:379): stick-scaled term plus a signed flat term.
  //   accel_scaling = lsx * air_drift_stick_mul
  //   accel_flat    = lsx > 0 ? +aerial_drift_base : -aerial_drift_base
  let accel = add(mul(lsX, attr.airMobA),
                  lsX > 0 ? attr.airMobB : lsX < 0 ? neg(attr.airMobB) : 0);
  const targetVel = mul(lsX, attr.aerialHmaxV);

  // ftCommon_8007D174 (ftcommon.c:342)
  if (targetVel === 0) {
    applyFrictionAir(p, friction);
    return;
  }

  const airMaxH = attr.airMaxHorizontalV;

  if (!(mul(vel, accel) < 0)) {
    if (accel > 0) {
      if (add(vel, accel) > targetVel) {
        accel = neg(friction);
        if (add(vel, accel) < targetVel) { accel = sub(targetVel, vel); }
        if (add(vel, accel) > airMaxH) { accel = sub(airMaxH, vel); }
      }
    } else if (add(vel, accel) < targetVel) {
      accel = friction;
      if (add(vel, accel) > targetVel) { accel = sub(targetVel, vel); }
      if (add(vel, accel) < neg(airMaxH)) { accel = sub(neg(airMaxH), vel); }
    }
  }

  player[p].phys.cVel.x = add(vel, accel);
}

// Port of ftCo_800CB110 (decomp: src/melee/ft/kinds/ftCommon/ftCo_Jump.c:102).
//
//   fp->self_vel.x *= ground_to_air_jump_momentum_multiplier * jump_mul;
//   fp->self_vel.y *= p_ftCommonData->x438;
//   h_init_v  = lstick.x * jump_h_initial_velocity;
//   h_vel     = jump_mul * h_init_v;
//   v_init_v  = (x0 ? hop_v_initial_velocity : jump_v_initial_velocity) * jump_mul;
//   fp->self_vel.y = v_init_v;
//   h_vel     = fp->self_vel.x + h_vel;
//   h_max_vel = jump_h_max_velocity * jump_mul;
//   if (ABS(h_vel) > h_max_vel) h_vel = h_vel < 0 ? -h_max_vel : h_max_vel;
//   fp->self_vel.x = h_vel;
//
// The `self_vel.y *= x438` step is provably dead -- self_vel.y is assigned
// unconditionally two lines later with no intervening read -- so it is
// deliberately omitted rather than reproduced as a no-op.
//
// BEHAVIOUR FIX: meleelight previously did `cVel.y += initV`. The game ASSIGNS.
// Those agree only when cVel.y is already zero, which stopped being guaranteed
// once grounded velocity became a projection onto the floor tangent.
//
// jumpMul is 1.0 for a normal jump (ftCo_Jump_Enter passes 1.0F); it is exposed
// because other jump entry points scale the whole jump.
export function applyJumpVelocity (p, isFullHop, jumpMul, input) {
  const attr = player[p].charAttributes;
  const phys = player[p].phys;
  const lsX = f32(input[p][0].lsX);

  // self_vel.x *= ground_to_air_jump_momentum_multiplier * jump_mul
  const carried = mul(phys.cVel.x, mul(attr.groundToAir, jumpMul));

  // v_init_v, then ASSIGN (not accumulate)
  phys.cVel.y = mul(isFullHop ? attr.fHopInitV : attr.sHopInitV, jumpMul);

  // h_vel = self_vel.x + (jump_mul * (lstick.x * jump_h_initial_velocity))
  let hVel = add(carried, mul(jumpMul, mul(lsX, attr.jumpHinitV)));

  const hMax = mul(attr.jumpHmaxV, jumpMul);
  if (Math.abs(hVel) > hMax) {
    hVel = hVel < 0 ? neg(hMax) : hMax;
  }
  phys.cVel.x = hVel;

  // ftCo_Jump.c:143 -- x671_timer_lstick_tilt_y = 0xFE. THIS is what stops a
  // held UP from spending the grounded jump and the double jump in one press,
  // and it has to be here rather than a guard in JumpF's interrupt.
  //
  // Melee runs Anim (GObj proc 1) and IASA (proc 3) as separate passes over
  // every fighter, so KneeBend_Anim's ftCo_Jump_Enter (ftCo_KneeBend.c:39)
  // changes state and then JumpF's OWN IASA runs on that same frame, reaching
  // ft_did_jump (ftCo_JumpAerial.c:46) immediately. The check does run; it just
  // fails, because ftCo_800CB110 stamped the timer expired a moment earlier.
  //
  // The difference is observable: ft_did_jump's button term
  // (pressed_buttons & HSD_PAD_XY) ignores the tilt timer, so pressing X on the
  // takeoff frame DOES give an instant double jump in Melee. A blanket
  // timer-based block in JumpF would have eaten that.
  phys.stickTiltTimerY = 254;
}

/**
 * ftCommon_8007CF58 (ftcommon.c:283). Horizontal air decay with TWO regimes:
 *
 *   rate = |self_vel.x| > air_drift_max ? x1FC : aerial_friction
 *
 * then the same land-exactly-on-zero step applyFrictionAir does. Melee writes
 * the result into x74_anim_vel.x, which is folded into self_vel later in the
 * frame; with meleelight's single velocity the direct write is equivalent.
 *
 * Used by states that are coasting rather than drifting -- Firefox's rebound is
 * the one here. What it is NOT is a flat per-frame subtraction along facing:
 * this always decays TOWARD ZERO, whichever way the fighter is pointing.
 */
export function applyAirDecay (p) {
  const attr = player[p].charAttributes;
  const rate = Math.abs(player[p].phys.cVel.x) > attr.aerialHmaxV
    ? OVER_MAX_AIR_DECAY
    : attr.airFriction;
  applyFrictionAir(p, rate);
}

/**
 * ftCommon_Fall (ftcommon.c:462), on its own:
 *
 *   fp->self_vel.y -= gravity;
 *   if (fp->self_vel.y < -terminal_vel) fp->self_vel.y = -terminal_vel;
 *
 * Split out of fastfall() because several states apply gravity WITHOUT the
 * fastfall input check -- ft_80084EEC (ft_084E.c:33), which is Fall plus
 * ApplyFrictionAir and nothing else, is what Puff's airborne Sing and a number
 * of other states run. Calling fastfall() there would let the victim fastfall
 * out of a state Melee does not allow it in.
 */
export function applyGravity (p) {
  const attr = player[p].charAttributes;
  player[p].phys.cVel.y = sub(player[p].phys.cVel.y, attr.gravity);
  if (player[p].phys.cVel.y < neg(attr.terminalV)) {
    player[p].phys.cVel.y = neg(attr.terminalV);
  }
}

export function fastfall (p,input){
  if (!player[p].phys.fastfalled){
    const attr = player[p].charAttributes;
    applyGravity(p);
    // ftCommon_CheckFallFast (ftcommon.c:495): threshold, tilt-timer window,
    // and a downward velocity -- then the timer is PINNED to 254 so one flick
    // gives one fastfall. meleelight had 0.65 with a three-frame lookback and
    // no lock.
    if (input[p][0].lsY <= -FASTFALL_STICK_THRESHOLD
        && player[p].phys.stickTiltTimerY < FASTFALL_WINDOW
        && player[p].phys.cVel.y < 0) {
      sounds.fastfall.play();
      player[p].phys.fastfalled = true;
      player[p].phys.stickTiltTimerY = 254;
      // ftCommon_FallFast (ftcommon.c:475):
      //   fp->self_vel.y = -fp->co_attrs.fast_fall_velocity;
      // Plain negation flips the sign bit only -- exact, no rounding needed.
      player[p].phys.cVel.y = neg(attr.fastFallV);
    }
  }
}

export function shieldDepletion (p,input){
  //(0.28*input - (1-input/10))
  var input = Math.max(input[p][0].lA, input[p][0].rA);
  player[p].phys.shieldHP -= 0.28 * input - ((1 - input) / 10);
  if (player[p].phys.shieldHP <= 0) {
    player[p].phys.shielding = false;
    player[p].phys.kVel.y = player[p].charAttributes.shieldBreakVel;
    player[p].phys.kDec.y = 0.051;
    player[p].phys.kDec.x = 0;
    player[p].phys.grounded = false;
    player[p].phys.shieldHP = 0;
    drawVfx({
      name: "breakShield",
      pos: player[p].phys.pos,
      face: player[p].phys.face
    });
    sounds.shieldbreak.play();
    actionStates[characterSelections[p]].SHIELDBREAKFALL.init(p,input);
  }
}

export function shieldSize (p,lock,input){
   //shield size * 0.575 * model scaling
  //(shield size * 0.575 * hp/60) + (1-input)*0.60714*shieldsize
  player[p].phys.shieldAnalog = Math.max(input[p][0].lA, input[p][0].rA);
  if (player[p].phys.shieldAnalog === 0){
    player[p].phys.shieldAnalog = 1;
  }
  if (lock && player[p].phys.shieldAnalog == 0) {
    player[p].phys.shieldAnalog = 1;
  }
  // Shield size, from the inline at ftCo_Guard.c:177:
  //
  //   n1   = (health / x260) * (trigger * (x2D8 - x2D4) + x2D4)
  //   size = ((1 - x264) * n1 + x264) * initial_shield_size
  //
  // `lightshield_amount` is (trigger - deadzone) / (1 - deadzone), so it is 1
  // for a FULLY pressed shield and 0 for the lightest one -- the name reads
  // backwards. That is why light shielding grows the shield: x2D8 (0.5) is the
  // hard-shield factor and x2D4 (1.0) the light one.
  //
  // The old expression had the right value in exactly one case and diverged
  // everywhere else: it scaled linearly with HP with no floor, ADDED size for a
  // light shield rather than scaling, and then added a third term that GREW the
  // shield as it broke -- `(60 - hp) / 60 * 2`, worth +2 at zero health.
  //
  // Its 0.575 was not arbitrary, though, and is preserved exactly: at full
  // health on a hard shield this formula gives 0.15 + 0.85 * 0.5 = 0.575. So
  // the drawn size at a fresh hard shield is unchanged and only the HP and
  // trigger responses move.
  //
  // modelScale stays because Melee sets this on the shield JOINT, whose world
  // scale inherits the root's model scale through the skeleton.
  const shieldTrigger = player[p].phys.shieldAnalog;
  const n1 = mul(div(f32(player[p].phys.shieldHP), SHIELD_START_HEALTH),
                 add(mul(shieldTrigger, sub(SHIELD_SIZE_LIGHT, SHIELD_SIZE_HARD)),
                     SHIELD_SIZE_HARD));
  player[p].phys.shieldSize =
    mul(add(mul(sub(f32(1), SHIELD_SIZE_FLOOR), n1), SHIELD_SIZE_FLOOR),
        mul(f32(player[p].charAttributes.shieldScale),
            f32(player[p].charAttributes.modelScale)));
}

export function mashOut (p,input){
  if (input[p][0].a && !input[p][1].a){
    return true;
  } else if (input[p][0].b && !input[p][1].b) {
    return true;
  } else if (input[p][0].x && !input[p][1].x) {
    return true;
  } else if (input[p][0].y && !input[p][1].y) {
    return true;
  } else if (input[p][0].lsX > 0.8 && !input[p][1].lsX < 0.7) {
    return true;
  } else if (input[p][0].lsX < -0.8 && !input[p][1].lsX < -0.7) {
    return true;
  } else if (input[p][0].lsY > 0.8 && !input[p][1].lsY < 0.7) {
    return true;
  } else if (input[p][0].lsY < -0.8 && !input[p][1].lsY > -0.7) {
    return true;
  } else if (input[p][0].csX > 0.8 && !input[p][1].csX < 0.7) {
    return true;
  } else if (input[p][0].csX < -0.8 && !input[p][1].csX < -0.7) {
    return true;
  } else if (input[p][0].csY > 0.8 && !input[p][1].csY < 0.7) {
    return true;
  } else if (input[p][0].csY < -0.8 && !input[p][1].csY > -0.7) {
    return true;
  } else {
    return false;
  }
}

// Global Interrupts
// Smash input off the CONTROL stick. Each branch is `threshold now && the tilt
// timer for that axis is inside its window`:
//
//   ftCo_AttackS4.c:53   |lsX| >= x3C (0.8)      && tiltX < x40 (2)
//   ftCo_AttackHi4.c:24   lsY  >= xCC (0.6625)   && tiltY < xD0 (4)
//   ftCo_AttackLw4.c:25   lsY  <= xD4 (-0.6625)  && tiltY < xD8 (4)
//
// meleelight used 0.79 / 0.66 with "the reading two frames ago was below 0.3"
// standing in for the window. Two frames is the RIGHT window horizontally and
// the wrong one vertically, where Melee allows four.
export function checkForSmashes (p,input){
  const tiltX = player[p].phys.stickTiltTimerX;
  const tiltY = player[p].phys.stickTiltTimerY;
  if (input[p][0].a && !input[p][1].a){
    if (Math.abs(input[p][0].lsX) >= DASH_SMASH_STICK_THRESHOLD && tiltX < DASH_SMASH_WINDOW){
      player[p].phys.face = Math.sign(input[p][0].lsX);
      return [true, "FORWARDSMASH"];
    } else if (input[p][0].lsY >= UP_SMASH_STICK_THRESHOLD && tiltY < UP_SMASH_WINDOW) {
      return [true, "UPSMASH"];
    } else if (input[p][0].lsY <= DOWN_SMASH_STICK_THRESHOLD && tiltY < DOWN_SMASH_WINDOW) {
      return [true, "DOWNSMASH"];
    } else {
      return [false, false];
    }
    // The C-STICK branches below keep their own crossing test: the c-stick has
    // no tilt timer of its own (x670/x671 track the control stick only), and
    // ftCo_800DF1C8 tests it directly rather than through a window.
  } else if (Math.abs(input[p][0].csX) >= DASH_SMASH_STICK_THRESHOLD && Math.abs(input[p][1].csX) < DASH_SMASH_STICK_THRESHOLD) {
    player[p].phys.face = Math.sign(input[p][0].csX);
    return [true, "FORWARDSMASH"];
  } else if (input[p][0].csY >= 0.66 && input[p][1].csY < 0.66) {
    return [true, "UPSMASH"];
  } else if (input[p][0].csY <= -0.66 && input[p][1].csY > -0.66) {
    return [true, "DOWNSMASH"];
  } else {
    return [false, false];
  }
}

export function checkForTilts (p,input,reverse){
  var reverse = reverse || 1;
  if (input[p][0].a && !input[p][1].a) {
    if (input[p][0].lsX * player[p].phys.face * reverse > 0.3 && Math.abs(input[p][0].lsX) - (Math.abs(input[p][0].lsY)) > -0.05) {
      return [true, "FORWARDTILT"];
    } else if (input[p][0].lsY < -0.3) {
      return [true, "DOWNTILT"];
    } else if (input[p][0].lsY > 0.3) {
      return [true, "UPTILT"];
    } else {
      return [true, "JAB1"];
    }
  } else {
    return [false, false];
  }
}

export function checkForIASA(p,input,isAerial) {
  if (player[p].timer > player[p].IASATimer) {
    if (isAerial) {
      const a = checkForAerials(p,input);
      if ((checkForDoubleJump(p, input) && (!player[p].phys.doubleJumped)) || (checkForMultiJump(p, input) && player[p].charAttributes.multiJump && player[p].phys.jumpsUsed < player[p].charAttributes.maxJumps - 1)){
        if (input[p][0].lsX*player[p].phys.face < -0.3){
          JUMPAERIALB.init(p,input);
        } else {
          JUMPAERIALF.init(p,input);
        }
          return true;
        } else if (a[0]) {
          if (characterSelections[p] == 0) {
            MARTHMOVES[a[1]].init(p,input);
          } else if (characterSelections[p] == 1) {
            PUFFMOVES[a[1]].init(p,input);
          } else if (characterSelections[p] == 2) {
            FOXMOVES[a[1]].init(p,input);
          }
          return true;
        } else {
          return false;
        }
    } else { //isn't aerial
    
    }
    
  }
}

export function checkForSpecials (p,input){
  if (input[p][0].b && !input[p][1].b) {
    if (player[p].phys.grounded) {
      if (Math.abs(input[p][0].lsX) >= SPECIAL_STICK_X_THRESHOLD || (input[p][0].lsY >= SPECIAL_STICK_Y_THRESHOLD && Math.abs(
          input[p][0].lsX) > input[p][0].lsY - 0.2)) {
        player[p].phys.face = Math.sign(input[p][0].lsX);
        return [true, "SIDESPECIALGROUND"];
      } else if (input[p][0].lsY >= SPECIAL_STICK_Y_THRESHOLD) {
        return [true, "UPSPECIAL"];
      } else if (input[p][0].lsY < -SPECIAL_STICK_Y_THRESHOLD) {
        return [true, "DOWNSPECIALGROUND"];
      } else {
        return [true, "NEUTRALSPECIALGROUND"];
      }
    } else {
      if (input[p][0].lsY >= SPECIAL_STICK_Y_THRESHOLD || (Math.abs(input[p][0].lsX) >= SPECIAL_STICK_X_THRESHOLD && input[p]
              [0].lsY > Math.abs(input[p][0].lsX) - 0.2)) {
        return [true, "UPSPECIAL"];
      } else if (input[p][0].lsY < -SPECIAL_STICK_Y_THRESHOLD || (Math.abs(input[p][0].lsX) >= SPECIAL_STICK_X_THRESHOLD && -
          input[p][0].lsY > Math.abs(input[p][0].lsX) - 0.2)) {
        return [true, "DOWNSPECIALAIR"];
      } else if (Math.abs(input[p][0].lsX) >= SPECIAL_STICK_X_THRESHOLD) {
        player[p].phys.face = Math.sign(input[p][0].lsX);
        return [true, "SIDESPECIALAIR"];
      } else {
        if (input[p][0].lsX * player[p].phys.face < -0.25) {
          player[p].phys.face *= -1;
        } else if (player[p].phys.bTurnaroundTimer > 0) {
          player[p].phys.face = player[p].phys.bTurnaroundDirection;
        }
        return [true, "NEUTRALSPECIALAIR"];
      }
    }
  } else {
    return [false, false];
  }
}

export function checkForAerials (p,input){
  //console.log(p);
  //console.log(input);
  //console.log(input[p]);
  if (input[p][0].csX * player[p].phys.face >= 0.3 && input[p][1].csX * player[p].phys
    .face < 0.3 && Math.abs(input[p][0].csX) > Math.abs(input[p][0].csY) - 0.1) {
    return [true, "ATTACKAIRF"];
  } else if (input[p][0].csX * player[p].phys.face <= -0.3 && input[p][1].csX *
    player[p].phys.face > -0.3 && Math.abs(input[p][0].csX) > Math.abs(input[p][0].csY) - 0.1) {
    return [true, "ATTACKAIRB"];
  } else if (input[p][0].csY >= 0.3 && input[p][1].csY < 0.3) {
    return [true, "ATTACKAIRU"];
  } else if (input[p][0].csY < -0.3 && input[p][1].csY > -0.3) {
    return [true, "ATTACKAIRD"];
  } else if ((input[p][0].a && !input[p][1].a) || (input[p][0].z && !input[p][1].z)) {
    if (input[p][0].lsX * player[p].phys.face > 0.3 && Math.abs(input[p][0].lsX) >
      Math.abs(input[p][0].lsY) - 0.1) {
      return [true, "ATTACKAIRF"];
    } else if (input[p][0].lsX * player[p].phys.face < -0.3 && Math.abs(input[p][0].lsX) > Math.abs(input[p][0].lsY) - 0.1) {
      return [true, "ATTACKAIRB"];
    } else if (input[p][0].lsY > 0.3) {
      return [true, "ATTACKAIRU"];
    } else if (input[p][0].lsY < -0.3) {
      return [true, "ATTACKAIRD"];
    } else {
      return [true, "ATTACKAIRN"];
    }
  }
  return [false, 0];
}


// ftCo_Dash_CheckInput (ftCo_Dash.c:28). ONE test decides both, splitting on
// the sign afterwards:
//
//   if (|lsX| >= x3C && tiltTimerX < x40)
//       (lsX * facing_dir) < 0 ? Turn_Enter_Smash : Dash_Enter
//
// so a dash and a smash turn cannot disagree about whether an input happened --
// which they could here, when the two functions used separate frame lookbacks.
export function checkForDash (p,input){
  return Math.abs(input[p][0].lsX) >= DASH_SMASH_STICK_THRESHOLD
      && player[p].phys.stickTiltTimerX < DASH_SMASH_WINDOW
      && input[p][0].lsX * player[p].phys.face >= 0;
}

export function checkForSmashTurn (p,input){
  return Math.abs(input[p][0].lsX) >= DASH_SMASH_STICK_THRESHOLD
      && player[p].phys.stickTiltTimerX < DASH_SMASH_WINDOW
      && input[p][0].lsX * player[p].phys.face < 0;
}

export function tiltTurnDashBuffer (p,input){
  return input[p][1].lsX * player[p].phys.face > -0.3;
}

export function checkForTiltTurn (p,input){
  return input[p][0].lsX * player[p].phys.face < -0.3;
}

/**
 * The tap-jump half of Melee's jump input (ftCo_Jump_GetInput, ftCo_Jump.c:33;
 * ft_did_jump, ftCo_JumpAerial.c:48):
 *
 *   lstick[0].y >= tap_jump_threshold && x671_timer_lstick_tilt_y < tap_jump_window
 *
 * The second term is the same tilt timer SDI reads: the stick must have entered
 * the smash deadzone within the last 4 frames. That is what makes tap jump fire
 * once per flick rather than continuously while held, and it is why a stick
 * rolled up over two or three frames still jumps.
 *
 * `tapJumpOff` is meleelight's own accessibility setting and is kept.
 */
function tapJumpHeld (p, input, threshold) {
  if (gameSettings["tapJumpOffp" + (p + 1)] != false) { return false; }  // == on purpose
  return input[p][0].lsY >= threshold
      && player[p].phys.stickTiltTimerY < TAP_JUMP_WINDOW;
}

export function checkForJump (p,input){
  // Melee tests the stick FIRST and reports JumpInput_LStick even when a button
  // was also pressed this frame (ftCo_Jump.c:33 precedes the HSD_PAD_XY test).
  if (tapJumpHeld(p, input, TAP_JUMP_THRESHOLD)) {
    return [true, 1];
  }
  if ((input[p][0].x && !input[p][1].x) || (input[p][0].y && !input[p][1].y)) {
    return [true, 0];
  }
  return [false, false];
}
export function checkForDoubleJump (p,input){
  // ft_did_jump (ftCo_JumpAerial.c:46) -- the SAME threshold and window as the
  // grounded jump. meleelight used 0.69 with a this-frame crossing here and
  // 0.66 with a three-frames-ago test above; there is only one rule.
  return (    (input[p][0].x && !input[p][1].x)
           || (input[p][0].y && !input[p][1].y)
           || tapJumpHeld(p, input, TAP_JUMP_THRESHOLD)
         );
}
export function checkForMultiJump (p,input){
  return !!(input[p][0].x || input[p][0].y
            || tapJumpHeld(p, input, TAP_JUMP_THRESHOLD));
}
export function checkForSquat (p,input){
  // ftCo_Squat.c:38: `if (fp->input.lstick[0].y < -x90)`. 0.6875, not 0.69.
  // No tilt-timer term here -- crouch is a held state, unlike tap jump.
  return input[p][0].lsY < -SQUAT_STICK_THRESHOLD;
}

export function turboAirborneInterrupt (p,input){
  var a = checkForAerials(p,input);
  var b = checkForSpecials(p,input);
  if (a[0] && a[1] != player[p].actionState) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]][a[1]].init(p,input);
    return true;
  } else if ((input[p][0].l && !input[p][1].l) || (input[p][0].r && !input[p][1].r)) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].ESCAPEAIR.init(p,input);
    return true;
  } else if (((input[p][0].x && !input[p][1].x) || (input[p][0].y && !input[p][1].y) ||
      (input[p][0].lsY > 0.7 && input[p][1].lsY <= 0.7)) && (!player[p].phys.doubleJumped ||
      (player[p].charAttributes.multiJump && player[p].phys.jumpsUsed < player[p].charAttributes.maxJumps - 1))) {
    turnOffHitboxes(p);
    if (input[p][0].lsX * player[p].phys.face < -0.3) {
      actionStates[characterSelections[p]].JUMPAERIALB.init(p,input);
    } else {
      actionStates[characterSelections[p]].JUMPAERIALF.init(p,input);
    }
    return true;
  } else if (b[0] && b[1] != player[p].actionState) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]][b[1]].init(p,input);
    return true;
  } else {
    return false;
  }
}

export function turboGroundedInterrupt (p,input){
  var b = checkForSpecials(p,input);
  var t = checkForTilts(p,input);
  var s = checkForSmashes(p,input);
  var j = checkForJump(p,input);
  if (j[0]) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].KNEEBEND.init(p, j[1],input);
    return true;
  } else if (input[p][0].l || input[p][0].r) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].GUARDON.init(p,input);
    return true;
  } else if (input[p][0].lA > 0 || input[p][0].rA > 0) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].GUARDON.init(p,input);
    return true;
  } else if (b[0] && b[1] != player[p].actionState) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]][b[1]].init(p,input);
    return true;
  } else if (s[0] && s[1] != player[p].actionState) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]][s[1]].init(p,input);
    return true;
  } else if (t[0] && t[1] != player[p].actionState) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]][t[1]].init(p,input);
    return true;
  } else if (checkForSquat(p,input)) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].SQUAT.init(p,input);
    return true;
  } else if (checkForDash(p,input)) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].DASH.init(p,input);
    return true;
  } else if (checkForSmashTurn(p,input)) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].SMASHTURN.init(p,input);
    return true;
  } else if (checkForTiltTurn(p,input)) {
    turnOffHitboxes(p);
    player[p].phys.dashbuffer = tiltTurnDashBuffer(p,input);
    actionStates[characterSelections[p]].TILTTURN.init(p,input);
    return true;
  } else if (Math.abs(input[p][0].lsX) > 0.3) {
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].WALK.init(p, true,input);
    return true;
  } else {
    return false;
  }
}

export const actionStates = [];
export function setupActionStates(index, val){
  actionStates[index]= deepCopyObject(true, val);
}

/* char id:
0 - marth
1 - jiggs
2 - fox
*/
