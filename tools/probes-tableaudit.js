// Every per-frame table indexed by `player.timer` must be at least as long as
// its action state's frame count. Correcting the frame counts from the disc
// made a number of states one frame longer, which overruns tables baked
// against the old counts.
//
// The consequences differ by table and are all bad:
//   setVelocities  -> undefined * face = NaN -> grVel/cVel/pos all NaN. The
//                     fighter vanishes, never dies (NaN fails every blastzone
//                     compare) and breaks the AI's nearest-enemy search.
//   posOffset      -> throws TypeError reading [0] of undefined.
//   animations     -> renderer draws nothing that frame (a visible blink).
const chars = window.__ml.characters;
const S = window.__ml.states;
const framesData = chars.framesData;
const ecb = chars.ecb;
const anims = window.animations;
const CHARN = ["MARTH", "PUFF", "FOX", "FALCO", "FALCON"];

const findings = [];
let compared = 0;

for (let c = 0; c < 5; c++) {
  const states = S.actionStates[c];
  const fd = framesData[c];
  if (!states || !fd) continue;

  for (const name of Object.keys(fd)) {
    const frames = fd[name];
    if (typeof frames !== "number") continue;
    const st = states[name];

    const check = (table, label, perFrame) => {
      if (!Array.isArray(table) || table.length === 0) return;
      if (perFrame && !Array.isArray(table[0]) && label === "posOffset") return;
      compared++;
      if (table.length < frames) {
        findings.push({ char: CHARN[c], state: name, table: label,
                        len: table.length, frames, missing: frames - table.length });
      }
    };

    if (st) {
      check(st.setVelocities, "setVelocities", false);
      if (Array.isArray(st.posOffset) && Array.isArray(st.posOffset[0])) {
        check(st.posOffset, "posOffset", true);
      }
    }
    if (ecb[c]) check(ecb[c][name], "ecb", false);
    if (anims[c]) check(anims[c][name], "animations", false);
  }
}

const byTable = {};
for (const f of findings) {
  byTable[f.table] = (byTable[f.table] || 0) + 1;
}
findings.sort((a, b) => a.table.localeCompare(b.table)
  || b.missing - a.missing || a.state.localeCompare(b.state));

return { compared, total: findings.length, byTable,
         findings: findings.filter((f) => f.table !== "animations") };
