'use strict';

// spirit/test/everyVerb.js
// ONE SUITE THAT MAKES EVERY API CALL (puppets/G3).
//
//   Andy: "then you need only one suite that makes every api call." And,
//   on this shape, 2026-09-28: "go."
//
// The list of verbs is READ FROM server.js's claim blocks, never typed
// here. That is the point: serverSurface.js keeps a hand list, and its own
// completeness check matched only `'x.y': function`, so proxy.allow and
// proxy.remove (claimed through proxyVerb(...)) were never called and it
// stayed green. A verb added tomorrow is called here tomorrow, by
// construction.
//
// Parsed rather than asked of the running node, for serverSurface's reason:
// there is no verb that lists verbs, and adding one to satisfy a test would
// put a door in the register to check the register (and would need Andy's
// yes, as any node verb does).
//
// A real node, from the same fakes the relay lab uses, pointed at no real
// relay, in the temp dir, never the checkout. Each verb is called once with
// no arguments beyond its name.

const fs = require('fs');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const limits = require('../run/js/limits.js');
const { setupRelayFakes } = require('./setupRelayFakes');

test.startTest('Every verb the node claims is called, and answers');

const BOOT_TIMEOUT_MS = 10000;
const root = setupRelayFakes().andy;
// No real relay: relays.json is tracked, so the fakes carry the production
// list (serverSurface.js explains the cost of forgetting this).
fs.writeFileSync(path.join(root, 'app', 'natter', 'relays.json'),
  JSON.stringify([{ label: 'nowhere', url: 'https://127.0.0.1:1' }]), 'utf8');

const serverSrc = fs.readFileSync(path.join(root, 'js', 'server.js'), 'utf8');
// doorContract.js's pattern: every claim line, whatever its value is.
const VERBS = [...serverSrc.matchAll(/^ {4}'([a-z]+\.[a-zA-Z]+)':/gm)].map(function (m) { return m[1]; });

// ── THE VERBS THAT ANSWER WITH A LIST, until each becomes a search ─────
//
// Andy: "there are no (complete) lists, only searches" (puppets/G2). A
// ratchet, not a verdict: each verb here answers with an array today. When
// one becomes search + get it must LEAVE this list, and a new verb that
// answers with an array must be ADDED to it knowingly. Either way this
// suite goes red until the list says what is true.
const LISTS_TODAY = [
  'jobs.list', 'owner.boxes', 'peer.list', 'peer.search', 'proxy.close', 'proxy.list', 'proxy.open',
  'relay.record', 'relay.status',
];

function freePort() {
  return new Promise(function (resolve, reject) {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', function () {
      const port = probe.address().port;
      probe.close(function () { resolve(port); });
    });
  });
}
function call(port, method, pathname, body) {
  return new Promise(function (resolve) {
    const payload = body == null ? '' : JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1', port: port, path: pathname, method: method,
      headers: body == null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, bytes: buf.length, text: buf.toString('utf8') });
      });
    });
    req.on('error', function (e) { resolve({ status: 0, bytes: 0, text: '', error: e.code || String(e) }); });
    req.setTimeout(8000, function () { req.destroy(new Error('timeout')); });
    req.end(payload);
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function waitForBoot(port) {
  const started = Date.now();
  return (function poll() {
    return call(port, 'GET', '/').then(function (r) {
      if (r.status === 200) return true;
      if (Date.now() - started > BOOT_TIMEOUT_MS) throw new Error('the node did not boot on ' + port);
      return sleep(150).then(poll);
    });
  }());
}
// Does this answer carry an array, at the top or one level down?
function carriesList(text) {
  let j = null;
  try { j = JSON.parse(text); } catch (e) { return false; }
  if (Array.isArray(j)) return true;
  if (!j || typeof j !== 'object') return false;
  return Object.keys(j).some(function (k) {
    const v = j[k];
    if (Array.isArray(v)) return true;
    return !!v && typeof v === 'object' && Object.keys(v).some(function (k2) { return Array.isArray(v[k2]); });
  });
}

let child = null;
let said = '';

(async function () {
  // ── THE LIST IS READ, AND IT IS THE REAL ONE ────────────────────────
  if (VERBS.length >= 30 && VERBS.indexOf('node.card') !== -1 && VERBS.indexOf('proxy.allow') !== -1) {
    test.check(VERBS.length + ' verbs read from server.js\'s claim blocks, including the two a hand list missed '
      + '(proxy.allow, proxy.remove)');
  } else {
    test.fail('only ' + VERBS.length + ' verbs parsed out of server.js: the claim shape moved, and nothing below '
      + 'can be trusted');
  }

  // ── BOTH DOORS RUN ONE TABLE ────────────────────────────────────────
  //
  // The owner door (a puppet running its owner's command) and the loopback
  // door must look a verb up in the SAME table, or "proxies the entire
  // node api" (G7) is a second list that can drift. Read from the source,
  // because the owner door needs a relay to be driven live.
  const loopbackDoor = /const run = loopbackVerbs\.handlerFor\(verb\);/.test(serverSrc);
  const ownerDoor = /puppetDoor\(\{[\s\S]{0,300}?handlerFor: function \(verb\) \{ return loopbackVerbs\.handlerFor\(verb\); \}/
    .test(serverSrc);
  if (loopbackDoor && ownerDoor) {
    test.check('the loopback door and the owner door both look verbs up in loopbackVerbs, so every verb here '
      + 'is every verb a puppet\'s owner can reach (subject to what it carries)');
  } else {
    test.fail('the doors no longer share one table: loopback ' + loopbackDoor + ', owner ' + ownerDoor);
  }

  const port = await freePort();
  child = spawn(process.execPath, ['js/server.js', '--port', String(port)], {
    cwd: root, stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', function (c) { said = (said + c).slice(-4096); });
  try {
    await waitForBoot(port);
  } catch (e) {
    test.fail(e.message + ': ' + said.trim().split('\n').slice(-6).join(' | '));
    child.kill();
    test.reportSuccessFailureCount();
    return;
  }

  // ── EVERY VERB, ONCE ────────────────────────────────────────────────
  const answers = {};
  for (let i = 0; i < VERBS.length; i += 1) {
    answers[VERBS[i]] = await call(port, 'POST', '/api/spirit', { verb: VERBS[i] });
  }

  // Answered at all: no hang, no dropped connection, never "no such verb"
  // (which would mean the parse and the table disagree), never a 500 (a
  // handler that fell over on an empty body).
  const broken = VERBS.filter(function (v) {
    const a = answers[v];
    return a.status === 0 || a.status === 500 || /no such verb/.test(a.text);
  });
  if (!broken.length) {
    test.check('all ' + VERBS.length + ' verbs answer a bare call: none hangs, none is unknown to the table, '
      + 'none falls over with a 500');
  } else {
    test.fail('verbs that did not answer properly: ' + broken.map(function (v) {
      return v + ' (' + (answers[v].error || answers[v].status) + ')';
    }).join(', '));
  }

  const alive = await call(port, 'GET', '/');
  if (alive.status === 200) {
    test.check('and the node is still serving after every verb has been called');
  } else {
    test.fail('the node stopped answering after the sweep: ' + said.trim().split('\n').slice(-6).join(' | '));
  }

  // ── LISTS, UNTIL THEY ARE SEARCHES ──────────────────────────────────
  const lists = VERBS.filter(function (v) { return carriesList(answers[v].text); }).sort();
  const gone = LISTS_TODAY.filter(function (v) { return lists.indexOf(v) === -1; });
  const added = lists.filter(function (v) { return LISTS_TODAY.indexOf(v) === -1; });
  if (!gone.length && !added.length) {
    test.check(lists.length + ' verbs still answer with a list, each named in LISTS_TODAY until it becomes '
      + 'a search (G2): ' + lists.join(', '));
  } else {
    test.fail((added.length ? 'NEW verbs answering with a list: ' + added.join(', ') + '. Add them to LISTS_TODAY '
      + 'knowingly, or make them searches. ' : '')
      + (gone.length ? 'No longer a list: ' + gone.join(', ') + '. Take them off LISTS_TODAY.' : ''));
  }

  // ── EVERY ANSWER FITS THE CAP, once the cap exists (puppets/G1) ─────
  //
  // G1 is declared in puppetsPending.js. Until limits.js exports
  // RESPONSE_MAX there is no number to hold answers to, and this section
  // says so rather than inventing one. Measured at the time of writing, on
  // a fresh node: jobs.list answered 42,570 bytes, over PLAINTEXT_MAX.
  if (typeof limits.RESPONSE_MAX === 'number') {
    const over = VERBS.filter(function (v) { return answers[v].bytes > limits.RESPONSE_MAX; });
    if (!over.length) {
      test.check('every answer fits RESPONSE_MAX (' + limits.RESPONSE_MAX + ' bytes)');
    } else {
      test.fail('answers over RESPONSE_MAX (' + limits.RESPONSE_MAX + '): ' + over.map(function (v) {
        return v + ' ' + answers[v].bytes;
      }).join(', '));
    }
  }

  child.kill();
  test.reportSuccessFailureCount();
}()).catch(function (e) {
  if (child) child.kill();
  test.fail('the sweep itself failed: ' + e.message);
  test.reportSuccessFailureCount();
});
