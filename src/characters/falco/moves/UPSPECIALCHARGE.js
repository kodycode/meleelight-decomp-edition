
import UPSPECIALLAUNCH from "characters/falco/moves/UPSPECIALLAUNCH";
import {reduceByTraction, turnOffHitboxes} from "physics/actionStateShortcuts";
import {atan2f, HALF_PI} from "physics/trig";
import {f32, add, sub} from "physics/f32";
import { player} from "main/main";
import {sounds} from "main/sfx";
import {drawVfx} from "main/vfx/drawVfx";

export default {
  name : "UPSPECIALCHARGE",
  canPassThrough : false, // ???
  canGrabLedge : [true,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  canEdgeCancel : true,
  disableTeeter : true,
  airborneState : "UPSPECIALCHARGE",
  landType : 1,
  init : function(p,input){
    player[p].actionState = "UPSPECIALCHARGE";
    player[p].timer = 0;
    player[p].phys.cVel.x *= 0.8;
    player[p].phys.cVel.y = 0;
    player[p].phys.fastfalled = false;
    player[p].phys.landingMultiplier = 10;
    sounds.firebirdcharge.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      const frame = (player[p].timer-1) % 10;
      drawVfx({
        name:"firefoxcharge",
        pos:player[p].phys.pos,
        face:player[p].phys.face,
        f:frame
      });

      if (player[p].phys.grounded){
        reduceByTraction(p);
      }
      else {
        if (player[p].phys.cVel.x > 0){
          player[p].phys.cVel.x -= player[p].charAttributes.airFriction;
          if (player[p].phys.cVel.x < 0){
            player[p].phys.cVel.x = 0;
          }
        }
        else if (player[p].phys.cVel.x < 0){
          player[p].phys.cVel.x += player[p].charAttributes.airFriction;
          if (player[p].phys.cVel.x > 0){
            player[p].phys.cVel.x = 0;
          }
        }
      }

      if (player[p].timer === 42){
        // ftFox_SpecialHi_Enter (ftfoxspecialhi.c:496-513) -- Falco runs the
        // same code as Fox, only the attribute values differ. See the Fox copy
        // of this file for why the angle stays in world space.
        const lsX = f32(input[p][0].lsX);
        const lsY = f32(input[p][0].lsY);
        const attr = player[p].charAttributes;
        let firefoxAngle;
        if (add(Math.abs(lsY), Math.abs(lsX)) >= attr.firefoxStickRangeMin) {
          if (Math.abs(lsX) > attr.firefoxFacingStickRangeMin) {
            player[p].phys.face = lsX >= 0 ? 1 : -1;
          }
          firefoxAngle = atan2f(lsY, lsX);
        }
        else {
          firefoxAngle = HALF_PI;
        }

        if (player[p].phys.grounded && player[p].phys.onSurface[0] === 0) {
          if (firefoxAngle < -Math.PI/2) {
            // need the angle to go from -pi/2 to 3pi/2, important for the upcoming comparisons 
            firefoxAngle += 2*Math.PI;
          }
          const groundedAngle = player[p].phys.groundAngle || Math.PI/2;
          if (firefoxAngle > groundedAngle + Math.PI/2) {
            firefoxAngle = groundedAngle + Math.PI/2;
          }
          else if (firefoxAngle < groundedAngle - Math.PI/2) {
            firefoxAngle = groundedAngle - Math.PI/2;
          }
        }
        if (firefoxAngle > Math.PI) {
          // return an angle between -pi and pi
          firefoxAngle -= 2*Math.PI;
        }
        player[p].phys.upbAngleMultiplier = firefoxAngle;
      }
      else if (player[p].timer >= 16 && !player[p].phys.grounded){
        // x60_FOX_FIREFOX_FALL_ACCEL. Falco's is 0.016, not Fox's 0.015 --
        // this line had been copied across from Fox.
        player[p].phys.cVel.y = sub(player[p].phys.cVel.y,
                                    player[p].charAttributes.firefoxFallAccel);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 42){
      UPSPECIALLAUNCH.init(p,input);
    }
    else {
      return false;
    }
  },
  land : function(p,input){
    // do nothing
  }
};
