// Only Jigglypuff may test jumpsUsed without a multiJump guard.
//
//   node test/check-multijump.mjs
//
// `player.phys.jumpsUsed` is incremented ONLY in Jigglypuff's own move files --
// her JUMPAERIAL1..5 and AERIALTURN1..5. For every other character it is
// created at 0 and never touched, so a bare
//
//     jumpsUsed < <limit>
//
// is unconditionally true for them. The shared airborne states pair it with
// `charAttributes.multiJump` for exactly that reason:
//
//     !doubleJumped || (multiJump && jumpsUsed < maxJumps - 1)
//
// Drop the guard and Fox, Falco, Falcon and Marth get infinite midair jumps,
// and nothing else in the suite notices: the attribute is still right, the
// states still resolve, every per-frame table is still long enough. It happened
// during a mechanical replace of a hardcoded 5 with maxJumps - 1 across sixteen
// files, which is exactly the kind of edit that goes wrong in one file of many.
//
// Scans the file TEXT rather than lines, because one condition in ai.js wraps
// mid-expression and a line-scoped test reports it as unguarded when it is not.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const EXEMPT = path.join("characters", "puff") + path.sep;
const WINDOW = 200;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const offenders = [];
let guarded = 0;
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file);
  const text = fs.readFileSync(file, "utf8");
  const re = /jumpsUsed\s*</g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const near = text.slice(Math.max(0, m.index - WINDOW), m.index + WINDOW);
    if (rel.startsWith(EXEMPT) || near.includes("multiJump")) { guarded++; continue; }
    const line = text.slice(0, m.index).split("\n").length;
    const snippet = text.slice(m.index, m.index + 90).split("\n")[0];
    offenders.push(rel + ":" + line + "  " + snippet.trim());
  }
}

console.log();
if (offenders.length) {
  console.log("  " + offenders.length + " unguarded jumpsUsed comparison(s) -- these give");
  console.log("  every non-Puff character unlimited midair jumps:");
  for (const o of offenders) console.log("    " + o);
  process.exit(1);
}
console.log("  " + guarded + " jumpsUsed comparison(s), all guarded by multiJump or Puff-local");
