
import FALL from "characters/shared/moves/FALL";
import {player} from "main/main";
import {Vec2D} from "main/util/Vec2D";
import {airDrift, fastfall} from "physics/actionStateShortcuts";
import {activeStage} from "stages/activeStage";

export default {
  name : "CLIFFJUMPSLOW",
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
  offset : [[-70.24197,-14.37161],[-70.01204,-14.25485],[-69.68486,-14.01434],[-69.31504,-13.61466],[-68.9572,-13.0204],[-68.66598,-12.19617],[-68.49598,-11.10656],[-68.49598,-8.58951],[-69.17776,-4.88456],[-68.95471,-2.05875],[-68.61933,-0.74366],[-68.49973,-0.30766],[-68.72181,-0.92297],[-69.22082,-2.17673],[-69.18517,-2.92594],[-69.0908,-3.15013],[-69.0474,-3.24815],[-69.17303,-2.92594],[-69.01739,-1.4797]],
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "CLIFFJUMPSLOW";
    player[p].timer = 0;
    player[p].phys.intangibleTimer = 19;
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      const onLedge = player[p].phys.onLedge;
      if(onLedge === -1){
        this.canGrabLedge = false;
        return;
      }
      const l = activeStage.ledge[onLedge];
      const x = activeStage[l[0]][l[1]][l[2]].x;
      const y = activeStage[l[0]][l[1]][l[2]].y;
      if (player[p].timer < 20){
        player[p].phys.pos = new Vec2D(x+(this.offset[player[p].timer-1][0]+68.4)*player[p].phys.face,y+this.offset[player[p].timer-1][1]);
      }
      if (player[p].timer === 20){
        player[p].phys.cVel = new Vec2D(1.1*player[p].phys.face,4);
      }
      if (player[p].timer > 20){
        airDrift(p,input);
        fastfall(p,input);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 51){
      player[p].phys.onLedge = -1;
      player[p].phys.ledgeRegrabCount = false;
      FALL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
