import WAIT from "characters/shared/moves/WAIT";
import FALL from "characters/shared/moves/FALL";
import {player} from "main/main";
import {sounds} from "main/sfx";
import {turnOffHitboxes, reduceByTraction, applyRootMotionAir} from "physics/actionStateShortcuts";

import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../../../main/util/Vec2D";
import {setGroundVelocity} from "physics/groundMovement";
export default {
  name : "DOWNSPECIALGROUNDENDAIR",
  canPassThrough : false,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  canEdgeCancel : true,
  disableTeeter : true,
  landType : 1,
  init : function(p,input){
    player[p].actionState = "DOWNSPECIALGROUNDENDAIR";
    player[p].timer = 0;
    turnOffHitboxes(p);
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // BOTH axes from the animation, for the whole state.
      // ftCa_SpecialLwEndAir_Phys (ftcaptainspeciallw.c:256) takes the air
      // branch to ft_80085134 (ft_084E.c:119), which assigns self_vel.x and
      // self_vel.y outright -- so there is no gravity and no air friction
      // here at all.
      //
      // The disc carries +30.95 units of forward travel over 30 frames. What
      // was here delivered almost none of it: the two setGroundVelocity calls
      // tested `player.timer`, missing the `[p]`, so `undefined < 7` and
      // `undefined === 7` were both false and NEITHER ever fired. Falcon then
      // fell under gravity from frame 8 with whatever velocity he happened to
      // carry in.
      applyRootMotionAir(p, "DOWNSPECIALGROUNDENDAIR");
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 30){
      if (player[p].phys.grounded){
        WAIT.init(p,input);
      }
      else {
        FALL.init(p,input);
      }
      return true;
    }
    else {
      return false;
    }
  },
  land : function(p,input) {
    player[p].actionState = "DOWNSPECIALGROUNDENDGROUND";
  }
};
