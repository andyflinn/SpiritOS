'use strict';

// spirit/run/js/puppetPost.js
// THE FACE'S ENTRY POINT ON THE VPS PUPPET NODE — public-app-server/G17,
// slice 1 (design/shell/PUBLIC-APP-SERVER.md, "THE ENTRY POINT ON THE VPS").
//
//   Andy, 2026-09-27, retitling G17: "confirm the reply path from
//   app-server-process back to the browser", and "go." on this slice.
//
// A listener that exists only for face traffic. Caddy, on the same box,
// terminates the browser's HTTPS and forwards here; this hands each request
// to the one node app that claimed the face (appFaceApp) and nothing else,
// and sends that app's answer back. The node's own door stays loopback-only
// and separate (server.js:675), so a visitor never reaches the node's verbs.
//
// NAMED AFTER ITS CALLER. Andy: "maybe call it the same name as the
// lowest-level shell function is called?" The page's lowest layer calls
// puppetPost(), and what answers it here carries the same name.
//
// SWITCHED ON BY relay-state/face.json, { "port": n }: absent, nothing
// listens, which is every node but the VPS puppet. A new persist shape,
// covered by Andy's go on the G17 slice that named it.
//
// ── WHAT THE FACE SEES, AND NOTHING MORE (wsl-claude's review, e) ─────
//
// { host, method, path, body }. No raw headers, no socket, no client
// address, no X-Forwarded-For: CLAUDE.md keeps Caddy's forwarded address
// out of review fixes, and a face that never receives it cannot come to
// depend on it.
//
// ── ONE REQUEST FAILS ALONE (review, c) ──────────────────────────────
//
// A handler that never answers is cut off at FACE_WAIT_MS with 504; one that
// throws or rejects gets 502; a rejection that lands after the 504 is caught
// here and goes nowhere. The next request is served either way.
//
// ── A BODY OVER BODY_MAX IS REFUSED BY NAME, UNREAD (review, extra) ───
//
// 413 before the handler runs, so a visitor cannot make the face parse
// more than a packet could ever carry on its way to the owner.

const http = require('http');

const FACE_WAIT_MS = 30000;
const FACE_BIND = '127.0.0.1';

function createPuppetPost(opts) {
  const o = opts || {};
  const bodyMax = Number(o.bodyMax) > 0 ? Number(o.bodyMax) : require('./limits').BODY_MAX;
  const waitMs = Number(o.waitMs) > 0 ? Number(o.waitMs) : FACE_WAIT_MS;
  const log = o.log || function () {};

  // ONE CLAIMANT. The face belongs to the app that claimed it; the same
  // app claiming again (a remount) replaces its handler, and any other
  // app is refused, so a second app can never quietly take the visitors.
  let claimedBy = '';
  let handler = null;

  function claim(appName, fn) {
    const name = String(appName || '');
    if (!name || typeof fn !== 'function') throw new Error('puppetPost: claim needs an app name and a handler');
    if (claimedBy && claimedBy !== name) throw new Error('puppetPost: the face is already claimed by ' + claimedBy);
    claimedBy = name;
    handler = fn;
    return true;
  }

  function answer(res, status, body, type) {
    if (res.headersSent) return;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8' });
    res.end(text);
  }

  function refuse(res, status, error) {
    answer(res, status, { ok: false, error: error });
  }

  function handle(req, res) {
    if (!handler) { refuse(res, 503, 'no-face'); return; }
    const chunks = [];
    let size = 0;
    let over = false;
    req.on('data', function (chunk) {
      if (over) return;
      size += chunk.length;
      if (size > bodyMax) {
        over = true;
        refuse(res, 413, 'face-body-too-large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (over) return;
      const face = {
        host: String(req.headers.host || ''),
        method: String(req.method || ''),
        path: String(req.url || ''),
        body: Buffer.concat(chunks).toString('utf8'),
      };
      let settled = false;
      const timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        refuse(res, 504, 'face-timeout');
      }, waitMs);
      let pending;
      try { pending = Promise.resolve(handler(face)); }
      catch (e) { pending = Promise.reject(e); }
      pending.then(function (out) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const o2 = out || {};
        const status = Number.isInteger(o2.status) && o2.status >= 100 && o2.status < 600 ? o2.status : 200;
        const body = o2.body === undefined ? '' : o2.body;
        answer(res, status, body, typeof o2.type === 'string' ? o2.type : undefined);
      }, function (e) {
        // Caught whether or not it is late: an unhandled rejection from a
        // visitor's request must never reach the process.
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        log('puppetPost: the face failed: ' + ((e && e.message) || e));
        refuse(res, 502, 'face-failed');
      });
    });
  }

  // LOOPBACK ONLY (review, a): Caddy is on the same box and is the only
  // thing that should ever reach this.
  function listen(port, done) {
    const server = http.createServer(handle);
    server.listen(port, FACE_BIND, function () {
      log('puppetPost listening on ' + FACE_BIND + ':' + server.address().port);
      if (typeof done === 'function') done(server);
    });
    return server;
  }

  return { claim: claim, listen: listen, handle: handle, claimedBy: function () { return claimedBy; } };
}

// relay-state/face.json, read once at start. Anything but a whole port
// number reads as "no face here".
function faceConfigIn(rootDir) {
  const fs = require('fs');
  const path = require('path');
  let raw = null;
  try { raw = JSON.parse(fs.readFileSync(path.join(String(rootDir || ''), 'relay-state', 'face.json'), 'utf8')); }
  catch (e) { return null; }
  const port = raw && Number(raw.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
  return { port: port };
}

module.exports = { createPuppetPost: createPuppetPost, faceConfigIn: faceConfigIn, FACE_WAIT_MS: FACE_WAIT_MS, FACE_BIND: FACE_BIND };
