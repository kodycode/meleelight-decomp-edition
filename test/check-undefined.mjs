// Catch identifiers that are referenced but never declared, imported, or
// provided by the host -- what eslint calls no-undef.
//
// webpack does NOT catch this: an unresolved name is assumed to be a global and
// compiles fine, then throws ReferenceError the moment that line runs. That is
// how `FALCON_KICK_LAND_TRACTION_MUL` shipped -- a constant referenced in
// Falcon's air Falcon Kick landing that was never defined anywhere, so the game
// crashed only when someone actually landed a Falcon Kick.
//
//   node test/check-undefined.mjs
import { parseSync, traverse } from "@babel/core";
import { stripFlow } from "./flow-strip.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "src");

// Globals the browser/bundler genuinely provides. Anything not here and not
// bound in the file is a real unresolved reference.
const HOST_GLOBALS = new Set([
  // language
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt",
  "Math", "JSON", "Date", "RegExp", "Error", "TypeError", "RangeError",
  "ReferenceError", "SyntaxError", "EvalError", "URIError",
  "Map", "Set", "WeakMap", "WeakSet", "Promise", "Proxy", "Reflect",
  "Function", "NaN", "Infinity", "undefined", "globalThis", "escape",
  "unescape", "parseInt", "parseFloat", "isNaN", "isFinite", "eval",
  "ArrayBuffer", "DataView", "Int8Array", "Uint8Array", "Uint8ClampedArray",
  "Int16Array", "Uint16Array", "Int32Array", "Uint32Array",
  "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
  "Intl", "WeakRef", "FinalizationRegistry", "AggregateError",
  // dom / browser
  "window", "document", "navigator", "location", "history", "screen",
  "console", "alert", "confirm", "prompt", "fetch", "Headers", "Request",
  "Response", "XMLHttpRequest", "WebSocket", "Worker", "Blob", "File",
  "FileReader", "FormData", "URL", "URLSearchParams", "Image", "Audio",
  "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "TouchEvent",
  "Element", "HTMLElement", "HTMLCanvasElement", "HTMLImageElement",
  "Node", "NodeList", "DOMParser", "XPathResult", "CanvasRenderingContext2D",
  "Path2D", "ImageData", "getComputedStyle", "matchMedia",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
  "localStorage", "sessionStorage", "indexedDB", "performance", "crypto",
  "atob", "btoa", "structuredClone", "AbortController", "TextEncoder",
  "TextDecoder", "MediaRecorder", "AudioContext", "webkitAudioContext",
  "RTCPeerConnection", "RTCSessionDescription", "RTCIceCandidate",
  "Gamepad", "GamepadButton", "SVGElement", "requestIdleCallback",
  "Storage", "event", "arguments",
  // node / bundler
  "process", "require", "module", "exports", "__dirname", "__filename",
  "Buffer", "global",
  // libraries this project attaches to window
  "$", "jQuery", "Howl", "Howler", "pako", "localforage", "Peer",
  "deepstream", "io", "animations", "start",
  // Set by dist/meleelight.html (`window.offlineMode = true`) before the
  // bundle loads, and read through a `typeof ... !== "undefined"` guard.
  "offlineMode",
]);

// Vendored third-party bundles: not our source, and a browserify bundle's own
// module machinery legitimately references names its wrapper supplies.
const VENDORED = new Set([
  "main/multiplayer/peer.js",
]);

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, acc); }
    else if (e.name.endsWith(".js")) { acc.push(p); }
  }
  return acc;
}

const files = walk(ROOT).filter(
  (f) => !path.relative(ROOT, f).split(path.sep).join("/").includes("animations"));

// This codebase deliberately publishes some functions cross-file by assigning
// them to `window` (sfx.js:609 `window.changeVolume = ...`, ai.js:953
// `window.isOffstage = ...`) and calling them bare elsewhere. Those are real
// definitions, just not lexical ones, so collect them first.
const WINDOW_GLOBALS = new Set();
const srcCache = new Map();
for (const file of files) {
  const code = fs.readFileSync(file, "utf8");
  srcCache.set(file, code);
  for (const m of code.matchAll(/\bwindow\s*\.\s*([A-Za-z_$][\w$]*)\s*=/g)) {
    WINDOW_GLOBALS.add(m[1]);
  }
}

const findings = [];
let checked = 0;

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (VENDORED.has(rel)) { continue; }

  // Parse the FLOW-STRIPPED source. Type-level names (generic parameters like
  // `T`, utility types like `$ObjMap`, and the `key` in an indexer annotation
  // `{[key: number]: bool}`) are not value bindings, so scope analysis reports
  // them as unresolved. Stripping types first removes them entirely and leaves
  // only genuine value references.
  let ast;
  try {
    ast = parseSync(stripFlow(srcCache.get(file)), {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [],
      parserOpts: { sourceType: "module", allowReturnOutsideFunction: true },
    });
  } catch (e) {
    findings.push({ rel, name: "(parse error)", line: 0, detail: e.message });
    continue;
  }
  checked++;

  traverse(ast, {
    Program(p) {
      for (const name of Object.keys(p.scope.globals)) {
        if (HOST_GLOBALS.has(name) || WINDOW_GLOBALS.has(name)) { continue; }
        const node = p.scope.globals[name];
        findings.push({ rel, name, line: node.loc ? node.loc.start.line : 0 });
      }
    },
  });
}

// Group by identifier so one missing constant used twice reads as one problem.
const byName = new Map();
for (const f of findings) {
  if (!byName.has(f.name)) { byName.set(f.name, []); }
  byName.get(f.name).push(f);
}

console.log(`\n  checked ${checked} files`);
if (byName.size === 0) {
  console.log("\n  no unresolved identifiers\n");
  process.exit(0);
}

console.log(`\n  ${byName.size} unresolved identifier(s):\n`);
for (const [name, uses] of [...byName].sort()) {
  console.log(`  ${name}`);
  for (const u of uses.slice(0, 6)) {
    console.log(`      src/${u.rel}:${u.line}${u.detail ? "  " + u.detail : ""}`);
  }
  if (uses.length > 6) { console.log(`      ... and ${uses.length - 6} more`); }
}
console.log();
process.exit(1);
