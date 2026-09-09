// meleelight's per-frame movement tables must still match the disc.
//
// Melee moves a fighter from its animation when the subaction carries x594_b0
// AND the state's physics callback reads x6A4_transNOffset (see
// tools/root_motion.py). meleelight reproduces that with hand-recorded tables:
// `setVelocities` applied as `setGroundVelocity(p, t[frame-1] * face)`, which
// is exactly `gr_vel = transNOffset.z * facing_dir` (ft_084E.c:83, 113), and
// the ledge states' `offset` tables, which are `transNPos` measured from the
// ledge corner (ftCo_CliffClimb.c:109).
//
// Those tables were measured off a screen years before this project had the
// disc, and they are RIGHT -- Fox's ledge offsets match to four decimals. This
// guard is here so they stay right: the generated data in
// src/characters/<char>/rootMotion.js comes straight from the disc, and any
// edit that drifts a hand table away from it now fails here instead of
// silently changing how far a roll or a getup travels.
//
// It compares TOTALS rather than per-frame values, because a per-frame
// comparison would fail on the last ~0.1 of hand-recording noise while a total
// that has drifted is a real change in distance travelled.
//
//   node test/check-root-motion.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const CHARS = ["fox", "falco", "falcon", "marth", "puff"];

// How far a total may drift from the disc before it is a real difference.
// Rolls travel 33-46 units, so 0.5 is about 1.5% and comfortably past the
// hand-recording noise.
const TOL = 0.5;

function readRootMotion(c) {
  const txt = fs.readFileSync(path.join(SRC, "characters", c, "rootMotion.js"), "utf8");
  const vel = {}, pin = {};
  const velBlock = txt.slice(txt.indexOf("vel: {"), txt.indexOf("pin: {"));
  for (const m of velBlock.matchAll(/^\s*([A-Z0-9]+): \[([^\]]*)\],/gm)) {
    vel[m[1]] = m[2].split(",").map(Number);
  }
  const pinBlock = txt.slice(txt.indexOf("pin: {"));
  for (const m of pinBlock.matchAll(/^\s*([A-Z0-9]+): \[(.*)\],$/gm)) {
    pin[m[1]] = [...m[2].matchAll(/\[(-?[\d.]+),(-?[\d.]+)\]/g)]
      .map((q) => [Number(q[1]), Number(q[2])]);
  }
  return { vel, pin };
}

// A state's setVelocities, wherever it is declared -- inline in the move file
// or assigned in the character's index.js.
// A state that calls applyRootMotion() reads the generated disc data at
// runtime, so it has no table to drift and nothing to compare.
function readsDiscDirectly(c, state) {
  for (const f of [path.join(SRC, "characters", c, "moves", state + ".js"),
                   path.join(SRC, "characters", "shared", "moves", state + ".js")]) {
    if (fs.existsSync(f)
        && fs.readFileSync(f, "utf8").includes(`applyRootMotion(p, "${state}")`)) {
      return true;
    }
  }
  return false;
}

function mlVelocities(c, state) {
  const files = [
    path.join(SRC, "characters", c, "moves", state + ".js"),
    path.join(SRC, "characters", "shared", "moves", state + ".js"),
    path.join(SRC, "characters", c, "index.js"),
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) { continue; }
    const txt = fs.readFileSync(f, "utf8");
    const re = f.endsWith("index.js")
      ? new RegExp("\\." + state + "\\.setVelocities\\s*=\\s*\\[([^\\]]*)\\]")
      : /setVelocities\s*:\s*\[([^\]]*)\]/;
    const m = txt.match(re);
    if (m && m[1].trim() !== "") { return m[1].split(",").map(Number); }
  }
  return null;
}

let checked = 0;
let failures = 0;
for (const c of CHARS) {
  const { vel } = readRootMotion(c);
  for (const state of Object.keys(vel)) {
    if (readsDiscDirectly(c, state)) { checked++; continue; }
    const ml = mlVelocities(c, state);
    if (ml === null) {
      // No table here at all: only a problem if the disc says this state
      // travels, which is what the sum tells us.
      const disc = vel[state].reduce((a, b) => a + b, 0);
      if (Math.abs(disc) > TOL) {
        console.log(`FAIL ${c} ${state}: the disc moves the fighter `
          + `${disc.toFixed(2)} units over this state (x594_b0 set, physics `
          + `reads transNOffset) and meleelight has no setVelocities table`);
        failures++;
      }
      continue;
    }
    checked++;
    const a = vel[state].reduce((x, y) => x + y, 0);
    const b = ml.reduce((x, y) => x + y, 0);
    if (Math.abs(a - b) > TOL) {
      console.log(`FAIL ${c} ${state}: travels ${b.toFixed(2)} units here, `
        + `${a.toFixed(2)} on the disc (diff ${(b - a).toFixed(2)})`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} movement table(s) disagree with the disc.`);
  process.exit(1);
}
console.log(`  ${checked} movement tables match the disc's root motion`);
