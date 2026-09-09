import marth from "./index";
import {player} from "../../../main/main";
import {turnOffHitboxes, fastfall, airDrift} from "../../../physics/actionStateShortcuts";
import {setGroundVelocity} from "physics/groundMovement";
import {sinf, cosf, mtxDegToRad} from "physics/trig";
import {f32, add, sub, mul, div, neg} from "physics/f32";
import {sounds} from "../../../main/sfx";
import {Vec2D} from "../../../main/util/Vec2D";
import {drawVfx} from "../../../main/vfx/drawVfx";
import FALLSPECIAL from "../../shared/moves/FALLSPECIAL";
import LANDINGFALLSPECIAL from "../../shared/moves/LANDINGFALLSPECIAL";
export default {
  name: "UPSPECIAL",
  canPassThrough: true,
  canGrabLedge: [true, false],
  // GROUNDED frames, before he leaves the ground on timer 6.
  //
  // ftMs_SpecialHi_Phys's ground branch (ftmarsspecialhi.c:176) is
  // ft_80084FA8 -> ft_80085030, so gr_vel = transNOffset.z * facing_dir with
  // NO multiplier -- the x40 scaling of 1.1 that setVelocities below carries
  // belongs to the aerial branch only (ftmarsspecialhi.c:198-200).
  //
  // Dolphin Slash crouches back and pushes forward before launching: +3.20
  // units net over frames 1-5. None of it was modelled, so the move started
  // from a standstill. Indexed by timer directly, matching setVelocities
  // below, which is indexed [timer - 6] against disc frame 6.
  groundVelocities: [0, -0.44145, -0.44145, 0.8829, 1.9209, 1.28147],
  setVelocities: [[0.75685, 14.41555],
    [0.71450, 15.51062],
    [0.67334, 8.65633],
    [0.63338, 2.42162],
    [0.59462, 2.11897],
    [0.55706, 1.83569],
    [0.52069, 1.57181],
    [0.48552, 1.32731],
    [0.45155, 1.10218],
    [0.41878, 0.89645],
    [0.38720, 0.71010],
    [0.35682, 0.54314],
    [0.32765, 0.39556],
    [0.29966, 0.26735],
    [0.27288, 0.15855],
    [0.24729, 0.06912],
    [0.22290, -0.00093]],
  wallJumpAble: false,
  headBonk: false,
  canBeGrabbed: true,
  landType: 1,
  init: function (p, input) {
    player[p].actionState = "UPSPECIAL";
    player[p].timer = 0;
    player[p].phys.cVel = new Vec2D(0, 0);
    player[p].phys.fastfalled = false;
    player[p].phys.upbAngleMultiplier = 0;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.upb1.id0;
    player[p].hitboxes.id[1] = player[p].charHitboxes.upb1.id1;
    player[p].hitboxes.id[2] = player[p].charHitboxes.upb1.id2;
    player[p].phys.landingMultiplier = 30 / 34;
    sounds.dolphinSlash.play();
    sounds.dolphinSlash2.play();
    marth.UPSPECIAL.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!marth.UPSPECIAL.interrupt(p, input)) {
      if (player[p].phys.cVel.y <= 0) {
        player[p].phys.canWallJump = true;
      }
      if (player[p].timer < 6) {
        // ftMs_SpecialHi_IASA (ftmarsspecialhi.c:94-104):
        //
        //   if (cmd_vars[0] == 0 && |lsX| > x34) {
        //     t = x38 * ((|lsX| - x34) / (1.0 - x34));
        //     t = lsX > 0 ? -deg2rad(t) : deg2rad(t);
        //     if (|t| > |lstick_angle|) lstick_angle = t;
        //   }
        //
        // The final test is a LATCH: the angle only ever grows in magnitude
        // within one Dolphin Slash, so easing off the stick after tilting does
        // not straighten the move back out.
        const attr = player[p].charAttributes;
        const lsX = f32(input[p][0].lsX);
        const mag = Math.abs(lsX);
        if (mag > attr.dolphinAngleStickThreshold) {
          const ramp = div(sub(mag, attr.dolphinAngleStickThreshold),
                           sub(f32(1.0), attr.dolphinAngleStickThreshold));
          let t = mtxDegToRad(mul(attr.dolphinMaxAngleDeg, ramp));
          if (lsX > 0) { t = neg(t); }
          if (Math.abs(t) > Math.abs(player[p].phys.upbAngleMultiplier)) {
            player[p].phys.upbAngleMultiplier = t;
          }
        }
      }
      if (player[p].timer <= 5) {
        setGroundVelocity(p, marth.UPSPECIAL.groundVelocities[player[p].timer]
                             * player[p].phys.face);
      }
      if (player[p].timer === 6) {
        player[p].phys.grounded = false;
        // ftmarsspecialhi.c:106-109: `if (|lsX| > x30) ftCommon_UpdateFacing(fp)`,
        // which sets facing to sign(lsX) outright. x30 is 0.25 -- meleelight
        // used the 0.28 common deadzone, which is a different constant.
        const lsXf = input[p][0].lsX;
        if (Math.abs(lsXf) > player[p].charAttributes.dolphinFacingStickThreshold) {
          player[p].phys.face = lsXf >= 0 ? 1 : -1;
        }
      }
      if (player[p].timer > 5 && player[p].timer < 23) {
        // ft_80085154 (ft_084E.c:127) -- rotate the ANIMATION's own translation
        // delta by lstick_angle:
        //
        //   c = cosf(lstick_angle);  s = sinf(lstick_angle);
        //   fwd = transNOffset.z * facing_dir;  up = transNOffset.y;
        //   self_vel.x = fwd*c - up*s;
        //   self_vel.y = fwd*s + up*c;
        //
        // setVelocities is meleelight's extraction of (transNOffset.z,
        // transNOffset.y) per frame, so the shape carries over directly.
        const sv = marth.UPSPECIAL.setVelocities[player[p].timer - 6];
        const ang = player[p].phys.upbAngleMultiplier;
        const c = cosf(ang);
        const s = sinf(ang);
        const fwd = mul(sv[0], player[p].phys.face);
        const up = f32(sv[1]);
        player[p].phys.cVel = new Vec2D(sub(mul(fwd, c), mul(up, s)),
                                        add(mul(fwd, s), mul(up, c)));
      }
      else if (player[p].timer > 22) {
        // cVel-channel: self_vel (ftmarsspecialhi.c:172 ftMs_SpecialAirHi_Phys).
        // Past frame 22 Dolphin Slash is in its falling tail, which the decomp
        // runs through ftCommon_Fall + ftCommon_8007D344 -- the airborne
        // channel. The state cannot be grounded here: frame 6 sets
        // grounded = false and the move does not land before its own end.
        fastfall(p, input);
        airDrift(p, input);
        if (Math.abs(player[p].phys.cVel.x) > 0.36) {
          player[p].phys.cVel.x = 0.36 * Math.sign(player[p].phys.cVel.x);
        }
      }

      if (player[p].timer === 5) {
        player[p].hitboxes.active = [true, true, true, false];
        player[p].hitboxes.frame = 0;
      }
      if (player[p].timer === 6) {
        player[p].hitboxes.id[0] = player[p].charHitboxes.upb2.id0;
        player[p].hitboxes.id[1] = player[p].charHitboxes.upb2.id1;
        player[p].hitboxes.id[2] = player[p].charHitboxes.upb2.id2;
      }
      if (player[p].timer > 6 && player[p].timer < 11) {
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 11) {
        turnOffHitboxes(p);
      }
      if (player[p].timer > 2 && player[p].timer < 12) {
        drawVfx({
          name: "swing",
          pos: new Vec2D(0, 0),
          face: player[p].phys.face,
          f: {
            pNum: p,
            swingType: "UPSPECIAL",
            frame: player[p].timer - 3
          }
        });
      }
    }
  },
  interrupt: function (p, input) {
    if (player[p].timer > 39) {
      FALLSPECIAL.init(p, input);
      return true;
    }
    else {
      return false;
    }
  },
  land: function (p, input) {
    if (   player[p].phys.cVel.y + player[p].phys.kVel.y <= 0 
        || player[p].phys.ECBp[0].y <= player[p].phys.ECB1[0].y 
        || player[p].phys.pos.y <= player[p].phys.posPrev.y ) {
      LANDINGFALLSPECIAL.init(p, input);
    }
  }
};