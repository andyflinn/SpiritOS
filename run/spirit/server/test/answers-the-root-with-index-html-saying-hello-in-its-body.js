'use strict';
// goal/G50.1, the box: "repo://run/spirit/index.html", "index.html prints hello in the <body>". A GET of / on the server
// answers 200 with that page: its <body> holds hello. Exit 0 green, 1 red.
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const server = spawn(process.execPath, [path.join(__dirname, '..', 'script.js')], { stdio: 'ignore' });
let tries = 0;
function ask() {
  http.get('http://127.0.0.1:11111/', function (res) {
    let body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { end(res.statusCode === 200 && /<body[^>]*>[\s\S]*hello[\s\S]*<\/body>/i.test(body)); });
  }).on('error', function () { if (++tries < 40) setTimeout(ask, 100); else end(false); });
}
function end(ok) { try { server.kill(); } catch (e) { /* gone */ } process.exit(ok ? 0 : 1); }
server.on('error', function () { end(false); });
setTimeout(ask, 200);
