// @flow

// Smash-charge damage scaling. Port of ftCo_800DEEB8 (ft_0DF0.c:32) and the
// subaction event that feeds it, ftAction_80073008 (ftaction.c:1252).
//
// Melee:
//     // subaction event 0x38 "smash_charge":
//     dmg_mult = 0.003906f * charge_rate;
//     ftCo_800DEE84(gobj, color_anim, charge_frames, dmg_mult);
//     ...
//     // ftCo_800DEEB8, applied to the damage at hit time:
//     if (state != SmashState_Release) return dmg;
//     return dmg * ((x2120_damageMul - 1.0f) * (x2118_frames / x211C_holdFrame) + 1.0f);
//
// meleelight had `damage *= 1 + (chargeFrames * (0.3671 / 60))`, which reaches
// the same place by a different route: 0.3671 is `dmg_mult - 1` rounded, and 60
// is the hold time. Both numbers turn out to be RIGHT -- every smash_charge
// event on the disc, across all five characters, is charge_frames = 60 and
// charge_rate = 350, and 0.003906 * 350 is 1.3671 exactly. That was worth
// checking rather than assuming, since nothing had ever sourced them.
//
// What was wrong is the arithmetic. Melee builds `dmg_mult - 1` in float32 from
// a float32 0.003906, giving 0.3671000003814697, and evaluates the whole chain
// single-precision; meleelight used the decimal 0.3671 in float64. Four of the
// 61 reachable charge frames land on a different float32 through the two.

import { f32, add, sub, mul, div } from "physics/f32";

// ftaction.c:1261. A float32 literal, roughly 1/256 -- the raw charge_rate in
// the subaction script is an integer scaled by it.
export const SMASH_CHARGE_RATE_SCALE = f32(0.003906);

// From the subaction scripts themselves (event 0x38), not from ftCommonData.
// Uniform across Fox, Falco, Falcon, Marth and Puff -- verified by
// tools/smash_charge.py, which re-extracts them from the disc.
export const SMASH_CHARGE_RATE = 350;
export const SMASH_CHARGE_FRAMES = 60;

/** dmg_mult for a charge_rate, as ftAction_80073008 computes it. */
export function smashChargeDamageMul(chargeRate/*: number */)/*: number */ {
  return mul(SMASH_CHARGE_RATE_SCALE, chargeRate);
}

/**
 * ftCo_800DEEB8: the damage a smash deals after `frames` of charge.
 *
 * The parenthesisation is the original's -- `(mul - 1) * (frames / hold) + 1`,
 * each step rounded to float32 -- not an algebraically equal rearrangement.
 */
export function applySmashCharge(damage/*: number */, frames/*: number */,
                                 chargeRate/*: number */ = SMASH_CHARGE_RATE,
                                 holdFrames/*: number */ = SMASH_CHARGE_FRAMES)
/*: number */ {
  if (!frames) { return damage; }
  const dmgMul = smashChargeDamageMul(chargeRate);
  const ratio = div(f32(frames), f32(holdFrames));
  return mul(damage, add(mul(sub(dmgMul, f32(1.0)), ratio), f32(1.0)));
}
