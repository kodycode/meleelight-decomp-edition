// applyMusicVolume() must be the ONLY thing that writes music volume.
//
// The music mute keeps a separate flag from masterVolume[1] so that unmuting
// restores the level the player chose. That only holds if every path goes
// through applyMusicVolume(): any direct `changeVolume(MusicManager, ...)`
// elsewhere sets a level of its own and silently unmutes.
//
// This is not hypothetical. endGame() restored full volume directly, so
// finishing a match and returning to character select turned the music back
// on while the button still read OFF; the pause duck did the same on unpause.
//
//   node test/check-music-volume.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "src");

// The one file allowed to write it: applyMusicVolume lives here.
const OWNER = "menus/audiomenu.js";
// sfx.js sets the startup default as the module loads, before any preference
// has been read; getAudioCookies() applies the mute immediately afterwards.
const ALLOWED = new Set([OWNER, "main/sfx.js"]);

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p, acc); }
    else if (e.name.endsWith(".js")) { acc.push(p); }
  }
  return acc;
}

const offenders = [];
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  if (rel.includes("animations")) { continue; }
  const txt = fs.readFileSync(file, "utf8");
  const re = /changeVolume\s*\(\s*MusicManager/g;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (ALLOWED.has(rel)) { continue; }
    offenders.push({ rel, line: txt.slice(0, m.index).split("\n").length });
  }
}

if (offenders.length === 0) {
  console.log("\n  music volume is written only through applyMusicVolume()\n");
  process.exit(0);
}

console.log(`\n  ${offenders.length} direct music-volume write(s) bypassing ` +
            `applyMusicVolume():\n`);
for (const o of offenders) {
  console.log(`  src/${o.rel}:${o.line}`);
}
console.log("\n  Use applyMusicVolume(scale) instead -- a direct write ignores " +
            "the mute.\n");
process.exit(1);
