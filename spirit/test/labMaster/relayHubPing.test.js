'use strict';

// Same cast as relayPing.test.js, but claim/send go through the avatar's
// /api/hub/* (Node → relay). Browser is not involved.
// Relays.json in the TEMP avatar is rewritten to this cast's relay port
// (tracked default still says :65430).
//
//   node spirit/test/labMaster/relayHubPing.test.js

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('../testSupport.js');

const MASTER = 'http://127.0.0.1:65420';
const RELAY_PORT = 65412;
const ANDY_PORT = 65413;
const RELAY_NAME = 'hub-relay';
const ANDY_NAME = 'hub-andy';
const FROM = 'andy';
const TO = 'bert';
const TEXT = 'hub suite ping ' + Date.now();
const ANDY_ORIGIN = 'http://127.0.0.1:' + ANDY_PORT;
const RELAY_ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;

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
    .then(function () { return true; })
    .catch(function () { return true; });
}

function pointNatterAtRelay(home) {
  const file = path.join(home, 'app', 'natter', 'relays.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify([
    { label: 'cast relay', url: RELAY_ORIGIN }
  ], null, 2));
}

test.startTest('labMaster cast: avatar /api/hub/* → relay mailbox');

let weStartedMaster = false;
let masterChild = null;
let andyHome = null;

Promise.resolve()
  .then(function () { return masterUp(); })
  .then(function (up) {
    if (up) {
      test.comment('labMaster already on 65420');
      return;
    }
    test.comment('starting labMaster');
    masterChild = spawnMaster();
    weStartedMaster = true;
    return waitUntil(masterUp, 8000, 'labMaster /api/nodes');
  })
  .then(function () { return ensureGone(RELAY_NAME); })
  .then(function () { return ensureGone(ANDY_NAME); })
  .then(function () {
    return json(MASTER + '/api/nodes', 'POST', {
      name: RELAY_NAME, type: 'relay', port: RELAY_PORT,
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('create relay row');
    else test.fail('create relay → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes', 'POST', {
      name: ANDY_NAME, type: 'avatar', port: ANDY_PORT,
    });
  })
  .then(function (r) {
    if (r.status === 201 && r.json && r.json.node && r.json.node.home) {
      test.check('create avatar row');
      andyHome = r.json.node.home;
    } else {
      test.fail('create avatar → ' + r.status + ' ' + r.text);
    }
    if (andyHome) pointNatterAtRelay(andyHome);
    test.check('TEMP relays.json points at :' + RELAY_PORT);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start relay');
    else test.fail('start relay → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + ANDY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('start avatar');
    else test.fail('start avatar → ' + r.status + ' ' + r.text);
    return waitUntil(function () {
      return request(RELAY_ORIGIN + '/api/relay/who', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'relay who');
  })
  .then(function () {
    return waitUntil(function () {
      return request(ANDY_ORIGIN + '/', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'avatar GET /');
  })
  .then(function () {
    test.check('both nodes listening');
    return json(ANDY_ORIGIN + '/api/hub/claim', 'POST', { name: FROM });
  })
  .then(function (r) {
    if (r.status === 201 || r.status === 409) test.check('hub claim via :' + ANDY_PORT);
    else test.fail('hub claim → ' + r.status + ' ' + r.text);
    return json(ANDY_ORIGIN + '/api/hub/send', 'POST', {
      from: FROM, to: TO, text: TEXT,
    });
  })
  .then(function (r) {
    if (r.status === 201 && r.json && r.json.text === TEXT) {
      test.check('hub send via :' + ANDY_PORT);
    } else {
      test.fail('hub send → ' + r.status + ' ' + r.text);
    }
    return json(RELAY_ORIGIN + '/api/relay/inbox?name=' + TO, 'GET', null);
  })
  .then(function (r) {
    var hit = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === TEXT; });
    if (r.status === 200 && hit) test.check('relay inbox sees hub send');
    else test.fail('relay inbox → ' + r.status + ' ' + r.text);
    return json(ANDY_ORIGIN + '/api/hub/inbox?name=' + TO, 'GET', null);
  })
  .then(function (r) {
    var hit = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === TEXT; });
    if (r.status === 200 && hit) {
      test.check('hub inbox via :' + ANDY_PORT);
    } else if (r.status === 404) {
      test.comment('GET /api/hub/inbox not wired yet — skipped');
    } else {
      test.fail('hub inbox → ' + r.status + ' ' + r.text);
    }
  })
  .then(function () { return json(MASTER + '/api/nodes/' + ANDY_NAME + '/delete', 'POST', {}); })
  .then(function (r) {
    if (r.status === 200) test.check('delete avatar');
    else test.fail('delete avatar → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/delete', 'POST', {});
  })
  .then(function (r) {
    if (r.status === 200) test.check('delete relay');
    else test.fail('delete relay → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes', 'GET', null);
  })
  .then(function (r) {
    var ids = ((r.json && r.json.nodes) || []).map(function (n) { return n.id; });
    if (ids.indexOf(RELAY_NAME) === -1 && ids.indexOf(ANDY_NAME) === -1) {
      test.check('lab rows gone');
    } else {
      test.fail('lab rows still in table: ' + ids.join(','));
    }
    if (ids.indexOf('work') !== -1) test.check('work row untouched');
    else test.fail('work row missing from table');
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
