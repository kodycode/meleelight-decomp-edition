import {reduceByTraction, actionStates} from "physics/actionStateShortcuts";
import {TAP_JUMP_RELEASE_THRESHOLD, SPECIAL_STICK_Y_THRESHOLD} from "physics/meleeCommon";
import {characterSelections, player} from "main/main";
export default {
  name : "KNEEBEND",
  canEdgeCancel : true,
  disableTeeter : true,
  canBeGrabbed : true,
  init : function(p,type,input){
    player[p].actionState = "KNEEBEND";
    player[p].timer = 0;
    player[p].phys.jumpType = 1;
    player[p].phys.jumpSquatType = type;
    actionStates[characterSelections[p]].KNEEBEND.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].KNEEBEND.interrupt(p,input)){
      reduceByTraction(p,true);
      // ftCo_KneeBend_Check_ShortHop (ftCo_KneeBend.c:44): the test uses
      // tap_jump_RELEASE_threshold, which is 0.3 -- NOT the 0.6625 that
      // started the jump, and nothing like the 0.67 that was here. You have to
      // let the stick most of the way back to centre to short hop off a tap
      // jump; releasing to 0.5 still gives a full hop.
      //
      // The branch on which input started the jumpsquat is Melee's own
      // (mv.co.kneebend.jump_input), and it already matched.
      if (player[p].phys.jumpSquatType){
        if (input[p][0].lsY < TAP_JUMP_RELEASE_THRESHOLD){
          player[p].phys.jumpType = 0;
        }
      }
      // else if jumpsquat initiated by button
      else {
        if (!input[p][0].x && !input[p][0].y){
          player[p].phys.jumpType = 0;
        }
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer === player[p].charAttributes.jumpSquat){
      // so they can be detected as above current surface instantly
      player[p].phys.pos.y += 0.001;
    }
    if (player[p].timer > player[p].charAttributes.jumpSquat){
      if (input[p][2].lsX * player[p].phys.face >= -0.3){
        actionStates[characterSelections[p]].JUMPF.init(p,player[p].phys.jumpType,input);
      }
      else {
        actionStates[characterSelections[p]].JUMPB.init(p,player[p].phys.jumpType,input);
      }
      return true;
    }
    else if (input[p][0].a && !input[p][1].a && (input[p][0].lA > 0 || input[p][0].rA > 0)){
      actionStates[characterSelections[p]].GRAB.init(p,input);
      return true;
    }
    else if ((input[p][0].a && !input[p][1].a && input[p][0].lsY >= 0.8 && input[p][3].lsY < 0.3) || (input[p][0].csY >= 0.8 && input[p][3].csY < 0.3)){
      actionStates[characterSelections[p]].UPSMASH.init(p,input);
      return true;
    }
    // The special-direction gate, x21C (ftCo_Attack100.c:80). 0.55.
    else if (input[p][0].b && !input[p][1].b && input[p][0].lsY >= SPECIAL_STICK_Y_THRESHOLD){
      actionStates[characterSelections[p]].UPSPECIAL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
