'use strict';

// Phase B: a --relay process 404s Jobs/fs/proxy/desktop APIs.
// Brochure GET / is static (no who-list script).
//
//   node spirit/test/labMaster/relaySurface.test.js

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('../testSupport.js');

const MASTER = 'http://127.0.0.1:65420';
const RELAY_PORT = 65418;
const RELAY_NAME = 'surface-relay';
const ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;

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
    [path.join(__dirname, 'labMaster.js')],
    { cwd: path.join(__dirname, '..', '..', '..'), stdio: 'inherit' }
  );
}

function ensureGone(id) {
  return json(MASTER + '/api/nodes/' + id + '/delete', 'POST', {})
    .catch(function () { return true; });
}

test.startTest('--relay public surface is mailbox + brochure only');

let weStartedMaster = false;
let masterChild = null;

Promise.resolve()
  .then(function () { return masterUp(); })
  .then(function (up) {
    if (up) return;
    masterChild = spawnMaster();
    weStartedMaster = true;
    return waitUntil(masterUp, 8000, 'labMaster');
  })
  .then(function () { return ensureGone(RELAY_NAME); })
  .then(function () {
    return json(MASTER + '/api/nodes', 'POST', {
      name: RELAY_NAME, type: 'relay', port: RELAY_PORT,
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('create relay row');
    else test.fail('create → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start relay');
    else test.fail('start → ' + r.status + ' ' + r.text);
    return waitUntil(function () {
      return request(ORIGIN + '/api/relay/who', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'who');
  })
  .then(function () {
    return request(ORIGIN + '/', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 200 && r.text.indexOf('mailbox') !== -1 && r.text.indexOf('/api/relay/who') === -1) {
      test.check('GET / is brochure, no who script');
    } else {
      test.fail('GET / → ' + r.status + ' ' + r.text.slice(0, 160));
    }
    return request(ORIGIN + '/api/relay/who', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 200) test.check('GET /api/relay/who');
    else test.fail('who → ' + r.status);
    // Jobs folded into the one door on 2026-09-15; what a relay must
    // refuse is the door, and the check above already makes that claim.
    // This one keeps asking about the old path because a relay must 404
    // an unknown path too — and that is a different claim worth keeping.
    return request(ORIGIN + '/api/jobs', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 404) test.check('GET /api/jobs 404');
    else test.fail('jobs → ' + r.status + ' ' + r.text);
    // The loopback client door, which a relay must not answer at all.
    // It was /api/proxy until 2026-09-15; the verb folded, the claim did
    // not — a relay serves only isRelayPublicPath, and this is not on it.
    return request(ORIGIN + '/api/spirit', 'POST', { verb: 'net.fetch', url: 'http://example.com' });
  })
  .then(function (r) {
    if (r.status === 404) test.check('POST /api/spirit 404 — the client door is not on a relay');
    else test.fail('spirit door → ' + r.status + ' ' + r.text);
    return request(ORIGIN + '/api/fs/stat?path=index.html', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 404) test.check('GET /api/fs/stat 404');
    else test.fail('fs/stat → ' + r.status + ' ' + r.text);
    // A LIVE HUB ROUTE, deliberately. This asked for /api/hub/claim until
    // 2026-09-15, and that route no longer exists on a NODE either — so
    // the 404 it was getting had stopped saying anything about relays.
    // The claim being made is "a relay serves none of the node's hub
    // surface", and only a route that a node really answers can make it.
    return request(ORIGIN + '/api/hub/who', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 404) test.check('GET /api/hub/who 404 on relay');
    else test.fail('hub who on relay → ' + r.status + ' ' + r.text);
    return request(ORIGIN + '/js/server.js', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 404) test.check('GET /js/server.js 404');
    else test.fail('server.js → ' + r.status);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/delete', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('delete relay');
    else test.fail('delete → ' + r.status);
  })
  .catch(function (err) {
    test.fail(String(err && err.message || err));
  })
  .then(function () {
    test.reportSuccessFailureCount();
    if (weStartedMaster && masterChild) {
      try { masterChild.kill(); } catch (e) { /* already gone */ }
    }
    process.exit(test.failureCount > 0 ? 1 : 0);
  });
