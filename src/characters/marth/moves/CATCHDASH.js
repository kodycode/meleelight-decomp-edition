import WAIT from "characters/shared/moves/WAIT";
import {player} from "main/main";
import {turnOffHitboxes, reduceByTraction, applyRootMotion} from "physics/actionStateShortcuts";
import {sounds} from "main/sfx";

// ftCo_MS_CatchDash -- the DASH GRAB.
//
// Melee has two grabs and they differ only in which motion state is entered:
//
//   ftCo_Catch_CheckInput  (ftCo_Catch.c:16)  -> ftCo_MS_Catch      30 frames
//   ftCo_800D8A38          (ftCo_Catch.c:38)  -> ftCo_MS_CatchDash  40 frames
//
// Both test `(held & HSD_PAD_LR) && (pressed & HSD_PAD_A)`. Dash_IASA
// (ftCo_Dash.c:91) and Run_IASA (ftCo_Run.c:109) reach the second; KneeBend's
// IASA reaches the first (ftCo_KneeBend.c:63). That difference IS the tech the
// community calls jump-cancel grab -- entering jumpsquat first buys the
// 30-frame grab instead of the 40-frame one. meleelight previously sent DASH,
// RUN and KNEEBEND all to the 30-frame GRAB, so a run grab was already a
// standing grab and jump cancelling bought nothing.
//
// Friction is PLAIN traction, not the above-walk-speed doubling. ftCo_
// CatchDash_Phys (ftCo_Catch.c:156) is ft_80085030 with
// `x64 * ground_friction`, and x64 is 1.0 on the disc -- so unlike Wait or
// Landing this state never doubles. It matters here more than anywhere,
// because a dash grab starts above walk speed by definition.
export default {
  name : "CATCHDASH",
  canEdgeCancel : false,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "CATCHDASH";
    player[p].timer = 0;
    player[p].phys.charging = false;
    player[p].phys.chargeFrames = 0;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.grabDash.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.grabDash.id1;
    player[p].hitboxes.id[2] = player[p].charHitboxes.grabDash.id2;
    this.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!this.interrupt(p,input)){
      // Puff's CatchDash carries x594_b0 and travels 21.6 units;
      // nobody else's does. applyRootMotion returns false when there is
      // no data, so friction stands for the other four.
      if (!applyRootMotion(p, "CATCHDASH")) {
        reduceByTraction(p,false);
      }
      // create_hitbox on Melee frame 9, terminate_all_hitboxes on 11
      // (tools/hitbox_timeline.py). meleelight's timer is one-based.
      if (player[p].timer === 10){
        player[p].hitboxes.active = [true,true,true,false];
        player[p].hitboxes.frame = 0;
        sounds.grab.play();
      }
      if (player[p].timer > 10 && player[p].timer < 12){
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 12){
        turnOffHitboxes(p);
      }
    }
  },
  interrupt : function(p,input){
    // 40 frames, from the CatchDash figatree header.
    if (player[p].timer > 40){
      WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
