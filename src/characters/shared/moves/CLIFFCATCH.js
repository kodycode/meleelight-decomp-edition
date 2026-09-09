import {playSounds, actionStates, turnOffHitboxes} from "physics/actionStateShortcuts";
import {characterSelections,  player} from "main/main";
import {drawVfx} from "main/vfx/drawVfx";
import {activeStage} from "stages/activeStage";
import {Vec2D} from "../../../main/util/Vec2D";
import {framesData} from "../../../main/characters";
export default {
  name : "CLIFFCATCH",
  // The ledge states drive position by SNAPPING phys.pos from their offset
  // table every frame, which walks the fighter up the OUTSIDE of the stage
  // wall. Running ordinary environment collision at the same time sweeps the
  // ECB from below the lip to above it, hits the wall/ledge corner, and the
  // resolver pushes the fighter straight back out and down -- getting up off
  // a ledge dropped you back onto it.
  //
  // Melee does not run environment collision here either: the cliff states'
  // Coll callback is ftCo_CliffCatch_Coll (ftcliffcommon.c:128), a
  // ledge-specific check, not the ground/wall resolver.
  ignoreCollision : true,
  canGrabLedge : false,
  canBeGrabbed : false,
  posOffset : [],
  landType : 0,
  init : function(p,input){
    player[p].actionState = "CLIFFCATCH";
    player[p].timer = 0;
    player[p].phys.cVel.x = 0;
    player[p].phys.cVel.y = 0;
    player[p].phys.kVel.x = 0;
    player[p].phys.kVel.y = 0;
    player[p].phys.thrownHitbox = false;
    player[p].phys.fastfalled = false;
    player[p].phys.doubleJumped = false;
    player[p].phys.jumpsUsed = 0;
    player[p].phys.intangibleTimer = 38;
    player[p].phys.ledgeHangTimer = 0;
    player[p].rotation = 0;
    player[p].rotationPoint = new Vec2D(0,0);
    player[p].colourOverlayBool = false;
    player[p].phys.chargeFrames = 0;
    player[p].phys.charging = false;
    turnOffHitboxes(p);
    const l = activeStage.ledge[player[p].phys.onLedge];
    drawVfx({
      name: "cliffcatchspark",
      pos: new Vec2D(activeStage[l[0]][l[1]][l[2]].x, activeStage[l[0]][l[1]][l[2]].y),
      face: player[p].phys.face
    });
    actionStates[characterSelections[p]].CLIFFCATCH.main(p,input);
  },
  main : function(p,input){
    player[p].timer++;
    playSounds("CLIFFCATCH",p);
    if (!actionStates[characterSelections[p]].CLIFFCATCH.interrupt(p,input)){
      const onLedge = player[p].phys.onLedge;
      if(onLedge === -1){
        return;
      }
      const l = activeStage.ledge[onLedge];
      const x = activeStage[l[0]][l[1]][l[2]].x;
      const y = activeStage[l[0]][l[1]][l[2]].y;
      // The posOffset tables were captured against the OLD frame counts, where
      // CLIFFCATCH ran 7 frames. The real animation is 8 (corrected from the
      // disc), so `timer` now reaches 8 while every character's table still has
      // only 7 rows -- posOffset[7] is undefined and indexing [0] on it threw
      // the moment anyone grabbed a ledge.
      //
      // Clamp to the table's own length: an animation that outlives its data
      // holds its last frame, which is the same call made for the ECB tables in
      // physics.js. NB this is a HOLD, not the real frame-8 offset -- that
      // value has not been baked out of the disc. The visible difference is one
      // frame of ledge-hang position, and the trend across the table is small
      // (Fox moves 0.39 in x over the last two frames), but it is not exact.
      const table = actionStates[characterSelections[p]].CLIFFCATCH.posOffset;
      if (table.length === 0) {
        return;
      }
      const row = table[Math.min(player[p].timer - 1, table.length - 1)];
      player[p].phys.pos = new Vec2D(x+(row[0]+68.4)*player[p].phys.face,y+row[1]);
    }
  },
  interrupt : function(p,input){
    if (player[p].timer > framesData[characterSelections[p]].CLIFFCATCH){
      actionStates[characterSelections[p]].CLIFFWAIT.init(p,input);
      return true;
    }
    else {
      return false;
    }
  }
};

