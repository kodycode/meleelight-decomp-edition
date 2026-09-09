// ESM resolver for the headless physics harness.
//
// meleelight is built by webpack with `resolve.root = src`, so modules use bare
// specifiers like "physics/f32" and "main/main". Node has no idea about that,
// and the source files are .js containing ESM (no "type": "module"), so Node
// would also try to parse them as CommonJS.
//
// This loader fixes both: it maps webpack-style specifiers onto the real src
// tree, substitutes lightweight stubs for the non-physics dependencies (sound,
// vfx, per-character move tables), and forces every src file to be treated as
// an ES module.
//
// Nothing here touches the app. No webpack, no node_modules, no rendering.

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { stripFlow } from "./flow-strip.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");
const STUBS = path.join(HERE, "stubs");

// Specifiers replaced with stubs: everything the physics code imports but does
// not exercise. Keeping these out avoids pulling in ~500 move files.
const STUBBED = new Map([
  ["main/main", "main-main.mjs"],
  ["main/sfx", "sfx.mjs"],
  ["main/characters", "characters.mjs"],
  ["main/vfx/drawVfx", "drawVfx.mjs"],
  ["main/render", "empty.mjs"],
  ["settings", "settings.mjs"],
  ["characters/fox/moves/index", "moves-index.mjs"],
  ["characters/puff/moves/index", "moves-index.mjs"],
  ["characters/marth/moves/index", "moves-index.mjs"],
  ["characters/falco/moves/index", "moves-index.mjs"],
  ["characters/falcon/moves/index", "moves-index.mjs"],
  ["characters/shared/moves/JUMPAERIALB", "move.mjs"],
  ["characters/shared/moves/JUMPAERIALF", "move.mjs"],
  ["main/util/createHitboxObject", "hitbox.mjs"],
  ["main/util/createHitBox", "hitbox.mjs"],
  ["main/multiplayer/streamclient", "multiplayer.mjs"],
  ["main/multiplayer/deepclient", "multiplayer.mjs"],
]);

const STUBBED_PKGS = new Set();

const ROOTS = ["main", "physics", "characters", "stages", "settings"];

function withJs(p) {
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + ".js")) return p + ".js";
  const idx = path.join(p, "index.js");
  if (fs.existsSync(idx)) return idx;
  return null;
}

function normalize(spec) {
  // "./physics/f32" and "../main/main" style keys used by STUBBED lookups
  return spec.replace(/^\.\//, "").replace(/\.js$/, "");
}

export async function resolve(specifier, context, nextResolve) {
  // 1. stubs, by exact webpack-style specifier
  const key = normalize(specifier);
  if (STUBBED.has(key)) {
    return { url: pathToFileURL(path.join(STUBS, STUBBED.get(key))).href,
             shortCircuit: true };
  }

  // 2. relative specifiers inside src -- add the missing .js
  if (specifier.startsWith(".") && context.parentURL
      && context.parentURL.startsWith("file:")) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const abs = path.resolve(parentDir, specifier);
    // a relative import may still land on something we want stubbed
    const rel = normalize(path.relative(SRC, abs).split(path.sep).join("/"));
    if (STUBBED.has(rel)) {
      return { url: pathToFileURL(path.join(STUBS, STUBBED.get(rel))).href,
               shortCircuit: true };
    }
    const hit = withJs(abs);
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // 3. webpack root-relative bare specifiers, e.g. "physics/f32"
  const head = specifier.split("/")[0];
  if (ROOTS.includes(head)) {
    const hit = withJs(path.join(SRC, specifier));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // 4. Third-party npm packages (jquery, uws, electron, ...). There is no
  //    node_modules here by design -- the harness must run without an install.
  //    These are reached transitively from non-physics code (multiplayer,
  //    rendering) and are never exercised by the tests, so an empty stub is
  //    correct rather than merely convenient.
  //
  //    Logged, not silent: a physics module that unexpectedly depends on a
  //    package should be visible rather than quietly neutered.
  if (!specifier.startsWith(".") && !specifier.startsWith("/")
      && !path.isAbsolute(specifier)) {
    try {
      return await nextResolve(specifier, context);
    } catch {
      if (!STUBBED_PKGS.has(specifier)) {
        STUBBED_PKGS.add(specifier);
        if (process.env.HARNESS_VERBOSE) {
          console.error(`  [harness] stubbed third-party package: ${specifier}`);
        }
      }
      return { url: pathToFileURL(path.join(STUBS, "empty.mjs")).href,
               shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  // Force ESM for src/ and stubs -- the .js files have no "type": "module".
  if (url.startsWith("file:")) {
    const p = fileURLToPath(url);
    if ((p.startsWith(SRC) || p.startsWith(STUBS)) && p.endsWith(".js")) {
      // Flow annotations must come out before Node parses the file --
      // physics.js and hitDetection.js are otherwise unloadable, which is
      // exactly the blind spot that let a missing import ship silently.
      return {
        format: "module",
        source: stripFlow(fs.readFileSync(p, "utf8")),
        shortCircuit: true,
      };
    }
  }
  return nextLoad(url, context);
}
