'use strict';
// goal/G50.1; Andy: "the only URL that should work is: 127.0.0.1:11111/spirit/   or 127.0.0.1:11111/spirit/index.html",
// and "we won't start off polluting the gobal namespace (repo://run/)". /, /index.html, /spirit and /spirit/spirit/ answer
// nothing with 200; /spirit/ does, so the check judged a live server. Exit 0 green, 1 red.
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
const OTHERS = ['/', '/index.html', '/spirit', '/spirit/spirit/', '/spirit//index.html/'];
function judge(port) {
  get(port, '/spirit/', function (status) {
    if (status !== 200) return end(false);
    let left = OTHERS.length, ok = true;
    OTHERS.forEach(function (u) { get(port, u, function (s) { if (s === 200 || s === 0) ok = false; if (--left === 0) end(ok); }); });
  });
}
