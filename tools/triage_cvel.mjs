// Classify every cVel write site as grounded, airborne, or ambiguous.
//
// Melee keeps self-movement in TWO channels. Grounded, `gr_vel` is a scalar
// along the floor and the 2D velocity is derived from it by projection onto
// the floor tangent; airborne, `self_vel` IS the 2D velocity. meleelight has a
// single `cVel`, so every grounded write that goes straight to cVel.x silently
// skips the projection -- correct on flat ground, wrong on every slope.
//
// This does not rewrite anything. It sorts the sites so the conversions can be
// done in confident batches, and so the ambiguous remainder is a short list a
// human can actually read.
//
//   node tools/triage_cvel.mjs            summary
//   node tools/triage_cvel.mjs --list <bucket>
//
// Buckets:
//   grounded   a grounded-only state writing cVel directly -- needs converting
//   airborne   an airborne-only state; cVel IS self_vel there, nothing to do
//   both       a state that spans the transition; correct if it is the air side
//   physics    the engine itself, including the friction helpers that ARE the
//              implementation of the two channels
//   vertical   a cVel.y write; gr_vel is a horizontal scalar, so this migration
//              does not apply to it either way
//   verified   annotated `cVel-channel: self_vel (<citation>)` -- a state whose
//              own Melee code writes self_vel even while grounded
//   ambiguous  the file name settles nothing and nobody has looked yet
//   converted  already routed through the grounded channel
//
// `ambiguous` reaching zero is the goal; it does NOT mean every site is
// converted, it means every site has been classified with a reason.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "src");

// An action state's name settles the channel in most cases. These are matched
// against the FILE NAME (the move files are named for their action state).
const AIRBORNE = [
  /AIR/, /^FALL/, /^JUMPAERIAL/, /^JUMPF/, /^JUMPB/, /^DAMAGEFLY/, /^DAMAGEFALL/,
  /^ESCAPEAIR/, /^TUMBLE/, /^CLIFF/, /^WALLJUMP/, /^WALLDAMAGE/, /^WALLTECH/,
  /^THROWN/, /^DEAD/, /^REBIRTH/, /^MULTIJUMP/, /Drift/, /^LANDING/, /^STOPCEIL/,
  /^SHIELDBREAKFALL/, /^UPSPECIALLAUNCH/, /^UPSPECIALCHARGE/,
  // "AERIAL" does not contain the substring "AIR".
  /AERIAL/, /Air/,
];
const GROUNDED = [
  /^WALK/, /^DASH/, /^RUN/, /^TURN/, /^SQUAT/, /^GUARD/, /^ATTACK\d/, /^TILT/,
  /^SMASH/, /^JAB/, /^ATTACKDASH/, /^GRAB/, /^CATCH/, /^THROW/, /^PUMMEL/, /^DOWNSTAND/,
  /^DOWNWAIT/, /^DOWNBOUND/, /^TECH/, /^WAIT/, /^OTTOTTO/, /^ESCAPEF/,
  /^ESCAPEB/, /^ESCAPEN/, /^LANDINGATTACK/, /^REBOUND/, /^FURA/, /^SLEEP/,
  /^ENTRY/, /^APPEAL/, /^TAUNT/, /GROUND/,
];

// A bare `=` must not match `===` (or `!==`, `<=`, `>=`). Without the
// lookarounds, `if (cVel.x === 0)` counts as a write and inflates the
// buckets with comparisons -- physics.js alone had 2 such phantoms.
const WRITE = /(?:player\[[^\]]+\]\.phys\.)?cVel\.(x|y)\s*(?<![=!<>])(?:=(?!=)|\+=|-=|\*=)/;

function walk (dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); }
    else if (e.name.endsWith(".js")) { out.push(p); }
  }
  return out;
}

function classify (file) {
  const base = path.basename(file, ".js");
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  if (rel.startsWith("physics/")) { return "physics"; }
  const air = AIRBORNE.some(r => r.test(base));
  const gnd = GROUNDED.some(r => r.test(base));
  if (air && gnd) { return "both"; }
  if (air) { return "airborne"; }
  if (gnd) { return "grounded"; }
  return "ambiguous";
}

// An explicit, cited claim that a site is correct writing cVel directly --
// i.e. Melee's own code for that state uses self_vel rather than gr_vel.
//
// This exists because "converted" and "still wrong" are not the only outcomes.
// Falcon's Dive is the clear case: ftCa_SpecialAirHi_Phys just calls
// ftCa_SpecialHi_Phys, and that function writes self_vel.x directly even in the
// GROUNDED state, so the grounded-channel conversion would be the bug. Without
// a way to record that, such sites sit in `ambiguous` forever and every future
// pass re-derives the same answer.
//
// The marker must carry a citation; the regex requires the parenthesised file
// reference so it cannot be used as a bare silencer.
const VERIFIED = /cVel-channel:\s*self_vel\s*\([^)]+\)/;

// `gr_vel` is a SCALAR along the floor -- it has no vertical component at all.
// While grounded, ftCommon_ApplyGroundMovement derives both self_vel.x and
// self_vel.y from it by projecting onto the floor tangent; while airborne,
// self_vel.y is gravity's business. Either way a write to cVel.y is not part
// of this migration, which is only ever about where HORIZONTAL self-movement
// lives. Counting them alongside the x-writes made the backlog look twice the
// size it is and buried the sites that actually need a decision.
const VERTICAL = /cVel\.y\s*(?<![=!<>])(?:=(?!=)|\+=|-=|\*=)/;

// Commented-out code and prose that happens to quote a cVel write are not
// sites. ai.js contributed two dead lines and this file's own explanatory
// comments contributed more.
const COMMENT = /^\s*(?:\/\/|\*|\/\*)/;

const buckets = { grounded: [], airborne: [], both: [], physics: [],
                  ambiguous: [], verified: [], vertical: [], converted: [] };

for (const file of walk(SRC)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  lines.forEach((line, i) => {
    if (!WRITE.test(line)) { return; }
    if (COMMENT.test(line)) { return; }
    // A site already routed through the grounded channel is done.
    const near = lines.slice(Math.max(0, i - 12), i + 4).join("\n");
    const done = /setGroundVelocity|projectGroundVelocity|syncGrVelFromCVel/
      .test(lines.slice(Math.max(0, i - 3), i + 4).join("\n"));
    const b = done ? "converted"
            : VERTICAL.test(line) ? "vertical"
            : VERIFIED.test(near) ? "verified"
            : classify(file);
    buckets[b].push({ rel, line: i + 1, text: line.trim() });
  });
}

const arg = process.argv[2];
if (arg === "--list") {
  const which = process.argv[3];
  if (!buckets[which]) {
    console.error(`unknown bucket ${which}; have ${Object.keys(buckets)}`);
    process.exit(2);
  }
  const byFile = new Map();
  for (const s of buckets[which]) {
    if (!byFile.has(s.rel)) { byFile.set(s.rel, []); }
    byFile.get(s.rel).push(s);
  }
  for (const [rel, sites] of [...byFile].sort()) {
    console.log(`\n${rel}  (${sites.length})`);
    for (const s of sites) { console.log(`  ${String(s.line).padStart(5)}  ${s.text}`); }
  }
  process.exit(0);
}

let total = 0;
for (const [name, sites] of Object.entries(buckets)) {
  total += sites.length;
  const files = new Set(sites.map(s => s.rel)).size;
  console.log(`  ${name.padEnd(10)} ${String(sites.length).padStart(4)} sites in ${files} files`);
}
console.log(`  ${"TOTAL".padEnd(10)} ${String(total).padStart(4)}`);
