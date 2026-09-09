//@flow

import {
  player,
  characterSelections,
  percentShake,
  playerType,
  edgeOffset,
  versusMode,
  showDebug,
  gameMode
} from "../main/main";
import {framesData, ecb} from "../main/characters";
import {sounds} from "../main/sfx";
import {gameSettings} from "../settings";
import {actionStates, turboAirborneInterrupt, turboGroundedInterrupt, turnOffHitboxes} from "./actionStateShortcuts";
import { hitQueue } from "./hitDetection";
import {lostStockQueue} from "../main/render";
import {atan2f} from "./trig";
import {setGroundNormal, syncGrVelFromCVel, projectGroundVelocity} from "./groundMovement";
import {decayKnockback, calcHitstun, calcLaunchAngle,
        knockbackToVelocity, applyDI, applyGroundedLaunch,
        applyGroundKnockback, applyGroundShieldKnockback,
        decayShieldKnockbackAir, stackKnockback} from "./knockback";
import {f32, add, mul} from "./f32";
import {HORIZONTAL_STICK_DEADZONE, VERTICAL_STICK_DEADZONE,
        HORIZONTAL_STICK_SMASH_DEADZONE, VERTICAL_STICK_SMASH_DEADZONE,
        PLATFORM_DROP_STICK_THRESHOLD,
        SDI_MIN_STICK_MAG, SDI_STICK_WINDOW, SDI_POS_SCALE,
        ASDI_SCALE} from "./meleeCommon";
import {ucfSdi} from "physics/ucf";
import {moveIdFor, nextAttackInstance, resetStaleTable} from "./staling";
import {FT_MOVE_ID_DEFAULT} from "./staleMoveIds";
import {
  runCollisionRoutine, coordinateIntercept, additionalOffset, smallestECBWidth, smallestECBHeight
  , groundedECBSquashFactor, outwardsWallNormal, moveAlongGround, getSameAndOther
} from "./environmentalCollision";
import {deepObjectMerge} from "../main/util/deepCopyObject";
import {drawVfx} from "../main/vfx/drawVfx";
import {getSurfaceFromStage} from "../stages/stage";
import {activeStage} from "../stages/activeStage";
import {Box2D} from "../main/util/Box2D";
import {Vec2D} from "../main/util/Vec2D";
import {toList} from "../main/util/toList";
import {lineAngle} from "../main/util/lineAngle";
import {extremePoint} from "../stages/util/extremePoint";
import {moveECB, squashECBAt} from "../main/util/ecbTransform";
import {subtract} from "../main/linAlg";

// eslint-disable-next-line no-duplicate-imports
import type {Connected, Surface} from "../stages/stage";
// eslint-disable-next-line no-duplicate-imports
import type {ECB, SquashDatum} from "../main/util/ecbTransform";
import type {DamageType} from "./damageTypes";


// fp->x670_timer_lstick_tilt_x / x671 (fighter.c:1910-1963), one axis each.
//
//   if (lstick[0].a >= smash_deadzone)
//        if (lstick[1].a >= smash_deadzone) timer++ (clamped at 0xFE);
//        else                               timer = 0;      // fresh crossing
//   else if (lstick[0].a <= -smash_deadzone)
//        if (lstick[1].a <= -smash_deadzone) timer++;
//        else                                timer = 0;
//   else timer = 0xFE;                                      // inside deadzone
//
// So the timer is 0 on the frame the stick ENTERS the tilt zone and counts up
// while it stays there. SDI's real gate is `timer < sdi_stick_window` -- a
// crossing within the last few frames -- not a threshold crossing this frame.
function tiltTimer(cur: number, prev: number, deadzone: number, timer: number): number {
  if (cur >= deadzone) {
    return prev >= deadzone ? Math.min(timer + 1, 254) : 0;
  }
  if (cur <= -deadzone) {
    return prev <= -deadzone ? Math.min(timer + 1, 254) : 0;
  }
  return 254;
}

function updateStickTiltTimers(i: number, input: any): void {
  const phys = player[i].phys;
  phys.stickTiltTimerX = tiltTimer(input[i][0].lsX, input[i][1].lsX,
                                   HORIZONTAL_STICK_SMASH_DEADZONE,
                                   phys.stickTiltTimerX);
  phys.stickTiltTimerY = tiltTimer(input[i][0].lsY, input[i][1].lsY,
                                   VERTICAL_STICK_SMASH_DEADZONE,
                                   phys.stickTiltTimerY);
}

// ftCo_Damage_OnEveryHitlag (ftCo_Damage.c:568) -- SDI.
//
//   if (allow_sdi &&
//       VEC2_SQ_LEN(lstick[0]) >= SQ(sdi_min_stick_mag) &&
//       (x670_timer_lstick_tilt_x < sdi_stick_window ||
//        x671_timer_lstick_tilt_y < sdi_stick_window))
//   {
//       cur_pos.x += lstick[0].x * sdi_pos_scale;
//       cur_pos.y += lstick[0].y * sdi_pos_scale;
//       x670 = x671 = 254;
//   }
//
// Three things this fixes over the hand-rolled version:
//
//  * The gate. meleelight tested for a threshold crossing THIS FRAME at
//    +-0.7 per axis. Melee tests that the stick entered the +-0.25 smash
//    deadzone within the last sdi_stick_window (4) frames and that its
//    magnitude is at or past sdi_min_stick_mag NOW. A stick rolled in over
//    two or three frames -- which is what a human hand does -- satisfies
//    Melee's test and failed meleelight's.
//  * The refractory lock. Melee pins both tilt timers to 254 after firing, so
//    one crossing yields exactly one SDI until the stick leaves the deadzone
//    and re-enters. Nothing enforced that before.
//  * The vertical axis was gated on `!grounded`. Melee shifts both axes
//    unconditionally.
function applySDI(i: number, input: any): void {
  const phys = player[i].phys;
  const lsX = f32(input[i][0].lsX);
  const lsY = f32(input[i][0].lsY);
  // VEC2_SQ_LEN >= SQ(mag) -- compared squared, so no square root.
  if (add(mul(lsX, lsX), mul(lsY, lsY)) < mul(SDI_MIN_STICK_MAG, SDI_MIN_STICK_MAG)) {
    return;
  }
  // UCF SDI (sdi.cpp, Player_SDICallback+0x5C) runs ONLY after the vanilla
  // window check has already failed -- it rescues an f2 SDI input that lost to
  // unlucky polling. No-op with the UCF toggle off.
  if (!(phys.stickTiltTimerX < SDI_STICK_WINDOW ||
        phys.stickTiltTimerY < SDI_STICK_WINDOW)) {
    if (!ucfSdi(i, input, phys.stickTiltTimerX, phys.stickTiltTimerY,
                SDI_MIN_STICK_MAG)) {
      return;
    }
  }
  phys.pos.x = add(phys.pos.x, mul(lsX, SDI_POS_SCALE));
  phys.pos.y = add(phys.pos.y, mul(lsY, SDI_POS_SCALE));
  phys.stickTiltTimerX = 254;
  phys.stickTiltTimerY = 254;
}

// ftCo_Damage_OnExitHitlag (ftCo_Damage.c:624) -- ASDI.
//
//   if (|lstick| >= sdi_min_stick_mag || |cstick| >= sdi_min_stick_mag) {
//       src = cstick qualifies ? cstick : lstick;
//       cur_pos += src * x4BC;
//   }
//
// This runs ONCE, on the frame hitlag ends -- it is the post_hitlag callback.
// meleelight ran its equivalent on EVERY frame the state was active and hitlag
// was zero, which is most of hitstun, so a held stick bought 3 units of free
// movement per frame for the whole launch.
//
// The C-STICK branch was missing entirely. c-stick ASDI is a real technique:
// ftCo_800DF608 (ft_0DF1.c:99) is the same magnitude test on the c-stick, and
// when it passes the c-stick is used INSTEAD of the control stick.
function applyASDI(i: number, input: any): void {
  const phys = player[i].phys;
  const lsX = f32(input[i][0].lsX), lsY = f32(input[i][0].lsY);
  const csX = f32(input[i][0].csX), csY = f32(input[i][0].csY);
  const minSq = mul(SDI_MIN_STICK_MAG, SDI_MIN_STICK_MAG);
  const cStick = add(mul(csX, csX), mul(csY, csY)) >= minSq;
  const lStick = add(mul(lsX, lsX), mul(lsY, lsY)) >= minSq;
  if (!cStick && !lStick) { return; }
  const x = cStick ? csX : lsX;
  const y = cStick ? csY : lsY;
  phys.pos.x = add(phys.pos.x, mul(x, ASDI_SCALE));
  phys.pos.y = add(phys.pos.y, mul(y, ASDI_SCALE));
}

function updatePosition(i: number, newPosition: Vec2D): void {
  player[i].phys.pos = newPosition;
};

function dealWithDamagingStageCollision(i: number, normal: Vec2D, corner: bool, angular: number, damageType: DamageType): void {
  const collisionData = {normal: normal, angular: angular, corner: corner};
  let damageTypeIndex = -1;
  switch (damageType) {
    case "fire":
      damageTypeIndex = 3;
      break;
    case "electric":
      damageTypeIndex = 4;
      break;
    case "slash":
      damageTypeIndex = 1;
      break;
    case "darkness":
      damageTypeIndex = 5;
      break;
    default:
      break;
  }
  if (damageTypeIndex !== -1) {
    hitQueue.push([i, collisionData, damageTypeIndex, false, false, true]);
  }
}

function dealWithWallCollision(i: number, newPosition: Vec2D, pt: number, wallType: string, wallIndex: number, input: any): void {
  updatePosition(i, newPosition);

  let wallLabel = "L";
  let sign = -1;
  let isRight = 0;
  if (wallType[0].toLowerCase() === "r") {
    wallLabel = "R";
    sign = 1;
    isRight = 1;
  }

  const wall = getSurfaceFromStage([wallType, wallIndex], activeStage);
  const wallBottom = extremePoint(wall, "b");
  const wallTop = extremePoint(wall, "t");
  const wallNormal = outwardsWallNormal(wallBottom, wallTop, wallType);
  const damageType = wall[2] === undefined ? null : wall[2].damageType;

  const inDamageState = player[i].actionState === "DAMAGEFLYN" || player[i].actionState === "WALLDAMAGE" || player[i].actionState === "DAMAGEFALL";

  if (inDamageState && player[i].phys.techTimer > 0) {
    player[i].phys.face = sign;
    if (input[i][0].x || input[i][0].y || input[i][0].lsY > 0.7) {
      actionStates[characterSelections[i]].WALLTECHJUMP.init(i, input);
    } else {
      actionStates[characterSelections[i]].WALLTECH.init(i, input);
    }
  }
  else if (inDamageState && Math.sign(player[i].phys.kVel) !== sign && player[i].hit.hitlag === 0 && Math.pow(player[i].phys.kVel.x, 2) + Math.pow(player[i].phys.kVel.y, 2) >= 2.25) {
    player[i].phys.face = sign;
    drawVfx({
      name: "wallBounce",
      pos: new Vec2D(player[i].phys.pos.x, player[i].phys.ECBp[1].y),
      face: sign,
      f: wallNormal
    });
    actionStates[characterSelections[i]].WALLDAMAGE.init(i,input, wallNormal);
  }
  else if (player[i].hit.hitlag === 0) {
    if (damageType !== undefined && damageType !== null
        && player[i].phys.hurtBoxState === 0) {
      // apply damage
      dealWithDamagingStageCollision(i, wallNormal, false, pt, damageType);
    }
    else if (actionStates[characterSelections[i]][player[i].actionState].specialWallCollide) {
      actionStates[characterSelections[i]][player[i].actionState].onWallCollide(i, input, wallLabel, wallIndex);
    }
    else if (player[i].phys.canWallJump) {
      if (player[i].phys.wallJumpTimer === 254) {
        if (player[i].phys.posDelta.x >= 0.5) {
          player[i].phys.wallJumpTimer = 0;
        }
      }
    }
    if (player[i].phys.wallJumpTimer >= 0 && player[i].phys.wallJumpTimer < 120) {
      if (sign * input[i][0].lsX >= 0.7 &&
          sign * input[i][3].lsX <= 0 &&
          player[i].charAttributes.walljump) {
        player[i].phys.wallJumpTimer = 254;
        player[i].phys.face = sign;
        actionStates[characterSelections[i]].WALLJUMP.init(i, input);
      } else {
        player[i].phys.wallJumpTimer++;
      }
    }
  }

};

function dealWithPlatformCollision(i: number, alreadyGrounded: boolean
    , newPosition: Vec2D, ecbpBottom: Vec2D
    , platformIndex: number, input: any): void {
  const platform = getSurfaceFromStage(["p", platformIndex], activeStage);
  const damageType = platform[2] === undefined ? null : platform[2].damageType;

  const platLeft = extremePoint(platform, "l");
  const platRight = extremePoint(platform, "r");
  const platNormal = outwardsWallNormal(platLeft, platRight, "g");

  if (player[i].hit.hitlag > 0 || alreadyGrounded || player[i].phys.grabbedBy !== -1) {
    updatePosition(i, newPosition);
  }
  else {
    land(i, ecbpBottom, 1, platformIndex, platNormal, input);
  }
};

function dealWithGroundCollision(i: number, alreadyGrounded: boolean
    , newPosition: Vec2D, ecbpBottom: Vec2D
    , groundIndex: number, input: any): void {
  const ground = getSurfaceFromStage(["g", groundIndex], activeStage);
  const damageType = ground[2] === undefined ? null : ground[2].damageType;

  const ignoreDamage = player[i].actionState === "DAMAGEFLYN" || player[i].actionState === "DAMAGEFALL" || player[i].actionState === "WALLDAMAGE";
  const groundLeft = extremePoint(ground, "l");
  const groundRight = extremePoint(ground, "r");
  const groundNormal = outwardsWallNormal(groundLeft, groundRight, "g");

  if (!ignoreDamage && damageType !== undefined && damageType !== null
      && player[i].phys.hurtBoxState === 0) {
    // apply damage
    dealWithDamagingStageCollision(i, groundNormal, false, 0, damageType);
  } else {
    if (player[i].hit.hitlag > 0 || alreadyGrounded || player[i].phys.grabbedBy !== -1) {
      updatePosition(i, newPosition);
    }
    else {
      land(i, ecbpBottom, 0, groundIndex, groundNormal, input);
    }
  }
};


function fallOffGround(i: number, side: string
    , groundEdgePosition: Vec2D
    , disableFall: bool, input: any): [boolean, boolean] {
  let [stillGrounded, backward] = [true, false];
  let sign = 1;
  if (side === "r") {
    sign = -1;
  }
  if (disableFall) {
    player[i].phys.pos.y = Math.max(player[i].phys.pos.y, groundEdgePosition.y) + additionalOffset;
    player[i].phys.pos.x = groundEdgePosition.x + (side === "l" ? additionalOffset : -additionalOffset);
    player[i].phys.ECBp = moveECB(player[i].phys.ECBp, subtract(player[i].phys.pos, player[i].phys.ECBp[0]));
  }
  else if (actionStates[characterSelections[i]][player[i].actionState].canEdgeCancel) {
    if (player[i].phys.face === sign) {
      stillGrounded = false;
      player[i].phys.pos.y = Math.max(player[i].phys.pos.y, groundEdgePosition.y) + additionalOffset;
      backward = true;
    }
    else if (Math.abs(input[i][0].lsX) > 0.6
        || (player[i].phys.cVel.x === 0 && player[i].phys.kVel.x === 0)
        || actionStates[characterSelections[i]][player[i].actionState].disableTeeter
        || player[i].phys.shielding) {
      stillGrounded = false;
      player[i].phys.pos.y = Math.max(player[i].phys.pos.y, groundEdgePosition.y) + additionalOffset;
    }
    else {
      player[i].phys.cVel.x = 0;
      player[i].phys.pos.x = groundEdgePosition.x + sign * additionalOffset;
      actionStates[characterSelections[i]].OTTOTTO.init(i,input);
    }
  }
  else if (player[i].phys.cVel.x === 0
      && player[i].phys.kVel.x === 0
      && !actionStates[characterSelections[i]][player[i].actionState].inGrab) {
    stillGrounded = false;
    player[i].phys.pos.y = Math.max(player[i].phys.pos.y, groundEdgePosition.y) + additionalOffset;
  }
  else {
    player[i].phys.cVel.x = 0;
    player[i].phys.pos.x = groundEdgePosition.x + sign * additionalOffset;
  }
  return [stillGrounded, backward];
};

// ground type and index is a pair, either ["g", index] or ["p", index]
function dealWithGround(i: number, ground: Surface, groundTypeAndIndex: [string, number]
    , connected: ?Connected, input: any): [boolean, boolean] {

  const damageType = ground[2] === undefined ? null : ground[2].damageType;

  const ignoreDamage = player[i].actionState === "DAMAGEFLYN" || player[i].actionState === "DAMAGEFALL" || player[i].actionState === "WALLDAMAGE";

  const leftmostGroundPoint = extremePoint(ground, "l");
  const rightmostGroundPoint = extremePoint(ground, "r");
  const groundNormal = outwardsWallNormal(leftmostGroundPoint, rightmostGroundPoint, "g");
  let [stillGrounded, backward] = [true, false];
  let groundOrPlatform = 0;
  if (groundTypeAndIndex[0] === "p") {
    groundOrPlatform = 1;
  }
  let disableFall = false;

  let maybeLeftGroundTypeAndIndex = null;
  let maybeRightGroundTypeAndIndex = null;

  // first check if the player is allowed to move along the ground, by checking there are no low ceilings
  const ecb0Height = Math.max(additionalOffset, player[i].phys.ECB1[2].y - player[i].phys.ECB1[0].y - additionalOffset);
  const maybeNextPosX = moveAlongGround(player[i].phys.ECB1[0], player[i].phys.ECBp[0], ecb0Height, ground, activeStage.ceiling);
  if (maybeNextPosX !== null) {
    // ceiling has obstructed grounded movement
    player[i].phys.pos.x = maybeNextPosX;
    player[i].phys.ECBp = moveECB(player[i].phys.ECBp, new Vec2D(maybeNextPosX - player[i].phys.ECBp[0].x, 0));
  }
  if ( player[i].phys.ECBp[0].x < leftmostGroundPoint.x) {
    if (connected !== null && connected !== undefined) {
      maybeLeftGroundTypeAndIndex = groundTypeAndIndex[0] === "g"
          ? connected[0][groundTypeAndIndex[1]][0]
          : connected[1][groundTypeAndIndex[1]][0];
    }
    if (maybeLeftGroundTypeAndIndex === null || maybeLeftGroundTypeAndIndex === undefined) { // no other ground to the left
      [stillGrounded, backward] = fallOffGround(i, "l", leftmostGroundPoint, disableFall, input);
    }
    else {
      const [leftGroundType, leftGroundIndex] = maybeLeftGroundTypeAndIndex;
      switch (leftGroundType) {
        case "g":
          [stillGrounded, backward] = dealWithGround(i, activeStage.ground[leftGroundIndex], ["g", leftGroundIndex], connected, input);
          break;
        case "p":
          [stillGrounded, backward] = dealWithGround(i, activeStage.platform[leftGroundIndex], ["p", leftGroundIndex], connected, input);
          break;
        case "r":
          const rightWallToTheLeft = activeStage.wallR[leftGroundIndex];
          if (extremePoint(rightWallToTheLeft, "l").y > leftmostGroundPoint.y) {
            disableFall = true;
          }
          [stillGrounded, backward] = fallOffGround(i, "l", leftmostGroundPoint, disableFall, input);
          break;
        default: // surface to the left is neither ground, platform or right wall
          [stillGrounded, backward] = fallOffGround(i, "l", leftmostGroundPoint, disableFall, input);
          break;
      }
    }
  }
  else if (player[i].phys.ECBp[0].x > rightmostGroundPoint.x) {
    if (connected !== null && connected !== undefined) {
      maybeRightGroundTypeAndIndex = groundTypeAndIndex[0] === "g"
          ? connected[0][groundTypeAndIndex[1]][1]
          : connected[1][groundTypeAndIndex[1]][1];
    }
    if (maybeRightGroundTypeAndIndex === null || maybeRightGroundTypeAndIndex === undefined) { // no other ground to the right
      [stillGrounded, backward] = fallOffGround(i, "r", rightmostGroundPoint, disableFall, input);
    }
    else {
      const [rightGroundType, rightGroundIndex] = maybeRightGroundTypeAndIndex;
      switch (rightGroundType) {
        case "g":
          [stillGrounded, backward] = dealWithGround(i, activeStage.ground[rightGroundIndex], ["g", rightGroundIndex], connected, input);
          break;
        case "p":
          [stillGrounded, backward] = dealWithGround(i, activeStage.platform[rightGroundIndex], ["p", rightGroundIndex], connected, input);
          break;
        case "l":
          const leftWallToTheRight = activeStage.wallL[rightGroundIndex];
          if (extremePoint(leftWallToTheRight, "r").y > rightmostGroundPoint.y) {
            disableFall = true;
          }
          [stillGrounded, backward] = fallOffGround(i, "r", rightmostGroundPoint, disableFall, input);
          break;
        default: // surface to the right is neither ground, platform or left wall
          [stillGrounded, backward] = fallOffGround(i, "r", rightmostGroundPoint, disableFall, input);
          break;
      }
    }
  }
  else {
    const ecbpBottom = player[i].phys.ECBp[0];
    const yIntercept = coordinateIntercept([ecbpBottom, new Vec2D(ecbpBottom.x, ecbpBottom.y + 1)], ground);
    player[i].phys.pos.y = player[i].phys.pos.y + yIntercept.y - ecbpBottom.y + additionalOffset;
    player[i].phys.ECBp = moveECB(player[i].phys.ECBp, new Vec2D(0, yIntercept.y - ecbpBottom.y + additionalOffset));
    player[i].phys.onSurface = [groundOrPlatform, groundTypeAndIndex[1]];
    // atan2f, not Math.atan2: the floor angle feeds the ported ground physics,
    // and Melee derives it the same way (e.g. ftfoxspecialhi.c:748 takes
    // atan2f of the floor normal). The `|| PI/2` guard is meleelight's and is
    // unaffected -- both functions return a falsy 0 for a normal of (1, 0).
    player[i].phys.groundAngle = atan2f(groundNormal.y, groundNormal.x) || Math.PI / 2;
    // Still grounded, but now on a different surface: keep the along-ground
    // scalar and re-project it onto the new tangent. Do NOT re-derive grVel
    // from cVel here -- that is only correct on an airborne -> grounded
    // transition (see land()).
    setGroundNormal(i, groundNormal);
    projectGroundVelocity(i);
  }
  if (!ignoreDamage && damageType !== undefined && damageType !== null
      && player[i].phys.hurtBoxState === 0) {
    // apply damage
    dealWithDamagingStageCollision(i, groundNormal, false, 0, damageType);
    stillGrounded = false;
  }
  return [stillGrounded, backward];
};

function dealWithCeilingCollision(i: number, newPosition: Vec2D
    , ecbTop: Vec2D
    , ceilingIndex: number
    , input: any): void {
  updatePosition(i, newPosition);
  const ceiling = getSurfaceFromStage(["c", ceilingIndex], activeStage);
  const damageType = ceiling[2] === undefined ? null : ceiling[2].damageType;
  const ceilingLeft = extremePoint(ceiling, "l");
  const ceilingRight = extremePoint(ceiling, "r");
  const ceilingNormal = outwardsWallNormal(ceilingLeft, ceilingRight, "c");

  const ignoreDamage = player[i].actionState === "DAMAGEFLYN" || player[i].actionState === "DAMAGEFALL" || player[i].actionState === "WALLDAMAGE";

  if (!ignoreDamage && damageType !== undefined && damageType !== null
      && player[i].phys.hurtBoxState === 0) {
    // apply damage
    dealWithDamagingStageCollision(i, ceilingNormal, false, 2, damageType);
  }
  else if (actionStates[characterSelections[i]][player[i].actionState].headBonk && player[i].phys.cVel.y + player[i].phys.kVel.y > 0) {
    if (player[i].hit.hitstun > 0) {
      if (player[i].phys.techTimer > 0) {
        actionStates[characterSelections[i]].TECHU.init(i, input);
      } else {
        drawVfx({
          name: "ceilingBounce",
          pos: ecbTop,
          face: 1,
          f: ceilingNormal
        });
        sounds.bounce.play();
        actionStates[characterSelections[i]].STOPCEIL.init(i, input, ceilingNormal);
      }
    } else {
      actionStates[characterSelections[i]].STOPCEIL.init(i, input);
    }
  }
};

function dealWithCornerCollision(i: number, newPosition: Vec2D, ecb: ECB, angularParameter: number, damageType: DamageType) {
  updatePosition(i, newPosition);
  const insideECBType = angularParameter < 2 ? "l" : "r";
  const [same, other] = getSameAndOther(angularParameter);
  const lowerECBPoint = other === 2 ? ecb[same] : ecb[0];
  const upperECBPoint = other === 2 ? ecb[2] : ecb[same];
  const normal = outwardsWallNormal(lowerECBPoint, upperECBPoint, insideECBType);
  if (player[i].hit.hitlag === 0 && damageType !== undefined && damageType !== null
      && player[i].phys.hurtBoxState === 0) {
    dealWithDamagingStageCollision(i, normal, true, angularParameter, damageType);
  }
};

export function land(i: number, newPosition: Vec2D
    , t: number, j: number, normal: ?Vec2D
    , input: any): void {
  player[i].phys.pos = newPosition;
  player[i].phys.grounded = true;
  player[i].phys.doubleJumped = false;
  player[i].phys.jumpsUsed = 0;
  player[i].phys.airborneTimer = 0;
  player[i].phys.fastfalled = false;
  player[i].phys.chargeFrames = 0;
  player[i].phys.charging = false;
  player[i].phys.wallJumpCount = 0;
  player[i].phys.thrownHitbox = false;
  player[i].phys.sideBJumpFlag = true;
  player[i].phys.onSurface = [t, j];
  player[i].phys.onLedge = -1;
  player[i].rotation = 0;
  player[i].rotationPoint = new Vec2D(0, 0);
  player[i].colourOverlayBool = false;
  player[i].hitboxes.active = [false, false, false, false];

  let newNormal = normal;
  if (newNormal === null || newNormal === undefined || (newNormal.x === 0 && newNormal.y === 0)) {
    newNormal = new Vec2D(0, 1);
  }
  player[i].phys.groundAngle = atan2f(newNormal.y, newNormal.x);
  // Airborne -> grounded. Melee derives the along-ground scalar gr_vel from the
  // landing velocity; cVel becomes a value derived from it thereafter.
  // See src/physics/groundMovement.js.
  setGroundNormal(i, newNormal);
  syncGrVelFromCVel(i);

  switch (actionStates[characterSelections[i]][player[i].actionState].landType) {
    case 0:
      // LANDING / NIL
      if (player[i].phys.cVel.y >= -1) {
        actionStates[characterSelections[i]].WAIT.init(i, input);
      } else {
        actionStates[characterSelections[i]].LANDING.init(i, input);
      }
      break;
    case 1:
      // OWN FUNCTION
      actionStates[characterSelections[i]][player[i].actionState].land(i, input);
      break;
    case 2:
      // KNOCKDOWN / TECH
      if (player[i].phys.techTimer > 0) {
        if (input[i][0].lsX * player[i].phys.face > 0.5) {
          actionStates[characterSelections[i]].TECHF.init(i, input);
        } else if (input[i][0].lsX * player[i].phys.face < -0.5) {
          actionStates[characterSelections[i]].TECHB.init(i, input);
        } else {
          actionStates[characterSelections[i]].TECHN.init(i, input);
        }
      } else {
        actionStates[characterSelections[i]].DOWNBOUND.init(i, input);
      }
      break;
    default:
      actionStates[characterSelections[i]].LANDING.init(i, input);
      break;
  }
  player[i].phys.cVel.y = 0;
  player[i].phys.kVel.y = 0;
  player[i].hit.hitstun = 0;
};


function hitlagSwitchUpdate(i : number, input : any) : void {
  if (player[i].hit.hitlag > 0){
    player[i].hit.hitlag--;
    if (player[i].hit.hitlag === 0) {
      // ftCo_Damage_OnExitHitlag (ftCo_Damage.c:624) is the post_hitlag
      // callback, so it fires exactly here, and it fires whether or not there
      // is knockback to apply. Its own order is ASDI first, then the DI
      // rotation below (ftCo_8008E5A4 at the end of that function).
      applyASDI(i, input);
    }
    if (player[i].hit.hitlag === 0 && player[i].hit.knockback > 0) {
      if (player[i].phys.grabbedBy === -1 || player[i].hit.knockback > 50) {
        // Melee's order, which is NOT what this used to do:
        //   1. ftCo_Damage_CalcAngle (ftCo_Damage.c:79)   -- angle, NO DI
        //   2. ftCo_8008DCE0        (ftCo_Damage.c:324)   -- angle -> velocity
        //   3. ftCo_8008E5A4        (ftCo_Damage.c:591)   -- DI ROTATES that
        //                                                    velocity vector
        //
        // The previous code folded DI into the angle calculation and then
        // derived velocity from the DI'd angle. That is a different operation:
        // Melee computes the launch vector first and rotates it afterwards, so
        // DI cannot change the launch SPEED, only its direction. Folding it in
        // earlier lets the vertical/horizontal split shift in ways the game
        // does not allow.
        const airborne = !player[i].phys.grounded;
        const launchAngle = calcLaunchAngle(
            player[i].hit.angle, player[i].hit.knockback, airborne);

        let kbVel = knockbackToVelocity(player[i].hit.knockback, launchAngle,
            { airborne: airborne, airMotion: airborne });

        // Melee applies this as `-x * facing_dir` (ftCo_Damage.c:350); meleelight
        // carries the same information in hit.reverse.
        if (player[i].hit.reverse) { kbVel = { x: -kbVel.x, y: kbVel.y }; }

        // ftCo_8008E5A4 has NO deadzone check of its own -- Melee deadzones the
        // stick in its input layer before any movement code sees it. Applying
        // the real ftCommonData deadzones here models that. (The old code used
        // 0.2875; the actual value is 0.2800000011920929.)
        const diX = Math.abs(input[i][0].lsX) < HORIZONTAL_STICK_DEADZONE
            ? 0 : input[i][0].lsX;
        const diY = Math.abs(input[i][0].lsY) < VERTICAL_STICK_DEADZONE
            ? 0 : input[i][0].lsY;
        kbVel = applyDI(kbVel, diX, diY);

        // ftCo_Damage.c block_28:
        //     fp->self_vel.x = fp->self_vel.y = fp->self_vel.z = 0;
        //     fp->gr_vel = 0;
        // gr_vel must be cleared too. Zeroing cVel alone leaves the grounded
        // scalar holding the pre-hit speed, and the next grounded frame
        // re-projects it straight back onto cVel -- so a grounded victim would
        // keep walking out from under their own knockback.
        // (Only these two. block_28 does NOT clear the ground-accel
        // accumulators -- those are consumed and zeroed every frame by
        // ApplyGroundMovement, so there is nothing stale for them to hold.)
        player[i].phys.cVel.x = 0;
        player[i].phys.cVel.y = 0;
        player[i].phys.grVel = 0;

        // ftCo_Damage_CalcVel (ftCo_Damage.c:216), reached from ftCo_Damage.c:350.
        // The knockback is NOT simply overwritten. Within x18ac < xFC (10)
        // frames of the previous hit it replaces; beyond that it COMBINES with
        // whatever knockback is still live -- opposite-signed components add,
        // same-signed components keep the larger magnitude, per axis.
        //
        // The counter is read here and reset to 0 below, matching the order in
        // the original: CalcVel runs at :350, the reset is at :470. Reading it
        // after the reset would make every hit look like a fresh one.
        const stacked = stackKnockback(player[i].phys.kVel, kbVel.x, kbVel.y,
                                       player[i].phys.timeSinceHit);
        player[i].phys.kVel.x = stacked.x;
        player[i].phys.kVel.y = stacked.y;
        player[i].phys.timeSinceHit = 0;   // ftCo_Damage.c:470

        // Melee's grounded launch branch, ftCo_Damage.c:354-391. Compares the
        // launch vector against the FLOOR NORMAL rather than against fixed
        // angles: into the floor below reaction level 3 becomes a tangential
        // slide carried by the xF0_ground_kb_vel scalar, level 3 launches
        // anyway and bounces past 100 degrees.
        //
        // This replaces meleelight's `knockback < 80 && (angle 0 or 180)`
        // heuristic, which flattened Y for a fixed angle set regardless of the
        // floor's slope and regardless of whether the hit was strong enough to
        // tumble.
        if (!airborne) {
          const launched = applyGroundedLaunch(
            player[i].phys.kVel,
            player[i].phys.groundNormal,
            player[i].hit.knockback);
          player[i].phys.kVel.x = launched.vel.x;
          player[i].phys.kVel.y = launched.vel.y;
          player[i].phys.grKBVel = launched.grKBVel;
        } else {
          player[i].phys.grKBVel = 0;
        }

        // kDec is no longer written: airborne decay recomputes the angle from
        // the current vector every frame (fighter.c:2196), so a decay cached at
        // launch has no consumer.

        player[i].phys.onLedge = -1;
        player[i].phys.charging = false;
        player[i].phys.chargeFrames = 0;
        player[i].phys.shielding = false;
        /*if (player[i].phys.grounded){
         if (newAngle == 0 || newAngle > 270){
         player[i].phys.kVel.y = 0;
         player[i].phys.kDec.x = player[i].charAttributes.traction;
         }
         else if (newAngle > 180){
         player[i].phys.kVel.y = 0;
         player[i].phys.kDec.x = -player[i].charAttributes.traction;
         }
         }*/
        if (player[i].phys.kVel.y === 0) {
          if (player[i].hit.knockback >= 80) {
            player[i].phys.grounded = false;
            player[i].phys.pos.y += 0.0001;
          }
        }
        if (player[i].phys.kVel.y > 0) {
          player[i].phys.grounded = false;
        }
      }
      player[i].hit.knockback = 0;
    }

    //SDI / ASDI
    switch (player[i].actionState) {
      case "DAMAGEN2":
      case "DAMAGEFLYN":
      case "GUARDON":
      case "GUARD":
      case "DOWNDAMAGE":
        // SDI only. ASDI is NOT the `else` of this test -- it is a one-shot on
        // the hitlag-exit frame, and now lives in hitlagSwitchUpdate() where
        // that transition is detected. See applyASDI.
        if (player[i].hit.hitlag > 0) {
          applySDI(i, input);
        }
        break;
      default:
        break;
    }
    if (player[i].hit.hitlag === 0) {
      // if hitlag just ended, do normal stuff as well
      hitlagSwitchUpdate(i, input);
    }
  }
  else {
    if (player[i].hit.shieldstun > 0) {
      //console.log(player[i].hit.shieldstun);
      player[i].hit.shieldstun--;
      if (player[i].hit.shieldstun < 0) {
        player[i].hit.shieldstun = 0;
      }
    }
    //console.log(actionStates[characterSelections[i]][player[i].actionState]);
    player[i].phys.canWallJump = actionStates[characterSelections[i]][player[i].actionState].wallJumpAble;
    player[i].phys.bTurnaroundTimer--;
    if (player[i].phys.bTurnaroundTimer < 0) {
      player[i].phys.bTurnaroundTimer = 0;
    }

    if ((input[i][0].lsX > 0.9 && input[i][1].lsX < 0.9) ||
        (input[i][0].lsX < -0.9 && input[i][1].lsX > -0.9)) {

      player[i].phys.bTurnaroundTimer = 20;
      player[i].phys.bTurnaroundDirection = Math.sign(input[i][0].lsX);
    }

    player[i].prevActionState = player[i].actionState;
    actionStates[characterSelections[i]][player[i].actionState].main(i, input);

    if (player[i].shocked > 0) {
      player[i].shocked--;
      if (player[i].shocked % 5 === 0) {
        sounds.electricfizz.play();
      }
      drawVfx({
        name: "shocked",
        pos: new Vec2D(player[i].phys.pos.x, player[i].phys.pos.y + 5),
        face: player[i].phys.face
      });
    }

    if (player[i].burning > 0) {
      player[i].burning--;
      if (player[i].burning % 6 === 0) {
        drawVfx({
          name: "burning",
          pos: new Vec2D(player[i].phys.pos.x, player[i].phys.pos.y + 5),
          face: player[i].phys.face
        });
      }
    }

    // TURBO MODE
    // if just changed action states, remove ability to cancel
    if (player[i].prevActionState !== player[i].actionState) {
      player[i].hasHit = false;
    }
    if (gameSettings.turbo && gameMode !== 5) {
      if (player[i].hasHit) {
        if (player[i].actionState !== "CATCHATTACK") {
          if (player[i].phys.grounded) {
            if (turboGroundedInterrupt(i, input)) {
              player[i].hasHit = false;
            }
          } else {
            if (turboAirborneInterrupt(i, input)) {
              player[i].hasHit = false;
            }
          }
        }
      }

    }

    // Airborne knockback decay -- Fighter_procUpdate (fighter.c:2196-2208):
    //
    //   angle = atan2f(kb_y, kb_x);
    //   if (sqrtf(kb_x^2 + kb_y^2) < x204) { kb_x = kb_y = 0; }
    //   else { kb_x -= x204*cosf(angle); kb_y -= x204*sinf(angle); }
    //
    // The angle is RECOMPUTED FROM THE CURRENT VECTOR every frame, and both
    // axes snap to zero together once the magnitude drops below one decay
    // step. meleelight froze a per-axis kDec at launch time (physics.js:490),
    // which drifts as soon as the vector's direction changes -- after DI, or
    // after a second hit stacks onto the existing knockback.
    //
    // Airborne knockback decays as a 2D vector along its own direction; on the
    // ground it collapses to the scalar xF0_ground_kb_vel, which is decayed by
    // ground friction and re-projected onto the floor tangent each frame
    // (fighter.c:2196-2231).
    if (!player[i].phys.grounded) {
      if (player[i].phys.kVel.x !== 0 || player[i].phys.kVel.y !== 0) {
        const decayed = decayKnockback(player[i].phys.kVel);
        player[i].phys.kVel.x = decayed.x;
        player[i].phys.kVel.y = decayed.y;
      }
      player[i].phys.grKBVel = 0;
    } else if (player[i].phys.kVel.x !== 0 || player[i].phys.grKBVel !== 0) {
      // Melee scales by co_attrs.ground_friction, which is meleelight's
      // `traction`; the x200 multiplier is folded in by applyGroundKnockback.
      const g = applyGroundKnockback(
        player[i].phys.grKBVel,
        player[i].phys.kVel,
        player[i].phys.groundNormal,
        player[i].charAttributes.traction);
      player[i].phys.grKBVel = g.grKBVel;
      player[i].phys.kVel.x = g.kbVel.x;
      player[i].phys.kVel.y = g.kbVel.y;
    } else {
      player[i].phys.kVel.y = 0;
    }

    // The attacker's shield knockback runs the same two-channel shape one
    // block later in the original (fighter.c:2233-2290): a 2D vector decaying
    // along its own direction while airborne, a floor-projected scalar while
    // grounded. Its grounded friction multiplier is x3EC (1.1), not x200 (1.0).
    const skb = player[i].phys.shieldKBVel;
    if (skb.x !== 0 || skb.y !== 0 || player[i].phys.grShieldKBVel !== 0) {
      if (!player[i].phys.grounded) {
        const d = decayShieldKnockbackAir(skb, player[i].phys.kVel);
        skb.x = d.shieldKB.x;
        skb.y = d.shieldKB.y;
        // The invisible-ceiling bug writes through to the ORDINARY knockback
        // vector. Reproduced, so this has to be written back too.
        player[i].phys.kVel.y = d.kbVel.y;
        player[i].phys.grShieldKBVel = d.grShieldKBVel;
      } else {
        const g = applyGroundShieldKnockback(
          player[i].phys.grShieldKBVel, skb,
          player[i].phys.groundNormal,
          player[i].charAttributes.traction);
        player[i].phys.grShieldKBVel = g.grShieldKBVel;
        skb.x = g.shieldKB.x;
        skb.y = g.shieldKB.y;
      }
    }

    player[i].phys.pos.x += player[i].phys.cVel.x + player[i].phys.kVel.x
                          + player[i].phys.shieldKBVel.x;
    player[i].phys.pos.y += player[i].phys.cVel.y + player[i].phys.kVel.y
                          + player[i].phys.shieldKBVel.y;

  }

};


function hurtBoxStateUpdate(i: number): void {
  if (player[i].actionState === "REBIRTH" || player[i].actionState === "REBIRTHWAIT") {
    player[i].phys.hurtBoxState = 1;
  }
  else {
    player[i].phys.hurtBoxState = 0;
  }
  if (player[i].phys.invincibleTimer > 0) {
    player[i].phys.invincibleTimer--;
    player[i].phys.hurtBoxState = 2;
  }
  if (player[i].phys.intangibleTimer > 0) {
    player[i].phys.intangibleTimer--;
    player[i].phys.hurtBoxState = 1;
  }
};

function outOfCameraUpdate(i: number): void {
  if (player[i].phys.outOfCameraTimer >= 60) {
    if (player[i].percent < 150) {
      player[i].percent++;
    }
    percentShake(40, i);
    sounds.outofcamera.play();
    player[i].phys.outOfCameraTimer = 0;
  }
};

function lCancelUpdate(i: number, input: any): void {

// if smash 64 lcancel, put any landingattackair action states into landing
  if (gameSettings.lCancelType === 2 && gameMode !== 5) {
    if (player[i].phys.lCancel) {
      if (player[i].actionState.substr(0, 16) === "LANDINGATTACKAIR") {
        player[i].actionState = "LANDING";
        player[i].timer = 1;
      }
    }
  }

  if (player[i].phys.lCancelTimer > 0) {
    player[i].phys.lCancelTimer--;
    if (player[i].phys.lCancelTimer === 0) {
      player[i].phys.lCancel = false;
    }
  }
  // l CANCEL
  if (player[i].phys.lCancelTimer === 0 &&

    ((input[i][0].lA > 0 && input[i][1].lA === 0) ||
     (input[i][0].rA > 0 && input[i][1].rA === 0) ||
     (input[i][0].z && !input[i][1].z))) {

    // if smash 64 lcancel, increase window to 11 frames
    if (gameSettings.lCancelType === 2 && gameMode !== 5) {
      player[i].phys.lCancelTimer = 11;
    } else {
      player[i].phys.lCancelTimer = 7;
    }
    player[i].phys.lCancel = true;
  }

  // if auto lcancel is on, always lcancel
  if (gameSettings.lCancelType === 1 && gameMode !== 5) {
    player[i].phys.lCancel = true;
  }

  // fp->dmg.x18ac_time_since_hit, Fighter_8006A360 (fighter.c:1681):
  //   if (fp->dmg.x18ac_time_since_hit != -1) fp->dmg.x18ac_time_since_hit++;
  // It starts at -1 (fighter.c:291) meaning "never hit" and is reset to 0 when
  // a hit is taken, so it counts frames since the LAST hit. Feeds the
  // replace-or-stack decision in stackKnockback.
  if (player[i].phys.timeSinceHit !== -1) {
    player[i].phys.timeSinceHit++;
  }

  // ft_800890D0 (ft_0881.c:324), driven from Fighter_ChangeMotionState
  // (fighter.c:1198): `ft_800890D0(fp, new_motion_state->move_id)`, which is
  //     if (move_id == 1 || move_id != fp->x2068_attackID) {
  //         fp->x2068_attackID = move_id;
  //         fp->x206C_attack_instance = plStale_IncrementAttackInstance();
  //     }
  // Melee runs it on the state CHANGE; meleelight has no single chokepoint for
  // that (every move's init() assigns actionState itself), so the same rule is
  // evaluated each frame against the current state. The outcome is identical:
  // the instance advances exactly when the attack id changes, so re-entering a
  // move through a neutral state gets a fresh instance while a multi-hit move
  // sitting in one state keeps its own.
  const mid = moveIdFor(characterSelections[i], player[i].actionState);
  if (mid === FT_MOVE_ID_DEFAULT || mid !== player[i].phys.attackId) {
    player[i].phys.attackId = mid;
    player[i].phys.attackInstance = nextAttackInstance();
  }

  // V Cancel
  if (player[i].phys.vCancelTimer > 0) {
    player[i].phys.vCancelTimer--;
  }

  if (player[i].phys.techTimer > 0) {
    player[i].phys.techTimer--;
  }

  if (player[i].phys.shoulderLockout > 0) {
    player[i].phys.shoulderLockout--;
  }

  if ((input[i][0].l && !input[i][1].l) ||
      (input[i][0].r && !input[i][1].r)) {

    if (!player[i].phys.grounded) {
      if (player[i].phys.shoulderLockout === 0) {
        player[i].phys.vCancelTimer = 3;
        player[i].phys.techTimer = 20;
      }
    }

    player[i].phys.shoulderLockout = 40;
  }
};


const nullSquashDatum = {location: null, factor: 1};

const ecbSquashData: [ SquashDatum
    , SquashDatum
    , SquashDatum
    , SquashDatum
    ] = [nullSquashDatum
  , nullSquashDatum
  , nullSquashDatum
  , nullSquashDatum];


function findAndResolveCollisions(i: number, input: any
    , oldBackward: bool
    , oldNotTouchingWalls: [bool, bool]
    , ecbOffset: [number, number, number, number]): [bool, bool, [bool, bool]] {

  let stillGrounded = true;
  let backward = oldBackward;
  const notTouchingWalls = oldNotTouchingWalls;
  const connected = activeStage.connected;

  // ------------------------------------------------------------------------------------------------------
  // grounded state movement

  if (player[i].phys.grounded) {

    const oldPosition = new Vec2D(player[i].phys.pos.x, player[i].phys.pos.y);

    const relevantGroundIndex = player[i].phys.onSurface[1];
    let relevantGroundType = "g";
    let relevantGround = activeStage.ground[relevantGroundIndex];

    if (player[i].phys.onSurface[0] === 1) {
      relevantGroundType = "p";
      relevantGround = activeStage.platform[relevantGroundIndex];
    }

    const relevantGroundTypeAndIndex = [relevantGroundType, relevantGroundIndex];

    [stillGrounded, backward] = dealWithGround(i, relevantGround, relevantGroundTypeAndIndex, connected, input);

  }

  // end of grounded state movement
  // ------------------------------------------------------------------------------------------------------

  // ------------------------------------------------------------------------------------------------------
  // main collision detection routine

  const notIgnoringPlatforms = ( (!actionStates[characterSelections[i]][player[i].actionState].canPassThrough || (input[i][0].lsY > -PLATFORM_DROP_STICK_THRESHOLD)) && !player[i].phys.passing );
  const isImmune = player[i].phys.hurtBoxState !== 0;

  const playerStatusInfo = {
    ignoringPlatforms: !notIgnoringPlatforms
    , grounded: player[i].phys.grounded
    , immune: isImmune
  };

  // type CollisionRoutineResult = { position : Vec2D, touching : null | SimpleTouchingDatum, squashDatum : SquashDatum, ecb : ECB};
  const collisionData = runCollisionRoutine(player[i].phys.ECB1
      , player[i].phys.ECBp
      , player[i].phys.pos
      , ecbSquashData[i]
      , playerStatusInfo
      , activeStage
  );

  ecbSquashData[i] = collisionData.squashDatum;

  const newPosition = collisionData.position;
  const newECB = collisionData.ecb;
  const touchingDatum = collisionData.touching;

  if (touchingDatum === null) {
    updatePosition(i, newPosition);
  }
  else if (touchingDatum.kind === "surface") {
    const surfaceLabel = touchingDatum.type;
    const surfaceIndex = touchingDatum.index;
    const pt = touchingDatum.pt;
    switch (surfaceLabel[0].toLowerCase()) {
      case "l": // player touching left wall
        notTouchingWalls[0] = false;
        dealWithWallCollision(i, newPosition, pt, "l", surfaceIndex, input);
        break;
      case "r": // player touching right wall
        notTouchingWalls[1] = false;
        dealWithWallCollision(i, newPosition, pt, "r", surfaceIndex, input);
        break;
      case "g": // player landed on ground
        dealWithGroundCollision(i, player[i].phys.grounded, newPosition, newECB[0], surfaceIndex, input);
        break;
      case "c": // player touching ceiling
        dealWithCeilingCollision(i, newPosition, newECB[2], surfaceIndex, input);
        break;
      case "p": // player landed on platform
        dealWithPlatformCollision(i, player[i].phys.grounded, newPosition, newECB[0], surfaceIndex, input);
        break;
      default:
        console.log("error in 'findAndResolveCollisions': unrecognised surface type.");
        break;
    }
  }
  else if (touchingDatum.kind === "corner") {
    const angularParameter = touchingDatum.angular;
    const cornerDamageType = touchingDatum.damageType !== undefined ? touchingDatum.damageType : null;
    dealWithCornerCollision(i, newPosition, newECB, angularParameter, cornerDamageType);
  }

  player[i].phys.ECB1 = newECB;

  // finally, calculate how much squashing is required by the ground
  if (player[i].phys.grounded) {
    const groundSquashFactor = groundedECBSquashFactor(new Vec2D(player[i].phys.pos.x, player[i].phys.pos.y + ecbOffset[3]) //    top non-squashed ECBp point
        , new Vec2D(player[i].phys.pos.x, player[i].phys.pos.y) // bottom non-squashed ECBp point, no offset as grounded
        , toList(activeStage.ceiling));
    if (groundSquashFactor !== null && (groundSquashFactor < ecbSquashData[i].factor)) {
      ecbSquashData[i] = {location: 0, factor: groundSquashFactor};
    }
    if (ecbSquashData[i] !== null) {
      ecbSquashData[i].location = 0;
    }
  }

  return [stillGrounded, backward, notTouchingWalls];
};


// The two ledge snap boxes, built exactly the way Melee builds them:
// mpColl_80044164 (mpcoll.c:1253) for the box extending RIGHT and
// mpColl_800443C4 (mpcoll.c:1326) for the mirrored one extending LEFT.
//
//   half   = 0.5 * ledge_snap_height
//   bottom = min(prev.y, cur.y) + ledge_snap_y - half
//   top    = max(prev.y, cur.y) + ledge_snap_y + half
//   right box:  left  = min(prev.x, cur.x)
//               right =  ledge_snap_x + max(prev.x, cur.x) + ecb.right.x
//   left box:   right = max(prev.x, cur.x)
//               left  = -ledge_snap_x + min(prev.x, cur.x) + ecb.left.x
//
// COORDINATE SPACE: Melee's `cd->ecb` holds OFFSETS from the position --
// every use in mpcoll.c reads `cd->cur_pos.x + cd->ecb.right.x`
// (mpcoll.c:1274), `cd->cur_pos.y + cd->ecb.bottom.y` (:1296) and so on.
// meleelight's `phys.ECB1` instead holds ABSOLUTE world points: it is built as
// `Vec2D(pos.x + ecbOffset[1], ...)` (see dealWithNonCollisions below) and the
// debug renderer draws it straight to screen with no position added
// (render.js:291).
//
// `ecb` is therefore taken in meleelight's absolute form and converted here,
// rather than at the call site: passing the absolute value straight through
// added the position a SECOND time, putting the box edge near
// `snap_x + 2*pos.x` instead of `snap_x + pos.x + halfWidth`. That grows
// without bound as the player moves away from the origin, so simply walking
// left or right eventually swept a ledge into the box and snapped the player
// to the edge of the stage. Doing the conversion inside the function keeps
// the two spaces from being mixed up again, and lets the test suite assert
// the whole path.
//
// The defining property, and the one that mix-up broke, is that the boxes are
// TRANSLATION INVARIANT: shifting the player by dx shifts both boxes by
// exactly dx and changes neither width.
//
// NB: meleelight's Box2D convention here is INVERTED -- `min.y` holds the TOP
// and `max.y` the bottom. The hit test reads `y < min.y && y > max.y`, and the
// debug renderer depends on it too, so keep it. Only the geometry is being
// ported, not the storage layout.
export function ledgeSnapBoxes(posX: number, posY: number,
                               prevX: number, prevY: number,
                               ecb: any,
                               snapX: number, snapY: number,
                               snapHeight: number): any {
  const ecbRight = ecb[1].x - posX;
  const ecbLeft = ecb[3].x - posX;

  const half = 0.5 * snapHeight;
  const boxBottom = Math.min(prevY, posY) + snapY - half;
  const boxTop = Math.max(prevY, posY) + snapY + half;
  const minX = Math.min(prevX, posX);
  const maxX = Math.max(prevX, posX);

  return {
    forward: new Box2D([minX, boxTop],
                       [snapX + maxX + ecbRight, boxBottom]),
    backward: new Box2D([-snapX + minX + ecbLeft, boxTop],
                        [maxX, boxBottom]),
  };
}

function dealWithLedges(i: number, input: any): void {
  // The snap box geometry lives in ledgeSnapBoxes() above. Two things it
  // gives over the previous static triple: the horizontal extent is measured
  // from the LIVE ECB EDGE rather than a hardcoded half-width, so it tracks
  // the character's actual width frame by frame; and the box is SWEPT between
  // last frame's position and this one, so a fast approach cannot tunnel past
  // the grab region between frames.
  //
  // ECB1 is the current frame's ECB (assigned from newECB); ECBp is the
  // in-progress collision copy, which is not what Melee reads here.
  const attrs = player[i].charAttributes;
  const posX = player[i].phys.pos.x;
  const posY = player[i].phys.pos.y;
  const prevX = player[i].phys.posPrev.x;
  const prevY = player[i].phys.posPrev.y;
  const ecb = player[i].phys.ECB1;

  const boxes = ledgeSnapBoxes(posX, posY, prevX, prevY, ecb,
                               attrs.ledgeSnapX, attrs.ledgeSnapY,
                               attrs.ledgeSnapHeight);
  player[i].phys.ledgeSnapBoxF = boxes.forward;
  player[i].phys.ledgeSnapBoxB = boxes.backward;


  if (player[i].phys.ledgeRegrabCount) {
    player[i].phys.ledgeRegrabTimeout--;
    if (player[i].phys.ledgeRegrabTimeout === 0) {
      player[i].phys.ledgeRegrabCount = false;
    }
  }

  // Melee has no per-state "can grab ledge" data field. Ledge grabbing is
  // OPT-IN per action state: a state's Coll callback either calls
  // ft_CheckGroundAndLedge (ft_081B.c:274) or it does not, and only the ones
  // that call it can catch a cliff. The `dir` argument is the facing
  // constraint -- CLIFFCATCH_BOTH/LEFT/RIGHT (ft/forward.h:251-253) -- which
  // is exactly what meleelight's two-element `canGrabLedge` encodes:
  //   [0] grab the ledge you are facing   (dir = ftGetFacingDirInt(fp))
  //   [1] grab it regardless of facing    (dir = CLIFFCATCH_BOTH)
  //
  // But meleelight only annotates the states that CAN grab; ~180 action
  // states carry no `canGrabLedge` at all, and this function dereferenced it
  // unconditionally. Any unannotated state that reached the box test threw
  // "Cannot read properties of undefined (reading '1')" and aborted physics
  // for the whole frame.
  //
  // Absent therefore means "this state has no ft_CheckGroundAndLedge call
  // site", i.e. cannot grab. Checked against the decomp for every unannotated
  // state that can actually reach here (the guard below already excludes
  // grounded states and states on a ledge):
  //   Rebirth      ftCo_Rebirth_Coll (ft_0D4D.c:209) -> ft_80083DCC
  //                (ft_081B.c:981), which calls mpColl_800478F4 alone
  //   RebirthWait  ftCo_RebirthWait_Coll (ft_0D4D.c:362) -> ft_80083844
  //                (ft_081B.c:870) -> mpColl_80048654 alone
  //   DeadUp/Left/Right/Down
  //                their motion state entries have a NULL Coll callback
  //                (ftmotionstates.c:168-177 and the entries following it)
  //   Capture*     grabbed states, likewise no ledge check
  //   fox/falco UPSPECIAL, puff JUMPAERIALB/F
  //                trampolines -- `init` immediately enters another state, so
  //                they are never a live actionState. Their real states are
  //                annotated and already agree with the decomp:
  //                UPSPECIALCHARGE [true,false] = ftFx_SpecialHiHoldAir_Coll
  //                  (ftfoxspecialhi.c:181, ftGetFacingDirInt)
  //                UPSPECIALLAUNCH [true,true]  = ftFx_SpecialAirHi_Coll
  //                  (ftfoxspecialhi.c:334, CLIFFCATCH_BOTH)
  //                FIREFOXBOUNCE   [true,false] = ftFx_SpecialHiBound_Coll
  //                  (ftfoxspecialhi.c:726, ftGetFacingDirInt)
  const canGrabLedgeIn = function (which) {
    const state = actionStates[characterSelections[i]][player[i].actionState];
    if (state === undefined || state.canGrabLedge === undefined) {
      return false;
    }
    return state.canGrabLedge[which];
  };

  let lsBF = -1;
  let lsBB = -1;
  let foundLedge = 0;
  if (player[i].phys.onLedge === -1 && !player[i].phys.ledgeRegrabCount) {
    for (let j = 0; j < activeStage.ledge.length; j++) {
      let ledgeAvailable = true;
      for (let k = 0; k < 4; k++) {
        if (playerType[k] > -1) {
          if (k !== i) {
            if (player[k].phys.onLedge === j) {
              ledgeAvailable = false;
            }
          }
        }
      }
      if (ledgeAvailable && !player[i].phys.grounded && player[i].hit.hitstun <= 0) {
        const x = activeStage[activeStage.ledge[j][0]][activeStage.ledge[j][1]][activeStage.ledge[j][2]].x;
        const y = activeStage[activeStage.ledge[j][0]][activeStage.ledge[j][1]][activeStage.ledge[j][2]].y;

        if (x > player[i].phys.ledgeSnapBoxF.min.x &&
            x < player[i].phys.ledgeSnapBoxF.max.x &&
            y < player[i].phys.ledgeSnapBoxF.min.y &&
            y > player[i].phys.ledgeSnapBoxF.max.y) {

          if (activeStage.ledge[j][2] === 0) {
            if (canGrabLedgeIn(0)) {
              lsBF = j;
            }
          } else if (canGrabLedgeIn(1)) {
            lsBF = j;
          }
        }
        // (was ledgeSnapBoxF.max.y -- a copy-paste slip. Harmless while the two
        // boxes share a vertical extent, which they do, but it tested the wrong
        // box and would break the moment that stopped being true.)
        if (x > player[i].phys.ledgeSnapBoxB.min.x &&
            x < player[i].phys.ledgeSnapBoxB.max.x &&
            y < player[i].phys.ledgeSnapBoxB.min.y &&
            y > player[i].phys.ledgeSnapBoxB.max.y) {

          if (activeStage.ledge[j][2] === 1) {
            if (canGrabLedgeIn(0)) {
              lsBB = j;
            }
          } else if (canGrabLedgeIn(1)) {
            lsBB = j;
          }
        }
      }
      if (player[i].phys.cVel.y < 0 && input[i][0].lsY > -0.5) {
        if (lsBF > -1) {
          foundLedge = activeStage.ledge[lsBF];
          if (foundLedge[2] * -2 + 1 === player[i].phys.face || canGrabLedgeIn(1)) {
            player[i].phys.onLedge = lsBF;
            player[i].phys.ledgeRegrabTimeout = 30;
            player[i].phys.face = foundLedge[2] * -2 + 1;
            player[i].phys.pos = new Vec2D(activeStage[foundLedge[0]][foundLedge[1]][foundLedge[2]].x + edgeOffset[0][0], activeStage[foundLedge[0]][foundLedge[1]][foundLedge[2]].y + edgeOffset[0][1]);
            actionStates[characterSelections[i]].CLIFFCATCH.init(i, input);
          }
        } else if (lsBB > -1) {
          foundLedge = activeStage.ledge[lsBB];
          if (foundLedge[2] * -2 + 1 === player[i].phys.face || canGrabLedgeIn(1)) {
            player[i].phys.onLedge = lsBB;
            player[i].phys.ledgeRegrabTimeout = 30;
            player[i].phys.face = foundLedge[2] * -2 + 1;
            player[i].phys.pos = new Vec2D(activeStage[foundLedge[0]][foundLedge[1]][foundLedge[2]].x + edgeOffset[1][0], activeStage[foundLedge[0]][foundLedge[1]][foundLedge[2]].y + edgeOffset[1][1]);
            actionStates[characterSelections[i]].CLIFFCATCH.init(i, input);
          }
        }
      }
    }
  }
};

function dealWithDeath(i: number, input: any): void {
  if (!actionStates[characterSelections[i]][player[i].actionState].dead && player[i].actionState !== "SLEEP") {
    let state = 0;
    if (player[i].phys.pos.x < activeStage.blastzone.min.x) {
      state = "DEADLEFT";
    } else if (player[i].phys.pos.x > activeStage.blastzone.max.x) {
      state = "DEADRIGHT";
    } else if (player[i].phys.pos.y < activeStage.blastzone.min.y) {
      state = "DEADDOWN";
    } else if (player[i].phys.pos.y > activeStage.blastzone.max.y && player[i].phys.kVel.y >= 2.4) {
      state = "DEADUP";
    }
    if (state !== 0) {
      player[i].phys.outOfCameraTimer = 0;
      turnOffHitboxes(i);
      // plStale_ResetStaleMoveTableForPlayer (ft_0D31.c:143). Dying clears the
      // DEAD player's own stale table -- the moves THEY landed are forgotten,
      // so they come back fresh. It does not touch the killer's.
      resetStaleTable(player[i].staleTable);
      player[i].stocks--;
      player[i].colourOverlayBool = false;
      lostStockQueue.push([i, player[i].stocks, 0]);
      if (player[i].stocks === 0 && versusMode) {
        player[i].stocks = 1;
      }
      actionStates[characterSelections[i]][state].init(i, input);
    }
  }
};

function updateHitboxes(i: number): void {
  player[i].phys.isInterpolated = false;
  for (let j = 0; j < 4; j++) {
    if (player[i].hitboxes.active[j] && player[i].phys.prevFrameHitboxes.active[j]) {
      if (player[i].phys.prevFrameHitboxes.id[j].offset[player[i].phys.prevFrameHitboxes.frame] === undefined) {
        continue;
      }
      if (player[i].hitboxes.id[j].offset[player[i].hitboxes.frame] === undefined) {
        continue;
      }

      const h1 = new Vec2D(
          player[i].phys.posPrev.x + (player[i].phys.prevFrameHitboxes.id[j].offset[player[i].phys.prevFrameHitboxes.frame].x * player[i].phys.facePrev),
          player[i].phys.posPrev.y + player[i].phys.prevFrameHitboxes.id[j].offset[player[i].phys.prevFrameHitboxes.frame].y
      );

      const h2 = new Vec2D(
          player[i].phys.pos.x + (player[i].hitboxes.id[j].offset[player[i].hitboxes.frame].x * player[i].phys.face),
          player[i].phys.pos.y + player[i].hitboxes.id[j].offset[player[i].hitboxes.frame].y
      );

      const a = h2.x - h1.x;
      const b = h2.y - h1.y;
      let x = 0;
      if (!(a === 0 || b === 0)) {
        x = Math.atan(Math.abs(a) / Math.abs(b));
      }
      {
        const opp = Math.sin(x) * player[i].hitboxes.id[j].size;
        const adj = Math.cos(x) * player[i].hitboxes.id[j].size;
        const sigma = [h1.x, h1.y];
        let alpha1;
        let alpha2;
        let beta1;
        let beta2;
        if ((a > 0 && b > 0) || (a <= 0 && b <= 0)) {
          alpha1 = new Vec2D((sigma[0] + adj), (sigma[1] - opp));
          alpha2 = new Vec2D((alpha1.x + a), (alpha1.y + b));
          beta1 = new Vec2D((sigma[0] - adj), (sigma[1] + opp));
          beta2 = new Vec2D((beta1.x + a), (beta1.y + b));
        }
        else {
          alpha1 = new Vec2D((sigma[0] - adj), (sigma[1] - opp));
          alpha2 = new Vec2D((alpha1.x + a), (alpha1.y + b));
          beta1 = new Vec2D((sigma[0] + adj), (sigma[1] + opp));
          beta2 = new Vec2D((beta1.x + a), (beta1.y + b));
        }
        player[i].phys.interPolatedHitbox[j] = [alpha1, alpha2, beta2, beta1];
      }

      {
        const opp = Math.sin(x) * player[i].hitboxes.id[j].size - gameSettings.phantomThreshold;
        const adj = Math.cos(x) * player[i].hitboxes.id[j].size - gameSettings.phantomThreshold;
        const sigma = [h1.x, h1.y];
        let alpha1;
        let alpha2;
        let beta1;
        let beta2;
        if ((a > 0 && b > 0) || (a <= 0 && b <= 0)) {
          alpha1 = new Vec2D((sigma[0] + adj), (sigma[1] - opp));
          alpha2 = new Vec2D((alpha1.x + a), (alpha1.y + b));
          beta1 = new Vec2D((sigma[0] - adj), (sigma[1] + opp));
          beta2 = new Vec2D((beta1.x + a), (beta1.y + b));
        }
        else {
          alpha1 = new Vec2D((sigma[0] - adj), (sigma[1] - opp));
          alpha2 = new Vec2D((alpha1.x + a), (alpha1.y + b));
          beta1 = new Vec2D((sigma[0] + adj), (sigma[1] + opp));
          beta2 = new Vec2D((beta1.x + a), (beta1.y + b));
        }
        player[i].phys.interPolatedHitboxPhantom[j] = [alpha1, alpha2, beta2, beta1];
        player[i].phys.isInterpolated = true;
      }
    }
  }
};


export function physics (i : number, input : any) : void {
  player[i].phys.passing = false;
  player[i].phys.posPrev = new Vec2D(player[i].phys.pos.x,player[i].phys.pos.y);
  player[i].phys.facePrev = player[i].phys.face;
  deepObjectMerge(true,player[i].phys.prevFrameHitboxes,player[i].hitboxes);

  // BEFORE the action state runs, not after.
  //
  // Melee updates the stick tilt timers in the fighter's input processing --
  // Fighter_Spaghetti_8006AD10 (fighter.c:1777), installed as GObj proc 3
  // (fighter.c:900) -- which runs ahead of the state's Anim/IASA callbacks. So
  // a state deciding whether to tap jump, smash turn, SDI or fastfall sees
  // THIS frame's timer.
  //
  // This used to sit near the end of physics(), after hitlagSwitchUpdate has
  // already run the action state's main(). Every state therefore read the
  // PREVIOUS frame's timer, which stretched every window by one frame: tap
  // jump effectively lasted 5 frames against Melee's tap_jump_window of 4. Fox
  // has a 3-frame jumpsquat, so holding UP still counted as a fresh jump input
  // on the first airborne frame and burned the double jump instantly -- one
  // press, two jumps.
  updateStickTiltTimers(i, input);

  hitlagSwitchUpdate(i, input);
  hurtBoxStateUpdate(i);
  outOfCameraUpdate(i);
  lCancelUpdate(i, input);

  if (!player[i].phys.grounded) {
    player[i].phys.airborneTimer++;
  }

  //console.log(player[i].timer);
  let frame = Math.floor(player[i].timer);
  if (frame === 0) {
    frame = 1;
  }
  if (frame > framesData[characterSelections[i]][player[i].actionState]) {
    frame = framesData[characterSelections[i]][player[i].actionState];
  }
  // The ECB tables were captured against the OLD frame counts, several of
  // which were one frame short of the real animation (see validate_frames.py).
  // Correcting setFrames therefore made `frame` reach one past the end of some
  // tables, and `table[frame - 1][0]` on an undefined row throws. Clamp to the
  // table's own length: an animation that outlives its ECB data holds the last
  // frame, which is what Melee does when an animation finishes.
  const ecbTable = ecb[characterSelections[i]][player[i].actionState];
  if (ecbTable !== undefined && frame > ecbTable.length) {
    frame = ecbTable.length;
  }
  //console.log(actionStates[characterSelections[i]][player[i].actionState].name+" "+(frame-1));

  /* global ecb */
  declare var ecb: any;
  const ecbOffset = actionStates[characterSelections[i]][player[i].actionState].dead ? [0, 0, 0, 0] : [ecb[characterSelections[i]][player[i].actionState][frame - 1][0]*player[i].charAttributes.ecbScale, ecb[characterSelections[i]][player[i].actionState][frame - 1][1]*player[i].charAttributes.ecbScale, ecb[characterSelections[i]][player[i].actionState][frame - 1][2]*player[i].charAttributes.ecbScale, ecb[characterSelections[i]][player[i].actionState][frame - 1][3]*player[i].charAttributes.ecbScale];

  const playerPosX = player[i].phys.pos.x;
  const playerPosY = player[i].phys.pos.y;
  player[i].phys.ECBp = [
    new Vec2D(player[i].phys.pos.x               , player[i].phys.pos.y + ((player[i].phys.grounded || player[i].phys.airborneTimer < 10) ? 0 : ecbOffset[0]) ),
    new Vec2D(player[i].phys.pos.x + Math.max(1, ecbOffset[1]), player[i].phys.pos.y + ecbOffset[2] ),
    new Vec2D(player[i].phys.pos.x               , player[i].phys.pos.y + ecbOffset[3] ),
    new Vec2D(player[i].phys.pos.x - ecbOffset[1], player[i].phys.pos.y + ecbOffset[2] )
  ];
  
  if (ecbSquashData[i] !== null && ecbSquashData[i].factor < 1) {
    if (ecbSquashData[i].factor * 2 * ecbOffset[1] < smallestECBWidth) {
      ecbSquashData[i].factor = (smallestECBWidth + 2 * additionalOffset) / (2 * ecbOffset[1]);
    }

    player[i].phys.ECBp = squashECBAt(player[i].phys.ECBp, {factor: ecbSquashData[i].factor, location: 0});
    if (!player[i].phys.grounded) {
      player[i].phys.ECBp = moveECB(player[i].phys.ECBp, new Vec2D(0, (ecbSquashData[i].factor - 1) * ecbOffset[0]));
    }
  }


  if (!actionStates[characterSelections[i]][player[i].actionState].ignoreCollision) {

    let notTouchingWalls = [true, true];
    let stillGrounded = true;
    let backward = false;

    [stillGrounded, backward, notTouchingWalls] = findAndResolveCollisions(i, input, backward, notTouchingWalls, ecbOffset);

    if (player[i].phys.grabbedBy === -1) {

      if (notTouchingWalls[0] && notTouchingWalls[1] && player[i].phys.canWallJump) {
        player[i].phys.wallJumpTimer = 254;
      }
      if (!notTouchingWalls[0] || !notTouchingWalls[1]) {
        if (player[i].phys.grounded) {
          const s = player[i].phys.onSurface[1];
          const surface = player[i].phys.onSurface[0] ? activeStage.platform[s] : activeStage.ground[s];
          if (player[i].phys.pos.x < surface[0].x - 0.1 || player[i].phys.pos.x > surface[1].x + 0.1) {
            stillGrounded = false;
          }
        }
      }
      if (!stillGrounded) {
        player[i].phys.grounded = false;
        if (typeof actionStates[characterSelections[i]][player[i].actionState].airborneState !== 'undefined') {
          player[i].actionState = actionStates[characterSelections[i]][player[i].actionState].airborneState;
        } else {
          if (actionStates[characterSelections[i]][player[i].actionState].missfoot && backward) {
            actionStates[characterSelections[i]].MISSFOOT.init(i,input);
          } else {
            if (player[i].phys.grabbing !== -1) {
              actionStates[characterSelections[player[i].phys.grabbing]].FALL.init(player[i].phys.grabbing,input,true);
              player[player[i].phys.grabbing].phys.grabbedBy = -1;
              player[i].phys.grabbing = -1;
            }
            actionStates[characterSelections[i]].FALL.init(i,input);
          }
          if (Math.abs(player[i].phys.cVel.x) > player[i].charAttributes.aerialHmaxV) {
            player[i].phys.cVel.x = Math.sign(player[i].phys.cVel.x) * player[i].charAttributes.aerialHmaxV;
          }
        }
        player[i].phys.shielding = false;
      }
      if (player[i].phys.grounded) {
        for (let j = 0; j < 4; j++) {
          if (playerType[j] > -1) {
            if (i !== j) {
              if (player[j].phys.grounded &&
                  player[j].phys.onSurface[0] === player[i].phys.onSurface[0] &&
                  player[j].phys.onSurface[1] === player[i].phys.onSurface[1]) {
  
                if (player[i].phys.grabbing !== j && player[i].phys.grabbedBy !== j) {
                  // TODO: this pushing code needs to account for players on slanted surfaces
                  const diff = Math.abs(player[i].phys.pos.x - player[j].phys.pos.x);
                  if (diff < 6.5 && diff > 0) {
                    player[j].phys.pos.x += Math.sign(player[i].phys.pos.x - player[j].phys.pos.x) * -0.3;
                  } else if (diff === 0 && Math.abs(player[i].phys.cVel.x) > Math.abs(player[j].phys.cVel.x)) {
                    player[j].phys.pos.x += Math.sign(player[i].phys.cVel.x) * -0.3;
                  }
                }
              }
            }
          }
        }
      }
    }
    
  }

  else { // player ignoring collisions
    player[i].phys.ECB1 = [
      new Vec2D( player[i].phys.pos.x               , player[i].phys.pos.y + ((player[i].phys.grounded || player[i].phys.airborneTimer < 10) ? 0 : ecbOffset[0]) ),
      new Vec2D( player[i].phys.pos.x + ecbOffset[1], player[i].phys.pos.y + ecbOffset[2] ),
      new Vec2D( player[i].phys.pos.x               , player[i].phys.pos.y + ecbOffset[3] ),
      new Vec2D( player[i].phys.pos.x - ecbOffset[1], player[i].phys.pos.y + ecbOffset[2] )
    ];
  }

  if (player[i].phys.shielding === false) {
    player[i].phys.shieldHP += 0.07;
    if (player[i].phys.shieldHP > 60) {
      player[i].phys.shieldHP = 60;
    }
  }


  dealWithLedges(i, input);
  dealWithDeath(i, input);


  player[i].phys.hurtbox = new Box2D(
      [playerPosX - player[i].charAttributes.hurtboxOffset[0], playerPosY + player[i].charAttributes.hurtboxOffset[1]],
      [playerPosX + player[i].charAttributes.hurtboxOffset[0], playerPosY]
  );

  if (gameMode === 3 && player[i].phys.posPrev.y > -80 && playerPosY <= -80) {
    sounds.lowdown.play();
  }

  updateHitboxes(i);

  player[i].phys.posDelta = new Vec2D(
      Math.abs(playerPosX - player[i].phys.posPrev.x),
      Math.abs(playerPosY - player[i].phys.posPrev.y)
  );

  if (showDebug) {
    document.getElementById('actState' + i).innerHTML = player[i].currentAction + " " + player[i].currentSubaction + " : " + player[i].actionState;
    document.getElementById('stateNum' + i).innerHTML = frame.toString();
    document.getElementById('face' + i).innerHTML = player[i].phys.face;
    document.getElementById("velocityX" + i).innerHTML = player[i].phys.cVel.x.toFixed(5);
    document.getElementById("velocityY" + i).innerHTML = player[i].phys.cVel.y.toFixed(5);
    document.getElementById("kvelocityX" + i).innerHTML = player[i].phys.kVel.x.toFixed(5);
    document.getElementById("kvelocityY" + i).innerHTML = player[i].phys.kVel.y.toFixed(5);
    document.getElementById("pvelocityX" + i).innerHTML = playerPosX.toFixed(5);
    document.getElementById("pvelocityY" + i).innerHTML = playerPosY.toFixed(5);
  }
}
