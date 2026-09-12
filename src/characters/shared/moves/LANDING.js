import {tiltTurnDashBuffer, checkForTiltTurn, checkForSmashTurn, checkForDash, checkForJump, checkForSmashes,
    checkForTilts
    , checkForSpecials
    , reduceByTraction
    , actionStates
} from "physics/actionStateShortcuts";
import {characterSelections, player} from "main/main";
import {sounds} from "main/sfx";
import {drawVfx} from "main/vfx/drawVfx";
export default {
  name : "LANDING",
  canEdgeCancel : true,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "LANDING";
    player[p].timer = 0;
    drawVfx({
      name: "impactLand",
      pos: player[p].phys.pos,
      face: player[p].phys.face
    });
    drawVfx({
      name: "circleDust",
      pos: player[p].phys.pos,
      face: player[p].phys.face
    });
    sounds.land.play();
    actionStates[characterSelections[p]].LANDING.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].LANDING.interrupt(p,input)){
      reduceByTraction(p,true);
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 4 && player[p].timer <= 30){
      const b = checkForSpecials(p,input);
      const t = checkForTilts(p,input);
      const s = checkForSmashes(p,input);
      const j = checkForJump(p,input);
      // GRAB OUT OF LANDING LAG. ftCo_Landing_IASA (ftCo_Landing.c:122) runs
      //
      //   RETURN_IF(cur_anim_frame < normal_landing_lag);   // 4.0, all five
      //   RETURN_IF(!mv.co.landing.allow_interrupt);
      //   RETURN_IF(ftCo_SpecialS_CheckInput(gobj));
      //   RETURN_IF(ftCo_Attack100_CheckInput(gobj));
      //   RETURN_IF(ftCo_800D6824(gobj));                   // SpecialN
      //   RETURN_IF(ftCo_800D68C0(gobj));                   // SpecialLw
      //   RETURN_IF(ftCo_Catch_CheckInput(gobj));           // <-- was missing
      //   ... smashes, tilts, jab, shield, taunt, jump, dash, squat, turn, walk
      //
      // so the grab sits between the specials and the smashes, and it was
      // absent here entirely: landing lag was the one grounded state you could
      // not grab out of. Pressing Z fell through to the shield branch below,
      // which reaches the grab a frame later through GUARDON's own catch check.
      if (input[p][0].a && !input[p][1].a
          && (input[p][0].lA > 0 || input[p][0].rA > 0)){
        actionStates[characterSelections[p]].GRAB.init(p,input);
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
      else if (Math.abs(input[p][0].lsX) > 0.3){
        actionStates[characterSelections[p]].WALK.init(p,true,input);
        return true;
      }
      else if (player[p].timer === 5 && input[p][0].lsY < -0.5){
        actionStates[characterSelections[p]].SQUATWAIT.init(p,input);
        return true;
      }
      else {
        return false;
      }
    }
    else if (player[p].timer > 30){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
