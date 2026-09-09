// @flow

// UNIVERSAL CONTROLLER FIX, behind a toggle. OFF by default.
//
// UCF is a community MOD, not vanilla Melee, so it is not in the decomp and
// none of this is 1:1 with it. Everything below is ported from the UCF source
// itself -- https://github.com/AltimorTASDK/ucf, the repo the distributed
// Gecko codes are generated from via cpp2gecko. It patches vanilla NTSC 1.02
// (its map files are GALE01r0/r1/r2 and GALP01) and reads the same PlCo.dat
// ftCommonData struct this project already pulls constants from, so it layers
// onto our ported behaviour rather than replacing it.
//
// ONE ALGORITHM, THREE PLACES. tauKhan's "tilt intent" test asks whether the
// stick was FLICKED or TILTED, by comparing its position now against two polls
// ago (include/ucf/pad_buffer.h):
//
//     const auto delta = current_input.stick.x - prev_input.stick.x;
//     return delta * delta > 75 * 75;
//
// UCF never loosens a vanilla threshold to do this -- every vanilla condition
// still has to pass. It only rescues the case where vanilla says "tilt" and
// the stick's own travel says "flick".
//
// UNITS -- MEASURED, NOT ASSUMED. UCF works in raw s8 GameCube units, -80..80,
// and meleelight carries floats, so this looked like it needed a lossy
// conversion. It does not. Sampling the real adapter (MAYFLASH GameCube
// Controller Adapter, 0079:1843) through the Gamepad API gives values on a
// 255-step byte grid -- 0.003922 = 1/255 exactly, with zero residual against a
// byte grid and 0.3137 against an n/80 one. scaleToMeleeAxes
// (meleeInputs.js:239) then does what Melee does: byte -> centred s8 ->
// radial clamp to magnitude 80 with truncation -> divide by 80. So `rawX` and
// `rawY` ARE Melee's coordinates, and multiplying by 80 recovers the exact s8
// integer UCF compares. The comparisons below are therefore done in integer
// space, which is bit-faithful rather than merely close.
//
// `rawX`/`rawY` are used rather than `lsX`/`lsY` because they are pre-deadzone
// (input.js:198), matching Melee's raw queue entry.

// input[p][2] is "two polls ago": UCF's pad buffer is written once per
// PlayerThink_Input, i.e. once per frame, and get_ucf_pad_buffer<-2> reads two
// entries back.

// 75 and 44 raw units, over 80 units of full deflection.
// Raw s8 unit thresholds, used as-is against integer deltas.
export const UCF_XSMASH_DELTA = 75;   // dashback + tumble      (pad_buffer.h)
export const UCF_SDROP_DELTA = 44;    // shield drop            (pad_buffer.cpp)
export const UCF_SDI_DELTA = 62;      // SDI and shield SDI     (sdi.cpp, shield_sdi.cpp)

// Melee's coordinate is the clamped s8 divided by 80, so this inverts it.
function s8(coord/*: number */)/*: number */ { return Math.round(coord * 80); }
// Spot dodge threshold while Axe-method shield dropping (shielddrop.S:
// `y_threshold: .float -.8000`), against vanilla's -0.7.
export const UCF_SPOT_DODGE_Y = -0.8;
// check_sdrop_up: "Must be -6125 or below along the rim" (pad_buffer.cpp).
export const UCF_SDROP_Y = -0.6125;
// Vanilla spot dodge threshold, the value UCF replaces.
// Read off PlCo.dat using the offsets in UCF's own header
// (include/melee/constants.h, include/melee/asm/constants.h):
//   +0x314 spot_dodge_stick_threshold  -0.7
//   +0x31C roll_stick_threshold         0.7
//   +0x320 roll_stick_frames            4   (INT)
export const VANILLA_SPOT_DODGE_Y = -0.699999988079071;   // x314
export const ROLL_STICK_THRESHOLD = 0.699999988079071;    // x31C
export const ROLL_STICK_FRAMES = 4;                       // x320, an INT

let ucfEnabled = false;

export function isUcfEnabled()/*: boolean */ { return ucfEnabled; }

export function setUcf(val/*: boolean */)/*: boolean */ {
  ucfEnabled = !!val;
  try {
    localStorage.setItem("ucfEnabled", ucfEnabled ? "1" : "0");
  } catch (e) { /* private mode */ }
  return ucfEnabled;
}

export function toggleUcf()/*: boolean */ { return setUcf(!ucfEnabled); }

export function loadUcfPreference()/*: boolean */ {
  try {
    const v = localStorage.getItem("ucfEnabled");
    if (v !== null) { ucfEnabled = (v === "1"); }
  } catch (e) { /* private mode */ }
  return ucfEnabled;
}

/**
 * tauKhan's tilt-intent test on the X axis (check_ucf_xsmash, pad_buffer.h).
 * True when the stick travelled more than 75/80 of full deflection across two
 * polls -- a flick, not a tilt.
 */
export function ucfXSmash(p/*: number */, input/*: any */)/*: boolean */ {
  if (input[p][2] === undefined) { return false; }
  const delta = s8(input[p][0].rawX) - s8(input[p][2].rawX);
  return delta * delta > UCF_XSMASH_DELTA * UCF_XSMASH_DELTA;
}

/** The same test on Y, with UCF's smaller 44-unit threshold (check_ucf_sdrop). */
export function ucfYSmash(p/*: number */, input/*: any */)/*: boolean */ {
  if (input[p][2] === undefined) { return false; }
  const delta = s8(input[p][0].rawY) - s8(input[p][2].rawY);
  return delta * delta > UCF_SDROP_DELTA * UCF_SDROP_DELTA;
}

/**
 * is_rim_coord (util/melee/pad.h): the stick is out at the gate, not partway.
 *
 *     converted = (abs_coord_to_int(x) + 1, abs_coord_to_int(y) + 1)
 *     return converted.length_sqr() > 80 * 80
 *
 * with abs_coord_to_int(x) = (int)(|x| * 80 - 0.0001) + 1. The bias makes a
 * coordinate round DOWN so Popo and Nana land on the same integer.
 */
export function isRimCoord(x/*: number */, y/*: number */)/*: boolean */ {
  const cx = Math.trunc(Math.abs(x) * 80 - 0.0001) + 1 + 1;
  const cy = Math.trunc(Math.abs(y) * 80 - 0.0001) + 1 + 1;
  return cx * cx + cy * cy > 80 * 80;
}

/**
 * The spot dodge Y threshold to use this frame.
 *
 * shielddrop.S lowers it from vanilla's -0.7 to -0.8 when the stick is on the
 * rim and a roll is not available, so that rolling the stick down to the
 * diagonal notch falls THROUGH the spot dodge branch and reaches the platform
 * drop one. Spot dodge being tested before shield drop is the whole reason
 * vanilla shield dropping is controller dependent, and GUARD.js has the same
 * ordering, so the same change lands the same way here.
 *
 * The roll gate is UCF's own: `stick_x_hold_time >= plco->roll_stick_frames`.
 * That offset (0x320) came from UCF's PlCo header and reads 4 on the disc, so
 * this is now the real condition rather than the approximation that stood here
 * before. stickTiltTimerX is meleelight's x670_timer_lstick_tilt_x.
 */
export function spotDodgeThresholdY(p/*: number */, input/*: any */,
                                    stickTiltTimerX/*: number */)/*: number */ {
  if (!ucfEnabled) { return VANILLA_SPOT_DODGE_Y; }
  const i = input[p][0];
  // Cstick spot dodge wins outright (shielddrop.S: "Prioritize cstick spot dodge").
  if (i.csY < VANILLA_SPOT_DODGE_Y) { return VANILLA_SPOT_DODGE_Y; }
  // "Roll must be disabled" (shielddrop.S): a roll is still available while
  // the X tilt timer is inside roll_stick_frames.
  if (Math.abs(i.lsX) >= ROLL_STICK_THRESHOLD
      && stickTiltTimerX < ROLL_STICK_FRAMES) { return VANILLA_SPOT_DODGE_Y; }
  if (!isRimCoord(i.rawX, i.rawY)) { return VANILLA_SPOT_DODGE_Y; }
  return UCF_SPOT_DODGE_Y;
}

/**
 * shielddrop_extended.cpp: once the vanilla platform-drop check has failed,
 * allow the drop anyway after two frames of a held down-rim input.
 *
 *     if (get_ucf_pad_data(port).sdrop_up_frames >= 2) -> allow
 *
 * sdrop_up_frames counts frames where stick.y <= -0.6125 AND the coordinate is
 * on the rim; on the FIRST such frame it additionally needs
 * `stick_y_hold_time < 2 && check_ucf_sdrop`, so it cannot fire early on the
 * way down (pad_buffer.cpp: check_sdrop_up).
 */
export function ucfShieldDrop(p/*: number */, input/*: any */)/*: boolean */ {
  if (!ucfEnabled) { return false; }
  for (let f = 0; f < 2; f++) {
    const i = input[p][f];
    if (i === undefined) { return false; }
    if (!(i.lsY <= UCF_SDROP_Y)) { return false; }
    if (!isRimCoord(i.rawX, i.rawY)) { return false; }
  }
  return ucfYSmash(p, input);
}

/**
 * dashback.cpp, injected at Interrupt_AS_Turn+0x4C. On TILT TURN FRAME 2 only,
 * with every vanilla smash-turn condition still required, promote the turn to
 * a smash turn when the stick was genuinely flicked.
 *
 *     if (!FP_EQUAL(player->animation_frame, 2.f))                    return;
 *     if (player->input.stick.x * new_direction < x_smash_threshold)  return;
 *     if (player->input.stick_x_hold_time >= 2)                       return;
 *     if (!check_ucf_xsmash(player))                                  return;
 *     Turn.is_smash_turn = true; Turn.can_dash = true;
 *
 * `new_direction` is the direction being turned TO. meleelight flips face at
 * standingTurnFrames + 1, which is 5 or 7 depending on the character and so
 * always later than frame 2 -- the turn target is therefore -face here.
 */
export function ucfDashback(p/*: number */, input/*: any */, timer/*: number */,
                            face/*: number */, stickTiltTimerX/*: number */,
                            xSmashThreshold/*: number */)/*: boolean */ {
  if (!ucfEnabled) { return false; }
  if (timer !== 2) { return false; }
  if (input[p][0].lsX * -face < xSmashThreshold) { return false; }
  if (stickTiltTimerX >= 2) { return false; }
  return ucfXSmash(p, input);
}

/**
 * tumble.cpp, injected at Interrupt_AS_DamageFall+0xCC. Vanilla gives ONE
 * frame to wiggle out (x214 = 1, so the tilt timer must be 0); this rescues
 * the very next frame when the flick was genuine.
 *
 *     cmpwi stick_x_hold_time, 1; bne end        // only when vanilla just missed
 *     if (abs(last_stick.x) < wiggle_threshold && check_ucf_xsmash(player))
 *
 * The `last_stick.x` term disallows buffering: the stick must not already have
 * been past the threshold last frame.
 */
export function ucfTumble(p/*: number */, input/*: any */,
                          stickTiltTimerX/*: number */,
                          wiggleThreshold/*: number */)/*: boolean */ {
  if (!ucfEnabled) { return false; }
  if (stickTiltTimerX !== 1) { return false; }
  if (input[p][1] === undefined) { return false; }
  if (Math.abs(input[p][1].lsX) >= wiggleThreshold) { return false; }
  return ucfXSmash(p, input);
}

/**
 * DBOOC -- dashback out of crouch (dbooc.S, Interrupt_SquatRv+0x14).
 *
 * Leaving SquatWait needs the stick above max_squatwait_threshold (x094,
 * 0.625). A handful of rim coordinates sit just under it, so a dashback out of
 * crouch silently fails on them. UCF lowers the threshold for exactly one
 * frame when you are clearly on your way to a dash:
 *
 *     // Must be outside deadzone for 1f (intending to dash on next frame)
 *     lbz gpr.tmp, stick_x_hold_time ; cmpwi gpr.tmp, 1 ; bge end
 *     // rim coord check
 *     lfs f0, new_threshold          // .5900
 *
 * The comment in the source explains the odd constant: "Raise the max
 * SquatWait coord by 2 values. This would be 6000, but 5900 avoids an ICs
 * desync." Returns the threshold to use this frame.
 */
export const UCF_SQUATWAIT_THRESHOLD = 0.59;   // dbooc.S: new_threshold

export function squatWaitThreshold(p/*: number */, input/*: any */,
                                   stickTiltTimerX/*: number */,
                                   vanilla/*: number */)/*: number */ {
  if (!ucfEnabled) { return vanilla; }
  if (stickTiltTimerX >= 1) { return vanilla; }
  const i = input[p][0];
  if (!isRimCoord(i.rawX, i.rawY)) { return vanilla; }
  return UCF_SQUATWAIT_THRESHOLD;
}

/**
 * The tilt-intent test SDI uses, on BOTH axes at once (check_ucf_sdi, sdi.cpp):
 *
 *     delta_x * delta_x + delta_y * delta_y > 62 * 62
 */
export function ucfSdiSmash(p/*: number */, input/*: any */)/*: boolean */ {
  if (input[p][2] === undefined) { return false; }
  const dx = s8(input[p][0].rawX) - s8(input[p][2].rawX);
  const dy = s8(input[p][0].rawY) - s8(input[p][2].rawY);
  return dx * dx + dy * dy > UCF_SDI_DELTA * UCF_SDI_DELTA;
}

/** Shield SDI uses the same threshold but the X axis only (shield_sdi.cpp). */
export function ucfShieldSdiSmash(p/*: number */, input/*: any */)/*: boolean */ {
  if (input[p][2] === undefined) { return false; }
  const dx = s8(input[p][0].rawX) - s8(input[p][2].rawX);
  return dx * dx > UCF_SDI_DELTA * UCF_SDI_DELTA;
}

/**
 * SDI rescue (sdi.cpp, Player_SDICallback+0x5C). Runs only after the vanilla
 * check has already failed.
 *
 *     // Check that the player left the deadzone on the previous frame,
 *     // attempting a vanilla f2 SDI input but failing due to unlucky polling
 *     if (true_stick_x_hold_time >= 2 && true_stick_y_hold_time >= 2) return false;
 *     // Check previous input to disallow buffering, and check for UCF 1f smash
 *     return last_stick.length_sqr() < sdi_threshold^2 && check_ucf_sdi(player);
 *
 * `last_stick` is the previous frame's stick, so a stick already past the
 * threshold cannot be reused -- that is the anti-buffering term.
 */
export function ucfSdi(p/*: number */, input/*: any */,
                       stickTiltTimerX/*: number */, stickTiltTimerY/*: number */,
                       sdiThreshold/*: number */)/*: boolean */ {
  if (!ucfEnabled) { return false; }
  if (stickTiltTimerX >= 2 && stickTiltTimerY >= 2) { return false; }
  const prev = input[p][1];
  if (prev === undefined) { return false; }
  const magSq = prev.lsX * prev.lsX + prev.lsY * prev.lsY;
  if (magSq >= sdiThreshold * sdiThreshold) { return false; }
  return ucfSdiSmash(p, input);
}

/**
 * Shield SDI rescue (shield_sdi.cpp, Player_ShieldSDICallback+0x54). Same
 * shape, X axis only, and only the X hold time is consulted.
 */
export function ucfShieldSdi(p/*: number */, input/*: any */,
                             stickTiltTimerX/*: number */,
                             sdiThreshold/*: number */)/*: boolean */ {
  if (!ucfEnabled) { return false; }
  if (stickTiltTimerX >= 2) { return false; }
  const prev = input[p][1];
  if (prev === undefined) { return false; }
  if (prev.lsX >= sdiThreshold) { return false; }
  return ucfShieldSdiSmash(p, input);
}
