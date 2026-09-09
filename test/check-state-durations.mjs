// A state's terminal frame must follow from ITS OWN character's animation
// length, not from whichever character the file was copied off.
//
// Falco's move files are derived from Fox's -- the two share a skeleton and a
// charScale -- and four numbers came across that should not have:
//
//   falco UPSMASH        ended at 41, Fox's value; AttackHi4 is 44 for Falco
//                        against 42 for Fox, so it ran two frames short
//   falco CLIFFJUMPQUICK ended at 51, Fox's value; the animation totals 59
//   falco CLIFFJUMPSLOW  ended at 51, Fox's value; the animation totals 59
//   puff  CLIFFJUMPSLOW  ended at 38, which is Puff's own CLIFFJUMPQUICK
//                        value -- nine frames short of her 49
//
// Fox's two ledge-jump animations coincidentally both total 53, which is what
// hid the copy: one wrong number looked like two consistent ones.
//
// The convention across every character is `total - 2` for the ledge jumps and
// `length - 1` for the up smash, and both hold for all five once the four
// above are corrected -- with one deliberate exception recorded below.
//
// test/state-durations.json is generated from the disc; regenerate it with the
// snippet in that file's sibling tools (figatree.AJ.frame_count over the
// subactions named here) if the extraction ever changes.
//
//   node test/check-state-durations.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const DISC = JSON.parse(fs.readFileSync(path.join(HERE, "state-durations.json"), "utf8"));

// state -> how its terminal frame relates to the animation length.
// Every state ends one frame before its animation's length. The ledge jumps
// subtract TWO because they are TWO animations played back to back --
// CliffJump1 then CliffJump2, each ending on its own ftAnim_IsFramesRemaining
// (ftCo_CliffJump.c:44 and :89) -- so the same -1 applies once per phase.
const RULE = {
  UPSMASH: 1,          // AttackHi4
  ATTACKDASH: 1,       // AttackDash
  CLIFFJUMPQUICK: 2,   // CliffJumpQuick1 + CliffJumpQuick2, -1 each
  CLIFFJUMPSLOW: 2,
};

// No exceptions. Melee runs every character's ledge jump through one code
// path -- both phases end on ftAnim_IsFramesRemaining -- so the offset between
// the animation length and the terminal frame is necessarily the same for all
// five. Falcon's CLIFFJUMPQUICK was the only state that disagreed and has been
// brought into line.
const ACCEPTED = new Map();

let checked = 0;
let failures = 0;
for (const [c, states] of Object.entries(DISC)) {
  for (const [state, len] of Object.entries(states)) {
    const file = path.join(SRC, "characters", c, "moves", state + ".js");
    if (!fs.existsSync(file) || len === 0) { continue; }
    const txt = fs.readFileSync(file, "utf8");
    const hits = [...txt.matchAll(/timer > (\d+)/g)].map((m) => Number(m[1]));
    if (hits.length === 0) { continue; }
    checked++;
    // The terminal condition is the largest threshold in the file; the smaller
    // ones are phase boundaries within the animation.
    const actual = Math.max(...hits);
    const want = len - RULE[state];
    const accepted = ACCEPTED.get(`${c} ${state}`);
    if (actual === accepted) { continue; }
    if (actual !== want) {
      console.log(`FAIL ${c} ${state}: ends at ${actual}, but the animation is `
        + `${len} frames so it should end at ${want} `
        + `(${actual < want ? want - actual : actual - want} frame(s) `
        + `${actual < want ? "short" : "long"})`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} state duration(s) disagree with the disc.`);
  process.exit(1);
}
console.log(`  ${checked} state durations match their own character's animation`);
