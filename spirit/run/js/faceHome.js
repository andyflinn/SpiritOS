'use strict';

// spirit/run/js/faceHome.js
// THE HOME NODE ANSWERS ITS FACE (goal/G30.13, step 2 of goal/G30.10). The box, Andy's:
//   - The home node answers face requests through the same door a puppeteer uses on it: the local shell's whole
//     interface, minus the email and face changes with the relay. Only the face and its connection are protected.
//   - It streams to the face what it streams to its loopback shell.
//   - faceStream has its own serializing queue, in priority order: 1. face requests, 2. the fs-watcher stream, 3. the
//     presence stream, 4. the app servers' streams, 5. stats, dropped whenever the queue is busy; 6. the node-monitor
//     is not sent at all for now. Route updates go only to the home node, never to the face.
//   - One event a line. An answer to a face request goes out on its own, at once. All other events are bundled:
//     whatever is waiting goes out together in the next write, each still its own whole line. Nothing is merged, the
//     fs-watcher's events are never dropped, and a face that falls behind catches up in one write.
//   - Presence peer by peer: one event for each peer whose presence changed, not the whole table each time.
//
// HOW IT RIDES THE RELAY (goal/G30.14, relay.js faceCall .. faceFeed): the relay puts the face's request on this
// node's stream as a 'face' event { id, request } (presenceNode hands it here). The answer is its own upload to
// /api/relay/face/answer?id=, signed relayAuth.faceMessage for that id, so a request is item 1 by never waiting behind
// anything. face-open starts one long upload to /api/relay/face/stream (signed for 'stream'), carrying the queue's
// lines; face-close ends it.
//
// A request { get: path } is a file, served by the node's own GET (serveFile, the gate the browser's GET passes);
// any other is { verb, ...args } through call (nodeDoor.call, the puppeteer's door).

// THE SEALED LINK (goal/G30.11). A face that can seal (face/seal.js, the node's own seal in WebCrypto) makes one key for
// its session and sends each request as { sealed: 1, e, n, c, k }, sealed from its key k to this node's key; the answer
// is ndjson, each line sealed from this node to k: first { status, type }, then the body in pieces of FACE_PIECE bytes,
// each piece's text its bytes in base64. Its stream is sealed to k line by line, k handed over by face-open. A face
// that cannot seal is answered as before, unsealed; it was warned that the relay can read it.

const http = require('http');
const https = require('https');
const auth = require('./relayAuth');
const seal = require('./seal');

const FACE_PRIORITY = { fs: 2, presence: 3, app: 4, stats: 5 };
const FACE_PIECE = 64 * 1024;

// What a face may not ask its home node (the box: "minus the email and face changes with the relay"). The email is
// set by relay.join, the face name by relay.face, which posts { face } to the relay; a peer.post carrying { face }
// is that same change by hand.
function faceRefuses(request) {
  const r = request || {};
  const verb = String(r.verb || '');
  if (verb === 'relay.face' || verb === 'relay.join') return verb + ' changes this node\'s email or face with the relay';
  if (verb === 'peer.post') {
    let packet = null;
    try { packet = JSON.parse(String(r.text || '')); } catch (e) { packet = null; }
    const body = packet && packet.body;
    if (body && typeof body === 'object' && body.face) return 'a post carrying a face name changes this node\'s face with the relay';
  }
  return '';
}

// THE SERIALIZING QUEUE. One write at a time on the sink; an event pushed while the sink is free is written at once,
// one pushed while it is busy waits, and everything waiting goes out together in the next write, in priority order.
// Stats are dropped whenever the queue is busy.
function createFaceQueue(sink, encode) {
  const outLine = typeof encode === 'function' ? encode : function (line) { return line; };
  let waiting = {};
  let busy = false;
  function anyWaiting() { return Object.keys(waiting).length > 0; }
  function flush() {
    if (busy || !anyWaiting()) return;
    const out = [];
    Object.keys(waiting).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) { out.push.apply(out, waiting[p]); });
    waiting = {};
    if (sink.write(out.join('\n') + '\n') === false) {
      busy = true;
      sink.once('drain', function () { busy = false; flush(); });
    }
  }
  function push(priority, event) {
    if (priority === FACE_PRIORITY.stats && (busy || anyWaiting())) return false;
    let line = '';
    try { line = outLine(JSON.stringify(event)); } catch (e) { return false; }
    if (!line) return false;
    (waiting[priority] = waiting[priority] || []).push(line);
    flush();
    return true;
  }
  return { push: push };
}

// A writable POST to a relay, the bytes sent as they are written (chunked: no length is known).
function postTo(url, p, headers) {
  const target = new URL(p, url);
  const lib = target.protocol === 'https:' ? https : http;
  const req = lib.request(target, { method: 'POST', headers: Object.assign({ 'content-type': 'application/octet-stream' }, headers) });
  req.on('response', function (res) { res.resume(); });
  return req;
}

function createFaceHome(opts) {
  const o = opts || {};
  const say = typeof o.log === 'function' ? o.log : function () {};
  const upload = o.upload || postTo;
  const jobs = o.jobs;
  const faces = Object.create(null);   // relay url -> { req, queue } while a face is open there
  let presence = Object.create(null);  // key -> { present, at }: what the faces were last told

  function signed(url, id) {
    const me = o.identity();
    return {
      'x-spirit-from': me.publicKey,
      'x-spirit-sig': auth.sign(me.privateKey, auth.faceMessage(me.publicKey, o.relayKey(url) || '', id)),
    };
  }

  // The response a face request is answered into: the upload starts at writeHead, which carries the status and type.
  function answerInto(url, id) {
    let req = null;
    return {
      writeHead: function (status, headers) {
        const h = headers || {};
        req = upload(url, '/api/relay/face/answer?id=' + encodeURIComponent(id), Object.assign(signed(url, id), {
          'x-spirit-status': String(status || 200),
          'x-spirit-type': String(h['Content-Type'] || h['content-type'] || 'application/octet-stream'),
        }));
        if (req && typeof req.on === 'function') req.on('error', function (e) { say('face: the answer to ' + id + ' could not be sent: ' + e.message); });
        return this;
      },
      write: function (chunk) { return req ? req.write(chunk) : false; },
      end: function (chunk) { if (req) req.end(chunk); },
    };
  }

  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  // An answer sealed to the face's key k: the head as the first sealed line, then the body in sealed pieces as it is
  // written. The relay sees one ndjson answer, status 200, and reads none of it.
  function sealedInto(res, k) {
    const me = o.identity();
    let held = Buffer.alloc(0);
    function line(text) { return JSON.stringify(seal.seal(k, me.publicKey, k, text)) + '\n'; }
    function pieces(final) {
      while (held.length >= FACE_PIECE || (final && held.length)) {
        const piece = held.subarray(0, FACE_PIECE);
        held = held.subarray(piece.length);
        res.write(line(piece.toString('base64')));
      }
    }
    return {
      writeHead: function (status, headers) {
        const h = headers || {};
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(line(JSON.stringify({ status: status || 200, type: String(h['Content-Type'] || h['content-type'] || 'application/octet-stream') })));
        return this;
      },
      write: function (chunk) { held = Buffer.concat([held, Buffer.from(chunk)]); pieces(false); return true; },
      end: function (chunk) { if (chunk) held = Buffer.concat([held, Buffer.from(chunk)]); pieces(true); res.end(); },
    };
  }

  function request(url, data) {
    const d = data || {};
    const id = String(d.id || '');
    if (!id) return;
    let r = d.request || {};
    let res = answerInto(url, id);
    if (r.sealed === 1) {
      const k = String(r.k || '');
      const me = o.identity();
      const got = k ? seal.open(me.sealPrivateKey, k, me.publicKey, r) : null;
      let inner = null;
      try { inner = got ? JSON.parse(got.text) : null; } catch (e) { inner = null; }
      if (!inner || typeof inner !== 'object') { json(res, 400, { ok: false, code: 'not-opened', error: 'the sealed request did not open' }); return; }
      r = inner;
      res = sealedInto(res, k);
    }
    const no = faceRefuses(r);
    if (no) { json(res, 403, { ok: false, code: 'not-from-the-face', error: no }); return; }
    if (typeof r.get === 'string') { o.serveFile(r.get.replace(/^\/+/, ''), res); return; }
    const verb = String(r.verb || '');
    const args = Object.assign({}, r);
    Promise.resolve(o.call(verb, args)).then(function (a) {
      const status = (a && a.status) || 500;
      if (a && a.body !== undefined && a.body !== null) json(res, status, a.body);
      else { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(String((a && a.text) || '')); }
    }, function (e) { json(res, 500, { ok: false, code: 'handler-failed', error: String((e && e.message) || e) }); });
  }

  // What the loopback shell gets, sorted into the box's priorities; anything else (the node-monitor among it) is not
  // sent. An app server is a process/js module publishing an app object (puppetStream's test of the same thing).
  function priorityOf(job) {
    if (!job) return 0;
    if (job.type === 'fs-watcher') return FACE_PRIORITY.fs;
    if (job.type === 'server-stats') return FACE_PRIORITY.stats;
    if (/^process\/js\/[^/]+$/.test(String(job.module || '')) && job.app && typeof job.app === 'object') return FACE_PRIORITY.app;
    return 0;
  }

  function toFaces(priority, event) {
    Object.keys(faces).forEach(function (url) { faces[url].queue.push(priority, event); });
  }

  // Peer by peer: only the keys whose { present, at } changed, a key gone from the table as not present.
  function presenceChanged(table) {
    const next = table || {};
    const changed = [];
    Object.keys(next).forEach(function (key) {
      const was = presence[key];
      const is = next[key] || {};
      if (!was || was.present !== is.present || was.at !== is.at) changed.push({ key: key, present: is.present === true, at: is.at });
    });
    Object.keys(presence).forEach(function (key) { if (!(key in next)) changed.push({ key: key, present: false }); });
    presence = Object.assign(Object.create(null), next);
    return changed;
  }

  function onJob(job) {
    if (job && job.type === 'relay-presence') {
      presenceChanged(job.data && job.data.presence).forEach(function (p) { toFaces(FACE_PRIORITY.presence, { event: 'presence', data: p }); });
      return;
    }
    const p = priorityOf(job);
    if (p) toFaces(p, { event: 'job-updated', data: job });
  }
  if (jobs && jobs.events) jobs.events.on('job-updated', onJob);

  // The face opened: one long upload, and first what a loopback shell gets on connect, the tree as commands (server.js
  // handleSseConnection), presence peer by peer, the app servers' objects.
  // k is the face's key from face-open: given, every line is sealed to it; absent, the face could not seal.
  function open(url, k) {
    close(url);
    const req = upload(url, '/api/relay/face/stream', signed(url, 'stream'));
    if (!req) return;
    const key = String(k || '');
    const me = key ? o.identity() : null;
    const encode = key ? function (line) { return JSON.stringify(seal.seal(key, me.publicKey, key, line)); } : null;
    const face = { req: req, queue: createFaceQueue(req, encode) };
    faces[url] = face;
    if (typeof req.on === 'function') {
      req.on('error', function (e) { say('face: the stream to ' + url + ' failed: ' + e.message); });
      // The relay ending the upload while the face is still open (a refusal, a network drop): said, not retried.
      req.on('close', function () { if (faces[url] === face) { delete faces[url]; say('face: the stream to ' + url + ' ended'); } });
    }
    const all = (jobs && typeof jobs.listJobs === 'function') ? jobs.listJobs() : [];
    const fsJob = all.filter(function (j) { return j.type === 'fs-watcher'; })[0];
    if (fsJob && typeof jobs.fsTreeCommands === 'function') {
      jobs.fsTreeCommands().forEach(function (command) {
        face.queue.push(FACE_PRIORITY.fs, { event: 'job-updated', data: Object.assign({}, fsJob, { data: { command: command } }) });
      });
      face.queue.push(FACE_PRIORITY.fs, { event: 'job-updated', data: Object.assign({}, fsJob, { data: { treeComplete: true } }) });
    }
    const table = (all.filter(function (j) { return j.type === 'relay-presence'; })[0] || {}).data;
    const now = (table && table.presence) || {};
    presence = Object.assign(Object.create(null), now);
    Object.keys(now).forEach(function (key) {
      face.queue.push(FACE_PRIORITY.presence, { event: 'presence', data: { key: key, present: now[key].present === true, at: now[key].at } });
    });
    all.forEach(function (j) { if (priorityOf(j) === FACE_PRIORITY.app) face.queue.push(FACE_PRIORITY.app, { event: 'job-updated', data: j }); });
  }

  function close(url) {
    const face = faces[url];
    if (!face) return;
    delete faces[url];
    try { face.req.end(); } catch (e) { /* gone */ }
  }

  return { request: request, open: open, close: close };
}

module.exports = {
  createFaceHome: createFaceHome, createFaceQueue: createFaceQueue, faceRefuses: faceRefuses, FACE_PRIORITY: FACE_PRIORITY, FACE_PIECE: FACE_PIECE,
};
