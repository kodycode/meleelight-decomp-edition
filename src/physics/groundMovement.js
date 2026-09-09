//
// Ground velocity representation, matching Melee's.
//
// WHY THIS EXISTS
// ---------------
// Melee does not store a 2D velocity vector while a fighter is grounded. It
// stores SCALARS measured along the ground surface, and derives the 2D velocity
// by projecting them onto the floor's tangent:
//
//   ftCommon_ApplyGroundMovement (decomp: src/melee/ft/ftcommon.c:133)
//     fp->self_vel.x = +ground_normal->y * fp->gr_vel;
//     fp->self_vel.y = -ground_normal->x * fp->gr_vel;
//
// and the scalar accumulates two separate acceleration channels each frame:
//
//   fighter.c:2292
//     fp->gr_vel += fp->xE4_ground_accel_1 + fp->xE8_ground_accel_2;
//
//   xE4_ground_accel_1 -- self movement (friction, walk, dash accel)
//   xE8_ground_accel_2 -- knockback decay
//
// meleelight historically stored cVel as a 2D vector and mutated cVel.x
// directly. That agrees with Melee exactly on flat ground (normal = (0,1), so
// the projection is the identity) and diverges on every slope.
//
// MODEL USED HERE
// ---------------
// grVel is the source of truth while grounded; cVel is DERIVED from it. Every
// existing consumer of cVel (collision, rendering, hit detection) keeps working
// unchanged, because cVel is still populated every frame.
//
// Ground physics functions write into groundAccel1 / groundAccel2 rather than
// touching cVel, then call applyGroundMovement() to accumulate and project.
//
// DEVIATION, DELIBERATE: Melee splits this across two points in the frame --
// ApplyGroundMovement projects using the pre-update gr_vel, and fighter.c:2292
// accumulates afterwards. We accumulate then project in one step. This is
// behaviourally identical so long as nothing reads self_vel between those two
// points, which is true for every path ported so far. If a future port needs
// the intermediate value, split this into two functions.

import {Vec2D} from "main/util/Vec2D";
import {player} from "main/main";
import {f32, add, sub, mul, neg} from "physics/f32";

// The floor normal to use when none is known (flat ground).
export const DEFAULT_GROUND_NORMAL = new Vec2D(0, 1);

// Record the floor normal the fighter is standing on. Call from land() and
// from any code that moves a fighter onto a different surface.
//
// NORMALISED HERE, DELIBERATELY. In Melee `coll_data.floor.normal` is a UNIT
// normal, and ftCommon_ApplyGroundMovement relies on that: it multiplies the
// along-ground scalar by the normal's components to get the 2D velocity, so
// any other magnitude scales the fighter's speed by exactly that factor.
//
// meleelight's callers do not supply a unit vector. Both call sites
// (physics.js:453 and :545) pass the result of outwardsWallNormal
// (environmentalCollision.js:78), which builds the perpendicular as
// `(y2 - y1, x1 - x2)` with no normalisation -- so its magnitude is the
// SEGMENT'S LENGTH. That was harmless for its original purpose, `movingInto`,
// which only takes the sign of a dot product, but it is not harmless here.
//
// Left unnormalised, standing on Battlefield's left platform (x -57.6 to -20)
// gave a normal of (0, 37.6), and walking multiplied the fighter's velocity by
// 37.6: a walk at gr_vel 0.3 moved 11.28 units in one frame and threw the
// player clean off the stage.
//
// Normalising at this single choke point makes the invariant hold no matter
// which caller supplies the vector. For the axis-aligned surfaces that make up
// every stage here this is exact -- (0, 37.6) normalises to precisely (0, 1).
export function setGroundNormal (p, normal) {
  if (normal === null || normal === undefined
      || (normal.x === 0 && normal.y === 0)) {
    player[p].phys.groundNormal = new Vec2D(0, 1);
    return;
  }
  const mag = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
  player[p].phys.groundNormal = new Vec2D(f32(normal.x / mag), f32(normal.y / mag));
}

// Project a 2D velocity onto the ground tangent to get the scalar grVel.
// The tangent is (normal.y, -normal.x), so this is the dot product with it.
export function projectOntoGround (vel, normal) {
  return add(mul(vel.x, normal.y), mul(vel.y, neg(normal.x)));
}

// On landing, Melee derives gr_vel from the airborne velocity. Call this
// whenever a fighter transitions from airborne to grounded.
export function syncGrVelFromCVel (p) {
  const phys = player[p].phys;
  phys.grVel = projectOntoGround(phys.cVel, phys.groundNormal);
  phys.groundAccel1 = 0;
  phys.groundAccel2 = 0;
}

// Read the current along-ground velocity, derived from cVel so that callers
// still work when an upstream state has not yet been ported off cVel.x.
// Side-effect free -- unlike syncGrVelFromCVel it does not clear the
// acceleration channels, so it is safe to call mid-frame.
export function getGroundVelocity (p) {
  const phys = player[p].phys;
  return projectOntoGround(phys.cVel, phys.groundNormal);
}

// Set the along-ground velocity directly, and refresh the derived cVel.
// Use this from ground states that used to assign cVel.x.
//
// The airborne fallback has no counterpart in Melee, and is here because
// meleelight's state machine is looser than Melee's. In Melee a grounded
// action state writes gr_vel and an airborne one writes self_vel, and leaving
// the ground CHANGES the action state -- so "grounded-state code running while
// airborne" cannot occur. In meleelight several *GROUND states keep running
// across the transition. Projecting onto a stale floor normal there would
// invent a vertical component out of nothing, so fall back to writing the
// horizontal velocity directly, which is what those states did before.
export function setGroundVelocity (p, v) {
  const phys = player[p].phys;
  phys.grVel = v;
  if (phys.grounded === false) {
    phys.cVel.x = v;
    return;
  }
  projectGroundVelocity(p);
}

// Port of _func_8007E2FC_inline (decomp: ftcommon.c:911). Melee clears EVERY
// velocity channel together, not just the two meleelight historically reset.
// Every channel that can carry motion across a state change is listed there:
//
//   xE4/xE8 ground accel, x74 anim_vel, gr_vel, self_vel,
//   xF0 ground_kb_vel, x8c kb_vel,
//   xF4 ground_attacker_shield_kb_vel, x98 atk_shield_kb, xD4 unk_vel
//
// The shield-knockback pair matters here: it is a separate channel with its own
// decay, so a reset that clears cVel and kVel alone would let an attacker's
// shield pushback survive a death and resume on the next stock.
export function clearAllVelocity (p) {
  const phys = player[p].phys;
  phys.cVel.x = 0;
  phys.cVel.y = 0;
  phys.kVel.x = 0;
  phys.kVel.y = 0;
  phys.grVel = 0;
  phys.grKBVel = 0;
  phys.groundAccel1 = 0;
  phys.groundAccel2 = 0;
  phys.shieldKBVel.x = 0;
  phys.shieldKBVel.y = 0;
  phys.grShieldKBVel = 0;
}

// Port of ftCommon_ApplyGroundMovement's projection half (ftcommon.c:133).
// Writes the derived 2D velocity without touching the accumulators.
export function projectGroundVelocity (p) {
  const phys = player[p].phys;
  const n = phys.groundNormal || DEFAULT_GROUND_NORMAL;
  phys.cVel.x = mul(n.y, phys.grVel);
  phys.cVel.y = mul(neg(n.x), phys.grVel);
}

// Port of ftCommon_ApplyFrictionGround (decomp: src/melee/ft/ftcommon.c:51).
//
//   if (ABS(friction) > ABS(fp->gr_vel)) friction = -fp->gr_vel;
//   else if (fp->gr_vel > 0)             friction = -friction;
//   fp->xE4_ground_accel_1 = friction;
//
// NB: the ground variant tests > where the air variant tests >= (ftcommon.c:255).
// Preserve that asymmetry; it is in the original.
export function applyFrictionGround (p, friction) {
  const vel = player[p].phys.grVel;
  let accel;
  if (Math.abs(friction) > Math.abs(vel)) {
    accel = neg(vel);
  } else if (vel > 0) {
    accel = neg(friction);
  } else {
    accel = friction;
  }
  player[p].phys.groundAccel1 = accel;
}

// Port of ftCommon_8007C98C (decomp: src/melee/ft/ftcommon.c:61).
//
// The ground twin of ftCommon_8007D174. Given a desired acceleration and a
// target velocity, decides what actually goes into xE4_ground_accel_1:
//
//   if (!target_vel) { ApplyFrictionGround(fp, friction); return; }
//   if (!(gr_vel * accel < 0)) {
//     if (accel > 0) {
//       if (gr_vel + accel > target_vel) {
//         accel = -friction;
//         if (gr_vel + accel < target_vel) accel = target_vel - gr_vel;
//         if (gr_vel + accel > ground_max_h_vel) accel = ground_max_h_vel - gr_vel;
//       }
//     } else if (gr_vel + accel < target_vel) {
//       accel = friction;
//       if (gr_vel + accel > target_vel) accel = target_vel - gr_vel;
//       if (gr_vel + accel < -ground_max_h_vel) accel = -ground_max_h_vel - gr_vel;
//     }
//   }
//   fp->xE4_ground_accel_1 = accel;
//
// Note the clamping block is skipped entirely when velocity and acceleration
// have opposite signs, and that overshooting the target substitutes FRICTION
// for the acceleration rather than clamping to the target directly.
export function applyGroundAccel (p, accel, targetVel, friction) {
  const phys = player[p].phys;
  const vel = phys.grVel;

  if (targetVel === 0) {
    applyFrictionGround(p, friction);
    return;
  }

  const maxH = player[p].charAttributes.groundMaxHorizontalV;

  if (!(mul(vel, accel) < 0)) {
    if (accel > 0) {
      if (add(vel, accel) > targetVel) {
        accel = neg(friction);
        if (add(vel, accel) < targetVel) { accel = sub(targetVel, vel); }
        if (add(vel, accel) > maxH) { accel = sub(maxH, vel); }
      }
    } else if (add(vel, accel) < targetVel) {
      accel = friction;
      if (add(vel, accel) > targetVel) { accel = sub(targetVel, vel); }
      if (add(vel, accel) < neg(maxH)) { accel = sub(neg(maxH), vel); }
    }
  }
  phys.groundAccel1 = accel;
}

// Accumulate this frame's two acceleration channels into grVel, then project.
// Combines fighter.c:2292 with ftCommon_ApplyGroundMovement (ftcommon.c:133).
export function applyGroundMovement (p) {
  const phys = player[p].phys;
  phys.grVel = add(phys.grVel, add(phys.groundAccel1, phys.groundAccel2));
  phys.groundAccel1 = 0;
  phys.groundAccel2 = 0;
  projectGroundVelocity(p);
}
