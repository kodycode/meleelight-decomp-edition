// Per-frame capture of a dash-dance pivot, with no sampling aliasing.
//
// gameTick now runs inside the game's own requestAnimationFrame callback, so a
// callback registered afterwards runs after the tick in the same frame and
// sees each logic frame exactly once.
//
// The decomp says the pivot should be:
//   ftCo_Dash_CheckInput (ftCo_Dash.c:30)  stick opposite facing -> Turn_Enter_Smash
//   ftCo_Turn_Enter_Smash (ftCo_Turn.c:173) frames_to_turn = 0, velocity untouched
//   ftCo_Turn_Anim_Inner  (ftCo_Turn.c:72)  flips facing on its first call
//   ftCo_Turn_Phys        (ftCo_Turn.c:150) = ft_80084F3C, friction (doubled
//                                             above walk speed)
//   ftCo_Turn_IASA        (ftCo_Turn.c:129) on the just_turned frame only,
//                                             ftCo_Dash_Enter(gobj, 0)
//   ftCo_Dash_Enter       (ftCo_Dash.c:49)  x0 = init_vel when gr_vel opposes
//                                             facing, else init_vel - gr_vel;
//                                             applied through ground_accel_2
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

// Get onto the main floor.
M.keys[RIGHT] = true;
for (let i = 0; i < 400; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
M.keys[RIGHT] = false;
for (let i = 0; i < 30; i++) await sleep(16);

const frames = [];
let running = true;
let n = 0;
function capture() {
  if (!running) return;
  requestAnimationFrame(capture);
  frames.push({
    f: n++,
    st: p.actionState,
    t: Math.round(p.timer),
    face: p.phys.face,
    grVel: Math.round(p.phys.grVel * 10000) / 10000,
    a1: Math.round((p.phys.groundAccel1 || 0) * 10000) / 10000,
    a2: Math.round((p.phys.groundAccel2 || 0) * 10000) / 10000,
    pend: Math.round((p.phys.dashImpulsePending || 0) * 10000) / 10000,
    entry: p.phys.dashCheckInputEntry,
    tilt: p.phys.stickTiltTimerX,
    x: Math.round(p.phys.pos.x * 100) / 100,
  });
}
requestAnimationFrame(capture);

// Dash right for a handful of frames, then flick left. One clean pivot.
M.keys[RIGHT] = true;
await sleep(16 * 8);
M.keys[RIGHT] = false;
M.keys[LEFT] = true;
await sleep(16 * 14);
M.keys[LEFT] = false;
await sleep(16 * 4);
running = false;

return {
  dTInitV: p.charAttributes.dTInitV,
  dAccA: p.charAttributes.dAccA,
  dAccB: p.charAttributes.dAccB,
  traction: p.charAttributes.traction,
  maxWalk: p.charAttributes.maxWalk,
  frames: frames.slice(0, 34),
};
