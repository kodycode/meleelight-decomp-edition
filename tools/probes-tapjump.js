// Hold UP from standing and trace the tap-jump path frame by frame.
//
// Melee's rule is the same for the grounded jump and the aerial one:
//   lstick[0].y >= tap_jump_threshold && x671_timer_lstick_tilt_y < tap_jump_window
// (ftCo_Jump_GetInput, ftCo_Jump.c:33; ft_did_jump, ftCo_JumpAerial.c:46)
// with tap_jump_window = 4. The stick tilt timer resets to 0 on the frame the
// stick crosses the smash deadzone and counts up while it is held, so holding
// UP should satisfy it once and then stop -- the jumpsquat is meant to burn
// through the window before the fighter is airborne.
const M = window.__ml.main;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UP = 87;   // W

M.addPlayer(0, "keyboard");
M.characterSelections[0] = 2;   // fox, jumpSquat 3
M.setStageSelect(0);
M.startGame();
for (let i = 0; i < 150; i++) {
  if (M.player[0].actionState === "WAIT") break;
  await sleep(50);
}
const p = M.player[0];
const frame = () => new Promise(r => requestAnimationFrame(r));

// Settle on the ground, stick neutral.
for (let i = 0; i < 20; i++) await frame();

const trace = [];
M.keys[UP] = true;
for (let i = 0; i < 40; i++) {
  trace.push({
    f: i,
    st: p.actionState,
    t: Math.round(p.timer),
    tiltY: p.phys.stickTiltTimerY,
    jumps: p.phys.jumpsUsed,
    dj: !!p.phys.doubleJumped,
    g: p.phys.grounded,
    y: Math.round(p.phys.pos.y * 100) / 100,
    cvy: Math.round(p.phys.cVel.y * 100) / 100,
  });
  await frame();
}
M.keys[UP] = false;

return {
  jumpSquat: p.charAttributes.jumpSquat,
  finalJumpsUsed: p.phys.jumpsUsed,
  doubleJumped: !!p.phys.doubleJumped,
  trace,
};
