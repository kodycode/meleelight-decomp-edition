// @flow

// Hitbox-vs-hurtbox, the way Melee does it: a swept CAPSULE against a list of
// per-bone capsules, in 3D.
//
// What this replaces: one axis-aligned box per fighter, built from a two-number
// `hurtboxOffset` attribute and never changed by the animation -- so a
// crouching Fox presented the same target as a standing one -- and, on the
// non-interpolated path, a box hardcoded to 8 by 18 for every character
// regardless of who they were.
//
// The depth axis is the point of doing this in 3D. Melee's hurtbox capsules
// swing several units through X, more than a hitbox's own radius, and that is
// how limbs slip past attacks. Flattening to (Z, Y) would make this engine
// connect on hits the game misses. Both fighters sit at depth 0, so all of it
// comes from the animation and is fully determined by a 2D game state.
//
// AXES. Two different conventions meet here and they do not agree, so both are
// converted into one place:
//
//   hurtbox data    (x, y, z) = Melee's (X, Y, Z)     = (depth, vertical, horizontal)
//   hitbox Vec3D    (x, y, z) = meleelight's own      = (horizontal, vertical, depth)
//   this module     (x, y, z) = (horizontal, vertical, depth)
//
// FACING flips BOTH horizontal and depth: mirroring a fighter is a 180-degree
// turn about the vertical axis, which negates Melee's X and Z together. Getting
// that wrong would put two fighters' limbs on the same side in depth when they
// face each other, which is exactly when it matters.

import { player, characterSelections } from "main/main";
import { hurtCapsules } from "main/hurtboxData";
import { modelFace } from "physics/modelFacing";
import { framesData } from "main/characters";
import { capsuleOverlap } from "physics/capsule";

/**
 * Player `i`'s hurtbox capsules in world space, or null if this state has no
 * hurtbox data. Callers fall back to the old box on null rather than treating
 * the fighter as untouchable.
 */
export function hurtCapsulesWorld(i/*: number */)/*: any */ {
  const state = player[i].actionState;
  // Same frame convention the ECB uses (physics.js): floor the timer, floor of
  // 1, clamp to the state's length, then index zero-based.
  let frame = Math.floor(player[i].timer);
  if (frame === 0) { frame = 1; }
  const len = framesData[characterSelections[i]][state];
  if (len !== undefined && frame > len) { frame = len; }

  const caps = hurtCapsules(characterSelections[i], state, frame - 1);
  if (caps === null) { return null; }

  const px = player[i].phys.pos.x;
  const py = player[i].phys.pos.y;
  // The MODEL's facing, not the logical one. During a pivot phys.face
  // flips a few frames before or after the animation turns around, and
  // these capsules are posed from that animation -- using phys.face left
  // the hurtbox on the side the fighter came from for the whole window,
  // and hit detection with it. See physics/modelFacing.js.
  const face = modelFace(i, player[i].timer);
  const out = [];
  for (let k = 0; k < caps.length; k++) {
    const c = caps[k];
    out.push({
      a: { x: px + c.a.z * face, y: py + c.a.y, z: c.a.x * face },
      b: { x: px + c.b.z * face, y: py + c.b.y, z: c.b.x * face },
      r: c.r,
    });
  }
  return out;
}

/**
 * True if the swept hitbox capsule `h1 -> h2` of radius `r` touches any of
 * player `i`'s hurtbox capsules.
 *
 * `h1`/`h2` are {x, y, z} in this module's convention. `grow` widens the
 * hitbox, which is how the phantom-hit setting is applied.
 */
export function hitsHurtCapsules(i/*: number */, h1/*: any */, h2/*: any */,
                                 r/*: number */, grow/*: number */)/*: any */ {
  const caps = hurtCapsulesWorld(i);
  if (caps === null) { return null; }
  const radius = r - (grow || 0);
  for (let k = 0; k < caps.length; k++) {
    // Melee passes the HURT capsule first and the hit capsule second
    // (lbColl_80007AFC), and the test is not symmetric in its arithmetic, so
    // the order is kept.
    if (capsuleOverlap(caps[k].a, caps[k].b, h1, h2, caps[k].r, radius)) {
      return true;
    }
  }
  return false;
}

/**
 * The 3D world point of one of player `p`'s hitboxes, from a Vec3D offset.
 * A Vec2D offset (anything not yet baked) is treated as zero depth.
 */
export function hitboxPoint(p/*: number */, offset/*: any */, prev/*: boolean */)/*: any */ {
  const pos = prev ? player[p].phys.posPrev : player[p].phys.pos;
  const face = prev ? player[p].phys.facePrev : player[p].phys.face;
  const depth = offset.z === undefined ? 0 : offset.z;
  return { x: pos.x + offset.x * face, y: pos.y + offset.y, z: depth * face };
}
