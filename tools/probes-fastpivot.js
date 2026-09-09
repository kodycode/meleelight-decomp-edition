// Dash, then flick the other way after exactly N frames, for N = 1..8.
//
// Each trial is hard-reset and validated, because a first attempt at this let
// the previous trial's TILTTURN bleed into the next one and reported nonsense.
//
// What Melee should do (ftCo_Dash_IASA, ftCo_Dash.c:80):
//   branch 1: (mv.co.dash.x4 != 0) && (cur_anim_frame <= x44)  -- x44 is 4.0
//             skips ftCo_Dash_CheckInput entirely, so a FRESH dash cannot
//             smash turn for its first four frames.
//   the flick itself only counts for dash_smash_window = 2 frames after the
//   stick crosses horizontal_stick_smash_deadzone (fighter.c:1911).
// So a flick at dash frame 1-3 expires before the block lifts and is lost;
// from frame 4 on it should pivot.
const M = window.__ml.main;
const S = window.__ml.states;
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

// One resolved game frame: the game ticks inside its own rAF, and a callback
// registered after it runs later in the same frame.
const frame = () => new Promise(r => requestAnimationFrame(r));

const nullFrame = { lsX: 0, lsY: 0, csX: 0, csY: 0, x: false, y: false,
                    a: false, b: false, z: false, r: false, l: 0, s: false,
                    du: false, dd: false, dl: false, dr: false, lA: 0, rA: 0 };
const input = [[nullFrame, nullFrame, nullFrame, nullFrame]];

// Land on the main floor once.
M.keys[RIGHT] = true;
for (let i = 0; i < 400; i++) {
  if (p.phys.grounded && Math.abs(p.phys.pos.y) < 0.01) break;
  await sleep(8);
}
M.keys[RIGHT] = false;

async function reset() {
  M.keys[RIGHT] = false; M.keys[LEFT] = false;
  for (let i = 0; i < 10; i++) await frame();
  const dx = 0 - p.phys.pos.x, dy = 0 - p.phys.pos.y;
  for (const ecb of [p.phys.ECB1, p.phys.ECBp, p.phys.ECB2]) {
    if (!ecb) continue;
    for (const pt of ecb) { pt.x += dx; pt.y += dy; }
  }
  p.phys.pos.x = 0; p.phys.pos.y = 0;
  p.phys.posPrev.x = 0; p.phys.posPrev.y = 0;
  p.phys.cVel.x = 0; p.phys.cVel.y = 0;
  p.phys.kVel.x = 0; p.phys.kVel.y = 0;
  p.phys.grVel = 0; p.phys.grKBVel = 0;
  p.phys.face = 1;
  p.phys.grounded = true;
  p.phys.stickTiltTimerX = 254;
  try { S.actionStates[2].WAIT.init(0, input); } catch (e) {}
  for (let i = 0; i < 6; i++) await frame();
}

const results = [];
for (let n = 1; n <= 8; n++) {
  await reset();
  M.keys[RIGHT] = true;
  await frame();
  const startedIn = p.actionState + "@" + Math.round(p.timer);
  const dashEntry = p.phys.dashCheckInputEntry;
  for (let i = 1; i < n; i++) await frame();
  const flickAt = p.actionState + "@" + Math.round(p.timer);

  M.keys[RIGHT] = false;
  M.keys[LEFT] = true;
  const seq = [];
  let pivotFrame = null;
  for (let i = 0; i < 30; i++) {
    await frame();
    const s = p.actionState;
    if (!seq.length || seq[seq.length - 1].s !== s) {
      seq.push({ s, t: Math.round(p.timer),
                 v: Math.round(p.phys.grVel * 100) / 100 });
    }
    if (pivotFrame === null && s === "SMASHTURN") pivotFrame = i + 1;
  }
  M.keys[LEFT] = false;
  results.push({
    n, startedIn, dashEntry, flickAt,
    pivoted: pivotFrame !== null,
    pivotAfter: pivotFrame,
    path: seq.map(e => `${e.s}@${e.t}(${e.v})`).join(" -> "),
  });
}
M.keys[LEFT] = false;
return results;
