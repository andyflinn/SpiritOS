'use strict';
// run/spirit/server/script.js
// THE MOST TRIVIAL WEB SERVER OF THE NEXT TREE (goal/G50.1, box v9: "create a trivial web server in repo://run/spirit/",
// "default port 11111", "server requires http and spirit/script.js", "index.html prints hello in the <body>").
//
//   node spirit/server/script.js [--port N]     (from repo://run/)
//
// The folder above this one, run/spirit/, is the web root: / answers index.html, any other path the file at that place.
// NEVER SERVED, BY NAME (goal/G50.1, cw's line the box left as is: "server/ never served by its name"): a path with a
// folder named server anywhere in it is refused, wherever that folder stands, so the server's own code never reaches a
// page. A path that climbs out of the root is refused too.
const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('../script.js');

const ROOT = path.resolve(__dirname, '..');
const NEVER_SERVED = 'server';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function portOf(argv) {
  const at = argv.indexOf('--port');
  const n = at === -1 ? 11111 : Number(argv[at + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 11111;
}

// The file a request names, or null when it may not be served.
function fileOf(url) {
  let p = '';
  try { p = decodeURIComponent(String(url || '/').split('?')[0]); } catch (e) { return null; }
  if (p === '/' || p === '') p = '/index.html';
  const parts = p.split('/').filter(Boolean);
  if (parts.some(function (s) { return s === '..' || s.toLowerCase() === NEVER_SERVED; })) return null;
  const full = path.resolve(ROOT, parts.join(path.sep));
  if (full !== ROOT && full.indexOf(ROOT + path.sep) !== 0) return null;
  return full;
}

function answer(req, res) {
  const file = fileOf(req.url);
  if (!file || req.method !== 'GET') { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  fs.readFile(file, function (err, body) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  });
}

const port = portOf(process.argv);
http.createServer(answer).listen(port, '127.0.0.1', function () {
  console.log(spirit.name + ' is listening on 127.0.0.1:' + port);
});
