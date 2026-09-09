import FALLSPECIAL from "characters/shared/moves/FALLSPECIAL";
import LANDINGFALLSPECIAL from "characters/shared/moves/LANDINGFALLSPECIAL";
import {articles} from "physics/article";
import {sounds} from "main/sfx";
import {turnOffHitboxes} from "physics/actionStateShortcuts";
import { player} from "main/main";
import {drawVfx} from "main/vfx/drawVfx";

export default {
  name : "SIDESPECIALAIR",
  canPassThrough : false,
  canEdgeCancel : false,
  canGrabLedge : [true,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  landType : 1,
  init : function(p,input){
    player[p].actionState = "SIDESPECIALAIR";
    player[p].timer = 0;
    player[p].phys.cVel.x *= 0.667;
    player[p].phys.cVel.y = 0;
    player[p].phys.landingMultiplier = 1.5;
    drawVfx({
      name:"dashDust",
      pos:player[p].phys.pos,
      face:player[p].phys.face
    });
    turnOffHitboxes(p);
    sounds.star.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // NO GRAVITY, for the WHOLE state. ftFx_SpecialAirS_Phys
      // (ftfoxspecials.c:362) is ft_80085134 (ft_084E.c:119), which runs every
      // frame and does exactly:
      //
      //     self_vel.x = x6A4_transNOffset.z * facing_dir;
      //     self_vel.y = x6A4_transNOffset.y;
      //
      // and SpecialAirS carries ZERO vertical root motion -- the TransN deltas
      // off the disc give max|dy| = 0.000 for both Fox and Falco. So the
      // illusion travels dead flat until the state ends.
      //
      // What was here let gravity run INSIDE the state at -0.08 per frame from
      // 25, dropping Falco 18.5 units while still dashing forward. That is the
      // downward slope this move had off a ledge.
      player[p].phys.cVel.y = 0;
      if (player[p].timer <= 15){
        if (player[p].phys.cVel.x !== 0){
          const dir = Math.sign(player[p].phys.cVel.x);
          player[p].phys.cVel.x -= dir*0.05;
          if (player[p].phys.cVel.x*dir < 0){
            player[p].phys.cVel.x = 0;
          }
        }
      }

      if (player[p].timer === 16){
        sounds.phantasm.play();
        sounds.phantasmshout.play();
      }

      if (player[p].timer === 17) {
        player[p].phys.cVel.x = 16.50*player[p].phys.face;
      }

      if (player[p].timer === 18){
        articles.ILLUSION.init({
          p: p,
          type: 0,
          isFox: false
        });
        if ((input[p][0].b || input[p][1].b) && !input[p][2].b){
          player[p].timer = 20;
        }
      }
      else if (player[p].timer >= 16 && player[p].timer < 20){
        if (input[p][0].b && !input[p][1].b){
          player[p].timer = 20;
        }
      }
      if (player[p].timer === 20){
        player[p].phys.cVel.x = 2*player[p].phys.face;
      }
      if (player[p].timer > 20){
        player[p].phys.cVel.x -= 0.07*player[p].phys.face;
        if (player[p].phys.cVel.x*player[p].phys.face < 0){
          player[p].phys.cVel.x = 0;
        }
      }

      if (player[p].timer >= 18 && player[p].timer <= 21){
        drawVfx({
          name:"phantasm",
          pos:player[p].phys.posPrev,
          face:player[p].phys.face
        });
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 58){
      FALLSPECIAL.init(p,input);
      return true;
    }
    else {
      return false;
    }
  },
  land : function(p,input){
    if (player[p].timer >= 20){
      LANDINGFALLSPECIAL.init(p,input);
    }
    else {
      player[p].actionState = "SIDESPECIALGROUND";
    }
  }
};
