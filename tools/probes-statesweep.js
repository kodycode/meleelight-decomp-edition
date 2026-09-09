// Force the fighter into every action state in turn and run it for a while,
// reporting any that throw, produce a non-finite value, or leave the player at
// an impossible position. This is the automated version of "knock them down,
// watch them roll, watch them vanish".
const M = window.__ml.main;
const S = window.__ml.states;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2; // fox
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}

const states = S.actionStates[M.characterSelections[0]];
const names = Object.keys(states).filter((n) => typeof states[n] === "object"
  && states[n] && typeof states[n].init === "function");

const SCALARS = ["grVel", "grKBVel", "groundAccel1", "groundAccel2",
                 "groundAngle", "rollOutDistance", "shieldHP"];
const VECS = ["pos", "posPrev", "cVel", "kVel", "groundNormal"];

function bad(ph) {
  const b = [];
  for (const k of SCALARS) {
    if (typeof ph[k] === "number" && !Number.isFinite(ph[k])) b.push(k + "=" + ph[k]);
  }
  for (const k of VECS) {
    const v = ph[k];
    if (v && typeof v.x === "number" && (!Number.isFinite(v.x) || !Number.isFinite(v.y))) {
      b.push(k + "=(" + v.x + "," + v.y + ")");
    }
  }
  return b;
}

const nullFrame = { lsX: 0, lsY: 0, csX: 0, csY: 0, x: false, y: false,
                    a: false, b: false, z: false, l: false, r: false,
                    lA: 0, rA: 0, s: false, du: false, dd: false,
                    dl: false, dr: false };
const input = [[nullFrame, nullFrame, nullFrame, nullFrame, nullFrame,
                nullFrame, nullFrame, nullFrame]];

const findings = [];

for (const name of names) {
  const p = M.player[0];
  // Reset to a clean grounded state on the main floor each time.
  p.phys.pos.x = 0; p.phys.pos.y = 0;
  p.phys.posPrev.x = 0; p.phys.posPrev.y = 0;
  p.phys.cVel.x = 0; p.phys.cVel.y = 0;
  p.phys.kVel.x = 0; p.phys.kVel.y = 0;
  p.phys.grVel = 0; p.phys.grKBVel = 0;
  p.phys.grounded = true;
  p.phys.onLedge = -1;
  p.percent = 0;
  try { states.WAIT.init(0, input); } catch (e) { /* ignore */ }
  await sleep(20);

  let initErr = null;
  try {
    states[name].init(0, input);
  } catch (e) {
    initErr = String(e && e.message || e);
  }

  // Let it run.
  let worst = null;
  for (let f = 0; f < 40 && !worst; f++) {
    await sleep(10);
    const b = bad(p.phys);
    if (b.length) worst = b;
  }

  if (initErr || worst) {
    findings.push({
      state: name,
      initError: initErr,
      nonFinite: worst,
      landedIn: p.actionState,
    });
  }
}

return { tested: names.length, findingCount: findings.length, findings };
