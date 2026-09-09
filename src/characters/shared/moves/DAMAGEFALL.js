import {checkForSpecials, checkForAerials, checkForDoubleJump, airDrift, fastfall, actionStates, turnOffHitboxes} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
import {TUMBLE_WIGGLE_STICK_THRESHOLD, TUMBLE_WIGGLE_WINDOW} from "physics/meleeCommon";
import {ucfTumble} from "physics/ucf";

import {framesData} from 'main/characters';
export default {
  name : "DAMAGEFALL",
  canPassThrough : false,
  canGrabLedge : [true,false],
  wallJumpAble : false,
  headBonk : true,
  canBeGrabbed : true,
  landType : 2,
  vCancel : true,
  init : function(p,input){
    player[p].actionState = "DAMAGEFALL";
    player[p].timer = 0;
    turnOffHitboxes(p);
    actionStates[characterSelections[p]].DAMAGEFALL.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].DAMAGEFALL.interrupt(p,input)){
      fastfall(p,input);
      airDrift(p,input);
    }
  },
  interrupt : function(p,input){
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
    // ftCo_DamageFall_IASA (ftCo_DamageFall.c:124). What was here tested a
    // rising edge past 0.7 on BOTH axes against the previous frame. Melee uses
    // the stick tilt timer, the 0.8 threshold, and the X AXIS ONLY -- flicking
    // up or down has never escaped tumble. The window is a single frame
    // (x214 = 1), so the timer must be exactly 0.
    // The second clause is UCF (tumble.cpp), off unless the toggle is on: it
    // rescues the frame right after vanilla's single-frame window when the
    // flick was genuine.
    else if ((Math.abs(input[p][0].lsX) >= TUMBLE_WIGGLE_STICK_THRESHOLD
              && player[p].phys.stickTiltTimerX < TUMBLE_WIGGLE_WINDOW)
             || ucfTumble(p, input, player[p].phys.stickTiltTimerX,
                          TUMBLE_WIGGLE_STICK_THRESHOLD)){
      actionStates[characterSelections[p]].FALL.init(p,input);
      return true;
    }
    else if (player[p].timer > framesData[characterSelections[p]].DAMAGEFALL){
      actionStates[characterSelections[p]].DAMAGEFALL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

