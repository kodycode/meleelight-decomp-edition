// You cannot air dodge out of jumpsquat.
//
//   node --import ./test/register.mjs test/check-jumpsquat.mjs
//
// ftCo_KneeBend_IASA (ftCo_KneeBend.c:59) is four lines:
//
//     RETURN_IF(ftCo_Attack100_CheckInput(gobj));      // up special
//     RETURN_IF(ftCo_Catch_CheckInput(gobj));          // grab
//     RETURN_IF(ftCo_AttackHi4_CheckInputNoD0(gobj));  // up smash
//     ftCo_KneeBend_Check_ShortHop(gobj);
//
// and the jump itself is entered from ftCo_KneeBend_Anim once cur_anim_frame
// reaches jump_startup_time. Nothing else interrupts jumpsquat -- no shield,
// no air dodge, no aerials, no other smash. A shield input during those frames
// is simply consumed, which is why a wavedash has to be started after the
// fighter leaves the ground rather than during the crouch.
//
// This drives the REAL states frame by frame with a jump input, then a shield
// input at every offset from the same frame through the end of jumpsquat, and
// asserts the fighter is never handed to ESCAPEAIR before it is airborne. It
// also pins the length of jumpsquat to the character's own jump_startup_time,
// since a jumpsquat one frame short would let a dodge out early without any
// interrupt chain being wrong.
//
// ESCAPEAIR is substituted with a recorder rather than run for real: the point
// is whether it is ENTERED, and the real state pulls in intangibility tables
// the headless stubs do not carry.
import { player, characterSelections } from "./stubs/main-main.mjs";
import { capturedAttributes, CHARIDS } from "./stubs/characters.mjs";
import "characters/fox/attributes";
import "characters/falco/attributes";
import "characters/falcon/attributes";
import "characters/marth/marthAttributes";
import "characters/puff/puffAttributes";
import { actionStates } from "physics/actionStateShortcuts";
import WAIT from "characters/shared/moves/WAIT";
import KNEEBEND from "characters/shared/moves/KNEEBEND";
import JUMPF from "characters/shared/moves/JUMPF";
import JUMPB from "characters/shared/moves/JUMPB";
import FALL from "characters/shared/moves/FALL";

let fails = 0;
function fail(msg) { console.log("  FAIL " + msg); fails++; }

const frame = (o = {}) => Object.assign({
  lsX: 0, lsY: 0, csX: 0, csY: 0, lA: 0, rA: 0,
  a: false, b: false, x: false, y: false, z: false, l: false, r: false,
  du: false, dd: false, dl: false, dr: false, s: false }, o);

const CHARS = [["Fox", "FOX_ID"], ["Falco", "FALCO_ID"], ["Falcon", "FALCON_ID"],
               ["Marth", "MARTH_ID"], ["Puff", "PUFF_ID"]];

console.log();
for (const [name, key] of CHARS) {
  const cid = CHARIDS[key];
  const attr = capturedAttributes[cid];
  let dodgedIn = null;
  const ESCAPEAIR = {
    name: "ESCAPEAIR",
    init(p) { dodgedIn = player[p].actionState; player[p].actionState = "ESCAPEAIR"; },
    main() {},
    interrupt() { return true; },
  };
  actionStates[cid] = { WAIT, KNEEBEND, JUMPF, JUMPB, FALL, ESCAPEAIR };
  characterSelections.length = 0;
  characterSelections[0] = cid;

  const squat = attr.jumpSquat;
  let squatFrames = null;

  for (let gap = 0; gap <= squat; gap++) {
    dodgedIn = null;
    const p = {
      actionState: "WAIT", timer: 0, inCSS: false, IASATimer: 0,
      charAttributes: attr, hit: { shieldstun: 0, hitlag: 0, hitstun: 0 },
      phys: { pos: { x: 0, y: 0 }, posPrev: { x: 0, y: 0 },
        cVel: { x: 0, y: 0 }, kVel: { x: 0, y: 0 }, kDec: { x: 0, y: 0 },
        grVel: 0, grKBVel: 0, groundAccel1: 0, groundAccel2: 0,
        groundNormal: { x: 0, y: 1 }, grounded: true, face: 1,
        fastfalled: false, doubleJumped: false, jumpsUsed: 0, jumpType: 1,
        jumpSquatType: 0, shielding: false, shieldHP: 60, shieldAnalog: 0,
        shieldPosition: { x: 0, y: 0 }, shieldSize: 0, shieldTiltMag: 0,
        shieldTiltAngle: 10, airborneTimer: 0, onLedge: -1,
        charging: false, chargeFrames: 0 },
    };
    player.length = 0; player.push(p);

    const hist = [];
    const push = (f) => { hist.unshift(f); while (hist.length > 8) hist.pop(); return [hist]; };
    for (let i = 0; i < 8; i++) push(frame());

    let knee = 0;
    for (let f = 0; f <= squat + 2; f++) {
      const inp = push(frame({ x: f === 0, l: f === gap }));
      actionStates[cid][p.actionState].main(0, inp);
      if (p.actionState === "KNEEBEND") knee++;
      if (dodgedIn === "KNEEBEND") break;
    }
    if (gap === 0) squatFrames = knee;

    if (gap < squat && dodgedIn === "KNEEBEND") {
      fail(`${name}: shield ${gap} frame(s) after jump air dodged during jumpsquat`);
    }
  }

  // jump_startup_time frames of jumpsquat, no more and no less
  if (squatFrames !== squat) {
    fail(`${name}: jumpsquat ran ${squatFrames} frames, jump_startup_time is ${squat}`);
  }
  console.log(`  ${name.padEnd(7)} jumpsquat ${squat} frames, no air dodge from any of them`);
}

console.log();
if (fails) {
  console.log(`  ${fails} jumpsquat assertion(s) failed`);
  process.exit(1);
}
console.log("  air dodge is unreachable from jumpsquat on all five characters");
