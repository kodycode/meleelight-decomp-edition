// Every action state whose Melee counterpart uses ft_80084F3C for physics must
// ask reduceByTraction for the above-walk-speed friction doubling.
//
// ft_80084F3C (ft_084E.c:42) is:
//
//     f32 friction = co->ground_friction;
//     if (ABS(fp->gr_vel) > co->walk_max_vel) {
//         friction *= p_ftCommonData->friction_when_above_walk_speed;   // 2.0
//     }
//     ftCommon_ApplyFrictionGround(fp, friction);
//     ftCommon_ApplyGroundMovement(gobj);
//
// meleelight spells that second argument `applyDouble`. Passing false halves
// the friction for exactly the frames where a fighter is sliding fast, which is
// the only time it is observable -- so the error is invisible at rest and shows
// up as slides that carry too far: wavedashes, dash stops, shield slides out of
// a run, knockdown slides. WAIT, GUARD, GUARDON, GUARDOFF and DAMAGEN2 all had
// it wrong; every one of them is on the list below.
//
// The list is only the states meleelight implements AND whose Melee _Phys is
// literally ft_80084F3C(gobj). Character-specific states are excluded because
// their Phys callbacks are their own.
//
//   node test/check-ground-friction.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "..", "src", "characters", "shared", "moves");

// state file -> the Melee _Phys that proves it
const MUST_DOUBLE = {
  "WAIT.js": "ftCo_Wait_Phys (ftCo_Wait.c:69)",
  "GUARD.js": "ftCo_Guard_Phys (ftCo_Guard.c:550)",
  "GUARDON.js": "ftCo_GuardOn_Phys (ftCo_Guard.c:481)",
  "GUARDOFF.js": "ftCo_GuardOff_Phys (ftCo_Guard.c:620)",
  "DAMAGEN2.js": "ftCo_Damage_Phys grounded branch (ftCo_Damage.c:1086)",
  "KNEEBEND.js": "ftCo_KneeBend_Phys (ftCo_KneeBend.c:68)",
  "LANDING.js": "ftCo_Landing_Phys (ftCo_Landing.c:152)",
  "LANDINGFALLSPECIAL.js": "ftCo_Landing_Phys (ftCo_Landing.c:152)",
  "SQUAT.js": "ftCo_Squat_Phys",
  "SQUATWAIT.js": "ftCo_SquatWait_Phys",
  "SQUATRV.js": "ftCo_SquatRv_Phys",
  "TILTTURN.js": "ftCo_Turn_Phys",
  "ESCAPEN.js": "ftCo_EscapeN_Phys",
  "FURAFURA.js": "ftCo_Furafura_Phys",
  "DOWNWAIT.js": "ftCo_DownWait_Phys",
  "DOWNSTANDN.js": "ftCo_DownStand_Phys",
  "SHIELDBREAKSTAND.js": "ftCo_ShieldBreakStand_Phys",
};

let failures = 0;
let checked = 0;
for (const [file, cite] of Object.entries(MUST_DOUBLE)) {
  const abs = path.join(SHARED, file);
  if (!fs.existsSync(abs)) { continue; }   // state not implemented here
  const txt = fs.readFileSync(abs, "utf8");
  const calls = [...txt.matchAll(/reduceByTraction\s*\(\s*p\s*(?:,\s*([A-Za-z]+)\s*)?\)/g)];
  if (calls.length === 0) { continue; }    // state gets its friction elsewhere
  checked++;
  for (const c of calls) {
    if (c[1] !== "true") {
      console.log(`FAIL ${file}: reduceByTraction(p, ${c[1] === undefined ? "<omitted>" : c[1]}) `
        + `-- ${cite} is ft_80084F3C, which doubles friction above walk_max_vel`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} state(s) missing the above-walk-speed friction doubling.`);
  process.exit(1);
}
console.log(`  ${checked} ground states apply friction_when_above_walk_speed`);
