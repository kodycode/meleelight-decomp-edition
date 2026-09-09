import {checkForSpecials, checkForAerials, checkForDoubleJump, airDrift, fastfall, playSounds, actionStates, applyJumpVelocity} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
import {sounds} from "main/sfx";
import {framesData} from 'main/characters';
export default {
  name : "JUMPF",
  canPassThrough : true,
  canGrabLedge : [true,false],
  wallJumpAble : true,
  headBonk : true,
  canBeGrabbed : true,
  landType : 0,
  vCancel : true,
  init : function(p,type,input){
    player[p].actionState = "JUMPF";
    player[p].timer = 0;
    // ftCo_800CB110 (ftCo_Jump.c:102); jump_mul is 1.0 for a normal jump,
    // as passed by ftCo_Jump_Enter (ftCo_Jump.c:165).
    applyJumpVelocity(p, !!type, 1.0, input);

    player[p].phys.grounded = false;
    sounds.jump2.play();
    actionStates[characterSelections[p]].JUMPF.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    playSounds("JUMP",p);
    if (!actionStates[characterSelections[p]].JUMPF.interrupt(p,input)){
      if (player[p].timer > 1){
        fastfall(p,input);
        airDrift(p,input);
      }
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
      // Runs on the entry frame too -- ftCo_Jump_IASA:187 is reached the same
      // frame KneeBend_Anim enters JumpF, because Anim and IASA are separate
      // GObj proc passes (fighter.c:898,900). Holding UP does not double jump
      // here because applyJumpVelocity stamped stickTiltTimerY expired; a
      // pressed X still does, which is Melee.
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
    else if (player[p].timer > framesData[characterSelections[p]].JUMPF){
      actionStates[characterSelections[p]].FALL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

