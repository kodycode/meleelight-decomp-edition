// Registers the physics-harness module resolver. Used only by the test run:
//   node --import ./test/register.mjs test/physics.test.mjs
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./loader.mjs", pathToFileURL("./test/"));
