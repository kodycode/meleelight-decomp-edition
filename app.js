var express = require('express');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;
app.use(express.static('./dist'));

// dist/meleelight.html pulls the gamepad SVG helper with
// <script src="../src/input/gamepad/includeGamepadSVG.js">, which works when
// the page is opened straight off disk but not over HTTP, where only ./dist
// is mounted: the request fell through to the SPA-ish 404 page, the browser
// refused it for a bad MIME type, and every includeGamepadSVG(...) call in the
// page threw ReferenceError, leaving the controller diagrams blank.
// Mounting ./src at /src is what that relative path already expects.
app.use('/src', express.static('./src'));

app.get('/', function(req, res) {
  res.redirect('/meleelight.html');
});

app.set('port', (process.env.PORT || 5000));

var server = app.listen((process.env.PORT || 5000));

var options = {
  debug: true
};

//var server = require('http').createServer(app);

app.use('/peerjs', ExpressPeerServer(server, options));

// REMOVED: `server.listen(9000)`.
//
// `app.listen(...)` above already returns a LISTENING server, so calling
// listen on it a second time is invalid. Old Node tolerated it silently;
// modern Node throws ERR_SERVER_ALREADY_LISTEN and the process dies before
// serving anything. Nothing is lost by dropping it: the peer server is
// mounted on `server` at /peerjs, so it is reachable on the same port the
// game is served from.


var connected = [];
server.on('connection', function (id) {
  var idx = connected.indexOf(id); // only add id if it's not in the list yet
  if (idx === -1) {console.log("peer connected"+ id);connected.push(id);}
});
server.on('disconnect', function (id) {
  var idx = connected.indexOf(id); // only attempt to remove id if it's in the list
  if (idx !== -1) {console.log("peer disconnected" + id);connected.splice(idx, 1);}
});

app.get('/connected-people', function (req, res) {
  return res.json(connected);
});