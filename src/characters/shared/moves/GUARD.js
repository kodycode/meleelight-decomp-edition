import {checkForJump, shieldSize, shieldDepletion, shieldTilt, reduceByTraction, actionStates} from "physics/actionStateShortcuts";
import {PLATFORM_DROP_STICK_THRESHOLD, PLATFORM_DROP_WINDOW} from "physics/meleeCommon";
import {characterSelections, player} from "main/main";
// UCF shield drop (shielddrop.S + shielddrop_extended.cpp); both are
// no-ops unless the UCF toggle is on.
import {spotDodgeThresholdY, ucfShieldDrop} from "physics/ucf";
export default {
  name : "GUARD",
  canEdgeCancel : true,
  canBeGrabbed : true,
  missfoot : true,
  init : function(p,input){
    player[p].actionState = "GUARD";
    player[p].timer = 0;
    player[p].phys.powerShieldActive = false;
    player[p].phys.powerShieldReflectActive = false;
    actionStates[characterSelections[p]].GUARD.main(p,input);
  },
  main : function(p,input){
    if (player[p].hit.shieldstun > 0){
      reduceByTraction(p,true);
      shieldTilt(p,true,input);
    }
    else {
      player[p].timer++;
      if (!actionStates[characterSelections[p]].GUARD.interrupt(p,input)){
        if (!player[p].inCSS){
          reduceByTraction(p,true);
          shieldDepletion(p,input);
        }
        shieldTilt(p,false,input);
        shieldSize(p,null,input);
      }
    }
  },
  interrupt : function(p,input){
    if (!player[p].inCSS){
      const j = checkForJump(p, input);
      if (j[0] || input[p][0].csY > 0.66){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
        return true;
      }
      else if (input[p][0].a && !input[p][1].a){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GRAB.init(p,input);
        return true;
      }
      else if ((input[p][0].lsY < spotDodgeThresholdY(p, input, player[p].phys.stickTiltTimerX) && input[p][4].lsY > -0.3) || input[p][0].csY < -0.7){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].ESCAPEN.init(p,input);
        return true;
      }
      else if ((input[p][0].lsX*player[p].phys.face > 0.7 && input[p][4].lsX*player[p].phys.face < 0.3) || input[p][0].csX*player[p].phys.face > 0.7){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].ESCAPEF.init(p,input);
        return true;
      }
      else if ((input[p][0].lsX*player[p].phys.face < -0.7 && input[p][4].lsX*player[p].phys.face > -0.3) || input[p][0].csX*player[p].phys.face < -0.7){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].ESCAPEB.init(p,input);
        return true;
      }
      // ftCo_80099F1C (ftCo_Pass.c:28): `lsY <= -x464 && tiltTimerY < x468
      // && IsOnPlatform`. 0.66 with a SIX frame window; meleelight used 0.65
      // with a fixed six-frame lookback, which is the same idea but only
      // samples one frame of the six.
      else if ((input[p][0].lsY <= -PLATFORM_DROP_STICK_THRESHOLD && player[p].phys.stickTiltTimerY < PLATFORM_DROP_WINDOW || ucfShieldDrop(p, input)) && player[p].phys.onSurface[0] === 1){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].PASS.init(p,input);
        return true;
      }
      else if (input[p][0].lA < 0.3 && input[p][0].rA < 0.3){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GUARDOFF.init(p,input);
        return true;
      }
      else if (player[p].timer > 1){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      if (input[p][0].lA < 0.3 && input[p][0].rA < 0.3){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].GUARDOFF.init(p,input);
        return true;
      }
      else if (player[p].timer > 1){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
  }
};

