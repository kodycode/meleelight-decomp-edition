import marth from "./index";
import {player} from "../../../main/main";
import {turnOffHitboxes, reduceByTraction} from "../../../physics/actionStateShortcuts";
import {sounds} from "../../../main/sfx";
import WAIT from "../../shared/moves/WAIT";
export default {
  name: "GRAB",
  canEdgeCancel: false,
  canBeGrabbed: true,
  init: function (p, input) {
    player[p].actionState = "GRAB";
    player[p].timer = 0;
    player[p].phys.charging = false;
    player[p].phys.chargeFrames = 0;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.grab.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.grab.id1;
    player[p].hitboxes.id[2] = player[p].charHitboxes.grab.id2;
    marth.GRAB.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!marth.GRAB.interrupt(p, input)) {
      // PLAIN traction. ftCo_Catch_Phys (ftCo_Catch.c:151) is
      // ApplyFrictionGround(fp, x64 * ground_friction) and x64 is 1.0 on the
      // disc -- the grab states are NOT ft_80084F3C and never double above
      // walk speed, which is what a grab out of a dash is.
      reduceByTraction(p,false);
      if (player[p].timer === 7) {
        player[p].hitboxes.active = [true, true, true, false];
        player[p].hitboxes.frame = 0;
        sounds.grab.play();
      }
      if (player[p].timer > 7 && player[p].timer < 9) {
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 9) {
        turnOffHitboxes(p);
      }
    }
  },
  interrupt: function (p, input) {
    if (player[p].timer > 30) {
      WAIT.init(p, input);
      return true;
    }
    else {
      return false;
    }
  }
};