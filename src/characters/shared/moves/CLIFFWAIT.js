import {characterSelections, player} from "main/main";
import {LEDGE_ATTACK_CSTICK_THRESHOLD} from "physics/meleeCommon";
import {checkForJump, actionStates} from "physics/actionStateShortcuts";

import {framesData} from 'main/characters';
export default {
  name : "CLIFFWAIT",
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
  canGrabLedge : false,
  canBeGrabbed : false,
  wallJumpAble : false,
  posOffset : [],
  landType : 0,
  init : function(p,input){
    player[p].actionState = "CLIFFWAIT";
    player[p].timer = 0;
    actionStates[characterSelections[p]].CLIFFWAIT.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].CLIFFWAIT.interrupt(p,input)){
      player[p].phys.ledgeHangTimer++;
    }
  },
  interrupt : function(p,input){
    if ((input[p][0].lsX*player[p].phys.face < -0.2 && input[p][1].lsX*player[p].phys.face >= -0.2) || (input[p][0].lsY < -0.2 && input[p][1].lsY >= -0.2) || (input[p][0].csX*player[p].phys.face < -0.2 && input[p][1].csX*player[p].phys.face >= -0.2) || (input[p][0].csY < -0.2 && input[p][1].csY >= -0.2)){
      player[p].phys.onLedge = -1;
      player[p].phys.ledgeRegrabCount = true;
      actionStates[characterSelections[p]].FALL.init(p,input,true);
      return true;
    }
    // ftCo_8009B170 (ftCo_CliffJump.c:21) is a bare call to
    // ftCo_Jump_GetInput -- the ledge jump uses the SAME tap-jump rule as
    // every other jump, not a bespoke 0.65 crossing.
    else if (checkForJump(p,input)[0]){
      if (player[p].percent < 100){
        actionStates[characterSelections[p]].CLIFFJUMPQUICK.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].CLIFFJUMPSLOW.init(p,input);
      }
      return true;
    }
    else if ((input[p][0].lsX*player[p].phys.face > 0.2 && input[p][1].lsX*player[p].phys.face <= 0.2) || (input[p][0].lsY > 0.2 && input[p][1].lsY <= 0.2)){
      if (player[p].percent < 100){
        actionStates[characterSelections[p]].CLIFFGETUPQUICK.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].CLIFFGETUPSLOW.init(p,input);
      }
      return true;
    }
    // ftCo_8009AE38 (ftCo_CliffAttack.c:29): A or B pressed, or the c-stick
    // crossing x7F8 upward (ftCo_800DF6F8). 0.6625, not 0.65.
    else if ((input[p][0].a && !input[p][1].a) || (input[p][0].b && !input[p][1].b) || (input[p][0].csY >= LEDGE_ATTACK_CSTICK_THRESHOLD && input[p][1].csY < LEDGE_ATTACK_CSTICK_THRESHOLD)){
      if (player[p].percent < 100){
        actionStates[characterSelections[p]].CLIFFATTACKQUICK.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].CLIFFATTACKSLOW.init(p,input);
      }
      return true;
    }
    else if ((input[p][0].lA > 0.3 && input[p][1].lA <= 0.3) || (input[p][0].rA > 0.3 && input[p][1].rA <= 0.3) || (input[p][0].csX*player[p].phys.face > 0.8 && input[p][1].csX*player[p].phys.face <= 0.8)){
      if (player[p].percent < 100){
        actionStates[characterSelections[p]].CLIFFESCAPEQUICK.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].CLIFFESCAPESLOW.init(p,input);
      }
      return true;
    }
    else if (player[p].phys.ledgeHangTimer > 600){
      player[p].phys.onLedge = -1;
      player[p].phys.ledgeRegrabCount = true;
      actionStates[characterSelections[p]].DAMAGEFALL.init(p,input);
      return true;
    }
    else if (player[p].timer > framesData[characterSelections[p]].CLIFFWAIT){
      actionStates[characterSelections[p]].CLIFFWAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

