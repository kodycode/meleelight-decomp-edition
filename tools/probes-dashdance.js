// Trace a dash-dance pivot frame by frame: action state, facing, and the
// along-ground velocity, so the momentum on the pivot can be read directly
// rather than inferred.
//
// Melee's chain is ftCo_Dash_CheckInput (ftCo_Dash.c:30) -> if the stick is
// opposite the facing, ftCo_Turn_Enter_Smash (ftCo_Turn.c:173), which flips
// facing on its first Anim call (frames_to_turn = 0) and does NOT touch
// velocity; ftCo_Turn_Phys is plain friction. Dashing back out runs
// ftCo_Dash_Enter (ftCo_Dash.c:49), whose impulse is the FULL
// dash_initial_velocity when gr_vel opposes the new facing, added through
// ground_accel_2.
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
// Get down to the main floor so the pivot is not on a platform edge.
M.keys[RIGHT] = true;
for (let i = 0; i < 300; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
M.keys[RIGHT] = false;
for (let i = 0; i < 40; i++) await sleep(8);

const trace = [];
let last = null;
function snap(tag) {
  const e = { tag, st: p.actionState, t: Math.round(p.timer),
              face: p.phys.face,
              grVel: Math.round(p.phys.grVel * 1000) / 1000,
              cvx: Math.round(p.phys.cVel.x * 1000) / 1000,
              x: Math.round(p.phys.pos.x * 100) / 100 };
  const k = JSON.stringify(e);
  if (k !== last) { trace.push(e); last = k; }
}

// Dash right, then flick left inside the dash-dance window.
M.keys[RIGHT] = true;
for (let i = 0; i < 14; i++) { snap("R"); await sleep(8); }
M.keys[RIGHT] = false;
M.keys[LEFT] = true;
for (let i = 0; i < 40; i++) { snap("L"); await sleep(8); }
M.keys[LEFT] = false;

return { charScale: p.charAttributes.charScale,
         standingTurnFrames: p.charAttributes.standingTurnFrames,
         dTInitV: p.charAttributes.dTInitV,
         traction: p.charAttributes.traction,
         trace: trace.slice(0, 40) };
