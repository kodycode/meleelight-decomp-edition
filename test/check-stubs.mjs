// Stub coverage checker.
//
// Every stub in test/stubs/ stands in for a real module. If the stub is missing
// an export that some source file imports, the harness dies at link time with
// "does not provide an export named X" -- one crash per missing name, which is
// a miserable way to find them.
//
// This finds them all at once: for each stubbed module, resolve every import of
// it across the whole tree and diff the required names against what the stub
// actually exports.
//
//   node test/check-stubs.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const STUBS = path.join(HERE, "stubs");

// Mirror of the loader's table. Kept here explicitly so this tool reports on
// exactly what the loader substitutes.
const STUBBED = new Map([
  ["main/main", "main-main.mjs"],
  ["main/sfx", "sfx.mjs"],
  ["main/characters", "characters.mjs"],
  ["main/vfx/drawVfx", "drawVfx.mjs"],
  ["main/render", "empty.mjs"],
  ["settings", "settings.mjs"],
  ["main/multiplayer/streamclient", "multiplayer.mjs"],
  ["main/multiplayer/deepclient", "multiplayer.mjs"],
  ["main/util/createHitboxObject", "hitbox.mjs"],
  ["main/util/createHitBox", "hitbox.mjs"],
]);

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, acc); }
    else if (e.name.endsWith(".js")) { acc.push(p); }
  }
  return acc;
}

// Resolve an import specifier to a src-relative module key, the same way the
// loader does. "./main", "../main/main" and "main/main" all name one module.
function resolveKey(fromFile, spec) {
  let abs;
  if (spec.startsWith(".")) {
    abs = path.resolve(path.dirname(fromFile), spec);
  } else {
    abs = path.join(SRC, spec);
  }
  return path.relative(SRC, abs).split(path.sep).join("/").replace(/\.js$/, "");
}

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/gs;

const required = new Map();   // stub key -> Set of names
for (const f of walk(SRC)) {
  if (f.includes("animations")) { continue; }
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(IMPORT_RE)) {
    const key = resolveKey(f, m[2]);
    if (!STUBBED.has(key)) { continue; }
    if (!required.has(key)) { required.set(key, new Set()); }
    for (const raw of m[1].split(",")) {
      const n = raw.trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) { required.get(key).add(n); }
    }
  }
}

let gaps = 0;
for (const [key, names] of [...required].sort()) {
  const stubFile = path.join(STUBS, STUBBED.get(key));
  const mod = await import(pathToFileURL(stubFile).href);
  const have = new Set(Object.keys(mod));
  const missing = [...names].filter((n) => !have.has(n)).sort();
  const status = missing.length ? `MISSING ${missing.length}` : "ok";
  console.log(`  ${key.padEnd(32)} ${String(names.size).padStart(3)} required  ${status}`);
  if (missing.length) {
    gaps += missing.length;
    console.log(`      ${missing.join(", ")}`);
  }
}

console.log(gaps ? `\n${gaps} missing stub export(s)` : "\nall stub exports satisfied");
process.exit(gaps ? 1 : 0);
