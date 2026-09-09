// Every per-frame table indexed by `player.timer` must be at least as long as
// its action state's frame count.
//
// meleelight reads these with no bounds check:
//   setVelocities[player.timer - 1] * face   -> undefined * face === NaN
//   posOffset[player.timer - 1][0]           -> TypeError
//
// A NaN velocity flows into gr_vel -> cVel -> pos, and a NaN position renders
// nothing, never lands inside the blastzone (so the fighter never dies) and
// makes the AI's nearest-enemy distance compare false forever -- the fighter
// vanishes for the rest of the match. That is what happened when a knocked-down
// opponent rolled: ESCAPEF/ESCAPEB and DOWNSTANDF/DOWNSTANDB were all one entry
// short.
//
// The frame counts are the correct half: validate_frames.py checks all 173
// against the figatree headers on the disc. It is the hand-recorded tables that
// lag behind, so this guards the tables.
//
//   node test/check-frame-tables.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHARDIR = path.resolve(HERE, "..", "src", "characters");

const CHARS = [
  { id: "MARTH_ID", dir: "marth", attrs: "marthAttributes.js" },
  { id: "PUFF_ID", dir: "puff", attrs: "puffAttributes.js" },
  { id: "FOX_ID", dir: "fox", attrs: "attributes.js" },
  { id: "FALCO_ID", dir: "falco", attrs: "attributes.js" },
  { id: "FALCON_ID", dir: "falcon", attrs: "attributes.js" },
];

function frameCounts(file) {
  const txt = fs.readFileSync(file, "utf8");
  const out = new Map();
  for (const m of txt.matchAll(/"([A-Z0-9_]+)"\s*:\s*(\d+)\s*,/g)) {
    if (!out.has(m[1])) { out.set(m[1], Number(m[2])); }
  }
  return out;
}

// Count top-level entries in an array body, so nested rows like [1,2] in a
// posOffset table count as one entry each.
function countEntries(body) {
  let depth = 0, n = 0, seen = false;
  for (const ch of body) {
    if (ch === "[") { depth++; seen = true; }
    else if (ch === "]") { depth--; }
    else if (ch === "," && depth === 0) { n++; }
    else if (!/\s/.test(ch)) { seen = true; }
  }
  return seen ? n + 1 : 0;
}

const problems = [];
let inspected = 0;

for (const c of CHARS) {
  const idx = path.join(CHARDIR, c.dir, "index.js");
  const att = path.join(CHARDIR, c.dir, c.attrs);
  if (!fs.existsSync(idx) || !fs.existsSync(att)) { continue; }

  const frames = frameCounts(att);
  const txt = fs.readFileSync(idx, "utf8");

  const re = new RegExp(
    "actionStates\\[CHARIDS\\." + c.id +
    "\\]\\.([A-Z0-9_]+)\\.(setVelocities|posOffset)\\s*=\\s*\\[([^\\]]*(?:\\][^\\]=;]*)*?)\\]\\s*;",
    "g");

  for (const m of txt.matchAll(re)) {
    const [, state, table, body] = m;
    const want = frames.get(state);
    if (want === undefined) { continue; }
    // A posOffset that is a single [x, y] pair is a fixed offset, not a
    // per-frame table (CLIFFWAIT.posOffset = [-70.6, -16.5]).
    if (table === "posOffset" && !body.includes("[")) { continue; }
    inspected++;
    const have = countEntries(body);
    if (have < want) {
      problems.push({ char: c.dir, state, table, have, want });
    }
  }
}

console.log(`\n  inspected ${inspected} per-frame tables`);
if (problems.length === 0) {
  console.log("\n  every per-frame table covers its action state's frames\n");
  process.exit(0);
}

console.log(`\n  ${problems.length} table(s) shorter than their frame count:\n`);
for (const p of problems) {
  console.log(`  ${p.char.padEnd(8)} ${p.state.padEnd(16)} ${p.table.padEnd(14)} ` +
              `${p.have} entries for ${p.want} frames`);
}
console.log("\n  reading past the end yields NaN (setVelocities) or throws " +
            "(posOffset).\n  tools/fix_short_velocities.py extends velocity " +
            "tables with the held-pose value.\n");
process.exit(1);
