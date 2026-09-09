
import WAIT from "characters/shared/moves/WAIT";
import { player} from "main/main";
import {sounds} from "main/sfx";
import {reduceByTraction, turnOffHitboxes, applyRootMotion} from "physics/actionStateShortcuts";
import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../../../main/util/Vec2D";

import {setGroundVelocity} from "physics/groundMovement";
export default {
  name : "NEUTRALSPECIALGROUND",
  canPassThrough : false,
  canEdgeCancel : false,
  disableTeeter : true,
  canBeGrabbed : true,
  airborneState : "NEUTRALSPECIALAIR",
  init : function(p,input){
    player[p].actionState = "NEUTRALSPECIALGROUND";
    player[p].timer = 0;
    setGroundVelocity(p, 0);
    player[p].hitboxes.id[0] = player[p].charHitboxes.falconpunchair.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.falconpunchair.id1;
    player[p].hitboxes.id[2] = player[p].charHitboxes.falconpunchair.id2;
    sounds.falconpunchshout1.play();
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // The WHOLE state, from the disc. ftCa_SpecialN_Phys
      // (ftcaptainspecialn.c:174) is ft_80084FA8 -> ft_80085030, so gr_vel is
      // the animation's TransN delta on every frame -- not just from 54.
      //
      // Two things this fixes. The windup slides -7.37 units back and +7.37
      // forward again over frames 16-54; none of that was modelled, so the
      // punch had no wind-up drift at all. And the part that WAS modelled sat
      // a frame late: `setVelocities[timer-54]` put the disc's frame-54 value
      // on timer 54, where Melee's cur_anim_frame is timer-1.
      applyRootMotion(p, "NEUTRALSPECIALGROUND");
      if (player[p].timer === 52){
        player[p].hitboxes.active = [true,true,true,false];
        player[p].hitboxes.frame = 0;
        sounds.falconpunchshout2.play();
        sounds.falconpunchbird.play();
        sounds.firemediumhit.play();
      }
      if (player[p].timer > 52 && player[p].timer < 57){
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 57){
        turnOffHitboxes(p);
      }
      if (player[p].timer >= 52 && player[p].timer < 57) {
        drawVfx({
          name: "firefoxtail",
          pos: new Vec2D(player[p].phys.pos.x+(player[p].hitboxes.id[0].offset[player[p].hitboxes.frame].x+2)*player[p].phys.face,player[p].phys.pos.y+player[p].hitboxes.id[0].offset[player[p].hitboxes.frame].y-3),
          face: player[p].phys.face
        });
      }
      if (player[p].timer === 50) {
        drawVfx({
          name: "falconpunch",
          pos: player[p].phys.pos,
          face: player[p].phys.face,
          f: p
        });
      }
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > 99){
      WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
