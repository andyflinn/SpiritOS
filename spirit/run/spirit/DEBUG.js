// spirit/run/spirit/DEBUG.js
// THE DEBUG TEST ROUTES, FOR NODE AND RELAY ALIKE (goal/G41.19; spec and test: ./test/DEBUG.md, ./test/DEBUG.js).
// Andy: "in DEBUG mode spirit/serverCommon.js does the following: it activates the following, dynamic path system";
// "a module repo:/spirit/run/spirit/DEBUG.js that serveCommon.js "requires"?"; "DEBUG.js gets only loop-back requests,
// and none with non-loopback headers."
//
// Both servers hand it every request first (serveCommon.debugFirst). It answers its own addresses only while DEBUG is
// on, and only to this machine:
//
//   /DEBUG/<path>/<module>/<generatorScript>.<ext>
//
// <path> the folders between spirit/run/ and the module, <module> its name without .js, <generatorScript> a script in
// ./DEBUG/ without .js, <ext> the reply's type. With no such generator, the file the address names, /DEBUG left off, if
// it sits inside a test/ folder. Anything else is not its own: it answers nothing, and the request goes on as if it had
// never been asked, so a refused address answers as an address of no route does.
//
// A REQUEST CADDY PASSED ON IS NOT FROM THIS MACHINE: behind Caddy a relay hears the internet from the loopback, so a
// forwarded-from header refuses as an outside address does.
//
// It only reads the address and hands it to the generator script, which makes the answer:
//   make({ module, file, ext, run, server }) -> Promise<{ type, body } | null>, null for not its own.
'use strict';

require('../spirit.js');
const fs = require('fs');
const path = require('path');

const RUN = path.join(__dirname, '..');
const GENERATORS = path.join(__dirname, 'DEBUG');
const PREFIX = '/DEBUG/';
const PART = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const NAME = /^[A-Za-z0-9_]+$/;
const TYPES = { html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8' };
const FORWARDED = ['x-forwarded-for', 'forwarded', 'x-real-ip', 'x-forwarded-host'];

function fromLoopback(address) {
  const a = String(address || '');
  return a === '::1' || /^127\./.test(a) || /^::ffff:127\./.test(a);
}

// The address read as DEBUG.js's, or null: the raw request line, before anything resolves a ".." away.
function addressOf(req) {
  const raw = String(req.url || '').split('?')[0];
  if (raw.indexOf(PREFIX) !== 0 || raw.indexOf('..') !== -1 || raw.indexOf('%') !== -1) return null;
  const parts = raw.slice(PREFIX.length).split('/');
  if (parts.length < 2 || !parts.every(function (p) { return PART.test(p); })) return null;
  const last = parts[parts.length - 1];
  const dot = last.lastIndexOf('.');
  const generator = dot > 0 ? last.slice(0, dot) : '';
  const ext = dot > 0 ? last.slice(dot + 1) : '';
  const module = parts.slice(0, -1).join('/');
  const file = path.join(RUN, module + '.js');
  const script = path.join(GENERATORS, generator + '.js');
  if (NAME.test(generator) && TYPES[ext] && fs.existsSync(script) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return { module: module, file: file, ext: ext, script: script };
  }
  // NO SUCH GENERATOR: THE FILE THE ADDRESS NAMES, /DEBUG left off (Andy, box v19: "DEBUG.js will, if the generator implied
  // by the URL does NOT exist, will attempt to serve the exact file implied by the URL, Leaving "DEBUG/" out"), so an
  // element's own test can open pages of its own: /DEBUG/shell/js/test/html/grantsPanel-noTable.html. Only a file inside
  // a test/ folder, so no server script is handed out.
  const own = path.join(RUN, parts.join('/'));
  if (parts.slice(0, -1).indexOf('test') !== -1 && fs.existsSync(own) && fs.statSync(own).isFile()) {
    return { served: own, type: spirit.MIME_TYPES['.' + ext] || 'application/octet-stream' };
  }
  return null;
}

// True when the request was DEBUG.js's and is answered (or being answered) here.
function answer(req, res, server) {
  if (!spirit.debug()) return false;
  if (req.method !== 'GET') return false;
  if (!fromLoopback(req.socket && req.socket.remoteAddress)) return false;
  if (FORWARDED.some(function (h) { return req.headers[h] !== undefined; })) return false;
  const at = addressOf(req);
  if (!at) return false;
  if (at.served) {
    fs.readFile(at.served, function (err, bytes) {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': at.type, 'Cache-Control': 'no-store' });
      res.end(bytes);
    });
    return true;
  }
  let made = null;
  try { made = require(at.script).make({ module: at.module, file: at.file, ext: at.ext, run: RUN, server: server || {} }); }
  catch (e) { made = Promise.reject(e); }
  Promise.resolve(made).then(function (out) {
    if (!out) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': out.type || TYPES[at.ext], 'Cache-Control': 'no-store' });
    res.end(out.body);
  }, function (e) {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('the generator failed: ' + String((e && e.message) || e));
  });
  return true;
}

module.exports = { answer: answer };
