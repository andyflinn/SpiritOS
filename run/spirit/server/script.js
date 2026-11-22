'use strict';
// run/spirit/server/script.js
// THE MOST TRIVIAL WEB SERVER OF THE NEXT TREE (goal/G50.1, box v9: "create a trivial web server in repo://run/spirit/",
// "default port 11111", "server requires http and spirit/script.js", "index.html prints hello in the <body>").
//
//   node spirit/server/script.js [--port N]     (from repo://run/)
//
// THE URL IS THE FILE'S PATH (goal/G50.1; Andy: "shouldn't the script tag specify spirit/script.js, and no fudging of the
// namespace???"): the web root is repo://run/, two folders up, so /spirit/script.js is run/spirit/script.js. A folder's
// address answers its index.html, the one special name, so the page is /spirit/.
// NEVER SERVED, BY NAME (goal/G50.1, cw's line the box left as is: "server/ never served by its name"): a path with a
// folder named server anywhere in it is refused, wherever that folder stands, so the server's own code never reaches a
// page. A path that climbs out of the root is refused too.
const http = require('http');
const fs = require('fs');
const path = require('path');
const spirit = require('../script.js');

const ROOT = path.resolve(__dirname, '..', '..');
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
  // ONE SPELLING PER FILE (goal/G50.1, wsl's red: /spirit//index.html/ answered the page): a path is /, then names joined
  // by single slashes, a folder's ending in one slash; an empty name (//) or a slash after a file is refused.
  if (p.charAt(0) !== '/') return null;
  const trailing = p.length > 1 && p.slice(-1) === '/';
  const parts = (trailing ? p.slice(1, -1) : p.slice(1)).split('/');
  if (parts.some(function (s) { return s === ''; })) return null;
  if (parts.some(function (s) { return s === '..' || s.toLowerCase() === NEVER_SERVED; })) return null;
  let full = path.resolve(ROOT, parts.join(path.sep));
  if (full !== ROOT && full.indexOf(ROOT + path.sep) !== 0) return null;
  // A folder is asked by its address with the slash, /spirit/, never /spirit (Andy: "the only URL that should work is:
  // 127.0.0.1:11111/spirit/   or 127.0.0.1:11111/spirit/index.html").
  try {
    const dir = fs.statSync(full).isDirectory();
    if (dir !== trailing) return null;
    if (dir) full = path.join(full, 'index.html');
  } catch (e) { /* not there: answered 404 */ }
  return full;
}

function answer(req, res) {
  const file = fileOf(req.url);
  if (!file || req.method !== 'GET') { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
  fs.readFile(file, function (err, body) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    // NO STALE COPY (goal/G50.1; Andy loaded the page after the push and found no requireScript): the browser asks again
    // on every load, so a page always shows the tree as it is on disc.
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  });
}

const port = portOf(process.argv);
http.createServer(answer).listen(port, '127.0.0.1', function () {
  console.log('spirit is listening on 127.0.0.1:' + port);
});
