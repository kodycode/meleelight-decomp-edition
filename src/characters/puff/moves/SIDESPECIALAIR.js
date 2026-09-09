import {player} from "../../../main/main";
import {turnOffHitboxes, airDrift, fastfall, rolloutAngle} from "../../../physics/actionStateShortcuts";
import {sinf, cosf} from "physics/trig";
import {mul} from "physics/f32";
import puff from "./index";
import {sounds} from "../../../main/sfx";
import WAIT from "../../shared/moves/WAIT";
import FALL from "../../shared/moves/FALL";
export default {
  name: "SIDESPECIALAIR",
  canPassThrough: false,
  canEdgeCancel: false,
  canGrabLedge: [false, false],
  groundVelocities: [1.88, 1.50792, 1.31208, 1.14561, 0.73439, 0.34986, 0.34461, 0.33943, 0.33430, 0.32924, 0.32424, 0.31930, 0.31443, 0.30961, 0.30486, 0.30017, 0.29554, 0.29097, 0.28647, 0.28202, 0.27764, 0.27332, 0.26906, 0.26487, 0.26074, 0.25666, 0.25265, 0.23230, 0.19657, 0.16230, 0.12950, 0.09816, 0.06830, 0.03990],
  // airVelocities REMOVED: it was 2.2 * 0.92^n (xF0, xF4) flattened to
  // five decimals and cut off at 28 entries. The recurrence is run
  // directly in main() now -- see ftpurinspecials.c:97-125.
  wallJumpAble: false,
  headBonk: false,
  canBeGrabbed: true,
  landType: 1,
  init: function (p, input) {
    player[p].actionState = "SIDESPECIALAIR";
    player[p].timer = 0;
    if (player[p].phys.grounded) {
      player[p].phys.cVel.x = 0;
    }
    else {
      if (player[p].phys.cVel.y < -player[p].charAttributes.terminalV) {
        player[p].phys.cVel.y = -player[p].charAttributes.terminalV;
      }
    }
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.sidespecial.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.sidespecial.id1;
    puff.SIDESPECIALAIR.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!puff.SIDESPECIALAIR.interrupt(p, input)) {

      if (player[p].phys.grounded) {
        if (player[p].timer > 11) {
          player[p].phys.cVel.x = puff.SIDESPECIALAIR.groundVelocities[player[p].timer - 12] * player[p].phys.face;
        }
      }
      else {
        if (player[p].timer === 12) {
          player[p].phys.fastfalled = false;
          // calcAngleRadians, ftpurinspecials.c:78-95 -- a floored and capped
          // ramp, not a straight lsY * 20 degrees.
          player[p].phys.upbAngleMultiplier = rolloutAngle(p, input[p][0].lsY);
          player[p].phys.cVel.y = 0;
        }
        if (player[p].timer < 12) {
          if (player[p].phys.cVel.x > 0) {
            player[p].phys.cVel.x -= player[p].charAttributes.airFriction;
            if (player[p].phys.cVel.x < 0) {
              player[p].phys.cVel.x = 0;
            }
          }
          else if (player[p].phys.cVel.x < 0) {
            player[p].phys.cVel.x += player[p].charAttributes.airFriction;
            if (player[p].phys.cVel.x > 0) {
              player[p].phys.cVel.x = 0;
            }
          }
          player[p].phys.cVel.y -= player[p].charAttributes.gravity;
          if (player[p].phys.cVel.y < -player[p].charAttributes.terminalV) {
            player[p].phys.cVel.y = -player[p].charAttributes.terminalV;
          }
        }
        else if (player[p].timer > 11 && player[p].timer < 40) {
          // ftPr_SpecialAirS_Phys (ftpurinspecials.c:97-125). Melee seeds the
          // velocity once from xF0 and then multiplies BOTH components by xF4
          // every frame, including the frame it was seeded on -- which is why
          // the first value out is 2.2*0.92 and not 2.2.
          //
          // The `airVelocities` table this replaces was exactly that geometric
          // sequence flattened to five decimals and truncated at 28 entries.
          // Running the recurrence instead is both exact in float32 and does
          // not run off the end of an array.
          const attr = player[p].charAttributes;
          if (player[p].timer === 12) {
            const ang = player[p].phys.upbAngleMultiplier;
            // Parenthesised as the original: the facing multiply is inside.
            player[p].phys.cVel.x = mul(attr.rolloutSpeed, mul(player[p].phys.face, cosf(ang)));
            player[p].phys.cVel.y = mul(attr.rolloutSpeed, sinf(ang));
          }
          player[p].phys.cVel.x = mul(player[p].phys.cVel.x, attr.rolloutDecay);
          player[p].phys.cVel.y = mul(player[p].phys.cVel.y, attr.rolloutDecay);
        }
        else {
          airDrift(p, input);
          fastfall(p, input);
        }
      }

      if (player[p].timer === 12) {
        player[p].hitboxes.active = [true, true, false, false];
        player[p].hitboxes.frame = 0;
        sounds.puffshout1.play();
      }
      if (player[p].timer > 12 && player[p].timer < 28) {
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 28) {
        turnOffHitboxes(p);
      }
    }
  },
  interrupt: function (p, input) {
    if (player[p].timer > 45) {
      if (player[p].phys.grounded) {
        WAIT.init(p, input);
      }
      else {
        FALL.init(p, input);
      }
      return true;
    }
    else {
      return false;
    }
  },
  land: function (p, input) {
    player[p].actionState = "SIDESPECIALGROUND";
  }
};