import WAIT from "characters/shared/moves/WAIT";
import FALL from "characters/shared/moves/FALL";
import {player} from "main/main";
import {sounds} from "main/sfx";
import {turnOffHitboxes, reduceByTraction} from "physics/actionStateShortcuts";

import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../../../main/util/Vec2D";
import {getGroundVelocity, setGroundVelocity} from "physics/groundMovement";
import {f32, sub, mul} from "physics/f32";
export default {
  name : "DOWNSPECIALGROUNDENDGROUND",
  canPassThrough : false,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  canEdgeCancel : true,
  disableTeeter : true,
  airborneState : "DOWNSPECIALGROUNDENDGROUND",
  init : function(p,input){
    player[p].actionState = "DOWNSPECIALGROUNDENDGROUND";
    player[p].timer = 0;
    setGroundVelocity(p, 2.14 * player[p].phys.face);
    player[p].phys.cVel.y = 0;
    turnOffHitboxes(p);
    sounds.land.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      if (player[p].phys.grounded) {
        // Grounded branch: decay the along-ground scalar. cVel is re-derived
        // by the projection, so cVel.y is no longer forced to 0 by hand --
        // on a slope the tangent legitimately has a vertical component.
        // ftcaptainspeciallw.c:243: ApplyFrictionGround with
        // `speciallw_ground_traction * ground_friction`. 1.6 * 0.08 = 0.128,
        // which is the number that used to be here.
        const attr = player[p].charAttributes;
        const grv = getGroundVelocity(p);
        const fr = mul(attr.speciallwGroundTraction, attr.traction);
        setGroundVelocity(p, Math.sign(grv) * Math.max(sub(Math.abs(grv), fr), 0));
      }
      else {
        setGroundVelocity(p, Math.sign(getGroundVelocity(p)) * Math.max(Math.abs(getGroundVelocity(p))-player[p].charAttributes.airFriction, 0));
        player[p].phys.cVel.y = Math.max(player[p].phys.cVel.y-player[p].charAttributes.gravity, -player[p].charAttributes.terminalV);
      }
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
  }
};
