// Check that the drawn facing never turns twice during a run turn.
//
// RUNTURN flips facing only once the break point has passed AND the run
// velocity has decayed (RUNTURN.js:51). render.js used to mirror the model on
// the frame alone, so at speed the two disagreed and the character was drawn
// new -> old -> new. `drawn` here is exactly what render.js computes.
const M = window.__ml.main;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RIGHT = 68, LEFT = 65;

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;    // fox
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];

M.keys[RIGHT] = true;
for (let i = 0; i < 300; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
// Build up a real run before turning, so the velocity condition matters.
for (let i = 0; i < 60; i++) await sleep(8);
M.keys[RIGHT] = false;
M.keys[LEFT] = true;

const trace = [];
let last = null;
for (let i = 0; i < 120; i++) {
  const st = p.actionState;
  const frame = Math.max(1, Math.floor(p.timer));
  let drawn = p.phys.face;
  if (st === "RUNTURN" && p.phys.turnRunFlipped) drawn *= -1;
  if (st === "TILTTURN" && frame >= p.charAttributes.standingTurnFrames + 1) drawn *= -1;
  const e = { st, t: frame, face: p.phys.face, flipped: !!p.phys.turnRunFlipped,
              drawn, grVel: Math.round(p.phys.grVel * 100) / 100 };
  const k = JSON.stringify(e);
  if (k !== last) { trace.push(e); last = k; }
  await sleep(8);
}
M.keys[LEFT] = false;

// Count direction changes in the DRAWN facing -- a clean turn has exactly one.
const drawnSeq = [];
for (const e of trace) {
  if (!drawnSeq.length || drawnSeq[drawnSeq.length - 1] !== e.drawn) {
    drawnSeq.push(e.drawn);
  }
}
return { drawnChanges: drawnSeq.length - 1, drawnSeq,
         trace: trace.slice(0, 30) };
