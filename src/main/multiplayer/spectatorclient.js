// @flow

// SPECTATING IS DISABLED, for the same reason netplay is -- see the header of
// streamclient.js. This module connected to wss://deepml.herokuapp.com, which
// answers HTTP 404 "No such app": the Heroku app name is unregistered and
// therefore claimable by anyone.
//
// The real implementation is preserved verbatim in
// spectatorclient__disabled.js, which nothing imports.
export function logIntoServerAsSpectator()/*: void */ {}
export function connectAsSpectator()/*: void */ {}
export function saveNetworkInputs(_playerSlot/*: number */,
                                  _inputBuffer/*: any */)/*: void */ {}
