// A real dash dance: alternate direction rapidly and record every pivot.
//
// The thing under test is ftCo_Dash_IASA's first branch,
//     if ((fp->mv.co.dash.x4 != 0) && (fp->cur_anim_frame <= x44))
// which skips ftCo_Dash_CheckInput -- so no smash turn -- but ONLY for a dash
// entered from Dash_CheckInput (x4 = 1). A dash entered out of a turn
// (ftCo_Turn_IASA -> ftCo_Dash_Enter(gobj, 0)) has x4 = 0 and can pivot again
// on its very first frame. x44 is 4.0 on the disc.
const sleep0 = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 600; i++) { if (window.__ml && window.__ml.main) break; await sleep0(100); }
const M = window.__ml.main;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RIGHT = 68, LEFT = 65;

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;   // fox
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];

// Down to the main floor.
M.keys[RIGHT] = true;
for (let i = 0; i < 300; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
M.keys[RIGHT] = false;
for (let i = 0; i < 40; i++) await sleep(8);

// Alternate every ~5 frames, which is what dash dancing actually is.
const pivots = [];
const seen = [];
let lastState = null;
let dir = RIGHT;
for (let round = 0; round < 10; round++) {
  M.keys[RIGHT] = false; M.keys[LEFT] = false;
  M.keys[dir] = true;
  for (let i = 0; i < 6; i++) {
    const st = p.actionState;
    if (st !== lastState) {
      seen.push({ st, t: Math.round(p.timer), face: p.phys.face,
                  entry: p.phys.dashCheckInputEntry,
                  grVel: Math.round(p.phys.grVel * 100) / 100,
                  x: Math.round(p.phys.pos.x * 10) / 10 });
      if (st === "SMASHTURN") pivots.push(seen[seen.length - 1]);
      lastState = st;
    }
    await sleep(16);
  }
  dir = (dir === RIGHT) ? LEFT : RIGHT;
}
M.keys[RIGHT] = false; M.keys[LEFT] = false;

const xs = seen.map(e => e.x);
return {
  pivotCount: pivots.length,
  xRange: xs.length ? [Math.min(...xs), Math.max(...xs)] : null,
  peakSpeedAtPivot: pivots.length
    ? Math.max(...pivots.map(e => Math.abs(e.grVel))) : null,
  states: seen.slice(0, 34),
};
