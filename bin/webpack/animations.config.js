// The animations bundle, built separately because dist/meleelight.html loads
// it as its own script. webpack 5 form of the original webpack 1 config.
//
// No babel rule here on purpose: src/animations.js and the per-character
// animation files it pulls in are generated data with no Flow annotations, and
// the old setup explicitly excluded them from babel as well
// (package.json "babel": { "ignore": ["src/characters/**/*animations.js"] }).
const path = require("path");

const srcPath = path.join(process.cwd(), "src");
const distJsPath = path.join(process.cwd(), "dist", "js");

module.exports = {
  mode: "development",
  devtool: false,
  entry: path.join(srcPath, "animations.js"),
  output: {
    path: distJsPath,
    filename: "animations.js",
  },
  resolve: {
    extensions: [".js"],
    modules: [srcPath, "node_modules"],
  },
  performance: { hints: false },
};
