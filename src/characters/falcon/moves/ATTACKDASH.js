
import MOVES from "characters/falcon/moves/index";
import GRAB from "characters/falcon/moves/GRAB";
import KNEEBEND from "characters/shared/moves/KNEEBEND";
import DASH from "characters/shared/moves/DASH";
import SMASHTURN from "characters/shared/moves/SMASHTURN";
import TILTTURN from "characters/shared/moves/TILTTURN";
import WALK from "characters/shared/moves/WALK";
import WAIT from "characters/shared/moves/WAIT";
import {player} from "main/main";
import {turnOffHitboxes, checkForSpecials, checkForTilts, checkForSmashes, checkForJump, checkForDash,
    checkForSmashTurn
    , checkForTiltTurn
    , tiltTurnDashBuffer, applyRootMotion} from "physics/actionStateShortcuts";
import {sounds} from "main/sfx";
import {setGroundVelocity} from "physics/groundMovement";

export default {
  name : "ATTACKDASH",
  canEdgeCancel : false,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "ATTACKDASH";
    player[p].timer = 0;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.dashattackClean.id0;
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){

      // gr_vel = x6A4_transNOffset.z * facing_dir, straight off the disc
      // (ft_084E.c:83, via ftCo_AttackDash_Phys -> ft_80085030). The hand
      // tables were copied between characters: Falco's used Fox's and fell
      // 5.6 units short, and Falcon's was two flat constants.
      applyRootMotion(p, "ATTACKDASH");

      if (player[p].timer === 7){
        player[p].hitboxes.active = [true,false,false,false];
        player[p].hitboxes.frame = 0;
        sounds.normalswing2.play();
      }
      if (player[p].timer > 7 && player[p].timer < 17){
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 10){
        player[p].hitboxes.id[0] = player[p].charHitboxes.dashattackLate.id0;
        player[p].hitboxes.frame = 0;
      }
      if (player[p].timer === 17){
        turnOffHitboxes(p);
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 39){
      WAIT.init(p,input);
      return true;
    }
    else if (player[p].timer < 5 && (input[p][0].lA > 0 || input[p][0].rA > 0)){
      if (player[p].phys.cVel.x*player[p].phys.face > player[p].charAttributes.dMaxV){
        setGroundVelocity(p, player[p].charAttributes.dMaxV*player[p].phys.face);
      }
      GRAB.init(p,input);
      return true;
    }
    else if (player[p].timer > 37){
      const b = checkForSpecials(p,input);
      const t = checkForTilts(p,input);
      const s = checkForSmashes(p,input);
      const j = checkForJump(p,input);
      if (j[0]){
        KNEEBEND.init(p,j[1],input);
        return true;
      }
      else if (b[0]){
        MOVES[b[1]].init(p,input);
        return true;
      }
      else if (s[0]){
        MOVES[s[1]].init(p,input);
        return true;
      }
      else if (t[0]){
        MOVES[t[1]].init(p,input);
        return true;
      }
      else if (checkForDash(p,input)){
        DASH.init(p,input);
        return true;
      }
      else if (checkForSmashTurn(p,input)){
        SMASHTURN.init(p,input);
        return true;
      }
      else if (checkForTiltTurn(p,input)){
        player[p].phys.dashbuffer = tiltTurnDashBuffer(p,input);
        TILTTURN.init(p,input);
        return true;
      }
      else if (Math.abs(input[p][0].lsX) > 0.3){
        WALK.init(p,true,input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }
};
