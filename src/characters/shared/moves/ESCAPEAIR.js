import {playSounds, executeIntangibility, actionStates} from "physics/actionStateShortcuts";
import {ESCAPEAIR_DEADZONE_X, ESCAPEAIR_DEADZONE_Y, ESCAPEAIR_FORCE, ESCAPEAIR_DECAY} from "physics/meleeCommon";
import {atan2f, sinf, cosf} from "physics/trig";
import {mul, f32} from "physics/f32";
import {characterSelections, player} from "main/main";
export default {
  name : "ESCAPEAIR",
  canPassThrough : false,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  landType : 1,
  vCancel : true,
  init : function(p,input){
    player[p].actionState = "ESCAPEAIR";
    player[p].timer = 0;
    // ftCo_EscapeAir.c:36-52. Note the deadzone is an AND over both axes: a
    // quarter deflection on either one is enough to get a directional dodge.
    const lsX = f32(input[p][0].lsX);
    const lsY = f32(input[p][0].lsY);
    if (Math.abs(lsX) < ESCAPEAIR_DEADZONE_X && Math.abs(lsY) < ESCAPEAIR_DEADZONE_Y){
      player[p].phys.cVel.x = 0;
      player[p].phys.cVel.y = 0;
    }
    else {
      // ftCommon_8007D9D4 (ftcommon.c:615) is a bare atan2f over the raw stick;
      // the magnitude is discarded, so every dodge outside the deadzone travels
      // at exactly the same speed.
      const ang = atan2f(lsY, lsX);
      player[p].phys.cVel.x = mul(ESCAPEAIR_FORCE, cosf(ang));
      player[p].phys.cVel.y = mul(ESCAPEAIR_FORCE, sinf(ang));
    }
    player[p].phys.fastfalled = false;
    player[p].phys.landingMultiplier = 3;
    actionStates[characterSelections[p]].ESCAPEAIR.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].ESCAPEAIR.interrupt(p,input)){
      // ftCo_EscapeAir_Phys (ftCo_EscapeAir.c:97):
      //
      //   if (!cmd_vars[cmd_skip_decay]) { self_vel.x *= x33C; self_vel.y *= x33C; }
      //   else                           { ft_80084DB0(gobj); }
      //
      // cmd_skip_decay is cmd_vars[0], and the ONLY way it becomes true is a
      // SET_CMD_VAR subaction event (opcode 0x13, ftAction_80071820). Every
      // character's EscapeAir subaction script on the disc is a single `end`
      // instruction -- no events at all -- so the flag is set false on entry
      // (ftCo_EscapeAir.c:60) and never changes.
      //
      // The decay therefore runs for the WHOLE airdodge, and the else branch is
      // unreachable in normal play. There is no gravity and no air control at
      // any point during it; that is what makes an airdodge float, and what
      // wavedashing depends on. Gravity resumes only when the state ends and
      // FallSpecial takes over.
      //
      // What was here switched to airDrift + fastfall from frame 30, granting
      // twenty frames of gravity and steering the game does not give.
      player[p].phys.cVel.x = mul(player[p].phys.cVel.x, ESCAPEAIR_DECAY);
      player[p].phys.cVel.y = mul(player[p].phys.cVel.y, ESCAPEAIR_DECAY);
      executeIntangibility("ESCAPEAIR",p);
      playSounds("ESCAPEAIR",p);
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 49){
      actionStates[characterSelections[p]].FALLSPECIAL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  },
  land : function(p,input){
    player[p].phys.intangibleTimer = 0;
    player[p].phys.hurtBoxState = 0;
    actionStates[characterSelections[p]].LANDINGFALLSPECIAL.init(p,input);
  }
};

