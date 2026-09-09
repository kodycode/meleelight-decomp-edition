import {tiltTurnDashBuffer, checkForTiltTurn, checkForSmashTurn, checkForDash, checkForSquat, checkForJump,
    checkForSmashes
    , checkForTilts
    , checkForSpecials
    , reduceByTraction
    , actionStates
    , walkPhysics
} from "physics/actionStateShortcuts";
import {sounds} from "main/sfx";
import {characterSelections, player} from "main/main";
import {framesData} from 'main/characters';
export default {
  name : "WALK",
  canEdgeCancel : true,
  canBeGrabbed : true,
  init : function(p,addInitV,input){
    player[p].actionState = "WALK";
    player[p].timer = 1;
    // REMOVED: meleelight applied a `walkInitV` impulse on entering walk.
    // Melee does not. ftCo_Walk_Enter (ftCo_Walk.c:54) and
    // ftWalkCommon_800DFCA4 (ftwalkcommon.c:71) add no velocity impulse at all
    // -- walk velocity comes entirely from the per-frame accel in
    // ftWalkCommon_800E0060. `walkInitV` has no ftCo_DatAttrs counterpart; it
    // is a meleelight invention. The `addInitV` parameter is retained so the
    // call signature is unchanged for the ~dozen callers.
    void addInitV;
    actionStates[characterSelections[p]].WALK.main(p,input);
  },
  main : function(p,input){
    if (!actionStates[characterSelections[p]].WALK.interrupt(p,input)){
      const footstep = [false, false];
      if (player[p].timer < 5){
        footstep[0] = true;
      }
      if (player[p].timer < 15){
        footstep[1] = true;
      }

      // ftWalkCommon_800E0060 (ftwalkcommon.c:178). Replaces the previous
      // proportional-controller approximation, whose gain and `*2` were
      // invented and which applied 2x friction via reduceByTraction(p, true).
      walkPhysics(p, input);

      const time = ((player[p].phys.cVel.x * player[p].phys.face) / player[p].charAttributes.walkMaxV) * player[p].charAttributes.walkAnimSpeed;
      if (time > 0){
        player[p].timer += time;
      }
      if ((footstep[0] && player[p].timer >= 5) || (footstep[1] && player[p].timer >= 15)){
        sounds.footstep.play();
      }
    }
  },
  interrupt : function(p,input){
    const b = checkForSpecials(p,input);
    const t = checkForTilts(p,input);
    const s = checkForSmashes(p,input);
    const j = checkForJump(p,input);
    if (player[p].timer > framesData[characterSelections[p]].WALK){
      actionStates[characterSelections[p]].WALK.init(p,false,input);
      return true;
    }
    if (input[p][0].lsX === 0){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else if (j[0]){
      actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
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
    else if (b[0]){
      actionStates[characterSelections[p]][b[1]].init(p,input);
      return true;
    }
    else if (s[0]){
      actionStates[characterSelections[p]][s[1]].init(p,input);
      return true;
    }
    else if (t[0]){
      actionStates[characterSelections[p]][t[1]].init(p,input);
      return true;
    }
    else if (input[p][0].du) {
      actionStates[characterSelections[p]].APPEAL.init(p,input);
      return true;
    }
    else if (checkForSquat(p,input)){
      actionStates[characterSelections[p]].SQUAT.init(p,input);
      return true;
    }
    else if (checkForDash(p,input)){
      actionStates[characterSelections[p]].DASH.init(p,input);
      return true;
    }
    else if (checkForSmashTurn(p,input)){
      actionStates[characterSelections[p]].SMASHTURN.init(p,input);
      return true;
    }
    else if (checkForTiltTurn(p,input)){
      player[p].phys.dashbuffer = tiltTurnDashBuffer(p,input);
      actionStates[characterSelections[p]].TILTTURN.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
