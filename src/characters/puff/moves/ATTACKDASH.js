import {player} from "../../../main/main";
import {
  turnOffHitboxes, checkForSpecials, checkForTilts, checkForSmashes, checkForJump, checkForDash,
  checkForSmashTurn
  , checkForTiltTurn
  , tiltTurnDashBuffer
  , applyRootMotion
} from "../../../physics/actionStateShortcuts";
import puff from "./index";
import {sounds} from "../../../main/sfx";
import WAIT from "../../shared/moves/WAIT";
import KNEEBEND from "../../shared/moves/KNEEBEND";
import DASH from "../../shared/moves/DASH";
import SMASHTURN from "../../shared/moves/SMASHTURN";
import TILTTURN from "../../shared/moves/TILTTURN";
import WALK from "../../shared/moves/WALK";
import {setGroundVelocity} from "physics/groundMovement";
export default {
  name: "ATTACKDASH",
  canEdgeCancel: false,
  setVelocities: [0.99874, 1.82126, 2.22815, 2.43704, 1.91481, 1.39379, 1.36213, 1.33162, 1.30228, 1.27408, 1.24704, 1.22115, 1.19642, 1.17284, 1.15042, 1.12915, 1.10902, 1.09006, 1.06475, 1.01691, 0.94598, 0.85192, 0.73477, 0.59452, 0.43115, 0.32167, 0.28310, 0.24695, 0.21323, 0.18194, 0.15309, 0.12666, 0.10266, 0.08109, 0.06194, 0.04524, 0.03096, 0.0191, 0.00968],
  canBeGrabbed: true,
  init: function (p, input) {
    player[p].actionState = "ATTACKDASH";
    player[p].timer = 0;
    turnOffHitboxes(p);
    player[p].hitboxes.id[0] = player[p].charHitboxes.dashattack1.id0;
    puff.ATTACKDASH.main(p, input);
  },
  main: function (p, input) {
    player[p].timer++;
    if (!puff.ATTACKDASH.interrupt(p, input)) {
      // gr_vel = x6A4_transNOffset.z * facing_dir, straight off the disc
      // (ft_084E.c:83, via ftCo_AttackDash_Phys -> ft_80085030).
      //
      // This also fixes a one-frame lead. Melee CLEARS transNOffset on state
      // entry (fighter.c:1277), so the fighter does not move on the entry
      // frame; the hand table's first entry was the SECOND frame's delta, so
      // every frame of travel arrived one early. The generated table carries
      // the leading zero and rootVel indexes it as Melee does.
      applyRootMotion(p, "ATTACKDASH");

      if (player[p].timer === 4) {
        player[p].hitboxes.active = [true, false, false, false];
        player[p].hitboxes.frame = 0;
        sounds.normalswing1.play();
      }
      if (player[p].timer > 4 && player[p].timer < 15) {
        player[p].hitboxes.frame++;
      }
      if (player[p].timer === 9) {
        player[p].hitboxes.id[0] = player[p].charHitboxes.dashattack2.id0;
        player[p].hitboxes.frame = 0;
      }
      if (player[p].timer === 15) {
        turnOffHitboxes(p);
      }
    }
  },
  interrupt: function (p, input) {
    if (player[p].timer > 39) {
      WAIT.init(p, input);
      return true;
    }
    else if (player[p].timer < 5 && (input[p][0].lA > 0 || input[p][0].rA > 0)) {
      if (player[p].phys.cVel.x * player[p].phys.face > player[p].charAttributes.dMaxV) {
        setGroundVelocity(p, player[p].charAttributes.dMaxV * player[p].phys.face);
      }
      puff.GRAB.init(p, input);
      return true;
    }
    else if (player[p].timer > 38) {
      const b = checkForSpecials(p, input);
      const t = checkForTilts(p, input);
      const s = checkForSmashes(p, input);
      const j = checkForJump(p, input);
      if (j[0]) {
        KNEEBEND.init(p, j[1], input);
        return true;
      }
      else if (b[0]) {
        puff[b[1]].init(p, input);
        return true;
      }
      else if (s[0]) {
        puff[s[1]].init(p, input);
        return true;
      }
      else if (t[0]) {
        puff[t[1]].init(p, input);
        return true;
      }
      else if (checkForDash(p, input)) {
        DASH.init(p, input);
        return true;
      }
      else if (checkForSmashTurn(p, input)) {
        SMASHTURN.init(p, input);
        return true;
      }
      else if (checkForTiltTurn(p, input)) {
        player[p].phys.dashbuffer = tiltTurnDashBuffer(p, input);
        TILTTURN.init(p, input);
        return true;
      }
      else if (Math.abs(input[p][0].lsX) > 0.3) {
        WALK.init(p, true, input);
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }
};