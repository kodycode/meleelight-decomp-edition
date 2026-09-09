import {checkForSpecials, checkForAerials, checkForDoubleJump, applyFrictionAir, fastfall, actionStates, playSounds} from "physics/actionStateShortcuts";
import {PASSIVE_WALL_JUMP_TIMER, PASSIVE_WALL_VEL_Y_BASE} from "physics/meleeCommon";
import {powf} from "physics/trig";
import {mul} from "physics/f32";
import {sounds} from "main/sfx";
import {characterSelections,  player} from "main/main";
import {framesData} from 'main/characters';
import {drawVfx} from "main/vfx/drawVfx";
export default {
  name : "WALLJUMP",
  canPassThrough : true,
  canGrabLedge : [true,false],
  wallJumpAble : true,
  headBonk : false,
  canBeGrabbed : true,
  landType : 0,
  init : function(p,input){
    player[p].actionState = "WALLJUMP";
    player[p].timer = 0;
    player[p].phys.fastfalled = false;
    player[p].hit.hitstun = 0;
    // _func_8007E2FC_inline (ftcommon.c:911) -- the body of ftCommon_8007E2FC,
    // which is itself just a wrapper -- called from ftCo_800C1E64. Entering a
    // walljump zeroes EVERY velocity channel, not just cVel. Knockback in
    // particular is dropped, which is what lets a walljump cancel a launch.
    player[p].phys.cVel.x = 0;
    player[p].phys.cVel.y = 0;
    player[p].phys.kVel.x = 0;
    player[p].phys.kVel.y = 0;
    player[p].phys.grVel = 0;
    player[p].phys.grKBVel = 0;
    player[p].phys.groundAccel1 = 0;
    player[p].phys.groundAccel2 = 0;
    player[p].phys.shieldKBVel.x = 0;
    player[p].phys.shieldKBVel.y = 0;
    player[p].phys.grShieldKBVel = 0;
    player[p].phys.intangibleTimer = Math.max(player[p].phys.intangibleTimer,14);
    // ftCo_800C1E64 (ftCo_PassiveWall.c:88): the launch velocity is NOT set
    // here. A countdown is started and the velocity is applied on the frame it
    // reaches zero -- see main(). The walljump count is latched now, because
    // Melee reads it into mv.co.passivewall.vel_y_exponent before incrementing.
    player[p].phys.passiveWallTimer = PASSIVE_WALL_JUMP_TIMER;
    player[p].phys.passiveWallExponent = player[p].phys.wallJumpCount;
    player[p].phys.wallJumpCount++;
    player[p].hit.hitlag = 5;
    player[p].hit.knockback = 0;
    if (player[p].phys.face === 1){
      drawVfx({
        name: "tech",
        pos: player[p].phys.ECBp[3]
      });
    }
    else {
      drawVfx({
        name: "tech",
        pos: player[p].phys.ECBp[1]
      });
    }
    // draw tech rotated
    actionStates[characterSelections[p]].WALLJUMP.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    playSounds("TECH",p);
    if (player[p].timer === 2){
      sounds.walljump.play();
    }
    // ftCo_PassiveWall_Anim (ftCo_PassiveWall.c:128-148). The countdown ticks
    // first; on the frame it hits zero the launch velocity is set.
    if (player[p].phys.passiveWallTimer !== 0) {
      player[p].phys.passiveWallTimer--;
      if (player[p].phys.passiveWallTimer === 0) {
        const attr = player[p].charAttributes;
        player[p].phys.cVel.x = mul(player[p].phys.face, attr.wallJumpVelX);
        player[p].phys.cVel.y = attr.wallJumpVelY;
        // Guarded on `walljumps_used != 0` in the original, which is the same
        // as skipping it when the exponent is 0 -- powf(base, 0) is 1.
        if (player[p].phys.passiveWallExponent !== 0) {
          player[p].phys.cVel.y = mul(player[p].phys.cVel.y,
            powf(PASSIVE_WALL_VEL_Y_BASE, player[p].phys.passiveWallExponent));
        }
      }
    }
    if (!actionStates[characterSelections[p]].WALLJUMP.interrupt(p,input)){
      // ftCo_PassiveWall_Phys (ftCo_PassiveWall.c:177) is gated on `!timer`:
      // while the countdown runs the fighter hangs on the wall with no gravity
      // and no fastfall at all. After it, note the drift call is
      // ftCommon_8007D140(fp, 0, 0, aerial_friction) -- a zero target_vel,
      // which ftCommon_8007D174 short-circuits to friction only. A walljump
      // has NO air control, only decay; meleelight called airDrift here.
      if (player[p].phys.passiveWallTimer === 0) {
        fastfall(p,input);
        applyFrictionAir(p, player[p].charAttributes.airFriction);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 1){
      const a = checkForAerials(p, input);
      const b = checkForSpecials(p, input);
      if (a[0]){
        actionStates[characterSelections[p]][a[1]].init(p,input);
        return true;
      }
      else if ((input[p][0].l && !input[p][1].l) || (input[p][0].r && !input[p][1].r)){
        actionStates[characterSelections[p]].ESCAPEAIR.init(p,input);
        return true;
      }
      else if (checkForDoubleJump (p,input) && (!player[p].phys.doubleJumped || (player[p].phys.jumpsUsed < 5 && player[p].charAttributes.multiJump))){
        if (input[p][0].lsX*player[p].phys.face < -0.3){
          actionStates[characterSelections[p]].JUMPAERIALB.init(p,input);
        }
        else {
          actionStates[characterSelections[p]].JUMPAERIALF.init(p,input);
        }
        return true;
      }
      else if (b[0]){
        actionStates[characterSelections[p]][b[1]].init(p,input);
        return true;
      }
      else if (player[p].timer > framesData[characterSelections[p]].WALLJUMP){
        actionStates[characterSelections[p]].FALL.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }
};

