// webpack 5 build for meleelight.
//
// This replaces a webpack 1 / babel 6 setup that could no longer be installed:
// `deepstream.io` (the netplay SERVER, only ever a devDependency) depends on
// `uws`, which was unpublished from npm and had its repository made private,
// so `npm install` would prompt for git credentials and then fail. Nothing in
// src/ imports the server -- only `deepstream.io-client-js` -- so dropping it
// costs nothing.
//
// The OUTPUT is deliberately unchanged: the same two entry points, the same
// bundle names, in the same dist/js directory, which is what
// dist/meleelight.html loads.
//
// What was dropped and why:
//   happypack                  a webpack 1 threading shim; webpack 5 has its
//                              own caching and does not need it
//   eslint-loader              linting during the build; it is not needed to
//                              run the game and its webpack 1 API is gone
//   sw-precache-webpack-plugin deprecated, and a service worker caching the
//                              bundle is an active nuisance while iterating
//   webpack-notifier           desktop growl notifications
//   electron / electron-*      desktop packaging, a separate concern from
//                              running the game
//
// BABEL DOES ONE THING HERE: strip Flow types. The old setup also ran
// `es2015`, transpiling classes, generators and template literals down to ES5.
// Nothing that ships today needs that, and every transform is a chance to
// change semantics -- the physics is full of code where evaluation order and
// float rounding matter. Stripping types and shipping the source as written is
// both faster and less risky.
function createConfig(options) {
  const path = require("path");

  const { isMinified } = options;

  const srcDir = path.join(process.cwd(), "src");
  const distJsDir = path.join(process.cwd(), "dist", "js");
  const min = isMinified ? ".min" : "";

  return {
    mode: isMinified ? "production" : "development",
    // "eval" keeps the dev build fast; the old config used it too.
    devtool: isMinified ? false : "eval",
    entry: {
      index: path.join(srcDir, "index.js"),
      main: path.join(srcDir, "main.js"),
    },
    output: {
      path: distJsDir,
      filename: `[name]${min}.js`,
    },
    resolve: {
      extensions: [".js"],
      // webpack 1's `resolve.root`. This is what lets src/ files import
      // "physics/f32" and "main/characters" as bare specifiers; without it
      // every one of those fails to resolve.
      modules: [srcDir, "node_modules"],
      // webpack 1 silently polyfilled Node core modules for the browser;
      // webpack 5 removed that and errors instead. `deepstream.io-client-js`
      // requires `url`, so it is supplied explicitly. This is the SAME
      // polyfill webpack 1 injected, so the netplay client behaves as before.
      fallback: {
        url: require.resolve("url/"),
      },
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [require.resolve("@babel/preset-flow")],
              // The animation files are enormous generated data; parsing them
              // through babel is pure cost. The old config skipped them too
              // (package.json "babel": { "ignore": [...] }).
              compact: false,
            },
          },
        },
      ],
    },
    optimization: {
      minimize: isMinified,
    },
    performance: {
      // The bundles are large because the character data is baked in. That is
      // intentional; the warning is noise.
      hints: false,
    },
  };
}

module.exports = createConfig;
