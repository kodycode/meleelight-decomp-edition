// Libs
import "howler";
import $ from  "jquery";
window.$ = $;

// Legacy files
import 'characters/fox';
import 'characters/fox/moves';
import 'characters/fox/moves/UPTILT.js';
import 'characters/fox/attributes.js';
import 'characters/fox/ecb.js';
import 'characters/fox/hurtbox.js';
import 'characters/fox/rootMotion.js';
import 'characters/fox/index.js';
import 'characters/falco';
import 'characters/falco/moves';
import 'characters/falco/attributes.js';
import 'characters/falco/ecb.js';
import 'characters/falco/hurtbox.js';
import 'characters/falco/rootMotion.js';
import 'characters/falco/index.js';
import 'characters/falcon';
import 'characters/falcon/moves';
import 'characters/falcon/attributes.js';
import 'characters/falcon/ecb.js';
import 'characters/falcon/hurtbox.js';
import 'characters/falcon/rootMotion.js';
import 'characters/falcon/index.js';
import 'characters/marth';
import 'characters/marth/moves';
import 'characters/marth/dancingBladeAirMobility.js';
import 'characters/marth/dancingBladeCombo.js';
import 'characters/marth/ecbmarth.js';
import 'characters/marth/hurtbox.js';
import 'characters/marth/rootMotion.js';
import 'characters/marth/index.js';
import 'characters/marth/marthAttributes.js';
import 'characters/puff';
import 'characters/puff/moves';
import 'characters/puff/ecbpuff.js';
import 'characters/puff/hurtbox.js';
import 'characters/puff/rootMotion.js';
import 'characters/puff/index.js';
import 'characters/puff/puffAttributes.js';
import 'characters/puff/puffMultiJumpDrift.js';
import 'characters/puff/puffNextJump.js';
import 'characters/shared/moves';
import 'main/util/Box2D.js';
import 'main/util/createHitBox.js';
import 'main/util/createHitboxObject.js';
import 'main/util/deepCopyObject.js';
import 'main/util/Segment2D.js';
import 'main/util/Vec2D.js';
import 'main/vfx/dVfx';
import 'main/vfx/vfxData';
import 'main/vfx/blendColours.js';
import 'main/vfx/drawArrayPath.js';
import 'main/vfx/drawArrayPathNew.js';
import 'main/vfx/drawHexagon.js';
import 'main/vfx/drawVfx.js';
import 'main/vfx/makeColour.js';
import 'main/vfx/renderVfx.js';
import 'main/vfx/singGen.js';
import 'main/vfx/transparency.js';
import 'main/vfx/vfxQueue.js';
import 'main/ai.js';
import 'main/characters.js';
import 'input/input.js';
import 'main/linAlg.js';
import 'main/loadscreen.js';
import 'main/main.js';
import 'main/player.js';
import 'main/render.js';
import 'main/resize.js';
import 'main/sfx.js';
import 'main/swordSwings.js';
import 'main/vfx.js';
import 'menus/audiomenu.js';
import 'menus/credits.js';
import 'menus/css.js';
import 'menus/gameplaymenu.js';
import 'menus/keyboardmenu.js';
import 'menus/keytest.js';
import 'menus/menu.js';
import 'menus/stageselect.js';
import 'menus/startscreen.js';
import 'menus/startup.js';
import 'physics/actionStateShortcuts.js';
import 'physics/article.js';
import 'physics/hitDetection.js';
import 'physics/physics.js';
import 'stages/targetstages/tstages.js';
import 'stages/vs-stages/vs-stages.js';
import 'stages/activeStage.js';
import 'stages/stagerender.js';
import 'stages/targetselect.js';
import 'target/targetbuilder.js';
import 'target/targetplay.js';
// Debug handle for headless inspection (tools/cdp.mjs drives the page over the
// Chrome DevTools Protocol and needs a way to reach the module namespaces --
// the bundle otherwise exposes only `start` and `animations`). This binds
// existing live namespace objects; it defines no new state and changes no
// behaviour.
import * as __mlMain from 'main/main';
import * as __mlActiveStage from 'stages/activeStage';
import * as __mlPhysics from 'physics/physics';
import * as __mlCharacters from 'main/characters';
import * as __mlStates from 'physics/actionStateShortcuts';
import * as __mlHurtbox from 'physics/hurtboxCollision';
import * as __mlUcf from 'physics/ucf';
import * as __mlHurtboxData from 'main/hurtboxData';
window.__ml = {
  main: __mlMain,
  activeStage: __mlActiveStage,
  physics: __mlPhysics,
  characters: __mlCharacters,
  states: __mlStates,
  hurtboxCollision: __mlHurtbox,
  ucf: __mlUcf,
  hurtboxData: __mlHurtboxData,
};
