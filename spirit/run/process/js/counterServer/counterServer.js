'use strict';

// spirit/run/process/js/counterServer/counterServer.js
// THE TEST SERVER — processes/G1.1.
//
//   Andy, 2026-09-28: "the test server will be a dumb web server that
//   serves one page with a server-side counter, that increments every time
//   the server serves GET "/" and shows the increased counter on the page.
//   the page will be assembeled by the server in ram".
//
// The counter lives in this process's memory and nowhere else, so it starts
// at 1 whenever the server really starts again: that is what makes it a
// probe for the process subsystem (processes/G1). It reads and writes no
// file and requires nothing but Node's own http.
//
// Started as the launch dialog starts a process: its arguments arrive as one
// JSON string, `node counterServer.js '{"port":P}'`.

const http = require('http');

// Two ways in: the launch dialog's one JSON string, or by hand, the usual
// way, `node counterServer.js --port 44444` (Andy tried exactly that).
let args = {};
const argv = process.argv.slice(2);
if (argv[0] && argv[0].trim().charAt(0) === '{') {
  try { args = JSON.parse(argv[0]); } catch (e) { args = {}; }
} else {
  const at = argv.indexOf('--port');
  if (at !== -1) args.port = argv[at + 1];
}
const port = Number(args.port);

// A PORT, OR NO START (processes/G1.2): missing, not a whole number, or
// outside 1-65535 is refused at once, by name, instead of Node's own crash.
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('counterServer: no valid port (got ' + JSON.stringify(args.port === undefined ? null : args.port) +
    '); give one from 1 to 65535, e.g. --port 44444\n');
  process.exit(2);
}

let count = 0;

function page(n) {
  return '<!doctype html><html><head><meta charset="utf-8"><title>Counter</title></head>' +
    '<body><h1>This page has been served ' + n + ' time' + (n === 1 ? '' : 's') + '.</h1></body></html>';
}

http.createServer(function (req, res) {
  // Only GET / counts; anything else leaves the counter where it is.
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET' });
    res.end('only GET\n');
    return;
  }
  if (req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  count += 1;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(page(count));
}).listen(port, '127.0.0.1');
