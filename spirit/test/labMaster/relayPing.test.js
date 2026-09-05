'use strict';

// Headless cast: labMaster creates relay+avatar, ping the mailbox, delete both.
// Work@65432 is never touched.
//
//   node spirit/test/labMaster/relayPing.test.js
//
// labMaster may already be running on 65420; if not, this file starts it
// and stops it on the way out (only if we started it).

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('../testSupport.js');

const MASTER = 'http://127.0.0.1:65420';
const RELAY_PORT = 65410;
const ANDY_PORT = 65411;
const RELAY_NAME = 'ping-relay';
const ANDY_NAME = 'ping-andy';
const FROM = 'andy';
const TO = 'bert';
const TEXT = 'suite ping ' + Date.now();

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
    req.setTimeout(5000, function () { req.destroy(new Error('timeout ' + urlString)); });
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
  const child = spawn(
    process.execPath,
    [path.join(__dirname, 'labMaster.js')],
    { cwd: path.join(__dirname, '..', '..', '..'), stdio: 'inherit' }
  );
  return child;
}

function ensureGone(id) {
  return json(MASTER + '/api/nodes/' + id + '/delete', 'POST', {})
    .then(function () { return true; })
    .catch(function () { return true; });
}

test.startTest('labMaster cast: relay + avatar mailbox ping');

let weStartedMaster = false;
let masterChild = null;

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
    if (r.status === 201 && r.json && r.json.node) test.check('create relay row');
    else test.fail('create relay → ' + r.status + ' ' + r.text);
    return json(MASTER + '/api/nodes', 'POST', {
      name: ANDY_NAME, type: 'avatar', port: ANDY_PORT,
    });
  })
  .then(function (r) {
    if (r.status === 201) test.check('create avatar row');
    else test.fail('create avatar → ' + r.status + ' ' + r.text);
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
      return request('http://127.0.0.1:' + RELAY_PORT + '/api/relay/who', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'relay /api/relay/who');
  })
  .then(function () {
    test.check('relay /api/relay/who answers');
    return json('http://127.0.0.1:' + RELAY_PORT + '/api/relay/claim', 'POST', { name: FROM });
  })
  .then(function (r) {
    if (r.status === 201 || r.status === 409) test.check('claim andy');
    else test.fail('claim → ' + r.status + ' ' + r.text);
    return json('http://127.0.0.1:' + RELAY_PORT + '/api/relay/send', 'POST', {
      from: FROM, to: TO, text: TEXT,
    });
  })
  .then(function (r) {
    if (r.status === 201 && r.json && r.json.text === TEXT) test.check('send stored');
    else test.fail('send → ' + r.status + ' ' + r.text);
    return json('http://127.0.0.1:' + RELAY_PORT + '/api/relay/inbox?name=' + TO, 'GET', null);
  })
  .then(function (r) {
    var hit = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === TEXT; });
    if (r.status === 200 && hit) test.check('inbox contains ping');
    else test.fail('inbox → ' + r.status + ' ' + r.text);
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
