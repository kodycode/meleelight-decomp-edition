import {checkForJump, shieldDepletion, playSounds, shieldTilt, reduceByTraction, actionStates, shieldSize} from "physics/actionStateShortcuts";
import {CSTICK_JUMP_THRESHOLD, PLATFORM_DROP_STICK_THRESHOLD, PLATFORM_DROP_WINDOW} from "physics/meleeCommon";
import {sounds} from "main/sfx";
import {characterSelections, player} from "main/main";
// UCF shield drop (shielddrop.S + shielddrop_extended.cpp); both are
// no-ops unless the UCF toggle is on.
import {spotDodgeThresholdY, ucfShieldDrop} from "physics/ucf";
import {framesData} from "../../../main/characters";
import {Vec2D} from "../../../main/util/Vec2D";
export default {
  name : "GUARDON",
  canEdgeCancel : true,
  canBeGrabbed : true,
  missfoot : true,
  init : function(p,input){
    player[p].actionState = "GUARDON";
    player[p].timer = 0;
    player[p].phys.shielding = true;
    player[p].phys.shieldPosition = new Vec2D(0,0);
    player[p].phys.powerShielded = false;
    shieldSize(p,true,input);
    if (Math.max(input[p][0].lA,input[p][0].rA) === 1){
      player[p].phys.powerShieldActive = true;
      player[p].phys.powerShieldReflectActive = true;
    }
    else {
      player[p].phys.powerShieldActive = false;
      player[p].phys.powerShieldReflectActive = false;
    }
    actionStates[characterSelections[p]].GUARDON.main(p,input);
  },
  main : function(p,input){
    if (player[p].hit.shieldstun > 0){
      reduceByTraction(p,true);
      shieldTilt(p,true,input);
    }
    else {
      player[p].timer++;
      playSounds("GUARDON",p);
      if (player[p].timer === 3){
        player[p].phys.powerShieldReflectActive = false;
      }
      if (player[p].timer === 5){
        player[p].phys.powerShieldActive = false;
      }
      /*if (player[p].timer == 2 && Math.max(input[p][0].lA,input[p][0].rA) == 1){
        player[p].phys.powerShieldActive = true;
      }*/
      if (!actionStates[characterSelections[p]].GUARDON.interrupt(p,input)){
        if (player[p].timer === 1){
          sounds.shieldup.play();
        }
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
      // ftCo_800DF644 (ft_0DF1.c:109): an upward c-stick CROSSING of x7F4.
      // 0.6625, and it is a crossing rather than a level test.
      if (j[0] || (input[p][0].csY >= CSTICK_JUMP_THRESHOLD && input[p][1].csY < CSTICK_JUMP_THRESHOLD)){
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
      // ftCo_80099F1C (ftCo_Pass.c:28), as in GUARD.js and SQUAT.js.
      else if (player[p].timer > 1 && (input[p][0].lsY <= -PLATFORM_DROP_STICK_THRESHOLD && player[p].phys.stickTiltTimerY < PLATFORM_DROP_WINDOW || ucfShieldDrop(p, input)) && player[p].phys.onSurface[0] === 1){
        player[p].phys.shielding = false;
        actionStates[characterSelections[p]].PASS.init(p,input);
        return true;
      }
      else if (player[p].timer > framesData[characterSelections[p]].GUARDON){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      if (player[p].timer > 8){
        actionStates[characterSelections[p]].GUARD.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
  }
};

