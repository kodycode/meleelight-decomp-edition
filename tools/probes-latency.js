// Measure meleelight's own contribution to input latency.
//
// The game logic and the drawing are on SEPARATE clocks:
//   main.js:1143  setTimeout(gameTick, 16, input)   -- free-running 16ms timer
//   main.js:1154  requestAnimationFrame(renderTick) -- display refresh, ~16.67ms
// so they drift against each other continuously. This records when each one
// actually fires and how long a finished logic frame waits to be drawn.
//
// gameTick has no counter of its own, so airborneTimer is used as the tick
// clock: physics increments it once per gameTick while the fighter is in the
// air (physics.js, `if (!grounded) airborneTimer++`).
const M = window.__ml.main;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 120; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];

// Keep the fighter airborne so airborneTimer keeps counting: park them high up
// and re-lift every so often.
function lift() {
  p.phys.pos.y = 120;
  p.phys.cVel.y = 0;
  p.phys.grounded = false;
}
lift();

const rafTimes = [];
let rafOn = true;
function onRaf(t) {
  rafTimes.push(t);
  if (rafOn) requestAnimationFrame(onRaf);
}
requestAnimationFrame(onRaf);

// Poll fast and note the wall time each gameTick lands.
const tickTimes = [];
let lastTimer = p.phys.airborneTimer;
const t0 = performance.now();
while (performance.now() - t0 < 4000) {
  const v = p.phys.airborneTimer;
  if (v !== lastTimer) {
    tickTimes.push(performance.now());
    lastTimer = v;
  }
  if (p.phys.pos.y < 40) lift();
  await new Promise(r => setTimeout(r, 0));
}
rafOn = false;

function stats(times) {
  const d = [];
  for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
  d.sort((a, b) => a - b);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length);
  return {
    n: d.length,
    mean: +mean.toFixed(2),
    sd: +sd.toFixed(2),
    min: +d[0].toFixed(2),
    p50: +d[Math.floor(d.length * 0.5)].toFixed(2),
    p95: +d[Math.floor(d.length * 0.95)].toFixed(2),
    max: +d[d.length - 1].toFixed(2),
  };
}

// How long each logic frame waits before the next frame is presented.
const waits = [];
for (const t of tickTimes) {
  const nxt = rafTimes.find(r => r >= t);
  if (nxt !== undefined) waits.push(nxt - t);
}
waits.sort((a, b) => a - b);
const wmean = waits.reduce((a, b) => a + b, 0) / (waits.length || 1);

return {
  gameTick: stats(tickTimes),
  raf: stats(rafTimes),
  logicToPresentMs: {
    n: waits.length,
    mean: +wmean.toFixed(2),
    min: +(waits[0] || 0).toFixed(2),
    p50: +(waits[Math.floor(waits.length * 0.5)] || 0).toFixed(2),
    p95: +(waits[Math.floor(waits.length * 0.95)] || 0).toFixed(2),
    max: +(waits[waits.length - 1] || 0).toFixed(2),
  },
};
