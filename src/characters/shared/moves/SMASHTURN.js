import {checkForJump, checkForSmashes, checkForTilts, reduceByTraction, actionStates} from "physics/actionStateShortcuts";
import {DASH_SMASH_STICK_THRESHOLD} from "physics/meleeCommon";
import {characterSelections, player} from "main/main";
export default {
  name : "SMASHTURN",
  canEdgeCancel : true,
  reverseModel : true,
  canBeGrabbed : true,
  disableTeeter : true,
  init : function(p,input){
    player[p].actionState = "SMASHTURN";
    player[p].timer = 0;
    player[p].phys.face *= -1;
    actionStates[characterSelections[p]].SMASHTURN.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].SMASHTURN.interrupt(p,input)){
      reduceByTraction(p,true);
    }
  },
  interrupt : function(p,input){
    const t = checkForTilts(p,input);
    const s = checkForSmashes(p,input);
    const j = checkForJump(p,input);
    if (j[0]){
      actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
      return true;
    }
    else if (input[p][0].b && !input[p][1].b && Math.abs(input[p][0].lsX) > 0.6){
      player[p].phys.face = Math.sign(input[p][0].lsX);
      if (player[p].phys.grounded){
        actionStates[characterSelections[p]].SIDESPECIALGROUND.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].SIDESPECIALAIR.init(p,input);
      }
      return true;
    }
    else if (input[p][0].l || input[p][0].r){
      actionStates[characterSelections[p]].GUARDON.init(p,input);
      return true;
    }
    else if (input[p][0].lA > 0 || input[p][0].rA > 0){
      actionStates[characterSelections[p]].GUARDON.init(p,input);
      return true;
    }
    else if (s[0]){
      actionStates[characterSelections[p]][s[1]].init(p,input);
      return true;
    }
    else if (t[0]){
      actionStates[characterSelections[p]][t[1]].init(p,input);
    }
    else if (input[p][0].du) {
      actionStates[characterSelections[p]].APPEAL.init(p,input);
      return true;
    }
    // ftCo_Turn_IASA's dash-out (ftCo_Turn.c:129):
    //
    //   if (turn.just_turned && turn.x8)
    //       if (lstick[0].x * turn.facing_after >= dash_smash_stick_threshold)
    //           ftCo_Dash_Enter(gobj, 0);
    //
    // NOTE WHAT IS NOT THERE: any stick-recency term. Melee asks only that the
    // stick is HELD past 0.8 in the new direction on the frame the turn lands.
    //
    // This used checkForDash, which also demands
    // `stickTiltTimerX < DASH_SMASH_WINDOW` -- a fresh flick. That belongs to
    // ftCo_Dash_CheckInput, not here. By the time a smash turn lands, the
    // stick has usually been held for two frames or more, so the timer had
    // already run past the window and the dash-out silently failed, leaving
    // the fighter in SMASHTURN for its full 11 frames. That is the pivot
    // "stumping": it depended on exactly when the flick landed, so it worked
    // sometimes and stalled others.
    //
    // `turn.x8` is what separates the two turns. Turn_Enter_Smash sets it to
    // the old facing_dir (non-zero, so this test always passes), while
    // Turn_Enter_Basic sets it to 0 -- which is why a STANDING turn does still
    // need the flick, through fn_800C9C2C. TILTTURN keeps checkForDash for
    // that reason.
    else if (player[p].timer === 2
             && input[p][0].lsX * player[p].phys.face >= DASH_SMASH_STICK_THRESHOLD){
      actionStates[characterSelections[p]].DASH.init(p,input,true);
      return true;
    }
    else if (player[p].timer > 11){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
