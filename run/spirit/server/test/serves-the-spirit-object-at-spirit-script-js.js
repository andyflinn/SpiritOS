'use strict';
// goal/G50.1; Andy: "shouldn't the script tag specify spirit/script.js, and no fudging of the namespace???". The web root is
// the folder that holds spirit/, so a GET of /spirit/script.js answers repo://run/spirit/script.js. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
// A free port of its own, so a server already running on 11111 is never the one judged.
const probe = net.createServer().listen(0, '127.0.0.1', function () {
  const port = probe.address().port;
  probe.close(function () { start(port); });
});
let server = null;
function get(port, url, done) {
  http.get('http://127.0.0.1:' + port + url, function (res) {
    let body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { done(res.statusCode, body); });
  }).on('error', function () { done(0, ''); });
}
function ready(port, then) {
  let tries = 0;
  (function ask() {
    get(port, '/', function (status) { if (status > 0) then(); else if (++tries < 40) setTimeout(ask, 100); else end(false); });
  })();
}
function end(ok) { try { server.kill(); } catch (e) { /* gone */ } process.exit(ok ? 0 : 1); }
function start(port) {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'script.js'), '--port', String(port)], { stdio: 'ignore' });
  server.on('error', function () { end(false); });
  ready(port, function () { judge(port); });
}
function judge(port) {
  const want = fs.readFileSync(path.join(__dirname, '..', '..', 'script.js'), 'utf8');
  get(port, '/spirit/script.js', function (status, body) { end(status === 200 && body === want); });
}
