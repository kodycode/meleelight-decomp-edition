// @flow

// NETPLAY IS DISABLED. This module keeps the export surface and does nothing.
//
// The real implementation is preserved verbatim in streamclient__disabled.js,
// which nothing imports -- the same convention mproom__disabled.js already
// uses here. It is parked rather than deleted so it can be revived if a relay
// ever comes back.
//
// WHY IT IS OFF, in order of how hard it is to undo:
//
//   1. BOTH PUBLIC RELAYS ARE GONE. wss://deepml.herokuapp.com and
//      wss://deepmleur.herokuapp.com both answer HTTP 404 "No such app" from
//      heroku-router. That is not a sleeping dyno -- a dormant free app
//      returns 503 "Application error" -- it means the app NAME IS
//      UNREGISTERED. Which in turn means anyone may claim `deepml` on Heroku
//      and start receiving every client that picks the US server. The stored
//      default was 'america', so a fresh install pointed there on its own.
//      Shipping a dangling reference to a name a stranger can take over is the
//      single best reason this is off rather than merely broken.
//
//   2. LAN MODE CANNOT WORK EITHER. It pointed a client at <ip>:6020, which
//      needs the `deepstream.io` SERVER listening there. That package was a
//      devDependency and was dropped in the webpack 5 migration because its
//      `uws` dependency was unpublished from npm and its repository made
//      private, so `npm install` fails on it (bin/webpack/createConfig.js:4).
//      Only `deepstream.io-client-js` is installed. There is no server to run
//      and no supported way to reinstall one.
//
//   3. THE SYNC ITSELF IS UNTESTED against this fork's physics. The frame loop
//      is now rAF-driven, which stops ticking entirely in a backgrounded tab,
//      and a great deal of state has changed underneath the serialiser.
//
// Everything below is inert on purpose. The names are exported because
// main.js, css.js, menu.js, stageselect.js, gameplaymenu.js and input.js all
// import from here, and test/check-stubs.mjs holds this module to its exports.

// Never true now; css.js:1183 and gameplaymenu.js:28 branch on these.
export const HOST_GAME_ID = null;
export const inServerMode = false;
export const meHost = false;

// main.js:823 tests `giveInputs[i] === true` before sending; an empty object
// keeps that false for every slot, so the send path is never entered.
export const giveInputs/*: any */ = {};

export function logIntoServer()/*: void */ {}
export function connectToMPServer()/*: void */ {}

export function setNetInputFlag(_name/*: any */, _val/*: any */)/*: void */ {}

export function updateNetworkInputs(_inputBuffer/*: any */,
                                    _playerSlot/*: number */)/*: void */ {}
export function saveNetworkInputs(_playerSlot/*: number */,
                                  _inputData/*: any */)/*: void */ {}

// input.js:141 returns this straight out of pollNetworkInputs. Undefined is
// what the buffer held before any packet arrived, so callers see exactly what
// they would have seen with a server that never answered.
export function retrieveNetworkInputs(_playerSlot/*: number */)/*: any */ {
  return undefined;
}

// Outbound state sync -- every one of these only ever emitted to the relay.
export function syncCharacter(_index/*: number */, _charSelection/*: any */)/*: void */ {}
export function syncGameMode(_gameMode/*: number */)/*: void */ {}
export function syncStartGame(_stageSelected/*: any */)/*: void */ {}
export function syncTagText(_playerSlot/*: number */, _tagText/*: any */)/*: void */ {}
export function syncMatchTimer(_timer/*: any */)/*: void */ {}
