// Semantic regression tests for test/flow-strip.mjs.
//
// check-parse.mjs proves the stripped tree PARSES. That is not the same as
// proving it still MEANS the same thing, and the difference is not academic:
// the original class-field rule was deleted precisely because it rewrote
//
//     cond ? a : false;      ->      a;
//
// which parses perfectly and is wrong. A stripper that corrupts code silently
// is worse than one that fails loudly, so the cases below pin down the
// positions where a colon is NOT a type annotation.
//
//   node test/check-strip.mjs
import { stripFlow } from "./flow-strip.mjs";

let passed = 0;
const failures = [];

// The stripper must leave these EXACTLY as they are -- every colon here means
// something other than a Flow annotation.
const UNCHANGED = [
  ["ternary at statement level", "const f = (c) => { return c ? a : false; };"],
  ["ternary with negative arm", "let x; x = cond ? 1 : -1;"],
  ["nested ternary", "const v = a ? b : c ? d : e;"],
  ["object literal", "const o = { a: 1, b: 2 };"],
  ["destructuring rename in params", "function g({a: b}) { return b; }"],
  ["switch case labels", "switch (v) { case 1: return 2; default: return 3; }"],
  ["labelled statement", "outer: for (;;) { break outer; }"],
  ["computed class key holding a ternary", 'class K { [c ? "a" : "b"] = 1; }'],
  ["less-than is not a generic list", "function h(a, b) { return a<b && c>(d); }"],
  ["arrow with object return", "const m = () => ({ k: 1 });"],
];

// (input, expected) pairs for annotations that MUST come out.
const REWRITES = [
  ["class field annotations",
   "class V { x : number; y : number; }",
   "class V { x ; y ; }"],
  ["class method params and return",
   "class V { dot( v : V ) : number { return 1; } }",
   "class V { dot( v )  { return 1; } }"],
  ["tuple type in a constructor param",
   "class B { constructor( min : [number,number] ) { this.min = min; } }",
   "class B { constructor( min ) { this.min = min; } }"],
  ["literal union return type with a negative arm",
   "function s ( x : string ) : 1 | -1 { return 1; }",
   "function s ( x )  { return 1; }"],
  ["generic bound containing a nested type argument",
   "function d<T : Array<*>>(a : T) : Array<*> { return a; }",
   "function d(a )  { return a; }"],
  ["arrow inside a generic return type",
   "function o<T>(x : T) : $ObjMap<T, <V>(_: V) => V> { return x; }",
   "function o(x )  { return x; }"],
];

function check (name, cond, detail) {
  if (cond) { passed++; }
  else { failures.push(detail ? `${name}\n      ${detail}` : name); }
}

for (const [name, src] of UNCHANGED) {
  const out = stripFlow(src);
  check(`leaves alone: ${name}`, out === src, `got: ${out}`);
}

// Compared with whitespace collapsed. Removing an annotation leaves incidental
// spaces behind ("( min  )"), and pinning those exactly makes the test brittle
// about something it is not trying to assert. The UNCHANGED cases above are
// still compared byte-for-byte, because there the point IS that nothing moved.
const squash = t => t.replace(/\s+/g, " ").trim();
for (const [name, src, want] of REWRITES) {
  const out = stripFlow(src);
  check(`strips: ${name}`, squash(out) === squash(want),
        `want: ${squash(want)}\n      got:  ${squash(out)}`);
}

// Whatever the stripper emits must at least be parseable.
for (const [, src] of [...UNCHANGED.map(x => [x[0], x[1]]), ...REWRITES]) {
  const out = stripFlow(src);
  let ok = true;
  try { new Function(out); } catch (e) { ok = /Unexpected end of input/.test(e.message); }
  check(`output parses: ${src.slice(0, 40)}`, ok);
}

console.log(`\n  ${passed} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) { console.log(`  FAIL  ${f}`); }
  console.log();
  process.exit(1);
}
console.log("  flow-strip preserves meaning\n");
