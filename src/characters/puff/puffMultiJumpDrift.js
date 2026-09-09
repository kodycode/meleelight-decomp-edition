import {airDrift} from "physics/actionStateShortcuts";

/**
 * Puff's multi-jump air control.
 *
 * There is nothing special about it. ftCo_JumpAerial_Phys (ftCo_JumpAerial.c:305)
 * is a bare call to ft_80084DB0 (ft_081B.c:1363), which is
 * CheckFallFast/Fall/FallFast followed by ftCommon_8007D268 -- and that is
 * `ftCommon_8007D28C(fp, self_vel.x)`, the ordinary air drift every airborne
 * state uses, reading the ordinary attributes. Puff's five jumps get no
 * modifier of any kind. (The one fighter that DOES override this callback is
 * Ness, ftNs_JumpAerial_Phys_Cb at :310.)
 *
 * What was here was a hand-rolled reimplementation with three defects:
 *
 *  1. Every attribute was scaled by a fictional 0.8 -- air_drift_max appeared
 *     as 1.08 against Puff's real 1.35, and air_drift_stick_mul as 0.072
 *     against 0.09. That factor exists nowhere in the game.
 *  2. The aerial_drift_base flat term (0.19 for Puff) was missing entirely, so
 *     drift accelerated at roughly a third of the real rate.
 *  3. The deadzone was 0.3 rather than the real 0.28, and applied locally
 *     rather than in the input layer.
 *
 * Callers already run fastfall() themselves, which covers the Fall half of
 * ft_80084DB0, so this is just the drift half.
 */
export function puffMultiJumpDrift(p, input) {
  airDrift(p, input);
}
