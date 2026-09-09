// Let a CPU beat on an idle player and watch every frame for a non-finite
// value appearing in the physics state. A NaN position renders nothing, is
// never inside the blastzone (so the player never dies), and makes
// NearestEnemy's distance compare false forever -- "cant find nearest enemy".
const M = window.__ml.main;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

M.addPlayer(0, "keyboard");
M.setPlayerType(1, 1);            // CPU
M.characterSelections[0] = 2;     // fox
M.characterSelections[1] = 4;     // falcon, hits hard
M.setStageSelect(0);
M.startGame();

for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}

const SCALARS = ["grVel", "grKBVel", "groundAccel1", "groundAccel2",
                 "shieldHP", "groundAngle", "rollOutDistance"];
const VECS = ["pos", "posPrev", "cVel", "kVel", "groundNormal"];

function badFields(ph) {
  const bad = [];
  for (const k of SCALARS) {
    if (typeof ph[k] === "number" && !Number.isFinite(ph[k])) bad.push(k + "=" + ph[k]);
  }
  for (const k of VECS) {
    const v = ph[k];
    if (v && typeof v.x === "number" && (!Number.isFinite(v.x) || !Number.isFinite(v.y))) {
      bad.push(k + "=(" + v.x + "," + v.y + ")");
    }
  }
  return bad;
}

// Rolling history so the state sequence leading to the NaN is visible.
const hist = [[], []];
let hit = null;

for (let t = 0; t < 4000 && !hit; t++) {
  for (let pi = 0; pi < 2; pi++) {
    const p = M.player[pi];
    if (!p || !p.phys) continue;
    const last = hist[pi][hist[pi].length - 1];
    const entry = { st: p.actionState, dmg: Math.round(p.percent || 0),
                    x: Math.round(p.phys.pos.x * 100) / 100,
                    y: Math.round(p.phys.pos.y * 100) / 100 };
    if (!last || last.st !== entry.st) {
      hist[pi].push(entry);
      if (hist[pi].length > 14) hist[pi].shift();
    }
    const bad = badFields(p.phys);
    if (bad.length) {
      hit = { player: pi, state: p.actionState, bad, history: hist[pi].slice() };
      break;
    }
  }
  await sleep(8);
}

return {
  found: !!hit,
  hit,
  p0: { st: M.player[0].actionState, dmg: Math.round(M.player[0].percent || 0) },
  p1: { st: M.player[1].actionState, dmg: Math.round(M.player[1].percent || 0) },
  hist0: hist[0], hist1: hist[1],
};
