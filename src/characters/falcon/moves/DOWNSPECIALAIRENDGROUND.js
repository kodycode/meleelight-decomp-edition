/* eslint-disable */
import WAIT from "characters/shared/moves/WAIT";
import FALL from "characters/shared/moves/FALL";
import {player} from "main/main";
import {sounds} from "main/sfx";
import {turnOffHitboxes} from "physics/actionStateShortcuts";
import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../../../main/util/Vec2D";
import {gameSettings} from "settings";
import {setGroundVelocity, applyFrictionGround, applyGroundMovement} from "physics/groundMovement";
import {f32, mul} from "physics/f32";

export default {
  name : "DOWNSPECIALAIRENDGROUND",
  canPassThrough : false,
  canEdgeCancel : false,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "DOWNSPECIALAIRENDGROUND";
    player[p].timer = 0;
    player[p].phys.fastfalled = false;
    // Falcon Kick landing is a GROUNDED state (it plays the land sound and the
    // ground-bounce VFX), so the entry speed belongs on the grounded scalar and
    // picks up the floor-tangent projection. Assigning cVel.y = 0 separately is
    // then unnecessary -- the projection produces both components.
    setGroundVelocity(p, 0.98542 * player[p].phys.face);
    player[p].hitboxes.id[0] = player[p].charHitboxes.falconkickland.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.falconkickland.id1;
    player[p].hitboxes.id[2] = player[p].charHitboxes.falconkickland.id2;
    sounds.land.play();
    drawVfx({
      name: "groundBounce",
      pos: player[p].phys.pos,
      face: player[p].phys.face,
      f: player[p].phys.groundAngle
    });
    turnOffHitboxes(p);
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // ftCa_SpecialAirLwEnd_Phys (ftcaptainspeciallw.c:278):
      //     ftCommon_ApplyFrictionGround(fp,
      //         da->speciallw_air_landing_traction * ca->ground_friction);
      //     ftCommon_ApplyGroundMovement(gobj);
      // speciallw_air_landing_traction is 3.0 (Falcon ext_attr+0x88), and
      // Falcon's ground_friction is 0.08, so the hardcoded 0.24 here was the
      // right number reached the wrong way -- as a float64 literal, on the
      // wrong channel, and with a hand-rolled sign/clamp instead of the shared
      // friction routine. Deriving it keeps it exact and keeps it correct if
      // the attribute ever comes from the disc.
      const attr = player[p].charAttributes;
      applyFrictionGround(p, mul(attr.speciallwAirLandingTraction, attr.traction));
      applyGroundMovement(p);
      if (player[p].timer === 1){
        player[p].hitboxes.active = [true,true,true,false];
        player[p].hitboxes.frame = 0;
      }
      if (player[p].timer > 1 && player[p].timer < 3){
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 3){
        turnOffHitboxes(p);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 45){
      WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
