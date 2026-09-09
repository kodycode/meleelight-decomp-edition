
import FALLSPECIAL from "characters/shared/moves/FALLSPECIAL";
import WAIT from "characters/shared/moves/WAIT";
import LANDING from "characters/shared/moves/LANDING";
import {player} from "main/main";
import {applyAirDecay, reduceByTraction} from "physics/actionStateShortcuts";

export default {
  name : "FIREFOXBOUNCE",
  canPassThrough : true,
  canGrabLedge : [true,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  setVelocities : [0.00072,0.00072,0.00072,6.04024,6.25258,2.93342,0.07311,0.03107,-0.00327,-0.02994,-0.04893,-0.06023,-0.06386,-2.09936],
  landType : 1,
  init : function(p,input){
    player[p].actionState = "FIREFOXBOUNCE";
    player[p].timer = 0;
    player[p].phys.grounded = false;
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // ftFx_SpecialHiBound_Phys (ftfoxspecialhi.c:705) branches on the
      // ground state, and neither branch is what was here:
      //
      //   airborne -> ft_800851C0 (self_vel.y = the ANIMATION's vertical
      //               delta, which is what setVelocities holds) followed by
      //               ftCommon_8007CF58, the two-regime horizontal air decay
      //   grounded -> ft_80084F3C: ground friction on gr_vel plus
      //               ApplyGroundMovement -- the GROUNDED channel, so it must
      //               not touch cVel.x directly at all
      //
      // The old code ran the airborne half unconditionally and decayed with
      // `-= 0.03 * face`. 0.03 turns out to be the right number (x1FC), but it
      // only applies above air_drift_max -- below that the character's own
      // aerial_friction does -- and Melee decays toward ZERO rather than along
      // facing. Moving backwards, `-= 0.03 * face` accelerated away from zero
      // and then snapped to 0 on the very next line, so backward momentum was
      // discarded outright instead of decaying.
      if (player[p].phys.grounded){
        reduceByTraction(p);
      }
      else {
        applyAirDecay(p);
        player[p].phys.cVel.y = this.setVelocities[player[p].timer-1];
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 14){
      if (player[p].phys.grounded){
        WAIT.init(p,input);
      }
      else {
        FALLSPECIAL.init(p,input);
      }
      return true;
    }
    else {
      return false;
    }
  },
  land : function(p,input){
    LANDING.init(p,input);
  }
};
