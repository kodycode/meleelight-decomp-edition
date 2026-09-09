// @flow

// Melee's ANIMATION-DRIVEN TRANSLATION. See tools/root_motion.py for how the
// data is extracted and tools/gen_root_motion.py for what is extracted.
//
// An animation can carry a slide in its TransN joint. When the subaction's
// x594_b0 flag is set, ftAnim_8006E054 (ftanim.c:174-192) reads that joint,
// takes the delta against last frame, and then ZEROES it -- so the MODEL draws
// in place and the FIGHTER is moved instead. Two mechanisms use the result,
// and which one applies is decided by the state's physics callback, not by the
// flag:
//
//   VEL  gr_vel = transNOffset.z * facing_dir           ft_084E.c:83, 113
//        A per-frame DELTA applied as ground velocity. ftCo_AttackDash_Phys
//        and ftCo_CatchDash_Phys reach it through ft_80085030;
//        ftCo_Escape_Phys through ft_80085004.
//
//   PIN  cur_pos.x = transNPos.z * facing_dir + ledge.x  ftCo_CliffClimb.c:109
//        cur_pos.y = transNPos.y + ledge.y
//        An ABSOLUTE position each frame, measured from the corner of the
//        grabbed ledge rather than integrated. ftCo_CliffClimb_Phys, plus
//        ftCo_CliffEscape_Phys and ftCo_CliffAttack_Phys which delegate to it.
//        Melee hands back to normal physics once transNPos.z and .y are both
//        >= 0 -- that is, once the animation has carried the fighter up onto
//        the stage (ftCo_CliffClimb.c:111).
//
// MOST FLAGGED STATES USE NEITHER. Roughly 40-59 subactions per character
// carry x594_b0, but Dash and AttackS4 are among them and their physics is
// ft_80084F3C -- plain friction, which never looks at transNOffset. For those
// the flag only means the model does not slide. Reading the flag as "this
// state moves the fighter" overestimates the scope by an order of magnitude.

export const rootMotionData/*: any */ = [];

export function setRootMotion(index/*: number */, val/*: any */) {
  rootMotionData[index] = val;
}

/**
 * The per-frame ground velocity for a VEL state, or null.
 *
 * `frame` is 1-based, matching `player.timer` -- the callers all index
 * `table[timer - 1]`, which is Melee's cur_anim_frame.
 */
export function rootVel(charId/*: number */, state/*: string */,
                        frame/*: number */)/*: any */ {
  const d = rootMotionData[charId];
  if (d === undefined) { return null; }
  const t = d.vel[state];
  if (t === undefined) { return null; }
  let f = Math.floor(frame) - 1;
  if (f < 0) { f = 0; }
  if (f >= t.length) { f = t.length - 1; }
  return t[f];
}

/**
 * The per-frame [dz, dy] for a state whose physics reads BOTH axes, or null.
 *
 * ft_80085134 (ft_084E.c:119) is the whole callback:
 *
 *     self_vel.x = x6A4_transNOffset.z * facing_dir;
 *     self_vel.y = x6A4_transNOffset.y;
 *
 * There is no gravity term and no air friction -- for as long as the state
 * lasts, the animation IS the trajectory. That is why Fox and Falco's Illusion
 * travels dead flat: its dy is 0.000 on every frame.
 *
 * Same 1-based frame convention as rootVel.
 */
export function rootVelXY(charId/*: number */, state/*: string */,
                          frame/*: number */)/*: any */ {
  const d = rootMotionData[charId];
  if (d === undefined || d.velxy === undefined) { return null; }
  const t = d.velxy[state];
  if (t === undefined) { return null; }
  let f = Math.floor(frame) - 1;
  if (f < 0) { f = 0; }
  if (f >= t.length) { f = t.length - 1; }
  return t[f];
}

/**
 * The absolute [z, y] ledge offset for a PIN state, or null. Same 1-based
 * frame convention.
 *
 * NOTHING CALLS THIS YET, and that is deliberate rather than unfinished. The
 * data is generated and checked in so the wiring is a small job when it is
 * wanted; here is what a future caller needs to know.
 *
 * WHAT IT IS. Melee's ledge states do not use velocity at all. Every frame,
 * ftCo_CliffClimb_Phys (ftCo_CliffClimb.c:96-122) sets the fighter's position
 * outright from the corner of the grabbed ledge:
 *
 *     cur_pos.x = x68C_transNPos.z * facing_dir + ledge.x
 *     cur_pos.y = x68C_transNPos.y             + ledge.y
 *
 * and hands back to ordinary physics -- ftCommon_8007D7FC, which flips the
 * fighter to grounded -- once BOTH transNPos.z and transNPos.y are >= 0, i.e.
 * once the animation has carried the fighter up over the lip. ftCo_
 * CliffEscape_Phys and ftCo_CliffAttack_Phys both delegate straight to it.
 *
 * So `pin[STATE][frame]` is that [z, y], absolute, ledge-relative, already
 * scaled by the model scale. It is not integrated and not a delta; two
 * consecutive frames are independent positions.
 *
 * WHY IT IS NOT WIRED. meleelight already reproduces this, by hand, and
 * accurately. The ledge states carry an `offset` table for the climb and a
 * `setVelocities` table for the run-off, and Fox's offsets match this data to
 * four decimal places -- e.g. frame 15 is (-3.47907, -11.55) there against
 * (-3.4791, -11.55) here. Replacing thirty working files to change nothing in
 * the fourth decimal is not worth the regression risk, particularly in the
 * ledge path, which is where the getup-pushes-you-back-down bug lived
 * (CLIFFESCAPEQUICK.js `ignoreCollision`).
 *
 * WHEN IT WOULD BE WORTH WIRING. Three cases:
 *   - a character or ledge state that has no hand table, or whose table
 *     disagrees with the disc. test/check-root-motion.mjs already compares the
 *     VEL tables that way and caught Falco using Fox's dash-attack numbers;
 *     extending it to PIN is the natural next step.
 *   - replacing meleelight's hardcoded handoff (CLIFFESCAPEQUICK hands off on
 *     `timer === 22`) with Melee's own `z >= 0 && y >= 0` condition, which is
 *     per-character and per-state rather than one magic number.
 *   - dropping the +68.4 baseline that the hand `offset` tables carry, which
 *     is an artefact of how they were captured and has no counterpart in
 *     Melee.
 */
export function rootPin(charId/*: number */, state/*: string */,
                        frame/*: number */)/*: any */ {
  const d = rootMotionData[charId];
  if (d === undefined) { return null; }
  const t = d.pin[state];
  if (t === undefined) { return null; }
  let f = Math.floor(frame) - 1;
  if (f < 0) { f = 0; }
  if (f >= t.length) { f = t.length - 1; }
  return t[f];
}
