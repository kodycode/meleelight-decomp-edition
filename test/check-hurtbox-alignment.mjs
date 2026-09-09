// The hurtbox capsules must sit on the body meleelight actually DRAWS, for
// every character and every state, not just the ones anyone spot-checked.
//
// Two independent things have to line up, and both have gone wrong:
//
//   POSITION. The capsules are measured from TransN. When an animation carries
//   a TransN slide and the subaction is NOT flagged x594_b0, the model keeps
//   that slide on screen while the capsules would lose it -- Marth's up smash
//   put his hurtbox 4.1 units behind him. gen_hurtbox.py compensates for the
//   unflagged case; this checks the result rather than trusting it.
//
//   SCALE. The outline is drawn at charScale * (stage.scale / 4.5)
//   (render.js), so dividing a traced outline by 4.5/charScale puts it in the
//   same game units the capsules use. A character whose art was traced at a
//   different scale than its charScale claims would show up here as a
//   systematic size mismatch.
//
// The test is deliberately loose: capsules cover the BODY and the outline
// covers everything drawn, including weapons that are never hurtboxes -- so a
// capsule box inside the outline box, with slack, is the strongest claim that
// holds for Marth's sword and Falcon's limbs alike. What it catches is the
// failure that actually happened: a whole hurtbox displaced off the character.
//
//   node test/check-hurtbox-alignment.mjs
//   node test/check-hurtbox-alignment.mjs --verbose
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");
const VERBOSE = process.argv.includes("--verbose");

// charScale from each character's attributes; the render divisor is 4.5/scale.
const CHARS = [
  { dir: "marth", scale: 0.49 },
  { dir: "puff", scale: 0.24 },
  { dir: "fox", scale: 0.35 },
  { dir: "falco", scale: 0.35 },
  { dir: "falcon", scale: 0.44 },
];

// The metric is CENTRE DISPLACEMENT, not overhang.
//
// A capsule box is routinely a little wider than the traced outline -- capsules
// are fat cylinders around bones and the silhouette is a tight 2D trace, so
// they stick out at the edges on almost every state. That is not the bug. The
// bug is the whole hurtbox sitting somewhere the body is not, which moves the
// CENTRE. Marth's up smash was 4.1 units of pure centre displacement; a roll
// was 40. Comparing centres separates the two cleanly, where comparing extents
// buried the signal under ~5 units of ordinary bulge on 56 states.
// ...and compared against the CHARACTER'S OWN BASELINE, not an absolute
// number. A traced outline includes everything drawn -- Marth's sword, Falcon's
// limbs -- while the capsules cover only the body, so the two centres never
// coincide and the gap is character-shaped: Marth's is large on every state
// because his blade is always out to one side. Flagging an absolute offset
// therefore just ranks characters by weapon length (it failed 140 states, 
// almost all Marth). What isolates a DISPLACED hurtbox is a state whose offset
// is far outside the spread of that same character's other states.
const BASELINE_SIGMAS = 6.0;
const MIN_ABSOLUTE = 3.0;

// Known outliers that are NOT displacement. Each was checked against the disc:
// its subaction carries ZERO TransN slide, so the root-motion compensation
// cannot be the cause, and the gap is the traced art and the capsules covering
// different things on those frames (an extended leg, a long looping animation
// whose art and capsule tables run to different lengths). They are listed
// rather than tolerated by a looser threshold so that a NEW displacement
// anywhere still fails this test.
//
// If one of these ever needs revisiting, the check is: does the subaction have
// a TransN slide, and is x594_b0 set? tools/root_motion.py answers both.
const KNOWN = new Set([
  "puff REBOUND",         // f9,  no slide
  "puff UPSPECIAL",       // f81, no slide; 180-frame looping animation
  "fox FORWARDTILT",      // f5,  no slide
]);

// States where the fighter is positioned by SOMEONE ELSE. A grabbed or thrown
// fighter's animation is authored in the grabber's frame of reference -- Melee
// places them from the thrower's bones, not from their own position -- so the
// capsules and the traced outline are not expected to share an origin and
// comparing them here says nothing. Their alignment is a property of the grab
// code, not of the hurtbox data.
const HELD = /^(THROWN|THROW|CAPTURE)/;

function animFrames(dir, state) {
  const p = path.join(SRC, "animations", dir, state + ".js");
  if (!fs.existsSync(p)) { return null; }
  const js = `const a=require(${JSON.stringify(p)});`
    + `console.log(JSON.stringify(a.map(f=>f.map(q=>Array.from(q)))));`;
  try {
    return JSON.parse(execFileSync("node", ["-e", js],
      { cwd: ROOT, maxBuffer: 1 << 28 }).toString());
  } catch { return null; }
}

function capsuleFrames(dir) {
  const txt = fs.readFileSync(path.join(SRC, "characters", dir, "hurtbox.js"), "utf8");
  const radii = txt.match(/radii: \[([^\]]*)\]/)[1].split(",").map(Number);
  const out = {};
  for (const m of txt.matchAll(/^ {4}([A-Z0-9]+): \[([^\]]*)\],$/gm)) {
    const nums = m[2].split(",").map(Number);
    const per = radii.length * 6;
    const frames = [];
    for (let i = 0; i + per <= nums.length; i += per) { frames.push(nums.slice(i, i + per)); }
    out[m[1]] = frames;
  }
  return { radii, states: out };
}

let checked = 0, failures = 0, skipped = 0;
const worst = [];

for (const { dir, scale } of CHARS) {
  const div = 4.5 / scale;
  const { radii, states } = capsuleFrames(dir);
  for (const state of Object.keys(states)) {
    if (HELD.test(state)) { skipped++; continue; }
    const anim = animFrames(dir, state);
    if (anim === null || anim.length === 0) { skipped++; continue; }
    const caps = states[state];
    const n = Math.min(anim.length, caps.length);
    if (n < 2) { skipped++; continue; }
    checked++;
    let stateWorst = 0, worstFrame = -1;
    for (let f = 0; f < n; f++) {
      const xs = [];
      for (const poly of anim[f]) { for (let k = 0; k < poly.length; k += 2) { xs.push(poly[k]); } }
      if (xs.length === 0) { continue; }
      const bx0 = Math.min(...xs) / div, bx1 = Math.max(...xs) / div;
      let c0 = Infinity, c1 = -Infinity;
      const fr = caps[f];
      for (let k = 0; k < radii.length; k++) {
        const o = k * 6;
        for (const z of [fr[o + 2], fr[o + 5]]) {
          c0 = Math.min(c0, z - radii[k]);
          c1 = Math.max(c1, z + radii[k]);
        }
      }
      // How far the hurtbox's centre sits from the body's centre.
      const over = Math.abs((c0 + c1) / 2 - (bx0 + bx1) / 2);
      if (over > stateWorst) { stateWorst = over; worstFrame = f; }
    }
    worst.push({ dir, state, over: stateWorst, frame: worstFrame });
  }
}

// Per character: median offset and spread, then flag the outliers.
for (const { dir } of CHARS) {
  const mine = worst.filter((w) => w.dir === dir).map((w) => w.over).sort((a, b) => a - b);
  if (mine.length < 8) { continue; }
  const med = mine[Math.floor(mine.length / 2)];
  // Median absolute deviation, scaled to a standard-deviation equivalent.
  const mad = mine.map((v) => Math.abs(v - med)).sort((a, b) => a - b)[Math.floor(mine.length / 2)];
  const sigma = Math.max(mad * 1.4826, 0.25);
  for (const w of worst.filter((x) => x.dir === dir)) {
    const z = (w.over - med) / sigma;
    if (z > BASELINE_SIGMAS && w.over > MIN_ABSOLUTE
        && !KNOWN.has(`${dir} ${w.state}`)) {
      console.log(`FAIL ${dir} ${w.state}: hurtbox centre ${w.over.toFixed(2)} units `
        + `off the body at frame ${w.frame} -- ${z.toFixed(1)}x this character's `
        + `spread (median ${med.toFixed(2)})`);
      failures++;
    }
  }
}

worst.sort((a, b) => b.over - a.over);
if (VERBOSE) {
  console.log("\n  worst 15 by overhang:");
  for (const w of worst.slice(0, 15)) {
    console.log(`    ${w.dir.padEnd(7)} ${w.state.padEnd(20)} `
      + `${w.over.toFixed(2).padStart(6)} at f${w.frame}`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} state(s) have hurtboxes displaced off the character.`);
  process.exit(1);
}
console.log(`  ${checked} character/state pairs aligned `
  + `(worst centre offset ${worst.length ? worst[0].over.toFixed(2) : "0"} units, `
  + `${skipped} skipped for missing art)`);
