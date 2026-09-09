import {playerType, player, characterSelections, screenShake, gameMode, percentShake} from "main/main";

import {gameSettings} from "settings";
import {sounds} from "main/sfx";
import {turnOffHitboxes, actionStates, calcShieldstun, calcShieldPushback,
        shieldAnalogToLightshield, calcAttackerShieldPushback, getEnvDmg} from "physics/actionStateShortcuts";
import {setGroundVelocity} from "physics/groundMovement";
import {calcHitstun, calcKnockback, applyKnockbackModifiers, calcHitlag,
        calcLaunchAngle, knockbackToVelocity, applyDI} from "physics/knockback";
import {drawVfx} from "main/vfx/drawVfx";
import {Vec2D} from "../main/util/Vec2D";
import {Segment2D} from "../main/util/Segment2D";
import {euclideanDist} from "../main/linAlg";
import {getSameAndOther} from "./environmentalCollision";
import {sweepCircleVsSweepCircle, sweepCircleVsAABB} from "./interpolatedCollision";
import {hitsHurtCapsules} from "physics/hurtboxCollision";
import {capsuleOverlap} from "physics/capsule";
import {moveIdFor, staleDamage, pushStaleMove} from "physics/staling";
import {applySmashCharge} from "physics/smashCharge";
/* eslint-disable */

export let hitQueue = [];
export function resetHitQueue(){
  hitQueue =[];
}
export let phantomQueue = [];
export function setPhantonQueue(val){
  phantomQueue = val;
}
// angleConversion REMOVED with getLaunchAngle, its only user. Degrees ->
// radians in live code goes through mtxDegToRad (trig.js), which uses the
// game's float32 literal rather than the double pi/180 -- the two land on
// different float32 values for 33 of the integer trajectories.

// ftCommon_CalcHitlag tests `(unsigned)msid - ftCo_MS_Squat <= 1`
// (ftcommon.c:643) against the RECEIVING fighter's state -- Squat and
// SquatWait, not SquatRv. The `crouch` flag carries that; see SQUATRV.js.
export function isCrouching (n) {
  const st = actionStates[characterSelections[n]][player[n].actionState];
  return !!(st && st.crouch);
}

export function hitDetect (p,input){
    var attackerClank = false;
    for (var i = 0; i < 4; i++) {
        if (playerType[i] > -1) {
            if (i != p) {
                // check if victim is already in hitList
                var inHitList = false;
                for (var k = 0; k < player[p].hitboxes.hitList.length; k++) {
                    if (i == player[p].hitboxes.hitList[k]) {
                        inHitList = true;
                        break;
                    }
                }
                if (!inHitList) {
                    var storedPhantom = -1;
                    for (var j = 0; j < 4; j++) {
                        if (player[p].hitboxes.active[j] && player[p].phys.prevFrameHitboxes.active[j]) {
                            var interpolate = true;
                        } else {
                            var interpolate = false;
                        }
                        if (player[p].hitboxes.active[j] && !(player[p].phys.thrownHitbox && player[p].phys.thrownHitboxOwner ==
                            i) && player[p].hitboxes.id[j].type != 7) {
                            //console.log(player[i].phys.shielding);
                            // clank == 6 means special clank
                            if (player[p].hitboxes.id[j].clank == 1 || (player[p].hitboxes.id[j].clank == 2 && player[p].phys.grounded) ||
                                player[p].hitboxes.id[j].clank == 6) {
                                for (var k = 0; k < 4; k++) {
                                    if (player[i].hitboxes.active[k] && (player[i].hitboxes.id[k].clank == 1 || (player[i].hitboxes.id[
                                            k].clank == 2 && player[i].phys.grounded) || (player[p].hitboxes.id[j].clank == 6 && player[i]
                                            .hitboxes.id[k].clank != 6))) {

                                        var clankHit = interpolate && player[i].phys.prevFrameHitboxes.active[k]
                                                     ? interpolatedHitHitCollision(i,p,j,k)
                                                     : hitHitCollision(i, p, j, k); // also need to do interpolated vs non-interpolated hitboxes
                                        if (clankHit[0]) {

                                            var diff = player[p].hitboxes.id[j].dmg - player[i].hitboxes.id[k].dmg;
                                            if (player[p].hitboxes.id[j].clank == 6) {
                                                attackerClank = true;
                                                drawVfx({
                                                  name: "clank",
                                                  pos: clankHit[1]
                                                });
                                                player[p].phys.hurtBoxState = 1;
                                                player[p].phys.intangibleTimer = 1;
                                                // double check still in action state for some weird case
                                                if (actionStates[characterSelections[p]][player[p].actionState].specialClank) {
                                                    actionStates[characterSelections[p]][player[p].actionState].onClank(p,input);
                                                }
                                            } else {
                                                // Clank hitlag. ftColl_8007699C (ftcoll.c:417)
                                                // sets `fp1->dmg.int_value = int_dmg` from the
                                                // OPPOSING hitbox's damage, and Fighter_procUpdate
                                                // (fighter.c:2920) picks that up as `bool1` -- the
                                                // clank branch converges on the SAME capped
                                                // ftCommon_CalcHitlag every other hit path uses
                                                // (fighter.c:2966).
                                                //
                                                // `int_dmg` is getEnvDmg: truncate to int, but a
                                                // nonzero damage that truncates to 0 becomes 1.
                                                //
                                                // The near-miss worth recording: ftcoll.c:350 also
                                                // writes `int_dmg * x3D0 + x3D4` (slope 0.3, not
                                                // 1/3) into x191C, which looks like a rival hitlag
                                                // formula and is not one -- ftCo_80099D9C
                                                // (ftCo_Rebound.c:23) divides the clank animation
                                                // length by it, so it is the REBOUND STATE's
                                                // duration in frames, the same trick shieldstun
                                                // uses. Two plausible formulas, different
                                                // quantities.
                                                if (diff >= 9) {
                                                    // victim clank
                                                    // attacker cut through
                                                    player[i].hit.hitlag = calcHitlag(getEnvDmg(player[p].hitboxes.id[j].dmg));
                                                    turnOffHitboxes(i);
                                                    actionStates[characterSelections[i]].CATCHCUT.init(i,input);
                                                } else if (diff <= -9) {
                                                    // attacker clank
                                                    // victim cut through
                                                    player[p].hit.hitlag = calcHitlag(getEnvDmg(player[i].hitboxes.id[k].dmg));
                                                    attackerClank = true;
                                                    turnOffHitboxes(p);
                                                    actionStates[characterSelections[p]].CATCHCUT.init(p,input);
                                                } else {
                                                    // both clank
                                                    player[i].hit.hitlag = calcHitlag(getEnvDmg(player[p].hitboxes.id[j].dmg));
                                                    player[p].hit.hitlag = calcHitlag(getEnvDmg(player[i].hitboxes.id[k].dmg));
                                                    attackerClank = true;
                                                    turnOffHitboxes(i);
                                                    actionStates[characterSelections[i]].CATCHCUT.init(i,input);
                                                    turnOffHitboxes(p);
                                                    actionStates[characterSelections[p]].CATCHCUT.init(p,input);
                                                }
                                                sounds.clank.play();
                                                drawVfx({
                                                  name: "clank",
                                                  pos: clankHit[1]
                                                });
                                                player[p].hitboxes.hitList.push(i);
                                                player[p].hasHit = true;
                                            }
                                            break;
                                        }

                                    }
                                }
                            }
                            if (!attackerClank) {
                                if (player[i].phys.shielding && player[p].hitboxes.id[j].hitGrounded && (hitShieldCollision(i, p, j,
                                        false) || (interpolate && (hitShieldCollision(i, p, j, true) || interpolatedHitCircleCollision(
                                        player[i].phys.shieldPositionReal, player[i].phys.shieldSize, p, j))))) {
                                    hitQueue.push([i, p, j, true, false, false]);
                                    player[p].hitboxes.hitList.push(i);
                                    setHasHit(p, j);
                                    break;
                                } else if (player[i].phys.hurtBoxState != 1) {
                                    //
                                    if ((player[p].hitboxes.id[j].hitGrounded && player[i].phys.grounded) || (player[p].hitboxes.id[j].hitAirborne &&
                                        !player[i].phys.grounded))
                                        if (hitHurtCollision(i, p, j, false) || (interpolate && (interpolatedHitHurtCollision(i, p, j) ||
                                            hitHurtCollision(i, p, j, true)))) {
                                            if (!hitHurtCollision(i, p, j, false, true) && (interpolate ? !interpolatedHitHurtCollision(i,
                                                    p, j, true) : true)) {
                                                storedPhantom = j;
                                            } else {
                                                hitQueue.push([i, p, j, false, false, false, false]);
                                                if(player[p].hitboxes)
                                                if(player[p].hitboxes.hitList)
                                                if(player[p].hitboxes.hitList instanceof Array)
                                                player[p].hitboxes.hitList.push(i);
                                                setHasHit(p, j);
                                                break;
                                            }
                                        }
                                }
                            }
                        }
                        if (storedPhantom > -1) {
                            hitQueue.push([i, p, storedPhantom, false, false, false, true]);
                            player[p].hitboxes.hitList.push(i);
                            setHasHit(p, storedPhantom);
                        }
                    }
                }

            }
        }
    }
}

export function setHasHit (p,j){
  // for turbo mode. if not a grab and not counter and not a midthrow hitbox.
  if (player[p].hitboxes.id[j].type != 2 && player[p].hitboxes.id[j].type != 6 && player[p].actionState.substr(0, 5) !=
    "THROW") {
    player[p].hasHit = true;
  }
}

export function hitHitCollision (i,p,j,k){


  let framePos1 = player[p].hitboxes.frame;
  if(framePos1 > 1){
    framePos1 = 1;
  }
  let framePos2 = player[i].hitboxes.frame;
  if(framePos2 > 1){
    framePos2 = 1;
  }
  var hbpos = new Vec2D(player[p].phys.pos.x + (player[p].hitboxes.id[j].offset[framePos1].x * player[
            p].phys.face), player[p].phys.pos.y + player[p].hitboxes.id[j].offset[framePos1].y);
    var hbpos2 = new Vec2D(player[i].phys.pos.x + (player[i].hitboxes.id[k].offset[framePos2].x * player[
            i].phys.face), player[i].phys.pos.y + player[i].hitboxes.id[k].offset[framePos2].y);

    var hitPoint = new Vec2D((hbpos.x + hbpos2.x) / 2, (hbpos.y + hbpos2.y) / 2);

    // ftcoll.c:1778 -- hit-vs-hit (clank) goes through lbColl_80007AFC, the
    // SAME 3D capsule test as hit-vs-hurt, not a separate 2D one. So the depth
    // axis decides clanks too: two attacks whose hitboxes pass on either side
    // of each other in Melee's X do not trade.
    //
    // This was a flat circle-circle test on (x, y) with the depth thrown away,
    // which made every attack clank that merely lined up horizontally.
    const zA = hitboxDepth(p, j, framePos1);
    const zB = hitboxDepth(i, k, framePos2);
    const a = { x: hbpos.x,  y: hbpos.y,  z: zA };
    const b = { x: hbpos2.x, y: hbpos2.y, z: zB };
    // Both are single-frame points here, so each capsule has zero length --
    // spheres, which the same routine handles. Melee draws no distinction.
    return [ capsuleOverlap(a, a, b, b,
                            player[p].hitboxes.id[j].size,
                            player[i].hitboxes.id[k].size)
           , hitPoint];
}

// The depth (Melee's X) of player `p`'s hitbox `j` at interpolation index
// `frame`, mirrored by facing. Offsets that have not been baked in 3D are
// Vec2D and sit at depth 0, which is what the old flat test assumed for
// everything.
function hitboxDepth (p, j, frame) {
  const off = player[p].hitboxes.id[j].offset[frame];
  return (off && off.z !== undefined) ? off.z * player[p].phys.face : 0;
}

export function interpolatedHitHitCollision(i,p,j,k) {
  const h1p = new Vec2D ( player[p].phys.posPrev.x + (player[p].phys.prevFrameHitboxes.id[j].offset[player[p].phys.prevFrameHitboxes.frame].x * player[p].phys.facePrev)
                        , player[p].phys.posPrev.y +  player[p].phys.prevFrameHitboxes.id[j].offset[player[p].phys.prevFrameHitboxes.frame].y );
  const h2p = new Vec2D ( player[p].phys.pos.x + (player[p].hitboxes.id[j].offset[player[p].hitboxes.frame].x * player[p].phys.face)
                        , player[p].phys.pos.y +  player[p].hitboxes.id[j].offset[player[p].hitboxes.frame].y );
  const h1i = new Vec2D ( player[i].phys.posPrev.x + (player[i].phys.prevFrameHitboxes.id[k].offset[player[i].phys.prevFrameHitboxes.frame].x * player[i].phys.facePrev)
                        , player[i].phys.posPrev.y +  player[i].phys.prevFrameHitboxes.id[k].offset[player[i].phys.prevFrameHitboxes.frame].y );
  const h2i = new Vec2D ( player[i].phys.pos.x + (player[i].hitboxes.id[k].offset[player[i].hitboxes.frame].x * player[p].phys.face)
                        , player[i].phys.pos.y +  player[i].hitboxes.id[k].offset[player[i].hitboxes.frame].y );
  const r = player[p].hitboxes.id[j].size;
  const s = player[i].hitboxes.id[k].size;

  const collision = sweepCircleVsSweepCircle ( h1p, r, h2p, r, h1i, s, h2i, s );

  if (collision === null) {
    return [false, null];
  }
  else {
    return [true, collision];
  }

}

export function hitShieldCollision (i,p,j,previous){
    if (previous) {
      let checkPreviousFrame = player[p].phys.prevFrameHitboxes.frame;
      if( checkPreviousFrame> 1){
        checkPreviousFrame = 1;
      }
        var hbpos = new Vec2D(player[p].phys.posPrev.x + (player[p].phys.prevFrameHitboxes.id[j].offset[checkPreviousFrame].x * player[p].phys.facePrev), player[p].phys.posPrev.y + player[p].phys.prevFrameHitboxes.id[j].offset[checkPreviousFrame].y);
    } else {
      let checkFrame = player[p].hitboxes.frame;
      if( checkFrame> 1){
        checkFrame = 1;
      }
        var hbpos = new Vec2D(player[p].phys.pos.x + (player[p].hitboxes.id[j].offset[checkFrame].x *
            player[p].phys.face), player[p].phys.pos.y + player[p].hitboxes.id[j].offset[checkFrame].y);
    }
    var shieldpos = player[i].phys.shieldPositionReal;

    return (Math.pow(shieldpos.x - hbpos.x, 2) + Math.pow(hbpos.y - shieldpos.y, 2) <= Math.pow(player[p].hitboxes.id[j]
            .size + player[i].phys.shieldSize, 2));
}

export function interpolatedHitCircleCollision (circlePos,r,p,j){

  let prevPosFrame = player[p].phys.prevFrameHitboxes.frame;
  if (prevPosFrame > 1){
    prevPosFrame = 1;
  }
  let posFrame = player[p].hitboxes.frame;
  if (posFrame > 1){
    posFrame = 1;
  }
  var h1 = new Vec2D(player[p].phys.posPrev.x + (player[p].phys.prevFrameHitboxes.id[j].offset[prevPosFrame].x * player[p].phys.facePrev), player[p].phys.posPrev.y + player[p].phys.prevFrameHitboxes.id[j].offset[
            prevPosFrame].y);
  var h2 = new Vec2D(player[p].phys.pos.x + (player[p].hitboxes.id[j].offset[posFrame].x * player[p].phys
            .face), player[p].phys.pos.y + player[p].hitboxes.id[j].offset[posFrame].y);
  const s = player[p].hitboxes.id[j].size;
  const collision = sweepCircleVsSweepCircle ( h1, s, h2, s, circlePos, r, circlePos, r );

  if (collision === null) {
    return false;
  }
  else {
    return true;
  }
}

export function segmentSegmentCollision (a1,a2,b1,b2){
    var intersection = new Vec2D(0, 0);
    var b = new Vec2D(a2.x - a1.x, a2.y - a1.y);
    var d = new Vec2D(b2.x - b1.x, b2.y - b1.y);
    var bDotDPerp = b.x * d.y - b.y * d.x;
    // if b dot d == 0, it means the lines are parallel so have infinite intersection points
    if (bDotDPerp == 0) {
        return false;
    }
    var c = new Vec2D(b1.x - a1.x, b1.y - a1.y);
    var t = (c.x * d.y - c.y * d.x) / bDotDPerp;
    if (t < 0 || t > 1) {
        return false;
    }
    var u = (c.x * b.y - c.y * b.x) / bDotDPerp;
    if (u < 0 || u > 1) {
        return false;
    }
    intersection = new Vec2D(a1.x + t * b.x, a1.y + t * b.y);
    return true;
}

export function interpolatedHitHurtCollision (i,p,j,phantom){
  phantom = phantom || false;
  const hurt = player[i].phys.hurtbox;
  let hb;
  if (phantom) {
    hb = player[p].phys.interPolatedHitbox[j];
  } else {
    hb = player[p].phys.interPolatedHitboxPhantom[j];
  }

  const h1 = new Vec2D (0.5*hb[0].x + 0.5*hb[3].x, 0.5*hb[0].y + 0.5*hb[3].y);
  const h2 = new Vec2D (0.5*hb[1].x + 0.5*hb[2].x, 0.5*hb[1].y + 0.5*hb[2].y);
  const r = 0.5 * euclideanDist(hb[0], hb[3]);

  // The swept hitbox is already a capsule -- h1 to h2 with radius r, which is
  // exactly Melee's hit capsule from last frame's position to this one. What
  // was missing was the other side: this tested it against a static box.
  //
  // The DEPTH of the sweep comes from the hitbox offsets, which are baked in
  // 3D. The interpolated corners here are 2D, so the depth is taken from the
  // offset directly rather than being interpolated with them.
  const off = hitboxOffsetOf(p, j, false);
  const offPrev = hitboxOffsetOf(p, j, true);
  const zNow = (off && off.z !== undefined) ? off.z * player[p].phys.face : 0;
  const zPrev = (offPrev && offPrev.z !== undefined)
    ? offPrev.z * player[p].phys.facePrev : zNow;
  const capsuleHit = hitsHurtCapsules(
    i, {x: h1.x, y: h1.y, z: zPrev}, {x: h2.x, y: h2.y, z: zNow}, r, 0);
  if (capsuleHit !== null) {
    return capsuleHit;
  }

  // No hurtbox data for this state -- 19 states across the five characters have
  // no animation on the disc at all, most of them death states. Fall back to
  // the old box rather than making the fighter untouchable.
  const collision = sweepCircleVsAABB ( h1, r, h2, r, hurt.min, hurt.max );

  if (collision === null) {
    return false;
  }
  else {
    return true;
  }
}

// The offset a hitbox is using this frame, or null if it has none. Mirrors the
// indexing hitHurtCollision does.
function hitboxOffsetOf (p, j, previous) {
  const set = previous ? player[p].phys.prevFrameHitboxes : player[p].hitboxes;
  if (set === undefined || set.id[j] === undefined) { return null; }
  let f = set.frame;
  if (f > 1) { f = 1; }
  const o = set.id[j].offset[f];
  return o === undefined ? null : o;
}

export function hitHurtCollision (i,p,j,previous,phantom){
    phantom = phantom || false;
  let playerframe = player[p].hitboxes.frame;
  if(playerframe > 1){
    playerframe = 1;
  }
  var offset = player[p].hitboxes.id[j].offset[playerframe];
    if (offset === undefined){
      return false;
    }
    if (player[p].actionState == "DAMAGEFLYN") {
        offset = player[p].hitboxes.id[j].offset[0];
    }
    if (previous) {
      let prevframe = player[p].phys.prevFrameHitboxes.frame;
      if(prevframe > 1){
        prevframe = 1;
      }
      const prevoffset = player[p].phys.prevFrameHitboxes.id[j].offset[prevframe];
      if(prevoffset === undefined){
        return false;
      }
      var hbpos = new Vec2D(player[p].phys.posPrev.x + (prevoffset.x * player[p].phys.facePrev), player[p].phys.posPrev.y + prevoffset.y);
    } else {
        var hbpos = new Vec2D(player[p].phys.pos.x + (offset.x * player[p].phys.face), player[p].phys.pos.y + offset.y);
    }
    // A hitbox with no sweep is a capsule of zero length -- a sphere -- which
    // the same test handles. Melee makes no distinction between the two cases.
    const useOffset = previous ? player[p].phys.prevFrameHitboxes.id[j].offset[
                                   Math.min(player[p].phys.prevFrameHitboxes.frame, 1)]
                               : offset;
    const zHit = (useOffset && useOffset.z !== undefined)
      ? useOffset.z * (previous ? player[p].phys.facePrev : player[p].phys.face)
      : 0;
    const pt = {x: hbpos.x, y: hbpos.y, z: zHit};
    const capsuleHit = hitsHurtCapsules(
      i, pt, pt, player[p].hitboxes.id[j].size,
      phantom ? gameSettings.phantomThreshold : 0);
    if (capsuleHit !== null) {
      return capsuleHit;
    }

    // Fallback for states with no hurtbox data. NOTE the box below is 8 by 18
    // for EVERY character -- it does not even use hurtboxOffset, let alone the
    // animation. It is kept only so an unmapped state still collides somehow.
    var hurtCenter = new Vec2D((player[i].phys.hurtbox.min.x + player[i].phys.hurtbox.max.x) / 2, (player[i].phys.hurtbox
            .min.y + player[i].phys.hurtbox.max.y) / 2);

    var distance = new Vec2D(Math.abs(hbpos.x - hurtCenter.x), Math.abs(hbpos.y - hurtCenter.y));

    var hurtWidth = 8;
    var hurtHeight = 18;

    if (distance.x > (hurtWidth / 2 + player[p].hitboxes.id[j].size - (phantom ? gameSettings.phantomThreshold : 0))) {
        return false; }
    if (distance.y > (hurtHeight / 2 + player[p].hitboxes.id[j].size - (phantom ? gameSettings.phantomThreshold : 0))) {
        return false; }

    if (distance.x <= (hurtWidth / 2)) {
        return true; }
    if (distance.y <= (hurtHeight / 2)) {
        return true; }

    var cornerDistance_sq = Math.pow(distance.x - hurtWidth / 2, 2) +
        Math.pow(distance.y - hurtHeight / 2, 2);

    return (cornerDistance_sq <= (Math.pow(player[p].hitboxes.id[j].size - (phantom ? gameSettings.phantomThreshold : 0),
        2)));
}

export function cssHits(input) {
  for (var i = 0; i < hitQueue.length; i++) {

    var v = hitQueue[i][0];
    if(v === -1){
      continue;
    }
    var a = hitQueue[i][1];
    var h = hitQueue[i][2];
    var shieldHit = hitQueue[i][3];
    var isThrow = hitQueue[i][4];
    var drawBounce = hitQueue[i][5];
    var phantom = hitQueue[i][6] || false;
    let frame = player[i].hitboxes.frame;
    if(frame > 1){
      frame = 1;
    }
    const damage = player[a].hitboxes.id[h].dmg;

    if (shieldHit) {
      sounds.blunthit.play();
      player[v].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(v)});
      if (player[v].phys.powerShieldActive) {
        player[v].phys.powerShielded = true;
        player[v].hit.powershield = true;
        drawVfx({
          name: "impactLand",
          pos: player[v].phys.pos,
          face: player[v].phys.face
        });
        drawVfx({
          name: "powershield",
          pos: player[v].phys.shieldPositionReal,
          face: player[v].phys.face
        });
        sounds.powershield.play();
      }
      player[v].hit.shieldstun = ((Math.floor(damage) * ((0.65 * (1 - ((player[v].phys.shieldAnalog - 0.3) / 0.7))) +
            0.3)) * 1.5) + 2;
    } else {
      player[a].rpsPoints++;
      player[v].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(v)});
      player[v].hit.knockback = getKnockback(player[a].hitboxes.id[h], damage, damage, 0, player[v].charAttributes.weight,
            false, false);
      player[v].hit.hitPoint = new Vec2D(player[a].phys.pos.x + (player[a].hitboxes.id[h].offset[frame].x * player[a].phys.face), player[a].phys.pos.y + player[a].hitboxes.id[h].offset[frame].y);
      if (player[a].phys.pos.x < player[v].phys.pos.x) {
        player[v].hit.reverse = false;
        player[v].phys.face = -1;
      } else {
        player[v].hit.reverse = true;
        player[v].phys.face = 1;
      }
      actionStates[characterSelections[v]].DAMAGEN2.init(v,input);
      screenShake(player[v].hit.knockback);
      sounds.swordreallystronghit.play();
    }
  }
}

export function executeShieldHit(input, v, a, h, damage) {
  if (!player[v].phys.powerShieldActive) {
    player[v].phys.shieldHP -= damage;
    if (player[v].phys.shieldHP < 0) {
      player[v].phys.shielding = false;
      player[v].phys.cVel.y = 2.5;
      player[v].phys.grounded = false;
      player[v].phys.shieldHP = 0;
      drawVfx({
        name: "breakShield",
        pos: player[v].phys.pos,
        face: player[v].phys.face
      });
      actionStates[characterSelections[v]].SHIELDBREAKFALL.init(v,input);
      sounds.shieldbreak.play();
      return;
    }
  }
  player[v].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(v)});

  let vPushMultiplier = 0.6;
  if (player[v].phys.powerShieldActive) {
    vPushMultiplier = 1;
    player[v].phys.powerShielded = true;
    player[v].hit.powershield = true;
    drawVfx({
      name: "impactLand",
      pos: player[v].phys.pos,
      face: player[v].phys.face
    });
    drawVfx({
      name: "powershield",
      pos: player[v].phys.shieldPositionReal,
      face: player[v].phys.face
    });
    sounds.powershield.play();
  } else {
    let frame = player[v].hitboxes.frame;
    if(frame > 1){
      frame = 1;
    }
    drawVfx({
      name: "clank",
      pos: new Vec2D(player[a].phys.pos.x + (player[a].hitboxes.id[h].offset[player[a].hitboxes.frame].x * player[a].phys.face), player[a].phys.pos.y + player[a].hitboxes.id[h].offset[player[a].hitboxes.frame].y)
    });
  }
  // ftCo_80092F2C (decomp: src/melee/ft/kinds/ftCommon/ftCo_Guard.c:661).
  //
  // Stun is computed first, and pushback is DERIVED FROM THE STUN FRAMES --
  // not recomputed from damage. meleelight previously used an independent
  // expression for pushback with different coefficients and an extra +0.4
  // constant term, which does not reduce to the decomp's formula.
  //
  // The stun formula itself was already algebraically correct here; it is
  // restated via calcShieldstun so the constants come from PlCo.dat and the
  // arithmetic is exact float32.
  const lightshield = shieldAnalogToLightshield(player[v].phys.shieldAnalog);
  player[v].hit.shieldstun = calcShieldstun(damage, lightshield);

  // NB: calcShieldPushback applies x2BC (0.6) internally based on the
  // powershield flag. vPushMultiplier is meleelight's spelling of that exact
  // constant (0.6 normally, 1 when powershielding), so it must NOT be applied
  // again here -- doing so would square it.
  const victimPush = calcShieldPushback(player[v].hit.shieldstun,
                                        vPushMultiplier === 1);
  // The decomp writes the defender's pushback to gr_vel -- the along-ground
  // scalar (ftCo_Guard.c:698) -- not to a 2D vector. A shielding fighter is
  // always grounded, so route it through setGroundVelocity and let the floor
  // tangent projection produce cVel.
  const shielderIsRight = player[a].phys.pos.x < player[v].phys.pos.x;
  setGroundVelocity(v, shielderIsRight ? victimPush : -victimPush);

  // The attacker's pushback is a DIFFERENT channel: x98_atk_shield_kb, seeded
  // through the grounded scalar xF4 and projected onto the floor tangent
  // (ftcoll.c:459 -> fighter.c:3009 -> ftCommon_8007E2A4). It decays at its own
  // rate (x3E8 airborne, ground_friction * x3EC grounded), not with ordinary
  // movement friction, so writing it to cVel.x -- as meleelight did -- put it
  // on the wrong decay curve and let self-movement overwrite it.
  //
  // It is also gated on the ATTACKER BEING GROUNDED (ftcoll.c:457). An aerial
  // that hits a shield pushes the shielder but not the attacker. meleelight
  // applied it unconditionally.
  if (player[a].phys.grounded) {
    // The SHIELDER's lightshield amount, not the attacker's -- ftcoll.c:459
    // reads fp1->lightshield_amount, where fp1 is the fighter being hit.
    const push = calcAttackerShieldPushback(damage, lightshield);
    // x192c is +1 when the shielder is to the RIGHT, and xF4 then takes the
    // NEGATED magnitude -- i.e. the attacker is pushed away from the shielder.
    const scalar = shielderIsRight ? -push : push;
    player[a].phys.grShieldKBVel = scalar;
    const n = player[a].phys.groundNormal;
    player[a].phys.shieldKBVel.x = n.y * scalar;
    player[a].phys.shieldKBVel.y = -n.x * scalar;
  }

  actionStates[characterSelections[v]].GUARD.init(v,input);
}

export function bluntHit(a,h){
  sounds.blunthit.play();
  let frame = player[a].hitboxes.frame;
  if(frame > 1){
    frame = 1;
  }
  drawVfx("clank", new Vec2D(player[a].phys.pos.x + (player[a].hitboxes.id[h].offset[frame].x * player[a].phys.face), player[a].phys.pos.y + player[a].hitboxes.id[h].offset[frame].y));
}

export function executeRegularHit (input, v, a, h, shieldHit, isThrow, drawBounce, phantom, stageDamage, hitbox) {
  let damage = hitbox.dmg;
  // Staled damage, tracked alongside the raw value from here on. Melee stales
  // the PERCENT you take but NOT the knockback (ft_80089228 is applied to the
  // damage figure; ftColl_80079AB0 takes the unstaled one), so the two have to
  // stay separate all the way to their respective consumers.
  //
  // Stage damage has no attacker and therefore no attack id, so it never
  // stales -- moveIdFor returns FtMoveId_Default and staleDamage is identity.
  let staledDamage = damage;
  player[v].phys.grabTech = false;
  if (!stageDamage){
    if (player[a].phys.chargeFrames > 0) {
      // ftCo_800DEEB8 (ft_0DF0.c:32). See smashCharge.js -- the constants were
      // right, the float64 arithmetic around them was not.
      damage = applySmashCharge(damage, player[a].phys.chargeFrames);
    }
    if (actionStates[characterSelections[a]][player[a].actionState].specialOnHit) {
      actionStates[characterSelections[a]][player[a].actionState].onPlayerHit(a);
      if (hitbox.type === 8) return;
    }
    if (phantom) {
      phantomQueue.push([a, v]);
      player[v].phys.phantomDamage = 0.5 * damage;
    } else {
      player[a].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(a), cap: false});
    }
    // ft_80089228 (ft_0881.c:363), then plStale_UpdateStaleMovesFromFighter
    // (plstale.c:41). Order matters: the multiplier is read BEFORE this hit is
    // recorded, so a move does not stale itself on the swing that lands it.
    //
    // The push is deduped on (id, instance) across all ten slots, so a
    // multi-hit move, or one swing connecting with two opponents, still only
    // occupies a single entry.
    const moveId = moveIdFor(characterSelections[a], player[a].actionState);
    staledDamage = staleDamage(player[a].staleTable, moveId, damage);
    pushStaleMove(player[a].staleTable, moveId, player[a].phys.attackInstance);
  }

  if (shieldHit) {
    executeShieldHit(input, v, a, h, damage);
    return;
  }
  // if invincible
  if (player[v].phys.hurtboxState > 0 && !isThrow) {
    if (!stageDamage){
      bluntHit(a, h);
    }
    return;
  }
  if (phantom) {
    player[v].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(v)});
    player[v].hit.knockback = 0;
    let frame = player[a].hitboxes.frame;
    if(frame > 1){
      frame = 1;
    }
    player[v].hit.hitPoint = new Vec2D(player[a].phys.pos.x + (hitbox.offset[frame].x * player[a].phys.face), player[a].phys.pos.y + hitbox.offset[frame].y);
    hitEffectsAndSound(a,v,h,isThrow);
    return;
  }

  let crouching = actionStates[characterSelections[v]][player[v].actionState].crouch;
  let vCancel = false;
  if (player[v].phys.vCancelTimer > 0) {
    if (actionStates[characterSelections[v]][player[v].actionState].vCancel) {
      vCancel = true;
      sounds.vcancel.play();
    }
  }
  let jabReset = false;
  if (actionStates[characterSelections[v]][player[v].actionState].downed && damage < 7) {
    jabReset = true;
  }
  // STALED first, UNSTALED second -- the two are finally different. The staled
  // value is the damage this hit adds to the victim's percent inside the
  // knockback formula; the unstaled one is what the formula multiplies by. See
  // getKnockback's own comment and ftColl_80079AB0.
  player[v].hit.knockback = getKnockback(hitbox, staledDamage, damage, player[v].percent, player[v].charAttributes.weight, crouching, vCancel);
  player[v].hit.angle = hitbox.angle;
  if (player[v].hit.angle == 361) {
    if (player[v].hit.knockback < 32.1) {
      player[v].hit.angle = 0;
    } else if (player[v].hit.knockback >= 32.1) {
      player[v].hit.angle = 44;
    }
  }

  player[v].hit.hitlag = calcHitlag(damage, {crouching: isCrouching(v)});

  if (!isThrow) {
    if (stageDamage) {
      const angularParameter = a.angular;
      let collisionPoint;
      if (a.corner) {
        const [same, other] = getSameAndOther(angularParameter);
        const t = angularParameter - Math.floor(angularParameter);
        if ((same === 1 && other === 2) || (same === 3 && other === 0)) {
          collisionPoint = new Vec2D( (1-t)*player[v].phys.ECBp[same].x+t*player[v].phys.ECBp[other].x
                                    , (1-t)*player[v].phys.ECBp[same].y+t*player[v].phys.ECBp[other].y );
        }
        else {
          collisionPoint = new Vec2D( (1-t)*player[v].phys.ECBp[other].x+t*player[v].phys.ECBp[same].x
                                    , (1-t)*player[v].phys.ECBp[other].y+t*player[v].phys.ECBp[same].y );
        }
      }
      else {
        collisionPoint = player[v].phys.ECBp[angularParameter];
      }
      player[v].hit.hitPoint = collisionPoint;
      player[v].hit.reverse = false;
      player[v].phys.stageDamageImmunity = 20;
    } else {
      let frame = player[a].hitboxes.frame;
      if(frame > 1){
        frame = 1;
      }
      player[v].hit.hitPoint = new Vec2D(player[a].phys.pos.x + (hitbox.offset[frame].x * player[a].phys.face), player[a].phys.pos.y + hitbox.offset[frame].y);
      if (player[a].phys.pos.x < player[v].phys.pos.x) {
        player[v].hit.reverse = false;
      } else {
        player[v].hit.reverse = true;
      }
    }
    if (!jabReset && player[v].phys.grabbedBy == -1) {
      player[v].phys.face = player[v].hit.reverse ? 1 : -1;
    }
  } else {
    player[a].hasHit = true;
    player[a].phys.grabbing = -1;
    player[v].phys.thrownHitbox = true;
    player[v].phys.thrownHitboxOwner = a;
    player[v].phys.pos = new Vec2D(player[a].phys.pos.x + (hitbox.offset.x * player[a].phys.face), player[a].phys.pos.y + hitbox.offset.y);
    player[v].phys.grabbedBy = -1;
    player[v].hit.hitlag = 1;
    player[a].hit.hitlag = 1;
    if (player[a].phys.face == 1) {
      player[v].hit.reverse = false;
    } else {
      player[v].hit.reverse = true;
    }
    if (drawBounce) {
      sounds.bounce.play();
      drawVfx({
        name: "groundBounce",
        pos: player[v].phys.pos,
        face: player[v].phys.face,
        f: Math.PI / 2
      });
    }
  }

  // The percent takes the STALED damage. This is the visible half of staling:
  // a move spammed nine times deals 55% of its listed damage.
  player[v].percent += staledDamage;

  // if victim is grabbing someone, put the victim's grab victim into a grab release
  if (player[v].phys.grabbing > -1) {
    player[player[v].phys.grabbing].phys.grabbedBy = -1;
    actionStates[characterSelections[player[v].phys.grabbing]].CAPTURECUT.init(player[v].phys.grabbing,input);
  }

  if (player[v].phys.grabbedBy == -1 || (player[v].phys.grabbedBy > -1 && player[v].hit.knockback > 50 && !hitbox.throwextra)) {
    if (player[v].phys.grabbedBy > -1) {
      player[player[v].phys.grabbedBy].phys.grabbing = -1;
      actionStates[characterSelections[player[v].phys.grabbedBy]].WAIT.init(player[v].phys.grabbedBy,input);
    }
    player[v].hit.hitstun = getHitstun(player[v].hit.knockback);

    if (jabReset) {
      actionStates[characterSelections[v]].DOWNDAMAGE.init(v,input);
    } else if (player[v].hit.knockback >= 80 || isThrow) {
      actionStates[characterSelections[v]].DAMAGEFLYN.init(v,input, !isThrow);
    } else {
      actionStates[characterSelections[v]].DAMAGEN2.init(v,input);
    }
  } else {
    if (!hitbox.throwextra) {
    //if (player[v].actionState != "THROWNPUFFDOWN" && player[v].actionState != "THROWNFALCONBACK" && player[v].actionState != "THROWNFALCONFORWARD" && player[v].actionState != "THROWNFALCONUP") {
      actionStates[characterSelections[v]].CAPTUREDAMAGE.init(v,input);
    }
  }

  if (player[v].phys.grounded && player[v].hit.angle > 180) {
    if (player[v].hit.knockback >= 80) {
      sounds.bounce.play();
      drawVfx({
        name: "groundBounce",
        pos: player[v].phys.pos,
        face: player[v].phys.face,
        f: Math.PI / 2
      });
      player[v].hit.angle = 360 - player[v].hit.angle;
      player[v].hit.knockback *= 0.8;
    }
  }
  screenShake(player[v].hit.knockback);
  percentShake(player[v].hit.knockback, v);
  hitEffectsAndSound(v,h,isThrow, hitbox.type);
}

export function hitEffectsAndSound(v,h, isThrow, type){
  if (!isThrow) {
    hitEffect(type,v);
    knockbackSounds(type, player[v].hit.knockback, v);
  } else {
    sounds.stronghit.play();
  }
}

export function hitEffect(type,v){
  switch (type) {
    case 0:
      // normal
      drawVfx({
        name: "normalhit",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face
      });
      break;
    case 1:
      // slash
      drawVfx({
        name: "hitSparks",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face
      });
      drawVfx({
        name: "hitFlair",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face
      });
      drawVfx({
        name: "hitCurve",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face,
        f: player[v].hit.angle
      });
      break;
    case 3:
      // fire
      player[v].burning = 20;
      drawVfx({
        name: "firehit",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face
      });
      break;
    case 4:
      // electric
      player[v].shocked = 20;
      drawVfx({
        name: "electrichit",
        pos: player[v].hit.hitPoint,
        face: player[v].phys.face
      });
      break;
    default:
      break;
  }
}

export function executeHits (input){
  if (gameMode === 2) {
    cssHits(input);
    return;
  }
  let grabQueue = [];
  let ignoreGrabs = [false, false, false, false];
  for (var i = 0; i < hitQueue.length; i++) {
    // start defining constants for hit
    const v = hitQueue[i][0];
    const a = hitQueue[i][1];
    // h will contain hitbox type for stage damage
    const h = hitQueue[i][2];
    const shieldHit = hitQueue[i][3];
    const isThrow = hitQueue[i][4];
    const drawBounce = hitQueue[i][5];
    const phantom = hitQueue[i][6] || false;
    // if a is a string, then it is stage damage
    const stageDamage = (a >= 0) ? false : true;
    let hitbox;
    if (stageDamage) {
      let normalAngle = Math.atan2(a.normal.y, a.normal.x);
      if (normalAngle < 0) {
        normalAngle += 2*Math.PI;
      }
      hitbox = { offset : new Vec2D(0,0),
                 dmg : 10,
                 angle : normalAngle * 180 / Math.PI, // why are we using degrees again?
                 kg : 100,
                 bk : 0,
                 sk : 150,
                 type : h
                }
    }
    else {
      hitbox = player[a].hitboxes.id[h];
    }

    // if in furafura, make sure sfx stops
    if (player[v].actionState == "FURAFURA") {
      sounds.furaloop.stop(player[v].furaLoopID);
    }
    switch (hitbox.type){
      // if grab
      case 2:
        if (actionStates[characterSelections[v]][player[v].actionState].canBeGrabbed) {
          grabQueue.push([a, v, false]);
        }
        break;
      // if sleep
      case 5:
        actionStates[characterSelections[v]].FURASLEEPSTART.init(v,input);
        break;
      default:
        ignoreGrabs[v] = true;
        executeRegularHit(input, v, a, h, shieldHit, isThrow, drawBounce, phantom, stageDamage, hitbox);
        break;
    }
  }
  executeGrabHits(input, grabQueue, ignoreGrabs);
}

export function executeGrabHits(input, grabQueue, ignoreGrabs){
  for (var j = 0; j < grabQueue.length; j++) {
    if (!ignoreGrabs[grabQueue[j][0]]) {
      if (!grabQueue[j][2]) {
        if (player[grabQueue[j][1]].actionState == "GRAB" && player[grabQueue[j][1]].timer > 0 && player[grabQueue[j]
            [1]].timer < 14 && player[grabQueue[j][1]].phys.face != player[grabQueue[j][0]].phys.face) {
          executeGrabTech(grabQueue[j][0], grabQueue[j][1],input);
          grabQueue[j][2] = true;
          ignoreGrabs[grabQueue[j][1]] = true;
        } else {
          for (var k = 0; k < grabQueue.length; k++) {
            if (k != j) {
              if (grabQueue[j][0] == grabQueue[k][1]) {
                executeGrabTech(grabQueue[j][0], grabQueue[k][0],input);
                grabQueue[j][2] = true;
                grabQueue[k][2] = true;
                break;
              }
            }
          }
        }
      }
      if (!grabQueue[j][2]) {
        var a = grabQueue[j][0];
        var v = grabQueue[j][1];
        if (player[v].phys.grabbedBy == -1 && player[a].phys.grabbing == -1 && player[v].phys.hurtBoxState == 0 && !
          player[v].phys.grabTech) {
          player[v].phys.cVel = new Vec2D(0, 0);
          player[v].phys.kVel = new Vec2D(0, 0);
          player[a].phys.cVel = new Vec2D(0, 0);
          player[a].phys.kVel = new Vec2D(0, 0);
          player[v].phys.grabbedBy = a;
          player[v].phys.shielding = false;
          player[a].phys.grabbing = v;
          turnOffHitboxes(a);
          turnOffHitboxes(v);
          if (player[a].actionState == "UPSPECIAL") {
            player[v].phys.face = player[a].phys.face * -1;
            actionStates[characterSelections[v]].THROWNFALCONDIVE.init(v,input);
          }
          else {
            actionStates[characterSelections[v]].CAPTUREPULLED.init(v,input);
          }
        }
      }
    }
  }
}

export function executeGrabTech (a,v,input){
    if (player[a].phys.pos.x < player[v].phys.pos.x) {
        player[a].phys.face = 1;
        player[v].phys.face = -1;
    } else {
        player[a].phys.face = -1;
        player[v].phys.face = 1;
    }
    player[a].phys.grabTech = true;
    player[v].phys.grabTech = true;
    turnOffHitboxes(a);
    turnOffHitboxes(v);
    actionStates[characterSelections[a]].CAPTURECUT.init(a,input);
    actionStates[characterSelections[v]].CAPTURECUT.init(v,input);
    sounds.parry.play();
    drawVfx({
      name: "shieldup",
      pos: new Vec2D((player[a].phys.pos.x + player[v].phys.pos.x) / 2, player[a].phys.pos.y + 12),
      face: player[v].phys.face,
      f: 3
    });
}

// ftColl_80079AB0 (decomp: src/melee/ft/ftcoll.c:2387) followed by
// ftCo_Damage_CalcKnockback (ftCo_Damage.c:118).
//
// The previous formula here was ALGEBRAICALLY CORRECT in both branches --
// `(sk*10/20)+1` is the decomp's `1 + 0.5*setKb`, and `1.4*(200/(weight+100))`
// is its weight curve `xF8 - (w*xF8)/(1+w)` rearranged. What was wrong:
//
//  1. vCancel applied `kb *= 0.95`. THAT IS THE WRONG QUANTITY AND THE WRONG
//     PLACE. The shield-button scale (x1AC) is 1.0 in retail -- a no-op. The
//     real 0.95 is x190, applied to the VELOCITY MAGNITUDE when airborne
//     (ftCo_Damage.c:346), not to knockback. The parameter is kept so callers
//     are unchanged, but it is deliberately ignored.
//  2. Crouch cancel used 0.67; the value is 2/3 (0.6666666865348816).
//  3. All literals were float64. calcKnockback uses the exact float32
//     constants read from PlCo.dat.
//  4. kb_min and armour were absent (applyKnockbackModifiers handles both).
//
// `percent` here is Melee's `count + percentTemp`: the integer percent before
// the hit, plus the STALED damage this hit applies. The damage multiplied into
// the formula is the UNSTALED value -- Melee stales the percent you take but
// not the knockback.
export function getKnockback (hb,damagestaled,damageunstaled,percent,weight,crouching,vCancel) {
    void vCancel;   // see (1) above -- intentionally unused
    const kb = calcKnockback({
        percent: damagestaled + Math.floor(percent),
        unstaledDamage: damageunstaled,
        weight: weight,
        kbGrowth: hb.kg,
        baseKb: hb.bk,
        setKb: hb.sk,
    });
    return applyKnockbackModifiers(kb, { crouching: crouching });
}

// REMOVED: getLaunchAngle(trajectory, knockback, reverse, x, y, v).
//
// meleelight's DI, worked in DEGREES: it turned the stick into a compass
// bearing with Math.atan, took the signed difference against the trajectory,
// and bent the angle by up to 18 degrees scaled by sin(difference)^2.
//
// Melee's DI is ftCo_8008E5A4 (ftCo_Damage.c:591), and it never forms an
// angle difference at all -- it projects the stick onto the knockback vector
// with a dot and a cross product, squares that, and rotates by
// MTXDegToRad(x1A8) * that. It is ported in knockback.js as applyDI(), which
// is what the engine calls. This copy was still exported and still imported
// by physics.js, but nothing called it.
//
// It also carried a 0.2875 stick deadzone found nowhere in the game, and
// `Math.atan(y/x)` with quadrant fixups where Melee uses atan2f.

// REMOVED: getHorizontalVelocity / getVerticalVelocity / getHorizontalDecay /
// getVerticalDecay.
//
// These were meleelight's launch-velocity and knockback-decay math, and they
// had already been superseded -- the live path is knockback.js, which follows
// ftCo_Damage.c:336 (`x = scaled_kb * cosf(angle)`) and fighter.c:2196 (decay
// with the angle RECOMPUTED from the current knockback vector each frame). All
// four were still exported and still imported by physics.js and WALLDAMAGE.js,
// but never called, so they sat as a float64 shadow of the correct code with
// nothing marking them stale.
//
// They also carried two errors worth recording, in case the shape reappears:
// `Math.round(v * 100000) / 100000` was a five-decimal quantisation with no
// counterpart anywhere in Melee, and the decay was frozen per-axis at launch
// rather than recomputed, so a second hit landing mid-launch kept decaying
// along the OLD trajectory.

// ftCo_8008DCE0 (decomp: ftCo_Damage.c:292):
//
//   fp->mv.co.damage.x0 = (int)(kb_applied * x154);
//   if (!fp->mv.co.damage.x0) fp->mv.co.damage.x0 = 1;
//
// Two fixes over `Math.floor(knockback * .4)`:
//  1. The MINIMUM OF 1 was missing -- any connecting hit gives at least one
//     frame of hitstun even when the knockback rounds down to zero.
//  2. `.4` is the float64 nearest 0.4; the game multiplies by the float32
//     (0.4000000059604645). calcHitstun uses the exact value.
//
// Kept as a wrapper so both call sites (hitDetection.js and article.js) are
// fixed without changing their signatures.
export function getHitstun (knockback) {
  return calcHitstun(knockback);
}

export function knockbackSounds (type,knockback,v){
  if (type == 4){
    sounds.firestronghit.play();
  }
  if (knockback < 50) {
    switch (type) {
      case 0:
        sounds.normalweakhit.play();
        break;
      case 1:
        sounds.swordweakhit.play();
        break;
      case 3:
        sounds.fireweakhit.play();
        break;
      default:
        break;
    }
  } else if (knockback < 100) {
    switch (type) {
      case 0:
        sounds.normalmediumhit.play();
        break;
      case 1:
        sounds.swordmediumhit.play();
        break;
      case 3:
        sounds.firemediumhit.play();
        break;
      default:
        break;
    }
  } else if (knockback < 140) {
    switch (type) {
      case 0:
        sounds.normalstronghit.play();
        break;
      case 1:
        sounds.swordstronghit.play();
        break;
      case 3:
        sounds.firestronghit.play();
        break;
      default:
        break;
    }
  } else {
    switch (type) {
      case 0:
        sounds.normalstronghit.play();
        break;
      case 1:
        sounds.swordreallystronghit.play();
        break;
      case 3:
        sounds.bathit.play();
        sounds.firestronghit.play();
        break;
      default:
        break;
    }
    sounds.cheer.play();
    if (knockback < 280) {
      sounds.stronghit.play();
      switch (characterSelections[v]) {
        case 0:
          sounds.weakhurt.play();
          break;
        case 2:
          sounds.foxweakhurt.play();
          break;
        case 3:
            sounds.falcohurt1.play();
            break;
        default:
          break;
      }
    } else {
      sounds.strongerhit.play();
      switch (characterSelections[v]) {
        case 0:
          sounds.stronghurt.play();
          break;
        case 1:
          sounds.puffhurt.play();
          break;
        case 2:
          sounds.foxstronghurt.play();
          break;
        case 3:
            sounds.falcohurt2.play();
            break;
        default:
          break;
      }
    }
  }
}

export function checkPhantoms (){
  for (var i = 0; i < phantomQueue.length; i++) {
    var v = phantomQueue[i][1]
    if (player[v].hit.hitlag == 0 && player[v].phys.hurtBoxState == 0) {
      player[v].percent += player[v].phys.phantomDamage;
      player[v].phys.phantomDamage = 0;
      var a = phantomQueue[i][0];
      for (var j = 0; j < player[a].hitboxes.hitList.length; j++) {
        if (player[a].hitboxes.hitList[j] == v) {
          player[a].hitboxes.hitList.splice(j, 1);
          break;
        }
      }
      phantomQueue.splice(i, 1);
    }
  }
}
