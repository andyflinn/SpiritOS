#!/usr/bin/env node
'use strict';

// spirit/test/tools/doorWalk.js
// EVERY VERB THE DOOR CLAIMS, CALLED ONCE, AND WHAT CAME BACK.
//
//   Andy, 2026-09-25: "then you need only one suite that makes every api
//   call" — and, on starting: "push, the we go."
//
// A METER, NOT A GATE, on his ruling for the bottoms catch-up: "meterin,
// yes, get stats, and defer decisions." Nothing here asserts. It calls
// and it reports, and the report is the denominator for the return bound
// — because "five verbs return a collection" is a HAND COUNT, and a hand
// count is a remembered fact among re-derived neighbours.
//
// ── IT GOES THROUGH THE REAL DOOR, OVER REAL HTTP ────────────────────
//
// Because that is what the audience faces. Andy on what the product IS:
// "the developer, no matter what language, gets a local port via which
// he can do secure p2p posting." A meter that called handlers in-process
// would measure something no developer can reach.
//
// ── AND IT CHEATS TO GET THE LIST. NAMED, PER 0010 ──────────────────
//
// THE DOOR CANNOT BE ASKED WHAT IT CAN DO. `verbTable.js:144 verbs()`
// exists for exactly that — "for a client to be told what this node can
// do, which is the beginning of the answer to 'what is the API', asked
// of the node rather than of a document that goes stale" — and its only
// callers in the tree are its own unit suite, on tables that suite
// builds itself. Nothing enumerates the LIVE table and no verb exposes
// it.
//
// So this reads the claim blocks out of server.js's SOURCE. That is
// resemblance, not arrival, and it is the thing this week has been
// against. 0010 says fix the protocol or name the cheat; the cheat is
// named here, and it is its own finding: A DOOR THAT CANNOT DESCRIBE
// ITSELF CANNOT BE WALKED BY ANYBODY WHO DID NOT WRITE IT. The fix is
// one verb returning what verbTable already computes.

const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { setupRelayFakes } = require('../setupRelayFakes');

const RUN = path.join(__dirname, '..', '..', 'run');
const SERVER = path.join(RUN, 'js', 'server.js');

// ── THE CHEAT, IN ONE FUNCTION SO IT IS DELETABLE IN ONE EDIT ────────
function verbsFromSource() {
  const src = fs.readFileSync(SERVER, 'utf8');
  const out = [];
  const seen = Object.create(null);
  const claimRe = /loopbackVerbs\.claim\(\s*'([a-z][a-z0-9]*)'/g;
  let m;
  const marks = [];
  while ((m = claimRe.exec(src))) marks.push({ ns: m[1], at: m.index });
  marks.forEach(function (mark, i) {
    const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
    const block = src.slice(mark.at, end);
    const wireM = /wire:\s*(true|false)/.exec(block);
    const wire = wireM ? wireM[1] === 'true' : null;
    const keyRe = /'([a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*)'\s*:/g;
    let k;
    while ((k = keyRe.exec(block))) {
      const verb = k[1];
      if (verb.split('.')[0] !== mark.ns) continue;
      if (seen[verb]) continue;
      seen[verb] = true;
      out.push({ verb: verb, ns: mark.ns, by: null, wire: wire });
    }
  });
  return out.sort(function (a, b) { return a.verb < b.verb ? -1 : 1; });
}

function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () {
      const p = probe.address().port;
      probe.close(function () { resolve(p); });
    });
  });
}

// Lifted from serverSurface.js's request(), which is the suite that
// already drives this door over real HTTP. Said rather than silently
// re-typed: a fourth copy of a fixture is the duplication this week's
// SOP exists to catch, and if these two ever need to agree they should
// share rather than resemble.
function post(port, body, waitMs) {
  return new Promise(function (resolve) {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: port, path: '/api/spirit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, function (res) {
      let text = '';
      res.on('data', function (c) { text += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: text }); });
    });
    req.on('error', function (e) { resolve({ status: 0, text: '', error: e.code || String(e) }); });
    req.setTimeout(waitMs || 6000, function () { req.destroy(new Error('timeout')); });
    req.end(payload);
  });
}

function waitForBoot(port, startedAt) {
  const began = startedAt || Date.now();
  return post(port, { verb: 'node.card' }, 1500).then(function (r) {
    if (r.status) return true;
    if (Date.now() - began > 20000) throw new Error('server did not boot on ' + port);
    return new Promise(function (r2) { setTimeout(r2, 200); }).then(function () {
      return waitForBoot(port, began);
    });
  });
}

// WHAT THE DOOR SAID, IN ITS OWN WORDS. The bucket is derived from the
// refusal rather than guessed: the code is printed beside it so a reader
// can disagree with the bucketing without re-running anything.
function classify(r) {
  if (!r.status) return { bucket: 'threw', code: r.error || 'no-response' };
  let said = null;
  try { said = JSON.parse(r.text); } catch (e) { said = null; }
  const code = (said && (said.code || said.error)) || '';
  if (r.status >= 200 && r.status < 300) {
    return { bucket: 'called', code: '', bytes: Buffer.byteLength(r.text) };
  }
  // A WIRE VERB SAYING "NOT REACHABLE" IS THE CONTRACT WORKING, NOT A
  // FAULT. verbTable.js:73 — "wire can answer 'not reachable right now',
  // and yields a hash". The first version of this tool counted those as
  // `threw` and reported two failures that were two successes. A meter
  // that miscounts is the thing this week is against.
  if (/not reachable|econnrefused|unreachable|no relay/i.test(String(code) + ' ' + String(r.text))) {
    return { bucket: 'wire-unreachable', code: String(code) || ('http ' + r.status) };
  }
  if (r.status >= 500) return { bucket: 'threw', code: String(code) || ('http ' + r.status) };
  const t = (String(code) + ' ' + String(r.text)).toLowerCase();
  if (/missing|required|no .*(given|supplied)|must be|invalid|malformed|bad[- ]request|not a /.test(t)) {
    return { bucket: 'needs-a-body', code: String(code) || ('http ' + r.status) };
  }
  return { bucket: 'refused-other', code: String(code) || ('http ' + r.status) };
}

const nodeRoot = setupRelayFakes().andy;
const verbs = verbsFromSource();
let child = null;
let said = '';

freePort().then(function (port) {
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], {
    cwd: nodeRoot, stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', function (c) { said = (said + c).slice(-4096); });
  return waitForBoot(port).then(function () { return port; });
}).then(function (port) {
  return verbs.reduce(function (chain, v) {
    return chain.then(function (acc) {
      // THE EMPTY BODY IS THE MEASUREMENT. A walker that passes nothing
      // tests the refusal path for every verb — which is precisely the
      // finding, not a flaw in the walk: the table carries no argument
      // shape, so nothing here COULD build a body. What each verb says
      // about its own missing arguments is the closest the door comes to
      // describing itself.
      return post(port, { verb: v.verb }).then(function (r) {
        acc.push(Object.assign({}, v, classify(r)));
        return acc;
      });
    });
  }, Promise.resolve([]));
}).then(function (rows) {
  const by = { called: [], 'needs-a-body': [], 'wire-unreachable': [], 'refused-other': [], threw: [] };
  rows.forEach(function (r) { by[r.bucket].push(r); });

  console.log('');
  console.log('== EVERY VERB THE DOOR CLAIMS, CALLED WITH NO BODY ==');
  console.log('   ' + rows.length + ' verbs, from ' +
    Object.keys(rows.reduce(function (a, r) { a[r.ns] = 1; return a; }, {})).length + ' namespaces');
  console.log('   LIST READ FROM server.js SOURCE — the door cannot be asked. See the header.');
  console.log('');
  ['called', 'needs-a-body', 'wire-unreachable', 'refused-other', 'threw'].forEach(function (b) {
    console.log('  -- ' + b + ': ' + by[b].length + ' --');
    by[b].forEach(function (r) {
      const wire = r.wire === null ? '?' : (r.wire ? 'wire ' : 'local');
      const tail = b === 'called' ? (r.bytes + ' bytes') : r.code;
      console.log('     ' + wire + '  ' + r.verb.padEnd(22) + tail);
    });
    console.log('');
  });
  console.log('  ANSWERED WITH NO ARGUMENTS AT ALL: ' + by.called.length + ' of ' + rows.length +
    '. Those are the verbs whose answer is a decided value or a collection —');
  console.log('  and the ones whose bytes grow with the data are the return bound\'s denominator.');
  if (said.trim()) console.log('\n  the node also said:\n    ' + said.trim().split('\n').slice(-6).join('\n    '));
  if (child) { try { child.kill(); } catch (e) { /* gone */ } }
}).catch(function (e) {
  console.error('doorWalk: ' + ((e && e.message) || e));
  if (said.trim()) console.error('  the node said:\n    ' + said.trim().split('\n').slice(-8).join('\n    '));
  if (child) { try { child.kill(); } catch (e2) { /* gone */ } }
  process.exit(1);
});
