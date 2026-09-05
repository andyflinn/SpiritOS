'use strict';

// Phase I: Ed25519 claim + send. allow.json holds public keys.
//
//   node spirit/test/labMaster/relaySignedPing.test.js

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const test = require('../testSupport.js');
const auth = require('../../run/js/relayAuth.js');

const MASTER = 'http://127.0.0.1:65420';
const RELAY_PORT = 65416;
const ANDY_PORT = 65417;
const RELAY_NAME = 'sign-relay';
const ANDY_NAME = 'sign-andy';
const RELAY_ORIGIN = 'http://127.0.0.1:' + RELAY_PORT;
const ANDY_ORIGIN = 'http://127.0.0.1:' + ANDY_PORT;
const TEXT = 'signed ping ' + Date.now();

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

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

test.startTest('claim verification: ed25519 signed claim/send');

let weStartedMaster = false;
let masterChild = null;
const andyId = auth.generateIdentity('andy');
const malloryId = auth.generateIdentity('andy'); // same name, wrong key
// bert is the recipient, and reading a mailbox is now signature-gated in
// keys mode exactly as claiming and sending are — so bert needs a real
// key on the allow list to read bert's own inbox below.
const bertId = auth.generateIdentity('bert');

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
    return waitUntil(masterUp, 8000, 'labMaster');
  })
  .then(function () { return ensureGone(RELAY_NAME); })
  .then(function () { return ensureGone(ANDY_NAME); })
  .then(function () {
    return json(MASTER + '/api/nodes', 'POST', {
      name: RELAY_NAME, type: 'relay', port: RELAY_PORT,
    });
  })
  .then(function (r) {
    if (r.status !== 201) throw new Error('create relay ' + r.status + ' ' + r.text);
    test.check('create relay row');
    writeJson(path.join(r.json.node.home, 'relay-state', 'allow.json'), {
      keys: [
        { name: 'andy', publicKey: andyId.publicKey },
        { name: 'bert', publicKey: bertId.publicKey },
      ],
    });
    test.check('allow.json has andy and bert public keys');
    return json(MASTER + '/api/nodes', 'POST', {
      name: ANDY_NAME, type: 'avatar', port: ANDY_PORT,
    });
  })
  .then(function (r) {
    if (r.status !== 201) throw new Error('create avatar ' + r.status + ' ' + r.text);
    test.check('create avatar row');
    writeJson(path.join(r.json.node.home, 'relay-state', 'identity.json'), andyId);
    writeJson(path.join(r.json.node.home, 'app', 'natter', 'relays.json'), [
      { label: 'cast relay', url: RELAY_ORIGIN },
    ]);
    test.check('avatar identity + natter url');
    return json(MASTER + '/api/nodes/' + RELAY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status !== 200) throw new Error('start relay ' + r.status);
    test.check('start relay');
    return json(MASTER + '/api/nodes/' + ANDY_NAME + '/start', 'POST', {});
  })
  .then(function (r) {
    if (r.status !== 200) throw new Error('start avatar ' + r.status);
    test.check('start avatar');
    return waitUntil(function () {
      return request(ANDY_ORIGIN + '/', 'GET', null)
        .then(function (x) { return x.status === 200; })
        .catch(function () { return false; });
    }, 10000, 'avatar up');
  })
  .then(function () {
    return json(ANDY_ORIGIN + '/api/hub/claim', 'POST', { name: 'andy' });
  })
  .then(function (r) {
    if (r.status === 201 || r.status === 409) test.check('hub signed claim');
    else test.fail('hub claim → ' + r.status + ' ' + r.text);
    return json(RELAY_ORIGIN + '/api/relay/claim', 'POST', { name: 'andy' });
  })
  .then(function (r) {
    if (r.status === 403) test.check('unsigned claim rejected');
    else test.fail('unsigned claim → ' + r.status + ' ' + r.text);
    var bad = auth.sign(malloryId.privateKey, auth.claimMessage('andy'));
    return json(RELAY_ORIGIN + '/api/relay/claim', 'POST', { name: 'andy', sig: bad });
  })
  .then(function (r) {
    if (r.status === 403) test.check('wrong-key claim rejected');
    else test.fail('wrong-key claim → ' + r.status + ' ' + r.text);
    return json(ANDY_ORIGIN + '/api/hub/send', 'POST', {
      from: 'andy', to: 'bert', text: TEXT,
    });
  })
  .then(function (r) {
    if (r.status === 201 && r.json && r.json.text === TEXT) test.check('hub signed send');
    else test.fail('hub send → ' + r.status + ' ' + r.text);
    return json(RELAY_ORIGIN + '/api/relay/send', 'POST', {
      from: 'andy', to: 'bert', text: 'forged',
    });
  })
  .then(function (r) {
    if (r.status === 403) test.check('unsigned send rejected');
    else test.fail('unsigned send → ' + r.status + ' ' + r.text);
    // Reads are gated too, not just writes: a bare ?name= used to hand any
    // caller that peer's whole mailbox even here, where every write is
    // cryptographically proven.
    return json(RELAY_ORIGIN + '/api/relay/inbox?name=bert', 'GET', null);
  })
  .then(function (r) {
    if (r.status === 403) test.check('unsigned inbox read rejected');
    else test.fail('unsigned inbox read → ' + r.status + ' ' + r.text);
    const bertSig = auth.sign(bertId.privateKey, auth.inboxMessage('bert'));
    return json(RELAY_ORIGIN + '/api/relay/inbox?name=bert&sig=' + encodeURIComponent(bertSig), 'GET', null);
  })
  .then(function (r) {
    var hit = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === TEXT; });
    var forged = r.json && Array.isArray(r.json.messages) &&
      r.json.messages.some(function (m) { return m.text === 'forged'; });
    if (r.status === 200 && hit && !forged) test.check('inbox has signed line only');
    else test.fail('inbox → ' + r.status + ' ' + r.text);
  })
  .then(function () { return json(MASTER + '/api/nodes/' + ANDY_NAME + '/delete', 'POST', {}); })
  .then(function () { return json(MASTER + '/api/nodes/' + RELAY_NAME + '/delete', 'POST', {}); })
  .then(function () { test.check('lab rows deleted'); })
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
