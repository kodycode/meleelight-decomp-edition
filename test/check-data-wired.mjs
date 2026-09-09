// Generated data modules must actually be REACHABLE from the bundle entry.
//
// tools/gen_hurtbox.py wrote ~10 MB of per-frame hurtbox capsules into
// src/characters/<char>/hurtbox.js, each file ending in a side-effecting
// setHurtboxData(CHARIDS.X_ID, {...}) call. Nothing imported them. webpack
// only bundles what is reachable from an entry, so the five registrations
// never ran, hurtboxData stayed an empty array, and every caller took its
// null path:
//
//   hurtCapsules()      -> null
//   hurtCapsulesWorld() -> null
//   hitsHurtCapsules()  -> falls back to the flat charAttributes.hurtboxOffset
//                          box, so HIT DETECTION silently used a rectangle
//   render.js           -> drew that same rectangle instead of capsules
//
// Nothing errored. The game played, hits landed, and the only visible symptom
// was that the debug hurtbox overlay drew squares. A side-effect-only module
// that no one imports fails silently by construction, which is exactly what a
// build-time check is for.
//
// This walks the import graph from the entry rather than grepping for the
// import line, so moving the import somewhere else still passes and deleting
// it anywhere in the chain still fails.
//
//   node test/check-data-wired.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SRC = path.join(ROOT, "src");
const ENTRY = path.join(SRC, "main.js");

// The generated side-effect modules that must be reachable, and the export
// each one is expected to call. Add a row when a new generator lands.
const REQUIRED = [
  { file: "characters/fox/hurtbox.js", calls: "setHurtboxData" },
  { file: "characters/falco/hurtbox.js", calls: "setHurtboxData" },
  { file: "characters/falcon/hurtbox.js", calls: "setHurtboxData" },
  { file: "characters/marth/hurtbox.js", calls: "setHurtboxData" },
  { file: "characters/puff/hurtbox.js", calls: "setHurtboxData" },
  { file: "characters/fox/rootMotion.js", calls: "setRootMotion" },
  { file: "characters/falco/rootMotion.js", calls: "setRootMotion" },
  { file: "characters/falcon/rootMotion.js", calls: "setRootMotion" },
  { file: "characters/marth/rootMotion.js", calls: "setRootMotion" },
  { file: "characters/puff/rootMotion.js", calls: "setRootMotion" },
];

// Mirrors createConfig's resolve: modules [src, node_modules], extensions [.js].
function resolve(spec, fromFile) {
  const bases = spec.startsWith(".")
    ? [path.resolve(path.dirname(fromFile), spec)]
    : [path.join(SRC, spec)];
  for (const b of bases) {
    for (const cand of [b, b + ".js", path.join(b, "index.js")]) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { return cand; }
    }
  }
  return null;   // node_modules, or unresolvable -- not our concern here
}

const seen = new Set();
const queue = [ENTRY];
while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) { continue; }
  seen.add(file);
  let txt;
  try { txt = fs.readFileSync(file, "utf8"); } catch { continue; }
  // `import x from "y"`, `import {a} from "y"` and bare `import "y"`.
  for (const m of txt.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/g)) {
    const r = resolve(m[1], file);
    if (r !== null) { queue.push(r); }
  }
}

let failures = 0;
for (const req of REQUIRED) {
  const abs = path.join(SRC, req.file);
  if (!fs.existsSync(abs)) {
    console.log(`FAIL ${req.file}: file is missing`);
    failures++;
    continue;
  }
  if (!fs.readFileSync(abs, "utf8").includes(req.calls + "(")) {
    console.log(`FAIL ${req.file}: does not call ${req.calls}()`);
    failures++;
    continue;
  }
  if (!seen.has(abs)) {
    console.log(`FAIL ${req.file}: not reachable from src/main.js, so its `
      + `${req.calls}() never runs and every consumer silently uses its `
      + `fallback path`);
    failures++;
  }
}

if (failures > 0) {
  console.log(`\n${failures} generated data module(s) not wired in.`);
  process.exit(1);
}
console.log(`${REQUIRED.length}/${REQUIRED.length} generated data modules `
  + `reachable from the entry (${seen.size} modules walked).`);
