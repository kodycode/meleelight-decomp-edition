// Log the smash-turn gate terms every frame while flicking on dash frame 1 --
// the case that loses the pivot entirely.
//
// checkForSmashTurn (actionStateShortcuts.js:1101) needs all three of:
//     |lsX| >= DASH_SMASH_STICK_THRESHOLD (0.8)
//     stickTiltTimerX < DASH_SMASH_WINDOW (2)
//     lsX * face < 0
// and DASH.interrupt additionally gates it on
//     dashCheckInputEntry === 0 || timer > 4
// which is ftCo_Dash_IASA's first branch (x44 = 4.0 on the disc).
//
// If the 2-frame stick window expires while the 4-frame dash block is still
// up, the pivot can never fire -- that is the hypothesis being tested.
const M = window.__ml.main;
const S = window.__ml.states;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RIGHT = 68, LEFT = 65;

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];
const frame = () => new Promise(r => requestAnimationFrame(r));

M.keys[RIGHT] = true;
for (let i = 0; i < 400; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
M.keys[RIGHT] = false;
for (let i = 0; i < 30; i++) await frame();

// Hold right until the dash actually begins, then flick on its first frame.
M.keys[RIGHT] = true;
for (let i = 0; i < 30; i++) {
  await frame();
  if (p.actionState === "DASH") break;
}
const dashStart = p.actionState + "@" + Math.round(p.timer);

M.keys[RIGHT] = false;
M.keys[LEFT] = true;

const log = [];
for (let i = 0; i < 16; i++) {
  log.push({
    i,
    st: p.actionState,
    t: Math.round(p.timer),
    face: p.phys.face,
    tilt: p.phys.stickTiltTimerX,
    entry: p.phys.dashCheckInputEntry,
    blocked: !(p.phys.dashCheckInputEntry === 0 || p.timer > 4),
    windowOpen: p.phys.stickTiltTimerX < 2,
    grVel: Math.round(p.phys.grVel * 100) / 100,
  });
  await frame();
}
M.keys[LEFT] = false;

return { dashStart, log };
