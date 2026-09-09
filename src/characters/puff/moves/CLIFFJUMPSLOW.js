import {player} from "../../../main/main";
import puff from "./index";
import {activeStage} from "../../../stages/activeStage";
import {Vec2D} from "../../../main/util/Vec2D";
import {airDrift, fastfall} from "../../../physics/actionStateShortcuts";
import FALL from "../../shared/moves/FALL";
export default {
  name: "CLIFFJUMPSLOW",
  // The ledge states drive position by SNAPPING phys.pos from their offset
  // table every frame, which walks the fighter up the OUTSIDE of the stage
  // wall. Running ordinary environment collision at the same time sweeps the
  // ECB from below the lip to above it, hits the wall/ledge corner, and the
  // resolver pushes the fighter straight back out and down -- getting up off
  // a ledge dropped you back onto it.
  //
  // Melee does not run environment collision here either: the cliff states'
  // Coll callback is ftCo_CliffCatch_Coll (ftcliffcommon.c:128), a
  // ledge-specific check, not the ground/wall resolver.
  ignoreCollision : true,
  offset: [[-73.10, -9.01], [-73.10, -8.03], [-73.09, -6.73], [-73.09, -5.37], [-73.09, -4.23], [-72.76, -3.29], [-71.98, -2.38], [-71.05, -1.58], [-70.28, -0.94], [-69.66, -0.50], [-69.05, -0.21], [-68.59, -0.05], [-68.4, 0], [-68.4, 0], [-68.4, 0], [-68.4, 0], [-68.4, 0]],
  canBeGrabbed: true,
  init: function (p, input) {
    player[p].actionState = "CLIFFJUMPSLOW";
    player[p].timer = 0;
    player[p].phys.intangibleTimer = 17;
    puff.CLIFFJUMPSLOW.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!puff.CLIFFJUMPSLOW.interrupt(p, input)) {
      const onLedge = player[p].phys.onLedge;
      if(onLedge === -1){
        this.canGrabLedge = false;
        return;
      }
      const l = activeStage.ledge[onLedge];
      const x = activeStage[l[0]][l[1]][l[2]].x;
      const y = activeStage[l[0]][l[1]][l[2]].y;
      if (player[p].timer < 18) {
        player[p].phys.pos = new Vec2D(x + (puff.CLIFFJUMPSLOW.offset[player[p].timer - 1][0] + 68.4) * player[p].phys.face, y + puff.CLIFFJUMPSLOW.offset[player[p].timer - 1][1]);
      }
      if (player[p].timer === 18) {
        player[p].phys.cVel = new Vec2D(1.1 * player[p].phys.face, 1.8);
      }
      if (player[p].timer > 18) {
        airDrift(p, input);
        fastfall(p, input);
      }
    }
  },
  interrupt: function (p, input) {
    // CliffJumpSlow1+2 is 49 for Puff; 38 is her CLIFFJUMPQUICK value (total 40),
      // copied across. Nine frames short.
    if (player[p].timer > 47) {
      player[p].phys.onLedge = -1;
      player[p].phys.ledgeRegrabCount = false;
      FALL.init(p, input);
      return true;
    }
    else {
      return false;
    }
  }
};