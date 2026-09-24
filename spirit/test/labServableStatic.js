'use strict';

// The HTTP half of the read gate: server.js's generic static route must
// refuse every Node-only module under js/ the same way loadFile does, with
// BOOT_ASSETS as the one deliberate exception (js/kernel.js reaches the
// browser as the page's own boot script even though fileServable says no).
//
// servableAssets.js already covers the in-process side of the same rule.
// This runs against a real listening server because the static route
// consults BOOT_ASSETS *before* fileServable, and that interaction can
// only be observed over the wire.
//
// Deliberately an **avatar** node, not a relay: on a --relay node every
// one of these paths 404s via isRelayPublicPath's allowlist, which would
// make each row pass for a reason that has nothing to do with
// fileServable (relaySurface.test.js is where that allowlist is tested).
//
//   node spirit/test/labServableStatic.js

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');

const MASTER = require('./labMaster/labPaths').MASTER;
const ANDY_PORT = 65421;
const ANDY_NAME = 'static-andy';
const ORIGIN = 'http://127.0.0.1:' + ANDY_PORT;

// Only paths that exist in a fake node's home are listed — labMaster
// builds one from `git ls-files`, so media/ (untracked) and relay-state/
// (created at runtime by a relay) are absent there and a 404 on either
// would prove nothing. servableAssets.js covers both against the real tree.
const STATIC_ROUTES = [
  // Node-only modules: no browser half, no legitimate read path.
  { path: '/js/kernel.js', expect: 200, why: 'BOOT_ASSETS exception — the page boots on it' },
  { path: '/js/jobs.js', expect: 404, why: 'Node-only' },
  { path: '/js/server.js', expect: 404, why: 'Node-only' },
  { path: '/js/relay.js', expect: 404, why: 'Node-only' },
  { path: '/js/hub.js', expect: 404, why: 'Node-only' },
  { path: '/js/relayAuth.js', expect: 404, why: 'Node-only' },
  // Genuine browser assets and ordinary app data stay reachable.
  { path: '/js/client/shell.js', expect: 200, why: 'browser boot' },
  { path: '/index.html', expect: 200, why: 'desktop homepage' },
  { path: '/relay.html', expect: 200, why: 'reachable by its own path in either mode' },
  { path: '/favicon.svg', expect: 200, why: 'static asset' },
  { path: '/app/natter/natter.js', expect: 200, why: 'the shell fetches app entry scripts' },
  // relays.json STOOD HERE and is gone from a fake node's home: it stopped
  // being tracked, because a node's own relay list is its own state and a
  // tracked one is reverted by every `git reset --hard origin/master`
  // (.gitignore says the whole of why). It joins media/ and relay-state/
  // in the note above — absent from a git-built home, so a 404 on it would
  // prove nothing about the route.
  //
  // The manifest is the better example anyway: it is app data the SHELL
  // actually fetches, on every boot, for every app.
  { path: '/app/natter/natter.json', expect: 200, why: 'ordinary scoped app data' },
];

function request(urlString, method, bodyObj) {
  return new Promise(function (resolve, reject) {
    const url = new URL(urlString);
    const payload = bodyObj == null ? '' : JSON.stringify(bodyObj);
    const req = http.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Host': url.host,
      },
    }, function (res) {
      let chunks = '';
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () { resolve({ status: res.statusCode, text: chunks }); });
    });
    req.on('error', reject);
    req.setTimeout(8000, function () { req.destroy(new Error('timeout ' + urlString)); });
    req.end(payload);
  });
}

function json(urlString, method, bodyObj) {
  return request(urlString, method, bodyObj).then(function (r) {
    let parsed = null;
    try { parsed = r.text ? JSON.parse(r.text) : null; } catch (e) { parsed = null; }
    return { status: r.status, text: r.text, json: parsed };
  });
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function waitUntil(fn, timeoutMs, label) {
  const started = Date.now();
  return (function poll() {
    return Promise.resolve()
      .then(fn)
      .then(function (ok) {
        if (ok) return true;
        if (Date.now() - started > timeoutMs) {
          throw new Error('timeout waiting for ' + label);
        }
        return sleep(200).then(poll);
      });
  }());
}

function masterUp() {
  return request(MASTER + '/api/nodes', 'GET', null)
    .then(function (r) { return r.status === 200; })
    .catch(function () { return false; });
}

function spawnMaster() {
  return spawn(
    process.execPath,
    [path.join(__dirname, 'labMaster', 'labMaster.js')],
    { cwd: path.join(__dirname, '..', '..'), stdio: 'ignore' }
  );
}

function ensureGone(id) {
  return json(MASTER + '/api/nodes/' + id + '/delete', 'POST', {})
    .then(function () { return true; })
    .catch(function () { return true; });
}

test.startTest('Static route honours fileServable (+ the BOOT_ASSETS exception)');

let weStartedMaster = false;
let masterChild = null;

Promise.resolve()
  .then(function () { return masterUp(); })
  .then(function (up) {
    if (up) {
      test.comment('labMaster already on ' + require('./labMaster/labPaths').PORT);
      // NEVER ANOTHER CHECKOUT'S labMaster (2026-09-22): its fixtures are its
      // own tree, so this suite would test that tree and pass.
      return require('./labMaster/ensureMaster').checkout().then(function (c) {
        // STOOD DOWN, NOT RED (2026-09-24). Another checkout's
        // labMaster is a fact about this machine, cleared in one
        // command; a suite that reports it as a fault says the tree
        // is broken when it is not. `standDown` is marked on the
        // error so the chain's own catch below can tell it from a
        // genuine failure without matching on the sentence.
        if (!c.same) {
          const e = new Error('the labMaster on ' + require('./labMaster/labPaths').PORT +
            ' copies from ' + c.theirs + ', not this checkout — run your own: ' +
            'LAB_MASTER_PORT=45420, or stop theirs — the harness starts its own ' +
            'when none is up.');
          e.standDown = true;
          throw e;
        }
      });
    }
    test.comment('starting labMaster');
    masterChild = spawnMaster();
    weStartedMaster = true;
    return waitUntil(masterUp, 8000, 'labMaster /api/nodes');
  })
  .then(function () { return ensureGone(ANDY_NAME); })
  .then(function () {
    return json(MASTER + '/api/nodes', 'POST', {
      name: ANDY_NAME, type: 'avatar', port: ANDY_PORT,
      // A working-tree copy under %TEMP%, never a clone of
      // origin/master: a suite tests the code being written (labWorld.js).
      kind: 'fixture',
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('create avatar row');
    else test.fail('create avatar → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + ANDY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start avatar');
    else test.fail('start avatar → ' + r.status + ' ' + r.text);
    return waitUntil(function () {
      return request(ORIGIN + '/', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'avatar GET /');
  })
  .then(function () {
    test.check('avatar listening on :' + ANDY_PORT);
    return STATIC_ROUTES.reduce(function (chain, row) {
      return chain.then(function () {
        return request(ORIGIN + row.path, 'GET', null).then(function (res) {
          if (res.status === row.expect) {
            test.check('GET ' + row.path + ' → ' + row.expect + ' (' + row.why + ')');
          } else {
            test.fail('GET ' + row.path + ' → ' + res.status + ', expected ' + row.expect + ' (' + row.why + ')');
          }
        });
      });
    }, Promise.resolve());
  })
  .then(function () {
    return json(MASTER + '/api/nodes/' + ANDY_NAME + '/delete', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('delete avatar');
    else test.fail('delete → ' + r.status);
  })
  .catch(function (err) {
    if (err && err.standDown) { test.standsDown(err.message); return; }
    test.fail(String(err && err.message || err));
  })
  .then(function () {
    test.reportSuccessFailureCount();
    if (weStartedMaster && masterChild) {
      try { masterChild.kill(); } catch (e) { /* already gone */ }
    }
    process.exit(test.failureCount > 0 ? 1 : 0);
  });
