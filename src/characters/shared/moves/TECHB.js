import {executeIntangibility, actionStates, playSounds, applyRootMotion} from "physics/actionStateShortcuts";
import {characterSelections,  player} from "main/main";
import {sounds} from "main/sfx";
import {framesData} from 'main/characters';
import {drawVfx} from "main/vfx/drawVfx";
import {setGroundVelocity} from "physics/groundMovement";
export default {
  name : "TECHB",
  canEdgeCancel : false,
  canBeGrabbed : true,
  setVelocities : [],
  init : function(p,input){
    player[p].actionState = "TECHB";
    player[p].timer = 0;
    drawVfx({
      name: "tech",
      pos: player[p].phys.pos
    });
    sounds.tech.play();
    actionStates[characterSelections[p]].TECHB.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    playSounds("TECH",p);
    if (!actionStates[characterSelections[p]].TECHB.interrupt(p,input)){
      executeIntangibility("TECHB",p);
      // gr_vel = x6A4_transNOffset.z * facing_dir, off the disc. TECH* reaches
      // it through ftCo_PassiveStand_Phys (ftCo_PassiveStand.c:58) ->
      // ft_80084FA8 -> ft_80085030; DOWNSTAND* through the same reader. Note
      // this is NOT ftCo_Passive_Phys, the neutral tech, which is plain
      // ft_80084F3C and does not move the fighter at all.
      //
      // The hand tables had the right TOTAL but the wrong CURVE for Fox, Falco
      // and Falcon: the disc ramps the tech roll UP (Fox frames 9-16 go 0.686
      // -> 2.207) where the hand table ramped it DOWN (2.560 -> 2.070), a mean
      // 0.32 units/frame apart and 1.28 at the peak. Marth and Puff were
      // already exact. They also sat one frame early, the same lead the dash
      // attack tables had -- Melee clears transNOffset on state entry
      // (fighter.c:1277) so there is no movement on the first frame.
      if (!applyRootMotion(p, "TECHB")) {
        setGroundVelocity(p, actionStates[characterSelections[p]].TECHB.setVelocities[player[p].timer-1]*player[p].phys.face);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > framesData[characterSelections[p]].TECHB){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

