// The replay has the CPU sitting at exactly (57.6, 27.2) -- Battlefield's
// right platform ENDPOINT -- drifting a hair left and then going NaN.
// Reproduce that: land a fighter on the platform edge, force each knockdown /
// roll / getup state, and watch for a non-finite value.
const M = window.__ml.main;
const S = window.__ml.states;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 0;   // marth, as in the replay
M.setStageSelect(0);            // battlefield
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}

const p = M.player[0];

// Move the fighter wholesale: position, previous position and both ECB copies,
// so the collision routine does not drag it back to where the ECB still says
// it is.
function place(x, y, airborne) {
  const dx = x - p.phys.pos.x, dy = y - p.phys.pos.y;
  for (const ecb of [p.phys.ECB1, p.phys.ECBp, p.phys.ECB2]) {
    if (!ecb) continue;
    for (const pt of ecb) { pt.x += dx; pt.y += dy; }
  }
  p.phys.pos.x = x; p.phys.pos.y = y;
  p.phys.posPrev.x = x; p.phys.posPrev.y = y;
  p.phys.grounded = !airborne;
  p.phys.cVel.x = 0; p.phys.cVel.y = 0;
  p.phys.kVel.x = 0; p.phys.kVel.y = 0;
  p.phys.grVel = 0; p.phys.grKBVel = 0;
  p.phys.onLedge = -1;
}

const nullFrame = { lsX: 0, lsY: 0, csX: 0, csY: 0, x: false, y: false,
                    a: false, b: false, z: false, r: false, l: 0, s: false,
                    du: false, dd: false, dl: false, dr: false, lA: 0, rA: 0 };
const input = [[nullFrame, nullFrame, nullFrame, nullFrame]];

const STATES = ["ESCAPEF", "ESCAPEB", "ESCAPEN",
                "DOWNSTANDF", "DOWNSTANDB", "DOWNSTANDN",
                "DOWNBOUND", "DOWNWAIT", "DOWNDAMAGE",
                "TECHF", "TECHB", "TECHN",
                "WALK", "DASH", "SQUAT", "LANDING"];

// Right platform endpoint, and a hair inside it.
const SPOTS = [[57.6, 27.2], [57.588, 27.2], [57.0, 27.2], [20.0, 27.2]];

const findings = [];
const states = S.actionStates[0];

for (const [sx, sy] of SPOTS) {
  for (const name of STATES) {
    if (!states[name] || typeof states[name].init !== "function") continue;

    // Land cleanly on the platform first.
    place(sx, sy + 6, true);
    p.phys.cVel.y = -1;
    for (let i = 0; i < 12; i++) await sleep(9);
    place(sx, sy, false);
    await sleep(20);

    let err = null;
    try { states[name].init(0, input); } catch (e) { err = String(e.message || e); }

    let bad = null;
    for (let f = 0; f < 60 && !bad; f++) {
      await sleep(9);
      const ph = p.phys;
      if (!Number.isFinite(ph.pos.x) || !Number.isFinite(ph.pos.y)) {
        bad = { pos: [ph.pos.x, ph.pos.y], cVel: [ph.cVel.x, ph.cVel.y],
                grVel: ph.grVel,
                normal: ph.groundNormal ? [ph.groundNormal.x, ph.groundNormal.y] : null,
                onSurface: ph.onSurface, st: p.actionState };
      }
    }
    if (err || bad) findings.push({ spot: [sx, sy], state: name, err, bad });

    // Reset for the next trial.
    place(0, 6, true);
    try { states.FALL.init(0, input); } catch (e) {}
    for (let i = 0; i < 10; i++) await sleep(9);
  }
}

return { tested: SPOTS.length * STATES.length, findingCount: findings.length,
         findings: findings.slice(0, 25) };
