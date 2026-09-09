// Grab a ledge, get up, and trace every frame afterwards.
//
// The reported glitch is being pulled back down to the ledge after getting up.
// CLIFFGETUPSLOW snaps position from its `offset` table for 53 frames, sets
// grounded at frame 54, and hands off to WAIT at frame 60 -- leaving the
// fighter only about 0.4 units inside the ledge. If anything drops them
// airborne there, dealWithLedges will re-grab, because onLedge is back to -1
// and ledgeRegrabCount is cleared on the way out.
const M = window.__ml.main;
const S = window.__ml.states;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;   // fox
M.setStageSelect(0);            // battlefield: ledges at +-68.4, y 0
M.startGame();
for (let i = 0; i < 150; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];
const AS = window.__ml.activeStage.activeStage;
const frame = () => new Promise(r => requestAnimationFrame(r));

const nullFrame = { lsX: 0, lsY: 0, csX: 0, csY: 0, x: false, y: false,
                    a: false, b: false, z: false, r: false, l: 0, s: false,
                    du: false, dd: false, dl: false, dr: false, lA: 0, rA: 0 };
const input = [[nullFrame, nullFrame, nullFrame, nullFrame]];

// Ledge 1 is the right end of the main floor.
const l = AS.ledge[1];
const lx = AS[l[0]][l[1]][l[2]].x, ly = AS[l[0]][l[1]][l[2]].y;

p.phys.onLedge = 1;
p.phys.face = -1;               // facing in from the right ledge
p.phys.grounded = false;
p.phys.cVel.x = 0; p.phys.cVel.y = 0; p.phys.grVel = 0;
try { S.actionStates[2].CLIFFCATCH.init(0, input); } catch (e) {}
for (let i = 0; i < 10; i++) await frame();
const hanging = { st: p.actionState, x: Math.round(p.phys.pos.x * 100) / 100,
                  y: Math.round(p.phys.pos.y * 100) / 100 };

try { S.actionStates[2].CLIFFGETUPSLOW.init(0, input); } catch (e) {}

const trace = [];
let last = null;
for (let i = 0; i < 110; i++) {
  const e = { st: p.actionState, t: Math.round(p.timer),
              x: Math.round(p.phys.pos.x * 100) / 100,
              y: Math.round(p.phys.pos.y * 100) / 100,
              g: p.phys.grounded,
              ledge: p.phys.onLedge,
              regrab: !!p.phys.ledgeRegrabCount,
              cvy: Math.round(p.phys.cVel.y * 100) / 100 };
  const k = JSON.stringify(e);
  if (k !== last) { trace.push(e); last = k; }
  await frame();
}

return { ledge: [lx, ly], hanging,
         regrabbed: trace.some(e => e.st === "CLIFFCATCH" && trace.indexOf(e) > 2),
         trace: trace.slice(0, 34) };
