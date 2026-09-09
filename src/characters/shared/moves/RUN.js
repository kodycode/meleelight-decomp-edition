import {checkForJump, actionStates, runPhysics} from "physics/actionStateShortcuts";
import {X58_STICK_THRESHOLD, SPECIAL_STICK_Y_THRESHOLD} from "physics/meleeCommon";
import {sounds} from "main/sfx";
import {characterSelections, player} from "main/main";
import {framesData} from 'main/characters';
export default {
  name : "RUN",
  canEdgeCancel : true,
  canBeGrabbed : true,
  init : function(p,input){
    player[p].actionState = "RUN";
    player[p].timer = 1;
    actionStates[characterSelections[p]].RUN.main(p,input);
  },
  main : function(p,input){
    if (player[p].timer > framesData[characterSelections[p]].RUN){
      player[p].timer = 1;
    }
    if (!actionStates[characterSelections[p]].RUN.interrupt(p,input)){
      const footstep = [false, false];
      if (player[p].timer < 2){
        footstep[0] = true;
      }
      if (player[p].timer < 10){
        footstep[1] = true;
      }
      // ftCo_Run_Phys (ftCo_Run.c:130).
      //
      // Replaces a proportional-controller approximation with four problems:
      //  1. DIVIDE BY ZERO -- `dAccB / Math.abs(lsX)` yields Infinity when the
      //     stick is centred, poisoning cVel.x to NaN. Melee never divides by
      //     the stick.
      //  2. The `1/(dMaxV * 2.5)` gain was invented; the real taper is
      //     run_accel_taper_gain (0.4, PlCo.dat +0x5C), and it engages ONLY
      //     when gr_vel/target is strictly between 0 and 1.
      //  3. Melee's accel is open-loop -- lsX*dash_accel_mul plus a signed
      //     dash_accel_base -- not proportional to (target - v).
      //  4. Over-target was a hard snap to tempMax. Melee substitutes friction,
      //     clamps to land exactly on target, then clamps to
      //     ground_max_horizontal_velocity, all inside ftCommon_8007C98C.
      runPhysics(p, input);

      const time = ((player[p].phys.cVel.x * player[p].phys.face) / player[p].charAttributes.dMaxV) * player[p].charAttributes.runAnimSpeed;
      if (time > 0){
        player[p].timer += time;
      }
      if (player[p].timer > framesData[characterSelections[p]].RUN){
        player[p].timer = 1;
      }
      if ((footstep[0] && player[p].timer >= 2) || (footstep[1] && player[p].timer >= 10)){
        sounds.footstep.play();
      }
    }
  },
  interrupt : function(p,input){
    const j = checkForJump(p, input);
    if (input[p][0].a && !input[p][1].a){
      if (input[p][0].lA > 0 || input[p][0].rA > 0){
        // ftCo_800D8A38 (ftCo_Run.c:109) -> ftCo_MS_CatchDash. See DASH.js.
        actionStates[characterSelections[p]].CATCHDASH.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].ATTACKDASH.init(p,input);
      }
      return true;
    }
    else if (j[0]){
      actionStates[characterSelections[p]].KNEEBEND.init(p,j[1],input);
      return true;
    }
    else if (input[p][0].b && !input[p][1].b && Math.abs(input[p][0].lsX) > 0.6){
      player[p].phys.face = Math.sign(input[p][0].lsX);
      if (player[p].phys.grounded){
        actionStates[characterSelections[p]].SIDESPECIALGROUND.init(p,input);
      }
      else {
        actionStates[characterSelections[p]].SIDESPECIALAIR.init(p,input);
      }
      return true;
    }
    // The special-direction gate, x21C (ftCo_Attack100.c:57). 0.55.
    else if (input[p][0].b && !input[p][1].b && input[p][0].lsY < -SPECIAL_STICK_Y_THRESHOLD){
      actionStates[characterSelections[p]].DOWNSPECIALGROUND.init(p,input);
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
    else if (input[p][0].du) {
      actionStates[characterSelections[p]].APPEAL.init(p,input);
      return true;
    }
    // ftCo_RunBrake_CheckInput (ftCo_RunBrake.c:19): `|lstick[0].x| < x58`.
    // The SAME threshold that enters Run, so the two cannot both be true.
    else if (Math.abs(input[p][0].lsX) < X58_STICK_THRESHOLD){
      actionStates[characterSelections[p]].RUNBRAKE.init(p,input);
      return true;
    }
    else if (input[p][0].lsX * player[p].phys.face < -0.3){
      actionStates[characterSelections[p]].RUNTURN.init(p,input);
      return true;
    }
  }
};

