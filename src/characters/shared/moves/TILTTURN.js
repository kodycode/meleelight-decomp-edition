import {checkForDash, checkForJump, checkForSmashes, checkForTilts, reduceByTraction, actionStates} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
import {ucfDashback} from "physics/ucf";
import {DASH_SMASH_STICK_THRESHOLD} from "physics/meleeCommon";
export default {
  name : "TILTTURN",
  canEdgeCancel : true,
  canBeGrabbed : true,
  disableTeeter : true,
  init : function(p,input){
    player[p].actionState = "TILTTURN";
    player[p].timer = 0;
    actionStates[characterSelections[p]].TILTTURN.main(p,input);
  },
  // The frame facing flips. ftCo_Turn_Enter_Basic (ftCo_Turn.c:64) seeds
  // frames_to_turn from co_attrs.standing_turn_frames, and
  // ftCo_Turn_Anim_Inner (:72) decrements it once per frame and flips
  // facing_dir on the call that finds it ALREADY at zero -- so the turn lands
  // one frame after the countdown, on standing_turn_frames + 1.
  //
  // This was hardcoded to 6. The attribute is not 6 for everyone: Marth and
  // Falcon are 6, Fox, Falco and Puff are 4, so three of the five turned two
  // frames late (and all five were a frame early against the +1).
  turnFrame : function(p){
    return player[p].charAttributes.standingTurnFrames + 1;
  },
  main : function(p,input){
    player[p].timer++;
    if (player[p].timer === actionStates[characterSelections[p]].TILTTURN.turnFrame(p)){
      player[p].phys.face *= -1;
    }
    if (!actionStates[characterSelections[p]].TILTTURN.interrupt(p,input)){
      reduceByTraction(p,true);
    }
  },
  interrupt : function(p,input){
    // UCF DASHBACK (dashback.cpp, Interrupt_AS_Turn+0x4C). Off unless the UCF
    // toggle is on. Every vanilla smash-turn condition still has to hold; this
    // only promotes a tilt turn that the stick's own travel says was a flick.
    if (ucfDashback(p, input, player[p].timer, player[p].phys.face,
                    player[p].phys.stickTiltTimerX, DASH_SMASH_STICK_THRESHOLD)){
      actionStates[characterSelections[p]].SMASHTURN.init(p,input);
      return true;
    }
    // ftCo_Turn_IASA (ftCo_Turn.c:98): while the turn has NOT landed yet, the
    // attack checks run against the flipped facing and it is flipped back
    // afterwards, so an attack started mid-turn comes out the new way. Same
    // "has_turned" test as the flip itself, so it has to use the same frame.
    const turned = player[p].timer >= actionStates[characterSelections[p]].TILTTURN.turnFrame(p);
    const t = turned ? checkForTilts(p,input) : checkForTilts(p,input, -1);
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
      if (!turned){
        player[p].phys.face *= -1;
      }
      actionStates[characterSelections[p]][t[1]].init(p,input);
    }
    else if (player[p].timer > 11){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else if (input[p][0].du) {
      actionStates[characterSelections[p]].APPEAL.init(p,input);
      return true;
    }
    // ftCo_Turn_IASA (ftCo_Turn.c:129) only dashes out while `just_turned` is
    // set, which is the single frame the turn lands on -- so this tracks the
    // flip frame rather than the 6 it used to be hardcoded to.
    else if (player[p].timer === actionStates[characterSelections[p]].TILTTURN.turnFrame(p)
             && checkForDash(p,input) && player[p].phys.dashbuffer){
      actionStates[characterSelections[p]].DASH.init(p,input,true);
      return true;
    }
    else {
      return false;
    }
  }
};
