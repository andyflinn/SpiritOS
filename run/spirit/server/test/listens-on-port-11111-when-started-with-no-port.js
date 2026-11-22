'use strict';
// goal/G50.1, the box: "create a trivial web server in repo://run/spirit/", "default port 11111". Started with no argument,
// repo://run/spirit/server/script.js answers on 127.0.0.1:11111. Exit 0 green, 1 red.
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const server = spawn(process.execPath, [path.join(__dirname, '..', 'script.js')], { stdio: 'ignore' });
let tries = 0;
function ask() {
  http.get('http://127.0.0.1:11111/', function (res) { res.resume(); end(res.statusCode > 0); }).on('error', function () {
    if (++tries < 40) setTimeout(ask, 100); else end(false);
  });
}
function end(ok) { try { server.kill(); } catch (e) { /* gone */ } process.exit(ok ? 0 : 1); }
server.on('error', function () { end(false); });
setTimeout(ask, 200);
