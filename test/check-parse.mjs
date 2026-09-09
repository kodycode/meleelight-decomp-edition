// Strip Flow from every source file and check that the result parses.
// Gives complete coverage information rather than chasing failures one at a time.
import { stripFlow } from "./flow-strip.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "src");
const OUT = process.argv[2] || path.join(HERE, ".parse-tmp");
fs.mkdirSync(OUT, { recursive: true });

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, acc); }
    else if (e.name.endsWith(".js")) { acc.push(p); }
  }
  return acc;
}

const files = walk(ROOT);
const bad = [];
let n = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (rel.includes("animations")) { continue; }   // huge generated data
  n++;
  const tmp = path.join(OUT, "one.mjs");
  fs.writeFileSync(tmp, stripFlow(fs.readFileSync(f, "utf8")));
  try {
    execFileSync("node", ["--check", tmp], { stdio: "pipe" });
  } catch (e) {
    const err = (e.stderr ? e.stderr.toString() : "");
    const line = err.split("\n").find((l) => l.includes("Error:")) || "?";
    bad.push([rel, line.trim()]);
  }
}

console.log(`checked ${n} files, ${bad.length} fail to parse after stripping\n`);
for (const [f, m] of bad) { console.log(`  ${f}\n      ${m}`); }
