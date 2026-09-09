// Rewrite grounded `cVel.x` assignments onto the grounded velocity channel.
//
// Only the confident shape is touched:
//   player[E].phys.cVel.x  = RHS;   ->  setGroundVelocity(E, RHS);
//   player[E].phys.cVel.x += RHS;   ->  setGroundVelocity(E, getGroundVelocity(E) + (RHS));
//   player[E].phys.cVel.x -= RHS;   ->  setGroundVelocity(E, getGroundVelocity(E) - (RHS));
//
// Deliberately NOT touched:
//   * cVel.y            -- vertical is not the grounded channel; each site
//                          needs its own judgement
//   * *= and other ops  -- rare, and the read-modify-write shape differs
//   * anything in physics/  -- the core loop is hand-ported, not batch-edited
//   * files whose action state is airborne or ambiguous
//
//   node tools/convert_cvel.mjs           dry run, prints the diff
//   node tools/convert_cvel.mjs --write   apply
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "src");
const WRITE = process.argv.includes("--write");

// Same classification as triage_cvel.mjs; kept in step by hand deliberately so
// a change there cannot silently widen what this rewrites.
const GROUNDED = [
  /^WALK/, /^DASH/, /^RUN/, /^TURN/, /^SQUAT/, /^GUARD/, /^ATTACK\d/, /^TILT/,
  /^SMASH/, /^JAB/, /^ATTACKDASH/, /^GRAB/, /^CATCH/, /^THROW/, /^PUMMEL/, /^DOWNSTAND/,
  /^DOWNWAIT/, /^DOWNBOUND/, /^TECH/, /^WAIT/, /^OTTOTTO/, /^ESCAPEF/,
  /^ESCAPEB/, /^ESCAPEN/, /^LANDINGATTACK/, /^REBOUND/, /^FURA/, /^SLEEP/,
  /^ENTRY/, /^APPEAL/, /^TAUNT/, /GROUND/,
];
const AIRBORNE = [
  /AIR/, /^FALL/, /^JUMPAERIAL/, /^JUMPF/, /^JUMPB/, /^DAMAGEFLY/, /^DAMAGEFALL/,
  /^ESCAPEAIR/, /^TUMBLE/, /^CLIFF/, /^WALLJUMP/, /^WALLDAMAGE/, /^WALLTECH/,
  /^THROWN/, /^DEAD/, /^REBIRTH/, /^MULTIJUMP/, /Drift/, /^LANDING/, /^STOPCEIL/,
  /^SHIELDBREAKFALL/, /^UPSPECIALLAUNCH/, /^UPSPECIALCHARGE/,
  // "AERIAL" does not contain the substring "AIR".
  /AERIAL/, /Air/,
];

// player[<expr>].phys.cVel.x <op> <rhs>;
const ASSIGN =
  /^(\s*)player\[([^\]]+)\]\.phys\.cVel\.x\s*(=|\+=|-=)\s*(.+);\s*$/;

function walk (dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); }
    else if (e.name.endsWith(".js")) { out.push(p); }
  }
  return out;
}

let changedFiles = 0, changedSites = 0;

for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\\/g, "/");
  if (rel.startsWith("physics/")) { continue; }
  const base = path.basename(file, ".js");
  if (AIRBORNE.some(r => r.test(base))) { continue; }
  if (!GROUNDED.some(r => r.test(base))) { continue; }

  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  let needsSet = false, needsGet = false, hits = 0;

  const out = lines.map(line => {
    const m = ASSIGN.exec(line);
    if (!m) { return line; }
    const [, indent, subject, op, rawRhs] = m;
    hits++;
    needsSet = true;

    // A right-hand side that READS cVel.x must read the scalar instead. On a
    // slope cVel.x is grVel * normal.y, i.e. the horizontal PROJECTION, so a
    // decay expression like
    //     cVel.x = sign(cVel.x) * max(abs(cVel.x) - friction, 0)
    // would otherwise decay the projection and then re-project it, shrinking
    // the velocity twice per frame on any inclined surface.
    const readRe = new RegExp(
      `player\\[${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`
      + `\\.phys\\.cVel\\.x`, "g");
    let rhs = rawRhs;
    if (readRe.test(rawRhs)) {
      rhs = rawRhs.replace(readRe, `getGroundVelocity(${subject})`);
      needsGet = true;
    }

    if (op === "=") {
      return `${indent}setGroundVelocity(${subject}, ${rhs});`;
    }
    needsGet = true;
    const sign = op === "+=" ? "+" : "-";
    return `${indent}setGroundVelocity(${subject}, `
         + `getGroundVelocity(${subject}) ${sign} (${rhs}));`;
  });

  if (!hits) { continue; }

  let text = out.join("\n");

  // Add or widen the groundMovement import.
  const impRe = /import\s*\{([^}]*)\}\s*from\s*"physics\/groundMovement";/;
  const existing = impRe.exec(text);
  const wanted = new Set(["setGroundVelocity"]);
  if (needsGet) { wanted.add("getGroundVelocity"); }
  if (existing) {
    const have = new Set(existing[1].split(",").map(s => s.trim()).filter(Boolean));
    for (const w of wanted) { have.add(w); }
    text = text.replace(impRe,
      `import {${[...have].sort().join(", ")}} from "physics/groundMovement";`);
  } else {
    // Insert after the last existing import so it lands in the import block.
    const importLines = [...text.matchAll(/^import .*;$/gm)];
    const decl = `import {${[...wanted].sort().join(", ")}} from "physics/groundMovement";`;
    if (importLines.length) {
      const last = importLines[importLines.length - 1];
      const at = last.index + last[0].length;
      text = text.slice(0, at) + "\n" + decl + text.slice(at);
    } else {
      text = decl + "\n" + text;
    }
  }

  changedFiles++;
  changedSites += hits;
  if (WRITE) {
    fs.writeFileSync(file, text);
  } else {
    console.log(`${rel}  (${hits} site${hits === 1 ? "" : "s"})`);
    lines.forEach((l, i) => {
      if (ASSIGN.test(l)) { console.log(`  - ${l.trim()}\n  + ${out[i].trim()}`); }
    });
  }
}

console.log(`\n${WRITE ? "rewrote" : "would rewrite"} `
          + `${changedSites} sites in ${changedFiles} files`);
