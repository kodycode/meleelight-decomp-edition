import vfxData from 'main/vfx/vfxData';
import dVfxData from 'main/vfx/dVfx';
const twoPi = Math.PI * 2;

// TWO SEPARATE TOGGLES.
//
// These were one flag, `showVfx`, gating two unrelated things: the stage's
// animated background (drawBackground) and the gameplay effects the vfx queue
// draws -- hits, dust, shine, swings. Turning off the busy background meant
// losing every hit effect with it.
//
// Stage background defaults OFF, gameplay effects default ON.
export let showStageVfx = false;
export let showEffectVfx = true;

export function isShowStageVfx() {
  return showStageVfx;
}
export function toggleShowStageVfx() {
  showStageVfx = !showStageVfx;
  return showStageVfx;
}

export function isShowEffectVfx() {
  return showEffectVfx;
}
export function toggleShowEffectVfx() {
  showEffectVfx = !showEffectVfx;
  return showEffectVfx;
}

// Hit and hurtbox display, Melee's developer view. A GLOBAL rather than the
// existing per-player `player[i].showHitbox`, because buildPlayerObject makes
// a fresh playerObject (showHitbox = false) on every match start -- a
// per-player flag would silently switch itself off between games. render.js
// honours either, so the old per-player debug shortcut still works.
export let showHitboxes = false;

export function isShowHitboxes() {
  return showHitboxes;
}
export function toggleShowHitboxes() {
  showHitboxes = !showHitboxes;
  return showHitboxes;
}


export const vfx = {
  ...vfxData
};

vfx.wallBounce.path = vfx.groundBounce.path;
vfx.wallBounce.colour = vfx.groundBounce.colour;
vfx.wallBounce.frames = vfx.groundBounce.frames;
vfx.ceilingBounce.path = vfx.groundBounce.path;
vfx.ceilingBounce.colour = vfx.groundBounce.colour;
vfx.ceilingBounce.frames = vfx.groundBounce.frames;


export const dVfx = {
  ...dVfxData
};





