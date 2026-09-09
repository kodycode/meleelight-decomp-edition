import {checkForJump, reduceByTraction, actionStates, turnRunPhysics} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
import {framesData} from 'main/characters';
import {mul} from "physics/f32";
export default {
  name : "RUNTURN",
  canEdgeCancel : false,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "RUNTURN";
    player[p].timer = 0;
    // ftCo_TurnRun_Enter (ftCo_TurnRun.c:41): facing is LATCHED at entry into
    // mv.turnrun.accel_mul. It does NOT follow the mid-state facing flip, which
    // is why Melee needs only one accel branch where meleelight needed two.
    player[p].phys.turnRunAccelMul = player[p].phys.face;
    player[p].phys.turnRunFlipped = false;
    actionStates[characterSelections[p]].RUNTURN.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].RUNTURN.interrupt(p,input)){
      // ftCo_TurnRun_Phys (ftCo_TurnRun.c:84).
      //
      // Fixes two defects. The old accel branches gated on `lsX * face` vs a
      // hardcoded +/-0.3 and used dAccA*|lsX| with no target clamp and no
      // friction blend. And the fallback called reduceByTraction(p, true),
      // applying friction_when_above_walk_speed (2.0) -- Melee uses plain
      // ground_friction here, so that was a straight 2x friction error.
      turnRunPhysics(p, input);

      // ftCo_TurnRun_Anim (ftCo_TurnRun.c:57). The flip has TWO gates, and the
      // old code had neither right:
      //
      //  1. The subaction script sets cmd_vars[1] = 1 on a per-character PIVOT
      //     FRAME. Only after that does the state begin testing velocity.
      //  2. It then waits until velocity has reversed relative to the facing
      //     LATCHED AT ENTRY (accel_mul * gr_vel <= 0.01), freezing the
      //     animation meanwhile, and only then flips.
      //
      // The old code flipped at a fixed frame with no velocity gate, then
      // hacked the timer backwards if velocity had not reversed yet.
      //
      // runTurnBreakPoint now holds the REAL pivot frame, decoded from the
      // TurnRun subaction script in the character's own PlXx.dat (event 0x13,
      // set_cmd_var idx 1). It was wrong for four of five characters -- Fox,
      // Falcon and Marth were 16/16/18 against an actual 9.
      //
      // Remaining gap: Melee freezes the ANIMATION at rate 0 while waiting.
      // meleelight has no animation-rate concept here, so the visual hold is
      // absent; the physics gating is now faithful.
      if (!player[p].phys.turnRunFlipped
          && player[p].timer >= player[p].charAttributes.runTurnBreakPoint
          && mul(player[p].phys.turnRunAccelMul, player[p].phys.grVel) <= 0.01) {
        player[p].phys.face *= -1;
        player[p].phys.turnRunFlipped = true;
      }
    }
  },
  interrupt : function(p,input){
    const j = checkForJump(p, input);
    if (j[0]){
      actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
      return true;
    }
    else if (player[p].timer > framesData[characterSelections[p]].RUNTURN){
      if(input[p][0].lsX * player[p].phys.face > 0.6){
        actionStates[characterSelections[p]].RUN.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].WAIT.init(p,input);
      }
      return true;
    }
    else {
      return false;
    }
  }
};

