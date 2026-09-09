import {player} from "../../../main/main";
import {turnOffHitboxes, reduceByTraction, applyGravity, applyFrictionAir} from "../../../physics/actionStateShortcuts";
import puff from "./index";
import {Vec2D} from "../../../main/util/Vec2D";
import {drawVfx} from "../../../main/vfx/drawVfx";
import {sounds} from "../../../main/sfx";
import WAIT from "../../shared/moves/WAIT";
import FALLSPECIAL from "../../shared/moves/FALLSPECIAL";
export default {
  name: "UPSPECIAL",
  canPassThrough: true,
  canGrabLedge: [true, true],
  wallJumpAble: false,
  headBonk: false,
  canBeGrabbed: true,
  landType: 1,
  init: function (p, input) {
    player[p].actionState = "UPSPECIAL";
    player[p].timer = 0;
    //23
    //71
    //122
    // Entering Sing touches NO velocity in Melee. ftPr_SpecialHi_Enter
    // (ftpurinspecialhi.c:51) and ftPr_SpecialAirHi_Enter (:59) both do only
    // ftPurin_SpecialHi_SetActionFromFacingDirection, ftAnim_8006EBA4 and
    // ftPurin_SpecialHi_SetVars, and SetVars (:23) sets cmd_vars, a callback
    // and a stadium flag -- nothing else. All movement is in the Phys
    // callbacks, which main() below now mirrors.
    //
    // REMOVED here: a grounded `cVel.x -= 0.1` decay with no counterpart
    // anywhere in the game, and an airborne terminal-velocity clamp that
    // ftCommon_Fall already applies every frame in main().
    //
    // The grounded decay was also a write straight to cVel.x while GROUNDED,
    // which skips the floor projection -- wrong on any slope even if the 0.1
    // had been real.
    player[p].phys.fastfalled = false;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.upb.id0;
    puff.UPSPECIAL.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!puff.UPSPECIAL.interrupt(p, input)) {
      if (player[p].timer === 23) {
        drawVfx({
          name: "sing",
          pos: new Vec2D(0, 0),
          face: p
        });
      }
      else if (player[p].timer === 71) {
        drawVfx({
          name: "sing2",
          pos: new Vec2D(0, 0),
          face: p
        });
      }
      else if (player[p].timer === 122) {
        drawVfx({
          name: "sing3",
          pos: new Vec2D(0, 0),
          face: p
        });
      }
      // ftPr_SpecialHi_Phys / ftPr_SpecialAirHi_Phys (ftpurinspecialhi.c:101,
      // :106) are one call each:
      //   grounded -> ft_80084F3C: ground friction on gr_vel, then
      //               ApplyGroundMovement (ft_084E.c:42)
      //   airborne -> ft_80084EEC: ftCommon_Fall + ApplyFrictionAir (:33)
      //
      // Note the airborne side is plain Fall, NOT CheckFallFast/FallFast --
      // you cannot fastfall out of Sing.
      if (player[p].phys.grounded) {
        reduceByTraction(p);
      }
      else {
        applyGravity(p);
        applyFrictionAir(p, player[p].charAttributes.airFriction);
      }
      if (player[p].timer === 18) {
        sounds.sing1.play();
      }
      if (player[p].timer === 69) {
        sounds.sing2.play();
      }
      if (player[p].timer === 28) {
        player[p].hitboxes.active = [true, false, false, false];
        player[p].hitboxes.frame = 0;
        player[p].hitboxes.id[0].size = 10.937;
      }
      else if (player[p].timer === 36) {
        player[p].hitboxes.id[0].size = 1;
      }
      else if (player[p].timer === 69) {
        player[p].hitboxes.id[0].size = 10.937;
      }
      else if (player[p].timer === 77) {
        player[p].hitboxes.id[0].size = 1;
      }
      else if (player[p].timer === 113) {
        player[p].hitboxes.id[0].size = 12.890;
      }
      else if (player[p].timer === 126) {
        turnOffHitboxes(p);
      }
    }
  },
  interrupt: function (p, input) {
    if (player[p].timer > 179) {
      if (player[p].phys.grounded) {
        WAIT.init(p, input);
      }
      else {
        FALLSPECIAL.init(p, input);
      }
      return true;
    }
    else {
      return false;
    }
  },
  land: function (p, input) {

  }
};