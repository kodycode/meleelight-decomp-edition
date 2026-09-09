import {checkForSmashTurn, checkForDash, checkForJump, reduceByTraction, actionStates, dashEnterImpulse, dashPhysics, dashIASADecay} from "physics/actionStateShortcuts";
import {X58_STICK_THRESHOLD, DASH_REDASH_FRAME, DASH_SMASH_BLOCK_FRAME} from "physics/meleeCommon";
import { characterSelections, player} from "main/main";
import {sounds} from "main/sfx";

import {framesData} from 'main/characters';
import {drawVfx} from "main/vfx/drawVfx";
export default {
  name : "DASH",
  canEdgeCancel : true,
  disableTeeter : true,
  canBeGrabbed : true,
  // `fromTurn` is Melee's ftCo_Dash_Enter arg1, stored as mv.co.dash.x4
  // (ftCo_Dash.c:49). ftCo_Dash_CheckInput enters with 1; the dash OUT OF A
  // TURN, ftCo_Turn_IASA (ftCo_Turn.c:133), enters with 0. The value decides
  // whether ftCo_Dash_IASA takes its first branch:
  //
  //     if ((fp->mv.co.dash.x4 != 0) && (fp->cur_anim_frame <= x44))
  //
  // which falls through to block_42 and SKIPS ftCo_Dash_CheckInput -- so no
  // smash turn. x44 is 4.0 on the disc, which is where meleelight's
  // `timer > 4` came from; but that gate was applied to EVERY dash. A dash out
  // of a pivot has x4 == 0, so in Melee it can pivot again immediately.
  // Forcing four frames there is what made dash dancing feel sluggish: each
  // pivot was delayed, so the next one happened at higher speed, where the
  // entry impulse cancels the old momentum almost exactly.
  init : function(p,input,fromTurn){
    player[p].actionState = "DASH";
    player[p].timer = 0;
    player[p].phys.dashCheckInputEntry = fromTurn ? 0 : 1;
    // ftCo_Dash_Enter (ftCo_Dash.c:49). The dash impulse is a DELTA computed
    // ON ENTRY -- (init_vel - gr_vel), or the full init_vel only when already
    // moving backwards relative to facing. meleelight previously added a flat
    // dInitV on frame 2 and clamped to dMaxV; all three of those were wrong.
    dashEnterImpulse(p);
    sounds.dash.play();
    actionStates[characterSelections[p]].DASH.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    if (!actionStates[characterSelections[p]].DASH.interrupt(p,input)){
      if (player[p].timer === 4){
        drawVfx({
          name: "dashDust",
          pos: player[p].phys.pos,
          face: player[p].phys.face
        });
      }
      // ftCo_Dash_Phys (ftCo_Dash.c:145).
      //
      // Replaces a block with four defects:
      //  1. DOUBLE-APPLY BUG -- tempAcc was added at the top AND again in the
      //     else branch, so under-target frames got 2x acceleration.
      //  2. dAccB (dash_accel_base) was never used at all; Melee's accel is
      //     lsX*dash_accel_mul + sign(lsX)*dash_accel_base.
      //  3. It clamped to dMaxV. Melee clamps to ground_max_horizontal_velocity
      //     inside ftCommon_8007C98C -- a different, larger attribute.
      //  4. The 0.3 deadzone branch was fabricated; Melee routes lsX == 0 to
      //     friction via target_vel == 0 inside ftCommon_8007C98C.
      //
      // NO TAIL DECAY HERE. ftCo_Dash.c:138 looks like a per-frame decay but
      // an ordinary dash frame never reaches it: block_42 (ftCo_Dash.c:127)
      // ends in an unconditional `return`, and every RETURN_IF before it also
      // leaves. The decay is only reached on frames where a transition fired
      // -- the pivot and the re-dash -- so it is applied in those two branches
      // of interrupt() instead. Running it every frame decays gr_vel by 75% a
      // frame and makes dashes start slow and stay slow.
      dashPhysics(p, input);
    }
  },
  // Dash interrupts do NOT cut momentum. meleelight used to scale velocity to
  // 25% when dashing into shield, forward smash or smash turn. Melee has no
  // such step -- each target state simply runs ordinary ground friction:
  //
  //   dash -> shield      ftCo_GuardOn_Phys calls ft_80084F3C (ftCo_Guard.c:481)
  //   dash -> fsmash      ftCo_AttackS4 doEnter only sets flags and the motion
  //                       state (ftCo_AttackS4.c:170)
  //   dash -> smash turn  ftCo_Turn_Enter_Smash likewise (ftCo_Turn.c:173)
  //
  // and meleelight's GUARDON, FORWARDSMASH and SMASHTURN all already call
  // reduceByTraction, which IS ft_80084F3C. So the 0.25 was an extra cut on
  // top of friction, and dropping it restores the slide these transitions are
  // supposed to keep -- notably smash turn, where preserving dash momentum is
  // what makes pivoting work at all.
  interrupt : function(p,input){
    const j = checkForJump(p,input);
    // GRAB BEFORE SHIELD. Every branch of ftCo_Dash_IASA reaches
    // ftCo_800D8A38 -- the DASH grab (ftCo_Dash.c:91, 105, 121) -- before it
    // can reach ftCo_80091A4C, the shield check (ftCo_Dash.c:126, via
    // block_42). Melee's Z sets HSD_PAD_LR *and* HSD_PAD_A together
    // (fighter.c:1895), so with the shield tested first the dash grab was
    // unreachable: pressing Z out of a dash shielded, and the shield's own
    // ftCo_Catch_CheckInput then handed back the STANDING grab -- i.e. the
    // jump cancel's entire payoff, for free, from the one input the tech
    // exists to work around.
    if (input[p][0].a && !input[p][1].a
        && (input[p][0].lA > 0 || input[p][0].rA > 0)){
      actionStates[characterSelections[p]].CATCHDASH.init(p,input);
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
    else if (input[p][0].a && !input[p][1].a){
      if (player[p].timer < 4 && input[p][0].lsX*player[p].phys.face >= 0.8){
        actionStates[characterSelections[p]].FORWARDSMASH.init(p,input);
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
    else if (input[p][0].du) {
      actionStates[characterSelections[p]].APPEAL.init(p,input);
      return true;
    }
    // ftCo_Dash_IASA's first branch only blocks the smash turn when the dash
    // was entered from Dash_CheckInput (x4 != 0) AND is still within x44 = 4
    // frames. A dash entered from a turn skips that branch entirely.
    else if ((player[p].phys.dashCheckInputEntry === 0 || player[p].timer > DASH_SMASH_BLOCK_FRAME)
             && checkForSmashTurn(p,input)){
      // THE PIVOT DECAY. ftCo_Dash_IASA's branch 2 (ftCo_Dash.c:110) reads
      //
      //     if (!(lstick.x * facing_dir < 0) || !ftCo_Dash_CheckInput(gobj))
      //
      // so when the pivot SUCCEEDS the condition is false, the inner block is
      // skipped, and execution falls out of the if/else chain into the tail
      // decay at ftCo_Dash.c:138 -- gr_vel is cut to a quarter on the very
      // frame the smash turn is entered, before Turn_Phys's friction.
      //
      // Without it the pivot cancelled instead of reversing: entering
      // ftCo_Dash_Enter at gr_vel 1.92 with an impulse of -1.9 lands on 0.02,
      // a dead stop. With it, gr_vel is ~0.48 first, so the same impulse
      // carries the fighter to about -1.4 and the momentum actually goes the
      // new way.
      dashIASADecay(p);
      actionStates[characterSelections[p]].SMASHTURN.init(p,input);
      return true;
    }
    // Same-direction re-dash. ftCo_Dash_IASA only reaches this from branch 3
    // (ftCo_Dash.c:118), past cur_anim_frame x4C = 20; branch 2 short-circuits
    // ftCo_Dash_CheckInput unless the stick opposes the facing, so up to frame
    // 20 a flick can only pivot, never re-dash.
    //
    // The boundary is GLOBAL. This used a per-character `dashFrameMax` equal
    // to framesData.DASH - 1, which opened the re-dash only on the dash's very
    // last frame -- frame 22 for Fox, but frame 29 for Falcon and 28 for
    // Marth, against 21 for everyone in Melee. The heavier characters were
    // losing most of their re-dash window.
    else if (player[p].timer > DASH_REDASH_FRAME && checkForDash(p,input)){
      // Branch 3 falls through to the same tail decay when Dash_CheckInput
      // succeeds, so a same-direction re-dash gets it too.
      dashIASADecay(p);
      actionStates[characterSelections[p]].DASH.init(p,input);
      return true;
    }
    // fn_800CA5F0 (ftCo_Run.c:22): `lstick[0].x * facing_dir >= x58`.
    // 0.625, and the comparison is >=, not >.
    else if (player[p].timer > player[p].charAttributes.dashFrameMin && input[p][0].lsX * player[p].phys.face >= X58_STICK_THRESHOLD){
      actionStates[characterSelections[p]].RUN.init(p,input);
      return true;
    }
    else if (player[p].timer > framesData[characterSelections[p]].DASH){
      actionStates[characterSelections[p]].WAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};
