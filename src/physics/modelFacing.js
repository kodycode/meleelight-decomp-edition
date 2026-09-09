// @flow

// Which way the fighter's MODEL faces, which is not always `phys.face`.
//
// meleelight's `phys.face` is the fighter's logical facing, and several states
// flip it at a different frame from the one where the ANIMATION turns around.
// The renderer has always compensated by mirroring the drawn outline for
// exactly the frames in between -- otherwise a pivot draws the character
// facing the new way, snaps back, and turns again.
//
// The hurtbox capsules are posed from the same animation as the art, so they
// need the SAME mirror. They were using the raw `phys.face`, which meant that
// during every one of these windows the body mirrored and the hurtbox did not:
// pivot back and forth and the hurtbox stays on the side you came from. It is
// character-dependent, because standing_turn_frames is 6 for Marth and Falcon
// and 4 for Fox, Falco and Puff, so the window is a different length for each.
//
// This is the one place that decision lives now. render.js draws with it and
// hurtboxCollision.js mirrors with it, so they cannot come apart again -- and
// hit detection gets the fix too, since hitsHurtCapsules() reads the same
// capsules.
//
// NOTE: this is meleelight's own concern, not a port. Melee keeps facing_dir
// and facing_dir1 and its models turn with the animation, so the question does
// not arise there in this form.

import { characterSelections, player } from "main/main";
import { actionStates } from "physics/actionStateShortcuts";

/**
 * `phys.face`, mirrored for the states whose animation turns around at a
 * different frame than the logical facing does.
 *
 * `frame` is the render frame -- floor(timer), clamped the way renderPlayer
 * clamps it. Callers that only have the timer can pass it directly; the
 * comparisons here are all `>=` against small numbers, so the clamp does not
 * change the answer.
 */
export function modelFace(i/*: number */, frame/*: number */)/*: number */ {
  const state = player[i].actionState;
  const cs = characterSelections[i];
  let face = player[i].phys.face;

  if (actionStates[cs][state].reverseModel) {
    face *= -1;
  } else if (state === "TILTTURN") {
    // The flip comes from co_attrs.standing_turn_frames; the state and this
    // MUST agree or the character double-turns.
    if (frame >= player[i].charAttributes.standingTurnFrames + 1) {
      face *= -1;
    }
  } else if (state === "RUNTURN") {
    // The STATE's own flag, not a re-derived frame number: RUNTURN waits for
    // the break point AND for run velocity to decay, so a frame comparison
    // disagrees with it whenever the turn was started at speed.
    if (player[i].phys.turnRunFlipped) {
      face *= -1;
    }
  } else if (state.substring(0, state.length - 1) === "AERIALTURN"
             && player[i].timer > 5) {
    face *= -1;                                    // Puff's multijump turn
  } else if (state === "ATTACKAIRB" && cs === 0 && frame > 29) {
    face *= -1;                                    // Marth's back air
  } else if (state === "THROWBACK" && (cs === 2 || cs === 3) && frame >= 10) {
    face *= -1;                                    // Fox and Falco's back throw
  }
  return face;
}
