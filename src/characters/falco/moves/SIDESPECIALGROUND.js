
import SIDESPECIALAIR from "characters/falco/moves/SIDESPECIALAIR";
import WAIT from "characters/shared/moves/WAIT";
import {articles} from "physics/article";
import {sounds} from "main/sfx";
import {turnOffHitboxes} from "physics/actionStateShortcuts";
import { player} from "main/main";
import {drawVfx} from "main/vfx/drawVfx";
import {getGroundVelocity, setGroundVelocity} from "physics/groundMovement";

export default {
  name : "SIDESPECIALGROUND",
  canPassThrough : false,
  canEdgeCancel : true,
  disableTeeter : true,
  canGrabLedge : [false,false],
  wallJumpAble : false,
  headBonk : false,
  canBeGrabbed : true,
  airborneState : "SIDESPECIALAIR",
  init : function(p,input){
    player[p].actionState = "SIDESPECIALGROUND";
    player[p].timer = 0;
    setGroundVelocity(p, 0);
    player[p].phys.landingMultiplier = 1.5;
    drawVfx({
      name: "dashDust",
      pos: player[p].phys.pos,
      face: player[p].phys.face
    });
    turnOffHitboxes(p);
    sounds.star.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      if (player[p].timer === 16){
        sounds.phantasm.play();
        sounds.phantasmshout.play();
      }

      if (player[p].timer === 17) {
        setGroundVelocity(p, 16.50*player[p].phys.face);
      }

      if (player[p].timer === 18){
        articles.ILLUSION.init({
          p: p,
          // `type` is the GROUNDED flag -- article.js:155 `if (type)` picks the
          // grounded knockback. This said 0, so the grounded Phantasm was
          // dealt the aerial values. Fox's grounded copy has always passed 1.
          type: 1,
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
        setGroundVelocity(p, 1.5*player[p].phys.face);
      }
      if (player[p].timer > 20){
        setGroundVelocity(p, getGroundVelocity(p) - (0.1*player[p].phys.face));
        if (player[p].phys.cVel.x*player[p].phys.face < 0) {
          setGroundVelocity(p, 0);
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
    if (player[p].timer > 59){
      WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
