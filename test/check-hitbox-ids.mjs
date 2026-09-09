// A state may not assign more hitbox ids than its hitbox object defines.
//
// Move files wire hitboxes like this:
//
//     player[p].hitboxes.id[0] = player[p].charHitboxes.neutralspecialground.id0;
//     player[p].hitboxes.id[1] = player[p].charHitboxes.neutralspecialground.id1;
//     player[p].hitboxes.id[2] = player[p].charHitboxes.neutralspecialground.id2;
//
// and createHitboxObject(id0, id1, id2, id3) leaves any argument it was not
// given as `undefined`. Nothing complains at wiring time -- `hitboxes.id[1]`
// is simply undefined -- and the crash lands somewhere else entirely, on the
// first frame the move tries to use it:
//
//     NEUTRALSPECIALGROUND.js  Cannot set properties of undefined (setting 'dmg')
//     physics.js updateHitboxes  Cannot read properties of undefined (reading 'offset')
//
// which is what Jigglypuff's Rollout did the moment it was released. Her
// grounded hitbox object had one createHitbox where the state assigns three
// (the disc's subaction 304 has three). The offsets block already listed all
// three, so only the object was short.
//
// This pairs every `charHitboxes.<prop>.id<N>` a move file reads against the
// number of arguments `<prop>`'s createHitboxObject was built with.
//
//   node test/check-hitbox-ids.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const CHARS = [
  { dir: "marth", attrs: "marthAttributes.js" },
  { dir: "puff", attrs: "puffAttributes.js" },
  { dir: "fox", attrs: "attributes.js" },
  { dir: "falco", attrs: "attributes.js" },
  { dir: "falcon", attrs: "attributes.js" },
];

/** How many ids each `prop: new createHitboxObject(...)` supplies. */
function hitboxArity(txt) {
  const out = new Map();
  for (const m of txt.matchAll(/(\w+)\s*:\s*new createHitboxObject\(/g)) {
    // Walk the argument list, counting top-level commas.
    let i = m.index + m[0].length;
    let depth = 1, args = 1, seen = false;
    for (; i < txt.length && depth > 0; i++) {
      const c = txt[i];
      if (c === "(") { depth++; }
      else if (c === ")") { depth--; }
      else if (c === "," && depth === 1) { args++; }
      else if (!/\s/.test(c)) { seen = true; }
    }
    out.set(m[1], seen ? args : 0);
  }
  return out;
}

let checked = 0;
let failures = 0;
for (const { dir, attrs } of CHARS) {
  const attrTxt = fs.readFileSync(path.join(SRC, "characters", dir, attrs), "utf8");
  const arity = hitboxArity(attrTxt);
  const moveDirs = [path.join(SRC, "characters", dir, "moves"),
                    path.join(SRC, "characters", "shared", "moves")];
  for (const md of moveDirs) {
    if (!fs.existsSync(md)) { continue; }
    for (const f of fs.readdirSync(md).filter((x) => x.endsWith(".js"))) {
      const txt = fs.readFileSync(path.join(md, f), "utf8");
      for (const m of txt.matchAll(/charHitboxes\.(\w+)\.id(\d)/g)) {
        const prop = m[1], idx = Number(m[2]);
        const have = arity.get(prop);
        if (have === undefined) { continue; }   // built elsewhere or shared
        checked++;
        if (idx >= have) {
          console.log(`FAIL ${dir}/${f}: reads charHitboxes.${prop}.id${idx} but `
            + `${prop} is built with ${have} hitbox${have === 1 ? "" : "es"} `
            + `-- id${idx} is undefined and will throw when the move uses it`);
          failures++;
        }
      }
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} hitbox id reference(s) point at nothing.`);
  process.exit(1);
}
console.log(`  ${checked} hitbox id references resolve`);
