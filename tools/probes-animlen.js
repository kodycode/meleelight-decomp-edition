// render.js clamps `frame` to framesData[char][state], then bails out of
// drawing entirely if animations[char][state][frame-1] is undefined. So any
// state whose baked animation array is SHORTER than its frame count renders
// one or more invisible frames -- the character blinks out.
//
// This lists every such state. Run with tools/cdp.mjs against a served build.
const chars = window.__ml.characters;
const framesData = chars.framesData;
const anims = window.animations;
const CHARN = ["MARTH", "PUFF", "FOX", "FALCO", "FALCON"];

const short = [];
const missingAnim = [];
let compared = 0;

for (let c = 0; c < 5; c++) {
  const fd = framesData[c];
  const an = anims[c];
  if (!fd || !an) continue;
  for (const state of Object.keys(fd)) {
    const frames = fd[state];
    if (typeof frames !== "number") continue;
    const a = an[state];
    if (a === undefined) { missingAnim.push({ char: CHARN[c], state, frames }); continue; }
    compared++;
    if (a.length < frames) {
      short.push({ char: CHARN[c], state, frames, animLen: a.length,
                   missing: frames - a.length });
    }
  }
}

short.sort((x, y) => y.missing - x.missing || x.state.localeCompare(y.state));
return {
  compared,
  shortCount: short.length,
  short,
  missingAnimCount: missingAnim.length,
  missingAnim: missingAnim.slice(0, 40),
};
