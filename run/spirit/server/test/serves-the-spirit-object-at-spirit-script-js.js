'use strict';
// goal/G50.1; Andy: "shouldn't the script tag specify spirit/script.js, and no fudging of the namespace???". The web root is
// the folder that holds spirit/, so a GET of /spirit/script.js answers repo://run/spirit/script.js. Exit 0 green, 1 red.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const want = fs.readFileSync(path.join(__dirname, '..', '..', 'script.js'), 'utf8');
const server = spawn(process.execPath, [path.join(__dirname, '..', 'script.js')], { stdio: 'ignore' });
let tries = 0;
function ask() {
  http.get('http://127.0.0.1:11111/spirit/script.js', function (res) {
    let body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { end(res.statusCode === 200 && body === want); });
  }).on('error', function () { if (++tries < 40) setTimeout(ask, 100); else end(false); });
}
function end(ok) { try { server.kill(); } catch (e) { /* gone */ } process.exit(ok ? 0 : 1); }
server.on('error', function () { end(false); });
setTimeout(ask, 200);
