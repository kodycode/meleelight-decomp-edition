
import UPSPECIALLAUNCH from "characters/fox/moves/UPSPECIALLAUNCH";
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
    sounds.foxupbburn.play();
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.upb1.id0;
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      const frame = (player[p].timer-1) % 10;
      drawVfx({
        name: "firefoxcharge",
        pos: player[p].phys.pos,
        face: player[p].phys.face,
        f: frame
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
        // ftFox_SpecialHi_Enter (ftfoxspecialhi.c:496-513). Two things
        // meleelight did not have:
        //
        //  * The gate is an L1 stick threshold -- stickGetDir(y,0) is |y|, so
        //    the test is |lsY| + |lsX| >= x64 (0.5). Below it the firefox goes
        //    straight up. meleelight only took straight-up on an EXACTLY
        //    centred stick, so any drift aimed the move.
        //  * Fox turns to face the stick first, if |lsX| clears x88 (0.125).
        //
        // Melee then computes atan2f(lsY, lsX * facing) and multiplies facing
        // back in when setting velocity, so its angle is facing-relative. The
        // two cancel exactly (facing^2 == 1), and the ground clamp below plus
        // the hitbox rotation both want a world angle, so the angle is kept in
        // world space here.
        const lsX = f32(input[p][0].lsX);
        const lsY = f32(input[p][0].lsY);
        const attr = player[p].charAttributes;
        let firefoxAngle;
        if (add(Math.abs(lsY), Math.abs(lsX)) >= attr.firefoxStickRangeMin) {
          if (Math.abs(lsX) > attr.firefoxFacingStickRangeMin) {
            // ftCommon_UpdateFacing (ftcommon.c:620): sign of lsX, with 0 -> +1.
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
        // x60_FOX_FIREFOX_FALL_ACCEL. Fox and Falco do NOT share this value.
        player[p].phys.cVel.y = sub(player[p].phys.cVel.y,
                                    player[p].charAttributes.firefoxFallAccel);
      }

      if (player[p].timer > 19 && player[p].timer < 34) {
        switch (player[p].timer % 2) {
          case 0:
            player[p].hitboxes.active = [true,false,false,false];
            player[p].hitboxes.frame = 0;
            break;
          case 1:
            turnOffHitboxes(p);
            break;
        }
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
